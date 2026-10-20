/**
 * POST /api/owen/interview/consent
 *
 * Records explicit participant informed consent (transcript capture + separate audio
 * recording consent + AI interviewer disclosure acknowledgment) or consent withdrawal.
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

    if (body.action === 'WITHDRAW_CONSENT') {
      const withdrawn = await agent.withdrawConsent(session.id, body.reason);
      return new Response(
        JSON.stringify(sanitizeSessionForClient(withdrawn)),
        { status: 200, headers: corsHeaders }
      );
    }

    const updated = await agent.grantConsent({
      session_id: session.id,
      transcript_capture_consented: Boolean(body.transcript_capture_consented),
      audio_recording_consented: Boolean(body.audio_recording_consented),
      synthetic_voice_acknowledged: Boolean(body.synthetic_voice_acknowledged),
      attribution_preference: body.attribution_preference || 'ATTRIBUTED'
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
    return buildErrorResponse(err, 'Consent update failed', 400, 'CONSENT_REQUIRED');
  }
}
