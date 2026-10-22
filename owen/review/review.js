/**
 * MindRiot Labs — OWEN Participant Experience Review Portal Client (v0.3)
 *
 * Mobile-first review workflow at /owen/review:
 * - Reads #token & session from URL hash, immediately scrubs the URL via history.replaceState
 *   so review secrets never persist in browser history or address bar.
 * - Renders concise thematic sections with collapsible verbatim supporting testimony.
 * - Supports inline section confirmation, inline editing/clarification (never window.prompt),
 *   and section exclusion.
 * - Renders preselected cleanup recommendations with explicit UI notice that preselection
 *   never takes effect until explicit submission (Decision 3).
 * - Renders OWEN's separate MACHINE_INFERRED candidate lessons and calibrated Decision 4
 *   Contribution-to-Impact cards.
 * - Supports autosave/resume and idempotent submission via client_request_id.
 */

const state = {
  sessionId: 'ses-uat-review-disposable-001',
  reviewToken: '',
  review: null,
  /**
   * Local UI working state for cleanup choices:
   * If server participant_decision is 'UNDECIDED' and default_ui_preselected is true,
   * we display 'ACCEPTED_CLEANUP' preselected in the UI (while tracking that the server
   * remains 'UNDECIDED' until the user saves a draft or submits).
   */
  uiCleanupChoices: new Map(),
  openEditorSectionId: null,
  autosaveTimer: null,
  isSaving: false,
  lastSubmitHash: null,
  lastSubmitRequestId: null
};

const els = {
  headerSessionTitle: document.getElementById('headerSessionTitle'),
  reviewStatusBadge: document.getElementById('reviewStatusBadge'),
  authGatePanel: document.getElementById('authGatePanel'),
  authGateForm: document.getElementById('authGateForm'),
  sessionIdInput: document.getElementById('sessionIdInput'),
  reviewTokenInput: document.getElementById('reviewTokenInput'),
  authErrorBox: document.getElementById('authErrorBox'),
  unlockReviewBtn: document.getElementById('unlockReviewBtn'),
  reviewWorkspace: document.getElementById('reviewWorkspace'),
  submissionConfirmationBanner: document.getElementById('submissionConfirmationBanner'),
  submittedTimestampText: document.getElementById('submittedTimestampText'),
  futureOutcomeOptInNote: document.getElementById('futureOutcomeOptInNote'),
  welcomeEstimatePill: document.getElementById('welcomeEstimatePill'),
  welcomeExpiryPill: document.getElementById('welcomeExpiryPill'),
  welcomeHeading: document.getElementById('welcomeHeading'),
  welcomeMessageText: document.getElementById('welcomeMessageText'),
  confirmAllUnreviewedBtn: document.getElementById('confirmAllUnreviewedBtn'),
  reviewSectionsContainer: document.getElementById('reviewSectionsContainer'),
  cleanupPanel: document.getElementById('cleanupPanel'),
  cleanupListContainer: document.getElementById('cleanupListContainer'),
  candidateLessonsPanel: document.getElementById('candidateLessonsPanel'),
  candidateLessonsContainer: document.getElementById('candidateLessonsContainer'),
  impactIntroductionText: document.getElementById('impactIntroductionText'),
  impactNonEndorsementBanner: document.getElementById('impactNonEndorsementBanner'),
  impactItemsContainer: document.getElementById('impactItemsContainer'),
  attributionPreferenceSelect: document.getElementById('attributionPreferenceSelect'),
  sharingScopeSelect: document.getElementById('sharingScopeSelect'),
  allowFoundryIngestionCheckbox: document.getElementById('allowFoundryIngestionCheckbox'),
  notifyFutureOutcomesCheckbox: document.getElementById('notifyFutureOutcomesCheckbox'),
  overallCommentTextarea: document.getElementById('overallCommentTextarea'),
  autosaveDot: document.getElementById('autosaveDot'),
  autosaveStatusText: document.getElementById('autosaveStatusText'),
  saveDraftBtn: document.getElementById('saveDraftBtn'),
  submitReviewBtn: document.getElementById('submitReviewBtn')
};

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showAuthError(message) {
  if (!els.authErrorBox) return;
  els.authErrorBox.textContent = message;
  els.authErrorBox.classList.remove('hidden');
}

function clearAuthError() {
  if (!els.authErrorBox) return;
  els.authErrorBox.textContent = '';
  els.authErrorBox.classList.add('hidden');
}

function setAutosaveIndicator(text, tone = 'saved') {
  if (els.autosaveStatusText) {
    els.autosaveStatusText.textContent = text;
  }
  if (els.autosaveDot) {
    els.autosaveDot.style.background =
      tone === 'saving' ? '#f59e0b' : tone === 'error' ? '#f43f5e' : '#10b981';
  }
}

/**
 * Extracts #token and session_id from URL hash or query, and immediately scrubs
 * any token from the browser URL bar.
 */
function parseAndScrubInitialUrl() {
  const url = new URL(window.location.href);

  // Security check: if someone passed ?token= in query string, scrub it and warn
  if (url.searchParams.has('token') || url.searchParams.has('review_token')) {
    url.searchParams.delete('token');
    url.searchParams.delete('review_token');
    window.history.replaceState(null, '', url.pathname + url.search);
    showAuthError(
      'For your security, review keys cannot be passed in URL query parameters (?token=...). Please paste your review key below or use the private #token link.'
    );
    return;
  }

  const querySession = url.searchParams.get('session') || url.searchParams.get('session_id');
  if (querySession) {
    state.sessionId = querySession.trim();
    if (els.sessionIdInput) els.sessionIdInput.value = state.sessionId;
  }

  const rawHash = window.location.hash ? window.location.hash.slice(1) : '';
  if (rawHash) {
    const hashParams = new URLSearchParams(rawHash);
    const hashToken = hashParams.get('token') || hashParams.get('review_token');
    const hashSession = hashParams.get('session') || hashParams.get('session_id');

    if (hashSession) {
      state.sessionId = hashSession.trim();
      if (els.sessionIdInput) els.sessionIdInput.value = state.sessionId;
    }
    if (hashToken) {
      state.reviewToken = hashToken.trim();
      if (els.reviewTokenInput) els.reviewTokenInput.value = state.reviewToken;
    }

    // Immediately scrub #token from address bar
    const cleanSearch = state.sessionId
      ? `?session=${encodeURIComponent(state.sessionId)}`
      : '';
    window.history.replaceState(null, '', `${url.pathname}${cleanSearch}`);
  }
}

async function loadReviewSession(sessionId, reviewToken) {
  clearAuthError();
  if (els.unlockReviewBtn) els.unlockReviewBtn.disabled = true;

  try {
    const res = await fetch(
      `/api/owen/review/session?session_id=${encodeURIComponent(sessionId)}`,
      {
        method: 'GET',
        headers: {
          'x-owen-review-token': reviewToken
        }
      }
    );

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        data.error ||
        (res.status === 401
          ? 'Invalid or expired review link.'
          : 'Unable to load review session.');
      showAuthError(msg);
      return;
    }

    state.sessionId = sessionId;
    state.reviewToken = reviewToken;
    applyReviewData(data.review);

    els.authGatePanel.classList.add('hidden');
    els.reviewWorkspace.classList.remove('hidden');
  } catch (err) {
    showAuthError(err?.message || 'Network error while connecting to OWEN Review service.');
  } finally {
    if (els.unlockReviewBtn) els.unlockReviewBtn.disabled = false;
  }
}

function applyReviewData(review) {
  state.review = review;

  // Initialize UI cleanup choices: if server is UNDECIDED and default_ui_preselected is true,
  // preselect ACCEPTED_CLEANUP in UI while keeping server awareness clear.
  for (const cleanup of review.flagged_cleanup_recommendations || []) {
    if (cleanup.participant_decision !== 'UNDECIDED') {
      state.uiCleanupChoices.set(cleanup.cleanup_id, cleanup.participant_decision);
    } else if (!state.uiCleanupChoices.has(cleanup.cleanup_id)) {
      state.uiCleanupChoices.set(
        cleanup.cleanup_id,
        cleanup.default_ui_preselected ? 'ACCEPTED_CLEANUP' : 'UNDECIDED'
      );
    }
  }

  renderHeaderAndWelcome();
  renderSections();
  renderCleanups();
  renderCandidateLessons();
  renderContributionToImpact();
  renderAttributionControls();
  renderConfirmationState();
}

function renderHeaderAndWelcome() {
  const r = state.review;
  if (!r) return;

  if (els.headerSessionTitle) {
    els.headerSessionTitle.textContent = r.welcome_context.interview_title;
  }

  if (els.reviewStatusBadge) {
    if (r.status === 'SUBMITTED_BY_PARTICIPANT') {
      els.reviewStatusBadge.textContent = 'Submitted · Awaiting Steward Gate';
      els.reviewStatusBadge.classList.add('status-submitted');
    } else if (r.status === 'IN_PROGRESS_DRAFT') {
      els.reviewStatusBadge.textContent = 'Draft Saved · Not Yet Submitted';
      els.reviewStatusBadge.classList.remove('status-submitted');
    } else {
      els.reviewStatusBadge.textContent = 'Ready for Your Review';
      els.reviewStatusBadge.classList.remove('status-submitted');
    }
  }

  if (els.welcomeHeading) {
    els.welcomeHeading.textContent = `Welcome, ${r.welcome_context.participant_name}`;
  }
  if (els.welcomeMessageText) {
    els.welcomeMessageText.textContent = r.welcome_context.welcome_message;
  }
  if (els.welcomeEstimatePill) {
    els.welcomeEstimatePill.textContent = `Estimated review time: ~${r.welcome_context.estimated_review_minutes} min`;
  }
  if (els.welcomeExpiryPill && r.access_expires_at) {
    const expDate = r.access_expires_at.slice(0, 10);
    els.welcomeExpiryPill.textContent = `Private link valid through ${expDate}`;
  }
}

function formatActionBadge(action) {
  if (action === 'CONFIRMED_ACCURATE') {
    return { label: 'Confirmed Accurate', cls: 'badge-confirmed', cardCls: 'state-confirmed' };
  }
  if (action === 'EDITED_OR_CLARIFIED') {
    return { label: 'Edited / Clarified', cls: 'badge-edited', cardCls: 'state-edited' };
  }
  if (action === 'EXCLUDED_FROM_BRIEF') {
    return { label: 'Excluded from Brief', cls: 'badge-excluded', cardCls: 'state-excluded' };
  }
  return { label: 'Unreviewed', cls: '', cardCls: '' };
}

function renderSections() {
  const r = state.review;
  if (!r || !els.reviewSectionsContainer) return;

  els.reviewSectionsContainer.innerHTML = r.sections
    .map(sec => {
      const badge = formatActionBadge(sec.participant_action);
      const isEditing = state.openEditorSectionId === sec.section_id;
      const displaySummary = sec.participant_edited_summary || sec.concise_summary;

      const keyPointsHtml = (sec.key_points || [])
        .map(kp => `<li>${escapeHtml(kp)}</li>`)
        .join('');

      const excerptsHtml = (sec.supporting_excerpts || [])
        .map(
          ex => `
          <div class="verbatim-quote-box">
            “${escapeHtml(ex.verbatim_quote)}”
            ${
              ex.transcription_artifact_note
                ? `<div class="artifact-note">${escapeHtml(ex.transcription_artifact_note)}</div>`
                : ''
            }
          </div>
        `
        )
        .join('');

      const editorHtml = isEditing
        ? `
        <div class="inline-editor-box">
          <label class="field-label" for="edit-summary-${escapeHtml(sec.section_id)}">
            Edit or Clarify This Section’s Summary
          </label>
          <textarea
            id="edit-summary-${escapeHtml(sec.section_id)}"
            class="textarea-input"
            rows="3"
          >${escapeHtml(displaySummary)}</textarea>
          <label class="field-label" for="edit-note-${escapeHtml(sec.section_id)}" style="margin-top:8px;">
            Optional Clarification Note or Exclusion Reason
          </label>
          <input
            type="text"
            id="edit-note-${escapeHtml(sec.section_id)}"
            class="text-input"
            placeholder="Optional context on what you changed or why..."
            value="${escapeHtml(sec.participant_note || sec.exclusion_reason || '')}"
          />
          <div class="inline-editor-actions">
            <button
              type="button"
              class="btn btn-primary btn-compact"
              data-action="save-inline-edit"
              data-section-id="${escapeHtml(sec.section_id)}"
            >
              Apply Clarification
            </button>
            <button
              type="button"
              class="btn btn-secondary btn-compact"
              data-action="cancel-inline-edit"
              data-section-id="${escapeHtml(sec.section_id)}"
            >
              Cancel
            </button>
          </div>
        </div>
      `
        : '';

      return `
        <article class="review-section-card ${badge.cardCls}" data-section-card="${escapeHtml(sec.section_id)}">
          <div class="section-card-top">
            <span class="theme-pill">${escapeHtml(sec.theme_tag)}</span>
            <span class="section-state-badge ${badge.cls}">${escapeHtml(badge.label)}</span>
          </div>
          <h3 class="section-card-title">${escapeHtml(sec.title)}</h3>
          <p class="section-summary-text">${escapeHtml(displaySummary)}</p>
          ${keyPointsHtml ? `<ul class="section-keypoints">${keyPointsHtml}</ul>` : ''}

          <details class="testimony-drawer">
            <summary class="testimony-summary">
              Inspect Original Supporting Testimony (${(sec.supporting_excerpts || []).length})
            </summary>
            <div class="testimony-content">
              ${excerptsHtml}
            </div>
          </details>

          <div class="section-action-bar" role="group" aria-label="Actions for ${escapeHtml(sec.title)}">
            <button
              type="button"
              class="action-toggle-btn ${sec.participant_action === 'CONFIRMED_ACCURATE' ? 'active-confirm' : ''}"
              data-action="confirm-section"
              data-section-id="${escapeHtml(sec.section_id)}"
            >
              ✓ Confirm Accuracy
            </button>
            <button
              type="button"
              class="action-toggle-btn ${sec.participant_action === 'EDITED_OR_CLARIFIED' ? 'active-edit' : ''}"
              data-action="open-edit-section"
              data-section-id="${escapeHtml(sec.section_id)}"
            >
              ✎ Suggest Edit / Clarify
            </button>
            <button
              type="button"
              class="action-toggle-btn ${sec.participant_action === 'EXCLUDED_FROM_BRIEF' ? 'active-exclude' : ''}"
              data-action="exclude-section"
              data-section-id="${escapeHtml(sec.section_id)}"
            >
              ✕ Exclude from Brief
            </button>
          </div>
          ${editorHtml}
        </article>
      `;
    })
    .join('');
}

function renderCleanups() {
  const r = state.review;
  if (!r || !els.cleanupListContainer) return;

  const cleanups = r.flagged_cleanup_recommendations || [];
  if (cleanups.length === 0) {
    els.cleanupPanel?.classList.add('hidden');
    return;
  }
  els.cleanupPanel?.classList.remove('hidden');

  els.cleanupListContainer.innerHTML = cleanups
    .map(c => {
      const uiDecision =
        state.uiCleanupChoices.get(c.cleanup_id) ||
        (c.default_ui_preselected ? 'ACCEPTED_CLEANUP' : 'UNDECIDED');
      const isServerStillUndecided = c.participant_decision === 'UNDECIDED';

      return `
        <div class="cleanup-card" data-cleanup-card="${escapeHtml(c.cleanup_id)}">
          <div class="cleanup-badge-row">
            <span class="suggested-cleanup-pill">
              ${
                isServerStillUndecided
                  ? 'Suggested Cleanup · Preselected (Not Applied Until Submit)'
                  : c.participant_decision === 'ACCEPTED_CLEANUP'
                  ? 'Cleanup Accepted'
                  : 'Kept Original As-Is'
              }
            </span>
          </div>
          <h3 class="section-card-title">${escapeHtml(c.title)}</h3>
          <p class="section-summary-text"><strong>What happened:</strong> ${escapeHtml(c.what_happened)}</p>
          <p class="section-summary-text"><strong>Proposed cleanup:</strong> ${escapeHtml(c.proposed_cleanup_action)}</p>
          <div class="section-action-bar" role="group" aria-label="Decision for ${escapeHtml(c.title)}">
            <button
              type="button"
              class="action-toggle-btn ${uiDecision === 'ACCEPTED_CLEANUP' ? 'active-confirm' : ''}"
              data-action="cleanup-decision"
              data-cleanup-id="${escapeHtml(c.cleanup_id)}"
              data-decision="ACCEPTED_CLEANUP"
            >
              ✓ Apply Recommended Cleanup
            </button>
            <button
              type="button"
              class="action-toggle-btn ${uiDecision === 'KEEP_AS_IS' ? 'active-edit' : ''}"
              data-action="cleanup-decision"
              data-cleanup-id="${escapeHtml(c.cleanup_id)}"
              data-decision="KEEP_AS_IS"
            >
              Keep Original As-Is
            </button>
          </div>
        </div>
      `;
    })
    .join('');
}

function renderCandidateLessons() {
  const r = state.review;
  if (!r || !els.candidateLessonsContainer) return;

  const lessons = r.candidate_lessons || [];
  if (lessons.length === 0) {
    els.candidateLessonsPanel?.classList.add('hidden');
    return;
  }
  els.candidateLessonsPanel?.classList.remove('hidden');

  els.candidateLessonsContainer.innerHTML = lessons
    .map(
      l => `
      <div class="lesson-card" data-lesson-card="${escapeHtml(l.candidate_lesson_id)}">
        <div class="cleanup-badge-row">
          <span class="machine-origin-pill">OWEN Machine Interpretation (Not Your Direct Quote)</span>
          <span class="section-state-badge">Confidence: ${escapeHtml(l.confidence)}</span>
        </div>
        <h3 class="section-card-title">${escapeHtml(l.title)}</h3>
        <p class="section-summary-text"><strong>OWEN’s Interpretation:</strong> ${escapeHtml(l.owen_interpretation)}</p>
        <p class="section-summary-text"><strong>Proposed Implication for OWEN:</strong> ${escapeHtml(l.proposed_architectural_implication)}</p>
        <div class="section-action-bar" role="group" aria-label="Feedback for ${escapeHtml(l.title)}">
          <button
            type="button"
            class="action-toggle-btn ${l.participant_feedback === 'RESONATES' ? 'active-confirm' : ''}"
            data-action="lesson-feedback"
            data-lesson-id="${escapeHtml(l.candidate_lesson_id)}"
            data-feedback="RESONATES"
          >
            ✓ Resonates
          </button>
          <button
            type="button"
            class="action-toggle-btn ${l.participant_feedback === 'NEEDS_NUANCE' ? 'active-edit' : ''}"
            data-action="lesson-feedback"
            data-lesson-id="${escapeHtml(l.candidate_lesson_id)}"
            data-feedback="NEEDS_NUANCE"
          >
            Needs Nuance
          </button>
          <button
            type="button"
            class="action-toggle-btn ${l.participant_feedback === 'DISAGREE_WITH_INTERPRETATION' ? 'active-exclude' : ''}"
            data-action="lesson-feedback"
            data-lesson-id="${escapeHtml(l.candidate_lesson_id)}"
            data-feedback="DISAGREE_WITH_INTERPRETATION"
          >
            Disagree with Interpretation
          </button>
        </div>
      </div>
    `
    )
    .join('');
}

function renderContributionToImpact() {
  const r = state.review;
  if (!r || !r.contribution_to_impact) return;

  const chain = r.contribution_to_impact;
  if (els.impactIntroductionText) {
    els.impactIntroductionText.textContent = chain.introduction;
  }
  if (els.impactNonEndorsementBanner) {
    els.impactNonEndorsementBanner.textContent = chain.non_endorsement_boundary_notice;
  }
  if (!els.impactItemsContainer) return;

  els.impactItemsContainer.innerHTML = (chain.items || [])
    .map(
      item => `
      <article class="impact-card" data-impact-id="${escapeHtml(item.impact_id)}">
        <div class="impact-meta-top">
          <span class="impact-category-pill">${escapeHtml(item.contribution_category_label)}</span>
          <span class="impact-status-pill status-${escapeHtml(item.status)}">
            ${escapeHtml(item.status_badge_label)}
          </span>
        </div>
        <h3 class="section-card-title">${escapeHtml(item.title)}</h3>
        <div class="impact-chain-steps">
          <div class="impact-step-row">
            <span class="impact-step-label">1. What We Observed in Session</span>
            ${escapeHtml(item.human_observation_summary)}
          </div>
          <div class="impact-step-row">
            <span class="impact-step-label">2. OWEN Synthesis &amp; Candidate Lesson</span>
            ${escapeHtml(item.proposed_organizational_lesson)}
          </div>
          <div class="impact-step-row">
            <span class="impact-step-label">3. Human Steward Decision &amp; Implementation Status</span>
            ${escapeHtml(item.human_decision_summary)} — <em>${escapeHtml(item.experiment_or_implementation_summary)}</em>
          </div>
          <div class="impact-step-row">
            <span class="impact-step-label">4. Outcome &amp; Verification</span>
            ${escapeHtml(item.observed_or_target_outcome)}
          </div>
        </div>
        <div class="impact-disclosure-footnote">
          <strong>Attribution Boundary:</strong> ${escapeHtml(item.non_endorsement_disclosure)}
        </div>
      </article>
    `
    )
    .join('');
}

function renderAttributionControls() {
  const r = state.review;
  if (!r || !r.sharing_and_attribution) return;

  const sa = r.sharing_and_attribution;
  if (els.attributionPreferenceSelect) {
    els.attributionPreferenceSelect.value = sa.attribution_preference || 'ATTRIBUTED';
  }
  if (els.sharingScopeSelect) {
    els.sharingScopeSelect.value =
      sa.permitted_sharing_scope || 'INTERNAL_OWEN_LEARNING_ONLY';
  }
  if (els.allowFoundryIngestionCheckbox) {
    els.allowFoundryIngestionCheckbox.checked = sa.allow_foundry_ingestion !== false;
  }
  if (els.notifyFutureOutcomesCheckbox) {
    els.notifyFutureOutcomesCheckbox.checked = sa.notify_on_future_outcomes !== false;
  }
  if (els.overallCommentTextarea && r.overall_participant_comment !== undefined) {
    els.overallCommentTextarea.value = r.overall_participant_comment;
  }
}

function renderConfirmationState() {
  const r = state.review;
  if (!r || !els.submissionConfirmationBanner) return;

  if (r.status === 'SUBMITTED_BY_PARTICIPANT') {
    els.submissionConfirmationBanner.classList.remove('hidden');
    if (els.submittedTimestampText && r.submitted_at) {
      els.submittedTimestampText.textContent = `Submitted ${r.submitted_at.replace('T', ' ').slice(0, 19)} UTC`;
    }
    if (els.futureOutcomeOptInNote) {
      els.futureOutcomeOptInNote.textContent = r.sharing_and_attribution?.notify_on_future_outcomes
        ? 'You opted in to receive a brief update when proposed experiments inspired by this session are evaluated.'
        : 'You can reopen this link anytime before it expires to inspect updates or adjust your preferences.';
    }
  } else {
    els.submissionConfirmationBanner.classList.add('hidden');
  }
}

function collectCurrentPayload() {
  const r = state.review;
  if (!r) return {};

  const section_updates = r.sections.map(s => ({
    section_id: s.section_id,
    participant_action: s.participant_action,
    ...(s.participant_edited_summary !== undefined
      ? { participant_edited_summary: s.participant_edited_summary }
      : {}),
    ...(s.participant_note !== undefined ? { participant_note: s.participant_note } : {}),
    ...(s.exclusion_reason !== undefined ? { exclusion_reason: s.exclusion_reason } : {})
  }));

  const lesson_feedback_updates = r.candidate_lessons.map(l => ({
    candidate_lesson_id: l.candidate_lesson_id,
    participant_feedback: l.participant_feedback,
    ...(l.participant_comment !== undefined
      ? { participant_comment: l.participant_comment }
      : {})
  }));

  const cleanup_updates = r.flagged_cleanup_recommendations.map(c => ({
    cleanup_id: c.cleanup_id,
    participant_decision:
      state.uiCleanupChoices.get(c.cleanup_id) ||
      (c.default_ui_preselected ? 'ACCEPTED_CLEANUP' : 'UNDECIDED'),
    ...(c.participant_note !== undefined ? { participant_note: c.participant_note } : {})
  }));

  const sharing_and_attribution = {
    attribution_preference: els.attributionPreferenceSelect?.value || 'ATTRIBUTED',
    permitted_sharing_scope:
      els.sharingScopeSelect?.value || 'INTERNAL_OWEN_LEARNING_ONLY',
    allow_foundry_ingestion: Boolean(els.allowFoundryIngestionCheckbox?.checked),
    notify_on_future_outcomes: Boolean(els.notifyFutureOutcomesCheckbox?.checked)
  };

  const overall_participant_comment = els.overallCommentTextarea?.value?.trim() || '';

  return {
    session_id: state.sessionId,
    section_updates,
    lesson_feedback_updates,
    cleanup_updates,
    sharing_and_attribution,
    overall_participant_comment
  };
}

function scheduleAutosave() {
  setAutosaveIndicator('Unsaved changes...', 'saving');
  if (state.autosaveTimer) {
    clearTimeout(state.autosaveTimer);
  }
  state.autosaveTimer = setTimeout(() => {
    saveDraftToServer();
  }, 900);
}

async function saveDraftToServer() {
  if (!state.review || !state.reviewToken) return;
  setAutosaveIndicator('Saving draft...', 'saving');

  try {
    const payload = {
      ...collectCurrentPayload(),
      client_request_id: `draft-${Date.now()}`
    };

    const res = await fetch('/api/owen/review/draft', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-owen-review-token': state.reviewToken
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.review) {
      applyReviewData(data.review);
      setAutosaveIndicator('Draft saved (not yet submitted)', 'saved');
    } else {
      setAutosaveIndicator(data.error || 'Could not autosave draft', 'error');
    }
  } catch {
    setAutosaveIndicator('Offline — changes held in browser', 'error');
  }
}

async function submitFinalReview() {
  if (!state.review || !state.reviewToken || state.isSaving) return;
  state.isSaving = true;
  if (els.submitReviewBtn) els.submitReviewBtn.disabled = true;
  setAutosaveIndicator('Submitting review...', 'saving');

  try {
    const basePayload = collectCurrentPayload();
    const stateFingerprint = JSON.stringify(basePayload);
    if (stateFingerprint !== state.lastSubmitHash || !state.lastSubmitRequestId) {
      state.lastSubmitHash = stateFingerprint;
      state.lastSubmitRequestId = `submit-${state.sessionId}-${Date.now()}`;
    }

    const res = await fetch('/api/owen/review/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-owen-review-token': state.reviewToken
      },
      body: JSON.stringify({
        ...basePayload,
        client_request_id: state.lastSubmitRequestId
      })
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.review) {
      applyReviewData(data.review);
      setAutosaveIndicator('Experience review submitted', 'saved');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setAutosaveIndicator(data.error || 'Submission failed', 'error');
    }
  } catch {
    setAutosaveIndicator('Network error during submission', 'error');
  } finally {
    state.isSaving = false;
    if (els.submitReviewBtn) els.submitReviewBtn.disabled = false;
  }
}

// Event Listeners
els.authGateForm?.addEventListener('submit', e => {
  e.preventDefault();
  const sessionId = (els.sessionIdInput?.value || '').trim();
  const token = (els.reviewTokenInput?.value || '').trim();
  if (!sessionId || !token) {
    showAuthError('Please enter both your session identifier and private review key.');
    return;
  }
  loadReviewSession(sessionId, token);
});

els.confirmAllUnreviewedBtn?.addEventListener('click', () => {
  if (!state.review) return;
  for (const sec of state.review.sections) {
    if (sec.participant_action === 'UNREVIEWED') {
      sec.participant_action = 'CONFIRMED_ACCURATE';
    }
  }
  renderSections();
  scheduleAutosave();
});

els.reviewSectionsContainer?.addEventListener('click', e => {
  const btn = e.target.closest('button[data-action]');
  if (!btn || !state.review) return;

  const action = btn.getAttribute('data-action');
  const sectionId = btn.getAttribute('data-section-id');
  const sec = state.review.sections.find(s => s.section_id === sectionId);
  if (!sec) return;

  if (action === 'confirm-section') {
    sec.participant_action = 'CONFIRMED_ACCURATE';
    state.openEditorSectionId = null;
    renderSections();
    scheduleAutosave();
  } else if (action === 'open-edit-section') {
    state.openEditorSectionId = sectionId;
    renderSections();
  } else if (action === 'cancel-inline-edit') {
    state.openEditorSectionId = null;
    renderSections();
  } else if (action === 'save-inline-edit') {
    const summaryEl = document.getElementById(`edit-summary-${sectionId}`);
    const noteEl = document.getElementById(`edit-note-${sectionId}`);
    const newSummary = summaryEl ? summaryEl.value.trim() : '';
    const newNote = noteEl ? noteEl.value.trim() : '';
    if (newSummary) {
      sec.participant_edited_summary = newSummary;
      sec.participant_action = 'EDITED_OR_CLARIFIED';
    }
    if (newNote) {
      sec.participant_note = newNote;
    }
    state.openEditorSectionId = null;
    renderSections();
    scheduleAutosave();
  } else if (action === 'exclude-section') {
    sec.participant_action = 'EXCLUDED_FROM_BRIEF';
    sec.exclusion_reason =
      sec.participant_note || 'Excluded by participant during Experience Brief review.';
    state.openEditorSectionId = null;
    renderSections();
    scheduleAutosave();
  }
});

els.cleanupListContainer?.addEventListener('click', e => {
  const btn = e.target.closest('button[data-action="cleanup-decision"]');
  if (!btn || !state.review) return;

  const cleanupId = btn.getAttribute('data-cleanup-id');
  const decision = btn.getAttribute('data-decision');
  if (!cleanupId || !decision) return;

  state.uiCleanupChoices.set(cleanupId, decision);
  const item = state.review.flagged_cleanup_recommendations.find(
    c => c.cleanup_id === cleanupId
  );
  if (item) {
    item.participant_decision = decision;
  }
  renderCleanups();
  scheduleAutosave();
});

els.candidateLessonsContainer?.addEventListener('click', e => {
  const btn = e.target.closest('button[data-action="lesson-feedback"]');
  if (!btn || !state.review) return;

  const lessonId = btn.getAttribute('data-lesson-id');
  const feedback = btn.getAttribute('data-feedback');
  const lesson = state.review.candidate_lessons.find(
    l => l.candidate_lesson_id === lessonId
  );
  if (!lesson || !feedback) return;

  lesson.participant_feedback = feedback;
  renderCandidateLessons();
  scheduleAutosave();
});

els.attributionPreferenceSelect?.addEventListener('change', () => scheduleAutosave());
els.sharingScopeSelect?.addEventListener('change', () => scheduleAutosave());
els.allowFoundryIngestionCheckbox?.addEventListener('change', () => scheduleAutosave());
els.notifyFutureOutcomesCheckbox?.addEventListener('change', () => scheduleAutosave());
els.overallCommentTextarea?.addEventListener('input', () => scheduleAutosave());

els.saveDraftBtn?.addEventListener('click', () => {
  if (state.autosaveTimer) clearTimeout(state.autosaveTimer);
  saveDraftToServer();
});

els.submitReviewBtn?.addEventListener('click', () => {
  if (state.autosaveTimer) clearTimeout(state.autosaveTimer);
  submitFinalReview();
});

// Initialize on page load
parseAndScrubInitialUrl();
if (state.sessionId && state.reviewToken) {
  loadReviewSession(state.sessionId, state.reviewToken);
}
