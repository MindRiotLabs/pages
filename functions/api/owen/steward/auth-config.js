import {
  DEFAULT_PILOT_001_SESSION_ID,
  isStagingOrPreviewRuntime,
  resolveValidatedSupabaseUrl
} from '../interview/service.js';
import { DISPOSABLE_UAT_REVIEW_SESSION_ID } from '../review/service.js';
import {
  CANONICAL_FOUNDER_SUPERADMIN_EMAIL,
  DEFAULT_STAGING_STEWARD_PREVIEW_SESSION_ID,
  getApprovedStewardRedirectUrls,
  isApprovedStewardRedirectOrOrigin,
  resolveSupabaseAnonKey,
  stewardPreviewCorsHeaders
} from './service.js';

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: stewardPreviewCorsHeaders });
}

export async function onRequestGet(context) {
  try {
    const requestUrl = new URL(context.request.url);
    const isStaging = isStagingOrPreviewRuntime(context.env, context.request);

    const requestedRedirectTo = (requestUrl.searchParams.get('redirect_to') || '').trim();
    if (requestedRedirectTo && !isApprovedStewardRedirectOrOrigin(requestedRedirectTo, isStaging)) {
      return new Response(
        JSON.stringify({
          error:
            'Requested OAuth redirect_to URL is not in the approved environment allowlist for Steward Preview.',
          code: 'UNTRUSTED_REDIRECT_ORIGIN_FORBIDDEN'
        }),
        { status: 403, headers: stewardPreviewCorsHeaders }
      );
    }

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

    let googleOauthProviderEnabled = null;
    const nodeEnv = context.env?.NODE_ENV || (typeof process !== 'undefined' ? process.env?.NODE_ENV : '');
    if (nodeEnv !== 'test') {
      try {
        const settingsRes = await fetch(`${supabaseUrl}/auth/v1/settings`, {
          method: 'GET',
          headers: { apikey: supabaseAnonKey }
        });
        if (settingsRes.ok) {
          const settings = await settingsRes.json();
          googleOauthProviderEnabled = Boolean(settings?.external?.google);
        }
      } catch (_ignore) {
        googleOauthProviderEnabled = null;
      }
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
        auth_provider: 'supabase_auth_google_pkce',
        primary_oauth_provider: 'google',
        oauth_flow: 'pkce',
        code_challenge_method: 'S256',
        canonical_superadmin_email: CANONICAL_FOUNDER_SUPERADMIN_EMAIL,
        google_oauth_provider_enabled: googleOauthProviderEnabled,
        allowed_redirect_urls: getApprovedStewardRedirectUrls(isStaging),
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
