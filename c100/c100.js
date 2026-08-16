// Supabase Integration & Event Logging for /c100
const SUPABASE_URL = 'https://mwtvjwhlygqvjuhyqkgt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13dHZqd2hseWdxdmp1aHlxa2d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAxNTEzMjIsImV4cCI6MjA1NTcyNzMyMn0.q68u4K1m_8jG6b2EsmgG1N_Jm0v8e1x8k1e3p7z4o1w';

const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// Exact vCard 3.0 specification
const VCARD_DATA = `BEGIN:VCARD
VERSION:3.0
N:Van Harken;Joseph;;;
FN:Joseph Van Harken
ORG:MindRiot Labs
TITLE:Founder & Fractional CAIO
TEL;TYPE=CELL,VOICE;TYPE=pref:+16168431153
EMAIL;TYPE=INTERNET,WORK;TYPE=pref:jvh@mindriotlabs.com
URL;TYPE=WORK:https://mindriotlabs.com
X-SOCIALPROFILE;TYPE=linkedin:https://linkedin.com/in/vanharken
NOTE:2026 CIO 100 Winner | Innovator-in-Residence at GVSU
PHOTO;TYPE=JPEG;ENCODING=b:
 /9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAQDAwMDAgQDAwMEBAQFBgoGBgUFBgwICQcKDgwP
 Dg4MDQ0PERYTDxAVEQ0NExoTFRcYGRkZDxIbHRsYHRYYGRj/2wBDAQQEBAYFBgsGBgsYEA0Q
 GBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBj/wAAR
 CAGQAZADASIAAhEBAxEB/8QAHAABAAIDAQEBAAAAAAAAAAAAAAcIBAUGAwEC/8QAVhAAAQME
 AAQDBQQDCggJDQAAAQACAwQFBhEHEiFBCBMxFCJRYYEVMnGRQnKhCSMkM0NSYoKxshYXJTRj
 kqK0GERTVZSzwtLwJzY3RWRzg4STo8PR4f/EABsBAQEAAwEBAQAAAAAAAAAAAAABAwQFBgIH
 /8QAPREAAgECBAMECAQEBQUAAAAAAAECAxEEEiExBUFRBhNhcRQiMoGRobHwFULB0QcjUuEW
 M2Jy8TVTgpKy/9oADAMBAAIRAxEAPwCgiIiynyEREA2iIgCIiAIiIAiIgCIiAJ2REAREVARE
 UAREVARE7oAiIgCIndAEREAREUAROiKgIiKAIiIAiIgHZERUBE7IgCIigCIiAIid0A2ndEQB
 ERAEREAREQBERAEREA0iIgCdkRAEREAREQBERUDuiIgC+r4igCIioCIn1UAREQBERUBERQBE
 RUBERQBERUBERQBERAEXxfQgCIndAEREARE7IAiIgCIiAIiIAiIgCIiAInqioCIigHdERUBE
 RQBE/BFQNoiIAiJ3QBERQBERUBERQBERAERFQEREAREUAREQBERUBERQBE7J6oB+CIiAIiIA
 iIgCd0RAEREA+qIiAIiIAnoiKgJ3RFAEREAREQBERUBNIigCInZAEREAREVAREUAREQBERAE
 REARCiAIiaQBERAEREARE7oB3RfF9QBERUBERQBERAEREAREQBEPoiAIiIAiIgCIioCd0RQB
 ERAO6IioCIigCJ3RAEREARO6IAiIgHdERAEREAREQBERAEREAREQBERAEREAREVAREUAREQB
 ERUBERQBETugCIiAIiIAidlJGAcEM5z+OOupKFtutLiP8o1+2McP9G370n0GvmsGIxNLDQ7y
 tJRXiYq1anRjnqOyI3676Le49hmV5XOIscx64XI+hfBCSxv4vPuj6lXDw3w48PcWEc9xpX5H
 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
 lleXvcS5zj6kk7JWvi7RhGHO70veydrK/wAftnpOBZ6lepXV3FxgnJxcc81mzSUWk9sqvbW1
 lsflERaJ6cJvsiIAiIgCIiAIiIB2RO6IAiIqAiIgCd07ogCIigG0RFQERFAOqJ2RAEREA7aR
 EQBERAEXS4HT4/X57Q2vJ43m2VzvZJJo38j6dz+jJGn0213LvYII3tdRxE4J5NgofcIGm7WY
 En2ynZ70I+ErOpb+sNt+Y9F85knY5dfjOFw+Ljgq8ss5K8b6KXKyfVdN9Va5GSd0RfR1Apjt
 d5/xYcCbLfsegjiyzJqiocLq6MPko6SFwZyRb2Guc7ZLvX9ihxS5jUdHxM4O0fDuGpp6TK7L
 VTVNnFTII2V8EvWSnDz0EgcOZoPr6Ll8VinCDqa01JZvKz38FKzfK2+lzVxdssXL2b6+Wvyv
 a50s7PEyKYNt+XXe7TNeGVdHbriJ5qGQtDgydvTkcQexI6Eeo0tfWYdxozCqgh4q3W+W3G6E
 mqq6+7ybip2Ae85rd+9IR0aPifxXnUWTj1md3pcYvlFcLRHTHzaquqaQUMY5GBpmqJmtHmuD
 AACS469PUlYFTg2MVXmRS8frLUQO68s7Kk82vTbSSuVRioaXpqXWEHJq/RrTyuvicp1YxdlK
 KfWMXJr3rbwuvibG3ZVPeLzV23hjwcsV1tNCwCI1dr9qqTEOgkmk2NvcdnXr1110vuYS3Gtp
 KXh1Bw6sUOZXEtkqI7bRRMNGwkOYxrmuJD9Dby4gNB1rutNeMitFltFv4aYDfvKo56mKS85E
 wujFZOTocvoWwxhx0O52fx3uXzQ8OaWlxTEXV7b5kcLZq+/3P3avypHlgibrZj2QS47J1rqe
 2/SopTTjG3S97u3OWvvtvsc+u8tWmoQ9Z3cb5uX5pu+y3ypXeidtSDpopaepkgmY6OSNxY9j
 vVpB0Qfqvx6/ipYpeGthPHKuwOqrZ5aegtkr5KqBwa59RHT+Y49QdDn6a+A+K5aHG7VJwLrs
 udLUfacN4ioGRhw8ry3Ql5JGtl2x8V2IPOtPM69PjeGnltfXJbT/ALl8v0d+h64xTXrGMfOf
 Oxa2Xezvldby64wieNj/AHXb5NjR9AHHpskd1JOQX2tt1tjyTG+HGJXrGp6cTMuYsw/eSNNk
 ZK0O9wtfsde2jvutUyqpeH+e2alpIBX4vldtpKiutE3RhEo5Ha36EOBc09gdL1ul3s3BTjXW
 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
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
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
        if (link.parentNode) {
            link.parentNode.removeChild(link);
        }
        URL.revokeObjectURL(url);
    }, 2000);

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

    // 7. Background Parallax Watermark Eye (faded eye icon that follows user on scroll)
    const heroWatermark = document.getElementById('heroWatermark') || document.querySelector('.hero-watermark');
    if (heroWatermark) {
        heroWatermark.style.opacity = '0.12';
        window.addEventListener('scroll', () => {
            const scrollY = window.scrollY;
            const parallaxOffset = scrollY * 0.08;
            heroWatermark.style.transform = `translateY(${parallaxOffset}px)`;
        }, { passive: true });
    }
});
