/* 
   MindRiot Labs - CIO 100 Mobile-First Interactive Logic
   Route: /c100
*/

const SUPABASE_URL = "https://xkgtipcyswjpvwmmawmf.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_a84bMzDhwTFRDxLnfMTLcA_pov-Kgr3";

// Supabase client instance (if available via CDN)
const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// Exact vCard 3.0 specification
const VCARD_DATA = `BEGIN:VCARD
VERSION:3.0
N:Van Harken;Joseph;;;
FN:Joseph Van Harken
ORG:MindRiot Labs;
TITLE:Founder & Fractional CAIO
TEL;TYPE=CELL,VOICE:+16168431153
EMAIL;TYPE=INTERNET,PREF:jvh@mindriotlabs.com
URL:https://mindriotlabs.com
URL;TYPE=LinkedIn:https://linkedin.com/in/vanharken
NOTE:2026 CIO 100 Winner | Innovator-in-Residence at GVSU
END:VCARD`;

// Analytics event logger
function logEvent(eventName, metadata = {}) {
    const timestamp = new Date().toISOString();
    const eventPayload = {
        event: eventName,
        source: '/c100',
        userAgent: navigator.userAgent,
        referrer: document.referrer || 'direct',
        timestamp: timestamp,
        ...metadata
    };

    // 1. Log to console in development/inspection
    console.log(`[C100 Analytics] ${eventName}:`, eventPayload);

    // 2. Local storage event queue for audit trails
    try {
        const events = JSON.parse(localStorage.getItem('mrl_c100_events') || '[]');
        events.push(eventPayload);
        if (events.length > 50) events.shift(); // keep max 50 recent events
        localStorage.setItem('mrl_c100_events', JSON.stringify(events));
    } catch (e) {
        // localStorage might be unavailable in private browsing mode
    }

    // 3. Supabase insert if analytics_events table or audit_leads table is available
    if (supabaseClient) {
        try {
            supabaseClient.from('analytics_events').insert([{
                event_name: eventName,
                page_route: '/c100',
                meta: metadata,
                created_at: timestamp
            }]).then(({ error }) => {
                if (error && error.code !== '42P01') {
                    // Ignore missing table error silently, or log
                    console.debug('[Supabase Analytics]', error.message);
                }
            }).catch(() => {});
        } catch (err) {
            // silent failover
        }
    }
}

// vCard download handler
function downloadVCard(e) {
    if (e && e.preventDefault) e.preventDefault();
    
    logEvent('c100_vcard_download', { method: 'button_click' });

    try {
        const blob = new Blob([VCARD_DATA], { type: 'text/vcard;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'Joseph-Van-Harken.vcf');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showToast('Contact card downloaded');
    } catch (err) {
        console.warn('Blob download failed, falling back to static file:', err);
        window.location.href = '/assets/joseph-van-harken.vcf';
    }
}

// Toast notification helper
function showToast(message) {
    const toast = document.getElementById('c100Toast');
    const toastText = document.getElementById('c100ToastText');
    if (!toast || !toastText) return;

    toastText.textContent = message;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 2800);
}

// Document Ready Initialization
document.addEventListener('DOMContentLoaded', () => {
    // 1. Track initial page view
    logEvent('c100_pageview', {
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight
    });

    // 2. Attach vCard download buttons
    const vcardBtns = document.querySelectorAll('.action-download-vcard');
    vcardBtns.forEach(btn => {
        btn.addEventListener('click', downloadVCard);
    });

    // 3. Attach LinkedIn tracking
    const linkedinBtns = document.querySelectorAll('.action-linkedin');
    linkedinBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            logEvent('c100_linkedin_click');
        });
    });

    // 4. Attach Direct Contact links tracking
    const emailLink = document.querySelector('.action-email');
    if (emailLink) {
        emailLink.addEventListener('click', () => {
            logEvent('c100_email_click');
        });
    }

    const phoneLink = document.querySelector('.action-phone');
    if (phoneLink) {
        phoneLink.addEventListener('click', () => {
            logEvent('c100_phone_click');
        });
    }

    const siteLink = document.querySelector('.action-site');
    if (siteLink) {
        siteLink.addEventListener('click', () => {
            logEvent('c100_site_click');
        });
    }

    // 5. Smooth scroll link
    const scrollLinks = document.querySelectorAll('a[href^="#"]');
    scrollLinks.forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');
            if (targetId && targetId !== '#') {
                const targetElem = document.querySelector(targetId);
                if (targetElem) {
                    e.preventDefault();
                    targetElem.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            }
        });
    });
});
