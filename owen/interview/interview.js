/**
 * MindRiot Labs — OWEN Experience Acquisition Participant Client (/owen/interview/interview.js)
 *
 * Implements the participant-facing adaptive interview experience:
 * - Private invitation token authentication & interrupted-session recovery
 * - Explicit AI interviewer disclosure & dual consent gate (transcript + separate audio)
 * - Adaptive conversation turn stream, topic redirection, skip, pause/resume, and stop controls
 * - Optional browser voice dictation & spoken audio synthesis (when audio consent granted)
 * - Interactive OWEN Experience Brief viewer & participant statement amendment/exclusion controls
 */

const STORAGE_TOKEN_KEY = 'owen_pilot_001_invite_token';
const STORAGE_SESSION_ID_KEY = 'owen_pilot_001_session_id';

let activeToken = '';
let activeSessionId = 'ses-pilot-001-russ-richmond';
let currentSession = null;
let redirectObjectiveId = null;
let readAloudEnabled = false;
let speechRecognition = null;
let isDictating = false;

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
const consentErrorMsg = document.getElementById('consentErrorMsg');

const activeObjectivePill = document.getElementById('activeObjectivePill');
const toggleTtsBtn = document.getElementById('toggleTtsBtn');
const skipQuestionBtn = document.getElementById('skipQuestionBtn');
const pauseResumeBtn = document.getElementById('pauseResumeBtn');
const endInterviewBtn = document.getElementById('endInterviewBtn');
const pausedBanner = document.getElementById('pausedBanner');
const resumeBannerBtn = document.getElementById('resumeBannerBtn');
const transcriptFeed = document.getElementById('transcriptFeed');
const turnComposerForm = document.getElementById('turnComposerForm');
const composerHint = document.getElementById('composerHint');
const voiceDictateBtn = document.getElementById('voiceDictateBtn');
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

function showStage(stage) {
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
  } else if (stage === 'INTERVIEW') {
    interviewWorkspace.classList.remove('hidden');
    sessionStatusBadge.textContent =
      currentSession?.status === 'PAUSED' ? 'Session Paused' : 'Adaptive Interview Active';
  } else if (stage === 'BRIEF') {
    experienceBriefPanel.classList.remove('hidden');
    sessionStatusBadge.textContent = 'Experience Brief & Review';
  }
}

function renderSessionState(voiceAudio = null) {
  if (!currentSession) {
    showStage('AUTH');
    return;
  }

  consentParticipantName.textContent = currentSession.participant?.name || 'Participant';
  consentPurposeText.textContent = currentSession.purpose || '';
  aiDisclosureStatement.textContent =
    currentSession.interviewer_identity?.disclosure_statement || '';

  if (currentSession.consent?.status !== 'GRANTED') {
    showStage('CONSENT');
    return;
  }

  // Enable microphone dictation button only if participant consented to audio processing AND browser supports SpeechRecognition
  if (currentSession.consent.audio_recording_consented && speechRecognition) {
    voiceDictateBtn.classList.remove('hidden');
  } else {
    voiceDictateBtn.classList.add('hidden');
  }

  renderTranscript();
  renderObjectivesAndLedger();

  const isPaused = currentSession.status === 'PAUSED';
  pausedBanner.classList.toggle('hidden', !isPaused);
  pauseResumeBtn.textContent = isPaused ? 'Resume' : 'Pause';

  if (
    currentSession.status === 'COMPLETED' ||
    currentSession.status === 'STOPPED_BY_PARTICIPANT' ||
    currentSession.status === 'UNDER_PARTICIPANT_REVIEW' ||
    currentSession.status === 'AWAITING_STEWARD_AUTHORITY'
  ) {
    if (currentSession.experience_brief) {
      renderExperienceBrief(currentSession.experience_brief);
      showStage('BRIEF');
      return;
    }
  }

  showStage('INTERVIEW');
  playInterviewerVoiceIfEnabled(voiceAudio);
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
    transcriptFeed.appendChild(bubble);
  }

  transcriptFeed.scrollTop = transcriptFeed.scrollHeight;

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

function renderObjectivesAndLedger() {
  const objectives = currentSession.objectives || [];
  const sufficientCount = objectives.filter(o => o.coverage_status === 'SUFFICIENT').length;
  coverageCounterBadge.textContent = `${sufficientCount} / ${objectives.length} Sufficient`;

  objectiveList.innerHTML = '';
  for (const obj of objectives) {
    const li = document.createElement('li');
    li.className = 'objective-item';
    li.title = 'Click to redirect conversation to this objective';

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
// Render OWEN Experience Brief & Participant Review Controls
// ----------------------------------------------------------------------------
function renderExperienceBrief(brief) {
  if (!brief) return;

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
      meta.innerHTML = `<span><strong>${stmt.statement_id}</strong> · Source Turn: <code>${stmt.turn_id}</code> · Epistemic Type: <code>${stmt.epistemic_type}</code></span><span>Status: <strong>${stmt.participant_review_status}</strong></span>`;

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
      amendBtn.className = 'btn btn-secondary btn-sm';
      amendBtn.textContent = 'Amend Statement';
      amendBtn.addEventListener('click', () => handleAmendStatement(stmt));

      const excludeBtn = document.createElement('button');
      excludeBtn.type = 'button';
      excludeBtn.className = 'btn btn-danger btn-sm';
      excludeBtn.textContent = 'Exclude from Brief';
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
        <span><strong>${les.lesson_id}</strong> · Origin: <code>${les.author_origin}</code> · Supporting Turns: <code>${(les.supporting_turn_ids || []).join(', ')}</code></span>
        <span>Confidence: <strong>${les.confidence}</strong></span>
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
    renderSessionState(data.voice_audio);
  } catch (err) {
    consentErrorMsg.textContent = err.message;
    consentErrorMsg.classList.remove('hidden');
  }
});

turnComposerForm.addEventListener('submit', async e => {
  e.preventDefault();
  turnErrorMsg.classList.add('hidden');
  const text = participantInput.value.trim();
  if (!text) return;

  sendTurnBtn.disabled = true;
  sendTurnBtn.textContent = 'Analyzing...';

  try {
    const payload = {
      session_id: activeSessionId,
      participant_text: text,
      modality: isDictating ? 'VOICE_TRANSCRIPT' : 'TEXT',
      control_action: 'RESPOND',
      redirect_objective_id: redirectObjectiveId || undefined
    };

    const data = await apiFetch('/api/owen/interview/turn', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    participantInput.value = '';
    redirectObjectiveId = null;
    isDictating = false;
    composerHint.textContent =
      'Share firsthand examples, nuances, or redirect to any topic at any time.';
    currentSession = data.session;
    renderSessionState(data.voice_audio);
  } catch (err) {
    turnErrorMsg.textContent = err.message;
    turnErrorMsg.classList.remove('hidden');
  } finally {
    sendTurnBtn.disabled = false;
    sendTurnBtn.textContent = 'Send Response';
  }
});

skipQuestionBtn.addEventListener('click', async () => {
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
  }
});

async function togglePauseOrResume() {
  const action = currentSession?.status === 'PAUSED' ? 'RESUME_SESSION' : 'PAUSE_SESSION';
  try {
    const data = await apiFetch('/api/owen/interview/turn', {
      method: 'POST',
      body: JSON.stringify({
        session_id: activeSessionId,
        control_action: action
      })
    });
    currentSession = data.session;
    renderSessionState(data.voice_audio);
  } catch (err) {
    turnErrorMsg.textContent = err.message;
    turnErrorMsg.classList.remove('hidden');
  }
}

pauseResumeBtn.addEventListener('click', togglePauseOrResume);
resumeBannerBtn.addEventListener('click', togglePauseOrResume);

endInterviewBtn.addEventListener('click', async () => {
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
  }
});

viewDraftBriefBtn.addEventListener('click', async () => {
  try {
    const data = await apiFetch('/api/owen/interview/brief', {
      method: 'POST',
      body: JSON.stringify({ session_id: activeSessionId })
    });
    currentSession = data.session;
    renderExperienceBrief(data.experience_brief);
    showStage('BRIEF');
  } catch (err) {
    turnErrorMsg.textContent = err.message;
    turnErrorMsg.classList.remove('hidden');
  }
});

backToConversationBtn.addEventListener('click', () => {
  showStage('INTERVIEW');
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
// Optional Voice Dictation & Read-Aloud Synthesis
// ----------------------------------------------------------------------------
toggleTtsBtn.addEventListener('click', () => {
  readAloudEnabled = !readAloudEnabled;
  toggleTtsBtn.textContent = `Read Aloud: ${readAloudEnabled ? 'On' : 'Off'}`;
  if (!readAloudEnabled && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
});

function playInterviewerVoiceIfEnabled(voiceAudio) {
  if (!readAloudEnabled) return;

  if (voiceAudio && voiceAudio.audioBase64) {
    const audio = new Audio(`data:${voiceAudio.mimeType || 'audio/mpeg'};base64,${voiceAudio.audioBase64}`);
    audio.play().catch(() => {});
    return;
  }

  if ('speechSynthesis' in window && currentSession?.turns?.length > 0) {
    const lastTurn = currentSession.turns[currentSession.turns.length - 1];
    if (lastTurn.speaker === 'INTERVIEWER_AI') {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(lastTurn.verbatim_text);
      utterance.rate = 1.02;
      window.speechSynthesis.speak(utterance);
    }
  }
}

function setupSpeechDictation() {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRec) return;

  speechRecognition = new SpeechRec();
  speechRecognition.continuous = false;
  speechRecognition.interimResults = false;
  speechRecognition.lang = 'en-US';

  speechRecognition.onresult = event => {
    const transcript = event.results?.[0]?.[0]?.transcript || '';
    if (transcript) {
      participantInput.value = participantInput.value
        ? `${participantInput.value.trim()} ${transcript}`
        : transcript;
      isDictating = true;
    }
    voiceDictateBtn.textContent = '🎙️ Dictate Answer';
  };

  speechRecognition.onerror = () => {
    voiceDictateBtn.textContent = '🎙️ Dictate Answer';
  };

  speechRecognition.onend = () => {
    voiceDictateBtn.textContent = '🎙️ Dictate Answer';
  };

  voiceDictateBtn.addEventListener('click', () => {
    if (!currentSession?.consent?.audio_recording_consented) return;
    try {
      voiceDictateBtn.textContent = '🔴 Listening...';
      speechRecognition.start();
    } catch {
      voiceDictateBtn.textContent = '🎙️ Dictate Answer';
    }
  });
}

initApp();
