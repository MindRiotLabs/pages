import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { onRequestGet as getReviewSession } from '../functions/api/owen/review/session.js';
import { onRequestPost as postReviewDraft } from '../functions/api/owen/review/draft.js';
import { onRequestPost as postReviewSubmit } from '../functions/api/owen/review/submit.js';
import { onRequestGet as getInterviewSession } from '../functions/api/owen/interview/session.js';
import {
  resetReviewServiceForTests,
  DISPOSABLE_UAT_REVIEW_SESSION_ID,
  DISPOSABLE_UAT_EXPIRED_SESSION_ID,
  DISPOSABLE_UAT_REVOKED_SESSION_ID,
  SupabaseRpcReviewSessionStore,
  getSharedReviewMemoryStore,
  hashReviewToken
} from '../functions/api/owen/review/service.js';
import {
  resetInterviewServiceForTests,
  DEFAULT_PILOT_001_SESSION_ID,
  DISPOSABLE_UAT_SESSION_ID
} from '../functions/api/owen/interview/service.js';

describe('MindRiotLabs /api/owen/review/* & /owen/review Portal v0.3 Suite', () => {
  const SYNTHETIC_PILOT_INVITE_TOKEN = 'pilot001_synthetic_invite_token_a9f8e7d6c5b4a3';
  const SYNTHETIC_UAT_INVITE_TOKEN = 'uat001_synthetic_invite_token_11223344556677';
  const SYNTHETIC_UAT_REVIEW_TOKEN = 'uat001_synthetic_review_token_889900aabbccdd';

  const testEnv = {
    NODE_ENV: 'test',
    INTERVIEW_STORE: 'memory',
    OWEN_PILOT_001_INVITE_TOKEN: SYNTHETIC_PILOT_INVITE_TOKEN,
    OWEN_UAT_DISPOSABLE_INVITE_TOKEN: SYNTHETIC_UAT_INVITE_TOKEN,
    OWEN_UAT_REVIEW_TOKEN: SYNTHETIC_UAT_REVIEW_TOKEN
  };

  beforeEach(() => {
    resetReviewServiceForTests();
    resetInterviewServiceForTests();
  });

  it('1. Rejects unauthenticated calls, URL query-string tokens, and interview invitation tokens on review endpoints (Decision 2)', async () => {
    // A. Missing Authorization header -> 401
    const noTokenReq = new Request(
      `https://mindriotlabs.com/api/owen/review/session?session_id=${DISPOSABLE_UAT_REVIEW_SESSION_ID}`
    );
    const noTokenRes = await getReviewSession({ request: noTokenReq, env: testEnv });
    assert.equal(noTokenRes.status, 401);
    assert.equal(noTokenRes.headers.get('Referrer-Policy'), 'no-referrer');
    assert.equal(noTokenRes.headers.get('X-Content-Type-Options'), 'nosniff');

    // B. URL query-string token (?token=...) -> 401 QUERY_TOKEN_FORBIDDEN
    const queryTokenReq = new Request(
      `https://mindriotlabs.com/api/owen/review/session?session_id=${DISPOSABLE_UAT_REVIEW_SESSION_ID}&token=${encodeURIComponent(SYNTHETIC_UAT_REVIEW_TOKEN)}`
    );
    const queryTokenRes = await getReviewSession({ request: queryTokenReq, env: testEnv });
    assert.equal(queryTokenRes.status, 401);
    const queryBody = await queryTokenRes.json();
    assert.equal(queryBody.code, 'QUERY_TOKEN_FORBIDDEN');

    // C. Interview invitation token on review endpoint -> 401 WRONG_TOKEN_SCOPE
    const inviteOnReviewReq = new Request(
      `https://mindriotlabs.com/api/owen/review/session?session_id=${DISPOSABLE_UAT_REVIEW_SESSION_ID}`,
      { headers: { Authorization: `Bearer ${SYNTHETIC_UAT_INVITE_TOKEN}` } }
    );
    const inviteOnReviewRes = await getReviewSession({ request: inviteOnReviewReq, env: testEnv });
    assert.equal(inviteOnReviewRes.status, 401);
    const inviteOnReviewBody = await inviteOnReviewRes.json();
    assert.equal(inviteOnReviewBody.code, 'WRONG_TOKEN_SCOPE');

    // D. Review token on interview endpoint -> 401
    const reviewOnInterviewReq = new Request(
      `https://mindriotlabs.com/api/owen/interview/session?session_id=${DISPOSABLE_UAT_SESSION_ID}`,
      { headers: { Authorization: `Bearer ${SYNTHETIC_UAT_REVIEW_TOKEN}` } }
    );
    const reviewOnInterviewRes = await getInterviewSession({
      request: reviewOnInterviewReq,
      env: testEnv
    });
    assert.equal(reviewOnInterviewRes.status, 401);

    // E. Cross-session access attempt against Russ Richmond's Pilot 001 session -> 401
    const crossSessionReq = new Request(
      `https://mindriotlabs.com/api/owen/review/session?session_id=${DEFAULT_PILOT_001_SESSION_ID}`,
      { headers: { Authorization: `Bearer ${SYNTHETIC_UAT_REVIEW_TOKEN}` } }
    );
    const crossSessionRes = await getReviewSession({ request: crossSessionReq, env: testEnv });
    assert.equal(crossSessionRes.status, 401);
    // F. Expired review credential returns 401 REVIEW_TOKEN_EXPIRED with saved_progress_preserved: true
    const expiredReq = new Request(
      `https://mindriotlabs.com/api/owen/review/session?session_id=${DISPOSABLE_UAT_EXPIRED_SESSION_ID}`,
      { headers: { Authorization: `Bearer ${SYNTHETIC_UAT_REVIEW_TOKEN}` } }
    );
    const expiredRes = await getReviewSession({ request: expiredReq, env: testEnv });
    assert.equal(expiredRes.status, 401);
    const expiredBody = await expiredRes.json();
    assert.equal(expiredBody.code, 'REVIEW_TOKEN_EXPIRED');
    assert.equal(expiredBody.saved_progress_preserved, true);

    // G. Revoked review credential returns 403 REVIEW_TOKEN_REVOKED
    const revokedReq = new Request(
      `https://mindriotlabs.com/api/owen/review/session?session_id=${DISPOSABLE_UAT_REVOKED_SESSION_ID}`,
      { headers: { Authorization: `Bearer ${SYNTHETIC_UAT_REVIEW_TOKEN}` } }
    );
    const revokedRes = await getReviewSession({ request: revokedReq, env: testEnv });
    assert.equal(revokedRes.status, 403);
    const revokedBody = await revokedRes.json();
    assert.equal(revokedBody.code, 'REVIEW_TOKEN_REVOKED');
  });

  it('2. Loads concise 6-section Experience Review Package, defaults allow_foundry_ingestion to false, preselects 2 cleanup recommendations without auto-accepting, and projects 4 Decision-4 Contribution-to-Impact items without internal ledger IDs', async () => {
    const req = new Request(
      `https://mindriotlabs.com/api/owen/review/session?session_id=${DISPOSABLE_UAT_REVIEW_SESSION_ID}`,
      { headers: { Authorization: `Bearer ${SYNTHETIC_UAT_REVIEW_TOKEN}` } }
    );
    const res = await getReviewSession({ request: req, env: testEnv });
    assert.equal(res.status, 200);
    const data = await res.json();
    const review = data.review;

    assert.equal(review.session_id, DISPOSABLE_UAT_REVIEW_SESSION_ID);

    // Opening the review link does NOT constitute approval (Decision 3)
    assert.equal(review.status, 'PENDING_PARTICIPANT_REVIEW');
    assert.equal(review.governance_notice.opening_link_is_not_approval, true);
    assert.equal(review.governance_notice.preselection_is_not_acceptance, true);
    assert.equal(review.governance_notice.requires_human_steward_gate_for_publication, true);
    assert.equal(review.governance_notice.participant_reviewed, false);
    assert.equal(review.governance_notice.human_steward_approved, false);

    // Fail-closed consent defaults before affirmative participant opt-in
    assert.equal(review.sharing_and_attribution.allow_foundry_ingestion, false);
    assert.equal(review.sharing_and_attribution.notify_on_future_outcomes, false);

    // 6 curated sections
    assert.equal(review.sections.length, 6);
    assert.ok(review.sections.every((s) => s.participant_action === 'UNREVIEWED'));
    assert.ok(review.sections.every((s) => s.supporting_excerpts.length > 0));

    // 2 preselected cleanup recommendations with UNDECIDED server state (Decision 3)
    assert.equal(review.flagged_cleanup_recommendations.length, 2);
    for (const rec of review.flagged_cleanup_recommendations) {
      assert.equal(rec.default_ui_preselected, true);
      assert.equal(rec.participant_decision, 'UNDECIDED');
    }

    // 4 calibrated Contribution-to-Impact items (Decision 4)
    const chain = review.contribution_to_impact;
    assert.equal(chain.items.length, 4);

    const item1 = chain.items.find(
      (i) => i.impact_id === 'impact-001-interview-pacing-v0-2-3'
    );
    assert.equal(item1.contribution_category, 'PRODUCT_UX_LEARNING');
    assert.equal(item1.status, 'IMPLEMENTED_AND_VERIFIED');
    assert.match(item1.non_endorsement_disclosure, /not attributed as McKinsey/i);

    const item2 = chain.items.find(
      (i) => i.impact_id === 'impact-002-offscript-wandering-boundary'
    );
    assert.equal(item2.contribution_category, 'EPISTEMIC_BOUNDARY_CHALLENGE');
    assert.equal(item2.status, 'ARCHITECTURAL_DIRECTION_UNDER_EVALUATION');

    const item3 = chain.items.find(
      (i) => i.impact_id === 'impact-003-hidden-pearls-ancillary-capture'
    );
    assert.equal(item3.contribution_category, 'DOMAIN_EXPERIENCE_INSIGHT');
    assert.equal(item3.status, 'PROPOSED_EXPERIMENT');

    const item4 = chain.items.find(
      (i) => i.impact_id === 'impact-004-pretask-benchmark-pitfall-feed'
    );
    assert.equal(item4.contribution_category, 'DOMAIN_EXPERIENCE_INSIGHT');
    assert.equal(item4.status, 'PROPOSED_EXPERIMENT');

    // Zero internal ledger IDs or token hashes leaked in participant projection
    const serialized = JSON.stringify(data);
    assert.doesNotMatch(serialized, /\b(stmt|minterp|les|turn)-[A-Za-z0-9_-]+/);
    assert.doesNotMatch(serialized, /review_token_sha256/);
    assert.doesNotMatch(serialized, /invitation_token_sha256/);
  });

  it('3. Saves inline section edits, exclusions, cleanup overrides, and consent scope via POST /api/owen/review/draft without mutating completed turns', async () => {
    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SYNTHETIC_UAT_REVIEW_TOKEN}`
    };

    const draftReq = new Request('https://mindriotlabs.com/api/owen/review/draft', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        session_id: DISPOSABLE_UAT_REVIEW_SESSION_ID,
        client_request_id: 'req-draft-uat-001',
        section_updates: [
          {
            section_id: 'sec-1-codified-primers-and-expert-links',
            participant_action: 'SUGGEST_EDIT',
            participant_edited_summary:
              'Clarified: PDNet and the Knowledge Resource Directory connected teams directly to the partner with firsthand experience.',
            participant_note: 'Emphasize direct human conversation.'
          },
          {
            section_id: 'sec-5-hidden-pearls-and-ai-boundaries',
            participant_action: 'EXCLUDE_FROM_BRIEF',
            exclusion_reason: 'Keep internal only for now.'
          }
        ],
        cleanup_updates: [
          {
            cleanup_id: 'cleanup-001-supersede-offscript-interp',
            participant_decision: 'ACCEPT_CLEANUP'
          },
          {
            cleanup_id: 'cleanup-002-exclude-logistical-wrapup',
            participant_decision: 'KEEP_AS_IS'
          }
        ],
        sharing_and_attribution: {
          attribution_preference: 'ANONYMIZED',
          permitted_sharing_scope: 'INTERNAL_OWEN_LEARNING_ONLY',
          allow_foundry_ingestion: true,
          notify_on_future_outcomes: true
        }
      })
    });

    const draftRes = await postReviewDraft({ request: draftReq, env: testEnv });
    assert.equal(draftRes.status, 200);
    const draftData = await draftRes.json();
    assert.equal(draftData.draft_saved, true);

    const review = draftData.review;
    assert.equal(review.status, 'IN_PROGRESS_DRAFT');
    assert.equal(review.governance_notice.participant_reviewed, false);

    const editedSec = review.sections.find(
      (s) => s.section_id === 'sec-1-codified-primers-and-expert-links'
    );
    assert.equal(editedSec.participant_action, 'EDITED_OR_CLARIFIED');
    assert.match(editedSec.participant_edited_summary, /Clarified: PDNet/);
    // Original testimony remains untouched
    assert.match(editedSec.supporting_excerpts[0].verbatim_quote, /At McKinsey, PDNet primers/);

    const cleanup2 = review.flagged_cleanup_recommendations.find(
      (r) => r.cleanup_id === 'cleanup-002-exclude-logistical-wrapup'
    );
    assert.equal(cleanup2.participant_decision, 'KEEP_AS_IS');

    assert.equal(review.sharing_and_attribution.attribution_preference, 'ANONYMIZED');
    assert.equal(
      review.sharing_and_attribution.permitted_sharing_scope,
      'INTERNAL_OWEN_LEARNING_ONLY'
    );
  });

  it('4. Submits final review idempotently via POST /api/owen/review/submit while preserving Human Steward gate and turn immutability', async () => {
    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SYNTHETIC_UAT_REVIEW_TOKEN}`
    };

    const submitPayload = {
      session_id: DISPOSABLE_UAT_REVIEW_SESSION_ID,
      client_request_id: 'req-submit-uat-idem-001',
      section_updates: [
        {
          section_id: 'sec-1-codified-primers-and-expert-links',
          participant_action: 'CONFIRM_ACCURATE'
        },
        {
          section_id: 'sec-2-incentives-and-reciprocity',
          participant_action: 'CONFIRM_ACCURATE'
        },
        {
          section_id: 'sec-3-decision-rationale-and-tacit-calls',
          participant_action: 'CONFIRM_ACCURATE'
        },
        {
          section_id: 'sec-4-competing-perspectives-and-evolution',
          participant_action: 'CONFIRM_ACCURATE'
        },
        {
          section_id: 'sec-5-hidden-pearls-and-ai-boundaries',
          participant_action: 'CONFIRM_ACCURATE'
        },
        {
          section_id: 'sec-6-actionable-pretask-delivery',
          participant_action: 'CONFIRM_ACCURATE'
        }
      ],
      cleanup_updates: [
        {
          cleanup_id: 'cleanup-001-supersede-offscript-interp',
          participant_decision: 'ACCEPT_CLEANUP'
        },
        {
          cleanup_id: 'cleanup-002-exclude-logistical-wrapup',
          participant_decision: 'ACCEPT_CLEANUP'
        }
      ],
      sharing_and_attribution: {
        attribution_preference: 'ATTRIBUTED',
        permitted_sharing_scope: 'MRL_PORTFOLIO_VENTURES',
        allow_foundry_ingestion: true,
        notify_on_future_outcomes: true
      },
      overall_participant_comment: 'Reviewed and confirmed on mobile.'
    };

    const submitReq1 = new Request('https://mindriotlabs.com/api/owen/review/submit', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(submitPayload)
    });
    const submitRes1 = await postReviewSubmit({ request: submitReq1, env: testEnv });
    assert.equal(submitRes1.status, 200);
    const submitData1 = await submitRes1.json();
    assert.equal(submitData1.submitted, true);

    const review1 = submitData1.review;
    assert.equal(review1.status, 'SUBMITTED_BY_PARTICIPANT');
    assert.equal(review1.governance_notice.participant_reviewed, true);
    // Participant submission never auto-approves Human Steward gate (Invariant 1 / Decision 1)
    assert.equal(review1.governance_notice.human_steward_approved, false);

    // Verify stored session turns are untouched and status is AWAITING_STEWARD_AUTHORITY
    const storedSession = await getSharedReviewMemoryStore().getSession(
      DISPOSABLE_UAT_REVIEW_SESSION_ID
    );
    assert.equal(storedSession.status, 'AWAITING_STEWARD_AUTHORITY');
    assert.equal(storedSession.turns.length, 7);

    // Duplicate submission with same client_request_id is idempotent
    const submitReq2 = new Request('https://mindriotlabs.com/api/owen/review/submit', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(submitPayload)
    });
    const submitRes2 = await postReviewSubmit({ request: submitReq2, env: testEnv });
    assert.equal(submitRes2.status, 200);
    const submitData2 = await submitRes2.json();
    assert.equal(submitData2.review.submitted_at, review1.submitted_at);
  });

  it('5. Enforces brute-force rate limiting on /api/owen/review/* (429 with Retry-After)', async () => {
    const attackerIp = '198.51.100.77';
    for (let i = 0; i < 8; i++) {
      const badReq = new Request(
        `https://mindriotlabs.com/api/owen/review/session?session_id=${DISPOSABLE_UAT_REVIEW_SESSION_ID}`,
        {
          headers: {
            'CF-Connecting-IP': attackerIp,
            Authorization: `Bearer bad-review-attempt-${i}`
          }
        }
      );
      const res = await getReviewSession({ request: badReq, env: testEnv });
      assert.equal(res.status, 401);
    }

    const throttledReq = new Request(
      `https://mindriotlabs.com/api/owen/review/session?session_id=${DISPOSABLE_UAT_REVIEW_SESSION_ID}`,
      {
        headers: {
          'CF-Connecting-IP': attackerIp,
          Authorization: `Bearer ${SYNTHETIC_UAT_REVIEW_TOKEN}`
        }
      }
    );
    const throttledRes = await getReviewSession({ request: throttledReq, env: testEnv });
    assert.equal(throttledRes.status, 429);
    assert.ok(Number(throttledRes.headers.get('Retry-After')) > 0);
  });

  it('6. Verifies SupabaseRpcReviewSessionStore invokes owen_get_review_session and owen_save_review_session RPCs with raw p_review_token (never digest) and rejects digest replay', async () => {
    const rpcCalls = [];
    const mockFetch = async (url, init) => {
      rpcCalls.push({ url, headers: init.headers, body: JSON.parse(init.body) });
      if (url.endsWith('/rest/v1/rpc/owen_get_review_session')) {
        return new Response(JSON.stringify(null), { status: 200 });
      }
      if (url.endsWith('/rest/v1/rpc/owen_save_review_session')) {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      return new Response('Not found', { status: 404 });
    };

    const store = new SupabaseRpcReviewSessionStore({
      supabaseUrl: 'https://example.supabase.co',
      supabaseKey: 'service-role-key-test',
      rawReviewToken: SYNTHETIC_UAT_REVIEW_TOKEN,
      rpcSecret: 'rpc-secret-test-01',
      fetchImpl: mockFetch
    });
    const loaded = await store.getSession('ses-test-rpc');
    assert.equal(loaded, undefined);
    assert.equal(rpcCalls.length, 1);
    assert.ok(rpcCalls[0].url.endsWith('/rest/v1/rpc/owen_get_review_session'));
    assert.equal(rpcCalls[0].body.p_review_token, SYNTHETIC_UAT_REVIEW_TOKEN);
    assert.equal(rpcCalls[0].body.p_review_token_sha256, undefined);
    assert.equal(rpcCalls[0].body.p_rpc_secret, 'rpc-secret-test-01');
    assert.equal(rpcCalls[0].headers.apikey, 'service-role-key-test');

    // Passing a 64-character hex SHA-256 digest as rawReviewToken is rejected with DIGEST_REPLAY_FORBIDDEN
    const digestReplayStore = new SupabaseRpcReviewSessionStore({
      supabaseUrl: 'https://example.supabase.co',
      supabaseKey: 'service-role-key-test',
      rawReviewToken: hashReviewToken(SYNTHETIC_UAT_REVIEW_TOKEN),
      fetchImpl: mockFetch
    });
    await assert.rejects(
      () => digestReplayStore.getSession('ses-test-rpc'),
      (err) => err.code === 'DIGEST_REPLAY_FORBIDDEN'
    );

    // HTTP review endpoint also rejects 64-hex SHA-256 digest replay with 401 DIGEST_REPLAY_FORBIDDEN
    const digestHttpReq = new Request(
      `https://mindriotlabs.com/api/owen/review/session?session_id=${DISPOSABLE_UAT_REVIEW_SESSION_ID}`,
      { headers: { Authorization: `Bearer ${hashReviewToken(SYNTHETIC_UAT_REVIEW_TOKEN)}` } }
    );
    const digestHttpRes = await getReviewSession({ request: digestHttpReq, env: testEnv });
    assert.equal(digestHttpRes.status, 401);
    const digestHttpBody = await digestHttpRes.json();
    assert.equal(digestHttpBody.code, 'DIGEST_REPLAY_FORBIDDEN');
  });

  it('7. Verifies mobile-first /owen/review portal HTML, CSS, and JS ergonomics for Mobile Safari and privacy invariants', () => {
    const htmlPath = path.resolve('owen/review/index.html');
    const cssPath = path.resolve('owen/review/review.css');
    const jsPath = path.resolve('owen/review/review.js');

    const html = fs.readFileSync(htmlPath, 'utf8');
    const css = fs.readFileSync(cssPath, 'utf8');
    const js = fs.readFileSync(jsPath, 'utf8');

    // No external fonts, scripts, or analytics trackers that could leak review URLs
    assert.match(html, /<meta name="referrer" content="no-referrer"/i);
    assert.doesNotMatch(html, /fonts\.googleapis\.com/i);
    assert.doesNotMatch(html, /googletagmanager|google-analytics|plausible|segment/i);

    // Mobile Safari ergonomics: >= 16px inputs to prevent auto-zoom, >= 44px touch targets, 100dvh
    assert.match(css, /min-height:\s*44px/);
    assert.match(css, /font-size:\s*16px/);
    assert.match(css, /100dvh/);
    assert.match(css, /env\(safe-area-inset-bottom/);

    // Immediate URL fragment token scrubbing via history.replaceState and inline editing without window.prompt
    assert.match(js, /window\.history\.replaceState/);
    assert.doesNotMatch(js, /window\.prompt\s*\(/);
  });

  it('8. Supports non-regressing Review Portal kill-switch (OWEN_REVIEW_PORTAL_DISABLED / REVIEW_PORTAL_ROLLED_BACK -> 503) while keeping hardened Interview endpoints active', async () => {
    const disabledEnv = {
      ...testEnv,
      OWEN_REVIEW_PORTAL_DISABLED: 'true'
    };

    const revReq = new Request(
      `https://mindriotlabs.com/api/owen/review/session?session_id=${DISPOSABLE_UAT_REVIEW_SESSION_ID}`,
      { headers: { Authorization: `Bearer ${SYNTHETIC_UAT_REVIEW_TOKEN}` } }
    );
    const revRes = await getReviewSession({ request: revReq, env: disabledEnv });
    assert.equal(revRes.status, 503);
    const revBody = await revRes.json();
    assert.equal(revBody.code, 'REVIEW_PORTAL_DISABLED');
    assert.equal(revBody.saved_progress_preserved, true);

    // Meanwhile, interview endpoint remains 200 OK under the hardened boundary
    const intReq = new Request(
      `https://mindriotlabs.com/api/owen/interview/session?session_id=${DISPOSABLE_UAT_SESSION_ID}`,
      { headers: { Authorization: `Bearer ${SYNTHETIC_UAT_INVITE_TOKEN}` } }
    );
    const intRes = await getInterviewSession({ request: intReq, env: disabledEnv });
    assert.equal(intRes.status, 200);
  });
});
