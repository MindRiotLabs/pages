/**
 * GET & POST /api/owen/interview/brief
 *
 * Generates or retrieves the structured OWEN Experience Brief for the session.
 * All generated briefs default to DRAFT_PENDING_REVIEW and propagation_scope: 'project_only'.
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
    const { session, agent } = await resolveAuthorizedPilotSession(request, env);
    const brief = session.experience_brief || (await agent.generateExperienceBrief(session.id));
    const updatedSession = await agent.getSession(session.id);

    return new Response(
      JSON.stringify(
        sanitizeSessionForClient(updatedSession, {
          experience_brief: brief
        })
      ),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    return buildErrorResponse(err, 'Unable to retrieve Experience Brief', 500, 'BRIEF_ERROR');
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json().catch(() => ({}));
    const { session, agent } = await resolveAuthorizedPilotSession(request, env, body);
    const brief = await agent.generateExperienceBrief(session.id);
    const updatedSession = await agent.getSession(session.id);

    return new Response(
      JSON.stringify(
        sanitizeSessionForClient(updatedSession, {
          experience_brief: brief
        })
      ),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    return buildErrorResponse(err, 'Unable to generate Experience Brief', 500, 'BRIEF_ERROR');
  }
}
