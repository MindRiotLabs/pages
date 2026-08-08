/* 
   MindRiot Labs - SMB AI Advisory & Portfolio Hub
   Interactive Client-Side JavaScript
*/

document.addEventListener('DOMContentLoaded', () => {
    // -------------------------------------------------------------
    // DOM Element Selections
    // -------------------------------------------------------------
    const openModalButtons = document.querySelectorAll('.open-audit-modal');
    const auditModal = document.getElementById('auditModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const successCloseBtn = document.getElementById('successCloseBtn');
    const leadForm = document.getElementById('leadCaptureForm');
    const formState = document.getElementById('formState');
    const successState = document.getElementById('successState');
    const navLinks = document.querySelectorAll('.nav-links a');
    const sections = document.querySelectorAll('main > section');
    const mobileToggle = document.querySelector('.nav-mobile-toggle');
    const navLinksContainer = document.querySelector('.nav-links');
    
    // Pricing Scroll button
    const scrollToPricingBtn = document.querySelector('.scroll-to-pricing');

    // Tab items
    const tabButtons = document.querySelectorAll('.tab-btn');
    const toolCards = document.querySelectorAll('.tool-card');

    // Newsletter elements
    const newsletterForm = document.getElementById('newsletterForm');
    const newsletterEmail = document.getElementById('newsletterEmail');
    const newsletterError = document.getElementById('newsletterError');
    const newsletterSuccess = document.getElementById('newsletterSuccess');

    // -------------------------------------------------------------
    // Modal Open / Close Handlers
    // -------------------------------------------------------------
    function openModal(e) {
        if (e) e.preventDefault();
        auditModal.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent background scroll
        
        // Auto-focus first field
        setTimeout(() => {
            document.getElementById('clientName').focus();
        }, 100);
    }

    function closeModal() {
        auditModal.classList.remove('active');
        document.body.style.overflow = ''; // Restore background scroll
        
        // Reset form state after close transition completes
        setTimeout(() => {
            leadForm.reset();
            clearFormErrors();
            formState.style.display = 'block';
            successState.style.display = 'none';
        }, 400);
    }

    // Bind modal triggers
    openModalButtons.forEach(btn => {
        btn.addEventListener('click', openModal);
    });

    closeModalBtn.addEventListener('click', closeModal);
    successCloseBtn.addEventListener('click', closeModal);

    // Close modal when clicking overlay background (outside drawer)
    auditModal.addEventListener('click', (e) => {
        if (e.target === auditModal) {
            closeModal();
        }
    });

    // Close modal on Escape key press
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && auditModal.classList.contains('active')) {
            closeModal();
        }
    });

    // -------------------------------------------------------------
    // Smooth Scroll to Pricing
    // -------------------------------------------------------------
    if (scrollToPricingBtn) {
        scrollToPricingBtn.addEventListener('click', () => {
            const pricingSection = document.getElementById('pricing');
            if (pricingSection) {
                pricingSection.scrollIntoView({ behavior: 'smooth' });
            }
        });
    }

    // -------------------------------------------------------------
    // Tools Category/Security Tabs Handler
    // -------------------------------------------------------------
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active tab button style
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const category = btn.getAttribute('data-category');
            const security = btn.getAttribute('data-security');

            // Filter cards
            toolCards.forEach(card => {
                const cardCategory = card.getAttribute('data-category');
                const cardSecurity = card.getAttribute('data-security');

                let show = false;
                if (category) {
                    if (category === 'all' || cardCategory === category) {
                        show = true;
                    }
                } else if (security) {
                    if (cardSecurity === security) {
                        show = true;
                    }
                }

                if (show) {
                    card.classList.remove('hidden');
                } else {
                    card.classList.add('hidden');
                }
            });
        });
    });

    // -------------------------------------------------------------
    // Newsletter Form Handler
    // -------------------------------------------------------------
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', (e) => {
            e.preventDefault();
            newsletterError.style.display = 'none';
            newsletterSuccess.style.display = 'none';

            const emailVal = newsletterEmail.value.trim();

            if (!emailVal || !validateEmail(emailVal)) {
                newsletterError.style.display = 'block';
                return;
            }

            // Save newsletter lead locally
            const subscriberPayload = {
                email: emailVal,
                subscribedAt: new Date().toISOString(),
                source: 'Newsletter Stack Digest'
            };

            try {
                const list = JSON.parse(localStorage.getItem('mindriot_subscribers') || '[]');
                list.push(subscriberPayload);
                localStorage.setItem('mindriot_subscribers', JSON.stringify(list));
            } catch (err) {
                console.warn('LocalStorage unavailable for subscriber logging.');
            }

            // Webhook output log
            console.log('%c[MindRiot Newsletter] New Subscriber Registered:', 'color: #8B5CF6; font-weight: bold;', subscriberPayload);

            // Success feedback
            newsletterSuccess.style.display = 'block';
            newsletterEmail.value = '';

            // Hide success message after 5 seconds
            setTimeout(() => {
                newsletterSuccess.style.display = 'none';
            }, 5000);
        });
    }

    // -------------------------------------------------------------
    // Mobile Menu Toggle
    // -------------------------------------------------------------
    if (mobileToggle) {
        mobileToggle.addEventListener('click', () => {
            navLinksContainer.classList.toggle('mobile-active');
            
            if (navLinksContainer.classList.contains('mobile-active')) {
                navLinksContainer.style.display = 'flex';
                navLinksContainer.style.flexDirection = 'column';
                navLinksContainer.style.position = 'absolute';
                navLinksContainer.style.top = '80px';
                navLinksContainer.style.left = '0';
                navLinksContainer.style.right = '0';
                navLinksContainer.style.background = 'rgba(9, 9, 11, 0.95)';
                navLinksContainer.style.borderBottom = '1px solid var(--border-color)';
                navLinksContainer.style.padding = '2rem';
                navLinksContainer.style.gap = '1.5rem';
                navLinksContainer.style.backdropFilter = 'var(--backdrop-blur)';
            } else {
                navLinksContainer.style.display = '';
            }
        });
    }

    // Close mobile menu when clicking nav links
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (navLinksContainer.classList.contains('mobile-active')) {
                navLinksContainer.classList.remove('mobile-active');
                navLinksContainer.style.display = '';
            }
        });
    });

    // -------------------------------------------------------------
    // Scroll Active Link Highlighting
    // -------------------------------------------------------------
    window.addEventListener('scroll', () => {
        let currentSectionId = '';
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop - 120; // offset header height
            const sectionHeight = section.clientHeight;
            if (pageYOffset >= sectionTop && pageYOffset < sectionTop + sectionHeight) {
                currentSectionId = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${currentSectionId}`) {
                link.classList.add('active');
            }
        });
    });

    // -------------------------------------------------------------
    // Lead Form Validation & Submission Handler
    // -------------------------------------------------------------
    function clearFormErrors() {
        const groups = leadForm.querySelectorAll('.form-group');
        groups.forEach(group => group.classList.remove('has-error'));
    }

    function validateEmail(email) {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email.trim());
    }

    leadForm.addEventListener('submit', (e) => {
        e.preventDefault();
        clearFormErrors();

        const name = document.getElementById('clientName').value.trim();
        const email = document.getElementById('clientEmail').value.trim();
        const company = document.getElementById('clientCompany').value.trim();
        const size = document.getElementById('clientSize').value;
        const bottleneck = document.getElementById('clientBottleneck').value.trim();

        let hasError = false;

        // Name Validation
        if (!name) {
            document.getElementById('nameGroup').classList.add('has-error');
            hasError = true;
        }

        // Email Validation
        if (!email || !validateEmail(email)) {
            document.getElementById('emailGroup').classList.add('has-error');
            hasError = true;
        }

        // Company Validation
        if (!company) {
            document.getElementById('companyGroup').classList.add('has-error');
            hasError = true;
        }

        // Size Validation
        if (!size) {
            document.getElementById('sizeGroup').classList.add('has-error');
            hasError = true;
        }

        // Bottleneck Validation
        if (!bottleneck) {
            document.getElementById('bottleneckGroup').classList.add('has-error');
            hasError = true;
        }

        if (hasError) {
            // Shake modal drawer on validation failure (micro-interaction)
            const drawer = document.querySelector('.modal-drawer');
            drawer.style.animation = 'none';
            setTimeout(() => {
                drawer.style.animation = 'shake 0.3s ease-in-out';
            }, 10);
            return;
        }

        // If form is valid, prepare payload
        const leadPayload = {
            name,
            email,
            company,
            companySize: size,
            operationalBottleneck: bottleneck,
            submittedAt: new Date().toISOString(),
            source: 'Opportunity Audit Lead Form'
        };

        // Save payload locally for audit trail
        try {
            const submissions = JSON.parse(localStorage.getItem('mindriot_leads') || '[]');
            submissions.push(leadPayload);
            localStorage.setItem('mindriot_leads', JSON.stringify(submissions));
        } catch (err) {
            console.warn('LocalStorage unavailable for lead backup.');
        }

        // Log Simulated Webhook Submission
        console.log('%c[MindRiot Lead Handler] Webhook Dispatched:', 'color: #06B6D4; font-weight: bold;', leadPayload);

        // Fetch simulation
        simulateWebhookPost(leadPayload);

        // Show Success Transition State
        formState.style.display = 'none';
        successState.style.display = 'flex';
    });

    function simulateWebhookPost(payload) {
        console.log('[Webhook Simulation] Posting payload to database...', payload);
    }
});

// Dynamic keyframe injection for drawer shake animation
const styleSheet = document.createElement("style");
styleSheet.innerText = `
@keyframes shake {
    0%, 100% { transform: translateX(0); }
    20%, 60% { transform: translateX(-6px); }
    40%, 80% { transform: translateX(6px); }
}
`;
document.head.appendChild(styleSheet);
