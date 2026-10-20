/**
 * MindRiot Labs — OWEN Experience Acquisition Participant Client (/owen/interview/interview.js)
 *
 * Implements the participant-facing adaptive interview experience:
 * - Private invitation token authentication & interrupted-session recovery
 * - Explicit AI interviewer disclosure & dual consent gate (transcript + separate audio)
 * - Dynamic participant attribution labels (never hardcoding participant names)
 * - Smooth view/scroll transitions across Consent, Interview, Pause/Resume, and Experience Brief
 * - iOS Safari-compatible Read Aloud controls (user-gesture unlock, Auto-Read toggle + Play/Pause/Stop)
 * - Prominent voice dictation with live listening states and editable transcript
 * - Truthful animated AI processing feedback with elapsed timer and idempotent retry recovery
 * - ElevenLabs Realtime Conversational AI Voice Mode PoC drawer (OWEN-governed)
 * - Interactive OWEN Experience Brief viewer & participant statement amendment/exclusion controls
 */

const STORAGE_TOKEN_KEY = 'owen_pilot_001_invite_token';
const STORAGE_SESSION_ID_KEY = 'owen_pilot_001_session_id';

let activeToken = '';
let activeSessionId = 'ses-pilot-001-russ-richmond';
let currentSession = null;
let redirectObjectiveId = null;
let readAloudEnabled = false;
let isAudioPlaying = false;
let isAudioPaused = false;
let activeHtmlAudio = null;
let iosAudioUnlocked = false;

let speechRecognition = null;
let dictationState = 'IDLE'; // 'IDLE' | 'LISTENING' | 'PROCESSING'
let usedVoiceDictationForCurrentDraft = false;
let preDictationText = '';

let isSubmittingTurn = false;
let activeTurnTimerInterval = null;
let currentStageView = 'AUTH';

// Workstream B Realtime Voice state
let realtimeVoiceSocket = null;
let realtimeAudioStream = null;
let isRealtimeMicMuted = false;

// DOM Elements
const sessionStatusBadge = document.getElementById('sessionStatusBadge');
const authGatePanel = document.getElementById('authGatePanel');
const consentGatePanel = document.getElementById('consentGatePanel');
const interviewWorkspace = document.getElementById('interviewWorkspace');
const experienceBriefPanel = document.getElementById('experienceBriefPanel');

const tokenAuthForm = document.getElementById('tokenAuthForm');
const inviteTokenInput = document.getElementById('inviteTokenInput');
const authErrorMsg = document.getElementById('authErrorMsg');

const consentForm = document.getElementById('consentForm');
const consentParticipantName = document.getElementById('consentParticipantName');
const consentPurposeText = document.getElementById('consentPurposeText');
const aiDisclosureStatement = document.getElementById('aiDisclosureStatement');
const ackAiDisclosureCheck = document.getElementById('ackAiDisclosureCheck');
const consentTranscriptCheck = document.getElementById('consentTranscriptCheck');
const consentAudioCheck = document.getElementById('consentAudioCheck');
const initialAttributionSelect = document.getElementById('initialAttributionSelect');
const initialAttributedOption = document.getElementById('initialAttributedOption');
const consentErrorMsg = document.getElementById('consentErrorMsg');

const activeObjectivePill = document.getElementById('activeObjectivePill');
const toggleTtsBtn = document.getElementById('toggleTtsBtn');
const playPromptBtn = document.getElementById('playPromptBtn');
const stopPromptBtn = document.getElementById('stopPromptBtn');
const toggleRealtimeVoiceBtn = document.getElementById('toggleRealtimeVoiceBtn');
const audioStatusRow = document.getElementById('audioStatusRow');
const audioStatusDot = document.getElementById('audioStatusDot');
const audioStatusText = document.getElementById('audioStatusText');

const realtimeVoiceDrawer = document.getElementById('realtimeVoiceDrawer');
const closeRealtimeVoiceBtn = document.getElementById('closeRealtimeVoiceBtn');
const realtimeVoiceDisclosure = document.getElementById('realtimeVoiceDisclosure');
const realtimeVoiceStateBadge = document.getElementById('realtimeVoiceStateBadge');
const realtimeVoiceMetaText = document.getElementById('realtimeVoiceMetaText');
const startRealtimeVoiceBtn = document.getElementById('startRealtimeVoiceBtn');
const muteRealtimeMicBtn = document.getElementById('muteRealtimeMicBtn');
const stopRealtimeVoiceBtn = document.getElementById('stopRealtimeVoiceBtn');
const realtimeVoiceErrorMsg = document.getElementById('realtimeVoiceErrorMsg');

const skipQuestionBtn = document.getElementById('skipQuestionBtn');
const pauseResumeBtn = document.getElementById('pauseResumeBtn');
const endInterviewBtn = document.getElementById('endInterviewBtn');
const pausedBanner = document.getElementById('pausedBanner');
const resumeBannerBtn = document.getElementById('resumeBannerBtn');
const transcriptFeed = document.getElementById('transcriptFeed');
const turnComposerForm = document.getElementById('turnComposerForm');
const composerHint = document.getElementById('composerHint');
const voiceDictateBtn = document.getElementById('voiceDictateBtn');
const dictationStatusBanner = document.getElementById('dictationStatusBanner');
const dictationStatusText = document.getElementById('dictationStatusText');
const participantInput = document.getElementById('participantInput');
const sendTurnBtn = document.getElementById('sendTurnBtn');
const turnErrorMsg = document.getElementById('turnErrorMsg');

const coverageCounterBadge = document.getElementById('coverageCounterBadge');
const objectiveList = document.getElementById('objectiveList');
const humanStatementsCount = document.getElementById('humanStatementsCount');
const machineInterpsCount = document.getElementById('machineInterpsCount');
const viewDraftBriefBtn = document.getElementById('viewDraftBriefBtn');

const backToConversationBtn = document.getElementById('backToConversationBtn');
const briefExecutiveSummary = document.getElementById('briefExecutiveSummary');
const briefPubStatusText = document.getElementById('briefPubStatusText');
const briefScopeText = document.getElementById('briefScopeText');
const briefStewardStatusText = document.getElementById('briefStewardStatusText');
const reviewAttributionSelect = document.getElementById('reviewAttributionSelect');
const reviewAttributedOption = document.getElementById('reviewAttributedOption');
const saveAttributionBtn = document.getElementById('saveAttributionBtn');
const addClarificationInput = document.getElementById('addClarificationInput');
const addClarificationBtn = document.getElementById('addClarificationBtn');
const reviewFeedbackMsg = document.getElementById('reviewFeedbackMsg');
const directStatementsContainer = document.getElementById('directStatementsContainer');
const owenLessonsContainer = document.getElementById('owenLessonsContainer');
const briefGapsList = document.getElementById('briefGapsList');
const briefExperimentsList = document.getElementById('briefExperimentsList');
const briefUncertaintiesList = document.getElementById('briefUncertaintiesList');
const briefFollowupsList = document.getElementById('briefFollowupsList');

// ----------------------------------------------------------------------------
// API Helpers
// ----------------------------------------------------------------------------
async function apiFetch(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${activeToken}`,
    'x-owen-invite-token': activeToken,
    ...(options.headers || {})
  };

  const res = await fetch(endpoint, {
    ...options,
    headers
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

// ----------------------------------------------------------------------------
// Initialization & Interrupted Session Recovery
// ----------------------------------------------------------------------------
async function initApp() {
  const url = new URL(window.location.href);
  const hashParams = new URLSearchParams(
    window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash
  );

  const hashToken = hashParams.get('token');
  const queryToken = url.searchParams.get('token');
  const urlToken = hashToken || queryToken;

  const hashSessionId = hashParams.get('session_id');
  const querySessionId = url.searchParams.get('session_id');
  const urlSessionId = hashSessionId || querySessionId;

  if (urlSessionId) {
    activeSessionId = urlSessionId.trim();
    sessionStorage.setItem(STORAGE_SESSION_ID_KEY, activeSessionId);
  } else {
    activeSessionId =
      sessionStorage.getItem(STORAGE_SESSION_ID_KEY) || 'ses-pilot-001-russ-richmond';
  }

  if (urlToken) {
    activeToken = urlToken.trim();
    sessionStorage.setItem(STORAGE_TOKEN_KEY, activeToken);
  } else {
    activeToken = sessionStorage.getItem(STORAGE_TOKEN_KEY) || '';
  }

  // Immediately scrub any token or session parameters from visible URL bar and browser history
  if (urlToken || window.location.hash || url.searchParams.has('token')) {
    url.searchParams.delete('token');
    const cleanSearch = url.searchParams.toString();
    const cleanUrl = url.pathname + (cleanSearch ? `?${cleanSearch}` : '');
    window.history.replaceState(null, document.title, cleanUrl);
  }

  setupSpeechDictation();

  if (activeToken) {
    try {
      await loadSession();
    } catch {
      sessionStorage.removeItem(STORAGE_TOKEN_KEY);
      activeToken = '';
      showStage('AUTH');
    }
  } else {
    showStage('AUTH');
  }
}

async function loadSession() {
  const data = await apiFetch(
    `/api/owen/interview/session?session_id=${encodeURIComponent(activeSessionId)}`
  );
  currentSession = data.session;
  renderSessionState();
}

function scrollElementToTopSmooth(element) {
  if (!element) return;
  requestAnimationFrame(() => {
    const rect = element.getBoundingClientRect();
    const topOffset = Math.max(0, window.scrollY + rect.top - 68);
    window.scrollTo({ top: topOffset, behavior: 'smooth' });
  });
}

function showStage(stage, options = {}) {
  const previousStage = currentStageView;
  currentStageView = stage;

  authGatePanel.classList.add('hidden');
  consentGatePanel.classList.add('hidden');
  interviewWorkspace.classList.add('hidden');
  experienceBriefPanel.classList.add('hidden');

  if (stage === 'AUTH') {
    authGatePanel.classList.remove('hidden');
    sessionStatusBadge.textContent = 'Authentication Required';
  } else if (stage === 'CONSENT') {
    consentGatePanel.classList.remove('hidden');
    sessionStatusBadge.textContent = 'Consent Pending';
    if (previousStage !== 'CONSENT') {
      scrollElementToTopSmooth(consentGatePanel);
    }
  } else if (stage === 'INTERVIEW') {
    interviewWorkspace.classList.remove('hidden');
    sessionStatusBadge.textContent =
      currentSession?.status === 'PAUSED' ? 'Session Paused' : 'Adaptive Interview Active';
    if (options.scrollToTop || previousStage === 'CONSENT' || previousStage === 'BRIEF') {
      scrollElementToTopSmooth(interviewWorkspace);
    }
  } else if (stage === 'BRIEF') {
    experienceBriefPanel.classList.remove('hidden');
    sessionStatusBadge.textContent = 'Experience Brief & Review';
    if (options.scrollToTop || previousStage !== 'BRIEF') {
      scrollElementToTopSmooth(experienceBriefPanel);
    }
  }
}

function updateDynamicAttributionLabels() {
  const participantName = currentSession?.participant?.name || 'Participant';
  const roleTitle = currentSession?.participant?.role_title
    ? ` — ${currentSession.participant.role_title}`
    : '';

  if (initialAttributedOption) {
    initialAttributedOption.textContent = `Attributed to ${participantName}${roleTitle} (Internal MRL / OWEN & Approved Brief)`;
  }
  if (reviewAttributedOption) {
    reviewAttributedOption.textContent = `Attributed to ${participantName}${roleTitle}`;
  }
}

function renderSessionState(voiceAudio = null, transitionOptions = {}) {
  if (!currentSession) {
    showStage('AUTH');
    return;
  }

  consentParticipantName.textContent = currentSession.participant?.name || 'Participant';
  consentPurposeText.textContent = currentSession.purpose || '';
  aiDisclosureStatement.textContent =
    currentSession.interviewer_identity?.disclosure_statement || '';

  updateDynamicAttributionLabels();

  if (currentSession.consent?.attribution_preference && initialAttributionSelect) {
    initialAttributionSelect.value = currentSession.consent.attribution_preference;
  }

  if (currentSession.consent?.status !== 'GRANTED') {
    showStage('CONSENT');
    return;
  }

  // Show voice dictation & realtime voice controls when audio consent is granted
  const audioConsented = Boolean(currentSession.consent.audio_recording_consented);
  if (audioConsented) {
    voiceDictateBtn.classList.remove('hidden');
    if (toggleRealtimeVoiceBtn) {
      toggleRealtimeVoiceBtn.classList.remove('hidden');
    }
  } else {
    voiceDictateBtn.classList.add('hidden');
    if (toggleRealtimeVoiceBtn) {
      toggleRealtimeVoiceBtn.classList.add('hidden');
    }
    if (realtimeVoiceDrawer) {
      realtimeVoiceDrawer.classList.add('hidden');
    }
  }

  renderTranscript();
  renderObjectivesAndLedger();

  const isPaused = currentSession.status === 'PAUSED';
  pausedBanner.classList.toggle('hidden', !isPaused);
  pauseResumeBtn.textContent = isPaused ? '▶️ Resume Session' : '⏸️ Pause Session';

  if (
    currentSession.status === 'COMPLETED' ||
    currentSession.status === 'STOPPED_BY_PARTICIPANT' ||
    currentSession.status === 'UNDER_PARTICIPANT_REVIEW' ||
    currentSession.status === 'AWAITING_STEWARD_AUTHORITY'
  ) {
    if (currentSession.experience_brief) {
      renderExperienceBrief(currentSession.experience_brief);
      showStage('BRIEF', { scrollToTop: true });
      return;
    }
  }

  showStage('INTERVIEW', transitionOptions);
  if (readAloudEnabled) {
    playInterviewerPrompt({ voiceAudio, force: false });
  }
}

function renderTranscript() {
  transcriptFeed.innerHTML = '';
  const turns = currentSession.turns || [];

  for (const turn of turns) {
    const bubble = document.createElement('div');
    if (turn.speaker === 'INTERVIEWER_AI') {
      bubble.className = 'turn-bubble turn-interviewer';
    } else if (turn.speaker === 'PARTICIPANT_HUMAN') {
      bubble.className = 'turn-bubble turn-participant';
    } else {
      bubble.className = 'turn-bubble turn-system';
    }

    const meta = document.createElement('div');
    meta.className = 'turn-meta';

    const speakerLabel = document.createElement('span');
    speakerLabel.className = 'turn-speaker';
    speakerLabel.textContent =
      turn.speaker === 'INTERVIEWER_AI'
        ? 'OWEN AI Interviewer'
        : turn.speaker === 'PARTICIPANT_HUMAN'
        ? currentSession.participant.name
        : 'OWEN Session Guard';

    const timeLabel = document.createElement('span');
    const timeStr = turn.timestamp
      ? new Date(turn.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';
    timeLabel.textContent = `${turn.turn_id} · ${timeStr}`;

    meta.appendChild(speakerLabel);
    meta.appendChild(timeLabel);

    const textDiv = document.createElement('div');
    textDiv.className = 'turn-text';
    textDiv.textContent = turn.verbatim_text;

    bubble.appendChild(meta);
    bubble.appendChild(textDiv);

    // Direct user-gesture listen button on every interviewer bubble for reliable iOS Safari playback
    if (turn.speaker === 'INTERVIEWER_AI') {
      const footer = document.createElement('div');
      footer.className = 'turn-footer-actions';
      const listenBtn = document.createElement('button');
      listenBtn.type = 'button';
      listenBtn.className = 'turn-listen-btn';
      listenBtn.textContent = '🔊 Read Question Aloud';
      listenBtn.addEventListener('click', () => {
        unlockIosAudioOnUserGesture();
        speakSpecificText(turn.verbatim_text);
      });
      footer.appendChild(listenBtn);
      bubble.appendChild(footer);
    }

    transcriptFeed.appendChild(bubble);
  }

  scrollToLatestTurn();

  // Update active objective pill
  const lastInterviewer = [...turns].reverse().find(t => t.speaker === 'INTERVIEWER_AI');
  const activeObjId =
    redirectObjectiveId ||
    (lastInterviewer && lastInterviewer.objective_ids_targeted?.[0]);
  const activeObj = (currentSession.objectives || []).find(o => o.objective_id === activeObjId);
  if (activeObj) {
    activeObjectivePill.textContent = `Objective ${activeObj.code} · ${activeObj.title}`;
  } else {
    activeObjectivePill.textContent = 'Adaptive Synthesis';
  }
}

function scrollToLatestTurn() {
  requestAnimationFrame(() => {
    transcriptFeed.scrollTop = transcriptFeed.scrollHeight;
  });
}

function renderObjectivesAndLedger() {
  const objectives = currentSession.objectives || [];
  const sufficientCount = objectives.filter(o => o.coverage_status === 'SUFFICIENT').length;
  coverageCounterBadge.textContent = `${sufficientCount} / ${objectives.length} Sufficient`;

  objectiveList.innerHTML = '';
  for (const obj of objectives) {
    const li = document.createElement('li');
    li.className = 'objective-item';
    li.title = 'Tap to redirect conversation to this objective';

    const top = document.createElement('div');
    top.className = 'objective-item-top';

    const titleSpan = document.createElement('span');
    titleSpan.textContent = `${obj.code}. ${obj.title}`;

    const badge = document.createElement('span');
    badge.className = `status-badge status-${obj.coverage_status}`;
    badge.textContent = obj.coverage_status.replace(/_/g, ' ');

    top.appendChild(titleSpan);
    top.appendChild(badge);
    li.appendChild(top);

    li.addEventListener('click', () => {
      redirectObjectiveId = obj.objective_id;
      activeObjectivePill.textContent = `Redirecting to Objective ${obj.code} · ${obj.title}`;
      composerHint.textContent = `Redirected to "${obj.title}": ${obj.seed_questions?.[0] || obj.description}`;
      scrollElementToTopSmooth(turnComposerForm);
      participantInput.focus();
    });

    objectiveList.appendChild(li);
  }

  const activeHumanStmts = (currentSession.epistemic_ledger?.participant_statements || []).filter(
    s => s.participant_review_status !== 'EXCLUDED_BY_PARTICIPANT'
  );
  const machineInterps = currentSession.epistemic_ledger?.machine_interpretations || [];

  humanStatementsCount.textContent = String(activeHumanStmts.length);
  machineInterpsCount.textContent = String(machineInterps.length);
}

// ----------------------------------------------------------------------------
// Animated AI Processing Feedback & Optimistic Turn Rendering
// ----------------------------------------------------------------------------
function appendOptimisticTurnAndProcessingCard(participantText, onRetryCallback) {
  // 1. Optimistic Participant Bubble
  const userBubble = document.createElement('div');
  userBubble.className = 'turn-bubble turn-participant';
  const meta = document.createElement('div');
  meta.className = 'turn-meta';
  const speakerLabel = document.createElement('span');
  speakerLabel.className = 'turn-speaker';
  speakerLabel.textContent = currentSession?.participant?.name || 'You';
  const timeLabel = document.createElement('span');
  timeLabel.textContent = 'Sending…';
  meta.appendChild(speakerLabel);
  meta.appendChild(timeLabel);

  const textDiv = document.createElement('div');
  textDiv.className = 'turn-text';
  textDiv.textContent = participantText;
  userBubble.appendChild(meta);
  userBubble.appendChild(textDiv);
  transcriptFeed.appendChild(userBubble);

  // 2. Animated AI Processing Card
  const aiCard = document.createElement('div');
  aiCard.className = 'ai-processing-card';
  aiCard.id = 'activeAiProcessingCard';
  aiCard.setAttribute('role', 'status');
  aiCard.setAttribute('aria-live', 'polite');

  aiCard.innerHTML = `
    <div class="ai-processing-top">
      <div class="ai-processing-title">
        <span class="ai-spinner" aria-hidden="true"></span>
        <span>OWEN AI Interviewer</span>
      </div>
      <span class="ai-elapsed-timer" id="aiElapsedTimer">0.0s</span>
    </div>
    <p class="ai-processing-stage" id="aiProcessingStageText">
      Receiving &amp; recording your response…
    </p>
    <div class="ai-progress-track">
      <div class="ai-progress-bar"></div>
    </div>
    <div class="ai-slow-retry-bar hidden" id="aiSlowRetryBar">
      <span>Taking longer than expected on this connection.</span>
      <button type="button" class="btn btn-secondary btn-sm" id="aiRetryTurnBtn">
        Retry Turn
      </button>
    </div>
  `;

  transcriptFeed.appendChild(aiCard);
  scrollToLatestTurn();

  const stageTextEl = aiCard.querySelector('#aiProcessingStageText');
  const timerEl = aiCard.querySelector('#aiElapsedTimer');
  const slowRetryBar = aiCard.querySelector('#aiSlowRetryBar');
  const retryBtn = aiCard.querySelector('#aiRetryTurnBtn');

  if (retryBtn && typeof onRetryCallback === 'function') {
    retryBtn.addEventListener('click', () => {
      onRetryCallback();
    });
  }

  const startMs = Date.now();
  if (activeTurnTimerInterval) {
    clearInterval(activeTurnTimerInterval);
  }

  activeTurnTimerInterval = setInterval(() => {
    const elapsedSec = (Date.now() - startMs) / 1000;
    if (timerEl) {
      timerEl.textContent = `${elapsedSec.toFixed(1)}s`;
    }
    if (stageTextEl) {
      if (elapsedSec < 1.1) {
        stageTextEl.textContent = 'Receiving & recording your response…';
      } else if (elapsedSec < 4.5) {
        stageTextEl.textContent = 'Evaluating insights & preparing next question…';
      } else {
        stageTextEl.textContent = 'Synthesizing adaptive follow-up question…';
      }
    }
    if (slowRetryBar && elapsedSec >= 11.5) {
      slowRetryBar.classList.remove('hidden');
    }
  }, 200);
}

function clearProcessingCardTimer() {
  if (activeTurnTimerInterval) {
    clearInterval(activeTurnTimerInterval);
    activeTurnTimerInterval = null;
  }
  const existingCard = document.getElementById('activeAiProcessingCard');
  if (existingCard) {
    existingCard.remove();
  }
}

// ----------------------------------------------------------------------------
// Render OWEN Experience Brief & Participant Review Controls
// ----------------------------------------------------------------------------
function renderExperienceBrief(brief) {
  if (!brief) return;

  updateDynamicAttributionLabels();

  briefExecutiveSummary.textContent = brief.interview_overview?.executive_summary || '';
  const pub = brief.review_and_publication_status || {};
  briefPubStatusText.textContent = pub.status || 'DRAFT_PENDING_REVIEW';
  briefScopeText.textContent = pub.propagation_scope || 'project_only';
  briefStewardStatusText.textContent = pub.human_steward_approved
    ? `Approved (${pub.approved_by_steward_actor_id})`
    : 'Awaiting Joseph Van Harken Steward Review (Unpublished)';

  if (pub.attribution_preference) {
    reviewAttributionSelect.value = pub.attribution_preference;
  }

  // Layer 2: Direct Participant Statements
  directStatementsContainer.innerHTML = '';
  const statements = brief.direct_statements_and_evidence || [];
  if (statements.length === 0) {
    directStatementsContainer.innerHTML =
      '<p class="section-caption">No attributed statements recorded yet (or all statements excluded).</p>';
  } else {
    for (const stmt of statements) {
      const card = document.createElement('div');
      card.className = 'statement-card';

      const meta = document.createElement('div');
      meta.className = 'statement-meta';
      meta.innerHTML = `<span><strong>${escapeHtml(stmt.statement_id)}</strong> · Source Turn: <code>${escapeHtml(stmt.turn_id)}</code> · Epistemic Type: <code>${escapeHtml(stmt.epistemic_type)}</code></span><span>Status: <strong>${escapeHtml(stmt.participant_review_status)}</strong></span>`;

      const claimP = document.createElement('p');
      claimP.style.margin = '4px 0';
      claimP.style.fontWeight = '600';
      claimP.textContent = stmt.corrected_text || stmt.paraphrased_claim;

      const quoteDiv = document.createElement('div');
      quoteDiv.className = 'statement-quote';
      quoteDiv.textContent = `"${stmt.verbatim_quote}"`;

      const actions = document.createElement('div');
      actions.className = 'statement-actions';

      const amendBtn = document.createElement('button');
      amendBtn.type = 'button';
      amendBtn.className = 'btn btn-secondary btn-touch';
      amendBtn.textContent = '✏️ Amend Statement';
      amendBtn.addEventListener('click', () => handleAmendStatement(stmt));

      const excludeBtn = document.createElement('button');
      excludeBtn.type = 'button';
      excludeBtn.className = 'btn btn-danger btn-touch';
      excludeBtn.textContent = '🗑️ Exclude from Brief';
      excludeBtn.addEventListener('click', () => handleExcludeStatement(stmt));

      actions.appendChild(amendBtn);
      actions.appendChild(excludeBtn);

      card.appendChild(meta);
      card.appendChild(claimP);
      card.appendChild(quoteDiv);
      card.appendChild(actions);
      directStatementsContainer.appendChild(card);
    }
  }

  // Layer 3: OWEN Lessons & McKinsey Similarities
  owenLessonsContainer.innerHTML = '';
  const lessons = brief.lessons_relevant_to_owen || [];
  for (const les of lessons) {
    const card = document.createElement('div');
    card.className = 'lesson-card';
    card.innerHTML = `
      <div class="statement-meta">
        <span><strong>${escapeHtml(les.lesson_id)}</strong> · Origin: <code>${escapeHtml(les.author_origin)}</code> · Supporting Turns: <code>${escapeHtml((les.supporting_turn_ids || []).join(', '))}</code></span>
        <span>Confidence: <strong>${escapeHtml(les.confidence)}</strong></span>
      </div>
      <p style="margin: 4px 0;"><strong>Observed Pattern:</strong> ${escapeHtml(les.lesson)}</p>
      <p style="margin: 4px 0; color: #38bdf8;"><strong>OWEN Architectural Implication:</strong> ${escapeHtml(les.design_implication)}</p>
    `;
    owenLessonsContainer.appendChild(card);
  }

  // Gaps
  briefGapsList.innerHTML = '';
  for (const gap of brief.potential_architectural_gaps || []) {
    const li = document.createElement('li');
    li.innerHTML = `<strong>${escapeHtml(gap.gap_description)}</strong> — <em>Mitigation:</em> ${escapeHtml(gap.recommended_mitigation)}`;
    briefGapsList.appendChild(li);
  }

  // Recommended Experiments
  briefExperimentsList.innerHTML = '';
  for (const exp of brief.recommended_experiments || []) {
    const li = document.createElement('li');
    li.innerHTML = `<strong>${escapeHtml(exp.experiment_title)}:</strong> ${escapeHtml(exp.hypothesis_statement)} (Signal: ${escapeHtml(exp.target_signal)})`;
    briefExperimentsList.appendChild(li);
  }

  // Uncertainties & Tensions
  briefUncertaintiesList.innerHTML = '';
  const uncertainties = brief.contradictions_and_uncertainty || [];
  if (uncertainties.length === 0) {
    briefUncertaintiesList.innerHTML = '<li>No unresolved contradictions recorded.</li>';
  } else {
    for (const unc of uncertainties) {
      const li = document.createElement('li');
      li.innerHTML = `<strong>[${escapeHtml(unc.status)}] ${escapeHtml(unc.topic)}:</strong> ${escapeHtml(unc.description)}`;
      briefUncertaintiesList.appendChild(li);
    }
  }

  // Unresolved Follow-ups
  briefFollowupsList.innerHTML = '';
  const followups = brief.unresolved_followup_questions || [];
  if (followups.length === 0) {
    briefFollowupsList.innerHTML = '<li>All primary inquiry objectives reached sufficient coverage.</li>';
  } else {
    for (const q of followups) {
      const li = document.createElement('li');
      li.textContent = q;
      briefFollowupsList.appendChild(li);
    }
  }
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ----------------------------------------------------------------------------
// Event Listeners
// ----------------------------------------------------------------------------
tokenAuthForm.addEventListener('submit', async e => {
  e.preventDefault();
  authErrorMsg.classList.add('hidden');
  const candidate = inviteTokenInput.value.trim();
  if (!candidate) return;

  activeToken = candidate;
  try {
    await loadSession();
    sessionStorage.setItem(STORAGE_TOKEN_KEY, activeToken);
  } catch (err) {
    activeToken = '';
    authErrorMsg.textContent = err.message || 'Invalid invitation token.';
    authErrorMsg.classList.remove('hidden');
  }
});

consentForm.addEventListener('submit', async e => {
  e.preventDefault();
  consentErrorMsg.classList.add('hidden');

  // Unlock iOS Safari speech synthesis synchronously on user gesture if audio consent is checked
  if (consentAudioCheck.checked) {
    unlockIosAudioOnUserGesture();
  }

  const submitBtn = document.getElementById('startInterviewBtn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Recording Consent & Starting Interview…';
  }

  try {
    const data = await apiFetch('/api/owen/interview/consent', {
      method: 'POST',
      body: JSON.stringify({
        session_id: activeSessionId,
        transcript_capture_consented: consentTranscriptCheck.checked,
        audio_recording_consented: consentAudioCheck.checked,
        synthetic_voice_acknowledged: ackAiDisclosureCheck.checked,
        attribution_preference: initialAttributionSelect.value
      })
    });
    currentSession = data.session;
    renderSessionState(data.voice_audio, { scrollToTop: true });
  } catch (err) {
    consentErrorMsg.textContent = err.message;
    consentErrorMsg.classList.remove('hidden');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Grant Consent & Begin Adaptive Interview';
    }
  }
});

async function submitParticipantResponse(textToSubmit, clientRequestId, modalityToSubmit) {
  if (isSubmittingTurn) return;
  isSubmittingTurn = true;
  turnErrorMsg.classList.add('hidden');

  // Stop active dictation if user hit Send while microphone was still open
  if (dictationState === 'LISTENING' && speechRecognition) {
    try {
      speechRecognition.stop();
    } catch {}
    setDictationUiState('IDLE');
  }

  sendTurnBtn.disabled = true;
  sendTurnBtn.textContent = 'Processing…';
  participantInput.disabled = true;

  appendOptimisticTurnAndProcessingCard(textToSubmit, () => {
    isSubmittingTurn = false;
    clearProcessingCardTimer();
    renderTranscript();
    submitParticipantResponse(textToSubmit, clientRequestId, modalityToSubmit);
  });

  try {
    const payload = {
      session_id: activeSessionId,
      participant_text: textToSubmit,
      modality: modalityToSubmit,
      control_action: 'RESPOND',
      redirect_objective_id: redirectObjectiveId || undefined,
      provider_metadata: {
        client_request_id: clientRequestId
      }
    };

    const data = await apiFetch('/api/owen/interview/turn', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    clearProcessingCardTimer();
    participantInput.value = '';
    redirectObjectiveId = null;
    usedVoiceDictationForCurrentDraft = false;
    composerHint.textContent =
      'Share firsthand examples, nuances, or redirect to any topic at any time.';
    currentSession = data.session;
    renderSessionState(data.voice_audio);
  } catch (err) {
    clearProcessingCardTimer();
    renderTranscript();
    turnErrorMsg.textContent = `${err.message || 'Turn request failed.'} Your draft response is preserved above—tap Send Response to retry.`;
    turnErrorMsg.classList.remove('hidden');
  } finally {
    isSubmittingTurn = false;
    sendTurnBtn.disabled = false;
    sendTurnBtn.textContent = 'Send Response';
    participantInput.disabled = false;
  }
}

turnComposerForm.addEventListener('submit', async e => {
  e.preventDefault();
  const text = participantInput.value.trim();
  if (!text || isSubmittingTurn) return;

  // Prime iOS Safari audio on submit gesture if Auto-Read is enabled
  if (readAloudEnabled) {
    unlockIosAudioOnUserGesture();
  }

  const clientRequestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const modality = usedVoiceDictationForCurrentDraft ? 'VOICE_TRANSCRIPT' : 'TEXT';
  await submitParticipantResponse(text, clientRequestId, modality);
});

skipQuestionBtn.addEventListener('click', async () => {
  if (isSubmittingTurn) return;
  skipQuestionBtn.disabled = true;
  try {
    const data = await apiFetch('/api/owen/interview/turn', {
      method: 'POST',
      body: JSON.stringify({
        session_id: activeSessionId,
        control_action: 'SKIP_OBJECTIVE',
        redirect_objective_id: redirectObjectiveId || undefined
      })
    });
    redirectObjectiveId = null;
    currentSession = data.session;
    renderSessionState(data.voice_audio);
  } catch (err) {
    turnErrorMsg.textContent = err.message;
    turnErrorMsg.classList.remove('hidden');
  } finally {
    skipQuestionBtn.disabled = false;
  }
});

async function togglePauseOrResume() {
  if (isSubmittingTurn) return;
  const action = currentSession?.status === 'PAUSED' ? 'RESUME_SESSION' : 'PAUSE_SESSION';
  pauseResumeBtn.disabled = true;
  try {
    const data = await apiFetch('/api/owen/interview/turn', {
      method: 'POST',
      body: JSON.stringify({
        session_id: activeSessionId,
        control_action: action
      })
    });
    currentSession = data.session;
    renderSessionState(data.voice_audio, {
      scrollToTop: action === 'RESUME_SESSION'
    });
  } catch (err) {
    turnErrorMsg.textContent = err.message;
    turnErrorMsg.classList.remove('hidden');
  } finally {
    pauseResumeBtn.disabled = false;
  }
}

pauseResumeBtn.addEventListener('click', togglePauseOrResume);
resumeBannerBtn.addEventListener('click', togglePauseOrResume);

endInterviewBtn.addEventListener('click', async () => {
  if (isSubmittingTurn) return;
  endInterviewBtn.disabled = true;
  endInterviewBtn.textContent = 'Generating Experience Brief…';
  try {
    const pendingText = participantInput.value.trim();
    const data = await apiFetch('/api/owen/interview/turn', {
      method: 'POST',
      body: JSON.stringify({
        session_id: activeSessionId,
        participant_text: pendingText || undefined,
        control_action: 'END_INTERVIEW'
      })
    });
    participantInput.value = '';
    currentSession = data.session;
    renderSessionState();
  } catch (err) {
    turnErrorMsg.textContent = err.message;
    turnErrorMsg.classList.remove('hidden');
  } finally {
    endInterviewBtn.disabled = false;
    endInterviewBtn.textContent = '⏹️ End & Review Brief';
  }
});

viewDraftBriefBtn.addEventListener('click', async () => {
  viewDraftBriefBtn.disabled = true;
  viewDraftBriefBtn.textContent = 'Opening Experience Brief…';
  try {
    const data = await apiFetch('/api/owen/interview/brief', {
      method: 'POST',
      body: JSON.stringify({ session_id: activeSessionId })
    });
    currentSession = data.session;
    renderExperienceBrief(data.experience_brief);
    showStage('BRIEF', { scrollToTop: true });
  } catch (err) {
    turnErrorMsg.textContent = err.message;
    turnErrorMsg.classList.remove('hidden');
  } finally {
    viewDraftBriefBtn.disabled = false;
    viewDraftBriefBtn.textContent = 'Open OWEN Experience Brief & Review';
  }
});

backToConversationBtn.addEventListener('click', () => {
  showStage('INTERVIEW', { scrollToTop: true });
  scrollToLatestTurn();
});

// ----------------------------------------------------------------------------
// Participant Statement Corrections & Attribution Controls
// ----------------------------------------------------------------------------
async function handleAmendStatement(stmt) {
  const updatedText = window.prompt(
    'Amend your attributed statement for the OWEN Experience Brief:',
    stmt.corrected_text || stmt.paraphrased_claim
  );
  if (!updatedText || !updatedText.trim()) return;

  try {
    const data = await apiFetch('/api/owen/interview/review', {
      method: 'POST',
      body: JSON.stringify({
        session_id: activeSessionId,
        target_statement_id: stmt.statement_id,
        action: 'AMEND_STATEMENT',
        corrected_text: updatedText.trim(),
        rationale: 'Participant amended statement wording during review.'
      })
    });
    currentSession = data.session;
    renderExperienceBrief(data.experience_brief);
    showReviewFeedback('Statement amended and Experience Brief updated.');
  } catch (err) {
    showReviewFeedback(err.message, true);
  }
}

async function handleExcludeStatement(stmt) {
  try {
    const data = await apiFetch('/api/owen/interview/review', {
      method: 'POST',
      body: JSON.stringify({
        session_id: activeSessionId,
        target_statement_id: stmt.statement_id,
        action: 'EXCLUDE_STATEMENT',
        rationale: 'Excluded by participant during brief review.'
      })
    });
    currentSession = data.session;
    renderExperienceBrief(data.experience_brief);
    showReviewFeedback(`Statement ${stmt.statement_id} excluded from the Experience Brief.`);
  } catch (err) {
    showReviewFeedback(err.message, true);
  }
}

saveAttributionBtn.addEventListener('click', async () => {
  try {
    const data = await apiFetch('/api/owen/interview/review', {
      method: 'POST',
      body: JSON.stringify({
        session_id: activeSessionId,
        action: 'CHANGE_ATTRIBUTION',
        attribution_preference: reviewAttributionSelect.value,
        rationale: 'Participant updated attribution preference.'
      })
    });
    currentSession = data.session;
    renderExperienceBrief(data.experience_brief);
    showReviewFeedback(`Attribution preference updated to ${reviewAttributionSelect.value}.`);
  } catch (err) {
    showReviewFeedback(err.message, true);
  }
});

addClarificationBtn.addEventListener('click', async () => {
  const text = addClarificationInput.value.trim();
  if (!text) return;

  try {
    const data = await apiFetch('/api/owen/interview/review', {
      method: 'POST',
      body: JSON.stringify({
        session_id: activeSessionId,
        action: 'ADD_CLARIFICATION',
        corrected_text: text,
        rationale: 'Participant added post-interview clarification.'
      })
    });
    addClarificationInput.value = '';
    currentSession = data.session;
    renderExperienceBrief(data.experience_brief);
    showReviewFeedback('Clarification added to your attributed statements.');
  } catch (err) {
    showReviewFeedback(err.message, true);
  }
});

function showReviewFeedback(msg, isError = false) {
  reviewFeedbackMsg.textContent = msg;
  reviewFeedbackMsg.style.color = isError ? '#fda4af' : '#10b981';
  reviewFeedbackMsg.classList.remove('hidden');
}

// ----------------------------------------------------------------------------
// iOS Safari-Compatible Read-Aloud & Audio Controls
// ----------------------------------------------------------------------------
function setAudioStatus(message, isSpeaking = false, showRow = true) {
  if (!audioStatusRow || !audioStatusText) return;
  audioStatusText.textContent = message;
  if (audioStatusDot) {
    audioStatusDot.classList.toggle('speaking', Boolean(isSpeaking));
  }
  audioStatusRow.classList.toggle('hidden', !showRow);
}

/**
 * Unlocks WebKit / iOS Safari SpeechSynthesis and AudioContext synchronously
 * inside a direct user tap event so subsequent speech synthesis is permitted.
 */
function unlockIosAudioOnUserGesture() {
  if (iosAudioUnlocked) return;
  try {
    if ('speechSynthesis' in window) {
      const silentUtterance = new SpeechSynthesisUtterance('');
      silentUtterance.volume = 0;
      window.speechSynthesis.speak(silentUtterance);
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      setTimeout(() => ctx.close().catch(() => {}), 250);
    }
    iosAudioUnlocked = true;
  } catch {}
}

function getLatestInterviewerQuestionText() {
  const turns = currentSession?.turns || [];
  const lastInterviewer = [...turns].reverse().find(t => t.speaker === 'INTERVIEWER_AI');
  return lastInterviewer ? lastInterviewer.verbatim_text : '';
}

function stopAllSpokenPlayback() {
  if (activeHtmlAudio) {
    try {
      activeHtmlAudio.pause();
      activeHtmlAudio.currentTime = 0;
    } catch {}
    activeHtmlAudio = null;
  }
  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }
  isAudioPlaying = false;
  isAudioPaused = false;
  if (playPromptBtn) {
    playPromptBtn.textContent = '▶️ Play Question';
  }
  if (stopPromptBtn) {
    stopPromptBtn.classList.add('hidden');
  }
}

function speakSpecificText(textToSpeak, voiceAudio = null) {
  if (!textToSpeak) {
    setAudioStatus('No interviewer question available to read aloud yet.', false, true);
    return;
  }

  stopAllSpokenPlayback();

  if (voiceAudio && voiceAudio.audioBase64) {
    try {
      activeHtmlAudio = new Audio(
        `data:${voiceAudio.mimeType || 'audio/mpeg'};base64,${voiceAudio.audioBase64}`
      );
      activeHtmlAudio.onplay = () => {
        isAudioPlaying = true;
        isAudioPaused = false;
        playPromptBtn.textContent = '⏸️ Pause Audio';
        stopPromptBtn.classList.remove('hidden');
        setAudioStatus('Speaking interviewer question (ElevenLabs synthetic voice)…', true, true);
      };
      activeHtmlAudio.onended = () => {
        stopAllSpokenPlayback();
        setAudioStatus('Audio playback finished.', false, readAloudEnabled);
      };
      activeHtmlAudio.onerror = () => {
        stopAllSpokenPlayback();
        setAudioStatus('Audio playback unavailable; falling back to browser speech.', false, true);
      };
      activeHtmlAudio.play().catch(err => {
        setAudioStatus(
          `Tap "▶️ Play Question" to allow audio playback in Safari (${err?.message || 'autoplay blocked'}).`,
          false,
          true
        );
      });
      return;
    } catch {}
  }

  if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
    setAudioStatus('Browser speech synthesis is not supported on this device.', false, true);
    return;
  }

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = 1.02;
    utterance.lang = 'en-US';

    utterance.onstart = () => {
      isAudioPlaying = true;
      isAudioPaused = false;
      playPromptBtn.textContent = '⏸️ Pause Audio';
      stopPromptBtn.classList.remove('hidden');
      setAudioStatus('Reading interviewer question aloud… (Check iPhone silent switch if muted)', true, true);
    };

    utterance.onend = () => {
      stopAllSpokenPlayback();
      setAudioStatus('Auto-Read active: new questions will be read aloud.', false, readAloudEnabled);
    };

    utterance.onerror = event => {
      stopAllSpokenPlayback();
      if (event?.error !== 'canceled' && event?.error !== 'interrupted') {
        setAudioStatus(
          'Tap "▶️ Play Question" directly to start iPhone Safari audio playback.',
          false,
          true
        );
      }
    };

    window.speechSynthesis.speak(utterance);
  } catch {
    setAudioStatus('Unable to start browser speech synthesis. Tap "▶️ Play Question" to retry.', false, true);
  }
}

function playInterviewerPrompt({ voiceAudio = null, force = false } = {}) {
  if (!readAloudEnabled && !force) return;
  const questionText = getLatestInterviewerQuestionText();
  speakSpecificText(questionText, voiceAudio);
}

toggleTtsBtn.addEventListener('click', () => {
  unlockIosAudioOnUserGesture();
  readAloudEnabled = !readAloudEnabled;
  toggleTtsBtn.textContent = `🔊 Auto-Read: ${readAloudEnabled ? 'On' : 'Off'}`;
  toggleTtsBtn.setAttribute('aria-pressed', String(readAloudEnabled));
  toggleTtsBtn.classList.toggle('active-toggle', readAloudEnabled);

  if (readAloudEnabled) {
    playInterviewerPrompt({ force: true });
  } else {
    stopAllSpokenPlayback();
    setAudioStatus('Auto-Read turned off.', false, false);
  }
});

playPromptBtn.addEventListener('click', () => {
  unlockIosAudioOnUserGesture();

  if (isAudioPlaying && !isAudioPaused) {
    if (activeHtmlAudio) {
      activeHtmlAudio.pause();
    } else if ('speechSynthesis' in window) {
      window.speechSynthesis.pause();
    }
    isAudioPaused = true;
    playPromptBtn.textContent = '▶️ Resume Audio';
    setAudioStatus('Audio paused.', false, true);
    return;
  }

  if (isAudioPaused) {
    if (activeHtmlAudio) {
      activeHtmlAudio.play().catch(() => {});
    } else if ('speechSynthesis' in window) {
      window.speechSynthesis.resume();
    }
    isAudioPaused = false;
    playPromptBtn.textContent = '⏸️ Pause Audio';
    setAudioStatus('Reading interviewer question aloud…', true, true);
    return;
  }

  playInterviewerPrompt({ force: true });
});

stopPromptBtn.addEventListener('click', () => {
  stopAllSpokenPlayback();
  setAudioStatus('Audio stopped.', false, readAloudEnabled);
});

// ----------------------------------------------------------------------------
// Prominent Voice Dictation (Speech-to-Text)
// ----------------------------------------------------------------------------
function setDictationUiState(newState, statusMessage = '') {
  dictationState = newState;
  voiceDictateBtn.classList.remove('listening', 'processing');

  if (newState === 'LISTENING') {
    voiceDictateBtn.classList.add('listening');
    voiceDictateBtn.textContent = '🔴 Stop Speaking';
    voiceDictateBtn.setAttribute('aria-pressed', 'true');
    dictationStatusBanner.classList.remove('hidden');
    dictationStatusText.textContent =
      statusMessage || 'Listening… Speak naturally, then tap "Stop Speaking" when finished.';
  } else if (newState === 'PROCESSING') {
    voiceDictateBtn.classList.add('processing');
    voiceDictateBtn.textContent = '⏳ Processing Speech…';
    voiceDictateBtn.setAttribute('aria-pressed', 'false');
    dictationStatusBanner.classList.remove('hidden');
    dictationStatusText.textContent =
      statusMessage || 'Finalizing spoken transcript… You can edit the text below before sending.';
  } else {
    voiceDictateBtn.textContent = '🎙️ Start Speaking';
    voiceDictateBtn.setAttribute('aria-pressed', 'false');
    if (statusMessage) {
      dictationStatusBanner.classList.remove('hidden');
      dictationStatusText.textContent = statusMessage;
    } else {
      dictationStatusBanner.classList.add('hidden');
    }
  }
}

function setupSpeechDictation() {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRec) {
    voiceDictateBtn.addEventListener('click', () => {
      setDictationUiState(
        'IDLE',
        'Browser speech recognition is unavailable in this browser. Tip: On iPhone, tap the text box below and tap the microphone key on the iOS keyboard to dictate.'
      );
      participantInput.focus();
    });
    return;
  }

  speechRecognition = new SpeechRec();
  speechRecognition.continuous = true;
  speechRecognition.interimResults = true;
  speechRecognition.lang = 'en-US';

  speechRecognition.onstart = () => {
    preDictationText = participantInput.value.trim();
    setDictationUiState(
      'LISTENING',
      'Listening… Speak naturally. Words will appear in the response box below so you can review or edit before sending.'
    );
  };

  speechRecognition.onresult = event => {
    let finalChunk = '';
    let interimChunk = '';
    for (let i = 0; i < event.results.length; i += 1) {
      const res = event.results[i];
      const transcriptPiece = res[0]?.transcript || '';
      if (res.isFinal) {
        finalChunk += `${transcriptPiece} `;
      } else {
        interimChunk += transcriptPiece;
      }
    }

    const combinedSpoken = `${finalChunk}${interimChunk}`.trim();
    if (combinedSpoken) {
      participantInput.value = preDictationText
        ? `${preDictationText} ${combinedSpoken}`
        : combinedSpoken;
      usedVoiceDictationForCurrentDraft = true;
    }
  };

  speechRecognition.onerror = event => {
    const errCode = event?.error || 'unknown';
    if (errCode === 'not-allowed' || errCode === 'service-not-allowed') {
      setDictationUiState(
        'IDLE',
        'Microphone permission was denied. Please enable microphone access in Safari settings or use the iPhone keyboard microphone button.'
      );
    } else if (errCode === 'no-speech') {
      setDictationUiState('IDLE', 'No speech detected. Tap "🎙️ Start Speaking" to try again.');
    } else {
      setDictationUiState('IDLE', `Voice dictation paused (${errCode}). You can edit your text below or tap Start Speaking again.`);
    }
  };

  speechRecognition.onend = () => {
    if (dictationState === 'LISTENING' || dictationState === 'PROCESSING') {
      setDictationUiState(
        'IDLE',
        participantInput.value.trim()
          ? 'Dictation captured. Review or edit your response below, then tap Send Response.'
          : ''
      );
    }
  };

  voiceDictateBtn.addEventListener('click', () => {
    if (!currentSession?.consent?.audio_recording_consented) {
      setDictationUiState(
        'IDLE',
        'Voice dictation requires Audio Processing Consent on the session consent screen.'
      );
      return;
    }

    if (dictationState === 'LISTENING') {
      setDictationUiState('PROCESSING', 'Finishing speech capture…');
      try {
        speechRecognition.stop();
      } catch {
        setDictationUiState('IDLE');
      }
      return;
    }

    try {
      speechRecognition.start();
    } catch {
      try {
        speechRecognition.stop();
      } catch {}
      setDictationUiState('IDLE');
    }
  });
}

// ----------------------------------------------------------------------------
// Workstream B: ElevenLabs Realtime Conversational Voice Mode (PoC)
// ----------------------------------------------------------------------------
async function refreshRealtimeVoiceStatus() {
  if (!realtimeVoiceStateBadge) return;
  realtimeVoiceErrorMsg.classList.add('hidden');
  try {
    const info = await apiFetch(
      `/api/owen/interview/voice-session?session_id=${encodeURIComponent(activeSessionId)}`
    );
    if (info.disclosure_statement && realtimeVoiceDisclosure) {
      realtimeVoiceDisclosure.textContent = info.disclosure_statement;
    }

    const cfg = info.configuration_status || {};
    if (cfg.conversationalAgentConfigured) {
      realtimeVoiceStateBadge.textContent = 'Ready · ElevenLabs Conversational Agent Configured';
      realtimeVoiceMetaText.textContent =
        'OWEN objectives & Layer 1 verbatim capture active · Voice cloning prohibited';
    } else {
      const missingList = (cfg.missingForRealtimeVoice || []).join(', ');
      realtimeVoiceStateBadge.textContent = `PoC Boundary Ready · Awaiting ${missingList || 'ElevenLabs Agent Config'}`;
      realtimeVoiceMetaText.textContent =
        'OWEN dynamic agent prompt override & signed WebSocket handshake ready';
    }
  } catch (err) {
    realtimeVoiceStateBadge.textContent = 'Voice Status Check Failed';
    realtimeVoiceErrorMsg.textContent = err.message;
    realtimeVoiceErrorMsg.classList.remove('hidden');
  }
}

if (toggleRealtimeVoiceBtn) {
  toggleRealtimeVoiceBtn.addEventListener('click', () => {
    const isHidden = realtimeVoiceDrawer.classList.contains('hidden');
    realtimeVoiceDrawer.classList.toggle('hidden', !isHidden);
    if (isHidden) {
      refreshRealtimeVoiceStatus();
    }
  });
}

if (closeRealtimeVoiceBtn) {
  closeRealtimeVoiceBtn.addEventListener('click', () => {
    disconnectRealtimeVoiceSession();
    realtimeVoiceDrawer.classList.add('hidden');
  });
}

function disconnectRealtimeVoiceSession() {
  if (realtimeVoiceSocket) {
    try {
      realtimeVoiceSocket.close();
    } catch {}
    realtimeVoiceSocket = null;
  }
  if (realtimeAudioStream) {
    try {
      realtimeAudioStream.getTracks().forEach(t => t.stop());
    } catch {}
    realtimeAudioStream = null;
  }
  isRealtimeMicMuted = false;
  if (startRealtimeVoiceBtn) startRealtimeVoiceBtn.classList.remove('hidden');
  if (muteRealtimeMicBtn) muteRealtimeMicBtn.classList.add('hidden');
  if (stopRealtimeVoiceBtn) stopRealtimeVoiceBtn.classList.add('hidden');
}

if (startRealtimeVoiceBtn) {
  startRealtimeVoiceBtn.addEventListener('click', async () => {
    realtimeVoiceErrorMsg.classList.add('hidden');
    unlockIosAudioOnUserGesture();
    startRealtimeVoiceBtn.disabled = true;
    startRealtimeVoiceBtn.textContent = 'Initializing Signed OWEN Voice Session…';

    try {
      const sessionInit = await apiFetch('/api/owen/interview/voice-session', {
        method: 'POST',
        body: JSON.stringify({ session_id: activeSessionId })
      });

      if (sessionInit.status !== 'READY' || !sessionInit.signedUrl) {
        const missing = (sessionInit.missingConfiguration || []).join(', ');
        realtimeVoiceStateBadge.textContent = `Awaiting Credentials (${sessionInit.status})`;
        realtimeVoiceErrorMsg.textContent =
          `OWEN dynamic voice agent override generated successfully (Objective target: ${(sessionInit.conversationOverride?.owen_governance?.active_objective_ids || []).join(', ')}), ` +
          `but live ElevenLabs WebSocket streaming requires provisioning [${missing}] in Cloudflare Pages secrets. Use "🎙️ Start Speaking" dictation + "🔊 Auto-Read" below in the meantime.`;
        realtimeVoiceErrorMsg.classList.remove('hidden');
        return;
      }

      // Request microphone stream and connect to signed ElevenLabs Conversational AI WebSocket
      realtimeAudioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      realtimeVoiceSocket = new WebSocket(sessionInit.signedUrl);

      realtimeVoiceSocket.onopen = () => {
        realtimeVoiceStateBadge.textContent = '🔴 Live ElevenLabs Voice Connected';
        startRealtimeVoiceBtn.classList.add('hidden');
        muteRealtimeMicBtn.classList.remove('hidden');
        stopRealtimeVoiceBtn.classList.remove('hidden');

        // Send OWEN dynamic conversation override so OWEN's objectives and disclosure govern the agent
        realtimeVoiceSocket.send(
          JSON.stringify({
            type: 'conversation_initiation_client_data',
            conversation_config_override: {
              agent: sessionInit.conversationOverride.agent,
              tts: sessionInit.conversationOverride.tts
            }
          })
        );
      };

      realtimeVoiceSocket.onmessage = async event => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'user_transcript' && msg.user_transcription_event?.user_transcript) {
            const spokenText = msg.user_transcription_event.user_transcript.trim();
            if (spokenText) {
              await submitParticipantResponse(
                spokenText,
                `el-voice-${Date.now()}`,
                'VOICE_TRANSCRIPT'
              );
            }
          }
        } catch {}
      };

      realtimeVoiceSocket.onclose = () => {
        disconnectRealtimeVoiceSession();
        realtimeVoiceStateBadge.textContent = 'Voice Session Disconnected (Switched to Text)';
      };
    } catch (err) {
      disconnectRealtimeVoiceSession();
      realtimeVoiceErrorMsg.textContent = err.message || 'Unable to start realtime voice session.';
      realtimeVoiceErrorMsg.classList.remove('hidden');
    } finally {
      startRealtimeVoiceBtn.disabled = false;
      startRealtimeVoiceBtn.textContent = '🎙️ Connect Live Voice Session';
    }
  });
}

if (muteRealtimeMicBtn) {
  muteRealtimeMicBtn.addEventListener('click', () => {
    if (!realtimeAudioStream) return;
    isRealtimeMicMuted = !isRealtimeMicMuted;
    realtimeAudioStream.getAudioTracks().forEach(track => {
      track.enabled = !isRealtimeMicMuted;
    });
    muteRealtimeMicBtn.textContent = isRealtimeMicMuted ? '🎙️ Unmute Mic' : '🔇 Mute Mic';
  });
}

if (stopRealtimeVoiceBtn) {
  stopRealtimeVoiceBtn.addEventListener('click', () => {
    disconnectRealtimeVoiceSession();
    realtimeVoiceStateBadge.textContent = 'Voice Session Ended · Continuing in Text Mode';
  });
}

initApp();
