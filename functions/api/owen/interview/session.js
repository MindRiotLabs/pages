/**
 * GET /api/owen/interview/session
 *
 * Authenticates the participant's private invitation token and returns the
 * current OWEN interview session state (supporting interrupted-session recovery).
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

export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    const { session, voiceAdapter, modelProvider } = await resolveAuthorizedPilotSession(
      request,
      env
    );

    return new Response(
      JSON.stringify(
        sanitizeSessionForClient(session, {
          capabilities: {
            voice_synthesis_available: voiceAdapter.isConfigured(),
            browser_speech_recognition_supported: true,
            model_provider: modelProvider.providerId,
            model_id: modelProvider.modelId
          }
        })
      ),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    return buildErrorResponse(err, 'Unable to load interview session', 500, 'INTERNAL_ERROR');
  }
}
