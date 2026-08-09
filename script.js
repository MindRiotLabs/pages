/* 
   MindRiot Labs - SMB AI Advisory & Portfolio Hub
   Interactive Client-Side JavaScript
*/


// -------------------------------------------------------------
// Supabase Database Configuration
// -------------------------------------------------------------
const SUPABASE_URL = "https://qtrypzzcjebvfcihiynt.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_ACTUAL_ANON_KEY_HERE";

// Initialize Supabase Client (handles case when CDN fails to load)
const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

function initApplication() {
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
        if (e && e.currentTarget) {
            const href = e.currentTarget.getAttribute('href');
            if (href && href.startsWith('#audit')) {
                if (e.preventDefault) e.preventDefault();
                window.location.hash = href;
                return;
            }
        }

        if (e && e.preventDefault) e.preventDefault();
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
        
        // Clear hash if it was #audit to support back navigation
        if (window.location.hash.startsWith('#audit')) {
            history.pushState("", document.title, window.location.pathname + window.location.search);
        }

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

    // URL Hash Routing for #audit modal trigger
    checkHashAndOpenModal();

    window.addEventListener('hashchange', () => {
        if (window.location.hash.startsWith('#audit')) {
            checkHashAndOpenModal();
        } else if (auditModal.classList.contains('active')) {
            closeModal();
        }
    });

    function checkHashAndOpenModal() {
        const hash = window.location.hash;
        if (hash.startsWith('#audit')) {
            // Open modal
            auditModal.classList.add('active');
            document.body.style.overflow = 'hidden';
            
            // Check for package parameter
            const queryPart = hash.split('?')[1];
            if (queryPart) {
                const params = new URLSearchParams(queryPart);
                const pkg = params.get('package');
                const tierSelect = document.getElementById('clientTier');
                if (tierSelect && pkg) {
                    if (pkg === 'sprint' || pkg === 'audit' || pkg === 'fractional') {
                        tierSelect.value = pkg;
                    }
                }
            }

            // Auto-focus first field
            setTimeout(() => {
                document.getElementById('clientName').focus();
            }, 100);
        }
    }

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
                    // Trigger reflow to restart entry animation
                    card.offsetHeight;
                    card.classList.add('fade-in');
                } else {
                    card.classList.add('hidden');
                    card.classList.remove('fade-in');
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

    leadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearFormErrors();

        const name = document.getElementById('clientName').value.trim();
        const email = document.getElementById('clientEmail').value.trim();
        const company = document.getElementById('clientCompany').value.trim();
        const industry = document.getElementById('clientIndustry').value;
        const size = document.getElementById('clientSize').value;
        const tier = document.getElementById('clientTier').value;
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

        // Industry Validation
        if (!industry) {
            document.getElementById('industryGroup').classList.add('has-error');
            hasError = true;
        }

        // Size Validation
        if (!size) {
            document.getElementById('sizeGroup').classList.add('has-error');
            hasError = true;
        }

        // Tier Validation
        if (!tier) {
            document.getElementById('tierGroup').classList.add('has-error');
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
            industry,
            companySize: size,
            serviceTier: tier,
            operationalBottleneck: bottleneck,
            submittedAt: new Date().toISOString(),
            source: 'Opportunity Audit Lead Form'
        };

        // Try inserting into Supabase audit_leads table
        if (supabaseClient) {
            try {
                const { error } = await supabaseClient
                    .from('audit_leads')
                    .insert([
                        {
                            full_name: name,
                            email: email,
                            business_name: company,
                            industry: industry,
                            revenue_size: size,
                            service_tier: tier,
                            bottleneck: bottleneck
                        }
                    ]);
                if (error) {
                    console.error('[Supabase Error] Insert failed:', error.message);
                } else {
                    console.log('[Supabase Success] Lead inserted successfully.');
                }
            } catch (err) {
                console.error('[Supabase Catch] Error submitting to database:', err);
            }
        } else {
            console.warn('[Supabase Warning] Client not initialized. Data logged locally only.');
        }

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

    // -------------------------------------------------------------
    // SOP Search Micro-Demo Handler
    // -------------------------------------------------------------
    const promptChips = document.querySelectorAll('.prompt-chip');
    const terminalBody = document.getElementById('terminalBody');
    const terminalForm = document.getElementById('terminalForm');
    const terminalInput = document.getElementById('terminalInput');

    const sopDatabase = {
        refund: {
            source: 'SOP-Billing-and-Refunds-v3.pdf',
            docRef: 'SOP-Billing-v3.pdf',
            query: 'What is our refund policy?',
            answer: 'Clients can request a full refund within <strong>7 business days</strong> of starting the AI Sprint if the initial audit finds no viable bottlenecks. After work begins in Week 2, billing is fixed and non-refundable, but includes 30 days of post-launch support.',
            hash: '0x8f2a71bc9d',
            retrievalTime: '12ms'
        },
        dispatch: {
            source: 'Field-Operations-Manual-2026.docx',
            docRef: 'Field-Ops-Manual.docx',
            query: 'How are field dispatch tickets prioritized?',
            answer: 'Field dispatch tickets are prioritized automatically based on client service level tier and emergency status: <strong>Tier 1 (Emergency)</strong> is dispatched within <strong>2 hours</strong>; <strong>Tier 2 (Scheduled)</strong> within <strong>24 hours</strong>; and <strong>Tier 3 (Consultations)</strong> is batched weekly.',
            hash: '0x3c11da88b2',
            retrievalTime: '18ms'
        },
        subcontractors: {
            source: 'HR-Subcontractor-Onboarding.pdf',
            docRef: 'HR-Onboarding-SOP.pdf',
            query: 'How do we onboard new sub-contractors?',
            answer: 'New sub-contractors must complete: 1) Signed NDA & Service Agreement, 2) Secure Endpoint Verification, and 3) Access Gating Setup. Once verified, onboarding scripts auto-provision limited access keys for specific active tickets.',
            hash: '0xe4e1a0b12c',
            retrievalTime: '24ms'
        },
        retention: {
            source: 'MindRiot-Security-Policy-2026.pdf',
            docRef: 'MindRiot-Security.pdf',
            query: 'What is our data retention policy?',
            answer: 'Customer data is retained locally for the duration of the active engagement. After project hand-off and the 30-day fine-tuning period, all database credentials and customer records are securely purged from our systems, leaving the client with complete local control.',
            hash: '0x99a77f240e',
            retrievalTime: '15ms'
        }
    };

    let queryTimeout = null;

    function runRAGQuery(queryText, docRef, answerText, sourceFile, hash, retrievalTime) {
        // Clear previous timeouts and logs
        if (queryTimeout) clearTimeout(queryTimeout);
        terminalBody.innerHTML = '';

        // 1. User Query log
        const userLog = document.createElement('p');
        userLog.className = 'console-log user-query';
        userLog.textContent = `> Query: ${queryText}`;
        terminalBody.appendChild(userLog);
        scrollTerminal();

        // 2. Initializing log
        queryTimeout = setTimeout(() => {
            const initLog = document.createElement('p');
            initLog.className = 'console-log sys-log';
            initLog.textContent = '[1/3] Connecting to secure local vector store... OK';
            terminalBody.appendChild(initLog);
            scrollTerminal();

            // 3. Scanning logs
            queryTimeout = setTimeout(() => {
                const scanLog = document.createElement('p');
                scanLog.className = 'console-log sys-progress';
                scanLog.textContent = `Scanning document index... Checked [${docRef}] (96% semantic match)`;
                terminalBody.appendChild(scanLog);
                scrollTerminal();

                // 4. Formatting output
                queryTimeout = setTimeout(() => {
                    const formatLog = document.createElement('p');
                    formatLog.className = 'console-log sys-log';
                    formatLog.textContent = '[3/3] Synthesizing isolated answer with local LLM context...';
                    terminalBody.appendChild(formatLog);
                    scrollTerminal();

                    // 5. Answer card
                    queryTimeout = setTimeout(() => {
                        const answerCard = document.createElement('div');
                        answerCard.className = 'console-log answer-card';
                        answerCard.innerHTML = answerText;

                        const meta = document.createElement('div');
                        meta.className = 'answer-meta';
                        meta.innerHTML = `
                            <span>📄 Source: ${sourceFile}</span>
                            <span>⏱️ Latency: ${retrievalTime}</span>
                            <span>🔑 Node Hash: ${hash}</span>
                            <span>🛡️ Privacy: 100% Isolated VPC</span>
                        `;
                        answerCard.appendChild(meta);
                        terminalBody.appendChild(answerCard);
                        scrollTerminal();
                    }, 400);

                }, 500);

            }, 450);

        }, 300);
    }

    function scrollTerminal() {
        terminalBody.scrollTop = terminalBody.scrollHeight;
    }

    promptChips.forEach(chip => {
        chip.addEventListener('click', () => {
            // Remove active classes
            promptChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');

            const key = chip.getAttribute('data-prompt');
            const data = sopDatabase[key];
            if (data) {
                runRAGQuery(data.query, data.docRef, data.answer, data.source, data.hash, data.retrievalTime);
            }
        });
    });

    if (terminalForm) {
        terminalForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const val = terminalInput.value.trim();
            if (!val) return;

            // Remove active state on prompt chips
            promptChips.forEach(c => c.classList.remove('active'));

            runRAGQuery(
                val,
                'Dynamic-Vector-Cache',
                'This is a live interactive proof of concept demonstrating our private search system. In a production build, this search engine will query your actual PDFs, Notion pages, and CRM records. <a href="#audit" class="gradient-text font-bold" style="text-decoration: underline;">Request a B2B AI Sprint Opportunity Audit</a> to design a private SOP search console for your business.',
                'Simulated-Document-Store',
                '0x77d12f88ff',
                '32ms'
            );

            terminalInput.value = '';
        });
    }

    if (terminalBody) {
        terminalBody.addEventListener('click', (e) => {
            const link = e.target.closest('a[href="#audit"]');
            if (link) {
                e.preventDefault();
                openModal(e);
            }
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApplication);
} else {
    initApplication();
}

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
