import {
  buildStewardPreviewErrorResponse,
  handleStewardReviewPreviewRequest,
  stewardPreviewCorsHeaders
} from './service.js';

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: stewardPreviewCorsHeaders });
}

export async function onRequestGet(context) {
  try {
    const payload = await handleStewardReviewPreviewRequest(context.request, context.env);
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: stewardPreviewCorsHeaders
    });
  } catch (err) {
    return buildStewardPreviewErrorResponse(
      err,
      'Failed to load Steward Review Preview package.'
    );
  }
}

export async function onRequest(context) {
  const method = (context.request?.method || 'GET').toUpperCase();
  if (method === 'OPTIONS') {
    return onRequestOptions();
  }
  if (method === 'GET') {
    return onRequestGet(context);
  }
  try {
    await handleStewardReviewPreviewRequest(context.request, context.env);
    return new Response(
      JSON.stringify({
        error: 'Steward Review Preview is strictly read-only (GET only).',
        code: 'READ_ONLY_STEWARD_PREVIEW_ENDPOINT'
      }),
      {
        status: 405,
        headers: {
          ...stewardPreviewCorsHeaders,
          Allow: 'GET, OPTIONS'
        }
      }
    );
  } catch (err) {
    return buildStewardPreviewErrorResponse(
      err,
      'Steward Review Preview is strictly read-only (GET only).'
    );
  }
}
