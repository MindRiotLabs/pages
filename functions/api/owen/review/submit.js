import {
  buildReviewErrorResponse,
  resolveAuthorizedReviewContext,
  reviewCorsHeaders
} from './service.js';

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: reviewCorsHeaders });
}

export async function onRequestPost(context) {
  try {
    let body = {};
    try {
      body = await context.request.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON request body.', code: 'BAD_REQUEST' }),
        { status: 400, headers: reviewCorsHeaders }
      );
    }

    if (!body.client_request_id || typeof body.client_request_id !== 'string' || !body.client_request_id.trim()) {
      return new Response(
        JSON.stringify({
          error: 'client_request_id is required for idempotent review submission.',
          code: 'MISSING_CLIENT_REQUEST_ID'
        }),
        { status: 400, headers: reviewCorsHeaders }
      );
    }

    if (!body.sharing_and_attribution || typeof body.sharing_and_attribution !== 'object') {
      return new Response(
        JSON.stringify({
          error: 'sharing_and_attribution preferences are required on review submission.',
          code: 'MISSING_ATTRIBUTION_PREFERENCES'
        }),
        { status: 400, headers: reviewCorsHeaders }
      );
    }

    const { reviewService, sessionId, rawReviewToken } =
      await resolveAuthorizedReviewContext(context.request, context.env, body);

    const submittedView = await reviewService.submitParticipantReview({
      session_id: sessionId,
      raw_review_token: rawReviewToken,
      client_request_id: body.client_request_id.trim(),
      section_updates: Array.isArray(body.section_updates) ? body.section_updates : undefined,
      lesson_feedback_updates: Array.isArray(body.lesson_feedback_updates)
        ? body.lesson_feedback_updates
        : undefined,
      cleanup_updates: Array.isArray(body.cleanup_updates) ? body.cleanup_updates : undefined,
      sharing_and_attribution: body.sharing_and_attribution,
      overall_participant_comment:
        typeof body.overall_participant_comment === 'string'
          ? body.overall_participant_comment
          : undefined
    });

    return new Response(
      JSON.stringify({
        review: submittedView,
        submitted: true
      }),
      { status: 200, headers: reviewCorsHeaders }
    );
  } catch (err) {
    return buildReviewErrorResponse(
      err,
      'Failed to submit participant review.',
      400,
      'REVIEW_SUBMIT_ERROR'
    );
  }
}
