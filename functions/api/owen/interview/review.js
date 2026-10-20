/**
 * POST /api/owen/interview/review
 *
 * Allows the participant to exercise sovereignty over their statements and attribution:
 * - AMEND_STATEMENT (correct paraphrased claim or quote)
 * - EXCLUDE_STATEMENT (redact/exclude a specific statement from the brief)
 * - CHANGE_ATTRIBUTION (ATTRIBUTED, ANONYMIZED_EXTERNAL, INTERNAL_ONLY)
 * - ADD_CLARIFICATION (append an additional clarification statement)
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
    const { session, agent } = await resolveAuthorizedPilotSession(request, env, body);

    const updated = await agent.submitParticipantCorrection({
      session_id: session.id,
      target_statement_id: body.target_statement_id,
      target_turn_id: body.target_turn_id,
      action: body.action,
      corrected_text: body.corrected_text,
      attribution_preference: body.attribution_preference,
      rationale: body.rationale || 'Participant review update'
    });

    return new Response(
      JSON.stringify(
        sanitizeSessionForClient(updated, {
          experience_brief: updated.experience_brief
        })
      ),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    return buildErrorResponse(err, 'Unable to submit participant correction', 400, 'REVIEW_ERROR');
  }
}
