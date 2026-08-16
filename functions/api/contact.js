/**
 * Cloudflare Pages Function: /api/contact
 * Handles contact form submissions and dispatches notifications via Resend API.
 */

export async function onRequestOptions() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '86400',
        },
    });
}

export async function onRequestPost(context) {
    const { request, env } = context;

    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
    };

    try {
        const data = await request.json();
        const {
            name,
            email,
            phone,
            company,
            industry,
            companySize,
            serviceTier,
            operationalBottleneck,
            message,
            submittedAt,
            source
        } = data;

        // Basic validation
        if (!name || !email || (!operationalBottleneck && !message && !company)) {
            return new Response(
                JSON.stringify({ error: 'Missing required fields (Name, Email, Message/Company)' }),
                { status: 400, headers: corsHeaders }
            );
        }

        // Email validation regex
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            return new Response(
                JSON.stringify({ error: 'Invalid email address format' }),
                { status: 400, headers: corsHeaders }
            );
        }

        const resendApiKey = (env && env.RESEND_API_KEY) || (typeof process !== 'undefined' && process.env ? process.env.RESEND_API_KEY : '');
        if (!resendApiKey) {
            return new Response(
                JSON.stringify({ error: 'RESEND_API_KEY environment variable is not configured.' }),
                { status: 500, headers: corsHeaders }
            );
        }

        const toEmail = (env && env.CONTACT_EMAIL_TO) || (typeof process !== 'undefined' && process.env ? process.env.CONTACT_EMAIL_TO : 'jvh@mindriotlabs.com');
        const fromEmail = (env && env.CONTACT_EMAIL_FROM) || (typeof process !== 'undefined' && process.env ? process.env.CONTACT_EMAIL_FROM : 'notifications@mindriotlabs.com');
        const fromHeader = `MindRiot Labs <${fromEmail}>`;

        const clientIp = request.headers.get('CF-Connecting-IP') || request.headers.get('x-forwarded-for') || 'Unknown';
        const userAgent = request.headers.get('user-agent') || 'Unknown';
        const referer = request.headers.get('referer') || 'https://mindriotlabs.com';
        const timestamp = submittedAt || new Date().toISOString();

        const orgLabel = company || 'Direct Lead';
        const subject = `[New MindRiot Inquiry] ${name} - ${orgLabel}`;
        const mainMessage = operationalBottleneck || message || 'No message details provided.';

        // Tier formatting
        let tierFormatted = serviceTier || 'Unspecified';
        if (serviceTier === 'sprint') tierFormatted = '2-Week AI Acceleration Sprint ($12,500)';
        else if (serviceTier === 'audit') tierFormatted = '1-Week AI Opportunity & Security Audit ($4,500)';
        else if (serviceTier === 'fractional') tierFormatted = 'Fractional CAIO Retainer ($7,500/mo)';

        // Build Dark-Mode HTML Email Template
        const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #070a11; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc; }
    .container { max-width: 600px; margin: 24px auto; background-color: #0e131f; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.08); overflow: hidden; }
    .header { background: linear-gradient(135deg, rgba(0, 229, 153, 0.15), rgba(0, 210, 255, 0.08)); padding: 28px 24px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); text-align: left; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; background: rgba(0, 229, 153, 0.15); color: #00e599; border: 1px solid rgba(0, 229, 153, 0.3); margin-bottom: 10px; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.02em; }
    .content { padding: 24px; }
    .section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; margin: 20px 0 10px 0; }
    .data-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    .data-table td { padding: 10px 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.04); font-size: 14px; vertical-align: top; }
    .data-label { width: 35%; color: #94a3b8; font-weight: 500; }
    .data-value { color: #f1f5f9; font-weight: 600; }
    .data-value a { color: #00e599; text-decoration: none; }
    .message-card { background: #070a11; border: 1px solid rgba(255, 255, 255, 0.08); border-left: 3px solid #00e599; border-radius: 8px; padding: 16px; margin: 12px 0 20px 0; color: #e2e8f0; font-size: 14px; line-height: 1.6; white-space: pre-wrap; }
    .reply-btn { display: inline-block; background: linear-gradient(135deg, #00e599, #00d2ff); color: #070a11; font-weight: 700; font-size: 14px; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 10px; }
    .footer { background: #070a11; padding: 18px 24px; border-top: 1px solid rgba(255, 255, 255, 0.05); font-size: 11px; color: #64748b; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="badge">&#9733; MindRiot Inbound Lead</div>
      <h1>${name}</h1>
      <div style="font-size: 13px; color: #94a3b8; margin-top: 4px;">${orgLabel} &bull; ${industry || 'General Inquiry'}</div>
    </div>
    <div class="content">
      <div class="section-title">Contact & Organization Details</div>
      <table class="data-table">
        <tr>
          <td class="data-label">Full Name</td>
          <td class="data-value">${name}</td>
        </tr>
        <tr>
          <td class="data-label">Business Email</td>
          <td class="data-value"><a href="mailto:${email}">${email}</a></td>
        </tr>
        ${phone ? `<tr><td class="data-label">Phone</td><td class="data-value"><a href="tel:${phone}">${phone}</a></td></tr>` : ''}
        <tr>
          <td class="data-label">Business / Org</td>
          <td class="data-value">${company || 'N/A'}</td>
        </tr>
        <tr>
          <td class="data-label">Industry</td>
          <td class="data-value">${industry || 'Unspecified'}</td>
        </tr>
        <tr>
          <td class="data-label">Revenue / Team Size</td>
          <td class="data-value">${companySize || 'Unspecified'}</td>
        </tr>
        <tr>
          <td class="data-label">Service Tier Interest</td>
          <td class="data-value" style="color: #00e599;">${tierFormatted}</td>
        </tr>
        <tr>
          <td class="data-label">Lead Source</td>
          <td class="data-value">${source || 'mindriotlabs.com Form'}</td>
        </tr>
      </table>

      <div class="section-title">Primary Operational Bottleneck / Message</div>
      <div class="message-card">${mainMessage}</div>

      <div style="text-align: center; margin: 24px 0 12px 0;">
        <a href="mailto:${email}?subject=Re:%20MindRiot%20Labs%20AI%20Opportunity%20Audit%20-%20${encodeURIComponent(name)}" class="reply-btn">
          Reply Directly to ${name} &rarr;
        </a>
      </div>
    </div>
    <div class="footer">
      <div><strong>Submission Metadata:</strong> ${timestamp}</div>
      <div><strong>Client IP:</strong> ${clientIp} &bull; <strong>Origin:</strong> ${referer}</div>
      <div style="margin-top: 4px;"><strong>User Agent:</strong> ${userAgent}</div>
    </div>
  </div>
</body>
</html>
        `.trim();

        // Prepare Resend payload
        const resendPayload = {
            from: fromHeader,
            to: [toEmail],
            reply_to: email,
            subject: subject,
            html: htmlBody,
        };

        // Dispatch email via Resend REST API
        let resendResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json',
                'User-Agent': 'MindRiotLabs/1.0',
            },
            body: JSON.stringify(resendPayload),
        });

        // Fallback: If custom domain error occurs, retry with onboarding@resend.dev
        if (!resendResponse.ok) {
            const errorText = await resendResponse.text();
            console.error('[Resend Error]', resendResponse.status, errorText);

            if (resendResponse.status === 403 || errorText.includes('domain')) {
                const fallbackPayload = {
                    ...resendPayload,
                    from: 'MindRiot Labs <onboarding@resend.dev>',
                };
                resendResponse = await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${resendApiKey}`,
                        'Content-Type': 'application/json',
                        'User-Agent': 'MindRiotLabs/1.0',
                    },
                    body: JSON.stringify(fallbackPayload),
                });
            }
        }

        if (!resendResponse.ok) {
            const finalError = await resendResponse.text();
            return new Response(
                JSON.stringify({ error: 'Failed to send notification email', details: finalError }),
                { status: 502, headers: corsHeaders }
            );
        }

        const resendData = await resendResponse.json();
        return new Response(
            JSON.stringify({ success: true, id: resendData.id, message: 'Notification dispatched successfully' }),
            { status: 200, headers: corsHeaders }
        );

    } catch (err) {
        console.error('[Contact Function Error]', err);
        return new Response(
            JSON.stringify({ error: 'Internal server error processing contact form', details: err.message }),
            { status: 500, headers: corsHeaders }
        );
    }
}
