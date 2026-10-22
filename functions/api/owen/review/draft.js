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

    const { reviewService, sessionId, rawReviewToken } =
      await resolveAuthorizedReviewContext(context.request, context.env, body);

    const updatedView = await reviewService.saveParticipantReviewDraft({
      session_id: sessionId,
      raw_review_token: rawReviewToken,
      client_request_id:
        typeof body.client_request_id === 'string' ? body.client_request_id : undefined,
      section_updates: Array.isArray(body.section_updates) ? body.section_updates : undefined,
      lesson_feedback_updates: Array.isArray(body.lesson_feedback_updates)
        ? body.lesson_feedback_updates
        : undefined,
      cleanup_updates: Array.isArray(body.cleanup_updates) ? body.cleanup_updates : undefined,
      sharing_and_attribution:
        body.sharing_and_attribution && typeof body.sharing_and_attribution === 'object'
          ? body.sharing_and_attribution
          : undefined,
      overall_participant_comment:
        typeof body.overall_participant_comment === 'string'
          ? body.overall_participant_comment
          : undefined
    });

    return new Response(
      JSON.stringify({
        review: updatedView,
        draft_saved: true
      }),
      { status: 200, headers: reviewCorsHeaders }
    );
  } catch (err) {
    return buildReviewErrorResponse(err, 'Failed to save review draft.', 400, 'DRAFT_SAVE_ERROR');
  }
}
