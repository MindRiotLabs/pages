/**
 * MindRiot Labs — OWEN Human Steward Review Preview Server-Side Boundary (v0.3)
 *
 * Implements Option B (Approved by Human Steward Joseph Van Harken, ADR-0021):
 * - Individual human authentication via Supabase Auth (`/auth/v1/user` JWT verification).
 * - Explicit, auditable linkage (`public.foundry_actor_auth_bindings`) between
 *   verified Supabase Auth UUIDs (`auth.users.id`) and OWEN `public.core_actors(id)`
 *   where `actor_type = 'HUMAN'`.
 * - Zero implicit email-matching authorization: matching email addresses alone NEVER
 *   grant Steward access without an explicit `ACTIVE` row in `foundry_actor_auth_bindings`.
 * - Project-scoped server-side `FOUNDER` or `STEWARD` authorization against
 *   `public.foundry_members` for the target session's `project_id`.
 * - Strictly read-only (`GET` / `OPTIONS` only): dynamically synthesizes the proposed
 *   `ExperienceReviewPackage`, `ParticipantReviewPortalView`, and `ContributionToImpactChain`
 *   in-memory on a deep clone without mutating `public.foundry_interview_sessions`
 *   and without provisioning a participant review token.
 * - Append-only audit logging (`public.foundry_steward_preview_audit_log`) for all
 *   authorized preview reads and denied access attempts.
 * - Zero secret or token-hash leakage in responses.
 */

import * as crypto from 'node:crypto';
import {
  ExperienceAcquisitionAgent,
  ExperienceReviewService,
  InMemoryInterviewSessionStore,
  buildContributionToImpactChainForSession,
  buildPilot001CuratedReviewSections,
  buildPilot001FlaggedCleanupRecommendations,
  createRussRichmondPilotSessionConfig
} from '@mrl/owen';
import {
  DEFAULT_PILOT_001_SESSION_ID,
  DISPOSABLE_UAT_SESSION_ID,
  FOUNDER_UAT_V02_SESSION_ID,
  InterviewRateLimitError,
  clearFailedAuthAttempts,
  enforceRateLimit,
  getConfiguredTokenForSession,
  isStagingOrPreviewRuntime,
  recordFailedAuthAttempt,
  resolveSupabaseServiceKey,
  resolveValidatedSupabaseUrl,
  sanitizeErrorMessageForClient
} from '../interview/service.js';
import {
  DISPOSABLE_UAT_REVIEW_SESSION_ID,
  getConfiguredReviewTokenForSession,
  hashReviewToken
} from '../review/service.js';

export const DEFAULT_STAGING_STEWARD_PREVIEW_SESSION_ID = 'ses-uat-steward-preview-001';
export const CANONICAL_FOUNDER_SUPERADMIN_EMAIL = 'jvanharken@gmail.com';
export const CANONICAL_FOUNDER_SUPERADMIN_AUTH_UUID = '2285e885-dabb-4abd-bb87-b904d6170423';

export const APPROVED_STAGING_REDIRECT_URLS = Object.freeze([
  'https://staging.mindriotlabs.com/owen/steward/review'
]);

export const APPROVED_PRODUCTION_REDIRECT_URLS = Object.freeze([
  'https://mindriotlabs.com/owen/steward/review',
  'https://www.mindriotlabs.com/owen/steward/review'
]);

export function getApprovedStewardRedirectUrls(isStaging) {
  return isStaging ? [...APPROVED_STAGING_REDIRECT_URLS] : [...APPROVED_PRODUCTION_REDIRECT_URLS];
}

/**
 * Strictly validates a redirect URL or origin against the environment's approved
 * domain allowlist. Rejects open redirects, cross-environment redirects, custom
 * schemes, and credentials in URLs.
 */
export function isApprovedStewardRedirectOrOrigin(candidate, isStaging) {
  if (!candidate || typeof candidate !== 'string') return false;
  let parsed;
  try {
    parsed = new URL(candidate.trim());
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  if (parsed.username || parsed.password) return false;

  const allowedUrls = getApprovedStewardRedirectUrls(isStaging);
  const allowedOrigins = new Set(allowedUrls.map((u) => new URL(u).origin));
  if (!allowedOrigins.has(parsed.origin)) {
    return false;
  }
  // If a path is present (beyond '/'), require exact match on `/owen/steward/review`
  const normalizedPath = parsed.pathname.replace(/\/+$/, '') || '/';
  if (normalizedPath !== '/' && normalizedPath !== '/owen/steward/review') {
    return false;
  }
  return true;
}

/**
 * Extracts the authenticated provider and verifies whether the Supabase Auth user
 * possesses a verified Google OAuth identity (`provider === 'google'` with `email_verified !== false`).
 */
export function extractVerifiedAuthProviderAndGoogleIdentity(authUser) {
  if (!authUser || typeof authUser !== 'object') {
    return { authProvider: 'email', hasVerifiedGoogleIdentity: false };
  }
  const identities = Array.isArray(authUser.identities) ? authUser.identities : [];
  const hasVerifiedGoogleIdentity = identities.some(
    (id) =>
      id &&
      typeof id === 'object' &&
      String(id.provider || '').toLowerCase() === 'google' &&
      id.identity_data?.email_verified !== false
  );

  const rawAppMeta = authUser.app_metadata || authUser.raw_app_meta_data || {};
  const primaryProvider = String(rawAppMeta.provider || '').toLowerCase();
  const providersList = Array.isArray(rawAppMeta.providers)
    ? rawAppMeta.providers.map((p) => String(p).toLowerCase())
    : [];

  const isGoogleSession =
    hasVerifiedGoogleIdentity &&
    (primaryProvider === 'google' || providersList.includes('google'));

  return {
    authProvider: isGoogleSession ? 'google' : primaryProvider || 'email',
    hasVerifiedGoogleIdentity
  };
}

export const stewardPreviewCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, x-supabase-auth-token, x-steward-redirect-origin',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, no-cache, must-revalidate, private',
  'Pragma': 'no-cache',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY'
};

export class StewardPreviewError extends Error {
  constructor(message, code = 'STEWARD_PREVIEW_DENIED', status = 403, auditId = null) {
    super(message);
    this.name = 'StewardPreviewError';
    this.code = code;
    this.status = status;
    this.auditId = auditId;
  }
}

function getEnvValue(env, key) {
  return (
    (env && env[key]) ||
    (typeof process !== 'undefined' && process.env ? process.env[key] : '') ||
    ''
  );
}

export function resolveSupabaseAnonKey(env = {}) {
  return (
    getEnvValue(env, 'SUPABASE_ANON_KEY') ||
    getEnvValue(env, 'PUBLIC_SUPABASE_ANON_KEY') ||
    ''
  ).trim();
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex');
}

function hashClientIp(request) {
  const rawIp =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for') ||
    'local-client';
  return sha256Hex(`owen-steward-ip:${rawIp}`).slice(0, 24);
}

function timingSafeTokenMatch(tokenA, tokenB) {
  if (!tokenA || !tokenB) return false;
  const hashA = Buffer.from(hashReviewToken(tokenA), 'utf8');
  const hashB = Buffer.from(hashReviewToken(tokenB), 'utf8');
  if (hashA.length !== hashB.length) return false;
  return crypto.timingSafeEqual(hashA, hashB);
}

/**
 * Extracts the Supabase Auth Bearer JWT from HTTP headers only.
 * Never reads from URL query parameters and never accepts static preview tokens.
 */
export function extractStewardBearerToken(request) {
  const customHeader = request.headers.get('x-supabase-auth-token');
  if (customHeader && customHeader.trim()) {
    return customHeader.trim();
  }
  const authHeader = request.headers.get('Authorization') || '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  return '';
}

/**
 * Recursively strips any sensitive credential or hash fields from an outgoing payload.
 */
export function scrubSensitiveFieldsDeep(value) {
  if (Array.isArray(value)) {
    return value.map((item) => scrubSensitiveFieldsDeep(item));
  }
  if (value && typeof value === 'object') {
    const FORBIDDEN_KEYS = new Set([
      'invitation_token_sha256',
      'review_token_sha256',
      'encrypted_password',
      'service_role_key',
      'supabase_service_role_key',
      'raw_review_token',
      'invitation_token'
    ]);
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.has(k.toLowerCase())) {
        continue;
      }
      out[k] = scrubSensitiveFieldsDeep(v);
    }
    return out;
  }
  return value;
}

/**
 * Normalizes a cloned session object in memory so that `ExperienceReviewService`
 * can synthesize a complete `ExperienceReviewPackage` and `ContributionToImpactChain`
 * regardless of minor JSONB field variations across pilot versions.
 */
export function normalizeSessionForReadOnlyPreview(rawSession) {
  const session = structuredClone(rawSession);

  if (!session.participant || typeof session.participant !== 'object') {
    session.participant = {
      actor_id: session.participant_actor_id || 'act-unknown-participant',
      name: 'Interview Participant',
      role_title: 'Participant',
      organization: 'MindRiot Labs Pilot'
    };
  } else {
    session.participant.name =
      session.participant.name ||
      session.participant.display_name ||
      'Interview Participant';
    session.participant.display_name =
      session.participant.display_name || session.participant.name;
    session.participant.role_title =
      session.participant.role_title ||
      session.participant.organization ||
      'Executive Participant';
  }

  if (!session.consent || typeof session.consent !== 'object') {
    session.consent = {
      status: 'GRANTED',
      attribution_preference: 'ATTRIBUTED',
      transcript_capture_consented: true,
      synthetic_voice_disclosed: true
    };
  } else if (!session.consent.attribution_preference) {
    session.consent.attribution_preference = 'ATTRIBUTED';
  }

  if (!Array.isArray(session.objectives)) {
    session.objectives = [];
  }
  session.objectives = session.objectives.map((obj, idx) => ({
    ...obj,
    objective_id: obj.objective_id || `obj-${idx + 1}`,
    code: obj.code || String.fromCharCode(65 + idx),
    title: obj.title || obj.topic || `Objective ${idx + 1}`,
    extracted_statement_ids: Array.isArray(obj.extracted_statement_ids)
      ? obj.extracted_statement_ids
      : []
  }));

  if (!Array.isArray(session.turns)) {
    session.turns = [];
  }
  session.turns = session.turns.map((turn, idx) => {
    const isParticipant =
      turn.speaker === 'PARTICIPANT_HUMAN' || turn.speaker === 'PARTICIPANT';
    const text = turn.verbatim_text || turn.utterance_text || '';
    const ts = turn.timestamp || turn.occurred_at || session.created_at;
    return {
      ...turn,
      turn_id: turn.turn_id || `turn-${String(idx + 1).padStart(3, '0')}`,
      sequence_number: turn.sequence_number ?? idx + 1,
      speaker: isParticipant ? 'PARTICIPANT_HUMAN' : 'OWEN_INTERVIEWER',
      speaker_actor_id:
        turn.speaker_actor_id ||
        (isParticipant
          ? session.participant.actor_id
          : session.interviewer_identity?.actor_id || 'act-machine-owen-interviewer'),
      verbatim_text: text,
      utterance_text: text,
      timestamp: ts,
      occurred_at: ts
    };
  });

  if (!session.epistemic_ledger || typeof session.epistemic_ledger !== 'object') {
    session.epistemic_ledger = {
      participant_statements: [],
      machine_interpretations: [],
      candidate_lessons: []
    };
  }

  const rawStatements = Array.isArray(session.epistemic_ledger.participant_statements)
    ? session.epistemic_ledger.participant_statements
    : [];
  session.epistemic_ledger.participant_statements = rawStatements.map((stmt, idx) => {
    const ts = stmt.timestamp || stmt.recorded_at || session.created_at;
    return {
      ...stmt,
      statement_id: stmt.statement_id || `stmt-${String(idx + 1).padStart(3, '0')}`,
      turn_id: stmt.turn_id || 'turn-002',
      objective_ids: Array.isArray(stmt.objective_ids) ? stmt.objective_ids : [],
      verbatim_quote: stmt.verbatim_quote || '',
      paraphrased_claim:
        stmt.paraphrased_claim || stmt.topic || stmt.verbatim_quote || '',
      timestamp: ts,
      recorded_at: ts
    };
  });

  const rawInterps = Array.isArray(session.epistemic_ledger.machine_interpretations)
    ? session.epistemic_ledger.machine_interpretations
    : [];
  session.epistemic_ledger.machine_interpretations = rawInterps.map((interp, idx) => {
    const ts = interp.timestamp || interp.recorded_at || session.created_at;
    const isDisputed =
      interp.validation_status === 'DISPUTED_BY_PARTICIPANT' ||
      interp.confirmation_status === 'PARTICIPANT_DISPUTED';
    const isSuperseded =
      interp.validation_status === 'SUPERSEDED_BY_PARTICIPANT' ||
      Boolean(interp.superseded_by);
    const validationStatus = isDisputed
      ? 'DISPUTED_BY_PARTICIPANT'
      : isSuperseded
      ? 'SUPERSEDED_BY_PARTICIPANT'
      : interp.validation_status || 'CONFIRMED_BY_PARTICIPANT';
    const text = interp.interpretation || interp.interpreted_claim || '';
    return {
      ...interp,
      interpretation_id:
        interp.interpretation_id || `minterp-${String(idx + 1).padStart(3, '0')}`,
      supporting_turn_ids: Array.isArray(interp.supporting_turn_ids)
        ? interp.supporting_turn_ids
        : interp.turn_id
        ? [interp.turn_id]
        : ['turn-002'],
      interpretation: text,
      interpreted_claim: text,
      design_implication_for_owen:
        interp.design_implication_for_owen ||
        'Maintain strict separation between direct human testimony and machine-inferred architectural hypotheses.',
      confidence: interp.confidence || (isDisputed ? 'LOW' : 'HIGH'),
      validation_status: validationStatus,
      timestamp: ts,
      recorded_at: ts
    };
  });

  if (!session.experience_brief || typeof session.experience_brief !== 'object') {
    session.experience_brief = {
      brief_id: `ebrief-${session.id}`,
      session_id: session.id,
      review_and_publication_status: {
        status: 'PENDING_PARTICIPANT_REVIEW',
        propagation_scope: 'project_only',
        participant_reviewed: false,
        attribution_preference: session.consent.attribution_preference || 'ATTRIBUTED',
        human_steward_approved: false,
        allow_foundry_ingestion: false,
        permitted_sharing_scope: 'INTERNAL_OWEN_LEARNING_ONLY',
        notify_on_future_outcomes: false,
        shared_knowledge_published: false
      }
    };
  } else if (!session.experience_brief.review_and_publication_status) {
    session.experience_brief.review_and_publication_status = {
      status: 'PENDING_PARTICIPANT_REVIEW',
      propagation_scope: 'project_only',
      participant_reviewed: false,
      attribution_preference: session.consent.attribution_preference || 'ATTRIBUTED',
      human_steward_approved: false,
      allow_foundry_ingestion: false,
      permitted_sharing_scope: 'INTERNAL_OWEN_LEARNING_ONLY',
      notify_on_future_outcomes: false,
      shared_knowledge_published: false
    };
  }

  return session;
}

/**
 * Dynamically synthesizes the proposed `ExperienceReviewPackage`, `ParticipantReviewPortalView`,
 * and `ContributionToImpactChain` in-memory on a deep clone without mutating the source session
 * or minting any participant review token.
 */
export async function synthesizeReadOnlyStewardReviewPreview(sourceSession) {
  const beforeTurnsSnapshot = JSON.stringify(sourceSession.turns ?? []);
  const beforeLedgerSnapshot = JSON.stringify(sourceSession.epistemic_ledger ?? {});
  const beforeBriefSnapshot = JSON.stringify(sourceSession.experience_brief ?? null);
  const beforeUpdatedAt = sourceSession.updated_at;

  const normalizedClone = normalizeSessionForReadOnlyPreview(sourceSession);
  const ephemeralStore = new InMemoryInterviewSessionStore();
  await ephemeralStore.saveSession(normalizedClone);

  const acquisitionAgent = new ExperienceAcquisitionAgent({ store: ephemeralStore });
  const reviewService = new ExperienceReviewService({
    store: ephemeralStore,
    acquisitionAgent
  });

  const alreadyHasReviewPackage = Boolean(
    sourceSession.review_package && sourceSession.review_package.sections
  );

  const reviewPackage = await reviewService.prepareReviewPackage(normalizedClone.id, {
    sections: alreadyHasReviewPackage
      ? normalizedClone.review_package.sections
      : buildPilot001CuratedReviewSections(normalizedClone),
    flagged_cleanup_recommendations: alreadyHasReviewPackage
      ? normalizedClone.review_package.flagged_cleanup_recommendations
      : buildPilot001FlaggedCleanupRecommendations(normalizedClone),
    contribution_impact_chain:
      normalizedClone.contribution_impact_chain ||
      buildContributionToImpactChainForSession(normalizedClone)
  });

  const synthesizedSession = await ephemeralStore.getSession(normalizedClone.id);
  const contributionChain =
    synthesizedSession.contribution_impact_chain ||
    buildContributionToImpactChainForSession(normalizedClone);

  // Verify the original sourceSession object was not mutated in memory
  if (
    JSON.stringify(sourceSession.turns ?? []) !== beforeTurnsSnapshot ||
    JSON.stringify(sourceSession.epistemic_ledger ?? {}) !== beforeLedgerSnapshot ||
    JSON.stringify(sourceSession.experience_brief ?? null) !== beforeBriefSnapshot ||
    sourceSession.updated_at !== beforeUpdatedAt
  ) {
    throw new Error(
      'STEWARD_PREVIEW_IMMUTABILITY_VIOLATION: Source session object was modified during preview synthesis.'
    );
  }

  const statements = Array.isArray(sourceSession.epistemic_ledger?.participant_statements)
    ? sourceSession.epistemic_ledger.participant_statements
    : [];
  const interpretations = Array.isArray(sourceSession.epistemic_ledger?.machine_interpretations)
    ? sourceSession.epistemic_ledger.machine_interpretations
    : [];
  const brief = sourceSession.experience_brief || {};

  return {
    was_dynamically_synthesized: !alreadyHasReviewPackage,
    participant_review_token_provisioned: Boolean(sourceSession.review_access_control),
    proposed_review_package: scrubSensitiveFieldsDeep(reviewPackage),
    contribution_to_impact_chain: scrubSensitiveFieldsDeep(contributionChain),
    epistemic_inspection: scrubSensitiveFieldsDeep({
      session_status: sourceSession.status,
      modality: sourceSession.modality,
      participant: sourceSession.participant,
      interviewer_identity: sourceSession.interviewer_identity,
      consent: sourceSession.consent,
      objectives: sourceSession.objectives || [],
      participant_statements: statements,
      machine_interpretations: interpretations,
      disputed_or_superseded_interpretations: interpretations.filter(
        (m) =>
          m.validation_status === 'DISPUTED_BY_PARTICIPANT' ||
          m.validation_status === 'SUPERSEDED_BY_PARTICIPANT' ||
          m.confirmation_status === 'PARTICIPANT_DISPUTED' ||
          Boolean(m.superseded_by)
      ),
      participant_corrections: sourceSession.corrections || [],
      uncertainties_and_followups: {
        executive_summary:
          brief.executive_summary ||
          brief.interview_overview?.executive_summary ||
          null,
        contradictions_and_uncertainty:
          brief.contradictions_and_uncertainty || [],
        unresolved_followup_questions:
          brief.unresolved_followup_questions || [],
        potential_architectural_gaps:
          brief.potential_architectural_gaps || [],
        recommended_experiments:
          brief.recommended_experiments || []
      },
      turns: sourceSession.turns || [],
      review_events: sourceSession.review_events || []
    })
  };
}

// ============================================================================
// In-Memory Test Harness Adapter (`NODE_ENV=test` / `STEWARD_PREVIEW_STORE=memory`)
// ============================================================================

let cachedStewardMemoryHarness = null;

export const TEST_STEWARD_TOKENS = {
  AUTHORIZED_STEWARD: 'sb_jwt_test_authorized_steward_001',
  AUTHORIZED_FOUNDER: 'sb_jwt_test_authorized_founder_google_jvh',
  AUTHORIZED_FOUNDER_GOOGLE: 'sb_jwt_test_authorized_founder_google_jvh',
  REVOKED_FOUNDER_EMAIL: 'sb_jwt_test_revoked_founder_email_006',
  EMAIL_ON_GOOGLE_BINDING: 'sb_jwt_test_email_on_google_binding_007',
  UNBOUND_MATCHING_EMAIL: 'sb_jwt_test_unbound_matching_email_002',
  BOUND_COLLABORATOR: 'sb_jwt_test_bound_collaborator_003',
  OTHER_PROJECT_STEWARD: 'sb_jwt_test_other_project_steward_004',
  UNVERIFIED_EMAIL_STEWARD: 'sb_jwt_test_unverified_email_005'
};

export async function getSharedStewardMemoryHarness() {
  if (cachedStewardMemoryHarness) {
    return cachedStewardMemoryHarness;
  }

  const sessionStore = new InMemoryInterviewSessionStore();
  const agent = new ExperienceAcquisitionAgent({ store: sessionStore });

  // Seed a completed, unprovisioned session in memory
  const seedSessionId = DEFAULT_STAGING_STEWARD_PREVIEW_SESSION_ID;
  const inviteToken = 'uat-invite-only-steward-preview-do-not-use';
  const config = createRussRichmondPilotSessionConfig(inviteToken, {
    sessionId: seedSessionId,
    participantName: 'Dr. Jordan Vance (Synthetic Preview Subject)',
    participantActorId: 'act-uat-steward-preview-participant',
    title: 'Synthetic Completed Executive Experience Interview (Pre-Provisioning Steward Preview UAT)'
  });

  await agent.createSession(config);
  await agent.grantConsent({
    session_id: seedSessionId,
    transcript_capture_consented: true,
    audio_recording_consented: false,
    synthetic_voice_acknowledged: true
  });
  await agent.processParticipantTurn({
    session_id: seedSessionId,
    participant_text:
      'At McKinsey, codified primers and PDNet benchmarks gave teams an 80/20 baseline, but the real value was calling the partner who lived through the engagement.'
  });
  await agent.processParticipantTurn({
    session_id: seedSessionId,
    participant_text:
      'Experienced humans uncover hidden pearls by wandering off-script, whereas an AI system should stay disciplined and evidence-grounded rather than faking human intuition.'
  });
  await agent.processParticipantTurn({
    session_id: seedSessionId,
    control_action: 'END_INTERVIEW',
    participant_text: 'I am running out of time for this interview, let us wrap up here.'
  });
  await agent.generateExperienceBrief(seedSessionId);
  const seeded = await sessionStore.getSession(seedSessionId);
  if (seeded) {
    seeded.status = 'COMPLETED';
    await sessionStore.saveSession(seeded);
  }

  const authUsersByJwt = new Map([
    [
      TEST_STEWARD_TOKENS.AUTHORIZED_STEWARD,
      {
        id: '11111111-2222-4333-8444-555555555001',
        email: 'steward-uat@staging.mindriotlabs.com',
        email_confirmed_at: '2026-10-25T00:00:00.000Z',
        app_metadata: { provider: 'email', providers: ['email'] },
        identities: [{ provider: 'email', identity_data: { email_verified: true } }]
      }
    ],
    [
      TEST_STEWARD_TOKENS.UNBOUND_MATCHING_EMAIL,
      {
        id: '11111111-2222-4333-8444-555555555002',
        email: 'matching-email-unbound@staging.mindriotlabs.com',
        email_confirmed_at: '2026-10-25T00:00:00.000Z',
        app_metadata: { provider: 'google', providers: ['google'] },
        identities: [{ provider: 'google', identity_data: { email_verified: true } }]
      }
    ],
    [
      TEST_STEWARD_TOKENS.BOUND_COLLABORATOR,
      {
        id: '11111111-2222-4333-8444-555555555003',
        email: 'collaborator-uat@staging.mindriotlabs.com',
        email_confirmed_at: '2026-10-25T00:00:00.000Z',
        app_metadata: { provider: 'email', providers: ['email'] },
        identities: [{ provider: 'email', identity_data: { email_verified: true } }]
      }
    ],
    [
      TEST_STEWARD_TOKENS.OTHER_PROJECT_STEWARD,
      {
        id: '11111111-2222-4333-8444-555555555004',
        email: 'other-project-steward@staging.mindriotlabs.com',
        email_confirmed_at: '2026-10-25T00:00:00.000Z',
        app_metadata: { provider: 'email', providers: ['email'] },
        identities: [{ provider: 'email', identity_data: { email_verified: true } }]
      }
    ],
    [
      TEST_STEWARD_TOKENS.UNVERIFIED_EMAIL_STEWARD,
      {
        id: '11111111-2222-4333-8444-555555555005',
        email: 'unverified-steward@staging.mindriotlabs.com',
        email_confirmed_at: null,
        app_metadata: { provider: 'email', providers: ['email'] },
        identities: [{ provider: 'email', identity_data: { email_verified: false } }]
      }
    ],
    [
      TEST_STEWARD_TOKENS.REVOKED_FOUNDER_EMAIL,
      {
        id: '11111111-2222-4333-8444-555555555006',
        email: 'jvh@mindriotlabs.com',
        email_confirmed_at: '2026-10-25T00:00:00.000Z',
        app_metadata: { provider: 'email', providers: ['email'] },
        identities: [{ provider: 'email', identity_data: { email_verified: true } }]
      }
    ],
    [
      TEST_STEWARD_TOKENS.EMAIL_ON_GOOGLE_BINDING,
      {
        id: '11111111-2222-4333-8444-555555555007',
        email: 'email-only-on-google-binding@staging.mindriotlabs.com',
        email_confirmed_at: '2026-10-25T00:00:00.000Z',
        app_metadata: { provider: 'email', providers: ['email'] },
        identities: [{ provider: 'email', identity_data: { email_verified: true } }]
      }
    ],
    [
      TEST_STEWARD_TOKENS.AUTHORIZED_FOUNDER_GOOGLE,
      {
        id: CANONICAL_FOUNDER_SUPERADMIN_AUTH_UUID,
        email: CANONICAL_FOUNDER_SUPERADMIN_EMAIL,
        email_confirmed_at: '2026-10-26T00:00:00.000Z',
        app_metadata: { provider: 'google', providers: ['google'] },
        identities: [
          {
            provider: 'google',
            identity_data: {
              email: CANONICAL_FOUNDER_SUPERADMIN_EMAIL,
              email_verified: true,
              iss: 'https://accounts.google.com'
            }
          }
        ]
      }
    ]
  ]);

  const coreActors = new Map([
    [
      'act-founder-jvh',
      {
        id: 'act-founder-jvh',
        name: 'Joseph Van Harken',
        actor_type: 'HUMAN',
        organization: 'MindRiot Labs',
        metadata: { email: CANONICAL_FOUNDER_SUPERADMIN_EMAIL, canonical_superadmin: true }
      }
    ],
    [
      'actor-steward-uat-staging',
      {
        id: 'actor-steward-uat-staging',
        name: 'Staging Human Steward (Synthetic UAT)',
        actor_type: 'HUMAN',
        organization: 'MindRiot Labs (Staging)'
      }
    ],
    [
      'actor-unbound-email-twin-staging',
      {
        id: 'actor-unbound-email-twin-staging',
        name: 'Unbound Email Twin Steward (Synthetic UAT)',
        actor_type: 'HUMAN',
        organization: 'MindRiot Labs (Staging)',
        metadata: { email: 'matching-email-unbound@staging.mindriotlabs.com' }
      }
    ],
    [
      'act-uat-review-alex-rivera',
      {
        id: 'act-uat-review-alex-rivera',
        name: 'Alex Rivera (Disposable UAT Participant)',
        actor_type: 'HUMAN',
        organization: 'MindRiot Labs (Staging)'
      }
    ],
    [
      'actor-other-project-steward-staging',
      {
        id: 'actor-other-project-steward-staging',
        name: 'Cross-Project Steward (Synthetic UAT)',
        actor_type: 'HUMAN',
        organization: 'MindRiot Labs (Staging)'
      }
    ],
    [
      'actor-unverified-steward-staging',
      {
        id: 'actor-unverified-steward-staging',
        name: 'Unverified Email Steward (Synthetic UAT)',
        actor_type: 'HUMAN',
        organization: 'MindRiot Labs (Staging)'
      }
    ],
    [
      'actor-google-required-email-only-staging',
      {
        id: 'actor-google-required-email-only-staging',
        name: 'Email-Only On Google Binding (Synthetic UAT)',
        actor_type: 'HUMAN',
        organization: 'MindRiot Labs (Staging)'
      }
    ]
  ]);

  const bindingsByAuthUserId = new Map([
    [
      '11111111-2222-4333-8444-555555555001',
      {
        binding_id: 'bind-staging-steward-uat-001',
        auth_user_id: '11111111-2222-4333-8444-555555555001',
        actor_id: 'actor-steward-uat-staging',
        bound_email: 'steward-uat@staging.mindriotlabs.com',
        required_auth_provider: 'email',
        is_superadmin: false,
        binding_status: 'ACTIVE'
      }
    ],
    [
      '11111111-2222-4333-8444-555555555003',
      {
        binding_id: 'bind-staging-collaborator-uat-003',
        auth_user_id: '11111111-2222-4333-8444-555555555003',
        actor_id: 'act-uat-review-alex-rivera',
        bound_email: 'collaborator-uat@staging.mindriotlabs.com',
        required_auth_provider: 'email',
        is_superadmin: false,
        binding_status: 'ACTIVE'
      }
    ],
    [
      '11111111-2222-4333-8444-555555555004',
      {
        binding_id: 'bind-staging-other-project-004',
        auth_user_id: '11111111-2222-4333-8444-555555555004',
        actor_id: 'actor-other-project-steward-staging',
        bound_email: 'other-project-steward@staging.mindriotlabs.com',
        required_auth_provider: 'email',
        is_superadmin: false,
        binding_status: 'ACTIVE'
      }
    ],
    [
      '11111111-2222-4333-8444-555555555005',
      {
        binding_id: 'bind-staging-unverified-005',
        auth_user_id: '11111111-2222-4333-8444-555555555005',
        actor_id: 'actor-unverified-steward-staging',
        bound_email: 'unverified-steward@staging.mindriotlabs.com',
        required_auth_provider: 'email',
        is_superadmin: false,
        binding_status: 'ACTIVE'
      }
    ],
    [
      '11111111-2222-4333-8444-555555555006',
      {
        binding_id: 'bind-staging-founder-jvh-006',
        auth_user_id: '11111111-2222-4333-8444-555555555006',
        actor_id: 'act-founder-jvh',
        bound_email: 'jvh@mindriotlabs.com',
        required_auth_provider: 'email',
        is_superadmin: false,
        binding_status: 'REVOKED'
      }
    ],
    [
      '11111111-2222-4333-8444-555555555007',
      {
        binding_id: 'bind-staging-google-required-007',
        auth_user_id: '11111111-2222-4333-8444-555555555007',
        actor_id: 'actor-google-required-email-only-staging',
        bound_email: 'email-only-on-google-binding@staging.mindriotlabs.com',
        required_auth_provider: 'google',
        is_superadmin: false,
        binding_status: 'ACTIVE'
      }
    ],
    [
      CANONICAL_FOUNDER_SUPERADMIN_AUTH_UUID,
      {
        binding_id: 'bind-staging-founder-google-jvh',
        auth_user_id: CANONICAL_FOUNDER_SUPERADMIN_AUTH_UUID,
        actor_id: 'act-founder-jvh',
        bound_email: CANONICAL_FOUNDER_SUPERADMIN_EMAIL,
        required_auth_provider: 'google',
        is_superadmin: true,
        binding_status: 'ACTIVE'
      }
    ]
  ]);

  const foundryMembers = [
    { project_id: 'proj-mrl-service-platform', actor_id: 'act-founder-jvh', role: 'FOUNDER' },
    { project_id: 'proj-mrl-service-platform', actor_id: 'actor-steward-uat-staging', role: 'STEWARD' },
    { project_id: 'proj-mrl-service-platform', actor_id: 'actor-unbound-email-twin-staging', role: 'STEWARD' },
    { project_id: 'proj-mrl-service-platform', actor_id: 'act-uat-review-alex-rivera', role: 'COLLABORATOR' },
    { project_id: 'prj-unrelated-venture-staging', actor_id: 'actor-other-project-steward-staging', role: 'STEWARD' },
    { project_id: 'proj-mrl-service-platform', actor_id: 'actor-unverified-steward-staging', role: 'STEWARD' },
    { project_id: 'proj-mrl-service-platform', actor_id: 'actor-google-required-email-only-staging', role: 'STEWARD' }
  ];

  const auditLog = [];

  cachedStewardMemoryHarness = {
    sessionStore,
    authUsersByJwt,
    coreActors,
    bindingsByAuthUserId,
    foundryMembers,
    auditLog
  };
  return cachedStewardMemoryHarness;
}

export function resetStewardPreviewForTests() {
  cachedStewardMemoryHarness = null;
}

async function invokeStewardPreviewRpc({
  useMemoryStore,
  supabaseUrl,
  supabaseServiceKey,
  sessionId,
  authUserId = null,
  verifiedEmail = null,
  emailVerified = false,
  clientIpHash = null,
  userAgent = null,
  denialOverrideOutcome = null,
  denialOverrideCode = null,
  authProvider = 'email',
  hasVerifiedGoogleIdentity = false
}) {
  if (useMemoryStore) {
    const harness = await getSharedStewardMemoryHarness();
    const auditId = `staud-${crypto.randomBytes(12).toString('hex')}`;
    const nowIso = new Date().toISOString();

    if (denialOverrideOutcome) {
      harness.auditLog.push({
        audit_id: auditId,
        session_id: sessionId,
        auth_user_id: authUserId,
        outcome: denialOverrideOutcome,
        denial_code: denialOverrideCode || denialOverrideOutcome,
        client_ip_hash: clientIpHash,
        user_agent: userAgent,
        occurred_at: nowIso
      });
      return {
        authorized: false,
        http_status:
          denialOverrideOutcome === 'DENIED_UNAUTHENTICATED' ||
          denialOverrideOutcome === 'DENIED_QUERY_TOKEN_FORBIDDEN'
            ? 401
            : denialOverrideOutcome === 'DENIED_INVALID_METHOD'
            ? 405
            : 403,
        code: denialOverrideCode || denialOverrideOutcome,
        error: 'Steward review preview access denied.',
        audit_id: auditId,
        audited_at: nowIso
      };
    }

    if (!authUserId) {
      harness.auditLog.push({
        audit_id: auditId,
        session_id: sessionId,
        outcome: 'DENIED_UNAUTHENTICATED',
        denial_code: 'UNAUTHENTICATED',
        client_ip_hash: clientIpHash,
        user_agent: userAgent,
        occurred_at: nowIso
      });
      return {
        authorized: false,
        http_status: 401,
        code: 'UNAUTHENTICATED',
        error: 'Authenticated Supabase user session is required.',
        audit_id: auditId,
        audited_at: nowIso
      };
    }

    if (!emailVerified) {
      harness.auditLog.push({
        audit_id: auditId,
        session_id: sessionId,
        auth_user_id: authUserId,
        outcome: 'DENIED_UNVERIFIED_EMAIL',
        denial_code: 'EMAIL_NOT_VERIFIED',
        client_ip_hash: clientIpHash,
        user_agent: userAgent,
        occurred_at: nowIso
      });
      return {
        authorized: false,
        http_status: 403,
        code: 'EMAIL_NOT_VERIFIED',
        error: 'Steward email address must be verified in Supabase Auth before accessing the Steward preview.',
        audit_id: auditId,
        audited_at: nowIso
      };
    }

    const binding = harness.bindingsByAuthUserId.get(authUserId);
    if (!binding || binding.binding_status !== 'ACTIVE') {
      harness.auditLog.push({
        audit_id: auditId,
        session_id: sessionId,
        auth_user_id: authUserId,
        outcome: 'DENIED_UNBOUND_AUTH_USER',
        denial_code: 'STEWARD_IDENTITY_NOT_BOUND',
        client_ip_hash: clientIpHash,
        user_agent: userAgent,
        occurred_at: nowIso
      });
      return {
        authorized: false,
        http_status: 403,
        code: 'STEWARD_IDENTITY_NOT_BOUND',
        error: 'Authenticated user is not explicitly bound to an authorized OWEN core_actors human identity.',
        audit_id: auditId,
        audited_at: nowIso
      };
    }

    const actor = harness.coreActors.get(binding.actor_id);
    if (!actor || actor.actor_type !== 'HUMAN') {
      harness.auditLog.push({
        audit_id: auditId,
        session_id: sessionId,
        auth_user_id: authUserId,
        actor_id: binding.actor_id,
        outcome: 'DENIED_UNBOUND_AUTH_USER',
        denial_code: 'BOUND_ACTOR_NOT_HUMAN',
        client_ip_hash: clientIpHash,
        user_agent: userAgent,
        occurred_at: nowIso
      });
      return {
        authorized: false,
        http_status: 403,
        code: 'STEWARD_IDENTITY_NOT_BOUND',
        error: 'Bound OWEN actor does not exist or is not a HUMAN actor.',
        audit_id: auditId,
        audited_at: nowIso
      };
    }

    if (
      binding.required_auth_provider === 'google' &&
      (String(authProvider || '').toLowerCase() !== 'google' || !hasVerifiedGoogleIdentity)
    ) {
      harness.auditLog.push({
        audit_id: auditId,
        session_id: sessionId,
        auth_user_id: authUserId,
        actor_id: actor.id,
        outcome: 'DENIED_AUTH_PROVIDER_MISMATCH',
        denial_code: 'GOOGLE_OAUTH_IDENTITY_REQUIRED',
        client_ip_hash: clientIpHash,
        user_agent: userAgent,
        occurred_at: nowIso
      });
      return {
        authorized: false,
        http_status: 403,
        code: 'GOOGLE_OAUTH_IDENTITY_REQUIRED',
        error: 'This Founder/Steward identity binding requires a verified Google Sign-In (OAuth 2.0) session.',
        audit_id: auditId,
        audited_at: nowIso
      };
    }

    const session = await harness.sessionStore.getSession(sessionId);
    if (!session) {
      harness.auditLog.push({
        audit_id: auditId,
        session_id: sessionId,
        auth_user_id: authUserId,
        actor_id: actor.id,
        outcome: 'DENIED_SESSION_NOT_FOUND',
        denial_code: 'SESSION_NOT_FOUND',
        client_ip_hash: clientIpHash,
        user_agent: userAgent,
        occurred_at: nowIso
      });
      return {
        authorized: false,
        http_status: 404,
        code: 'SESSION_NOT_FOUND',
        error: `Interview session '${sessionId}' was not found.`,
        audit_id: auditId,
        audited_at: nowIso
      };
    }

    const member = harness.foundryMembers.find(
      (m) =>
        m.project_id === session.project_id &&
        m.actor_id === actor.id &&
        (m.role === 'FOUNDER' || m.role === 'STEWARD')
    );

    let effectiveRole = null;
    if (member) {
      effectiveRole = binding.is_superadmin ? `SUPERADMIN_${member.role}` : member.role;
    } else if (
      binding.is_superadmin &&
      harness.foundryMembers.some((m) => m.actor_id === actor.id && m.role === 'FOUNDER')
    ) {
      effectiveRole = 'SUPERADMIN_FOUNDER';
    }

    if (!effectiveRole) {
      harness.auditLog.push({
        audit_id: auditId,
        session_id: session.id,
        project_id: session.project_id,
        auth_user_id: authUserId,
        actor_id: actor.id,
        outcome: 'DENIED_INSUFFICIENT_PROJECT_ROLE',
        denial_code: 'INSUFFICIENT_STEWARD_PERMISSION',
        client_ip_hash: clientIpHash,
        user_agent: userAgent,
        occurred_at: nowIso
      });
      return {
        authorized: false,
        http_status: 403,
        code: 'INSUFFICIENT_STEWARD_PERMISSION',
        error: `Actor ${actor.id} does not hold FOUNDER, STEWARD, or explicit SUPERADMIN authority for project ${session.project_id}.`,
        audit_id: auditId,
        audited_at: nowIso
      };
    }

    harness.auditLog.push({
      audit_id: auditId,
      session_id: session.id,
      project_id: session.project_id,
      auth_user_id: authUserId,
      actor_id: actor.id,
      actor_role: effectiveRole,
      outcome: 'AUTHORIZED_READ_ONLY_PREVIEW',
      client_ip_hash: clientIpHash,
      user_agent: userAgent,
      occurred_at: nowIso
    });

    const sanitizedSession = scrubSensitiveFieldsDeep(structuredClone(session));
    return {
      authorized: true,
      http_status: 200,
      audit_id: auditId,
      audited_at: nowIso,
      steward: {
        auth_user_id: authUserId,
        actor_id: actor.id,
        actor_name: actor.name,
        actor_type: actor.actor_type,
        organization: actor.organization,
        project_id: session.project_id,
        project_role: effectiveRole,
        is_superadmin: Boolean(binding.is_superadmin),
        required_auth_provider: binding.required_auth_provider || 'google',
        verified_auth_provider: String(authProvider || 'email').toLowerCase(),
        google_identity_verified: Boolean(hasVerifiedGoogleIdentity),
        binding_id: binding.binding_id,
        bound_email: binding.bound_email
      },
      evidence_digests: {
        turns_count: Array.isArray(session.turns) ? session.turns.length : 0,
        turns_sha256: sha256Hex(JSON.stringify(session.turns ?? [])),
        participant_statements_sha256: sha256Hex(
          JSON.stringify(session.epistemic_ledger?.participant_statements ?? [])
        ),
        machine_interpretations_sha256: sha256Hex(
          JSON.stringify(session.epistemic_ledger?.machine_interpretations ?? [])
        ),
        epistemic_ledger_sha256: sha256Hex(JSON.stringify(session.epistemic_ledger ?? {})),
        experience_brief_sha256: session.experience_brief
          ? sha256Hex(JSON.stringify(session.experience_brief))
          : null,
        session_updated_at: session.updated_at
      },
      session: sanitizedSession
    };
  }

  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/owen_get_steward_review_preview`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseServiceKey,
      Authorization: `Bearer ${supabaseServiceKey}`
    },
    body: JSON.stringify({
      p_session_id: sessionId,
      p_auth_user_id: authUserId,
      p_verified_email: verifiedEmail,
      p_email_verified: Boolean(emailVerified),
      p_client_ip_hash: clientIpHash,
      p_user_agent: userAgent,
      p_denial_override_outcome: denialOverrideOutcome,
      p_denial_override_code: denialOverrideCode,
      p_auth_provider: authProvider,
      p_has_verified_google_identity: Boolean(hasVerifiedGoogleIdentity)
    })
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Steward preview RPC failed (${res.status}): ${errText}`);
  }

  return res.json();
}

/**
 * Verifies the caller's Supabase Auth JWT, enforces explicit UUID-to-actor binding
 * and project-scoped FOUNDER/STEWARD membership, and returns the read-only Steward
 * preview payload without mutating interview evidence or provisioning a review token.
 */
export async function handleStewardReviewPreviewRequest(request, env = {}) {
  enforceRateLimit(request);

  const url = new URL(request.url);
  const isStaging = isStagingOrPreviewRuntime(env, request);
  const sessionId =
    (url.searchParams.get('session_id') || '').trim() ||
    (isStaging ? DEFAULT_STAGING_STEWARD_PREVIEW_SESSION_ID : DEFAULT_PILOT_001_SESSION_ID);

  const nodeEnv = getEnvValue(env, 'NODE_ENV');
  const storeMode =
    getEnvValue(env, 'STEWARD_PREVIEW_STORE') ||
    getEnvValue(env, 'REVIEW_STORE') ||
    getEnvValue(env, 'INTERVIEW_STORE');
  const useMemoryStore =
    storeMode === 'supabase' ? false : nodeEnv === 'test' || storeMode === 'memory';

  const supabaseServiceKey = resolveSupabaseServiceKey(env);
  const supabaseAnonKey = resolveSupabaseAnonKey(env);
  let supabaseUrl = '';
  if (!useMemoryStore) {
    supabaseUrl = resolveValidatedSupabaseUrl(env, request);
    if (!supabaseServiceKey) {
      throw new Error(
        'Server persistence credential (SUPABASE_SERVICE_ROLE_KEY) is not configured on the Cloudflare Worker.'
      );
    }
  }

  const clientIpHash = hashClientIp(request);
  const userAgent = (request.headers.get('user-agent') || 'unknown').slice(0, 256);

  // 1. Enforce strictly read-only HTTP method (GET / OPTIONS only)
  const method = (request.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'OPTIONS') {
    recordFailedAuthAttempt(request);
    const denial = await invokeStewardPreviewRpc({
      useMemoryStore,
      supabaseUrl,
      supabaseServiceKey,
      sessionId,
      clientIpHash,
      userAgent,
      denialOverrideOutcome: 'DENIED_INVALID_METHOD',
      denialOverrideCode: 'READ_ONLY_STEWARD_PREVIEW_ENDPOINT'
    });
    throw new StewardPreviewError(
      'Steward Review Preview is strictly read-only (GET only). Participant impersonation, draft saves, review submissions, and publication mutations are forbidden on this endpoint.',
      'READ_ONLY_STEWARD_PREVIEW_ENDPOINT',
      405,
      denial?.audit_id
    );
  }

  // 2. Reject any credentials passed in URL query parameters
  if (
    url.searchParams.has('token') ||
    url.searchParams.has('access_token') ||
    url.searchParams.has('review_token') ||
    url.searchParams.has('steward_token')
  ) {
    recordFailedAuthAttempt(request);
    const denial = await invokeStewardPreviewRpc({
      useMemoryStore,
      supabaseUrl,
      supabaseServiceKey,
      sessionId,
      clientIpHash,
      userAgent,
      denialOverrideOutcome: 'DENIED_QUERY_TOKEN_FORBIDDEN',
      denialOverrideCode: 'QUERY_TOKEN_FORBIDDEN'
    });
    throw new StewardPreviewError(
      'Authentication tokens must not be passed in URL query parameters. Send the Supabase Auth access token in the Authorization Bearer header.',
      'QUERY_TOKEN_FORBIDDEN',
      401,
      denial?.audit_id
    );
  }

  // 2b. Prevent open redirects & cross-environment redirect origins
  const redirectCandidate =
    (url.searchParams.get('redirect_to') || '').trim() ||
    (request.headers.get('x-steward-redirect-origin') || '').trim();
  if (redirectCandidate && !isApprovedStewardRedirectOrOrigin(redirectCandidate, isStaging)) {
    const denial = await invokeStewardPreviewRpc({
      useMemoryStore,
      supabaseUrl,
      supabaseServiceKey,
      sessionId,
      clientIpHash,
      userAgent,
      denialOverrideOutcome: 'DENIED_UNTRUSTED_REDIRECT_ORIGIN',
      denialOverrideCode: 'UNTRUSTED_REDIRECT_ORIGIN_FORBIDDEN'
    });
    throw new StewardPreviewError(
      'Redirect URL or origin is not in the approved environment allowlist for Steward Preview.',
      'UNTRUSTED_REDIRECT_ORIGIN_FORBIDDEN',
      403,
      denial?.audit_id
    );
  }

  // 3. Enforce staging/production environment isolation
  if (isStaging && sessionId === DEFAULT_PILOT_001_SESSION_ID) {
    const denial = await invokeStewardPreviewRpc({
      useMemoryStore,
      supabaseUrl,
      supabaseServiceKey,
      sessionId,
      clientIpHash,
      userAgent,
      denialOverrideOutcome: 'DENIED_ENVIRONMENT_ISOLATION',
      denialOverrideCode: 'ENVIRONMENT_ISOLATION_FORBIDDEN'
    });
    throw new StewardPreviewError(
      'Production Pilot 001 session is isolated from the staging/preview environment.',
      'ENVIRONMENT_ISOLATION_FORBIDDEN',
      403,
      denial?.audit_id
    );
  }

  // 4. Require Bearer token in Authorization header
  const bearerToken = extractStewardBearerToken(request);
  if (!bearerToken) {
    recordFailedAuthAttempt(request);
    const denial = await invokeStewardPreviewRpc({
      useMemoryStore,
      supabaseUrl,
      supabaseServiceKey,
      sessionId,
      clientIpHash,
      userAgent,
      denialOverrideOutcome: 'DENIED_UNAUTHENTICATED',
      denialOverrideCode: 'UNAUTHENTICATED'
    });
    throw new StewardPreviewError(
      'Authenticated Supabase user session is required (Authorization: Bearer <access_token>).',
      'UNAUTHENTICATED',
      401,
      denial?.audit_id
    );
  }

  // 5. Reject 64-character hex SHA-256 digest replay
  if (/^[0-9a-f]{64}$/i.test(bearerToken)) {
    recordFailedAuthAttempt(request);
    const denial = await invokeStewardPreviewRpc({
      useMemoryStore,
      supabaseUrl,
      supabaseServiceKey,
      sessionId,
      clientIpHash,
      userAgent,
      denialOverrideOutcome: 'DENIED_UNAUTHENTICATED',
      denialOverrideCode: 'DIGEST_REPLAY_FORBIDDEN'
    });
    throw new StewardPreviewError(
      'SHA-256 token digests cannot be used as bearer credentials (DIGEST_REPLAY_FORBIDDEN).',
      'DIGEST_REPLAY_FORBIDDEN',
      401,
      denial?.audit_id
    );
  }

  // 6. Reject participant interview invitation tokens and participant review tokens
  const knownParticipantTokens = [
    getConfiguredTokenForSession(env, sessionId),
    getConfiguredTokenForSession(env, DISPOSABLE_UAT_SESSION_ID),
    getConfiguredTokenForSession(env, FOUNDER_UAT_V02_SESSION_ID),
    getConfiguredTokenForSession(env, DEFAULT_PILOT_001_SESSION_ID),
    getConfiguredReviewTokenForSession(env, sessionId),
    getConfiguredReviewTokenForSession(env, DISPOSABLE_UAT_REVIEW_SESSION_ID),
    getConfiguredReviewTokenForSession(env, DEFAULT_PILOT_001_SESSION_ID)
  ].filter(Boolean);

  if (knownParticipantTokens.some((tok) => timingSafeTokenMatch(bearerToken, tok))) {
    recordFailedAuthAttempt(request);
    const denial = await invokeStewardPreviewRpc({
      useMemoryStore,
      supabaseUrl,
      supabaseServiceKey,
      sessionId,
      clientIpHash,
      userAgent,
      denialOverrideOutcome: 'DENIED_WRONG_TOKEN_SCOPE',
      denialOverrideCode: 'WRONG_TOKEN_SCOPE'
    });
    throw new StewardPreviewError(
      'Participant interview or review tokens are not valid for the Steward Review Preview. Authenticate with an individual Steward Supabase Auth session.',
      'WRONG_TOKEN_SCOPE',
      403,
      denial?.audit_id
    );
  }

  // 7. Verify the Supabase Auth access token against Supabase Auth (`/auth/v1/user`)
  let authUserId = null;
  let verifiedEmail = null;
  let emailVerified = false;
  let authProvider = 'email';
  let hasVerifiedGoogleIdentity = false;

  if (useMemoryStore) {
    const harness = await getSharedStewardMemoryHarness();
    const mockUser = harness.authUsersByJwt.get(bearerToken);
    if (!mockUser) {
      recordFailedAuthAttempt(request);
      const denial = await invokeStewardPreviewRpc({
        useMemoryStore,
        supabaseUrl,
        supabaseServiceKey,
        sessionId,
        clientIpHash,
        userAgent,
        denialOverrideOutcome: 'DENIED_UNAUTHENTICATED',
        denialOverrideCode: 'INVALID_SUPABASE_AUTH_TOKEN'
      });
      throw new StewardPreviewError(
        'Invalid or expired Supabase Auth access token.',
        'UNAUTHENTICATED',
        401,
        denial?.audit_id
      );
    }
    authUserId = mockUser.id;
    verifiedEmail = mockUser.email;
    emailVerified = Boolean(mockUser.email_confirmed_at);
    const providerMeta = extractVerifiedAuthProviderAndGoogleIdentity(mockUser);
    authProvider = providerMeta.authProvider;
    hasVerifiedGoogleIdentity = providerMeta.hasVerifiedGoogleIdentity;
  } else {
    const authRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: 'GET',
      headers: {
        apikey: supabaseAnonKey || supabaseServiceKey,
        Authorization: `Bearer ${bearerToken}`
      }
    });

    if (!authRes.ok) {
      recordFailedAuthAttempt(request);
      const denial = await invokeStewardPreviewRpc({
        useMemoryStore,
        supabaseUrl,
        supabaseServiceKey,
        sessionId,
        clientIpHash,
        userAgent,
        denialOverrideOutcome: 'DENIED_UNAUTHENTICATED',
        denialOverrideCode: 'INVALID_SUPABASE_AUTH_TOKEN'
      });
      throw new StewardPreviewError(
        'Invalid or expired Supabase Auth session. Please sign in with your verified Steward account.',
        'UNAUTHENTICATED',
        401,
        denial?.audit_id
      );
    }

    const authUser = await authRes.json();
    if (!authUser || typeof authUser.id !== 'string') {
      recordFailedAuthAttempt(request);
      const denial = await invokeStewardPreviewRpc({
        useMemoryStore,
        supabaseUrl,
        supabaseServiceKey,
        sessionId,
        clientIpHash,
        userAgent,
        denialOverrideOutcome: 'DENIED_UNAUTHENTICATED',
        denialOverrideCode: 'INVALID_SUPABASE_AUTH_USER'
      });
      throw new StewardPreviewError(
        'Unable to resolve authenticated Supabase user identity.',
        'UNAUTHENTICATED',
        401,
        denial?.audit_id
      );
    }

    authUserId = authUser.id;
    verifiedEmail = authUser.email || null;
    emailVerified = Boolean(
      authUser.email_confirmed_at ||
        authUser.confirmed_at ||
        authUser.user_metadata?.email_verified
    );
    const providerMeta = extractVerifiedAuthProviderAndGoogleIdentity(authUser);
    authProvider = providerMeta.authProvider;
    hasVerifiedGoogleIdentity = providerMeta.hasVerifiedGoogleIdentity;
  }

  // Caller has presented a cryptographically verified Supabase Auth session
  clearFailedAuthAttempts(request);

  // 8. Enforce explicit UUID->actor binding, Google OAuth identity, and project-scoped FOUNDER/STEWARD permission in PostgreSQL
  const rpcResult = await invokeStewardPreviewRpc({
    useMemoryStore,
    supabaseUrl,
    supabaseServiceKey,
    sessionId,
    authUserId,
    verifiedEmail,
    emailVerified,
    authProvider,
    hasVerifiedGoogleIdentity,
    clientIpHash,
    userAgent
  });

  if (!rpcResult || rpcResult.authorized !== true) {
    throw new StewardPreviewError(
      rpcResult?.error || 'Steward review preview access denied.',
      rpcResult?.code || 'STEWARD_PREVIEW_DENIED',
      rpcResult?.http_status || 403,
      rpcResult?.audit_id || null
    );
  }

  // 9. Dynamically synthesize the proposed review package & impact chain in-memory without mutation
  const synthesized = await synthesizeReadOnlyStewardReviewPreview(rpcResult.session);

  return scrubSensitiveFieldsDeep({
    steward_preview: {
      preview_mode: 'STEWARD_READ_ONLY_PREVIEW',
      banner_label:
        'STEWARD PREVIEW ONLY — UNAPPROVED & NON-PARTICIPANT-FACING · READ-ONLY INSPECTION (NO PARTICIPANT REVIEW TOKEN PROVISIONED)',
      governance_guarantees: {
        is_steward_preview_only: true,
        is_read_only: true,
        source_session_mutated: false,
        participant_review_token_provisioned: synthesized.participant_review_token_provisioned,
        was_dynamically_synthesized: synthesized.was_dynamically_synthesized,
        participant_impersonation_permitted: false,
        publication_or_foundry_ingestion_permitted: false,
        implicit_email_matching_permitted: false,
        google_oauth_identity_required: rpcResult.steward?.required_auth_provider === 'google',
        explicit_superadmin_required: Boolean(rpcResult.steward?.is_superadmin)
      },
      audit_receipt: {
        audit_id: rpcResult.audit_id,
        audited_at: rpcResult.audited_at,
        outcome: 'AUTHORIZED_READ_ONLY_PREVIEW'
      },
      steward_identity: rpcResult.steward,
      evidence_digests: rpcResult.evidence_digests,
      session_summary: {
        session_id: rpcResult.session.id,
        pilot_id: rpcResult.session.pilot_id,
        project_id: rpcResult.session.project_id,
        title: rpcResult.session.title,
        purpose: rpcResult.session.purpose,
        status: rpcResult.session.status,
        modality: rpcResult.session.modality,
        created_at: rpcResult.session.created_at,
        updated_at: rpcResult.session.updated_at,
        completed_at: rpcResult.session.completed_at
      },
      proposed_review_package: synthesized.proposed_review_package,
      contribution_to_impact_chain: synthesized.contribution_to_impact_chain,
      epistemic_inspection: synthesized.epistemic_inspection
    }
  });
}

export function buildStewardPreviewErrorResponse(
  err,
  defaultMessage = 'Unable to process Steward Review Preview request.'
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
          ...stewardPreviewCorsHeaders,
          'Retry-After': String(err.retryAfterSeconds)
        }
      }
    );
  }

  if (err instanceof StewardPreviewError) {
    return new Response(
      JSON.stringify({
        error: err.message,
        code: err.code,
        ...(err.auditId ? { audit_id: err.auditId } : {})
      }),
      {
        status: err.status || 403,
        headers: {
          ...stewardPreviewCorsHeaders,
          ...(err.status === 405 ? { Allow: 'GET, OPTIONS' } : {})
        }
      }
    );
  }

  const sanitized = sanitizeErrorMessageForClient(err?.message, defaultMessage);
  return new Response(
    JSON.stringify({
      error: sanitized.message,
      code: sanitized.isInternalError ? 'INTERNAL_ERROR' : 'STEWARD_PREVIEW_ERROR'
    }),
    {
      status: 500,
      headers: stewardPreviewCorsHeaders
    }
  );
}
