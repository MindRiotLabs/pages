/* 
   MindRiot Labs - SMB AI Advisory & Portfolio Hub
   Interactive Client-Side JavaScript
*/


// -------------------------------------------------------------
// Supabase Database Configuration
// -------------------------------------------------------------
const SUPABASE_URL = "https://xkgtipcyswjpvwmmawmf.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_a84bMzDhwTFRDxLnfMTLcA_pov-Kgr3";

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

    // Conditional Industry elements
    const clientIndustry = document.getElementById('clientIndustry');
    const industryOtherGroup = document.getElementById('industry-other-group');
    const clientIndustryOther = document.getElementById('clientIndustryOther');

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
            if (industryOtherGroup) {
                industryOtherGroup.style.display = 'none';
            }
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

    // Industry dropdown toggle for "Other" conditional specification
    if (clientIndustry && industryOtherGroup) {
        clientIndustry.addEventListener('change', () => {
            if (clientIndustry.value.toLowerCase() === 'other') {
                industryOtherGroup.style.display = 'block';
            } else {
                industryOtherGroup.style.display = 'none';
                if (clientIndustryOther) clientIndustryOther.value = '';
                industryOtherGroup.classList.remove('has-error');
            }
        });
    }

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
        });
    }

    // Close mobile menu when clicking nav links
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            navLinksContainer.classList.remove('mobile-active');
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
        const industryOtherVal = document.getElementById('clientIndustryOther').value.trim();
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

        // Industry Other Validation
        if (industry.toLowerCase() === 'other' && !industryOtherVal) {
            document.getElementById('industry-other-group').classList.add('has-error');
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
        let finalIndustry = industry;
        if (industry.toLowerCase() === 'other') {
            finalIndustry = "Other: " + industryOtherVal;
        }

        const leadPayload = {
            name,
            email,
            company,
            industry: finalIndustry,
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
                            business_name: company,
                            industry: finalIndustry,
                            revenue_size: size,
                            bottleneck: bottleneck,
                            email: email
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

    // =============================================================
    // Client Portal & Stripe Simulation Handler (Sprint 3)
    // =============================================================
    const openPortalButtons = document.querySelectorAll('.open-portal-btn');
    const portalModal = document.getElementById('portal');
    const closePortalBtn = document.getElementById('closePortalBtn');
    
    const portalLoginState = document.getElementById('portalLoginState');
    const portalDashboardState = document.getElementById('portalDashboardState');
    const portalLoginForm = document.getElementById('portalLoginForm');
    const portalEmailInput = document.getElementById('portalEmail');
    const portalEmailGroup = document.getElementById('portalEmailGroup');
    const portalAuthSuccess = document.getElementById('portalAuthSuccess');
    const portalSimulateLoginBtn = document.getElementById('portalSimulateLoginBtn');
    const portalSignOutBtn = document.getElementById('portalSignOutBtn');
    
    // Tab switching
    const portalTabButtons = document.querySelectorAll('.portal-tab-btn');
    const portalTabContents = document.querySelectorAll('.portal-tab-content');
    
    // Stripe Modal selections
    const stripeModal = document.getElementById('stripeModal');
    const closeStripeBtn = document.getElementById('closeStripeBtn');
    const stripeForm = document.getElementById('stripeForm');
    const stripeCardNumber = document.getElementById('stripeCardNumber');
    const stripeCardExpiry = document.getElementById('stripeCardExpiry');
    const stripeCardCvc = document.getElementById('stripeCardCvc');
    const stripeCardName = document.getElementById('stripeCardName');
    const stripeFillDemoBtn = document.getElementById('stripeFillDemoBtn');
    const stripeSubmitBtn = document.getElementById('stripeSubmitBtn');
    const stripePaymentItem = document.getElementById('stripePaymentItem');
    const stripePaymentAmount = document.getElementById('stripePaymentAmount');
    
    const stripePaymentState = document.getElementById('stripePaymentState');
    const stripeLoadingState = document.getElementById('stripeLoadingState');
    const stripeSuccessState = document.getElementById('stripeSuccessState');
    const stripeSuccessCloseBtn = document.getElementById('stripeSuccessCloseBtn');
    
    let activeUserEmail = null;
    let isMockAuth = false;
    let pendingPaymentItem = null;

    // Open/Close handlers
    function openPortal(e) {
        if (e && e.preventDefault) e.preventDefault();
        portalModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Push state for hash routing
        window.location.hash = '#portal';
        
        // Verify session
        checkPortalAuthState();
    }

    function closePortal() {
        portalModal.classList.remove('active');
        document.body.style.overflow = '';
        
        if (window.location.hash === '#portal') {
            history.pushState("", document.title, window.location.pathname + window.location.search);
        }
    }

    openPortalButtons.forEach(btn => {
        btn.addEventListener('click', openPortal);
    });

    closePortalBtn.addEventListener('click', closePortal);

    portalModal.addEventListener('click', (e) => {
        if (e.target === portalModal) {
            closePortal();
        }
    });

    // Close on Escape key press
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (portalModal.classList.contains('active')) {
                closePortal();
            }
            if (stripeModal.classList.contains('active')) {
                closeStripeCheckout();
            }
        }
    });

    // Handle hash route for portal
    function checkHashAndOpenPortal() {
        if (window.location.hash === '#portal') {
            openPortal();
        }
    }
    
    window.addEventListener('hashchange', () => {
        if (window.location.hash === '#portal') {
            checkHashAndOpenPortal();
        } else if (portalModal.classList.contains('active') && window.location.hash !== '#portal') {
            portalModal.classList.remove('active');
            document.body.style.overflow = '';
        }
    });
    
    checkHashAndOpenPortal();

    // Check Auth State
    async function checkPortalAuthState() {
        // First check mock auth
        const mockUser = localStorage.getItem('mindriot_mock_user');
        if (mockUser) {
            activeUserEmail = mockUser;
            isMockAuth = true;
            showAuthenticatedDashboard(mockUser);
            return;
        }

        // Then check real Supabase auth
        if (supabaseClient) {
            try {
                const { data: { session } } = await supabaseClient.auth.getSession();
                if (session) {
                    activeUserEmail = session.user.email;
                    isMockAuth = false;
                    showAuthenticatedDashboard(session.user.email);
                    return;
                }
            } catch (err) {
                console.error('[Supabase Auth Check Fail]:', err);
            }
        }

        // Default to login form
        showLoginForm();
    }

    function showLoginForm() {
        portalLoginState.style.display = 'block';
        portalDashboardState.style.display = 'none';
        portalAuthSuccess.style.display = 'none';
        portalLoginForm.reset();
        
        // Update Nav Client Login labels
        updateNavLoginLabels(false);
    }

    async function showAuthenticatedDashboard(email) {
        portalLoginState.style.display = 'none';
        portalDashboardState.style.display = 'flex';
        
        document.getElementById('portalGreeting').textContent = `Welcome Back`;
        document.getElementById('portalCompanyName').textContent = `Loading your Systems Roadmap...`;
        
        // Update Nav Labels
        updateNavLoginLabels(true, email);
        
        // Load roadmap proposal data
        await loadClientProposal(email);
    }

    function updateNavLoginLabels(loggedIn, email = '') {
        const portalNavLinks = document.querySelectorAll('.open-portal-btn');
        portalNavLinks.forEach(link => {
            if (loggedIn) {
                link.innerHTML = `<span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#10B981; margin-right:6px; box-shadow: 0 0 6px #10B981;"></span>Portal Dashboard`;
                link.title = `Logged in as ${email}`;
            } else {
                link.textContent = 'Client Login';
                link.title = '';
            }
        });
    }

    // Portal Tab switching
    portalTabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            portalTabButtons.forEach(b => {
                b.classList.remove('active');
                b.style.borderBottomColor = 'transparent';
                b.style.color = 'var(--text-secondary)';
            });
            btn.classList.add('active');
            btn.style.borderBottomColor = 'var(--accent-cyan)';
            btn.style.color = '#fff';

            const targetTab = btn.getAttribute('data-portal-tab');
            portalTabContents.forEach(content => {
                if (content.id === `portalTab${targetTab.charAt(0).toUpperCase() + targetTab.slice(1)}`) {
                    content.style.display = 'block';
                } else {
                    content.style.display = 'none';
                }
            });
        });
    });

    // Supabase Auth listener
    if (supabaseClient) {
        supabaseClient.auth.onAuthStateChange(async (event, session) => {
            if (session) {
                activeUserEmail = session.user.email;
                isMockAuth = false;
                showAuthenticatedDashboard(session.user.email);
            } else if (!isMockAuth) {
                activeUserEmail = null;
                showLoginForm();
            }
        });
    }

    // Login Form Submit (OTP Magic Link)
    portalLoginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        portalEmailGroup.classList.remove('has-error');
        portalAuthSuccess.style.display = 'none';

        const email = portalEmailInput.value.trim();
        if (!email || !validateEmail(email)) {
            portalEmailGroup.classList.add('has-error');
            return;
        }

        const submitBtn = document.getElementById('portalSubmitEmailBtn');
        const originalBtnText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Sending Magic Link... <span class="stripe-spinner" style="width: 14px; height: 14px; border-width: 2px; margin-left: 6px; display: inline-block;"></span>';

        if (supabaseClient) {
            try {
                const { error } = await supabaseClient.auth.signInWithOtp({
                    email,
                    options: {
                        redirectTo: window.location.origin
                    }
                });
                
                if (error) {
                    console.error('[Supabase Auth Error]:', error.message);
                    alert('Supabase Auth error: ' + error.message);
                } else {
                    portalAuthSuccess.style.display = 'block';
                    portalLoginForm.reset();
                }
            } catch (err) {
                console.error('[Auth Exception]:', err);
                alert('An auth exception occurred: ' + err.message);
            }
        } else {
            console.warn('[Supabase Warning] Supabase client is not available. Please use Simulation Auth Bypass.');
            alert('Supabase is not configured on this client. Please click the "⚡ Simulate Auth Bypass" button to log in instantly.');
        }

        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
    });

    // Mock Login Bypass click
    portalSimulateLoginBtn.addEventListener('click', () => {
        const email = portalEmailInput.value.trim() || "test@mindriotlabs.com";
        localStorage.setItem('mindriot_mock_user', email);
        activeUserEmail = email;
        isMockAuth = true;
        showAuthenticatedDashboard(email);
    });

    // Sign Out Handler
    portalSignOutBtn.addEventListener('click', async () => {
        if (isMockAuth) {
            localStorage.removeItem('mindriot_mock_user');
            isMockAuth = false;
            activeUserEmail = null;
            showLoginForm();
        } else if (supabaseClient) {
            await supabaseClient.auth.signOut();
        }
    });

    // Load Client Proposal / Lead details
    async function loadClientProposal(email) {
        let clientData = null;
        
        // Attempt query from database
        if (supabaseClient && !isMockAuth) {
            try {
                const { data, error } = await supabaseClient
                    .from('audit_leads')
                    .select('*')
                    .eq('email', email)
                    .order('id', { ascending: false })
                    .limit(1);
                
                if (data && data.length > 0) {
                    clientData = data[0];
                }
            } catch (err) {
                console.error('[Supabase Query Lead Error]:', err);
            }
        }

        // If no data found, check if it's the mock user, or build fallback data
        if (!clientData) {
            // Check if there are local leads matching
            try {
                const localLeads = JSON.parse(localStorage.getItem('mindriot_leads') || '[]');
                const matching = localLeads.reverse().find(l => l.email === email);
                if (matching) {
                    clientData = {
                        business_name: matching.company,
                        industry: matching.industry,
                        revenue_size: matching.companySize,
                        bottleneck: matching.operationalBottleneck,
                        email: matching.email
                    };
                }
            } catch (err) {
                console.warn('LocalStorage local lead search failed.');
            }
        }

        // Mock Default for standard test logins if no leads found in database or localStorage
        if (!clientData) {
            if (email === 'test@mindriotlabs.com' || email.includes('test')) {
                clientData = {
                    business_name: "Radiance Logistics Ltd",
                    industry: "Field Services & Logistics",
                    revenue_size: "$1M - $5M / 10-50 team",
                    bottleneck: "Dispatch crew tickets are scheduled on manual spreadsheets, costing 15+ hours weekly in communications.",
                    email: email
                };
            } else {
                // Return fallback state prompting them to book audit
                renderFallbackProposal(email);
                return;
            }
        }

        // Fill greetings
        document.getElementById('portalGreeting').textContent = `Welcome, ${clientData.business_name || 'Client'}`;
        document.getElementById('portalCompanyName').textContent = `${clientData.business_name || 'Anonymous Ltd'} • ${clientData.industry || 'General SMB'}`;

        // Populate Systems Roadmap
        populateSystemsRoadmap(clientData);
        
        // Sync payment badge and tracker milestones
        syncPaymentStatus(email);
    }

    function renderFallbackProposal(email) {
        document.getElementById('portalGreeting').textContent = `Hello, Client`;
        document.getElementById('portalCompanyName').textContent = `${email}`;
        
        const badge = document.getElementById('portalStatusBadge');
        badge.className = 'portal-status-badge ready';
        badge.textContent = 'No Lead Record';

        document.getElementById('roadmapBottleneckText').innerHTML = `
            No active lead opportunity or operational audit record was found in the database for <strong>${email}</strong>.<br><br>
            To create a custom Systems Roadmap, please fill out the <strong>AI Opportunity Audit Form</strong> on the homepage.
        `;

        document.getElementById('roadmapWorkflowVisual').innerHTML = `
            <div class="workflow-step-card">
                <div class="workflow-step-num">!</div>
                <div class="workflow-step-details">
                    <h5>Audit Required</h5>
                    <p>Schedule your AI Sprint Audit on the homepage to generate a custom step-by-step automated workflow blueprint.</p>
                </div>
            </div>
        `;

        document.getElementById('roadmapTechStack').innerHTML = `
            <span class="tech-badge">Supabase</span>
            <span class="tech-badge">Make.com</span>
            <span class="tech-badge">AI Roadmap Engine</span>
        `;
        
        // Reset timelines to default
        setTimelineStepStatus('upcoming', 'upcoming', 'upcoming');
    }

    // Populate systems roadmap elements from lead details
    function populateSystemsRoadmap(lead) {
        const bottleneck = lead.bottleneck || '';
        const lowerBottleneck = bottleneck.toLowerCase();
        
        // 1. Dynamic Bottleneck Analysis mapping
        let analysisText = "";
        if (lowerBottleneck.includes('spreadsheet') || lowerBottleneck.includes('manual') || lowerBottleneck.includes('scheduling') || lowerBottleneck.includes('dispatch')) {
            analysisText = `Our operational analysis of <strong>${lead.business_name}</strong> reveals a primary logistics scheduling bottleneck. Managing route assignments and crew dispatch via static sheets introduces a cumulative <strong>15–20 hours/week</strong> of administrative overhead. The workflow is highly vulnerable to human communication lag, resulting in delayed service responses and customer contact friction.`;
        } else if (lowerBottleneck.includes('intake') || lowerBottleneck.includes('lead') || lowerBottleneck.includes('email') || lowerBottleneck.includes('crm')) {
            analysisText = `Our analysis of <strong>${lead.business_name}</strong>'s sales operations shows substantial friction in customer lead intake and response systems. The manual filtering of raw emails and CRM entry delays initial responses by an average of 4-12 hours, directly lowering top-of-funnel customer conversions. Auto-synthesizing and prioritizing incoming records represents a major operational growth point.`;
        } else {
            analysisText = `A deep dive into <strong>${lead.business_name}</strong>'s workflows highlights immediate efficiency constraints in: <em>"${bottleneck}"</em>. The lack of centralized automation results in redundant manual transcription gates, information silos, and unnecessary resource expenditures, bottlenecking team capacity.`;
        }
        document.getElementById('roadmapBottleneckText').innerHTML = analysisText;

        // 2. Dynamic Workflow Steps visual mapping
        let workflowSteps = [];
        if (lowerBottleneck.includes('spreadsheet') || lowerBottleneck.includes('manual') || lowerBottleneck.includes('scheduling') || lowerBottleneck.includes('dispatch')) {
            workflowSteps = [
                { title: "Intake Node (Voice & Email parsing)", desc: "Incoming customer inquiries and voicemail tickets are transcribed & extracted into structured JSON automatically." },
                { title: "Optimizer Node (Route Allocation)", desc: "Syncs coordinates with Google Maps API and assigns routes based on team capacity and priority." },
                { title: "Notification Node (Real-time SMS Routing)", desc: "Pushes optimized tickets to field crew devices via SMS with live updates dispatched back to CRM." }
            ];
        } else if (lowerBottleneck.includes('intake') || lowerBottleneck.includes('lead') || lowerBottleneck.includes('email') || lowerBottleneck.includes('crm')) {
            workflowSteps = [
                { title: "Lead Capture webhook", desc: "Monitors email contact forms, PDFs, and website endpoints in real-time." },
                { title: "AI Filtering & Scoring (LLM Synthesis)", desc: "Categorizes and scores lead value, extracting company budgets, sizes, and operational bottlenecks." },
                { title: "CRM Sync & Team slack alert", desc: "Logs priority records in Hubspot/Salesforce and alerts account managers on Slack instantly." }
            ];
        } else {
            workflowSteps = [
                { title: "Data Ingestion webhook", desc: "Automated trigger captures data entries and file uploads instantly." },
                { title: "AI Extraction Node (Isolated LLM)", desc: "Secured local retrieval parsing details, checking compliance rules, and formatting output." },
                { title: "Target Database & Webhook execution", desc: "Direct database updates synchronized across internal operations dashboard nodes." }
            ];
        }

        const workflowContainer = document.getElementById('roadmapWorkflowVisual');
        workflowContainer.innerHTML = '';
        workflowSteps.forEach((step, idx) => {
            const stepCard = document.createElement('div');
            stepCard.className = 'workflow-step-card';
            stepCard.innerHTML = `
                <div class="workflow-step-num">${idx + 1}</div>
                <div class="workflow-step-details">
                    <h5>${step.title}</h5>
                    <p>${step.desc}</p>
                </div>
            `;
            workflowContainer.appendChild(stepCard);
        });

        // 3. Recommended Tech Stack badges mapping
        let techStack = [];
        if (lowerBottleneck.includes('spreadsheet') || lowerBottleneck.includes('manual') || lowerBottleneck.includes('scheduling') || lowerBottleneck.includes('dispatch')) {
            techStack = [
                { name: "Make.com", type: "violet" },
                { name: "Supabase DB", type: "emerald" },
                { name: "Google Maps API", type: "emerald" },
                { name: "Twilio SMS API", type: "cyan" },
                { name: "OpenAI GPT-4o OCR", type: "cyan" }
            ];
        } else if (lowerBottleneck.includes('intake') || lowerBottleneck.includes('lead') || lowerBottleneck.includes('email') || lowerBottleneck.includes('crm')) {
            techStack = [
                { name: "Make.com Integrations", type: "violet" },
                { name: "Hubspot CRM", type: "violet" },
                { name: "Claude 3.5 Sonnet API", type: "cyan" },
                { name: "Slack Webhooks", type: "cyan" }
            ];
        } else {
            techStack = [
                { name: "Supabase DB & Auth", type: "emerald" },
                { name: "Make.com", type: "violet" },
                { name: "OpenAI API", type: "cyan" },
                { name: "Local Server Node", type: "emerald" }
            ];
        }

        const techContainer = document.getElementById('roadmapTechStack');
        techContainer.innerHTML = '';
        techStack.forEach(tech => {
            const badge = document.createElement('span');
            badge.className = `tech-badge ${tech.type}`;
            badge.textContent = tech.name;
            techContainer.appendChild(badge);
        });
    }

    // Sync Payment Badge and Milestones
    function syncPaymentStatus(email) {
        const badge = document.getElementById('portalStatusBadge');
        
        // Get status (try local storage fallback first, representing the simulated DB state)
        let status = localStorage.getItem(`mindriot_payment_status_${email}`) || 'Proposal Ready';
        
        // Apply class
        if (status === 'Deposit Received') {
            badge.className = 'portal-status-badge received';
            badge.textContent = 'Deposit Received';
            setTimelineStepStatus('completed', 'active', 'upcoming');
        } else if (status === 'Sprint Active') {
            badge.className = 'portal-status-badge active-sprint';
            badge.textContent = 'Sprint Active';
            setTimelineStepStatus('completed', 'completed', 'active');
        } else {
            badge.className = 'portal-status-badge ready';
            badge.textContent = 'Proposal Ready';
            setTimelineStepStatus('completed', 'upcoming', 'upcoming');
        }
    }

    // Timeline steps controller
    function setTimelineStepStatus(step1, step2, step3) {
        updateStepElement('sprintStep1', step1, '✓');
        updateStepElement('sprintStep2', step2, '2');
        updateStepElement('sprintStep3', step3, '3');
    }

    function updateStepElement(elementId, state, stepNumber) {
        const el = document.getElementById(elementId);
        if (!el) return;
        
        el.className = `timeline-step ${state}`;
        const icon = el.querySelector('.timeline-step-icon');
        const badge = el.querySelector('.step-badge');
        
        if (state === 'completed') {
            icon.textContent = '✓';
            badge.textContent = 'Completed';
            badge.className = 'step-badge';
        } else if (state === 'active') {
            icon.textContent = stepNumber;
            badge.textContent = 'In Progress';
            badge.className = 'step-badge pulsing';
        } else {
            icon.textContent = stepNumber;
            badge.textContent = 'Upcoming';
            badge.className = 'step-badge';
        }
    }

    // =============================================================
    // Stripe Checkout Simulation Form & Event Handlers
    // =============================================================
    
    // Bind Stripe trigger buttons dynamically (since buttons are inside authenticated view)
    document.addEventListener('click', (e) => {
        const trigger = e.target.closest('.stripe-trigger-btn');
        if (trigger) {
            e.preventDefault();
            const amount = trigger.getAttribute('data-amount');
            const service = trigger.getAttribute('data-service');
            
            openStripeCheckout(amount, service);
        }
    });

    function openStripeCheckout(amount, service) {
        pendingPaymentItem = service;
        
        // Set info
        stripePaymentItem.textContent = service;
        stripePaymentAmount.textContent = `$${parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
        
        // Reset states
        stripePaymentState.style.display = 'block';
        stripeLoadingState.style.display = 'none';
        stripeSuccessState.style.display = 'none';
        stripeForm.reset();
        
        // Open overlay
        stripeModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Auto focus card number
        setTimeout(() => {
            stripeCardNumber.focus();
        }, 100);
    }

    function closeStripeCheckout() {
        stripeModal.classList.remove('active');
        // Restore background scroll ONLY if portal isn't also active
        if (!portalModal.classList.contains('active')) {
            document.body.style.overflow = '';
        }
    }

    closeStripeBtn.addEventListener('click', closeStripeCheckout);
    stripeSuccessCloseBtn.addEventListener('click', closeStripeCheckout);

    // Auto format card number input
    stripeCardNumber.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
        let formatted = '';
        for (let i = 0; i < value.length; i++) {
            if (i > 0 && i % 4 === 0) formatted += ' ';
            formatted += value[i];
        }
        e.target.value = formatted;
    });

    // Auto format expiration MM/YY
    stripeCardExpiry.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
        if (value.length > 2) {
            e.target.value = value.slice(0, 2) + '/' + value.slice(2, 4);
        } else {
            e.target.value = value;
        }
    });

    // CVC filters
    stripeCardCvc.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/[^0-9]/gi, '');
    });

    // Autofill Test card helper
    stripeFillDemoBtn.addEventListener('click', () => {
        stripeCardNumber.value = "4242 4242 4242 4242";
        stripeCardExpiry.value = "12/28";
        stripeCardCvc.value = "424";
        stripeCardName.value = "Sarah Jenkins";
        
        // Trigger visual effect on inputs
        const inputs = [stripeCardNumber, stripeCardExpiry, stripeCardCvc, stripeCardName];
        inputs.forEach(input => {
            input.style.borderColor = 'var(--accent-cyan)';
            setTimeout(() => {
                input.style.borderColor = '';
            }, 800);
        });
    });

    // Stripe Submit Form Simulation
    stripeForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // Show loading state
        stripePaymentState.style.display = 'none';
        stripeLoadingState.style.display = 'flex';
        
        setTimeout(async () => {
            // Update status based on pending payment
            let nextStatus = 'Deposit Received';
            if (pendingPaymentItem && pendingPaymentItem.includes('Audit')) {
                nextStatus = 'Sprint Active';
            }
            
            // Save state locally first (robust fallback)
            if (activeUserEmail) {
                localStorage.setItem(`mindriot_payment_status_${activeUserEmail}`, nextStatus);
                
                // Attempt to update database table audit_leads
                if (supabaseClient && !isMockAuth) {
                    try {
                        const { error } = await supabaseClient
                            .from('audit_leads')
                            .update({ payment_status: nextStatus })
                            .eq('email', activeUserEmail);
                        
                        if (error) {
                            console.error('[Supabase Payment Status Update Fail]:', error.message);
                        } else {
                            console.log('[Supabase Payment Status Update Success]');
                        }
                    } catch (err) {
                        console.error('[Supabase Payment Update Catch Exception]:', err);
                    }
                }
            }
            
            // Re-sync dashboard
            if (activeUserEmail) {
                syncPaymentStatus(activeUserEmail);
            }
            
            // Show Success screen
            stripeLoadingState.style.display = 'none';
            stripeSuccessState.style.display = 'flex';
            
        }, 1800); // 1.8s simulation latency
    });

    // -------------------------------------------------------------
    // Centerpiece Logo Shrink & Dock + Parallax Watermark Scroll Animation
    // -------------------------------------------------------------
    const headerLogo = document.getElementById('headerLogo');
    const centerpieceLogo = document.getElementById('heroCenterpieceLogo');
    const heroWatermark = document.querySelector('.hero-watermark');
    
    if (headerLogo && centerpieceLogo) {
        let startTop = 0;
        let startLeft = 0;
        let targetTop = 0;
        let targetLeft = 0;
        let startHeight = 90;
        let targetHeight = 38;
        let threshold = 200;
        let animationFrameId = null;

        function updateDimensions() {
            // Temporarily reset styles to measure original layouts
            centerpieceLogo.style.transform = '';
            centerpieceLogo.style.opacity = '1';
            headerLogo.classList.remove('docked');
            
            const centerpieceRect = centerpieceLogo.getBoundingClientRect();
            const headerLogoImg = headerLogo.querySelector('img');
            const targetLogoRect = headerLogoImg ? headerLogoImg.getBoundingClientRect() : headerLogo.getBoundingClientRect();
            
            startTop = centerpieceRect.top + window.scrollY;
            startLeft = centerpieceRect.left + window.scrollX;
            startHeight = centerpieceRect.height;
            
            targetTop = targetLogoRect.top + window.scrollY;
            targetLeft = targetLogoRect.left + window.scrollX;
            targetHeight = targetLogoRect.height;
            
            threshold = Math.max(startTop - targetTop, 100);
            
            // Re-trigger scroll processing
            onScroll();
        }

        function onScroll() {
            const scrollY = window.scrollY;
            const ratio = Math.min(scrollY / threshold, 1);
            
            if (ratio >= 1) {
                centerpieceLogo.style.opacity = '0';
                centerpieceLogo.style.transform = `translate(${targetLeft - startLeft}px, ${targetTop - startTop + scrollY}px) scale(${targetHeight / startHeight})`;
                headerLogo.classList.add('docked');
            } else {
                centerpieceLogo.style.opacity = '1';
                headerLogo.classList.remove('docked');
                
                const tx = (targetLeft - startLeft) * ratio;
                const ty = (targetTop - startTop + scrollY) * ratio;
                const scale = 1 - (1 - (targetHeight / startHeight)) * ratio;
                
                centerpieceLogo.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
            }

            if (heroWatermark) {
                // Parallax background watermark eye (scrolls at 30% speed)
                heroWatermark.style.transform = `translateY(${scrollY * 0.3}px)`;
            }
        }

        // Delay initialization slightly to ensure initial images/layouts are rendered
        setTimeout(() => {
            updateDimensions();
            window.addEventListener('resize', updateDimensions);
        }, 100);

        window.addEventListener('scroll', () => {
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
            animationFrameId = requestAnimationFrame(onScroll);
        }, { passive: true });
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
