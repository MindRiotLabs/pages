/**
 * MindRiot Labs — OWEN Human Steward Review Preview Client (v0.3.1)
 *
 * Primary authentication: Google Sign-In via Supabase Auth OAuth 2.0 Authorization Code + PKCE
 * (`/auth/v1/authorize?provider=google&code_challenge_method=S256` -> `POST /auth/v1/token?grant_type=pkce`),
 * calling the read-only server boundary `GET /api/owen/steward/review-preview` using
 * `Authorization: Bearer <access_token>`.
 *
 * Security & Governance Guarantees:
 * - Access tokens are never placed in URL query strings.
 * - Any `?code=...` PKCE authorization code or `#access_token=...` hash fragment is immediately
 *   scrubbed from the browser address bar via `history.replaceState`.
 * - Redirect URLs are validated against the server-approved environment allowlist before
 *   initiating OAuth.
 * - Strictly read-only inspection: zero participant impersonation, draft save,
 *   review submission, or publication approval controls exist on this surface.
 */

const PKCE_VERIFIER_STORAGE_KEY = 'owen_steward_pkce_code_verifier';
const PKCE_SESSION_STORAGE_KEY = 'owen_steward_pkce_target_session_id';

const state = {
  authConfig: null,
  accessToken: null,
  selectedSessionId: '',
  previewData: null
};

const el = (id) => document.getElementById(id);

function base64UrlEncode(uint8Array) {
  let binary = '';
  for (let i = 0; i < uint8Array.byteLength; i += 1) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function generatePkceVerifierAndChallenge() {
  const randomBytes = new Uint8Array(32);
  window.crypto.getRandomValues(randomBytes);
  const codeVerifier = base64UrlEncode(randomBytes);
  const encoder = new TextEncoder();
  const digestBuffer = await window.crypto.subtle.digest('SHA-256', encoder.encode(codeVerifier));
  const codeChallenge = base64UrlEncode(new Uint8Array(digestBuffer));
  return { codeVerifier, codeChallenge };
}

function extractAndScrubOauthCallbackParams() {
  const url = new URL(window.location.href);
  const authCode = url.searchParams.get('code');
  const errorCode = url.searchParams.get('error');
  const errorDesc = url.searchParams.get('error_description');

  if (authCode || errorCode || errorDesc) {
    url.searchParams.delete('code');
    url.searchParams.delete('error');
    url.searchParams.delete('error_code');
    url.searchParams.delete('error_description');
    const cleanSearch = url.searchParams.toString();
    const cleanUrl = url.pathname + (cleanSearch ? `?${cleanSearch}` : '');
    window.history.replaceState(null, document.title, cleanUrl);
  }

  return {
    authCode: authCode ? authCode.trim() : null,
    oauthError: errorDesc || errorCode || null
  };
}

function showError(message) {
  const box = el('stewardAuthErrorBox');
  if (!box) return;
  box.textContent = message || 'Authentication or authorization failed.';
  box.classList.remove('hidden');
}

function clearError() {
  const box = el('stewardAuthErrorBox');
  if (!box) return;
  box.textContent = '';
  box.classList.add('hidden');
}

function showNotice(message) {
  const box = el('stewardAuthNoticeBox');
  if (!box) return;
  box.textContent = message || '';
  box.classList.toggle('hidden', !message);
}

function createMetaCard(label, value) {
  const card = document.createElement('div');
  card.className = 'meta-kv-card';
  const lbl = document.createElement('div');
  lbl.className = 'meta-kv-label';
  lbl.textContent = label;
  const val = document.createElement('div');
  val.className = 'meta-kv-value';
  val.textContent = value ?? '—';
  card.append(lbl, val);
  return card;
}

function createDigestCard(label, hashValue) {
  const card = document.createElement('div');
  card.className = 'digest-card';
  const lbl = document.createElement('div');
  lbl.className = 'digest-label';
  lbl.textContent = label;
  const val = document.createElement('div');
  val.className = 'digest-hash';
  val.textContent = hashValue || 'NULL';
  card.append(lbl, val);
  return card;
}

function extractHashAccessToken() {
  const rawHash = window.location.hash ? window.location.hash.slice(1) : '';
  if (!rawHash) return null;
  const params = new URLSearchParams(rawHash);
  const token = params.get('access_token');
  if (token) {
    window.history.replaceState(null, document.title, window.location.pathname + window.location.search);
    return token.trim();
  }
  return null;
}

function getEffectiveSessionId() {
  const customVal = (el('customSessionIdInput')?.value || '').trim();
  if (customVal) return customVal;
  const selectVal = (el('sessionSelectInput')?.value || '').trim();
  if (selectVal) return selectVal;
  return state.selectedSessionId || state.authConfig?.default_session_id || 'ses-uat-steward-preview-001';
}

function populateSessionSelectors(availableSessions = [], defaultSessionId = '') {
  const selects = [el('sessionSelectInput'), el('workspaceSessionSelect')].filter(Boolean);
  for (const sel of selects) {
    sel.innerHTML = '';
    for (const item of availableSessions) {
      const opt = document.createElement('option');
      opt.value = item.session_id;
      opt.textContent = item.label || item.session_id;
      if (item.session_id === defaultSessionId) {
        opt.selected = true;
      }
      sel.appendChild(opt);
    }
  }
  state.selectedSessionId = defaultSessionId;
}

async function loadAuthConfig() {
  const redirectCandidate = `${window.location.origin}/owen/steward/review`;
  const res = await fetch(
    `/api/owen/steward/auth-config?redirect_to=${encodeURIComponent(redirectCandidate)}`,
    {
      method: 'GET',
      headers: { Accept: 'application/json' }
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to load Steward Auth configuration (${res.status}).`);
  }
  const cfg = await res.json();
  state.authConfig = cfg;

  const envBadge = el('stewardEnvBadge');
  if (envBadge) {
    envBadge.textContent = `Environment: ${String(cfg.environment || 'unknown').toUpperCase()}`;
  }

  const googleBadge = el('googleProviderStatusBadge');
  if (googleBadge) {
    if (cfg.google_oauth_provider_enabled === true) {
      googleBadge.className = 'steward-badge badge-safe';
      googleBadge.textContent = 'Google OAuth Provider: ENABLED (PKCE S256)';
    } else if (cfg.google_oauth_provider_enabled === false) {
      googleBadge.className = 'steward-badge badge-warn';
      googleBadge.textContent = 'Google OAuth Provider: PENDING SUPABASE DASHBOARD ENABLE';
    } else {
      googleBadge.className = 'steward-badge';
      googleBadge.textContent = 'Google OAuth Provider: PKCE S256 Ready';
    }
  }

  const urlParams = new URLSearchParams(window.location.search);
  const storedPkceSession = window.sessionStorage.getItem(PKCE_SESSION_STORAGE_KEY) || '';
  const requestedSession = (urlParams.get('session_id') || storedPkceSession || '').trim();
  const initialSession = requestedSession || cfg.default_session_id;

  populateSessionSelectors(cfg.available_sessions || [], initialSession);
  if (requestedSession && el('customSessionIdInput')) {
    const inList = (cfg.available_sessions || []).some((s) => s.session_id === requestedSession);
    if (!inList) {
      el('customSessionIdInput').value = requestedSession;
    }
  }
}

async function startGoogleOauthPkceFlow() {
  if (!state.authConfig?.supabase_url || !state.authConfig?.supabase_anon_key) {
    throw new Error('Supabase Auth configuration is not loaded.');
  }

  const redirectTo = `${window.location.origin}/owen/steward/review`;
  const allowedList = Array.isArray(state.authConfig.allowed_redirect_urls)
    ? state.authConfig.allowed_redirect_urls
    : [];
  const isAllowed = allowedList.some((allowed) => {
    try {
      const a = new URL(allowed);
      const r = new URL(redirectTo);
      if (a.hostname === 'mindriotlabs-staging.pages.dev') {
        return (
          r.protocol === 'https:' &&
          r.pathname === '/owen/steward/review' &&
          (r.hostname === a.hostname || r.hostname.endsWith('.mindriotlabs-staging.pages.dev'))
        );
      }
      return a.origin === r.origin && a.pathname === r.pathname;
    } catch (_err) {
      return false;
    }
  });

  if (!isAllowed) {
    throw new Error(
      `Current redirect URL (${redirectTo}) is not in the approved Steward Preview redirect allowlist [UNTRUSTED_REDIRECT_ORIGIN_FORBIDDEN].`
    );
  }

  if (state.authConfig.google_oauth_provider_enabled === false) {
    throw new Error(
      'Google OAuth provider is currently disabled in Supabase Auth settings (external.google = false). Complete the Google OAuth Client ID/Secret setup in Supabase Dashboard to enable live browser redirect.'
    );
  }

  const { codeVerifier, codeChallenge } = await generatePkceVerifierAndChallenge();
  window.sessionStorage.setItem(PKCE_VERIFIER_STORAGE_KEY, codeVerifier);
  window.sessionStorage.setItem(PKCE_SESSION_STORAGE_KEY, getEffectiveSessionId());

  const authorizeUrl = new URL(`${state.authConfig.supabase_url}/auth/v1/authorize`);
  authorizeUrl.searchParams.set('provider', 'google');
  authorizeUrl.searchParams.set('redirect_to', redirectTo);
  authorizeUrl.searchParams.set('code_challenge', codeChallenge);
  authorizeUrl.searchParams.set('code_challenge_method', 'S256');
  authorizeUrl.searchParams.set('prompt', 'select_account');

  window.location.assign(authorizeUrl.toString());
}

async function exchangePkceAuthorizationCode(authCode) {
  if (!state.authConfig?.supabase_url || !state.authConfig?.supabase_anon_key) {
    throw new Error('Supabase Auth configuration is not loaded.');
  }
  const codeVerifier = window.sessionStorage.getItem(PKCE_VERIFIER_STORAGE_KEY);
  window.sessionStorage.removeItem(PKCE_VERIFIER_STORAGE_KEY);

  if (!codeVerifier) {
    throw new Error(
      'Missing PKCE code_verifier in browser sessionStorage. Please initiate Google Sign-In again from this tab.'
    );
  }

  const res = await fetch(
    `${state.authConfig.supabase_url}/auth/v1/token?grant_type=pkce`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: state.authConfig.supabase_anon_key
      },
      body: JSON.stringify({
        auth_code: authCode,
        code_verifier: codeVerifier
      })
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(
      data.msg ||
        data.error_description ||
        data.error ||
        'Google OAuth PKCE authorization code exchange failed.'
    );
  }
  return data.access_token;
}

async function signInWithPassword(email, password) {
  if (!state.authConfig?.supabase_url || !state.authConfig?.supabase_anon_key) {
    throw new Error('Supabase Auth configuration is not loaded.');
  }
  const res = await fetch(
    `${state.authConfig.supabase_url}/auth/v1/token?grant_type=password`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: state.authConfig.supabase_anon_key
      },
      body: JSON.stringify({ email, password })
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(
      data.msg ||
        data.error_description ||
        data.error ||
        'Supabase Auth password sign-in failed.'
    );
  }
  return data.access_token;
}

async function sendMagicLinkOrOtp(email) {
  if (!state.authConfig?.supabase_url || !state.authConfig?.supabase_anon_key) {
    throw new Error('Supabase Auth configuration is not loaded.');
  }
  const redirectUrl = `${window.location.origin}/owen/steward/review`;
  const res = await fetch(
    `${state.authConfig.supabase_url}/auth/v1/otp?redirect_to=${encodeURIComponent(redirectUrl)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: state.authConfig.supabase_anon_key
      },
      body: JSON.stringify({
        email,
        create_user: false
      })
    }
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      data.msg ||
        data.error_description ||
        data.error ||
        'Unable to send Supabase Auth email verification code.'
    );
  }
}

async function verifyOtpCode(email, token) {
  if (!state.authConfig?.supabase_url || !state.authConfig?.supabase_anon_key) {
    throw new Error('Supabase Auth configuration is not loaded.');
  }
  const res = await fetch(`${state.authConfig.supabase_url}/auth/v1/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: state.authConfig.supabase_anon_key
    },
    body: JSON.stringify({
      type: 'email',
      email,
      token
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(
      data.msg ||
        data.error_description ||
        data.error ||
        'Invalid or expired one-time verification code.'
    );
  }
  return data.access_token;
}

async function fetchStewardReviewPreview(sessionId) {
  if (!state.accessToken) {
    throw new Error('Steward authentication token is required.');
  }
  const res = await fetch(
    `/api/owen/steward/review-preview?session_id=${encodeURIComponent(sessionId)}`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${state.accessToken}`,
        'x-steward-redirect-origin': window.location.origin
      }
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.steward_preview) {
    const codeSuffix = data.code ? ` [${data.code}]` : '';
    const auditSuffix = data.audit_id ? ` (Audit ID: ${data.audit_id})` : '';
    throw new Error(
      `${data.error || 'Steward Review Preview request failed.'}${codeSuffix}${auditSuffix}`
    );
  }
  return data.steward_preview;
}

function renderStewardWorkspace(preview) {
  state.previewData = preview;

  el('stewardAuthGatePanel')?.classList.add('hidden');
  el('stewardWorkspace')?.classList.remove('hidden');
  el('signOutBtn')?.classList.remove('hidden');

  const authBadge = el('stewardAuthBadge');
  if (authBadge) {
    authBadge.textContent = `Steward Verified: ${preview.steward_identity?.actor_name || preview.steward_identity?.actor_id} (${preview.steward_identity?.project_role})`;
  }

  const headerTitle = el('headerSessionTitle');
  if (headerTitle) {
    headerTitle.textContent = preview.session_summary?.title || 'Human Steward Review Preview';
  }

  // 1. Provenance & Digests
  const idGrid = el('stewardIdentityGrid');
  if (idGrid) {
    idGrid.innerHTML = '';
    const st = preview.steward_identity || {};
    const sum = preview.session_summary || {};
    const aud = preview.audit_receipt || {};
    idGrid.append(
      createMetaCard('Steward Actor ID', `${st.actor_name || ''} (${st.actor_id || ''})`),
      createMetaCard('Verified Auth Email', st.bound_email || '—'),
      createMetaCard(
        'Verified OAuth Provider',
        `${st.verified_auth_provider || '—'} (Required: ${st.required_auth_provider || 'google'})`
      ),
      createMetaCard(
        'Superadmin & Project Role',
        `Superadmin: ${String(Boolean(st.is_superadmin)).toUpperCase()} · ${sum.project_id || ''} (${st.project_role || ''})`
      ),
      createMetaCard('Auth Binding ID', st.binding_id || '—'),
      createMetaCard('Target Session ID & Status', `${sum.session_id || ''} (${sum.status || ''})`),
      createMetaCard('Append-Only Audit Receipt', `${aud.audit_id || ''} @ ${aud.audited_at || ''}`)
    );
  }

  const digestGrid = el('evidenceDigestGrid');
  if (digestGrid) {
    digestGrid.innerHTML = '';
    const d = preview.evidence_digests || {};
    digestGrid.append(
      createDigestCard(`turns_sha256 (${d.turns_count ?? 0} turns)`, d.turns_sha256),
      createDigestCard('participant_statements_sha256', d.participant_statements_sha256),
      createDigestCard('machine_interpretations_sha256', d.machine_interpretations_sha256),
      createDigestCard('epistemic_ledger_sha256', d.epistemic_ledger_sha256),
      createDigestCard('experience_brief_sha256', d.experience_brief_sha256),
      createDigestCard('session_updated_at (Unmodified)', d.session_updated_at)
    );
  }

  // 2. View 1: Proposed Participant Review Package
  const pkg = preview.proposed_review_package || {};
  const welcome = pkg.welcome_context || {};
  if (el('previewWelcomeTitle')) {
    el('previewWelcomeTitle').textContent =
      welcome.interview_title || preview.session_summary?.title || 'Proposed Participant Review Package';
  }
  if (el('previewWelcomeMessage')) {
    el('previewWelcomeMessage').textContent = welcome.welcome_message || '';
  }
  if (el('previewEpistemicDisclosure')) {
    el('previewEpistemicDisclosure').textContent = welcome.epistemic_boundary_disclosure || '';
  }

  const badgesBox = el('synthesisStateBadges');
  if (badgesBox) {
    badgesBox.innerHTML = '';
    const g = preview.governance_guarantees || {};
    const b1 = document.createElement('span');
    b1.className = 'steward-badge badge-safe';
    b1.textContent = g.was_dynamically_synthesized
      ? 'Dynamically Synthesized In-Memory (Unprovisioned Session)'
      : 'Loaded Existing Review Package (Read-Only)';
    const b2 = document.createElement('span');
    b2.className = 'steward-badge badge-warn';
    b2.textContent = g.participant_review_token_provisioned
      ? 'Participant Review Credential Exists (Hash Stripped)'
      : 'No Participant Review Token Provisioned';
    const b3 = document.createElement('span');
    b3.className = 'steward-badge badge-safe';
    b3.textContent = 'Source Session Mutated: FALSE';
    badgesBox.append(b1, b2, b3);
  }

  const sectionsContainer = el('previewSectionsContainer');
  if (sectionsContainer) {
    sectionsContainer.innerHTML = '';
    for (const sec of pkg.sections || []) {
      const card = document.createElement('article');
      card.className = 'ledger-card';

      const header = document.createElement('div');
      header.className = 'ledger-card-header';
      const title = document.createElement('h3');
      title.className = 'section-card-title';
      title.textContent = sec.title;
      const badge = document.createElement('span');
      badge.className = 'steward-badge';
      badge.textContent = `${sec.theme_tag || 'Theme'} · Action: ${sec.participant_action || 'UNREVIEWED'}`;
      header.append(title, badge);

      const summary = document.createElement('p');
      summary.className = 'turn-text';
      summary.textContent = sec.concise_summary || '';

      const ul = document.createElement('ul');
      ul.style.marginTop = '0.6rem';
      for (const kp of sec.key_points || []) {
        const li = document.createElement('li');
        li.textContent = kp;
        ul.appendChild(li);
      }

      const details = document.createElement('details');
      details.style.marginTop = '0.75rem';
      details.open = true;
      const sumEl = document.createElement('summary');
      sumEl.className = 'digest-summary-toggle';
      sumEl.textContent = `Supporting Verbatim Excerpts (${(sec.supporting_excerpts || []).length})`;
      details.appendChild(sumEl);

      for (const ex of sec.supporting_excerpts || []) {
        const quoteBox = document.createElement('blockquote');
        quoteBox.className = 'governance-callout';
        quoteBox.style.marginTop = '0.5rem';
        const qText = document.createElement('p');
        qText.textContent = `"${ex.verbatim_quote || ''}"`;
        quoteBox.appendChild(qText);
        if (ex.transcription_artifact_note) {
          const note = document.createElement('div');
          note.style.marginTop = '0.35rem';
          note.style.fontSize = '0.82rem';
          note.style.color = '#fde68a';
          note.textContent = ex.transcription_artifact_note;
          quoteBox.appendChild(note);
        }
        details.appendChild(quoteBox);
      }

      card.append(header, summary, ul, details);
      sectionsContainer.appendChild(card);
    }
  }

  const cleanupsContainer = el('previewCleanupsContainer');
  if (cleanupsContainer) {
    cleanupsContainer.innerHTML = '';
    for (const c of pkg.flagged_cleanup_recommendations || []) {
      const card = document.createElement('article');
      card.className = 'ledger-card';
      const header = document.createElement('div');
      header.className = 'ledger-card-header';
      const title = document.createElement('h3');
      title.className = 'section-card-title';
      title.textContent = c.title;
      const pill = document.createElement('span');
      pill.className = 'steward-badge badge-warn';
      pill.textContent = `UI Preselected: ${Boolean(c.default_ui_preselected)} · Server Decision: ${c.participant_decision}`;
      header.append(title, pill);

      const whatP = document.createElement('p');
      whatP.className = 'turn-text';
      whatP.textContent = `What Happened: ${c.what_happened || ''}`;
      const actionP = document.createElement('p');
      actionP.className = 'turn-text';
      actionP.style.color = '#93c5fd';
      actionP.textContent = `Proposed Action: ${c.proposed_cleanup_action || ''}`;
      card.append(header, whatP, actionP);
      cleanupsContainer.appendChild(card);
    }
  }

  const lessonsContainer = el('previewCandidateLessonsContainer');
  if (lessonsContainer) {
    lessonsContainer.innerHTML = '';
    for (const l of pkg.candidate_lessons || []) {
      const card = document.createElement('article');
      card.className = 'ledger-card';
      const header = document.createElement('div');
      header.className = 'ledger-card-header';
      const title = document.createElement('h3');
      title.className = 'section-card-title';
      title.textContent = `${l.title} (${l.author_origin})`;
      const pill = document.createElement('span');
      pill.className = 'steward-badge';
      pill.textContent = `Confidence: ${l.confidence} · Feedback: ${l.participant_feedback}`;
      header.append(title, pill);

      const p1 = document.createElement('p');
      p1.className = 'turn-text';
      p1.textContent = `OWEN Interpretation: ${l.owen_interpretation || ''}`;
      const p2 = document.createElement('p');
      p2.className = 'turn-text';
      p2.style.color = '#a7f3d0';
      p2.textContent = `Proposed Architectural Implication: ${l.proposed_architectural_implication || ''}`;
      card.append(header, p1, p2);
      lessonsContainer.appendChild(card);
    }
  }

  const attrContainer = el('previewAttributionContainer');
  if (attrContainer) {
    attrContainer.innerHTML = '';
    const sa = pkg.sharing_and_attribution || {};
    const sg = pkg.steward_gate_status || {};
    attrContainer.append(
      createMetaCard('Attribution Preference', sa.attribution_preference || 'ATTRIBUTED'),
      createMetaCard('Permitted Sharing Scope', sa.permitted_sharing_scope || 'INTERNAL_OWEN_LEARNING_ONLY'),
      createMetaCard('Allow Foundry Ingestion', String(Boolean(sa.allow_foundry_ingestion))),
      createMetaCard('Notify on Future Outcomes', String(Boolean(sa.notify_on_future_outcomes))),
      createMetaCard('Steward Approved for Publication', String(Boolean(sg.steward_approved))),
      createMetaCard('Propagation Scope', sg.propagation_scope || 'project_only')
    );
  }

  // 3. View 2: Contribution-to-Impact Chain
  const chain = preview.contribution_to_impact_chain || {};
  if (el('previewImpactSummary')) {
    el('previewImpactSummary').textContent =
      chain.introduction || chain.thank_you_summary || '';
  }
  if (el('previewImpactDisclosure')) {
    el('previewImpactDisclosure').textContent =
      chain.non_endorsement_boundary_notice || chain.non_endorsement_disclosure || '';
  }
  const impactContainer = el('previewImpactItemsContainer');
  if (impactContainer) {
    impactContainer.innerHTML = '';
    for (const item of chain.items || []) {
      const card = document.createElement('article');
      card.className = 'ledger-card';
      const header = document.createElement('div');
      header.className = 'ledger-card-header';
      const title = document.createElement('h3');
      title.className = 'section-card-title';
      title.textContent = item.title;
      const badge = document.createElement('span');
      badge.className = 'steward-badge badge-safe';
      badge.textContent = `${item.status_badge_label || item.status || item.current_stage || ''} · ${item.contribution_category_label || item.contribution_category || ''}`;
      header.append(title, badge);

      const pShared = document.createElement('p');
      pShared.className = 'turn-text';
      pShared.textContent = `Human Observation: ${item.human_observation_summary || item.what_you_shared || ''}`;
      const pLearned = document.createElement('p');
      pLearned.className = 'turn-text';
      pLearned.textContent = `Proposed Organizational Lesson: ${item.proposed_organizational_lesson || item.what_owen_learned || ''}`;
      const pDecision = document.createElement('p');
      pDecision.className = 'turn-text';
      pDecision.textContent = `Human Steward Decision: ${item.human_decision_summary || ''}`;
      const pAction = document.createElement('p');
      pAction.className = 'turn-text';
      pAction.style.color = '#93c5fd';
      pAction.textContent = `Implementation / Experiment Status: ${item.experiment_or_implementation_summary || item.architectural_change_or_action || ''}`;
      const pDisclosure = document.createElement('p');
      pDisclosure.className = 'turn-text';
      pDisclosure.style.fontSize = '0.82rem';
      pDisclosure.style.color = '#fde68a';
      pDisclosure.textContent = `Non-Endorsement Boundary: ${item.non_endorsement_disclosure || ''}`;
      card.append(header, pShared, pLearned, pDecision, pAction, pDisclosure);
      impactContainer.appendChild(card);
    }
  }

  // 4. View 3: Epistemic Ledger, Disputed Claims & Uncertainties
  const epi = preview.epistemic_inspection || {};
  const unc = epi.uncertainties_and_followups || {};
  const uncContainer = el('previewUncertaintiesContainer');
  if (uncContainer) {
    uncContainer.innerHTML = '';
    const buildListCard = (heading, items) => {
      const card = document.createElement('article');
      card.className = 'ledger-card';
      const h = document.createElement('h3');
      h.className = 'section-card-title';
      h.textContent = heading;
      const ul = document.createElement('ul');
      ul.style.marginTop = '0.5rem';
      const arr = Array.isArray(items) ? items : [];
      if (arr.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'None recorded.';
        ul.appendChild(li);
      } else {
        for (const entry of arr) {
          const li = document.createElement('li');
          li.textContent = typeof entry === 'string' ? entry : JSON.stringify(entry);
          ul.appendChild(li);
        }
      }
      card.append(h, ul);
      return card;
    };
    uncContainer.append(
      buildListCard('Contradictions & Epistemic Uncertainty', unc.contradictions_and_uncertainty),
      buildListCard('Unresolved Follow-Up Questions', unc.unresolved_followup_questions),
      buildListCard('Potential Architectural Gaps', unc.potential_architectural_gaps),
      buildListCard('Recommended Experiments', unc.recommended_experiments)
    );
  }

  const interpsContainer = el('previewInterpretationsContainer');
  if (interpsContainer) {
    interpsContainer.innerHTML = '';
    for (const m of epi.machine_interpretations || []) {
      const isDisputed =
        m.validation_status === 'DISPUTED_BY_PARTICIPANT' ||
        m.validation_status === 'SUPERSEDED_BY_PARTICIPANT' ||
        m.confirmation_status === 'PARTICIPANT_DISPUTED' ||
        Boolean(m.superseded_by);
      const card = document.createElement('article');
      card.className = `ledger-card${isDisputed ? ' disputed-card' : ''}`;
      const header = document.createElement('div');
      header.className = 'ledger-card-header';
      const idPill = document.createElement('span');
      idPill.className = 'ledger-id-pill';
      idPill.textContent = m.interpretation_id || 'minterp';
      const statusBadge = document.createElement('span');
      statusBadge.className = `steward-badge ${isDisputed ? 'badge-danger' : 'badge-safe'}`;
      statusBadge.textContent =
        m.validation_status || m.confirmation_status || 'MACHINE_INTERPRETATION';
      header.append(idPill, statusBadge);

      const claimP = document.createElement('p');
      claimP.className = 'turn-text';
      claimP.textContent = m.interpretation || m.interpreted_claim || '';
      card.append(header, claimP);

      if (m.dispute_note || m.resolution_note) {
        const disp = document.createElement('p');
        disp.className = 'turn-text';
        disp.style.color = '#fca5a5';
        disp.textContent = `Dispute / Resolution Note: ${m.dispute_note || m.resolution_note}`;
        card.appendChild(disp);
      }
      interpsContainer.appendChild(card);
    }
  }

  const stmts = epi.participant_statements || [];
  if (el('stmtCountBadge')) {
    el('stmtCountBadge').textContent = String(stmts.length);
  }
  const stmtsContainer = el('previewStatementsContainer');
  if (stmtsContainer) {
    stmtsContainer.innerHTML = '';
    for (const s of stmts) {
      const card = document.createElement('article');
      card.className = 'ledger-card';
      const header = document.createElement('div');
      header.className = 'ledger-card-header';
      const idPill = document.createElement('span');
      idPill.className = 'ledger-id-pill';
      idPill.textContent = `${s.statement_id || ''} · Turn: ${s.turn_id || ''}`;
      const topicBadge = document.createElement('span');
      topicBadge.className = 'steward-badge';
      topicBadge.textContent = s.topic || s.paraphrased_claim || 'Participant Statement';
      header.append(idPill, topicBadge);

      const quoteP = document.createElement('p');
      quoteP.className = 'turn-text';
      quoteP.textContent = `"${s.verbatim_quote || ''}"`;
      card.append(header, quoteP);
      stmtsContainer.appendChild(card);
    }
  }

  // 5. View 4: Frozen Verbatim Transcript Turns
  const turns = epi.turns || [];
  if (el('navTurnCount')) {
    el('navTurnCount').textContent = String(turns.length);
  }
  const turnsContainer = el('previewTurnsContainer');
  if (turnsContainer) {
    turnsContainer.innerHTML = '';
    for (const t of turns) {
      const isParticipant =
        t.speaker === 'PARTICIPANT_HUMAN' || t.speaker === 'PARTICIPANT';
      const card = document.createElement('article');
      card.className = `turn-card ${isParticipant ? 'turn-participant' : 'turn-agent'}`;
      const header = document.createElement('div');
      header.className = 'ledger-card-header';
      const pill = document.createElement('span');
      pill.className = 'ledger-id-pill';
      pill.textContent = `#${t.sequence_number ?? ''} · ${t.turn_id || ''} · ${isParticipant ? 'PARTICIPANT' : 'OWEN INTERVIEWER'}`;
      const ts = document.createElement('span');
      ts.style.fontSize = '0.76rem';
      ts.style.color = '#94a3b8';
      ts.textContent = t.timestamp || t.occurred_at || '';
      header.append(pill, ts);

      const body = document.createElement('p');
      body.className = 'turn-text';
      body.textContent = t.verbatim_text || t.utterance_text || '';
      card.append(header, body);
      turnsContainer.appendChild(card);
    }
  }
}

function wireEvents() {
  // Primary Google Sign-In (OAuth 2.0 Authorization Code + PKCE)
  el('googlePkceSignInBtn')?.addEventListener('click', async () => {
    clearError();
    showNotice('Preparing Google OAuth 2.0 Authorization Code + PKCE S256 challenge...');
    const btn = el('googlePkceSignInBtn');
    if (btn) btn.disabled = true;
    try {
      await startGoogleOauthPkceFlow();
    } catch (err) {
      showNotice('');
      showError(err.message);
      if (btn) btn.disabled = false;
    }
  });

  // Auth mode tab switching
  const tabPwd = el('tabPasswordMode');
  const tabOtp = el('tabOtpMode');
  const formPwd = el('passwordLoginForm');
  const formOtp = el('otpLoginForm');

  tabPwd?.addEventListener('click', () => {
    tabPwd.classList.add('active');
    tabPwd.setAttribute('aria-selected', 'true');
    tabOtp?.classList.remove('active');
    tabOtp?.setAttribute('aria-selected', 'false');
    formPwd?.classList.remove('hidden');
    formOtp?.classList.add('hidden');
    clearError();
  });

  tabOtp?.addEventListener('click', () => {
    tabOtp.classList.add('active');
    tabOtp.setAttribute('aria-selected', 'true');
    tabPwd?.classList.remove('active');
    tabPwd?.setAttribute('aria-selected', 'false');
    formOtp?.classList.remove('hidden');
    formPwd?.classList.add('hidden');
    clearError();
  });

  // Password Sign-In
  formPwd?.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();
    showNotice('Authenticating with Supabase Auth and verifying Steward permissions...');
    const btn = el('passwordSignInBtn');
    if (btn) btn.disabled = true;
    try {
      const email = (el('stewardEmailInput')?.value || '').trim();
      const password = el('stewardPasswordInput')?.value || '';
      if (!email || !password) {
        throw new Error('Please enter both your Steward email address and password.');
      }
      const token = await signInWithPassword(email, password);
      state.accessToken = token;
      const sessionId = getEffectiveSessionId();
      const preview = await fetchStewardReviewPreview(sessionId);
      showNotice('');
      renderStewardWorkspace(preview);
    } catch (err) {
      showNotice('');
      showError(err.message);
    } finally {
      if (btn) btn.disabled = false;
    }
  });

  // Send Magic Link / OTP
  formOtp?.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();
    const email = (el('otpEmailInput')?.value || '').trim();
    if (!email) {
      showError('Please enter your verified Steward email address.');
      return;
    }
    const btn = el('sendOtpBtn');
    if (btn) btn.disabled = true;
    try {
      await sendMagicLinkOrOtp(email);
      el('otpVerifyContainer')?.classList.remove('hidden');
      showNotice(
        `Verification email sent to ${email}. Click the magic link in the email or enter the 6-digit code below.`
      );
    } catch (err) {
      showError(err.message);
    } finally {
      if (btn) btn.disabled = false;
    }
  });

  // Verify 6-digit OTP code
  el('verifyOtpBtn')?.addEventListener('click', async () => {
    clearError();
    const email = (el('otpEmailInput')?.value || '').trim();
    const code = (el('otpCodeInput')?.value || '').trim();
    if (!email || !code) {
      showError('Please enter both your Steward email address and the 6-digit verification code.');
      return;
    }
    const btn = el('verifyOtpBtn');
    if (btn) btn.disabled = true;
    try {
      const token = await verifyOtpCode(email, code);
      state.accessToken = token;
      const sessionId = getEffectiveSessionId();
      const preview = await fetchStewardReviewPreview(sessionId);
      showNotice('');
      renderStewardWorkspace(preview);
    } catch (err) {
      showError(err.message);
    } finally {
      if (btn) btn.disabled = false;
    }
  });

  // Sub-navigation tabs inside Steward workspace
  const navBtns = document.querySelectorAll('.steward-nav-btn');
  navBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      navBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const targetId = btn.getAttribute('data-target');
      document.querySelectorAll('.steward-view-pane').forEach((pane) => {
        pane.classList.toggle('hidden', pane.id !== targetId);
      });
    });
  });

  // Session switcher & refresh in workspace
  el('workspaceSessionSelect')?.addEventListener('change', async (e) => {
    const nextSessionId = e.target.value;
    if (!nextSessionId || !state.accessToken) return;
    try {
      const preview = await fetchStewardReviewPreview(nextSessionId);
      renderStewardWorkspace(preview);
    } catch (err) {
      alert(err.message);
    }
  });

  el('refreshPreviewBtn')?.addEventListener('click', async () => {
    const currentId =
      el('workspaceSessionSelect')?.value ||
      state.previewData?.session_summary?.session_id ||
      getEffectiveSessionId();
    if (!currentId || !state.accessToken) return;
    try {
      const preview = await fetchStewardReviewPreview(currentId);
      renderStewardWorkspace(preview);
    } catch (err) {
      alert(err.message);
    }
  });

  // Sign Out
  el('signOutBtn')?.addEventListener('click', async () => {
    if (state.authConfig?.supabase_url && state.authConfig?.supabase_anon_key && state.accessToken) {
      await fetch(`${state.authConfig.supabase_url}/auth/v1/logout`, {
        method: 'POST',
        headers: {
          apikey: state.authConfig.supabase_anon_key,
          Authorization: `Bearer ${state.accessToken}`
        }
      }).catch(() => {});
    }
    state.accessToken = null;
    state.previewData = null;
    window.sessionStorage.removeItem(PKCE_VERIFIER_STORAGE_KEY);
    window.sessionStorage.removeItem(PKCE_SESSION_STORAGE_KEY);
    el('stewardWorkspace')?.classList.add('hidden');
    el('signOutBtn')?.classList.add('hidden');
    el('stewardAuthGatePanel')?.classList.remove('hidden');
    if (el('stewardAuthBadge')) {
      el('stewardAuthBadge').textContent = 'Steward Auth Required';
    }
  });
}

async function init() {
  wireEvents();
  try {
    const { authCode, oauthError } = extractAndScrubOauthCallbackParams();
    const hashToken = extractHashAccessToken();
    await loadAuthConfig();

    if (oauthError) {
      throw new Error(`Google OAuth callback error: ${oauthError}`);
    }

    if (authCode) {
      showNotice('Exchanging Google OAuth PKCE authorization code and verifying Superadmin/Steward authority...');
      const token = await exchangePkceAuthorizationCode(authCode);
      state.accessToken = token;
      window.sessionStorage.removeItem(PKCE_SESSION_STORAGE_KEY);
      const preview = await fetchStewardReviewPreview(getEffectiveSessionId());
      showNotice('');
      renderStewardWorkspace(preview);
      return;
    }

    if (hashToken) {
      state.accessToken = hashToken;
      showNotice('Verifying Supabase Magic Link session and Steward authority...');
      const preview = await fetchStewardReviewPreview(getEffectiveSessionId());
      showNotice('');
      renderStewardWorkspace(preview);
    }
  } catch (err) {
    showNotice('');
    showError(err.message);
  }
}

init();
