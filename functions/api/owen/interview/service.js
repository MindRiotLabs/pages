/**
 * MindRiot Labs — OWEN Experience Acquisition Server-Side Service Boundary
 *
 * Bridges Cloudflare Pages Functions at /api/owen/interview/* to the canonical
 * @mrl/owen ExperienceAcquisitionAgent and Supabase durable persistence.
 *
 * Architectural & Security Invariants:
 * - Zero core interview logic or schema duplication in MindRiotLabs; all intelligence,
 *   epistemic separation, and brief synthesis execute via @mrl/owen.
 * - No hardcoded fallback invitation tokens or development auth bypasses.
 * - Strict session-to-token binding: each token authorizes ONLY its intended session/participant.
 * - Invitation tokens are accepted only via HTTP headers or POST body (never URL query strings).
 * - Server-side rate limiting and brute-force lockout (429 Too Many Requests).
 * - Durable persistence uses token-gated Supabase SECURITY DEFINER RPCs
 *   (owen_upsert_interview_session / owen_get_interview_session) on project xkgtipcyswjpvwmmawmf.
 * - Never exposes raw API keys, database credentials, or invitation_token_sha256 to clients.
 */

import * as crypto from 'node:crypto';
import {
  ExperienceAcquisitionAgent,
  GeminiInteractionsInterviewProvider,
  HeuristicAdaptiveInterviewProvider,
  ElevenLabsVoiceAdapter,
  InMemoryInterviewSessionStore,
  createRussRichmondPilotSessionConfig,
  hashInvitationToken,
  InterviewAccessDeniedError,
  InterviewConsentRequiredError
} from '@mrl/owen';

export {
  InterviewAccessDeniedError,
  InterviewConsentRequiredError,
  hashInvitationToken
};

export const DEFAULT_PILOT_001_SESSION_ID = 'ses-pilot-001-russ-richmond';
export const DISPOSABLE_UAT_SESSION_ID = 'ses-uat-disposable-002';
export const FOUNDER_UAT_V02_SESSION_ID = 'ses-founder-uat-jvh-v02';
export const REVOKED_SESSION_IDS = new Set(['ses-uat-disposable-001']);
export const REVOKED_TOKEN_SHA256S = new Set([
  '598311524dbc2c4ad97fd09771e82fd1b5640f3f694b08510a3ef794593add06',
  '223559fccace9d5078cb825592cb4d1e5148abaad6ed7996cfd1d3a5045b04df',
  'e6d2517a6f6c38c2fb53e9c8fa1e62b780bed593938e65503acfd4ec85334216'
]);
export const DEFAULT_SUPABASE_URL = 'https://xkgtipcyswjpvwmmawmf.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_a84bMzDhwTFRDxLnfMTLcA_pov-Kgr3';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-owen-invite-token, ElevenLabs-Signature',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, no-cache, must-revalidate, private',
  'Pragma': 'no-cache',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY'
};

export class InterviewRateLimitError extends Error {
  constructor(message, retryAfterSeconds = 60) {
    super(message);
    this.name = 'InterviewRateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 60;
const FAILED_AUTH_WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILED_AUTH_ATTEMPTS = 8;

const requestRateBuckets = new Map();
const failedAuthBuckets = new Map();

let cachedMemoryStore = null;
let cachedWebhookAdapter = null;

export function getClientKey(request) {
  if (!request || !request.headers) return 'unknown-client';
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('cf-connecting-ip') ||
    (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    'local-client'
  );
}

export function enforceRateLimit(request) {
  const clientKey = getClientKey(request);
  const now = Date.now();

  // 1. Check failed authentication lockout bucket first
  const authBucket = failedAuthBuckets.get(clientKey);
  if (authBucket) {
    if (now - authBucket.windowStart > FAILED_AUTH_WINDOW_MS) {
      failedAuthBuckets.delete(clientKey);
    } else if (authBucket.failures >= MAX_FAILED_AUTH_ATTEMPTS) {
      const retryAfter = Math.max(
        1,
        Math.ceil((FAILED_AUTH_WINDOW_MS - (now - authBucket.windowStart)) / 1000)
      );
      throw new InterviewRateLimitError(
        'Too many failed authentication attempts. Access temporarily throttled.',
        retryAfter
      );
    }
  }

  // 2. Check general request rate limit bucket
  let reqBucket = requestRateBuckets.get(clientKey);
  if (!reqBucket || now - reqBucket.windowStart > RATE_LIMIT_WINDOW_MS) {
    reqBucket = { windowStart: now, count: 0 };
    requestRateBuckets.set(clientKey, reqBucket);
  }
  reqBucket.count += 1;

  if (reqBucket.count > MAX_REQUESTS_PER_WINDOW) {
    const retryAfter = Math.max(
      1,
      Math.ceil((RATE_LIMIT_WINDOW_MS - (now - reqBucket.windowStart)) / 1000)
    );
    throw new InterviewRateLimitError(
      'Rate limit exceeded for OWEN interview endpoint. Please wait before retrying.',
      retryAfter
    );
  }
}

export function recordFailedAuthAttempt(request) {
  const clientKey = getClientKey(request);
  const now = Date.now();
  let authBucket = failedAuthBuckets.get(clientKey);
  if (!authBucket || now - authBucket.windowStart > FAILED_AUTH_WINDOW_MS) {
    authBucket = { windowStart: now, failures: 0 };
    failedAuthBuckets.set(clientKey, authBucket);
  }
  authBucket.failures += 1;
}

export function clearFailedAuthAttempts(request) {
  const clientKey = getClientKey(request);
  failedAuthBuckets.delete(clientKey);
}

/**
 * Durable InterviewSessionStore backed by Supabase REST RPC functions:
 * - owen_upsert_interview_session(p_session, p_invitation_token_sha256)
 * - owen_get_interview_session(p_session_id, p_invitation_token_sha256)
 */
export class SupabaseRpcInterviewSessionStore {
  constructor({ supabaseUrl, supabaseKey, activeTokenSha256, fallbackMemoryStore }) {
    this.supabaseUrl = (supabaseUrl || DEFAULT_SUPABASE_URL).replace(/\/+$/, '');
    this.supabaseKey = supabaseKey || DEFAULT_SUPABASE_ANON_KEY;
    this.activeTokenSha256 = activeTokenSha256;
    this.fallbackMemoryStore = fallbackMemoryStore;
    this.requestSessionCache = new Map();
    this.lastReadMs = 0;
    this.lastWriteMs = 0;
    this.readCount = 0;
    this.writeCount = 0;
  }

  async saveSession(session) {
    const tokenSha =
      session?.access_control?.invitation_token_sha256 || this.activeTokenSha256;

    if (session && session.id) {
      this.requestSessionCache.set(session.id, structuredClone(session));
    }

    if (this.fallbackMemoryStore) {
      await this.fallbackMemoryStore.saveSession(session);
    }

    const t0 = Date.now();
    const res = await fetch(
      `${this.supabaseUrl}/rest/v1/rpc/owen_upsert_interview_session`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: this.supabaseKey,
          Authorization: `Bearer ${this.supabaseKey}`
        },
        body: JSON.stringify({
          p_session: session,
          p_invitation_token_sha256: tokenSha
        })
      }
    );
    this.lastWriteMs = Date.now() - t0;
    this.writeCount += 1;

    if (!res.ok) {
      const errText = await res.text().catch(() => 'Supabase RPC error');
      throw new Error(`Durable session persistence failed (${res.status}): ${errText}`);
    }
  }

  async getSession(sessionId) {
    if (!this.activeTokenSha256) {
      return undefined;
    }

    if (this.requestSessionCache.has(sessionId)) {
      return structuredClone(this.requestSessionCache.get(sessionId));
    }

    const t0 = Date.now();
    const res = await fetch(
      `${this.supabaseUrl}/rest/v1/rpc/owen_get_interview_session`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: this.supabaseKey,
          Authorization: `Bearer ${this.supabaseKey}`
        },
        body: JSON.stringify({
          p_session_id: sessionId,
          p_invitation_token_sha256: this.activeTokenSha256
        })
      }
    );
    this.lastReadMs = Date.now() - t0;
    this.readCount += 1;

    if (!res.ok) {
      return undefined;
    }

    const data = await res.json();
    if (!data || !data.id) {
      return undefined;
    }
    this.requestSessionCache.set(sessionId, structuredClone(data));
    return data;
  }

  async listSessions() {
    return this.fallbackMemoryStore ? this.fallbackMemoryStore.listSessions() : [];
  }
}

/**
 * Extracts the invitation token exclusively from HTTP headers or POST body.
 * Never extracts session secrets from URL query parameters (?token=...) to prevent
 * leakage in server logs, proxy logs, browser history, or Referer headers.
 */
export function extractInviteToken(request, body = null) {
  const authHeader = request.headers.get('Authorization') || '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  const customHeader = request.headers.get('x-owen-invite-token');
  if (customHeader) {
    return customHeader.trim();
  }
  if (body && typeof body.invitation_token === 'string') {
    return body.invitation_token.trim();
  }
  return '';
}

function getEnvValue(env, key) {
  return (
    (env && env[key]) ||
    (typeof process !== 'undefined' && process.env ? process.env[key] : '') ||
    ''
  );
}

/**
 * Returns the configured invitation token for a specific target session ID.
 * Never falls back to a hardcoded token in deployed environments.
 */
export function getConfiguredTokenForSession(env = {}, sessionId = DEFAULT_PILOT_001_SESSION_ID) {
  if (sessionId === DISPOSABLE_UAT_SESSION_ID) {
    return getEnvValue(env, 'OWEN_UAT_DISPOSABLE_INVITE_TOKEN');
  }
  if (sessionId === DEFAULT_PILOT_001_SESSION_ID) {
    return getEnvValue(env, 'OWEN_PILOT_001_INVITE_TOKEN');
  }
  return '';
}

function timingSafeHashMatch(tokenA, tokenB) {
  if (!tokenA || !tokenB) return false;
  const hashA = Buffer.from(hashInvitationToken(tokenA), 'utf8');
  const hashB = Buffer.from(hashInvitationToken(tokenB), 'utf8');
  if (hashA.length !== hashB.length) return false;
  return crypto.timingSafeEqual(hashA, hashB);
}

export function createInterviewServiceContext(env = {}, rawInviteToken = '', sessionId = DEFAULT_PILOT_001_SESSION_ID) {
  const nodeEnv = getEnvValue(env, 'NODE_ENV');
  const storeMode = getEnvValue(env, 'INTERVIEW_STORE');
  const geminiApiKey = getEnvValue(env, 'GEMINI_API_KEY');
  const geminiModelId = getEnvValue(env, 'GEMINI_MODEL_ID') || 'gemini-3.6-flash';
  const elevenLabsApiKey = getEnvValue(env, 'ELEVENLABS_API_KEY');
  const elevenLabsVoiceId = getEnvValue(env, 'ELEVENLABS_VOICE_ID');
  const elevenLabsAgentId = getEnvValue(env, 'ELEVENLABS_AGENT_ID');
  const elevenLabsWebhookSecret = getEnvValue(env, 'ELEVENLABS_WEBHOOK_SECRET');

  if (!cachedMemoryStore) {
    cachedMemoryStore = new InMemoryInterviewSessionStore();
  }

  const useMemoryOnly = nodeEnv === 'test' || storeMode === 'memory';
  const expectedSessionToken = getConfiguredTokenForSession(env, sessionId);
  const activeTokenSha256 = rawInviteToken ? hashInvitationToken(rawInviteToken) : '';

  const store = useMemoryOnly
    ? cachedMemoryStore
    : new SupabaseRpcInterviewSessionStore({
        supabaseUrl: env?.SUPABASE_URL || DEFAULT_SUPABASE_URL,
        supabaseKey: env?.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY,
        activeTokenSha256,
        fallbackMemoryStore: null
      });

  const modelProvider = geminiApiKey
    ? new GeminiInteractionsInterviewProvider({
        apiKey: geminiApiKey,
        modelId: geminiModelId,
        fallbackProvider: new HeuristicAdaptiveInterviewProvider()
      })
    : new HeuristicAdaptiveInterviewProvider();

  if (!cachedWebhookAdapter) {
    cachedWebhookAdapter = new ElevenLabsVoiceAdapter({
      apiKey: elevenLabsApiKey,
      voiceId: elevenLabsVoiceId,
      agentId: elevenLabsAgentId,
      webhookSecret: elevenLabsWebhookSecret,
      syntheticVoiceOwner: 'Joseph Van Harken'
    });
  }

  const agent = new ExperienceAcquisitionAgent({
    store,
    modelProvider
  });

  return {
    agent,
    store,
    modelProvider,
    voiceAdapter: cachedWebhookAdapter,
    expectedSessionToken
  };
}

/**
 * Enforces rate limiting, authenticates the caller's invitation token against the
 * specific target session ID (strictly isolating Russ's session from UAT or any other session),
 * and returns the verified session.
 */
export async function resolveAuthorizedPilotSession(request, env = {}, body = null) {
  enforceRateLimit(request);

  const url = new URL(request.url);
  const sessionId =
    (body && body.session_id) ||
    url.searchParams.get('session_id') ||
    DEFAULT_PILOT_001_SESSION_ID;

  const rawToken = extractInviteToken(request, body);
  if (!rawToken) {
    recordFailedAuthAttempt(request);
    throw new InterviewAccessDeniedError(
      'Private invitation token is required (via Authorization or x-owen-invite-token header).'
    );
  }

  const incomingTokenSha = hashInvitationToken(rawToken);
  if (REVOKED_SESSION_IDS.has(sessionId) || REVOKED_TOKEN_SHA256S.has(incomingTokenSha)) {
    recordFailedAuthAttempt(request);
    throw new InterviewAccessDeniedError(
      'This invitation token or session has been rotated and revoked.'
    );
  }

  const { agent, store, voiceAdapter, expectedSessionToken, modelProvider } =
    createInterviewServiceContext(env, rawToken, sessionId);

  // Enforce strict session-specific token binding for Pilot 001 and UAT sessions
  if (sessionId === DEFAULT_PILOT_001_SESSION_ID || sessionId === DISPOSABLE_UAT_SESSION_ID) {
    if (!expectedSessionToken) {
      recordFailedAuthAttempt(request);
      throw new InterviewAccessDeniedError(
        `Invitation token secret is not configured on the server for session ${sessionId}.`
      );
    }
    if (!timingSafeHashMatch(rawToken, expectedSessionToken)) {
      recordFailedAuthAttempt(request);
      throw new InterviewAccessDeniedError(
        'Invalid or unauthorized invitation token for the requested interview session.'
      );
    }
  }

  // Check if session already exists in store
  let session = await agent.getSession(sessionId);

  if (!session && (sessionId === DEFAULT_PILOT_001_SESSION_ID || sessionId === DISPOSABLE_UAT_SESSION_ID)) {
    const isUat = sessionId === DISPOSABLE_UAT_SESSION_ID;
    const config = createRussRichmondPilotSessionConfig(expectedSessionToken, {
      sessionId,
      modality: voiceAdapter.isConfigured() ? 'ELEVENLABS_VOICE' : 'TEXT_ADAPTIVE',
      voiceId: env?.ELEVENLABS_VOICE_ID,
      participantName: isUat ? 'Disposable UAT Participant (Simulation)' : 'Russ Richmond',
      participantActorId: isUat ? 'actor-uat-disposable-001' : undefined,
      title: isUat
        ? 'UAT Disposable Simulation: Institutional Knowledge & Decision Continuity'
        : undefined
    });
    session = await agent.createSession(config);
  }

  try {
    const verifiedSession = await agent.verifySessionAccess(sessionId, rawToken);
    clearFailedAuthAttempts(request);
    return {
      session: verifiedSession,
      agent,
      store,
      voiceAdapter,
      modelProvider
    };
  } catch (err) {
    recordFailedAuthAttempt(request);
    throw err;
  }
}

export function buildErrorResponse(err, defaultMessage, defaultStatus = 500, defaultCode = 'INTERNAL_ERROR') {
  if (err instanceof InterviewRateLimitError) {
    return new Response(
      JSON.stringify({
        error: err.message,
        code: 'RATE_LIMITED',
        retry_after_seconds: err.retryAfterSeconds
      }),
      {
        status: 429,
        headers: {
          ...corsHeaders,
          'Retry-After': String(err.retryAfterSeconds)
        }
      }
    );
  }
  if (err instanceof InterviewAccessDeniedError) {
    return new Response(
      JSON.stringify({
        error: err.message || 'Access denied',
        code: 'ACCESS_DENIED'
      }),
      { status: 401, headers: corsHeaders }
    );
  }
  if (err instanceof InterviewConsentRequiredError) {
    return new Response(
      JSON.stringify({
        error: err.message || 'Informed consent required',
        code: 'CONSENT_REQUIRED'
      }),
      { status: defaultCode === 'CONSENT_REQUIRED' ? 400 : 403, headers: corsHeaders }
    );
  }
  return new Response(
    JSON.stringify({
      error: err?.message || defaultMessage,
      code: defaultCode
    }),
    { status: defaultStatus, headers: corsHeaders }
  );
}

/**
 * Strips sensitive access control hashes before sending session state to the browser.
 */
export function sanitizeSessionForClient(session, extra = {}) {
  if (!session) return null;
  const copy = structuredClone(session);
  if (copy.access_control) {
    delete copy.access_control.invitation_token_sha256;
  }
  return {
    session: copy,
    ...extra
  };
}

export function resetInterviewServiceForTests() {
  cachedMemoryStore = null;
  cachedWebhookAdapter = null;
  requestRateBuckets.clear();
  failedAuthBuckets.clear();
}
