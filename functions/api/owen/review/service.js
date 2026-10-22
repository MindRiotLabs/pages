/**
 * MindRiot Labs — OWEN Participant Experience Review Server-Side Service Boundary (v0.3)
 *
 * Bridges Cloudflare Pages Functions at /api/owen/review/* to the canonical
 * @mrl/owen ExperienceReviewService and Supabase durable persistence.
 *
 * Governance & Security Invariants (ADR-0019):
 * - Independently scoped 14-day review credentials (x-owen-review-token / Bearer).
 * - Interview invitation tokens are strictly rejected on all /api/owen/review/* endpoints.
 * - Review tokens are never accepted from URL query strings (?token=...).
 * - Opening a review link never marks participant_reviewed=true or accepts preselected cleanups.
 * - Completed interview turns are frozen and immutable.
 * - Zero internal ledger identifiers (stmt-*, minterp-*, turn-*, les-*) or token hashes in responses.
 */

import * as crypto from 'node:crypto';
import {
  CompletedInterviewTurnsImmutableError,
  ExperienceAcquisitionAgent,
  ExperienceReviewService,
  InMemoryInterviewSessionStore,
  ReviewAccessDeniedError,
  ReviewTokenExpiredError,
  buildContributionToImpactChainForSession,
  buildPilot001CuratedReviewSections,
  buildPilot001FlaggedCleanupRecommendations,
  createRussRichmondPilotSessionConfig,
  hashInvitationToken,
  hashReviewToken
} from '@mrl/owen';
import {
  DEFAULT_PILOT_001_SESSION_ID,
  DEFAULT_SUPABASE_ANON_KEY,
  DEFAULT_SUPABASE_URL,
  DISPOSABLE_UAT_SESSION_ID,
  InterviewRateLimitError,
  REVOKED_SESSION_IDS,
  REVOKED_TOKEN_SHA256S,
  clearFailedAuthAttempts,
  enforceRateLimit,
  getConfiguredTokenForSession,
  recordFailedAuthAttempt
} from '../interview/service.js';

export {
  CompletedInterviewTurnsImmutableError,
  ReviewAccessDeniedError,
  ReviewTokenExpiredError,
  hashReviewToken
};

export const DISPOSABLE_UAT_REVIEW_SESSION_ID = 'ses-uat-review-disposable-001';
export const DISPOSABLE_UAT_EXPIRED_SESSION_ID = 'ses-uat-review-expired-001';
export const DISPOSABLE_UAT_REVOKED_SESSION_ID = 'ses-uat-review-revoked-001';
export const DISPOSABLE_UAT_REVIEW_SESSION_IDS = new Set([
  DISPOSABLE_UAT_REVIEW_SESSION_ID,
  'ses-uat-review-disposable-002',
  'ses-uat-review-disposable-003',
  DISPOSABLE_UAT_EXPIRED_SESSION_ID,
  DISPOSABLE_UAT_REVOKED_SESSION_ID
]);

export const reviewCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-owen-review-token',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, no-cache, must-revalidate, private',
  'Pragma': 'no-cache',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY'
};

let cachedReviewMemoryStore = null;

function getEnvValue(env, key) {
  return (
    (env && env[key]) ||
    (typeof process !== 'undefined' && process.env ? process.env[key] : '') ||
    ''
  );
}

/**
 * Extracts the participant review token exclusively from HTTP headers or POST body.
 * Never reads from URL query parameters (?token=...) to prevent secret leakage in logs or Referer headers.
 */
export function extractReviewToken(request, body = null) {
  const customHeader = request.headers.get('x-owen-review-token');
  if (customHeader) {
    return customHeader.trim();
  }
  const authHeader = request.headers.get('Authorization') || '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  if (body && typeof body.review_token === 'string') {
    return body.review_token.trim();
  }
  return '';
}

export function getConfiguredReviewTokenForSession(
  env = {},
  sessionId = DISPOSABLE_UAT_REVIEW_SESSION_ID
) {
  if (
    DISPOSABLE_UAT_REVIEW_SESSION_IDS.has(sessionId) ||
    sessionId === DISPOSABLE_UAT_SESSION_ID
  ) {
    return (
      getEnvValue(env, 'OWEN_UAT_REVIEW_TOKEN') ||
      getEnvValue(env, 'OWEN_UAT_DISPOSABLE_REVIEW_TOKEN')
    );
  }
  if (sessionId === DEFAULT_PILOT_001_SESSION_ID) {
    return getEnvValue(env, 'OWEN_PILOT_001_REVIEW_TOKEN');
  }
  return '';
}

function timingSafeReviewHashMatch(tokenA, tokenB) {
  if (!tokenA || !tokenB) return false;
  const hashA = Buffer.from(hashReviewToken(tokenA), 'utf8');
  const hashB = Buffer.from(hashReviewToken(tokenB), 'utf8');
  if (hashA.length !== hashB.length) return false;
  return crypto.timingSafeEqual(hashA, hashB);
}

/**
 * Durable review store backed by Supabase SECURITY DEFINER RPCs:
 * - owen_get_review_session(p_session_id, p_review_token_sha256)
 * - owen_save_review_session(p_session_id, p_session, p_review_token_sha256)
 */
export class SupabaseRpcReviewSessionStore {
  constructor({ supabaseUrl, supabaseKey, activeReviewTokenSha256, fetchImpl }) {
    this.supabaseUrl = (supabaseUrl || DEFAULT_SUPABASE_URL).replace(/\/+$/, '');
    this.supabaseKey = supabaseKey || DEFAULT_SUPABASE_ANON_KEY;
    this.activeReviewTokenSha256 = activeReviewTokenSha256;
    this.fetchImpl = fetchImpl || fetch;
    this.requestSessionCache = new Map();
  }

  async getSession(sessionId) {
    if (!this.activeReviewTokenSha256) {
      return undefined;
    }
    if (this.requestSessionCache.has(sessionId)) {
      return structuredClone(this.requestSessionCache.get(sessionId));
    }

    const res = await this.fetchImpl(
      `${this.supabaseUrl}/rest/v1/rpc/owen_get_review_session`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: this.supabaseKey,
          Authorization: `Bearer ${this.supabaseKey}`
        },
        body: JSON.stringify({
          p_session_id: sessionId,
          p_review_token_sha256: this.activeReviewTokenSha256
        })
      }
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      if (errText.includes('REVIEW_TOKEN_EXPIRED')) {
        throw new ReviewTokenExpiredError();
      }
      if (errText.includes('REVIEW_TOKEN_REVOKED')) {
        throw new ReviewAccessDeniedError(
          'This review link has been revoked. Your saved review progress remains intact.',
          'REVIEW_TOKEN_REVOKED'
        );
      }
      if (errText.includes('WRONG_TOKEN_SCOPE')) {
        throw new ReviewAccessDeniedError(
          'Interview invitation tokens cannot be used for review access.',
          'WRONG_TOKEN_SCOPE'
        );
      }
      return undefined;
    }

    const data = await res.json();
    if (!data || !data.id) {
      return undefined;
    }
    this.requestSessionCache.set(sessionId, structuredClone(data));
    return data;
  }

  async saveSession(session) {
    if (!session || !session.id) return;
    this.requestSessionCache.set(session.id, structuredClone(session));

    const tokenSha =
      session?.review_access_control?.review_token_sha256 || this.activeReviewTokenSha256;

    const res = await this.fetchImpl(
      `${this.supabaseUrl}/rest/v1/rpc/owen_save_review_session`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: this.supabaseKey,
          Authorization: `Bearer ${this.supabaseKey}`
        },
        body: JSON.stringify({
          p_session_id: session.id,
          p_session: session,
          p_review_token_sha256: tokenSha
        })
      }
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => 'Supabase review RPC error');
      throw new Error(`Durable review session persistence failed (${res.status}): ${errText}`);
    }
  }

  async listSessions() {
    return [];
  }
}

export function getSharedReviewMemoryStore() {
  if (!cachedReviewMemoryStore) {
    cachedReviewMemoryStore = new InMemoryInterviewSessionStore();
  }
  return cachedReviewMemoryStore;
}

/**
 * Seeds a disposable completed UAT session in memory when testing or running disposable UAT
 * so that Russ Richmond's real Pilot 001 session is never touched.
 */
export async function ensureDisposableUatReviewSession(
  store,
  sessionId,
  rawReviewToken,
  options = {}
) {
  const existing = await store.getSession(sessionId);
  if (existing && existing.review_package && existing.review_access_control) {
    return existing;
  }

  const agent = new ExperienceAcquisitionAgent({ store });
  const reviewService = new ExperienceReviewService({ store, acquisitionAgent: agent });

  const syntheticInviteToken = `uat-invite-only-${sessionId}-do-not-use-for-review`;
  const config = createRussRichmondPilotSessionConfig(syntheticInviteToken, {
    sessionId,
    participantName: options.participantName || 'Alex Rivera (Disposable UAT Participant)',
    participantActorId: options.participantActorId || 'act-uat-review-alex-rivera',
    title:
      options.title ||
      'Disposable UAT Review Simulation: Institutional Knowledge & Decision Continuity'
  });

  await agent.createSession(config);
  await agent.grantConsent({
    session_id: sessionId,
    transcript_capture_consented: true,
    audio_recording_consented: false,
    synthetic_voice_acknowledged: true
  });

  await agent.processParticipantTurn({
    session_id: sessionId,
    participant_text:
      'At McKinsey, PDNet primers and the Knowledge Resource Directory gave teams a fast baseline, but the real value was calling the partner or associate who lived through the engagement for a 15-minute conversation.'
  });

  await agent.processParticipantTurn({
    session_id: sessionId,
    participant_text:
      'Experienced humans uncover hidden pearls by wandering off-script, whereas an AI system should stay disciplined and grounded rather than trying to fake human intuition.'
  });

  const completed = await agent.processParticipantTurn({
    session_id: sessionId,
    control_action: 'END_INTERVIEW',
    participant_text: 'I am running out of time for this interview, let us wrap up here.'
  });

  await reviewService.prepareReviewPackage(sessionId, {
    sections: buildPilot001CuratedReviewSections(completed),
    flagged_cleanup_recommendations: buildPilot001FlaggedCleanupRecommendations(completed),
    contribution_impact_chain: buildContributionToImpactChainForSession(completed)
  });

  await reviewService.issueOrRenewReviewCredential({
    session_id: sessionId,
    raw_review_token: rawReviewToken,
    expires_in_days: options.expiresInDays,
    expires_at: options.expiresAt
  });

  if (options.saveInitialDraft) {
    await reviewService.saveParticipantReviewDraft({
      session_id: sessionId,
      raw_review_token: rawReviewToken,
      section_updates: [
        {
          section_id: 'sec-1-codified-primers-and-expert-links',
          participant_action: 'CONFIRMED_ACCURATE',
          participant_note: 'Saved draft before credential expiry.'
        }
      ]
    });
    if (options.expiredAtAfterDraft) {
      await reviewService.issueOrRenewReviewCredential({
        session_id: sessionId,
        raw_review_token: rawReviewToken,
        expires_at: options.expiredAtAfterDraft
      });
    }
  }

  if (options.revoked) {
    await reviewService.revokeReviewCredential(
      sessionId,
      'Revoked during disposable UAT credential lifecycle verification.'
    );
  }

  return store.getSession(sessionId);
}

/**
 * Authenticates the caller's scoped review token for the requested session_id
 * and returns { reviewService, session, rawReviewToken }.
 */
export async function resolveAuthorizedReviewContext(request, env = {}, body = null) {
  enforceRateLimit(request);

  const url = new URL(request.url);

  // Never allow secrets in URL query parameters
  if (url.searchParams.has('token') || url.searchParams.has('review_token')) {
    recordFailedAuthAttempt(request);
    throw new ReviewAccessDeniedError(
      'Review credentials must not be passed in URL query parameters. Use the #token URL fragment or x-owen-review-token header.',
      'QUERY_TOKEN_FORBIDDEN'
    );
  }

  const sessionId =
    (body && typeof body.session_id === 'string' && body.session_id.trim()) ||
    url.searchParams.get('session_id') ||
    DISPOSABLE_UAT_REVIEW_SESSION_ID;

  const rawReviewToken = extractReviewToken(request, body);
  if (!rawReviewToken) {
    recordFailedAuthAttempt(request);
    throw new ReviewAccessDeniedError(
      'A scoped participant review credential is required (via x-owen-review-token or Authorization header).',
      'MISSING_TOKEN'
    );
  }

  const incomingSha = hashReviewToken(rawReviewToken);
  if (REVOKED_SESSION_IDS.has(sessionId) || REVOKED_TOKEN_SHA256S.has(incomingSha)) {
    recordFailedAuthAttempt(request);
    throw new ReviewAccessDeniedError(
      'This credential or session has been revoked.',
      'REVIEW_TOKEN_REVOKED'
    );
  }

  // Strictly reject interview invitation tokens if presented on review endpoints
  const knownInviteTokens = [
    getConfiguredTokenForSession(env, sessionId),
    getConfiguredTokenForSession(env, DISPOSABLE_UAT_SESSION_ID),
    getConfiguredTokenForSession(env, DEFAULT_PILOT_001_SESSION_ID)
  ].filter(Boolean);
  if (knownInviteTokens.some((invTok) => timingSafeReviewHashMatch(rawReviewToken, invTok))) {
    recordFailedAuthAttempt(request);
    throw new ReviewAccessDeniedError(
      'Interview invitation tokens are not valid for the Experience Review Portal. Use your scoped review link.',
      'WRONG_TOKEN_SCOPE'
    );
  }

  const nodeEnv = getEnvValue(env, 'NODE_ENV');
  const reviewStoreMode = getEnvValue(env, 'REVIEW_STORE') || getEnvValue(env, 'INTERVIEW_STORE');
  const useMemoryStore =
    nodeEnv === 'test' ||
    reviewStoreMode === 'memory' ||
    DISPOSABLE_UAT_REVIEW_SESSION_IDS.has(sessionId);

  const store = useMemoryStore
    ? getSharedReviewMemoryStore()
    : new SupabaseRpcReviewSessionStore({
        supabaseUrl: env?.SUPABASE_URL || DEFAULT_SUPABASE_URL,
        supabaseKey: env?.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY,
        activeReviewTokenSha256: incomingSha
      });

  const expectedReviewToken = getConfiguredReviewTokenForSession(env, sessionId);

  if (
    DISPOSABLE_UAT_REVIEW_SESSION_IDS.has(sessionId) ||
    sessionId === DEFAULT_PILOT_001_SESSION_ID
  ) {
    if (!expectedReviewToken) {
      recordFailedAuthAttempt(request);
      throw new ReviewAccessDeniedError(
        `Review access credential is not configured on the server for session ${sessionId}.`,
        'REVIEW_NOT_PROVISIONED'
      );
    }
    if (!timingSafeReviewHashMatch(rawReviewToken, expectedReviewToken)) {
      recordFailedAuthAttempt(request);
      throw new ReviewAccessDeniedError(
        'Invalid or unauthorized review credential for the requested session.',
        'INVALID_REVIEW_TOKEN'
      );
    }
  }

  // Auto-seed only disposable UAT sessions (never Russ's Pilot 001 session)
  if (sessionId.startsWith('ses-uat-review-disposable-')) {
    await ensureDisposableUatReviewSession(store, sessionId, expectedReviewToken);
  } else if (sessionId === DISPOSABLE_UAT_EXPIRED_SESSION_ID) {
    await ensureDisposableUatReviewSession(store, sessionId, expectedReviewToken, {
      saveInitialDraft: true,
      expiredAtAfterDraft: '2026-01-01T00:00:00.000Z'
    });
  } else if (sessionId === DISPOSABLE_UAT_REVOKED_SESSION_ID) {
    await ensureDisposableUatReviewSession(store, sessionId, expectedReviewToken, {
      saveInitialDraft: true,
      revoked: true
    });
  }

  const acquisitionAgent = new ExperienceAcquisitionAgent({ store });
  const reviewService = new ExperienceReviewService({ store, acquisitionAgent });

  try {
    const verifiedSession = await reviewService.verifyReviewAccess(sessionId, rawReviewToken);
    clearFailedAuthAttempts(request);
    return {
      session: verifiedSession,
      reviewService,
      store,
      rawReviewToken,
      sessionId
    };
  } catch (err) {
    recordFailedAuthAttempt(request);
    throw err;
  }
}

export function buildReviewErrorResponse(
  err,
  defaultMessage = 'Unable to process review request.',
  defaultStatus = 500,
  defaultCode = 'INTERNAL_ERROR'
) {
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
          ...reviewCorsHeaders,
          'Retry-After': String(err.retryAfterSeconds)
        }
      }
    );
  }

  if (err instanceof ReviewTokenExpiredError) {
    return new Response(
      JSON.stringify({
        error: err.message,
        code: err.code || 'REVIEW_TOKEN_EXPIRED',
        saved_progress_preserved: true
      }),
      { status: 401, headers: reviewCorsHeaders }
    );
  }

  if (err instanceof ReviewAccessDeniedError) {
    const status = err.code === 'REVIEW_TOKEN_REVOKED' ? 403 : 401;
    return new Response(
      JSON.stringify({
        error: err.message || 'Review access denied.',
        code: err.code || 'REVIEW_ACCESS_DENIED'
      }),
      { status, headers: reviewCorsHeaders }
    );
  }

  if (err instanceof CompletedInterviewTurnsImmutableError) {
    return new Response(
      JSON.stringify({
        error: err.message,
        code: 'IMMUTABLE_SOURCE_EVIDENCE_VIOLATION'
      }),
      { status: 409, headers: reviewCorsHeaders }
    );
  }

  return new Response(
    JSON.stringify({
      error: err?.message || defaultMessage,
      code: defaultCode
    }),
    { status: defaultStatus, headers: reviewCorsHeaders }
  );
}

export function resetReviewServiceForTests() {
  cachedReviewMemoryStore = null;
}
