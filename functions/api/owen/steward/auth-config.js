import {
  DEFAULT_PILOT_001_SESSION_ID,
  isStagingOrPreviewRuntime,
  resolveValidatedSupabaseUrl
} from '../interview/service.js';
import { DISPOSABLE_UAT_REVIEW_SESSION_ID } from '../review/service.js';
import {
  DEFAULT_STAGING_STEWARD_PREVIEW_SESSION_ID,
  resolveSupabaseAnonKey,
  stewardPreviewCorsHeaders
} from './service.js';

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: stewardPreviewCorsHeaders });
}

export async function onRequestGet(context) {
  try {
    const isStaging = isStagingOrPreviewRuntime(context.env, context.request);
    const supabaseUrl = resolveValidatedSupabaseUrl(context.env, context.request);
    const supabaseAnonKey = resolveSupabaseAnonKey(context.env);

    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(
        JSON.stringify({
          error:
            'Supabase Auth public configuration (SUPABASE_URL / SUPABASE_ANON_KEY) is not configured for this environment.',
          code: 'AUTH_CONFIG_UNAVAILABLE'
        }),
        { status: 503, headers: stewardPreviewCorsHeaders }
      );
    }

    const availableSessions = isStaging
      ? [
          {
            session_id: DEFAULT_STAGING_STEWARD_PREVIEW_SESSION_ID,
            label:
              'ses-uat-steward-preview-001 — Completed Unprovisioned Synthetic Session (Dr. Jordan Vance)'
          },
          {
            session_id: DISPOSABLE_UAT_REVIEW_SESSION_ID,
            label:
              'ses-uat-review-disposable-001 — Provisioned Synthetic Review Session (Alex Rivera)'
          }
        ]
      : [
          {
            session_id: DEFAULT_PILOT_001_SESSION_ID,
            label:
              'ses-pilot-001-russ-richmond — Pilot 001 Completed 41-Turn Interview (Russ Richmond)'
          }
        ];

    return new Response(
      JSON.stringify({
        environment: isStaging ? 'staging' : 'production',
        supabase_url: supabaseUrl,
        supabase_anon_key: supabaseAnonKey,
        default_session_id: isStaging
          ? DEFAULT_STAGING_STEWARD_PREVIEW_SESSION_ID
          : DEFAULT_PILOT_001_SESSION_ID,
        available_sessions: availableSessions
      }),
      { status: 200, headers: stewardPreviewCorsHeaders }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: 'Unable to load Steward Auth configuration.',
        code: 'AUTH_CONFIG_ERROR'
      }),
      { status: 500, headers: stewardPreviewCorsHeaders }
    );
  }
}
