import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  onRequest as onStewardPreviewRequest,
  onRequestGet as getStewardPreview
} from '../functions/api/owen/steward/review-preview.js';
import { onRequestGet as getStewardAuthConfig } from '../functions/api/owen/steward/auth-config.js';
import {
  DEFAULT_STAGING_STEWARD_PREVIEW_SESSION_ID,
  TEST_STEWARD_TOKENS,
  getSharedStewardMemoryHarness,
  resetStewardPreviewForTests
} from '../functions/api/owen/steward/service.js';
import {
  DEFAULT_PILOT_001_SESSION_ID,
  resetInterviewServiceForTests
} from '../functions/api/owen/interview/service.js';
import { resetReviewServiceForTests } from '../functions/api/owen/review/service.js';

describe('MindRiotLabs /api/owen/steward/review-preview & /owen/steward/review Suite (Option B — ADR-0021)', () => {
  const SYNTHETIC_PILOT_INVITE_TOKEN = 'pilot001_synthetic_invite_token_a9f8e7d6c5b4a3';
  const SYNTHETIC_UAT_INVITE_TOKEN = 'uat001_synthetic_invite_token_11223344556677';
  const SYNTHETIC_UAT_REVIEW_TOKEN = 'uat001_synthetic_review_token_889900aabbccdd';

  const testEnv = {
    NODE_ENV: 'test',
    STEWARD_PREVIEW_STORE: 'memory',
    SUPABASE_URL: 'https://wfesuspzrknxaqswhksj.supabase.co',
    SUPABASE_ANON_KEY: 'sb_publishable_synthetic_test_anon_key',
    SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_synthetic_do_not_expose_in_responses',
    OWEN_PILOT_001_INVITE_TOKEN: SYNTHETIC_PILOT_INVITE_TOKEN,
    OWEN_UAT_DISPOSABLE_INVITE_TOKEN: SYNTHETIC_UAT_INVITE_TOKEN,
    OWEN_UAT_REVIEW_TOKEN: SYNTHETIC_UAT_REVIEW_TOKEN
  };

  beforeEach(() => {
    resetStewardPreviewForTests();
    resetReviewServiceForTests();
    resetInterviewServiceForTests();
  });

  it('1. Rejects unauthenticated requests, invalid JWTs, query-string tokens, and 64-char SHA-256 digest replay', async () => {
    // A. No Authorization header -> 401 UNAUTHENTICATED
    const unauthReq = new Request(
      `https://staging.mindriotlabs.com/api/owen/steward/review-preview?session_id=${DEFAULT_STAGING_STEWARD_PREVIEW_SESSION_ID}`
    );
    const unauthRes = await getStewardPreview({ request: unauthReq, env: testEnv });
    assert.equal(unauthRes.status, 401);
    const unauthBody = await unauthRes.json();
    assert.equal(unauthBody.code, 'UNAUTHENTICATED');
    assert.ok(unauthBody.audit_id);

    // B. Invalid/expired Supabase Auth JWT -> 401 UNAUTHENTICATED
    const badJwtReq = new Request(
      `https://staging.mindriotlabs.com/api/owen/steward/review-preview?session_id=${DEFAULT_STAGING_STEWARD_PREVIEW_SESSION_ID}`,
      {
        headers: { Authorization: 'Bearer invalid_supabase_jwt_token' }
      }
    );
    const badJwtRes = await getStewardPreview({ request: badJwtReq, env: testEnv });
    assert.equal(badJwtRes.status, 401);
    const badJwtBody = await badJwtRes.json();
    assert.equal(badJwtBody.code, 'UNAUTHENTICATED');

    // C. Token in URL query string (?access_token=...) -> 401 QUERY_TOKEN_FORBIDDEN
    const queryTokenReq = new Request(
      `https://staging.mindriotlabs.com/api/owen/steward/review-preview?session_id=${DEFAULT_STAGING_STEWARD_PREVIEW_SESSION_ID}&access_token=${TEST_STEWARD_TOKENS.AUTHORIZED_STEWARD}`
    );
    const queryTokenRes = await getStewardPreview({ request: queryTokenReq, env: testEnv });
    assert.equal(queryTokenRes.status, 401);
    const queryTokenBody = await queryTokenRes.json();
    assert.equal(queryTokenBody.code, 'QUERY_TOKEN_FORBIDDEN');

    // D. 64-char SHA-256 hex digest presented as Bearer token -> 401 DIGEST_REPLAY_FORBIDDEN
    const digestReplayReq = new Request(
      `https://staging.mindriotlabs.com/api/owen/steward/review-preview?session_id=${DEFAULT_STAGING_STEWARD_PREVIEW_SESSION_ID}`,
      {
        headers: {
          Authorization:
            'Bearer e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
        }
      }
    );
    const digestReplayRes = await getStewardPreview({ request: digestReplayReq, env: testEnv });
    assert.equal(digestReplayRes.status, 401);
    const digestReplayBody = await digestReplayRes.json();
    assert.equal(digestReplayBody.code, 'DIGEST_REPLAY_FORBIDDEN');
  });

  it('2. Rejects participant interview invitation tokens and participant review tokens on Steward endpoints (403 WRONG_TOKEN_SCOPE)', async () => {
    const inviteTokenReq = new Request(
      `https://staging.mindriotlabs.com/api/owen/steward/review-preview?session_id=${DEFAULT_STAGING_STEWARD_PREVIEW_SESSION_ID}`,
      {
        headers: { Authorization: `Bearer ${SYNTHETIC_UAT_INVITE_TOKEN}` }
      }
    );
    const inviteRes = await getStewardPreview({ request: inviteTokenReq, env: testEnv });
    assert.equal(inviteRes.status, 403);
    const inviteBody = await inviteRes.json();
    assert.equal(inviteBody.code, 'WRONG_TOKEN_SCOPE');

    const reviewTokenReq = new Request(
      `https://staging.mindriotlabs.com/api/owen/steward/review-preview?session_id=${DEFAULT_STAGING_STEWARD_PREVIEW_SESSION_ID}`,
      {
        headers: { Authorization: `Bearer ${SYNTHETIC_UAT_REVIEW_TOKEN}` }
      }
    );
    const reviewRes = await getStewardPreview({ request: reviewTokenReq, env: testEnv });
    assert.equal(reviewRes.status, 403);
    const reviewBody = await reviewRes.json();
    assert.equal(reviewBody.code, 'WRONG_TOKEN_SCOPE');
  });

  it('3. Enforces explicit UUID-to-actor binding and rejects unbound matching-email users, unverified emails, collaborators, and wrong-project stewards (403)', async () => {
    // A. Unverified email user -> 403 EMAIL_NOT_VERIFIED
    const unverifiedReq = new Request(
      `https://staging.mindriotlabs.com/api/owen/steward/review-preview?session_id=${DEFAULT_STAGING_STEWARD_PREVIEW_SESSION_ID}`,
      {
        headers: { Authorization: `Bearer ${TEST_STEWARD_TOKENS.UNVERIFIED_EMAIL_STEWARD}` }
      }
    );
    const unverifiedRes = await getStewardPreview({ request: unverifiedReq, env: testEnv });
    assert.equal(unverifiedRes.status, 403);
    const unverifiedBody = await unverifiedRes.json();
    assert.equal(unverifiedBody.code, 'EMAIL_NOT_VERIFIED');

    // B. Unbound user with matching STEWARD email in core_actors.metadata -> 403 STEWARD_IDENTITY_NOT_BOUND
    const unboundEmailReq = new Request(
      `https://staging.mindriotlabs.com/api/owen/steward/review-preview?session_id=${DEFAULT_STAGING_STEWARD_PREVIEW_SESSION_ID}&role=STEWARD`,
      {
        headers: { Authorization: `Bearer ${TEST_STEWARD_TOKENS.UNBOUND_MATCHING_EMAIL}` }
      }
    );
    const unboundEmailRes = await getStewardPreview({ request: unboundEmailReq, env: testEnv });
    assert.equal(unboundEmailRes.status, 403);
    const unboundEmailBody = await unboundEmailRes.json();
    assert.equal(unboundEmailBody.code, 'STEWARD_IDENTITY_NOT_BOUND');

    // C. Bound COLLABORATOR on target project -> 403 INSUFFICIENT_STEWARD_PERMISSION
    const collabReq = new Request(
      `https://staging.mindriotlabs.com/api/owen/steward/review-preview?session_id=${DEFAULT_STAGING_STEWARD_PREVIEW_SESSION_ID}&role=STEWARD`,
      {
        headers: { Authorization: `Bearer ${TEST_STEWARD_TOKENS.BOUND_COLLABORATOR}` }
      }
    );
    const collabRes = await getStewardPreview({ request: collabReq, env: testEnv });
    assert.equal(collabRes.status, 403);
    const collabBody = await collabRes.json();
    assert.equal(collabBody.code, 'INSUFFICIENT_STEWARD_PERMISSION');

    // D. Bound STEWARD on an unrelated project -> 403 INSUFFICIENT_STEWARD_PERMISSION
    const otherProjReq = new Request(
      `https://staging.mindriotlabs.com/api/owen/steward/review-preview?session_id=${DEFAULT_STAGING_STEWARD_PREVIEW_SESSION_ID}`,
      {
        headers: { Authorization: `Bearer ${TEST_STEWARD_TOKENS.OTHER_PROJECT_STEWARD}` }
      }
    );
    const otherProjRes = await getStewardPreview({ request: otherProjReq, env: testEnv });
    assert.equal(otherProjRes.status, 403);
    const otherProjBody = await otherProjRes.json();
    assert.equal(otherProjBody.code, 'INSUFFICIENT_STEWARD_PERMISSION');
  });

  it('4. Enforces strictly read-only HTTP methods (rejects POST, PUT, PATCH, DELETE with 405)', async () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const mutReq = new Request(
        `https://staging.mindriotlabs.com/api/owen/steward/review-preview?session_id=${DEFAULT_STAGING_STEWARD_PREVIEW_SESSION_ID}`,
        {
          method,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${TEST_STEWARD_TOKENS.AUTHORIZED_STEWARD}`
          },
          body: method === 'DELETE' ? undefined : JSON.stringify({ action: 'APPROVE_OR_MUTATE' })
        }
      );
      const mutRes = await onStewardPreviewRequest({ request: mutReq, env: testEnv });
      assert.equal(mutRes.status, 405);
      assert.equal(mutRes.headers.get('Allow'), 'GET, OPTIONS');
      const mutBody = await mutRes.json();
      assert.equal(mutBody.code, 'READ_ONLY_STEWARD_PREVIEW_ENDPOINT');
    }
  });

  it('5. Enforces staging/production environment isolation (blocks ses-pilot-001-russ-richmond on staging)', async () => {
    const prodSessionOnStagingReq = new Request(
      `https://staging.mindriotlabs.com/api/owen/steward/review-preview?session_id=${DEFAULT_PILOT_001_SESSION_ID}`,
      {
        headers: { Authorization: `Bearer ${TEST_STEWARD_TOKENS.AUTHORIZED_STEWARD}` }
      }
    );
    const res = await getStewardPreview({ request: prodSessionOnStagingReq, env: testEnv });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.code, 'ENVIRONMENT_ISOLATION_FORBIDDEN');
  });

  it('6. Synthesizes read-only Steward preview for authorized STEWARD & FOUNDER without mutating session or provisioning a review token', async () => {
    const harness = await getSharedStewardMemoryHarness();
    const sessionBefore = structuredClone(
      await harness.sessionStore.getSession(DEFAULT_STAGING_STEWARD_PREVIEW_SESSION_ID)
    );
    assert.equal(sessionBefore.status, 'COMPLETED');
    assert.equal(sessionBefore.review_package, undefined);
    assert.equal(sessionBefore.review_access_control, undefined);

    const authReq = new Request(
      `https://staging.mindriotlabs.com/api/owen/steward/review-preview?session_id=${DEFAULT_STAGING_STEWARD_PREVIEW_SESSION_ID}`,
      {
        headers: { Authorization: `Bearer ${TEST_STEWARD_TOKENS.AUTHORIZED_STEWARD}` }
      }
    );
    const res = await getStewardPreview({ request: authReq, env: testEnv });
    assert.equal(res.status, 200);
    const bodyText = await res.text();
    const body = JSON.parse(bodyText);

    const preview = body.steward_preview;
    assert.ok(preview);
    assert.equal(preview.preview_mode, 'STEWARD_READ_ONLY_PREVIEW');
    assert.match(preview.banner_label, /STEWARD PREVIEW ONLY/);
    assert.equal(preview.governance_guarantees.is_read_only, true);
    assert.equal(preview.governance_guarantees.source_session_mutated, false);
    assert.equal(preview.governance_guarantees.participant_review_token_provisioned, false);
    assert.equal(preview.governance_guarantees.was_dynamically_synthesized, true);
    assert.equal(preview.governance_guarantees.participant_impersonation_permitted, false);
    assert.equal(preview.governance_guarantees.publication_or_foundry_ingestion_permitted, false);

    // Verify Steward Identity & Audit Receipt
    assert.equal(preview.steward_identity.actor_id, 'actor-steward-uat-staging');
    assert.equal(preview.steward_identity.project_role, 'STEWARD');
    assert.equal(preview.steward_identity.binding_id, 'bind-staging-steward-uat-001');
    assert.equal(preview.audit_receipt.outcome, 'AUTHORIZED_READ_ONLY_PREVIEW');

    // Verify Proposed Review Package & Contribution-to-Impact Chain
    assert.equal(preview.proposed_review_package.sections.length, 6);
    assert.equal(preview.proposed_review_package.flagged_cleanup_recommendations.length, 2);
    for (const cleanup of preview.proposed_review_package.flagged_cleanup_recommendations) {
      assert.equal(cleanup.default_ui_preselected, true);
      assert.equal(cleanup.participant_decision, 'UNDECIDED');
    }
    assert.equal(preview.contribution_to_impact_chain.items.length, 4);
    assert.ok(preview.contribution_to_impact_chain.non_endorsement_boundary_notice.length > 20);

    // Verify Epistemic Inspection payload
    assert.ok(preview.epistemic_inspection.participant_statements.length > 0);
    assert.ok(preview.epistemic_inspection.turns.length > 0);

    // Verify ZERO mutation of stored session after preview read
    const sessionAfter = await harness.sessionStore.getSession(
      DEFAULT_STAGING_STEWARD_PREVIEW_SESSION_ID
    );
    assert.equal(sessionAfter.status, 'COMPLETED');
    assert.equal(sessionAfter.review_package, undefined);
    assert.equal(sessionAfter.review_access_control, undefined);
    assert.equal(sessionAfter.updated_at, sessionBefore.updated_at);
    assert.deepEqual(sessionAfter.turns, sessionBefore.turns);
    assert.deepEqual(sessionAfter.epistemic_ledger, sessionBefore.epistemic_ledger);

    // Verify ZERO secret leakage in response body
    assert.equal(bodyText.includes('invitation_token_sha256'), false);
    assert.equal(bodyText.includes('review_token_sha256'), false);
    assert.equal(bodyText.includes('sb_secret_synthetic_do_not_expose_in_responses'), false);
    assert.equal(bodyText.includes(SYNTHETIC_PILOT_INVITE_TOKEN), false);
    assert.equal(bodyText.includes(SYNTHETIC_UAT_REVIEW_TOKEN), false);
  });

  it('7. Serves public Steward Auth config without leaking service_role secrets and includes static /owen/steward/review assets', async () => {
    const cfgReq = new Request('https://staging.mindriotlabs.com/api/owen/steward/auth-config');
    const cfgRes = await getStewardAuthConfig({ request: cfgReq, env: testEnv });
    assert.equal(cfgRes.status, 200);
    const cfgText = await cfgRes.text();
    const cfg = JSON.parse(cfgText);
    assert.equal(cfg.environment, 'staging');
    assert.equal(cfg.auth_provider, 'supabase_auth_google_pkce');
    assert.equal(cfg.primary_oauth_provider, 'google');
    assert.equal(cfg.oauth_flow, 'pkce');
    assert.equal(cfg.code_challenge_method, 'S256');
    assert.equal(cfg.canonical_superadmin_email, 'jvanharken@gmail.com');
    assert.ok(Array.isArray(cfg.allowed_redirect_urls));
    assert.equal(cfg.supabase_url, 'https://wfesuspzrknxaqswhksj.supabase.co');
    assert.equal(cfg.supabase_anon_key, 'sb_publishable_synthetic_test_anon_key');
    assert.equal(cfgText.includes('sb_secret_synthetic_do_not_expose_in_responses'), false);

    // Reject unapproved redirect_to on auth-config
    const badCfgReq = new Request(
      'https://staging.mindriotlabs.com/api/owen/steward/auth-config?redirect_to=https%3A%2F%2Fevil.example.com%2Fcallback'
    );
    const badCfgRes = await getStewardAuthConfig({ request: badCfgReq, env: testEnv });
    assert.equal(badCfgRes.status, 403);
    const badCfgBody = await badCfgRes.json();
    assert.equal(badCfgBody.code, 'UNTRUSTED_REDIRECT_ORIGIN_FORBIDDEN');

    const htmlPath = path.resolve('owen/steward/review/index.html');
    const jsPath = path.resolve('owen/steward/review/steward-review.js');
    assert.equal(fs.existsSync(htmlPath), true);
    assert.equal(fs.existsSync(jsPath), true);

    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    const jsContent = fs.readFileSync(jsPath, 'utf8');
    assert.match(htmlContent, /STEWARD PREVIEW ONLY/);
    assert.match(htmlContent, /jvanharken@gmail\.com/);
    assert.match(jsContent, /grant_type=pkce/);
    assert.equal(jsContent.includes('/api/owen/review/draft'), false);
    assert.equal(jsContent.includes('/api/owen/review/submit'), false);
  });

  it('8. Enforces canonical Founder Superadmin Google OAuth binding, rejects revoked jvh@mindriotlabs.com, rejects email-only sessions on Google-required bindings, and blocks open/cross-env redirects', async () => {
    // A. Canonical Founder Superadmin (2285e885-dabb-4abd-bb87-b904d6170423 / jvanharken@gmail.com) via Google OAuth -> 200 OK
    const founderGoogleReq = new Request(
      `https://staging.mindriotlabs.com/api/owen/steward/review-preview?session_id=${DEFAULT_STAGING_STEWARD_PREVIEW_SESSION_ID}`,
      {
        headers: {
          Authorization: `Bearer ${TEST_STEWARD_TOKENS.AUTHORIZED_FOUNDER_GOOGLE}`,
          'x-steward-redirect-origin': 'https://staging.mindriotlabs.com'
        }
      }
    );
    const founderRes = await getStewardPreview({ request: founderGoogleReq, env: testEnv });
    assert.equal(founderRes.status, 200);
    const founderBody = await founderRes.json();
    const st = founderBody.steward_preview.steward_identity;
    assert.equal(st.actor_id, 'act-founder-jvh');
    assert.equal(st.auth_user_id, '2285e885-dabb-4abd-bb87-b904d6170423');
    assert.equal(st.bound_email, 'jvanharken@gmail.com');
    assert.equal(st.required_auth_provider, 'google');
    assert.equal(st.verified_auth_provider, 'google');
    assert.equal(st.google_identity_verified, true);
    assert.equal(st.is_superadmin, true);
    assert.equal(st.project_role, 'SUPERADMIN_FOUNDER');
    assert.equal(
      founderBody.steward_preview.governance_guarantees.google_oauth_identity_required,
      true
    );
    assert.equal(
      founderBody.steward_preview.governance_guarantees.explicit_superadmin_required,
      true
    );

    // B. Revoked synthetic jvh@mindriotlabs.com binding (bind-staging-founder-jvh-006) -> 403 STEWARD_IDENTITY_NOT_BOUND
    const revokedFounderReq = new Request(
      `https://staging.mindriotlabs.com/api/owen/steward/review-preview?session_id=${DEFAULT_STAGING_STEWARD_PREVIEW_SESSION_ID}`,
      {
        headers: { Authorization: `Bearer ${TEST_STEWARD_TOKENS.REVOKED_FOUNDER_EMAIL}` }
      }
    );
    const revokedRes = await getStewardPreview({ request: revokedFounderReq, env: testEnv });
    assert.equal(revokedRes.status, 403);
    const revokedBody = await revokedRes.json();
    assert.equal(revokedBody.code, 'STEWARD_IDENTITY_NOT_BOUND');

    // C. Email-only session on a binding that requires required_auth_provider = 'google' -> 403 GOOGLE_OAUTH_IDENTITY_REQUIRED
    const emailOnGoogleReq = new Request(
      `https://staging.mindriotlabs.com/api/owen/steward/review-preview?session_id=${DEFAULT_STAGING_STEWARD_PREVIEW_SESSION_ID}`,
      {
        headers: { Authorization: `Bearer ${TEST_STEWARD_TOKENS.EMAIL_ON_GOOGLE_BINDING}` }
      }
    );
    const emailOnGoogleRes = await getStewardPreview({ request: emailOnGoogleReq, env: testEnv });
    assert.equal(emailOnGoogleRes.status, 403);
    const emailOnGoogleBody = await emailOnGoogleRes.json();
    assert.equal(emailOnGoogleBody.code, 'GOOGLE_OAUTH_IDENTITY_REQUIRED');

    // D. Untrusted external redirect URL or cross-environment production origin on staging -> 403 UNTRUSTED_REDIRECT_ORIGIN_FORBIDDEN
    const openRedirectReq = new Request(
      `https://staging.mindriotlabs.com/api/owen/steward/review-preview?session_id=${DEFAULT_STAGING_STEWARD_PREVIEW_SESSION_ID}&redirect_to=https%3A%2F%2Fattacker.example.com%2Fsteal`,
      {
        headers: { Authorization: `Bearer ${TEST_STEWARD_TOKENS.AUTHORIZED_FOUNDER_GOOGLE}` }
      }
    );
    const openRedirectRes = await getStewardPreview({ request: openRedirectReq, env: testEnv });
    assert.equal(openRedirectRes.status, 403);
    const openRedirectBody = await openRedirectRes.json();
    assert.equal(openRedirectBody.code, 'UNTRUSTED_REDIRECT_ORIGIN_FORBIDDEN');

    const crossEnvOriginReq = new Request(
      `https://staging.mindriotlabs.com/api/owen/steward/review-preview?session_id=${DEFAULT_STAGING_STEWARD_PREVIEW_SESSION_ID}`,
      {
        headers: {
          Authorization: `Bearer ${TEST_STEWARD_TOKENS.AUTHORIZED_FOUNDER_GOOGLE}`,
          'x-steward-redirect-origin': 'https://mindriotlabs.com'
        }
      }
    );
    const crossEnvOriginRes = await getStewardPreview({ request: crossEnvOriginReq, env: testEnv });
    assert.equal(crossEnvOriginRes.status, 403);
    const crossEnvOriginBody = await crossEnvOriginRes.json();
    assert.equal(crossEnvOriginBody.code, 'UNTRUSTED_REDIRECT_ORIGIN_FORBIDDEN');
  });
});
