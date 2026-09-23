/**
 * MindRiot Labs - Portfolio & Pipeline Interactive Controller
 * Dynamic statistics calculation, single-expanded accordion controller,
 * and mobile-first responsive filter engine.
 */

import { PORTFOLIO_PROJECTS } from "./portfolio-data.js";

document.addEventListener("DOMContentLoaded", () => {
  initStats();
  renderProjects(PORTFOLIO_PROJECTS);
  initFilters();
});

/**
 * Derives and updates hero summary counters from real project data.
 */
function initStats() {
  const liveCount = PORTFOLIO_PROJECTS.filter(
    (p) => p.status === "Live" || p.status === "Institutional System",
  ).length;

  const mvpCount = PORTFOLIO_PROJECTS.filter(
    (p) => p.status === "MVP" || p.status === "Pilot",
  ).length;

  const buildCount = PORTFOLIO_PROJECTS.filter(
    (p) =>
      p.status === "Active Build" ||
      p.status === "Feature Complete" ||
      p.status === "Active Design",
  ).length;

  const pipelineCount = PORTFOLIO_PROJECTS.filter(
    (p) =>
      p.status === "Concept" ||
      p.status === "Research" ||
      p.status === "Framework",
  ).length;

  const totalCount = PORTFOLIO_PROJECTS.length;

  const elLive = document.getElementById("statLiveCount");
  const elMvp = document.getElementById("statMvpCount");
  const elBuild = document.getElementById("statBuildCount");
  const elPipeline = document.getElementById("statPipelineCount");
  const elTotal = document.getElementById("statTotalCount");

  if (elLive) elLive.textContent = liveCount;
  if (elMvp) elMvp.textContent = mvpCount;
  if (elBuild) elBuild.textContent = buildCount;
  if (elPipeline) elPipeline.textContent = pipelineCount;
  if (elTotal) elTotal.textContent = totalCount;
}

/**
 * Builds and renders accessible project cards.
 */
function renderProjects(projects) {
  const grid = document.getElementById("portfolioGrid");
  if (!grid) return;

  grid.innerHTML = "";

  projects.forEach((p) => {
    const card = document.createElement("article");
    card.className = "project-card";
    card.id = `project-${p.id}`;
    card.dataset.status = p.status;
    card.dataset.speed = p.speed;
    card.dataset.beachhead = p.beachhead ? "1" : "0";

    const liveLinkHtml = p.url
      ? `<a class="project-live-link" href="${p.url}" target="_blank" rel="noopener noreferrer" aria-label="Visit ${p.name} website at ${p.url.replace(/^https?:\/\//, "")} (opens in a new tab)" onclick="event.stopPropagation()">
          <span class="live-dot" aria-hidden="true"></span>
          <span>${p.url.replace(/^https?:\/\//, "")}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
        </a>`
      : "";

    const beachheadHtml = p.beachhead
      ? `<div class="beachhead-flag">
          <span aria-hidden="true">🎯</span> Beachhead Pick
        </div>`
      : "";

    const complexityClass =
      p.gtmComplexity === "Low"
        ? "complexity-low"
        : p.gtmComplexity === "Medium"
          ? "complexity-medium"
          : "complexity-high";

    const nextStepsHtml = p.nextSteps
      .map(
        (step, idx) =>
          `<li><span class="step-num" aria-hidden="true">${idx + 1}</span><span>${step}</span></li>`,
      )
      .join("");

    card.innerHTML = `
      <div class="card-header-block" tabindex="0" role="button" aria-expanded="false" aria-controls="detail-pane-${p.id}">
        <div class="card-top-row">
          <span class="status-badge ${p.statusClass}">${p.statusSymbol}</span>
          <span class="card-category">${p.category}</span>
        </div>
        ${beachheadHtml}
        <h3 class="project-name">${p.name}</h3>
        <p class="project-tagline">${p.tagline}</p>
        ${liveLinkHtml}
      </div>

      <div class="card-metrics" aria-label="Commercial and validation indicators">
        <div class="metric-col">
          <span class="metric-label" title="Internal directional planning range, not a forecast">Directional Potential</span>
          <span class="metric-val">${p.directionalPotential}</span>
        </div>
        <div class="metric-col">
          <span class="metric-label">Validation Milestone</span>
          <span class="metric-val">${p.timeToMilestone}</span>
        </div>
        <div class="metric-col">
          <span class="metric-label">GTM Complexity</span>
          <span class="metric-val ${complexityClass}">${p.gtmComplexity}</span>
        </div>
      </div>

      <button class="card-expand-bar" aria-expanded="false" aria-controls="detail-pane-${p.id}">
        <span class="expand-label">Explore Case Brief</span>
        <svg class="chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      <div class="card-detail-pane" id="detail-pane-${p.id}" role="region" aria-label="${p.name} Detailed Brief">
        <div>
          <div class="detail-block-title">System Overview</div>
          <div class="detail-block-text">${p.overview}</div>
        </div>

        <div>
          <div class="detail-block-title">Novelty & Differentiation</div>
          <div class="detail-block-text">${p.differentiation}</div>
        </div>

        <div>
          <div class="detail-block-title">Launch / Validation Investment</div>
          <span class="launch-cost-pill">${p.launchInvestment}</span>
        </div>

        <div>
          <div class="detail-block-title">Key Next Steps & Milestones</div>
          <ul class="steps-list">${nextStepsHtml}</ul>
        </div>

        <div>
          <div class="detail-block-title">OWEN Architecture Alignment</div>
          <span class="owen-align-tag">◈ ${p.owenAlignment}</span>
        </div>
      </div>
    `;

    // Interactive expansion handler (One card expanded at a time)
    const toggleExpansion = () => {
      const isExpanded = card.classList.contains("expanded");

      // Close all other expanded cards
      document.querySelectorAll(".project-card.expanded").forEach((c) => {
        c.classList.remove("expanded");
        const header = c.querySelector(".card-header-block");
        const btn = c.querySelector(".card-expand-bar");
        const lbl = c.querySelector(".expand-label");
        if (header) header.setAttribute("aria-expanded", "false");
        if (btn) btn.setAttribute("aria-expanded", "false");
        if (lbl) lbl.textContent = "Explore Case Brief";
      });

      // If this card was not already expanded, expand it
      if (!isExpanded) {
        card.classList.add("expanded");
        const header = card.querySelector(".card-header-block");
        const btn = card.querySelector(".card-expand-bar");
        const lbl = card.querySelector(".expand-label");
        if (header) header.setAttribute("aria-expanded", "true");
        if (btn) btn.setAttribute("aria-expanded", "true");
        if (lbl) lbl.textContent = "Collapse Brief";
      }
    };

    // Click on header or bottom expand bar toggles expansion
    const headerBlock = card.querySelector(".card-header-block");
    const expandBtn = card.querySelector(".card-expand-bar");

    headerBlock.addEventListener("click", toggleExpansion);
    expandBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleExpansion();
    });

    // Keyboard accessibility for card header
    headerBlock.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleExpansion();
      }
    });

    grid.appendChild(card);
  });

  updateCount();
}

/**
 * Initializes filter controls and handles result updates.
 */
function initFilters() {
  const filterButtons = document.querySelectorAll(".filter-btn");

  filterButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      filterButtons.forEach((b) => {
        b.classList.remove("active");
        b.setAttribute("aria-pressed", "false");
      });

      btn.classList.add("active");
      btn.setAttribute("aria-pressed", "true");

      const filterType = btn.dataset.filter;
      applyFilter(filterType);
    });
  });
}

/**
 * Applies the selected filter and toggles visibility.
 */
function applyFilter(filter) {
  const cards = document.querySelectorAll(".project-card");

  cards.forEach((card) => {
    const status = card.dataset.status;
    const speed = parseInt(card.dataset.speed, 10);
    const isBeachhead = card.dataset.beachhead === "1";

    let show = false;

    switch (filter) {
      case "all":
        show = true;
        break;
      case "beachhead":
        show = isBeachhead;
        break;
      case "live":
        show = status === "Live" || status === "Institutional System";
        break;
      case "nearterm":
        show =
          speed <= 2 && status !== "Live" && status !== "Institutional System";
        break;
      case "building":
        show =
          status === "Active Build" ||
          status === "Feature Complete" ||
          status === "Active Design";
        break;
      case "pipeline":
        show =
          status === "Concept" ||
          status === "Research" ||
          status === "Framework";
        break;
      default:
        show = true;
    }

    card.classList.toggle("hidden", !show);

    // If hiding an expanded card, collapse it
    if (!show && card.classList.contains("expanded")) {
      card.classList.remove("expanded");
      const header = card.querySelector(".card-header-block");
      const btn = card.querySelector(".card-expand-bar");
      const lbl = card.querySelector(".expand-label");
      if (header) header.setAttribute("aria-expanded", "false");
      if (btn) btn.setAttribute("aria-expanded", "false");
      if (lbl) lbl.textContent = "Explore Case Brief";
    }
  });

  updateCount();
}

/**
 * Updates visible project counter indicator.
 */
function updateCount() {
  const visible = document.querySelectorAll(
    ".project-card:not(.hidden)",
  ).length;
  const countEl = document.getElementById("portfolioCountInfo");
  if (countEl) {
    countEl.textContent = `Showing ${visible} of ${PORTFOLIO_PROJECTS.length} products`;
  }
}
