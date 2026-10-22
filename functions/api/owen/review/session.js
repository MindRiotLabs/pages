import {
  buildReviewErrorResponse,
  resolveAuthorizedReviewContext,
  reviewCorsHeaders
} from './service.js';

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: reviewCorsHeaders });
}

export async function onRequestGet(context) {
  try {
    const { reviewService, sessionId, rawReviewToken } =
      await resolveAuthorizedReviewContext(context.request, context.env);

    const reviewView = await reviewService.getParticipantReviewView(
      sessionId,
      rawReviewToken,
      { recordOpenEvent: true }
    );

    return new Response(
      JSON.stringify({
        review: reviewView
      }),
      { status: 200, headers: reviewCorsHeaders }
    );
  } catch (err) {
    return buildReviewErrorResponse(
      err,
      'Failed to load participant experience review package.'
    );
  }
}
