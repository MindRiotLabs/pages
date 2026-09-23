/**
 * Max's SAT Reading & Writing Prep (/max/satprep)
 * MindRiot Labs - Client-side interactive mechanics:
 * 1. Recommended study sequence checklist with localStorage persistence
 * 2. High-res slide deck viewer with mobile touch swipe
 * 3. 25 tactical flashcards native port with spaced review & mastery tracking
 */

(function () {
    'use strict';

    /* ==========================================================================
       1. Recommended Study Sequence Checklist
       ========================================================================== */
    const STORAGE_KEY_CHECKLIST = 'mrl_max_satprep_checklist_v1';

    function getSavedChecklist() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_CHECKLIST);
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            console.warn('[SAT Prep] LocalStorage unavailable for checklist:', e);
            return {};
        }
    }

    function saveChecklist(data) {
        try {
            localStorage.setItem(STORAGE_KEY_CHECKLIST, JSON.stringify(data));
        } catch (e) {
            console.warn('[SAT Prep] Failed to save checklist:', e);
        }
    }

    function initChecklist() {
        const stepCards = document.querySelectorAll('.sat-step-card');
        const countDisplay = document.getElementById('checklistCount');
        const resetBtn = document.getElementById('resetChecklistBtn');

        if (!stepCards.length) return;

        let state = getSavedChecklist();

        function updateUI() {
            let completedCount = 0;
            stepCards.forEach(card => {
                const stepId = card.getAttribute('data-step');
                const isDone = Boolean(state[stepId]);
                const checkbox = card.querySelector('input[type="checkbox"]');
                if (checkbox) checkbox.checked = isDone;

                if (isDone) {
                    card.classList.add('completed');
                    card.setAttribute('aria-checked', 'true');
                    completedCount++;
                } else {
                    card.classList.remove('completed');
                    card.setAttribute('aria-checked', 'false');
                }
            });

            if (countDisplay) {
                countDisplay.textContent = `${completedCount} of ${stepCards.length} completed`;
            }
        }

        stepCards.forEach(card => {
            card.addEventListener('click', (e) => {
                // Prevent double trigger if clicking label/input directly
                if (e.target.tagName === 'A') return;
                const stepId = card.getAttribute('data-step');
                state[stepId] = !state[stepId];
                saveChecklist(state);
                updateUI();
            });

            // Keyboard accessibility (Space / Enter)
            card.addEventListener('keydown', (e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    const stepId = card.getAttribute('data-step');
                    state[stepId] = !state[stepId];
                    saveChecklist(state);
                    updateUI();
                }
            });
        });

        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                state = {};
                saveChecklist(state);
                updateUI();
            });
        }

        updateUI();
    }

    /* ==========================================================================
       2. Slide Deck Viewer
       ========================================================================== */
    const TOTAL_SLIDES = 10;
    let currentSlideIdx = 1;

    function initSlideViewer() {
        const slideImg = document.getElementById('slideViewerImg');
        const prevBtn = document.getElementById('slidePrevBtn');
        const nextBtn = document.getElementById('slideNextBtn');
        const indicator = document.getElementById('slideIndicator');
        const viewport = document.getElementById('slideViewport');

        if (!slideImg || !prevBtn || !nextBtn || !indicator) return;

        function updateSlide() {
            const numStr = String(currentSlideIdx).padStart(2, '0');
            slideImg.src = `/max/satprep/slides/slide-${numStr.padStart(2, '0')}.png`;
            slideImg.alt = `Game Plan Slide ${currentSlideIdx} of ${TOTAL_SLIDES}`;
            indicator.textContent = `Slide ${currentSlideIdx} of ${TOTAL_SLIDES}`;

            prevBtn.disabled = currentSlideIdx === 1;
            nextBtn.disabled = currentSlideIdx === TOTAL_SLIDES;
        }

        prevBtn.addEventListener('click', () => {
            if (currentSlideIdx > 1) {
                currentSlideIdx--;
                updateSlide();
            }
        });

        nextBtn.addEventListener('click', () => {
            if (currentSlideIdx < TOTAL_SLIDES) {
                currentSlideIdx++;
                updateSlide();
            }
        });

        // Touch swipe support for iOS Safari
        if (viewport) {
            let touchStartX = 0;
            let touchEndX = 0;

            viewport.addEventListener('touchstart', (e) => {
                touchStartX = e.changedTouches[0].screenX;
            }, { passive: true });

            viewport.addEventListener('touchend', (e) => {
                touchEndX = e.changedTouches[0].screenX;
                handleSwipe();
            }, { passive: true });

            function handleSwipe() {
                const diff = touchEndX - touchStartX;
                if (Math.abs(diff) > 40) {
                    if (diff < 0 && currentSlideIdx < TOTAL_SLIDES) {
                        currentSlideIdx++;
                        updateSlide();
                    } else if (diff > 0 && currentSlideIdx > 1) {
                        currentSlideIdx--;
                        updateSlide();
                    }
                }
            }
        }

        updateSlide();
    }

    /* ==========================================================================
       3. Interactive Flashcard Module (25 Tactical Rules)
       ========================================================================== */
    const FLASHCARDS = [
        { front: 'Boundary check', back: 'Ask: Is the left side a complete sentence? Is the right side a complete sentence?' },
        { front: 'Two complete sentences', back: 'Use a period, semicolon, or comma + FANBOYS. A comma alone creates a comma splice.' },
        { front: 'Semicolon test', back: 'Replace the semicolon with a period. If the period works, the semicolon can work.' },
        { front: 'Colon test', back: 'The words before a colon must form a complete sentence. The colon introduces an explanation, example, or list.' },
        { front: 'Paired dashes', back: 'Treat paired dashes like parentheses. Remove the interruption and test the base sentence.' },
        { front: 'Single dash', back: 'A single dash can introduce an explanation or sharp elaboration after a complete thought.' },
        { front: 'Subject–verb agreement', back: 'Strip away phrases between the subject and verb. Match the verb to the true subject.' },
        { front: 'Modifier check', back: 'Ask who is doing the opening action. That person or thing should appear immediately after the comma.' },
        { front: 'Verb tense', back: 'Find the timeline anchor: previously, since, by the time, currently, later, or a date.' },
        { front: 'Parallel structure', back: 'Items in a series should use the same grammatical form: running, swimming, and cycling.' },
        { front: 'Pronoun check', back: 'Identify the exact noun the pronoun replaces. Confirm number and clarity.' },
        { front: 'Transition question', back: 'Name the relationship first: same direction, contrast, cause, example, or sequence.' },
        { front: 'Rhetorical synthesis', back: 'Read the goal first. Use only the notes that accomplish that exact goal.' },
        { front: 'Provable beats plausible', back: 'Choose what the passage supports, not what sounds reasonable or matches outside knowledge.' },
        { front: 'Down to two', back: 'Find the exact word that makes one choice wrong.' },
        { front: 'Extreme language', back: 'Treat all, never, proves, must, and entirely with suspicion unless the passage supports that strength.' },
        { front: 'Cause vs. correlation', back: 'An association does not prove that one factor caused the other.' },
        { front: 'Inference', back: 'Choose the smallest defensible conclusion, often phrased with may, suggests, or is consistent with.' },
        { front: 'Command of evidence', back: 'State the claim first. Then predict the result that would support or weaken it.' },
        { front: 'Graph or table', back: 'Read title, axes, units, groups, and trend before interpreting the surrounding passage.' },
        { front: 'Words in context', back: 'Predict a simple replacement before reading the choices.' },
        { front: 'Function question', back: 'Ask why the author placed the sentence there, not merely what the sentence says.' },
        { front: 'Two-text question', back: 'Reduce Text 1 and Text 2 to one sentence each. Then decide agree, disagree, qualify, or support.' },
        { front: '90-second rule', back: 'At about 90 seconds: choose the best answer, flag it, and protect the rest of the module.' },
        { front: 'Hard Module 2', back: 'If it suddenly feels difficult, stay calm. Simplify the passage and harvest every available point.' }
    ];

    function initFlashcards() {
        const cardContainer = document.getElementById('flashcardContainer');
        const frontText = document.getElementById('cardFrontText');
        const backText = document.getElementById('cardBackText');
        const cardNum = document.getElementById('cardNumTag');
        const scoreDisplay = document.getElementById('cardMasteredScore');
        const progressFill = document.getElementById('cardProgressFill');
        const statusDisplay = document.getElementById('cardStatusDisplay');

        const flipBtn = document.getElementById('cardFlipBtn');
        const againBtn = document.getElementById('cardAgainBtn');
        const gotBtn = document.getElementById('cardGotBtn');
        const celebrationBanner = document.getElementById('cardCelebration');
        const restartBtn = document.getElementById('cardRestartBtn');

        if (!cardContainer || !frontText || !backText) return;

        let queue = FLASHCARDS.map((_, i) => i);
        let pos = 0;
        let mastered = new Set();

        function render() {
            if (!queue.length) {
                queue = FLASHCARDS.map((_, i) => i);
            }
            pos = Math.min(pos, queue.length - 1);
            const cardIdx = queue[pos];

            cardContainer.classList.remove('flipped');
            cardContainer.setAttribute('aria-expanded', 'false');

            frontText.textContent = FLASHCARDS[cardIdx].front;
            backText.textContent = FLASHCARDS[cardIdx].back;
            cardNum.textContent = 'RULE ' + String(cardIdx + 1).padStart(2, '0');
            statusDisplay.textContent = `Card ${pos + 1} of ${queue.length}`;
            scoreDisplay.textContent = `${mastered.size} of 25 mastered`;

            const pct = Math.max(4, (mastered.size / FLASHCARDS.length) * 100);
            progressFill.style.width = `${pct}%`;

            if (mastered.size === FLASHCARDS.length) {
                celebrationBanner.classList.add('active');
            } else {
                celebrationBanner.classList.remove('active');
            }
        }

        function toggleFlip() {
            const isFlipped = cardContainer.classList.toggle('flipped');
            cardContainer.setAttribute('aria-expanded', String(isFlipped));
        }

        function handleAnswer(gotIt) {
            const cardIdx = queue[pos];
            if (gotIt) {
                mastered.add(cardIdx);
            } else {
                mastered.delete(cardIdx);
                queue.push(cardIdx);
            }

            pos++;

            if (pos >= queue.length) {
                queue = queue.filter(idx => !mastered.has(idx));
                pos = 0;
                if (!queue.length) {
                    celebrationBanner.classList.add('active');
                }
            }

            render();
        }

        // Tap/click card face to flip
        cardContainer.addEventListener('click', toggleFlip);
        flipBtn.addEventListener('click', toggleFlip);

        againBtn.addEventListener('click', () => handleAnswer(false));
        gotBtn.addEventListener('click', () => handleAnswer(true));

        if (restartBtn) {
            restartBtn.addEventListener('click', () => {
                mastered.clear();
                queue = FLASHCARDS.map((_, i) => i);
                pos = 0;
                celebrationBanner.classList.remove('active');
                render();
            });
        }

        // Keyboard controls on desktop
        document.addEventListener('keydown', (e) => {
            // Only trigger if focus is not in an input/textarea
            if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

            if (e.key === ' ' && document.activeElement === cardContainer) {
                e.preventDefault();
                toggleFlip();
            } else if (e.key === 'ArrowLeft') {
                handleAnswer(false);
            } else if (e.key === 'ArrowRight') {
                handleAnswer(true);
            }
        });

        render();
    }

    /* ==========================================================================
       DOM Initialization
       ========================================================================== */
    document.addEventListener('DOMContentLoaded', () => {
        initChecklist();
        initSlideViewer();
        initFlashcards();
    });
})();
