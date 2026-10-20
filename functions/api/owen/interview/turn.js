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
  const requestStartMs = Date.now();

  try {
    const body = await request.json();
    const { session, agent, store, voiceAdapter } = await resolveAuthorizedPilotSession(
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

    const lastTurn = updated.turns[updated.turns.length - 1];
    const modelMs =
      typeof lastTurn?.provider_metadata?.latency_ms === 'number'
        ? lastTurn.provider_metadata.latency_ms
        : 0;

    const timingMetadata = {
      total_ms: Date.now() - requestStartMs,
      db_read_ms: store?.lastReadMs ?? 0,
      model_ms: modelMs,
      db_write_ms: store?.lastWriteMs ?? 0,
      db_reads: store?.readCount ?? 1,
      db_writes: store?.writeCount ?? 1,
      evaluation_source: lastTurn?.provider_metadata?.evaluation_source || 'none',
      model_id: lastTurn?.provider_metadata?.model_id || 'none',
      token_usage: lastTurn?.provider_metadata?.token_usage || null
    };

    return new Response(
      JSON.stringify(
        sanitizeSessionForClient(updated, {
          voice_audio: voiceAudio,
          timing_metadata: timingMetadata
        })
      ),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    return buildErrorResponse(err, 'Unable to process interview turn', 400, 'TURN_PROCESSING_ERROR');
  }
}
