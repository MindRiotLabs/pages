/**
 * POST /api/owen/interview/turn
 *
 * Processes a participant response turn or session control action
 * (RESPOND, SKIP_OBJECTIVE, PAUSE_SESSION, RESUME_SESSION, END_INTERVIEW)
 * through the canonical OWEN ExperienceAcquisitionAgent.
 */

import {
  corsHeaders,
  resolveAuthorizedPilotSession,
  sanitizeSessionForClient,
  buildErrorResponse
} from './service.js';

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { session, agent, voiceAdapter } = await resolveAuthorizedPilotSession(
      request,
      env,
      body
    );

    const updated = await agent.processParticipantTurn({
      session_id: session.id,
      participant_text: body.participant_text,
      modality: body.modality || 'TEXT',
      control_action: body.control_action || 'RESPOND',
      redirect_objective_id: body.redirect_objective_id,
      provider_metadata: body.provider_metadata
    });

    let voiceAudio = null;
    if (
      voiceAdapter.isConfigured() &&
      updated.consent.audio_recording_consented &&
      updated.turns.length > 0
    ) {
      const lastTurn = updated.turns[updated.turns.length - 1];
      if (lastTurn.speaker === 'INTERVIEWER_AI') {
        voiceAudio = await voiceAdapter
          .synthesizeInterviewerSpeech(lastTurn.verbatim_text)
          .catch(() => null);
      }
    }

    return new Response(
      JSON.stringify(
        sanitizeSessionForClient(updated, {
          voice_audio: voiceAudio
        })
      ),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    return buildErrorResponse(err, 'Unable to process interview turn', 400, 'TURN_PROCESSING_ERROR');
  }
}
