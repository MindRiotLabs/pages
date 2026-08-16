// Supabase Integration & Event Logging for /c100
const SUPABASE_URL = 'https://mwtvjwhlygqvjuhyqkgt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13dHZqd2hseWdxdmp1aHlxa2d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAxNTEzMjIsImV4cCI6MjA1NTcyNzMyMn0.q68u4K1m_8jG6b2EsmgG1N_Jm0v8e1x8k1e3p7z4o1w';

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
PHOTO;ENCODING=b;TYPE=JPEG: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7cwwlly0pniI3MoUMSTxgxeDfAngLxf8Sb7w5B401tLEWc17Y3qaMheQQ2z3EqSxtOAjARlQVZgzdwOazE+Lvj8eK4vEk2u/a9RGmjSJ5L23juRe2g48q5WRSJxjaMuCflXnKgjOPj/xMPHMni6K5tbfU3t5LQG2s4YYkheBrdkSJFCKPLYqMDjr15o1AwL5bJNTuE02eeezEhEEtxGIpHTPylkDMFbHUBiB6mq9HtRVCClpKKADNFFFABRRRQAd6KKKYBRRRQAUUUUgCiiigAooo70AFFFFMAoozRSAKKKKYBR2oooAKKKKQBRRRQAUUUUAHSiiigAo70UUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRTAKKKKQBRRRQAUUUUAHaiiigAooooAKO9LSUAFAoooAKKKKACiiigAooooAKKKKACjtRR2pgFFFFIAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigA+tFFFABRRRQAUUUUAFHSiimAUUUUAFFFFABRRRSAKKKKACiiigAooopgFFFFIAooopgFFFFABRRRSAKKOaKACiiigAooooADRRR3oAKKKKACijvRQAUUUUAFFFFMAooopAFFFFABRRRQAUUUUAFHeiigAooooAO1FFFABRRRTAKKKKQBRRRQAUUUUwCiiikAUUUUAFFFFABRRRxQAUUUUAFFFFABRRRQAUUUd6YBRzRRSAKKKKADvRRRQAUUUUwCiiigAooopAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRQaM0AFFFHegAooooAKKKKACiiigAooooAKKO1FABRQaKADtRRRTAKKKKQBRRRTAKKKKQBRRRQAUd6KKACiiigAooooAKKKKADvRRRQB/9k=
END:VCARD`;

// Lightweight Session Identifier
function getSessionId() {
    let sid = sessionStorage.getItem('c100_session_id');
    if (!sid) {
        sid = 'c100_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
        sessionStorage.setItem('c100_session_id', sid);
    }
    return sid;
}

// Analytics Event Logger
async function logEvent(eventName, metadata = {}) {
    const payload = {
        event_name: eventName,
        session_id: getSessionId(),
        referrer: document.referrer || 'direct',
        url: window.location.href,
        metadata: {
            ...metadata,
            screen: `${window.innerWidth}x${window.innerHeight}`,
            userAgent: navigator.userAgent
        },
        created_at: new Date().toISOString()
    };

    try {
        if (supabaseClient) {
            await supabaseClient.from('c100_analytics').insert([payload]);
        }
    } catch (err) {
        console.warn('Analytics log failure:', err);
    }
}

// vCard Download Trigger
function downloadVCard(e) {
    if (e) e.preventDefault();

    logEvent('c100_vcard_download');

    const blob = new Blob([VCARD_DATA], { type: 'text/vcard;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Joseph_Van_Harken.vcf');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('Contact card downloaded');
}

// Toast Notification Helper
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
