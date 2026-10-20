/**
 * POST /api/owen/interview/webhook
 *
 * Server-side webhook receiver for ElevenLabs conversational voice callbacks.
 * Enforces rate limiting, HMAC-SHA256 signature verification (`ElevenLabs-Signature` header),
 * and event-ID idempotency deduplication.
 */

import {
  corsHeaders,
  createInterviewServiceContext,
  enforceRateLimit,
  recordFailedAuthAttempt,
  clearFailedAuthAttempts,
  buildErrorResponse
} from './service.js';

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    enforceRateLimit(request);

    const rawBody = await request.text();
    const signatureHeader =
      request.headers.get('ElevenLabs-Signature') ||
      request.headers.get('elevenlabs-signature') ||
      '';

    let payload = {};
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new Response(
        JSON.stringify({ error: 'Malformed JSON payload', code: 'BAD_PAYLOAD' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const eventId = payload.event_id || payload.conversation_id || '';
    if (!eventId) {
      return new Response(
        JSON.stringify({ error: 'Missing event_id in webhook payload', code: 'MISSING_EVENT_ID' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const { voiceAdapter } = createInterviewServiceContext(env);
    const verification = voiceAdapter.verifyAndRecordWebhookCallback({
      rawBody,
      signatureHeader,
      eventId
    });

    if (!verification.verified) {
      recordFailedAuthAttempt(request);
      return new Response(
        JSON.stringify({
          error: verification.reason || 'Webhook signature verification failed',
          code: 'INVALID_WEBHOOK_SIGNATURE'
        }),
        { status: 401, headers: corsHeaders }
      );
    }

    clearFailedAuthAttempts(request);

    if (verification.duplicate) {
      return new Response(
        JSON.stringify({ status: 'duplicate_ignored', event_id: eventId }),
        { status: 202, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({ status: 'accepted', event_id: eventId }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    return buildErrorResponse(err, 'Webhook processing failed', 500, 'WEBHOOK_ERROR');
  }
}
