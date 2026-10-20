/**
 * GET / POST /api/owen/interview/voice-session
 *
 * Workstream B: ElevenLabs Realtime Conversational AI Session Bridge
 *
 * - Enforces private invitation token authentication and rate limiting.
 * - Requires explicit participant consent for both transcript capture and audio recording.
 * - Never exposes raw ELEVENLABS_API_KEY to the browser.
 * - Never creates a new voice clone (uses only an existing voice_id / agent_id).
 * - Returns the OWEN-governed dynamic agent override (`conversationOverride`) and, when
 *   ELEVENLABS_API_KEY + ELEVENLABS_AGENT_ID are provisioned, a signed WebSocket URL
 *   for `@elevenlabs/client` (`Conversation.startSession`).
 */

import {
  corsHeaders,
  resolveAuthorizedPilotSession,
  buildErrorResponse
} from './service.js';

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    const { session, voiceAdapter } = await resolveAuthorizedPilotSession(request, env, null);
    const configStatus = voiceAdapter.getConfigurationStatus();
    const override = voiceAdapter.buildConversationalAgentOverride(session);

    return new Response(
      JSON.stringify({
        provider: 'elevenlabs-conversational-ai',
        allow_voice_cloning: voiceAdapter.allowVoiceCloning,
        configuration_status: configStatus,
        disclosure_statement: voiceAdapter.getDisclosureStatement(),
        consent_ready:
          session.consent.status === 'GRANTED' &&
          Boolean(session.consent.transcript_capture_consented) &&
          Boolean(session.consent.audio_recording_consented),
        conversation_override: override
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    return buildErrorResponse(
      err,
      'Unable to inspect ElevenLabs voice session status',
      400,
      'VOICE_SESSION_STATUS_ERROR'
    );
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json().catch(() => ({}));
    const { session, voiceAdapter } = await resolveAuthorizedPilotSession(request, env, body);

    const signedSession = await voiceAdapter.createSignedConversationSession(session);
    return new Response(JSON.stringify(signedSession), {
      status: 200,
      headers: corsHeaders
    });
  } catch (err) {
    return buildErrorResponse(
      err,
      'Unable to initialize ElevenLabs realtime voice session',
      400,
      'VOICE_SESSION_INIT_ERROR'
    );
  }
}
