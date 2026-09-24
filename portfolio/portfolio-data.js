/**
 * MindRiot Labs - Portfolio & Pipeline Data Store
 * Grounded data model representing all 25 active systems, validated pilots,
 * reusable platforms, and research initiatives.
 */

export const PORTFOLIO_PROJECTS = [
  {
    id: 1,
    name: "Bilz HQ",
    category: "Field Service SaaS",
    status: "Live",
    statusClass: "s-live",
    statusSymbol: "● LIVE",
    speed: 1,
    beachhead: true,
    ecosystemTags: ["Cross-Vertical Pattern", "Foundry Signal Source"],
    url: "https://bilz-hq.mindriotlabs.com",
    tagline:
      "The original field-service proof: an AI-assisted operational platform built for independent pool & spa operators.",
    directionalPotential: "$100K–$500K ARR",
    timeToMilestone: "Weeks",
    gtmComplexity: "Low",
    owenAlignment: "Proof of Concept",
    overview:
      "Full-stack business management platform built for Bilz Pools and Spas, actively onboarding Bill and his team. Scheduling, client management, job tracking, AI-powered customer communications, and full service history in one place. The original live customer implementation that proved the ground-level thesis and led directly to the reusable PoolzHQ platform architecture.",
    differentiation:
      "Built directly from the founder's experience as an active customer experiencing the pain of fragmented legacy software. Proved that independent operators need lean, purpose-built workflows rather than bloated enterprise suites like Jobber or ServiceTitan ($300–$700/mo).",
    launchInvestment:
      "$0 additional — live customer implementation; focus is on codifying the repeatable playbook for PoolzHQ expansion.",
    nextSteps: [
      "Complete Bilz onboarding and document operator workflow patterns",
      "Package the onboarding and dispatch workflows into a repeatable playbook",
      "Use Bilz as the anchor field-service case study in regional operator outreach",
      "Extract reusable route, scheduling, and billing service modules into PoolzHQ",
    ],
  },
  {
    id: 2,
    name: "PoolzHQ",
    category: "Field Service SaaS",
    status: "Live",
    statusClass: "s-live",
    statusSymbol: "● LIVE",
    speed: 1,
    beachhead: true,
    ecosystemTags: ["Cross-Vertical Pattern", "Foundry Signal Source"],
    url: "https://poolzhq.com",
    tagline:
      "White-label route operating system with autonomous marketing agents, architected for pool & spa and adjacent field services.",
    directionalPotential: "$300K–$2M ARR",
    timeToMilestone: "Weeks",
    gtmComplexity: "Low",
    owenAlignment: "Integrated",
    overview:
      "The white-label platform evolution of Bilz HQ—providing route optimization, batch billing, water chemistry logging, and client messaging for independent service operators. Built with a modular service architecture designed to extend seamlessly into adjacent route-based verticals such as HVAC and plumbing without duplicating underlying platform logic.",
    differentiation:
      "Pairs core field operations with an embedded multi-agentic AI marketing assistant that continuously conducts local research, drafts promotional campaigns, and schedules marketing updates on behalf of the owner—delivering an autonomous marketing capability at an SMB price point.",
    launchInvestment:
      "$5K–$15K (operator outreach, sales enablement, regional trade association distribution).",
    nextSteps: [
      "Showcase the autonomous marketing agent as the hero capability in operator demos",
      "Target 10 independent pool and spa service operators across Michigan for pilot rollout",
      "Establish $99–$179/month subscription tiers positioned against part-time administrative overhead",
      "Engage regional equipment distributors and trade associations for channel partnerships",
      "Validate platform abstraction requirements for HVAC and plumbing workflows",
    ],
  },
  {
    id: 3,
    name: "Lax Evals",
    category: "Sports Tech",
    status: "Live",
    statusClass: "s-live",
    statusSymbol: "● LIVE",
    speed: 1,
    beachhead: true,
    url: "https://evals.springlakelax.org",
    tagline:
      "Digital tryout evaluations and multi-evaluator scoring live-validated with Spring Lake Lacrosse.",
    directionalPotential: "$300K–$1M ARR",
    timeToMilestone: "Weeks",
    gtmComplexity: "Low",
    owenAlignment: "Proof of Concept",
    overview:
      "A purpose-built digital tryout evaluation platform replacing physical clipboards, paper rubrics, and manual spreadsheet aggregation for youth sports programs. Coordinates multiple evaluators in real time, standardizes scoring rubrics, and automates instant score calculations. Field-tested and live-validated in production with Spring Lake Youth Lacrosse.",
    differentiation:
      "Addresses the acute pain point of chaotic tryout weekends by synchronizing live evaluator scoring and eliminating post-tryout spreadsheet bottlenecks. Architected so that rubrics and skill trees abstract cleanly across lacrosse, soccer, ice hockey, and baseball.",
    launchInvestment:
      "$3K–$8K (platform packaging, multi-sport rubrics, club director sales collateral).",
    nextSteps: [
      "Refine multi-evaluator coordination workflows based on Spring Lake tournament data",
      "Build post-tryout report generation and parent communication templates",
      "Package pilot offering at $300–$500 per season for regional club and travel programs",
      "Initiate targeted outreach to Michigan and Midwest youth sports associations",
      "Explore unified bundling with the Spring Lake player development PWA",
    ],
  },
  {
    id: 4,
    name: "SAT Life",
    category: "EdTech / Learning",
    status: "Live",
    statusClass: "s-live",
    statusSymbol: "● LIVE",
    speed: 1,
    beachhead: false,
    url: "https://satlife.mindriotlabs.com",
    tagline:
      "Standardized test prep reimagined through life-simulation game mechanics for self-directed practice.",
    directionalPotential: "$200K–$2M ARR",
    timeToMilestone: "1–2 Months",
    gtmComplexity: "Medium",
    owenAlignment: "Architectural Alignment",
    overview:
      "Standardized test prep structured as a text-based life simulation game where student character choices directly require solving SAT Reading, Writing, and Math challenges. High-school students voluntarily engage with practice questions within an interactive narrative loop that feels like gaming rather than passive test drills.",
    differentiation:
      "Leverages the proven high-retention gameplay loop of simulation titles to convert test anxiety into voluntary, self-directed practice. Early validation shows organic student engagement without formal instruction or assigned homework.",
    launchInvestment:
      "$5K–$15K (intellectual property review, app store publishing, initial creator seeding).",
    nextSteps: [
      "Complete intellectual property and trademark review regarding standardized test terminology",
      "Define student monetization model (freemium core with optional full question-bank unlock)",
      "Expand question repository across digital SAT format specifications",
      "Seed with high-school study communities and educational social channels",
      "Explore institutional site licenses for high-school counseling and test-prep programs",
    ],
  },
  {
    id: 5,
    name: "AP Bio Quest",
    category: "EdTech / Learning",
    status: "Live",
    statusClass: "s-live",
    statusSymbol: "● LIVE",
    speed: 1,
    beachhead: false,
    url: "https://apbioquest.mindriotlabs.com",
    tagline:
      "Elimination battle-loop learning mechanics for AP exam prep, built on an extensible multi-course architecture.",
    directionalPotential: "$300K–$3M ARR",
    timeToMilestone: "1–2 Months",
    gtmComplexity: "Medium",
    owenAlignment: "Architectural Alignment",
    overview:
      "Competitive elimination game mechanics applied to Advanced Placement biology review. Students navigate question rounds designed to reinforce core biological concepts under dynamic game rules. Built on an extensible modular architecture capable of generating companion question banks across multiple AP course curricula from a single engine.",
    differentiation:
      "Applies fast-paced elimination game dynamics to academic review, driving voluntary mastery sessions among AP students. Public standardized curriculum enables rapid multi-course expansion at low marginal authoring cost.",
    launchInvestment:
      "$5K–$15K (IP and curriculum clearance, additional course module development, teacher outreach).",
    nextSteps: [
      "Conduct formal trademark and curriculum fair-use clearance",
      "Package AP Biology as the flagship title and prepare expansion templates for Chemistry and Calculus",
      "Establish freemium and monthly subscription tiers ($2.99–$4.99/mo per student)",
      "Distribute through AP educator communities, teacher forums, and peer study groups",
      "Develop educator dashboard for aggregate class performance visibility",
    ],
  },
  {
    id: 6,
    name: "SecondSelfStudio.ai",
    category: "AI Creator Tools",
    status: "MVP",
    statusClass: "s-mvp",
    statusSymbol: "◐ MVP",
    speed: 2,
    beachhead: true,
    url: null,
    tagline:
      "Personalized digital twin platform enabling practitioners to deploy voice-, expertise-, and content-aligned AI interfaces.",
    directionalPotential: "$500K–$5M ARR",
    timeToMilestone: "1–2 Months",
    gtmComplexity: "Medium",
    owenAlignment: "Integrated",
    overview:
      "A platform allowing executives, educators, consultants, and authors to create an authentic AI digital twin grounded in their own written work, recorded lectures, and domain knowledge. Represents the private-sector commercial evolution of concepts pioneered during institutional AI research at Grand Valley State University.",
    differentiation:
      "Unlike generic chatbots, SecondSelfStudio preserves individual voice and methodological integrity through structured multi-source ingestion, citation traceability, and clear conversational guardrails that prevent hallucinated advice.",
    launchInvestment:
      "$5K–$20K (finishing MVP deployment pipeline, persona onboarding UX, partner launch deck).",
    nextSteps: [
      "Complete the remaining 10% of core MVP ingestion and deployment automation",
      "Build 3 high-fidelity reference personas across executive coaching, academia, and consulting",
      "Formulate dual-track pricing: individual creators ($29–$49/mo) and enterprise/institutional teams ($500–$2,000/mo)",
      "Initiate outreach to professional speaker networks, university thought leaders, and consulting firms",
      "Reference institutional research track record from ProfAI as architectural validation",
    ],
  },
  {
    id: 7,
    name: "Coaching the Soul",
    category: "Sports / EdTech",
    status: "MVP",
    statusClass: "s-mvp",
    statusSymbol: "◐ MVP",
    speed: 2,
    beachhead: false,
    url: "https://coaching-the-soul.com",
    tagline:
      "Character-first youth coaching curriculum and credentialing platform powered by interactive AI guidance.",
    directionalPotential: "$100K–$500K ARR",
    timeToMilestone: "1–3 Months",
    gtmComplexity: "Low",
    owenAlignment: "Proof of Concept",
    overview:
      "An interactive coaching development platform that translates transformational, character-based coaching philosophies into actionable field guides and situational AI advice for youth sports coaches. Uses lacrosse as its launch demonstration sport while supporting multi-sport coaching cohorts.",
    differentiation:
      "Addresses the cultural demand for positive, empathy-driven youth coaching popularized by modern culture, providing volunteer and club coaches with micro-drills, team culture templates, and conflict resolution guides.",
    launchInvestment:
      "$2K–$8K (certification badge infrastructure, sport curriculum expansion, launch marketing).",
    nextSteps: [
      "Finalize the interactive cohort module and situational advice knowledge base",
      "Introduce a 'Coaching the Soul Certified' credential tier for league-wide adoption",
      "Partner with 2–3 regional youth athletic associations for pilot endorsement",
      "Adapt curriculum frameworks for youth soccer, basketball, and baseball leagues",
      "Develop league-level licensing for youth sports organizations and booster clubs",
    ],
  },
  {
    id: 8,
    name: "Split View",
    category: "Media / Civic Tech",
    status: "MVP",
    statusClass: "s-mvp",
    statusSymbol: "◐ MVP",
    speed: 2,
    beachhead: true,
    url: null,
    tagline:
      "Multi-perspective civic literacy platform pairing viewpoint diversity with tangible engagement incentives.",
    directionalPotential: "$500K–$10M ARR",
    timeToMilestone: "2–4 Months",
    gtmComplexity: "Medium",
    owenAlignment: "Architectural Alignment",
    overview:
      "A media literacy platform that exposes users to multiple distinct reporting perspectives on significant national issues. Pairs source-balanced news consumption with a gamified incentive layer where demonstrating comprehension of diverse perspectives earns redeemable engagement rewards.",
    differentiation:
      "Tests the thesis that viewpoint diversity can attract a broader audience when incentivized through tangible reward mechanics rather than appealing solely to consumers who already actively seek multi-perspective news.",
    launchInvestment:
      "$10K–$30K (native/PWA mobile polish, reward partner recruitment, compliance review).",
    nextSteps: [
      "Advance current functional prototype into a polished, responsive mobile web application",
      "Validate objective scoring criteria for measuring multi-perspective comprehension",
      "Conduct legal and regulatory review regarding reward redemption and promotional mechanics",
      "Recruit 3–5 initial reward sponsors aligned with civic engagement and media literacy",
      "Explore grant and research partnerships with media literacy foundations and universities",
    ],
  },
  {
    id: 9,
    name: "HypeDope.com",
    category: "Consumer / Cannabis Tech",
    status: "Active Build",
    statusClass: "s-build",
    statusSymbol: "◑ ACTIVE BUILD",
    speed: 3,
    beachhead: false,
    url: "https://hypedope.com",
    tagline:
      "Informational terpene profile and somatic preference matching engine for cannabis consumers.",
    directionalPotential: "$300K–$3M ARR",
    timeToMilestone: "3–6 Months",
    gtmComplexity: "Medium",
    owenAlignment: "Proof of Concept",
    overview:
      "An informational consumer recommendation platform that matches individual desired subjective experiences to specific cultivar terpene profiles and consumption methods. Features a personal cloud Locker for saving formulas, multimodal strain label scanning, and shareable experience cards. In active development under a dedicated build schedule.",
    differentiation:
      "Replaces unstandardized strain names with objective terpene science and consumer preference learning, providing nuanced educational guidance. All recommendations are strictly educational and informational, not medical advice.",
    launchInvestment:
      "$10K–$25K (mobile PWA distribution, brand partnership outreach, affiliate integration).",
    nextSteps: [
      "Deploy public Locker sharing links and rich social preview cards for organic acquisition",
      "Incorporate prominent informational notices and medical disclaimer safeguards",
      "Engage licensed regional retailers and brand partners for compliant affiliate directory placement",
      "Refine terpene educational taxonomy and somatic preference intake workflows",
      "Evaluate white-label recommendation widgets for dispensary web menus",
    ],
  },
  {
    id: 10,
    name: "Member Portal Platform",
    category: "Community / Org SaaS",
    status: "Active Build",
    statusClass: "s-build",
    statusSymbol: "◑ ACTIVE BUILD",
    speed: 3,
    beachhead: false,
    url: "https://portal.umichsae.org",
    tagline:
      "AI-first chapter operations and member management platform piloted with University of Michigan fraternity and alumni leaders.",
    directionalPotential: "$200K–$2M ARR",
    timeToMilestone: "3–6 Months",
    gtmComplexity: "Medium",
    owenAlignment: "Integrated",
    overview:
      "An integrated membership and chapter operations platform piloted with the University of Michigan Sigma Alpha Epsilon (Iota-Beta) chapter and alumni community. Unifies member communications, roster administration, event check-ins, dues tracking, alumni mentoring, and an AI chapter assistant to streamline recurring officer workflows.",
    differentiation:
      "Engineered specifically to solve high leadership turnover in collegiate and alumni organizations by encoding institutional operational memory, automated onboarding, and multi-tenant administrative controls.",
    launchInvestment:
      "$8K–$20K (multi-tenant white-label abstraction, onboarding documentation, council outreach).",
    nextSteps: [
      "Complete multi-tenant isolation layer to onboard secondary collegiate chapters",
      "Package white-label offering with tier pricing ($99–$299/mo per chapter)",
      "Present operational outcomes to regional interfraternity councils and alumni advisory boards",
      "Integrate alumni engagement and career networking directory modules",
      "Validate cross-campus deployment templates for national fraternal and professional societies",
    ],
  },
  {
    id: 11,
    name: "Fantasy Fame League",
    category: "Consumer / Entertainment",
    status: "Active Build",
    statusClass: "s-build",
    statusSymbol: "◑ ACTIVE BUILD",
    speed: 3,
    beachhead: false,
    url: null,
    tagline:
      "Cultural moment and entertainment draft platform applying fantasy scoring to pop culture and awards seasons.",
    directionalPotential: "$500K–$10M ARR",
    timeToMilestone: "3–6 Months",
    gtmComplexity: "Medium",
    owenAlignment: "Architectural Alignment",
    overview:
      "A social gaming platform that applies traditional fantasy sports drafting and scoring mechanics to entertainment, music, cinema, and awards seasons. Users draft rosters of creators and public figures, earning points across verified box-office milestones, award nominations, and major cultural achievements.",
    differentiation:
      "Transforms cultural moments and awards broadcasts into interactive competitive events. Ordinary fantasy points scoring is strictly decoupled from any future speculative trading or prediction-market mechanics, which remain subject to thorough legal and regulatory review.",
    launchInvestment:
      "$15K–$40K (automated cultural data feeds, regulatory compliance review, consumer launch campaign).",
    nextSteps: [
      "Complete product requirements and scoring algorithms with co-development partners",
      "Conduct formal legal review regarding fantasy gaming contest laws and prize regulations",
      "Design league configuration UX for private group competitions and seasonal tournaments",
      "Time inaugural beta league around a marquee cultural milestone (e.g. major awards season)",
      "Identify entertainment and creator community ambassadors for launch promotion",
    ],
  },
  {
    id: 12,
    name: "InstaStatsAI",
    category: "Sports Tech",
    status: "Active Build",
    statusClass: "s-build",
    statusSymbol: "◑ ACTIVE BUILD",
    speed: 3,
    beachhead: false,
    url: null,
    tagline:
      "Computer-vision and OCR pipeline designed to make automated game-film analytics accessible to regional programs.",
    directionalPotential: "$300K–$3M ARR",
    timeToMilestone: "2–4 Months",
    gtmComplexity: "Medium",
    owenAlignment: "Proof of Concept",
    overview:
      "An automated sports video analytics pipeline that extracts game events, scoreboard status, and athlete performance metrics directly from uploaded footage. Employs multi-stage verification including scoreboard optical character recognition (OCR) and event consensus models to mitigate statistical over-counting.",
    differentiation:
      "Makes automated video analytics—historically restricted to professional and elite collegiate programs costing tens of thousands annually—accessible to high schools, academies, and youth travel clubs via accessible SaaS workflows.",
    launchInvestment:
      "$10K–$25K (vision model inference optimization, validation dataset expansion, pilot testing).",
    nextSteps: [
      "Refine consensus verification algorithms across variable camera angles and lighting conditions",
      "Run closed beta testing with 5 youth lacrosse and soccer programs",
      "Structure team subscription packaging ($49–$149/mo per team)",
      "Build automated export templates compatible with common coaching platforms",
      "Integrate statistical outputs directly into the Lax Evals and player development systems",
    ],
  },
  {
    id: 13,
    name: "VaultOS / Monster Vault",
    category: "Collectibles / Social",
    status: "Active Build",
    statusClass: "s-build",
    statusSymbol: "◑ ACTIVE BUILD",
    speed: 3,
    beachhead: false,
    url: null,
    tagline:
      "White-label collection management and social cataloging platform with initial vertical instance for art toy collectors.",
    directionalPotential: "$200K–$5M ARR",
    timeToMilestone: "3–6 Months",
    gtmComplexity: "Medium",
    owenAlignment: "Proof of Concept",
    overview:
      "A white-label collection inventory, valuation, and community showcase platform. The flagship Monster Vault deployment caters to designer art toy and vinyl figure collectors (such as Labubu and Pop Mart products, referenced solely as third-party market examples without endorsement). Built on a generic catalog schema easily adapted to other enthusiast categories.",
    differentiation:
      "Combines high-fidelity personal collection tracking with community trading showcases and market valuation tools, moving collectors away from disorganized spreadsheets and fragmented social groups.",
    launchInvestment:
      "$10K–$30K (catalog schema completion, community seeding, collector influencer outreach).",
    nextSteps: [
      "Finalize the core digital shelf inventory and variant tracking mechanics",
      "Seed private beta with active collector community moderators and enthusiasts",
      "Establish clear brand disclaimers regarding third-party toy manufacturers and trademarks",
      "Plan white-label catalog templates for watches, sneakers, and trading cards",
      "Explore verified peer-to-peer transaction and showcase features",
    ],
  },
  {
    id: 14,
    name: "Project Aequitas",
    category: "LegalTech / Decision Intelligence",
    status: "Active Build",
    statusClass: "s-build",
    statusSymbol: "◑ ACTIVE BUILD",
    speed: 3,
    beachhead: false,
    ecosystemTags: [
      "Decision Support Vertical",
      "MRL / OWEN Architectural Application",
    ],
    url: null,
    tagline:
      "Human-authority legal intelligence that turns case evidence and professional experience into traceable decision support.",
    directionalPotential: "$100K–$1M ARR",
    timeToMilestone: "3–6 Months",
    gtmComplexity: "Medium",
    owenAlignment: "Integrated",
    overview:
      "A comprehensive legal intelligence and decision-support platform designed to synthesize case evidence, regulatory records, arbitrator track records, and professional precedent into transparent, verifiable briefings. The FINRA securities arbitrator evaluation module serves as an initial workflow rather than the full platform. Strictly upholds that AI provides evidence and analysis while the licensed attorney retains final professional authority.",
    differentiation:
      "Preserves full source traceability, maintains distinguishable expert perspectives, records uncertainty and dissenting considerations, and avoids generic black-box predictions. Does not predict legal outcomes with certainty or provide automated legal advice.",
    launchInvestment:
      "$5K–$15K (FINRA data-use compliance validation, professional responsibility review, pilot study).",
    nextSteps: [
      "Validate initial FINRA arbitrator evaluation output with qualified securities litigation counsel",
      "Confirm professional responsibility, data provenance, and public record usage guidelines",
      "Formalize attorney review sign-off controls and audit logging specifications",
      "Package initial workflow as specialized B2B SaaS for securities litigation practices",
      "Architect shared alignment with OWEN/MRL governance contracts for cross-domain evidence capture",
    ],
  },
  {
    id: 15,
    name: "Spring Lake Lax PWA",
    category: "Sports Tech",
    status: "Feature Complete",
    statusClass: "s-complete",
    statusSymbol: "◕ COMPLETE",
    speed: 3,
    beachhead: false,
    url: null,
    tagline:
      "Gamified player development and skill progression PWA with coach-parent communication transparency.",
    directionalPotential: "$100K–$500K ARR",
    timeToMilestone: "3–6 Months",
    gtmComplexity: "Low",
    owenAlignment: "Proof of Concept",
    overview:
      "A mobile-first player development application featuring progressive skill trees, quest completions, achievement badges, and an interactive assistant (LarryBot) for practice drills. Includes a transparent coach-parent messaging layer ensuring full communication visibility for youth athlete development.",
    differentiation:
      "Feature-complete in its primary validation deployment with Spring Lake Lacrosse; focuses on white-label abstraction so that drills, skill progressions, and coaching personas can be customized for any youth sports organization.",
    launchInvestment:
      "$5K–$15K (multi-sport curriculum authoring, white-label packaging, league marketing).",
    nextSteps: [
      "Formalize white-label configuration settings for team branding and custom skill trees",
      "Adapt core practice modules for youth soccer, ice hockey, and basketball",
      "Price as annual club package ($200–$500/year per program)",
      "Deploy combined evaluation-and-development bundle with Lax Evals",
      "Conduct coach workshops and parent onboarding demos in pilot leagues",
    ],
  },
  {
    id: 16,
    name: "Children's Book Platform",
    category: "EdTech / Creator Tools",
    status: "Concept",
    statusClass: "s-concept",
    statusSymbol: "○ CONCEPT",
    speed: 4,
    beachhead: false,
    url: null,
    tagline:
      "Multi-agent simulated publishing house guiding aspiring creators through editorial, illustration, and release workflows.",
    directionalPotential: "$200K–$2M ARR",
    timeToMilestone: "6–9 Months",
    gtmComplexity: "Medium",
    owenAlignment: "Architectural Alignment",
    overview:
      "A multi-agent collaborative environment where discrete AI roles—developmental editor, art director, reading specialist, and publishing advisor—assist aspiring authors in conceptualizing, structuring, and illustrating age-appropriate children's books.",
    differentiation:
      "Focuses on pedagogical structure, age-appropriate vocabulary scoring, and narrative pacing rather than unconstrained text generation, helping creators produce substantive, publishable work.",
    launchInvestment:
      "$20K–$50K (agent orchestration workflow, illustration style guidance, user testing).",
    nextSteps: [
      "Document role definitions and collaboration protocols for editorial and visual agents",
      "Build prototype authoring canvas with reading-level and vocabulary validation",
      "Define monthly creator subscription model ($29–$49/mo)",
      "Conduct discovery sessions with children's book authors and literacy specialists",
      "Explore independent self-publishing distribution partnerships",
    ],
  },
  {
    id: 17,
    name: "LuvTrumpsH8",
    category: "Consumer / Social",
    status: "Concept",
    statusClass: "s-concept",
    statusSymbol: "○ CONCEPT",
    speed: 2,
    beachhead: false,
    url: "https://luvtrumpsh8.com",
    tagline:
      "Single-constraint community apparel platform built around crowdsourced creative design and automated fulfillment.",
    directionalPotential: "$50K–$300K ARR",
    timeToMilestone: "1–2 Months",
    gtmComplexity: "Low",
    owenAlignment: "Roadmap",
    overview:
      "A community-driven apparel platform united by the creative constraint that every user-submitted graphic incorporates the phrase 'Luv Trumps H8'. Designed to couple a creator revenue-share model with automated print-on-demand fulfillment.",
    differentiation:
      "Tests the commercial viability of a single-constraint creative brand. Cross-spectrum cultural resonance is treated as an active brand hypothesis requiring validation rather than an established commercial certainty.",
    launchInvestment:
      "$2K–$8K (storefront stabilization, print-on-demand automation, initial design curation).",
    nextSteps: [
      "Resolve technical storefront infrastructure and stabilize platform hosting",
      "Integrate automated print-on-demand fulfillment via Printful/Printify",
      "Establish clear designer revenue-share agreements and intellectual property terms",
      "Curate 5–10 foundational designs before broader community submission opening",
      "Launch targeted social creative tests to evaluate organic resonance",
    ],
  },
  {
    id: 18,
    name: "Radiance SIS",
    category: "EdTech / Institutions",
    status: "Active Design",
    statusClass: "s-design",
    statusSymbol: "◇ ACTIVE DESIGN",
    speed: 5,
    beachhead: false,
    url: "https://radiancesis.com",
    tagline:
      "Purpose-designed student information architecture for international theological institutions and seminaries.",
    directionalPotential: "$200K–$2M ARR",
    timeToMilestone: "12–18 Months",
    gtmComplexity: "High",
    owenAlignment: "Proof of Concept",
    overview:
      "A specialized Student Information System architecture conceived for international seminaries and theological networks (such as ICETE-affiliated institutions). Intended to deliver multilingual support, academic cohort tracking, and administrative workflows tailored to non-traditional academic calendars under a signed preliminary development relationship with Horizon Education Network.",
    differentiation:
      "Commercial SIS platforms (Banner, Ellucian) are priced out of reach and architecturally ill-suited for resource-constrained theological schools. Clearly differentiates approved design blueprints and pilot discussions from unbuilt software features.",
    launchInvestment:
      "$50K–$150K (phased core SIS engineering, multi-language architecture, pilot deployment).",
    nextSteps: [
      "Solidify functional pilot specifications with Horizon Education Network leadership",
      "Define minimum viable data schema for course catalogs, transcripts, and student records",
      "Structure phased pricing ($200–$800/mo per institution based on enrollment)",
      "Investigate educational technology grant opportunities through institutional foundations",
      "Plan technical demonstration for international institutional conference presentation",
    ],
  },
  {
    id: 19,
    name: "Sign Language AI Avatar",
    category: "Accessibility Tech",
    status: "Research",
    statusClass: "s-research",
    statusSymbol: "◓ RESEARCH",
    speed: 5,
    beachhead: false,
    url: null,
    tagline:
      "Real-time speech-to-ASL research architecture investigating 4D Gaussian Splatting for photorealistic signing synthesis.",
    directionalPotential: "Research Grant / Licensing Opportunity",
    timeToMilestone: "18–36 Months",
    gtmComplexity: "High",
    owenAlignment: "Architectural Alignment",
    overview:
      "An applied research concept exploring a speech-to-American Sign Language (ASL) pipeline combining speech recognition, linguistic gloss translation, and 4D Gaussian Splatting (4DGS) deformation models for expressive, real-time avatar synthesis. Framed as a collaborative academic R&D initiative.",
    differentiation:
      "Investigates 4DGS as an alternative to rigid polygonal 3D avatars, which historically lack the facial subtlety and spatial articulation essential to authentic sign language. Emphasizes that this research is not a replacement for qualified human interpreters.",
    launchInvestment:
      "$100K–$500K (pursued primarily through federal/state accessibility research grants).",
    nextSteps: [
      "Engage Deaf community organizations and native signers for participatory design and ethical review",
      "Structure grant proposals (NSF, NIH, Department of Education) with academic partners",
      "Develop proof-of-concept deformation tests using open-source 4DGS research implementations",
      "Publish peer-reviewed findings on non-manual marker synthesis and spatial grammar fidelity",
      "Explore downstream assistive technology licensing for educational and municipal accessibility",
    ],
  },
  {
    id: 20,
    name: "ProfAI Studio",
    category: "Higher Education / AI Learning",
    status: "Institutional System",
    statusClass: "s-live",
    statusSymbol: "◈ INSTITUTIONAL",
    speed: 1,
    beachhead: false,
    url: "https://profai.studio",
    tagline:
      "AI-powered learning and knowledge platform recognized with a 2026 CIO 100 Award.",
    directionalPotential: "Institutional Benchmark & Credibility",
    timeToMilestone: "Deployed",
    gtmComplexity: "High",
    owenAlignment: "Integrated",
    overview:
      "An institutional AI learning and knowledge platform developed through Grand Valley State University's IT Innovation and Research initiative. Demonstrates how institutionally governed AI can empower students and faculty to interact with vetted academic content, private course data, and institutional knowledge under rigorous privacy, source verification, and administrative guardrails.",
    differentiation:
      "Honored nationally with the prestigious 2026 CIO 100 Award for AI Innovation. Serves as proven foundational evidence of building reliable, governed enterprise AI systems that respect human authority, privacy standards, and verifiable attribution.",
    launchInvestment:
      "Institutional project developed with GVSU; serves as architectural foundation.",
    nextSteps: [
      "Preserve documented governance learnings to guide enterprise advisory clients",
      "Extract reusable architectural patterns informing SecondSelfStudio.ai",
      "Showcase institutional governance and privacy controls in enterprise executive briefings",
      "Maintain alignment with higher-education research initiatives and innovation showcases",
    ],
  },
  {
    id: 21,
    name: "IllumiU",
    category: "Education / Consumer SaaS",
    status: "Live",
    statusClass: "s-live",
    statusSymbol: "● LIVE / EARLY ACCESS",
    speed: 1,
    beachhead: false,
    ecosystemTags: ["Built on MRL Substrate", "Experience Contributor"],
    url: "https://illumiu.com",
    tagline:
      "A student-first college admissions CRM that brings schools, essays, deadlines, financial aid, and parent updates into one clear application system.",
    directionalPotential: "$1M–$5M ARR",
    timeToMilestone: "Weeks",
    gtmComplexity: "Medium",
    owenAlignment: "Proof of Concept",
    overview:
      "IllumiU is a personal admissions CRM designed for Gen Z students navigating the college application process. It replaces fragmented spreadsheets, sticky notes, browser tabs, and family group chats with a unified system for managing schools, application stages, essays, deadlines, financial-aid opportunities, and progress updates. The experience is intentionally student-centered while still giving families an appropriate way to remain informed.",
    differentiation:
      "IllumiU adapts the structure of a professional CRM to the student’s side of the admissions journey. Its core systems include: a reverse application CRM that visually tracks each school from shortlist through application and decision; automated deadline countdowns and progress visibility; a supplemental essay clustermap that helps students identify reusable story themes across overlapping prompts; a high-ROI aid engine focused on meaningful merit awards and institutional grants; shareable, read-only parent updates that reduce repetitive check-ins without taking ownership away from the student; and a student-friendly interface built around the applicant’s workflow rather than an administrator’s process.",
    launchInvestment:
      "Live product with public positioning, account creation, an interactive demo, application tracking, essay organization, deadline management, aid discovery, and family progress-sharing concepts.",
    nextSteps: [
      "Drive direct student and parent adoption during the active college application cycle",
      "Distribute through independent college admissions consultants and private counselors",
      "Engage high-school counseling departments and educational community partners",
      "Expand supplemental essay clustermap intelligence across newly released university prompt cycles",
    ],
  },
  {
    id: 22,
    name: "Michigan Mudbowl EMS",
    category: "Event Operations / Commerce",
    status: "Live",
    statusClass: "s-live",
    statusSymbol: "● LIVE",
    speed: 1,
    beachhead: true,
    ecosystemTags: ["OWEN Assurance Pilot", "Experience Contributor"],
    url: "https://michiganmudbowl.org",
    tagline:
      "A complete event-management system for teams, athletes, waivers, scoring, fundraising, merchandise, and operational control.",
    directionalPotential: "Reusable Event Platform Blueprint",
    timeToMilestone: "Deployed",
    gtmComplexity: "Low-Medium",
    owenAlignment: "Integrated",
    overview:
      "A mission-critical event management system developed for the historic Michigan Mudbowl charity tournament. Powers the entire operational lifecycle: team registration, athlete onboarding, legal waiver immutability, check-in validation, live scorekeeping, fundraising metrics, and a Printful-powered e-commerce merchandise shop with automated fulfillment safeguards.",
    differentiation:
      "Implements strict operational lifecycle state machines: ROSTER_ELIGIBLE → CHECKED_IN → ROSTER_LOCKED (rosters auto-lock upon kickoff while retaining superadmin override authority). Demonstrated OWEN Assurance proof-of-concept during production security and row-level security (RLS) hardening reviews.",
    launchInvestment:
      "Production system live; reusable architecture ready for tournament & tournament licensing.",
    nextSteps: [
      "Package core operational state machines into a reusable tournament operations blueprint",
      "Abstract athlete waiver, check-in, and server-controlled scoring engines for multi-day events",
      "Present blueprint to regional charity tournaments, collegiate alumni games, and athletic leagues",
      "Integrate real-time spectator scoring displays and automated bracket generation",
      "Document OWEN Assurance security audit case study as an operational governance proof",
    ],
  },
  {
    id: 23,
    name: "RecruitLoop ATS",
    category: "Talent Acquisition / Operations",
    status: "MVP",
    statusClass: "s-mvp",
    statusSymbol: "◐ MVP",
    speed: 2,
    beachhead: false,
    url: "https://recruit-loop.com/",
    tagline:
      "AI-assisted candidate screening and multi-tenant recruiting operations for growing organizations.",
    directionalPotential: "$150K–$1M ARR",
    timeToMilestone: "2–4 Months",
    gtmComplexity: "Medium",
    owenAlignment: "Integrated",
    overview:
      "An AI-assisted applicant tracking and candidate screening system tailored for growing companies and hiring teams. Ingests incoming résumés, parses work histories into structured candidate records, and generates reviewable, evidence-backed scoring rubrics aligned to role criteria.",
    differentiation:
      "Enforces strict human authority guardrails: AI scoring provides synthesis and recommendations, but humans retain all hiring decisions. Protected-class attributes are strictly excluded from scoring models, ensuring auditability and eliminating unmonitored algorithmic bias.",
    launchInvestment:
      "$5K–$15K (multi-tenant dashboard polish, recruiter trial program, bias-audit documentation).",
    nextSteps: [
      "Deploy role-aware recruiter evaluation views with side-by-side evidence references",
      "Conduct independent bias audit on candidate scoring prompts and rubric synthesis",
      "Establish monthly multi-seat subscription pricing ($149–$399/mo per organization)",
      "Trial with 3 growing SMB client teams to gather recruiter workflow metrics",
      "Integrate calendar scheduling and automated interview confirmation workflows",
    ],
  },
  {
    id: 24,
    name: "Continuous AI Governance Newsroom & Board",
    category: "AI Governance / Decision Intelligence",
    status: "Framework",
    statusClass: "s-framework",
    statusSymbol: "⬡ FRAMEWORK",
    speed: 4,
    beachhead: false,
    ecosystemTags: ["Governance Application", "Foundry Signal Source"],
    url: null,
    tagline:
      "A continuous governance system that helps institutions move from periodic policy debates to evidence-based improvement cycles.",
    directionalPotential: "Institutional Advisory & Software Framework",
    timeToMilestone: "6–12 Months",
    gtmComplexity: "Medium-High",
    owenAlignment: "Integrated",
    overview:
      "An institutional governance framework combining an automated research newsroom with a human decision board. Monitors emerging technology developments, tracks peer institutional policies, produces structured intelligence briefings, conducts scoped community micro-polls, and prepares evidence-backed policy amendment proposals.",
    differentiation:
      "Founded on the strict invariant: 'AI provides intelligence; humans provide authority.' Prevents AI systems from silently setting policy or engineering synthetic consensus. Preserves complete audit trails of evidence, minority dissent, and human board votes.",
    launchInvestment:
      "$15K–$40K (briefing pipeline orchestration, voting portal prototype, pilot partner engagement).",
    nextSteps: [
      "Formalize newsroom research ingestion pipelines and policy comparison schemas",
      "Design human decision board review interfaces with immutable voting records",
      "Initiate exploratory discussions for pilot higher-education deployment (e.g. GVSU context)",
      "Model municipal and civic applications using CivAll as an illustrative public-sector use case",
      "Publish a foundational governance white paper establishing procedural principles",
    ],
  },
  {
    id: 25,
    name: "Worker Knowledge Capture",
    category: "Organizational Intelligence / Workforce",
    status: "Concept",
    statusClass: "s-concept",
    statusSymbol: "○ CONCEPT",
    speed: 5,
    beachhead: false,
    ecosystemTags: ["Experience Contributor", "Organizational Knowledge"],
    url: null,
    tagline:
      "A conversational system for preserving how experienced employees actually perform work—not merely what job descriptions say they do.",
    directionalPotential: "Enterprise Knowledge & Advisory Research",
    timeToMilestone: "12–18 Months",
    gtmComplexity: "High",
    owenAlignment: "Architectural Alignment",
    overview:
      "A conversational and multimedia knowledge capture system designed to record, structure, and preserve tacit operational expertise from senior employees. Combines guided reflective interviews, point-of-view work video capture, SOP alignment, and worker commentary to document actual operational practice.",
    differentiation:
      "Conceived as an employee-partnered learning tool rather than surveillance software. Protects worker trust, honors craft wisdom, and highlights the crucial difference between written procedures and real operating problem-solving.",
    launchInvestment:
      "$20K–$60K (interview agent prototype, video synchronization tests, workplace consent framework).",
    nextSteps: [
      "Formulate comprehensive worker consent, privacy, and labor-governance protocols",
      "Prototype guided interview agent focused on tacit troubleshooting techniques",
      "Test point-of-view video capture and timestamped audio alignment mechanics",
      "Map interview outputs to structured task hierarchies and exception playbooks",
      "Validate enterprise business case focused on mitigating operational risk during senior staff retirements",
    ],
  },
  {
    id: 26,
    name: "The Daily Five",
    category: "Education / Consumer AI",
    status: "Live",
    statusClass: "s-live",
    statusSymbol: "● LIVE",
    speed: 1,
    beachhead: false,
    ecosystemTags: ["Built on MRL Substrate"],
    url: "https://daily5.mindriotlabs.com",
    tagline:
      "Gamified Digital SAT preparation that turns five personalized daily questions into a fast cohort competition, supported by targeted drills and tutor-grade strategic feedback.",
    directionalPotential: "$250K–$2M ARR",
    timeToMilestone: "Weeks",
    gtmComplexity: "Medium",
    owenAlignment: "Architectural Alignment",
    overview:
      "The Daily Five is a mobile-first Digital SAT preparation platform built around a deliberately small daily commitment: five questions selected from a student’s weakest skills. Students can complete the daily challenge quickly, compete within an invited cohort, and continue practicing through Solo Arena drills spanning the Digital SAT domains. Each response is supported by strategic feedback explaining why the correct answer works, what trap an incorrect answer represents, and which grammar, reasoning, or Desmos shortcut can help the student solve similar questions more efficiently.",
    differentiation:
      "The product combines adaptive micro-learning with social accountability. Rather than asking students to begin with another full-length course or generic question bank, it creates a repeatable daily habit that can be completed in minutes. Differentiating elements include: exactly five personalized daily questions; question selection informed by weaker skill areas; invite-based cohort competition; points, streaks, speed-based tie breaking, and leaderboards; unlimited targeted practice through Solo Arena; tutor-style explanations that identify both the rule and the test-maker’s trap; and a mobile-first experience designed for short, frequent sessions.",
    launchInvestment:
      "Live, functional product with authentication, invited cohorts, daily challenges, targeted practice, scoring, streaks, leaderboards, and explanatory feedback.",
    nextSteps: [
      "Establish student- and family-led cohort competition wedge during active testing cycles",
      "Partner with private SAT tutors, test-preparation practices, and school counseling programs",
      "Pilot branded cohorts operated in collaboration with educational partners",
      "Refine adaptive skill selection algorithms against cohort performance telemetry",
    ],
  },
];
