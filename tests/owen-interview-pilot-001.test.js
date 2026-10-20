import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as crypto from 'crypto';

import { onRequestGet as getSession } from '../functions/api/owen/interview/session.js';
import { onRequestPost as postConsent } from '../functions/api/owen/interview/consent.js';
import { onRequestPost as postTurn } from '../functions/api/owen/interview/turn.js';
import { onRequestGet as getBrief, onRequestPost as postBrief } from '../functions/api/owen/interview/brief.js';
import { onRequestPost as postReview } from '../functions/api/owen/interview/review.js';
import { onRequestPost as postWebhook } from '../functions/api/owen/interview/webhook.js';
import {
  onRequestGet as getVoiceSession,
  onRequestPost as postVoiceSession
} from '../functions/api/owen/interview/voice-session.js';
import {
  resetInterviewServiceForTests,
  SupabaseRpcInterviewSessionStore,
  DEFAULT_PILOT_001_SESSION_ID,
  DISPOSABLE_UAT_SESSION_ID
} from '../functions/api/owen/interview/service.js';

describe('MindRiotLabs /api/owen/interview/* Edge Functions Integration & Security Hardening Suite', () => {
  const SYNTHETIC_PILOT_TOKEN = 'pilot001_synthetic_test_token_a9f8e7d6c5b4a3';
  const SYNTHETIC_UAT_TOKEN = 'uat001_synthetic_test_token_11223344556677';
  const LEGACY_ROTATED_TOKEN = 'mrl-owen-russ-pilot-001-2026';

  const testEnv = {
    NODE_ENV: 'test',
    INTERVIEW_STORE: 'memory',
    OWEN_PILOT_001_INVITE_TOKEN: SYNTHETIC_PILOT_TOKEN,
    OWEN_UAT_DISPOSABLE_INVITE_TOKEN: SYNTHETIC_UAT_TOKEN,
    ELEVENLABS_API_KEY: 'el_test_key',
    ELEVENLABS_VOICE_ID: 'voice_jvh_existing',
    ELEVENLABS_WEBHOOK_SECRET: 'whsec_test_secret_001'
  };

  beforeEach(() => {
    resetInterviewServiceForTests();
  });

  it('1. Rejects unauthenticated, legacy default token, or URL query-string token across all endpoints (401)', async () => {
    const noTokenReq = new Request(
      `https://mindriotlabs.com/api/owen/interview/session?session_id=${DEFAULT_PILOT_001_SESSION_ID}`
    );
    const noTokenRes = await getSession({ request: noTokenReq, env: testEnv });
    assert.equal(noTokenRes.status, 401);
    assert.equal(noTokenRes.headers.get('Referrer-Policy'), 'no-referrer');
    assert.equal(noTokenRes.headers.get('X-Content-Type-Options'), 'nosniff');

    // Old default token must be rejected
    const legacyTokenReq = new Request(
      `https://mindriotlabs.com/api/owen/interview/session?session_id=${DEFAULT_PILOT_001_SESSION_ID}`,
      { headers: { Authorization: `Bearer ${LEGACY_ROTATED_TOKEN}` } }
    );
    const legacyTokenRes = await getSession({ request: legacyTokenReq, env: testEnv });
    assert.equal(legacyTokenRes.status, 401);

    // Token passed via URL query string (?token=...) must NOT be accepted by API endpoints
    const queryTokenReq = new Request(
      `https://mindriotlabs.com/api/owen/interview/session?session_id=${DEFAULT_PILOT_001_SESSION_ID}&token=${encodeURIComponent(SYNTHETIC_PILOT_TOKEN)}`
    );
    const queryTokenRes = await getSession({ request: queryTokenReq, env: testEnv });
    assert.equal(queryTokenRes.status, 401);

    // Fails closed if server environment secret is missing (no hardcoded fallback)
    const emptySecretEnv = { NODE_ENV: 'test', INTERVIEW_STORE: 'memory' };
    const missingEnvReq = new Request(
      `https://mindriotlabs.com/api/owen/interview/session?session_id=${DEFAULT_PILOT_001_SESSION_ID}`,
      { headers: { Authorization: `Bearer ${LEGACY_ROTATED_TOKEN}` } }
    );
    const missingEnvRes = await getSession({ request: missingEnvReq, env: emptySecretEnv });
    assert.equal(missingEnvRes.status, 401);

    // Verify all other endpoints (consent, turn, brief, review) reject unauthenticated calls with 401
    resetInterviewServiceForTests();
    for (const [handler, method, url] of [
      [postConsent, 'POST', 'https://mindriotlabs.com/api/owen/interview/consent'],
      [postTurn, 'POST', 'https://mindriotlabs.com/api/owen/interview/turn'],
      [getBrief, 'GET', 'https://mindriotlabs.com/api/owen/interview/brief'],
      [postBrief, 'POST', 'https://mindriotlabs.com/api/owen/interview/brief'],
      [postReview, 'POST', 'https://mindriotlabs.com/api/owen/interview/review']
    ]) {
      const req = new Request(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LEGACY_ROTATED_TOKEN}` },
        body: method === 'POST' ? JSON.stringify({ session_id: DEFAULT_PILOT_001_SESSION_ID }) : undefined
      });
      const res = await handler({ request: req, env: testEnv });
      assert.equal(res.status, 401, `Expected 401 on ${method} ${url}`);
    }
  });

  it('2. Enforces strict cross-session token isolation between Russ session and UAT disposable session', async () => {
    // UAT token cannot access Russ Richmond's session
    const crossReq1 = new Request(
      `https://mindriotlabs.com/api/owen/interview/session?session_id=${DEFAULT_PILOT_001_SESSION_ID}`,
      { headers: { Authorization: `Bearer ${SYNTHETIC_UAT_TOKEN}` } }
    );
    const crossRes1 = await getSession({ request: crossReq1, env: testEnv });
    assert.equal(crossRes1.status, 401);

    // Russ Pilot token cannot access UAT disposable session
    const crossReq2 = new Request(
      `https://mindriotlabs.com/api/owen/interview/session?session_id=${DISPOSABLE_UAT_SESSION_ID}`,
      { headers: { Authorization: `Bearer ${SYNTHETIC_PILOT_TOKEN}` } }
    );
    const crossRes2 = await getSession({ request: crossReq2, env: testEnv });
    assert.equal(crossRes2.status, 401);

    // UAT token CAN access UAT disposable session
    const validUatReq = new Request(
      `https://mindriotlabs.com/api/owen/interview/session?session_id=${DISPOSABLE_UAT_SESSION_ID}`,
      { headers: { Authorization: `Bearer ${SYNTHETIC_UAT_TOKEN}` } }
    );
    const validUatRes = await getSession({ request: validUatReq, env: testEnv });
    assert.equal(validUatRes.status, 200);
    const uatData = await validUatRes.json();
    assert.equal(uatData.session.id, DISPOSABLE_UAT_SESSION_ID);
    assert.equal(uatData.session.participant.actor_id, 'actor-uat-disposable-001');
  });

  it('3. Enforces server-side brute-force rate limiting (429 Too Many Requests with Retry-After)', async () => {
    const attackerIp = '203.0.113.99';
    for (let i = 0; i < 8; i++) {
      const badReq = new Request(
        `https://mindriotlabs.com/api/owen/interview/session?session_id=${DEFAULT_PILOT_001_SESSION_ID}`,
        {
          headers: {
            'CF-Connecting-IP': attackerIp,
            Authorization: `Bearer brute-force-attempt-${i}`
          }
        }
      );
      const res = await getSession({ request: badReq, env: testEnv });
      assert.equal(res.status, 401);
    }

    // 9th attempt from same IP is throttled with 429 + Retry-After header
    const throttledReq = new Request(
      `https://mindriotlabs.com/api/owen/interview/session?session_id=${DEFAULT_PILOT_001_SESSION_ID}`,
      {
        headers: {
          'CF-Connecting-IP': attackerIp,
          Authorization: `Bearer ${SYNTHETIC_PILOT_TOKEN}`
        }
      }
    );
    const throttledRes = await getSession({ request: throttledReq, env: testEnv });
    assert.equal(throttledRes.status, 429);
    assert.ok(Number(throttledRes.headers.get('Retry-After')) > 0);
    const throttledBody = await throttledRes.json();
    assert.equal(throttledBody.code, 'RATE_LIMITED');
  });

  it('4. Provisions Pilot 001 session on valid token, enforces consent gate, processes adaptive turns, and supports participant brief review', async () => {
    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SYNTHETIC_PILOT_TOKEN}`
    };

    // A. Load initial session
    const sessionReq = new Request(
      `https://mindriotlabs.com/api/owen/interview/session?session_id=${DEFAULT_PILOT_001_SESSION_ID}`,
      { headers: authHeaders }
    );
    const sessionRes = await getSession({ request: sessionReq, env: testEnv });
    assert.equal(sessionRes.status, 200);
    const sessionData = await sessionRes.json();
    assert.equal(sessionData.session.participant.name, 'Russ Richmond');
    assert.equal(sessionData.session.status, 'CONSENT_PENDING');
    // Ensure SHA-256 token hash is stripped from client response
    assert.equal(sessionData.session.access_control?.invitation_token_sha256, undefined);

    // B. Attempt turn before consent -> rejected with 403
    const earlyTurnReq = new Request('https://mindriotlabs.com/api/owen/interview/turn', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        session_id: DEFAULT_PILOT_001_SESSION_ID,
        participant_text: 'Trying to speak before consent'
      })
    });
    const earlyTurnRes = await postTurn({ request: earlyTurnReq, env: testEnv });
    assert.equal(earlyTurnRes.status, 403);

    // C. Grant explicit consent
    const consentReq = new Request('https://mindriotlabs.com/api/owen/interview/consent', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        session_id: DEFAULT_PILOT_001_SESSION_ID,
        transcript_capture_consented: true,
        audio_recording_consented: true,
        synthetic_voice_acknowledged: true,
        attribution_preference: 'ATTRIBUTED'
      })
    });
    const consentRes = await postConsent({ request: consentReq, env: testEnv });
    assert.equal(consentRes.status, 200);
    const consentData = await consentRes.json();
    assert.equal(consentData.session.status, 'IN_PROGRESS');
    assert.equal(consentData.session.turns.length, 1);

    // D. Submit adaptive turn
    const turnReq = new Request('https://mindriotlabs.com/api/owen/interview/turn', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        session_id: DEFAULT_PILOT_001_SESSION_ID,
        participant_text:
          'When I was at McKinsey, PDNet and the Knowledge Resource Directory were built to connect consultants with the partner or colleague who had firsthand experience on similar engagements.'
      })
    });
    const turnRes = await postTurn({ request: turnReq, env: testEnv });
    assert.equal(turnRes.status, 200);
    const turnData = await turnRes.json();
    assert.equal(turnData.session.turns.length, 3);
    assert.equal(turnData.session.epistemic_ledger.participant_statements.length, 1);
    assert.equal(turnData.session.epistemic_ledger.machine_interpretations.length, 1);

    // E. Generate Experience Brief
    const briefReq = new Request('https://mindriotlabs.com/api/owen/interview/brief', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ session_id: DEFAULT_PILOT_001_SESSION_ID })
    });
    const briefRes = await postBrief({ request: briefReq, env: testEnv });
    assert.equal(briefRes.status, 200);
    const briefData = await briefRes.json();
    assert.ok(briefData.experience_brief);
    assert.equal(
      briefData.experience_brief.review_and_publication_status.status,
      'DRAFT_PENDING_REVIEW'
    );

    const stmtId =
      briefData.experience_brief.direct_statements_and_evidence[0].statement_id;

    // F. Participant amends statement via /api/owen/interview/review
    const reviewReq = new Request('https://mindriotlabs.com/api/owen/interview/review', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        session_id: DEFAULT_PILOT_001_SESSION_ID,
        target_statement_id: stmtId,
        action: 'AMEND_STATEMENT',
        corrected_text:
          'PDNet and KRD served primarily as warm human pointers to experienced practitioners.',
        rationale: 'Refining wording for accuracy.'
      })
    });
    const reviewRes = await postReview({ request: reviewReq, env: testEnv });
    assert.equal(reviewRes.status, 200);
    const reviewData = await reviewRes.json();
    assert.equal(
      reviewData.experience_brief.review_and_publication_status.status,
      'PARTICIPANT_REVIEWED'
    );
    assert.equal(
      reviewData.experience_brief.direct_statements_and_evidence[0].corrected_text,
      'PDNet and KRD served primarily as warm human pointers to experienced practitioners.'
    );
  });

  it('5. Verifies ElevenLabs webhook HMAC signature and deduplicates repeated callbacks', async () => {
    const rawBody = JSON.stringify({
      event_id: 'evt_webhook_99',
      session_id: DEFAULT_PILOT_001_SESSION_ID
    });
    const timestamp = '1760965000';
    const validHmac = crypto
      .createHmac('sha256', testEnv.ELEVENLABS_WEBHOOK_SECRET)
      .update(`${timestamp}.${rawBody}`, 'utf8')
      .digest('hex');

    // Invalid signature -> 401
    const badReq = new Request('https://mindriotlabs.com/api/owen/interview/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ElevenLabs-Signature': `t=${timestamp},v0=bad_hmac`
      },
      body: rawBody
    });
    const badRes = await postWebhook({ request: badReq, env: testEnv });
    assert.equal(badRes.status, 401);

    // Valid signature -> 200
    const goodReq = new Request('https://mindriotlabs.com/api/owen/interview/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ElevenLabs-Signature': `t=${timestamp},v0=${validHmac}`
      },
      body: rawBody
    });
    const goodRes = await postWebhook({ request: goodReq, env: testEnv });
    assert.equal(goodRes.status, 200);

    // Duplicate callback -> 202
    const dupReq = new Request('https://mindriotlabs.com/api/owen/interview/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ElevenLabs-Signature': `t=${timestamp},v0=${validHmac}`
      },
      body: rawBody
    });
    const dupRes = await postWebhook({ request: dupReq, env: testEnv });
    assert.equal(dupRes.status, 202);
  });

  it('6. Verifies surgical release provenance, mindriotlabs-production target, and existing website isolation', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const { OWEN_BUILD_METADATA } = await import('@mrl/owen');

    // Verify canonical OWEN build provenance matches surgical release commit 6cf46d8ed21561e1b1bb924e7a9bd5ed8e2493df
    assert.equal(
      OWEN_BUILD_METADATA.canonical_commit_sha,
      '6cf46d8ed21561e1b1bb924e7a9bd5ed8e2493df'
    );
    assert.equal(OWEN_BUILD_METADATA.canonical_commit_short, '6cf46d8');

    const tarballPath = path.resolve(process.cwd(), 'packages/mrl-owen-0.1.0-6cf46d8.tgz');
    assert.equal(fs.existsSync(tarballPath), true);
    const actualSha256 = crypto
      .createHash('sha256')
      .update(fs.readFileSync(tarballPath))
      .digest('hex');
    assert.equal(
      actualSha256,
      '33d6a618ee80a0d07b12e4f87f9a293b872829d70034877239d26358d8edab0c'
    );

    // Verify wrangler.toml targets mindriotlabs-production
    const wranglerToml = fs.readFileSync(path.resolve(process.cwd(), 'wrangler.toml'), 'utf8');
    assert.match(wranglerToml, /name\s*=\s*"mindriotlabs-production"/);

    // Verify existing public website pages remain intact
    for (const relPath of [
      'index.html',
      'portfolio/index.html',
      'p/mudbowl/index.html',
      'c100/index.html',
      'max/satprep/index.html',
      'functions/api/contact.js'
    ]) {
      assert.equal(
        fs.existsSync(path.resolve(process.cwd(), relPath)),
        true,
        `Expected public site file ${relPath} to exist`
      );
    }

    // Verify unrelated Foundry HQ / Admin directories are absent from this surgical release
    for (const excludedPath of [
      'admin/foundry',
      'functions/admin/hq',
      'functions/api/foundry'
    ]) {
      assert.equal(
        fs.existsSync(path.resolve(process.cwd(), excludedPath)),
        false,
        `Expected unrelated path ${excludedPath} to be absent from surgical release`
      );
    }
  });

  it('7. Caches per-request Supabase reads, emits timing_metadata, and governs ElevenLabs voice-session endpoint', async () => {
    // 7a. Verify SupabaseRpcInterviewSessionStore performs only 1 RPC read across multiple getSession calls in a single request
    const origFetch = globalThis.fetch;
    let rpcGetCalls = 0;
    try {
      globalThis.fetch = async url => {
        if (String(url).includes('owen_get_interview_session')) {
          rpcGetCalls += 1;
          return new Response(JSON.stringify({ id: 'ses-cache-test', turns: [] }), { status: 200 });
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      };

      const rpcStore = new SupabaseRpcInterviewSessionStore({
        supabaseUrl: 'https://example.supabase.co',
        supabaseKey: 'anon_test',
        activeTokenSha256: 'sha256_test'
      });

      await rpcStore.getSession('ses-cache-test');
      await rpcStore.getSession('ses-cache-test');
      await rpcStore.getSession('ses-cache-test');
      assert.equal(rpcGetCalls, 1, 'Expected per-request cache to coalesce 3 reads into 1 RPC call');
      assert.equal(rpcStore.readCount, 1);
    } finally {
      globalThis.fetch = origFetch;
    }

    // 7b. Verify /api/owen/interview/turn returns timing_metadata and /api/owen/interview/voice-session enforces consent + no-cloning
    await postConsent({
      request: new Request('https://mindriotlabs.com/api/owen/interview/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SYNTHETIC_PILOT_TOKEN}`
        },
        body: JSON.stringify({
          session_id: DEFAULT_PILOT_001_SESSION_ID,
          transcript_capture_consented: true,
          audio_recording_consented: true,
          synthetic_voice_acknowledged: true,
          attribution_preference: 'ATTRIBUTED'
        })
      }),
      env: testEnv
    });

    const turnRes = await postTurn({
      request: new Request('https://mindriotlabs.com/api/owen/interview/turn', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SYNTHETIC_PILOT_TOKEN}`
        },
        body: JSON.stringify({
          session_id: DEFAULT_PILOT_001_SESSION_ID,
          participant_text: 'At McKinsey, practice directors curated PD documents and connected teams to experts.',
          control_action: 'RESPOND',
          provider_metadata: { client_request_id: 'req-idemp-test-01' }
        })
      }),
      env: testEnv
    });
    assert.equal(turnRes.status, 200);
    const turnBody = await turnRes.json();
    assert.ok(turnBody.timing_metadata);
    assert.equal(typeof turnBody.timing_metadata.total_ms, 'number');

    // Verify GET /api/owen/interview/voice-session returns OWEN dynamic agent override & allow_voice_cloning: false
    const voiceStatusRes = await getVoiceSession({
      request: new Request(
        `https://mindriotlabs.com/api/owen/interview/voice-session?session_id=${DEFAULT_PILOT_001_SESSION_ID}`,
        {
          headers: { Authorization: `Bearer ${SYNTHETIC_PILOT_TOKEN}` }
        }
      ),
      env: testEnv
    });
    assert.equal(voiceStatusRes.status, 200);
    const voiceStatusBody = await voiceStatusRes.json();
    assert.equal(voiceStatusBody.allow_voice_cloning, false);
    assert.equal(voiceStatusBody.consent_ready, true);
    assert.equal(
      voiceStatusBody.conversation_override.owen_governance.epistemic_layer_binding,
      'LAYER_1_VERBATIM_TRANSCRIPT_ONLY'
    );

    // Verify POST /api/owen/interview/voice-session reports REQUIRES_AGENT_ID when ELEVENLABS_AGENT_ID is not yet set
    const voiceInitRes = await postVoiceSession({
      request: new Request('https://mindriotlabs.com/api/owen/interview/voice-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SYNTHETIC_PILOT_TOKEN}`
        },
        body: JSON.stringify({ session_id: DEFAULT_PILOT_001_SESSION_ID })
      }),
      env: testEnv
    });
    assert.equal(voiceInitRes.status, 200);
    const voiceInitBody = await voiceInitRes.json();
    assert.equal(voiceInitBody.status, 'REQUIRES_AGENT_ID');
    assert.ok(voiceInitBody.missingConfiguration.includes('ELEVENLABS_AGENT_ID'));
  });
});

