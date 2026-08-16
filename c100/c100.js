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
PHOTO;ENCODING=b;TYPE=JPEG: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
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

    // 5. Mobile Navigation Toggle
    const mobileToggle = document.querySelector('.nav-mobile-toggle');
    const navLinksContainer = document.querySelector('.nav-links');
    if (mobileToggle && navLinksContainer) {
        mobileToggle.addEventListener('click', () => {
            navLinksContainer.classList.toggle('mobile-active');
        });
    }

    // 6. Smooth scroll link
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
