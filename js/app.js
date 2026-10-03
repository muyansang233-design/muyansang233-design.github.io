const fallbackData = {
  metadata: {
    eyebrow: "Procedural Technical Artist / 3D Environment Artist / Game Developer",
    intro:
      "A portfolio shaped by shipping experience and experimentation, balancing technical rigor with visual direction.",
  },
  identity: {
    name: "Jacky",
    roles: [
      "Technical Artist",
      "Creative Technologist",
      "Game Developer",
      "Procedural Artist",
      "Lead Senior Technical Artist",
    ],
    demoReel: "https://www.w3schools.com/html/mov_bbb.mp4",
  },
  aboutMe: {
    summary:
      "I am Jacky, a Technical Artist focused on shipping visual systems that feel alive while staying production-friendly. I enjoy balancing creative visuals with engineering constraints and helping teams iterate quickly.",
    highlights: [
      {
        label: "Core focus",
        value: "Gameplay visuals, real-time shading, and interactive VFX.",
      },
      {
        label: "Approach",
        value: "Build reusable tools first, then polish with a strong art direction pipeline.",
      },
      {
        label: "Current goal",
        value: "Create performant technical art experiences that scale across teams.",
      },
    ],
  },
  games: [
    {
      name: "Flowline Relay",
      type: "Action Strategy",
      summary:
        "A co-op rhythm-heavy prototype with movement tuning and environmental feedback.",
      role:
        "Implemented level transitions, effect timing, and gameplay feedback systems.",
      tools: ["Unity", "URP", "Timeline", "C#"],
      details: "https://example.com/games/cloudline",
      media: { kind: "video", src: "" },
    },
    {
      name: "Tidebreaker",
      type: "Racing Casual",
      summary:
        "A race prototype with weather-driven control and playful environmental moments.",
      role:
        "Built VFX presets and tuned shader parameters for performance-safe readibility.",
      tools: ["Unreal Engine", "Niagara", "Blueprint"],
      details: "https://example.com/games/tidebreaker",
      media: { kind: "image", src: "" },
    },
  ],
  tech: [
    {
      name: "The PAIGE",
      type: "Rendering / Graphics Study",
      summary:
        "A scene-led rendering study presented through original artwork and comparisons of volumetric light, texture mapping, depth of field, metal BRDF, and medium radiance denoising.",
      role: "Final presentation by Jacky Pan for CS 5630.",
      technicalFeatures: ["Physically Based Rendering", "Path Tracing", "Volumetric Rendering"],
      tools: ["Rendering", "Graphics", "BRDF", "Denoising"],
      details: "./paige.html",
      media: { kind: "image", src: "./assets/paige/final-render.png", alt: "The PAIGE final rendering" },
    },
    {
      name: "Procedural Tree Scene",
      type: "Technical Art / Real-Time Graphics",
      summary:
        "A wind-driven procedural tree study with generated branches, camera-facing foliage, and falling leaves, isolated from the original project's water simulation.",
      role: "Tree system, wind response, foliage rendering, and scene integration.",
      technicalFeatures: ["Procedural Branching", "Wind Field Animation", "Billboard Foliage"],
      tools: ["AniGraph", "TypeScript", "Three.js", "WebGL"],
      details: "./tree-scene.html",
      modulePage: "./tree-scene.html",
      modulePath: "./tree-scene.html",
      isStandaloneModule: true,
      media: { kind: "image", src: "./assets/tree-scene-preview.svg" },
    },
    {
      name: "Aquarium Interactive Module",
      type: "Interaction Module",
      summary:
        "A standalone WebGL water + particle playground with original on-page text explanations, interaction feedback, and visual experimentation kept intact.",
      introSummary:
        "An interactive WebGL module that stays true to the original module’s visual language while being presented inside the portfolio as a dedicated project page.",
      description:
        "This module is embedded as a standalone interactive block where viewers can see natural motion, drag interactions, and fluid feedback while still reading the original on-screen guidance.",
      responsibilities: [
        "Keep the built module output unchanged and avoid introducing regression in interaction behavior.",
        "Build a dedicated project detail layout that matches the existing portfolio visual system.",
        "Map the original module into a stable iframe embed and provide structured project metadata under it.",
      ],
      notes: [
        "The original text explanations are kept in the embedded module iframe.",
        "Project information and supporting metadata remain editable in portfolio-content.json.",
        "All interaction assets are loaded from the existing /aquarium build.",
      ],
      process: [
        "Bundle the original module and place it under /aquarium.",
        "Create a project page route and link card flow to this page.",
        "Render project metadata and detail lists from JSON with graceful fallback.",
      ],
      role:
        "Integrated as a separate module page so all built-in instructions and interactive controls stay unchanged.",
      tools: ["TypeScript", "React", "Three.js", "WebGL"],
      details: "https://example.com/projects/aquarium",
      modulePage: "./aquarium-module.html",
      moduleEmbedPath: "./aquarium/index.html",
      modulePath: "./aquarium-module.html",
      isStandaloneModule: true,
      media: { kind: "image", src: "" },
    },
    {
      name: "Adaptive Waterline Surface",
      type: "Shader / Rendering",
      summary:
        "A stylized water pass with modular wave stages and shore attenuation.",
      role: "Authored modular GLSL-inspired module structure for consistency.",
      tools: ["WebGL", "GLSL", "ECS", "Custom Solver"],
      details: "https://example.com/tech/waterline",
      media: { kind: "image", src: "" },
    },
    {
      name: "Procedural Brush Tools",
      type: "Technical Art Tooling",
      summary:
        "Authoring editor utilities for fast iteration of hand-painted shader presets.",
      role: "Designed low-friction workflow for artist-friendly iteration.",
      tools: ["Blender", "Python", "CLI", "Automation"],
      details: "https://example.com/tech/brush-tools",
      media: { kind: "image", src: "" },
    },
    {
      name: "Shoreline Pipeline",
      type: "Rendering / VFX",
      summary:
        "Reusable material and decal library for natural look and fast project setup.",
      role: "Standardized look-dev conventions and release workflow.",
      tools: ["Substance", "Houdini", "Python"],
      details: "https://example.com/tech/shoreline",
      media: { kind: "image", src: "" },
    },
  ],
  digital: [
    {
      name: "Shallow Margin Study",
      type: "Concept Art",
      summary:
        "Illustration with clean texture passes and controlled natural contrast.",
      role: "Creative direction and final polish.",
      tools: ["Photoshop", "Illustrator"],
      details: "https://example.com/art/study",
      media: { kind: "image", src: "" },
    },
  ],
};

const dom = {
  preloader: document.getElementById("preloader"),
  header: document.getElementById("header"),
  sliderItems: document.getElementById("text-slider-items"),
  sliderTyped: document.getElementById("text-slider"),
  heroName: document.getElementById("hero-name"),
  heroDescription: document.getElementById("hero-description"),
  introVideo: document.getElementById("intro-video"),
  portfolioGrid: document.getElementById("portfolio-grid"),
  filterButtons: document.querySelectorAll(".portfolio-filter"),
  backToTop: document.querySelector(".back-to-top"),
  mobileToggle: document.getElementById("mobile-nav-toggle"),
  mobileNav: document.getElementById("mobile-nav"),
  mobileOverlay: document.getElementById("mobile-body-overly"),
  modal: document.getElementById("portfolio-modal"),
  modalClose: document.getElementById("modal-close"),
  modalTitle: document.getElementById("modal-title"),
  modalType: document.getElementById("modal-type"),
  modalSummary: document.getElementById("modal-summary"),
  modalRole: document.getElementById("modal-role"),
  modalTools: document.getElementById("modal-tools"),
  currentYear: document.getElementById("current-year"),
  aboutIntro: document.getElementById("about-intro"),
  aboutMeSummary: document.getElementById("about-me-summary"),
  aboutMeHighlights: document.getElementById("about-me-highlights"),
  aboutLeft: document.getElementById("about-col-left"),
  aboutRight: document.getElementById("about-col-right"),
  jamTitle: document.getElementById("gamejam-title"),
  jamYear: document.getElementById("gamejam-year"),
  jamAward: document.getElementById("gamejam-award"),
  jamDesc: document.getElementById("gamejam-description"),
  jamDownload: document.getElementById("gamejam-download"),
  jamImage: document.getElementById("gamejam-main-image"),
  jamVideo: document.getElementById("gamejam-main-video"),
  jamNext: document.getElementById("gamejam-next"),
  jamPrev: document.getElementById("gamejam-prev"),
  expTabs: document.getElementById("experience-tabs"),
  expContent: document.getElementById("experience-content"),
};

const state = {
  data: fallbackData,
  portfolioItems: [],
  jamItems: [],
  activeFilter: ".portfolio-featured",
  typedIndex: 0,
  typedInterval: null,
  jamIndex: 0,
};

const categoryHints = {
  "portfolio-featured": "featured",
  "portfolio-personal": "personal",
  "portfolio-professional": "professional",
  "portfolio-tools": "tools",
};

function init() {
  bindNavigation();
  bindPortfolioFilters();
  bindGameJamControls();
  bindModal();
  bindScroll();
  bindMobileMenu();
  bindSmoothScroll();
  dom.currentYear.textContent = new Date().getFullYear();
  loadData();
}

async function loadData() {
  let data = fallbackData;
  try {
    const response = await fetch("./data/portfolio-content.json", { cache: "no-store" });
    if (response.ok) data = await response.json();
  } catch {
    data = fallbackData;
  }

  state.data = data;
  dom.sliderItems.textContent = (data.identity?.roles || fallbackData.identity.roles).join(",");
  dom.heroDescription.textContent = data.metadata?.intro || fallbackData.metadata.intro;
  dom.heroName.innerHTML = `${data.identity?.name || fallbackData.identity.name}<span>Technical Artist</span>`;
  buildIntroMedia(data.identity?.demoReel);
  setupPortfolio(data);
  setupAbout(data);
  setupExperience(data);
  setupGameJams(data);
  runTextSlider(data.identity?.roles || fallbackData.identity.roles);

  if (dom.preloader) {
    dom.preloader.classList.add("hide");
    setTimeout(() => {
      dom.preloader.style.display = "none";
    }, 320);
  }
}

function buildIntroMedia(videoUrl) {
  if (videoUrl) {
    dom.introVideo.src = videoUrl;
    dom.introVideo.load();
  } else {
    dom.introVideo.removeAttribute("src");
    dom.introVideo.style.display = "none";
    dom.introVideo.parentElement.style.background = "#0d101f";
  }
}

function setupPortfolio(data) {
  const sourceMap = [
    { key: "games", label: "portfolio-professional", name: "Games" },
    { key: "tech", label: "portfolio-professional", name: "Tech Art & Graphics" },
    { key: "digital", label: "portfolio-personal", name: "Digital Art" },
  ];

  const raw = [];
  sourceMap.forEach((section) => {
    (data[section.key] || []).forEach((entry, index) => {
      const text = `${entry.summary || ""} ${entry.type || ""}`.toLowerCase();
      let inferred = section.label;
      if (
        /tool|pipeline|procedural|script|vfx|shader|render/.test(text) &&
        /digital/.test(section.name.toLowerCase()) === false
      ) {
        inferred = "portfolio-tools";
      }
      if (section.key === "digital") {
        inferred = "portfolio-personal";
      }
      raw.push({
        ...entry,
        category: section.name,
        classes: ["portfolio-item", "portfolio-featured", inferred],
        index,
      });
    });
  });

  state.portfolioItems = raw;
  renderPortfolio(raw);
  applyPortfolioFilter(".portfolio-featured");
}

function renderPortfolio(items) {
  dom.portfolioGrid.innerHTML = "";
  if (!items.length) {
    dom.portfolioGrid.innerHTML = "<p>No projects to display.</p>";
    return;
  }

  items.forEach((item, i) => {
    const wrap = document.createElement("article");
    wrap.className = item.classes.join(" ");
    wrap.classList.add("grid-item");
    wrap.dataset.idx = `${i}`;

    const link = document.createElement("a");
    link.href = item.modulePage || item.modulePath || item.details || "#";
    link.className = "portfolio-element btn-block";
    link.role = "button";
    link.setAttribute("aria-label", `Open ${item.name}`);

    const media = createPortfolioMedia(item, i);
    const details = document.createElement("div");
    details.className = "details";

    const title = document.createElement("h3");
    title.textContent = item.name;

    const type = document.createElement("p");
    type.textContent = item.type || item.category;

    const bucket = document.createElement("span");
    bucket.style.color = "var(--link)";
    bucket.style.fontSize = "13px";
    bucket.style.fontWeight = "700";
    bucket.textContent = item.category;

    details.append(title, type, bucket);
    link.append(media, details);
    wrap.appendChild(link);

    link.addEventListener("click", (event) => {
      event.preventDefault();
      if (item.isStandaloneModule || item.modulePage) {
        window.location.href = item.modulePage || item.modulePath || "#";
        return;
      }
      openProjectModal(item);
    });

    dom.portfolioGrid.appendChild(wrap);
  });
}

function createPortfolioMedia(project, index) {
  const fallback = document.createElement("div");
  fallback.className = "portfolio-placeholder";
  fallback.textContent = project.name.slice(0, 2).toUpperCase();

  if (!project.media || !project.media.src) {
    return fallback;
  }

  if ((project.media.kind || "").toLowerCase() === "video") {
    const video = document.createElement("video");
    video.src = project.media.src;
    video.className = "portfolio-thumb";
    video.muted = true;
    video.autoplay = false;
    video.playsInline = true;
    video.preload = "none";
    return video;
  }

  const image = document.createElement("img");
  image.src = project.media.src;
  image.className = "portfolio-thumb";
  image.alt = `${project.name} preview`;
  image.loading = "lazy";
  image.onerror = () => {
    image.replaceWith(fallback);
  };

  return image;
}

function applyPortfolioFilter(filterClass) {
  state.activeFilter = filterClass;
  const filter = filterClass.replace(".", "");
  const nodes = Array.from(dom.portfolioGrid.children);

  nodes.forEach((node) => {
    const shouldShow =
      filter === "portfolio-featured" ||
      node.classList.contains(filter);
    node.classList.toggle("is-hidden", !shouldShow);
  });
}

function bindPortfolioFilters() {
  dom.filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      dom.filterButtons.forEach((b) => b.classList.remove("active"));
      button.classList.add("active");
      const filter = button.dataset.filter;
      applyPortfolioFilter(filter);
    });
  });
}

function bindModal() {
  dom.modalClose.addEventListener("click", closeProjectModal);
  dom.modal.addEventListener("click", (event) => {
    if (event.target.matches("[data-modal-close]") || event.target === dom.modal) {
      closeProjectModal();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeProjectModal();
  });
}

function openProjectModal(project) {
  dom.modalTitle.textContent = project.name || "";
  dom.modalType.textContent = project.type || "";
  dom.modalSummary.textContent = project.summary || "";
  dom.modalRole.textContent = project.role || "";
  dom.modalTools.textContent = `Tools: ${(project.tools || []).join(", ") || "N/A"}`;
  dom.modal.classList.add("open");
}

function closeProjectModal() {
  dom.modal.classList.remove("open");
}

function setupGameJams(data) {
  const seed = state.portfolioItems.length ? state.portfolioItems : fallbackData.games;
  const jams = seed.slice(0, 4).map((item, index) => ({
    title: item.name,
    year: 2024 - ((index * 2) % 5),
    award: index === 1 ? "Winner" : "",
    description:
      item.summary ||
      "Built during production crunch with a focus on atmosphere, readability, and short-cycle delivery.",
    src: item.media?.src || "",
    type: item.media?.kind || "image",
    link: item.details || "#",
  }));

  state.jamItems = jams;
  updateJamView(0);
}

function updateJamView(index) {
  if (!state.jamItems.length) return;
  const safeIndex = (index + state.jamItems.length) % state.jamItems.length;
  state.jamIndex = safeIndex;
  const item = state.jamItems[safeIndex];

  dom.jamTitle.textContent = item.title;
  dom.jamYear.textContent = `Year: ${item.year}`;
  dom.jamAward.textContent = item.award || "—";
  dom.jamDesc.textContent = item.description;
  dom.jamDownload.textContent = "View Project";
  dom.jamDownload.href = item.link;
  const hasImage =
    (item.type === "image" || item.type === "") && item.src;
  const hasVideo = item.type === "video" && item.src;

  dom.jamImage.style.display = hasImage ? "block" : "none";
  dom.jamVideo.style.display = hasVideo ? "block" : "none";
  dom.jamImage.removeAttribute("src");

  if (hasImage) {
    dom.jamImage.src = item.src;
    dom.jamImage.alt = item.title;
  } else if (hasVideo) {
    dom.jamVideo.src = item.src;
  } else {
    if (!dom.jamImage.parentElement.querySelector(".placeholder")) {
      const holder = document.createElement("div");
      holder.className = "placeholder";
      holder.style.position = "absolute";
      holder.style.inset = "0";
      holder.style.display = "grid";
      holder.style.alignItems = "center";
      holder.style.justifyContent = "center";
      holder.style.fontSize = "15px";
      holder.style.color = "#6aa5ce";
      holder.textContent = "Media not available";
      dom.jamImage.parentElement.appendChild(holder);
    }
  }
}

function bindGameJamControls() {
  dom.jamNext.addEventListener("click", () => {
    updateJamView(state.jamIndex + 1);
  });
  dom.jamPrev.addEventListener("click", () => {
    updateJamView(state.jamIndex - 1);
  });
}

function setupAbout(data) {
  const intro = data.metadata?.intro || fallbackData.metadata.intro;
  dom.aboutIntro.textContent = intro;
  const aboutMe = data.aboutMe || fallbackData.aboutMe || {};
  dom.aboutMeSummary.textContent = aboutMe.summary || fallbackData.aboutMe.summary;
  dom.aboutMeHighlights.innerHTML = "";
  const highlights = Array.isArray(aboutMe.highlights) && aboutMe.highlights.length
    ? aboutMe.highlights
    : fallbackData.aboutMe.highlights;
  highlights.forEach((entry) => {
    const block = document.createElement("article");
    block.className = "about-highlight";
    block.innerHTML = `<strong>${entry.label}</strong><span>${entry.value}</span>`;
    dom.aboutMeHighlights.appendChild(block);
  });
  const tools = collectTools(data);
  const roleText = (data.identity?.roles || fallbackData.identity.roles).slice(0, 3).join(" · ");

  const leftTitle = document.createElement("h3");
  leftTitle.textContent = "Professional focus";
  const leftP = document.createElement("p");
  leftP.textContent =
    "I focus on technical-art workflows that keep visuals expressive while keeping interaction and rendering stable across teams.";
  const tagWrap = document.createElement("div");
  tagWrap.className = "tools";

  ["Technical Art", "Shader Craft", "VFX", "Tooling", "Pipeline", roleText].forEach((tool) => {
    const t = document.createElement("div");
    t.className = "tool-item";
    t.innerHTML = `<i>▸</i><span>${tool}</span>`;
    tagWrap.appendChild(t);
  });

  const rightTitle = document.createElement("h3");
  rightTitle.textContent = "Main tools";
  const skills = document.createElement("div");
  skills.className = "skills";

  tools.slice(0, 10).forEach((tool) => {
    const t = document.createElement("div");
    t.className = "skill-item";
    t.innerHTML = `<i>✦</i><span>${tool}</span>`;
    skills.appendChild(t);
  });

  dom.aboutLeft.innerHTML = "";
  dom.aboutLeft.append(leftTitle, leftP, tagWrap);

  dom.aboutRight.innerHTML = "";
  dom.aboutRight.append(rightTitle, skills);
}

function setupExperience(data) {
  const entries = [
    {
      role: "Technical Artist",
      company: "Independent / Personal Projects",
      date: "2022 - Present",
      desc:
        "Shipped interactive demos and production-ready VFX/Shader tools with lightweight pipelines for small and medium teams.",
    },
    {
      role: "Graphics Engineer",
      company: "Collaborative Studio",
      date: "2020 - 2022",
      desc:
        "Created custom rendering and procedural solutions for environments, particles, and character showcase scenes.",
    },
  ];

  (data.games || []).slice(0, 2).forEach((project) => {
    entries.push({
      role: project.name,
      company: project.type,
      date: "Recent Build",
      desc: project.summary,
    });
  });

  dom.expTabs.innerHTML = "";
  dom.expContent.innerHTML = "";

  entries.forEach((entry, index) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = `experience-tab${index === 0 ? " active" : ""}`;
    tab.textContent = entry.role;
    tab.dataset.tab = `${index}`;
    tab.setAttribute("role", "tab");

    const panel = document.createElement("article");
    panel.className = `experience-pane${index === 0 ? "" : " is-hidden"}`;
    panel.dataset.panel = `${index}`;
    panel.innerHTML = `
      <div class="experience-item">
        <span class="experience-date">${entry.date}</span>
        <h4>${entry.role} <span>· ${entry.company}</span></h4>
        <p>${entry.desc}</p>
      </div>
    `;

    tab.addEventListener("click", () => {
      dom.expTabs.querySelectorAll(".experience-tab").forEach((btn) =>
        btn.classList.toggle("active", btn === tab)
      );
      dom.expContent.querySelectorAll(".experience-pane").forEach((p) => p.classList.add("is-hidden"));
      panel.classList.remove("is-hidden");
    });

    dom.expTabs.appendChild(tab);
    dom.expContent.appendChild(panel);
  });
}

function collectTools(data) {
  const tools = new Set();
  ["games", "tech", "digital"].forEach((group) => {
    (data[group] || []).forEach((item) => {
      (item.tools || []).forEach((tool) => tools.add(tool));
    });
  });
  return [...tools];
}

function runTextSlider(strings) {
  const typedWords = strings && strings.length ? strings : fallbackData.identity.roles;
  const typeElement = dom.sliderTyped;
  let currentIndex = 0;
  let charIndex = 0;
  let deleting = false;
  let pause = false;

  function tick() {
    const text = typedWords[currentIndex];
    if (pause) {
      pause = false;
      if (deleting) {
        charIndex = text.length;
      } else {
        charIndex = 0;
      }
    }

    if (deleting) {
      charIndex = Math.max(0, charIndex - 1);
      typeElement.textContent = text.slice(0, charIndex);
      if (charIndex <= 0) {
        deleting = false;
        currentIndex = (currentIndex + 1) % typedWords.length;
        pause = true;
      }
      return;
    }

    charIndex += 1;
    charIndex = Math.min(charIndex, text.length);
    typeElement.textContent = text.slice(0, charIndex);
    if (charIndex === text.length) {
      deleting = true;
      pause = true;
    }
  }

  clearInterval(state.typedInterval);
  typeElement.textContent = "";
  state.typedInterval = setInterval(tick, 80);
}

function bindNavigation() {
  const navLinks = document.querySelectorAll(".scrollto");
  navLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      const hash = link.getAttribute("href");
      if (!hash || !hash.startsWith("#")) return;

      const target = document.querySelector(hash);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      if (document.body.classList.contains("mobile-nav-active")) {
        closeMobileNav();
      }
    });
  });
}

function bindSmoothScroll() {
  const hashLinks = document.querySelectorAll("a[href^='#']:not(.scrollto)");
  hashLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      const hash = link.getAttribute("href");
      const target = hash ? document.querySelector(hash) : null;
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function bindScroll() {
  const onScroll = () => {
    const top = window.scrollY || document.documentElement.scrollTop;
    dom.header.classList.toggle("header-scrolled", top > 100);
    dom.backToTop.style.display = top > 100 ? "block" : "none";
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  dom.backToTop.addEventListener("click", (event) => {
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

function bindMobileMenu() {
  dom.mobileToggle.addEventListener("click", () => {
    if (document.body.classList.contains("mobile-nav-active")) {
      closeMobileNav();
    } else {
      document.body.classList.add("mobile-nav-active");
      dom.mobileToggle.textContent = "✕";
    }
  });

  dom.mobileOverlay.addEventListener("click", closeMobileNav);
}

function closeMobileNav() {
  document.body.classList.remove("mobile-nav-active");
  dom.mobileToggle.textContent = "☰";
}

document.querySelectorAll("#mobile-nav a").forEach((link) => {
  link.addEventListener("click", closeMobileNav);
});

init();

// Let the hero video become an unobstructed, replayable Demo Reel.
(() => {
  const mountHeroReel = () => {
    const intro = document.getElementById('intro');
    const hero = intro?.matches('section, header') ? intro : intro?.closest('section, header') || intro;
    const video = hero?.querySelector('video') || document.querySelector('video.hero-video, video.intro-video, video[data-hero]');
    if (!hero || !video || hero.querySelector('.hero-reel-toggle')) return;

    video.classList.add('hero-reel-video');
    if (video.parentElement && video.parentElement !== hero) video.parentElement.classList.add('hero-reel-media');
    hero.querySelectorAll('h1, h2, p, [class*="scroll-cue"], [class*="scroll-hint"], [class*="scroll-indicator"]').forEach((element) => {
      if (!element.closest('nav')) element.classList.add('hero-reel-fadable');
    });
    hero.querySelectorAll('[class*="overlay"], [class*="scrim"], [class*="shade"]').forEach((element) => {
      if (!element.contains(video)) element.classList.add('hero-reel-veil');
    });

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'hero-reel-toggle';
    button.setAttribute('aria-pressed', 'false');
    const icon = document.createElement('span');
    icon.className = 'hero-reel-toggle__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="hero-reel-toggle__play" d="M8 5v14l11-7z"/><path class="hero-reel-toggle__close" d="M6 6l12 12M18 6 6 18"/></svg>';
    const label = document.createElement('span');
    label.className = 'hero-reel-toggle__label';
    label.setAttribute('aria-hidden', 'true');
    label.textContent = 'Demo Reel';
    const backLabel = document.createElement('span');
    backLabel.className = 'hero-reel-toggle__back';
    backLabel.setAttribute('aria-hidden', 'true');
    backLabel.textContent = 'Back to Intro';
    button.append(icon, label, backLabel);
    let reelRngState = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) || 1;
    const reelRng = () => {
      reelRngState ^= reelRngState << 13;
      reelRngState ^= reelRngState >>> 17;
      reelRngState ^= reelRngState << 5;
      return (reelRngState >>> 0) / 4294967296;
    };
    const reelAnimations = new Set();
    const reelLayer = document.createElement('div');
    reelLayer.className = 'hero-reel-motes-layer';
    reelLayer.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 10; i++) {
      const mote = document.createElement('span');
      mote.className = 'hero-reel-toggle__mote';
      mote.setAttribute('aria-hidden', 'true');
      mote.style.animation = 'none';
      reelLayer.append(mote);
    }
    const spawnReelMote = (mote, initial = false) => {
      const edge = Math.floor(reelRng() * 4);
      const position = `${reelRng() * 100}%`;
      const outward = 5 + reelRng() * 10;
      const sideways = (reelRng() - .5) * 16;
      const x = edge === 0 ? '-2px' : edge === 1 ? 'calc(100% + 2px)' : position;
      const y = edge === 2 ? '-2px' : edge === 3 ? 'calc(100% + 2px)' : position;
      const driftX = edge === 0 ? -outward : edge === 1 ? outward : sideways;
      const driftY = edge === 2 ? -outward : edge === 3 ? outward : sideways;
      const life = .6 + reelRng() * .4;
      mote.style.setProperty('--mote-x', x);
      mote.style.setProperty('--mote-y', y);
      mote.style.setProperty('--mote-size', `${11 + reelRng() * 11}px`);
      const animation = mote.animate([
        { opacity: 0, transform: 'translate3d(0, 0, 0) scale(.55)', offset: 0 },
        { opacity: .72, offset: .2 },
        { opacity: .42, offset: .65 },
        { opacity: 0, transform: `translate3d(${driftX}px, ${driftY}px, 0) scale(1.25)`, offset: 1 }
      ], { duration: life * 1000, delay: initial ? reelRng() * 1100 : reelRng() * 180, easing: 'ease-out' });
      reelAnimations.add(animation);
      animation.onfinish = () => {
        reelAnimations.delete(animation);
        if (button.matches(':hover, :focus-visible')) spawnReelMote(mote);
      };
    };
    let reelFrame = 0;
    const followReelButton = () => {
      const rect = button.getBoundingClientRect();
      reelLayer.style.left = `${rect.left}px`;
      reelLayer.style.top = `${rect.top}px`;
      reelLayer.style.width = `${rect.width}px`;
      reelLayer.style.height = `${rect.height}px`;
      reelFrame = reelAnimations.size ? requestAnimationFrame(followReelButton) : 0;
    };
    const startReelMotes = () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !button.matches(':hover, :focus-visible') || reelAnimations.size) return;
      reelLayer.querySelectorAll('.hero-reel-toggle__mote').forEach((mote) => spawnReelMote(mote, true));
      if (!reelFrame) followReelButton();
    };
    const stopReelMotes = () => {
      if (button.matches(':hover, :focus-visible')) return;
      for (const animation of reelAnimations) animation.cancel();
      reelAnimations.clear();
      cancelAnimationFrame(reelFrame);
      reelFrame = 0;
    };
    button.addEventListener('pointerenter', startReelMotes);
    button.addEventListener('pointerleave', stopReelMotes);
    button.addEventListener('focusin', startReelMotes);
    button.addEventListener('focusout', () => queueMicrotask(stopReelMotes));
    hero.append(reelLayer, button);

    const primaryNav = [...document.querySelectorAll('nav')].find((nav) =>
      nav.querySelector('a[href*="portfolio"]') && nav.querySelector('a[href*="contact"]'));
    const navHeader = primaryNav?.closest('header');
    const topBar = navHeader && !navHeader.contains(hero)
      ? navHeader
      : primaryNav?.parentElement && !primaryNav.parentElement.contains(hero)
        ? primaryNav.parentElement
        : primaryNav;
    const topBarWasInert = topBar?.inert ?? false;
    topBar?.classList.add('hero-reel-topbar');
    const ambientLoop = video.loop;

    let moveAnimation = null;
    const setReelMode = (playing) => {
      const start = button.getBoundingClientRect();
      moveAnimation?.cancel();
      hero.classList.toggle('hero-reel-active', playing);
      topBar?.classList.toggle('hero-reel-topbar-hidden', playing);
      if (topBar) topBar.inert = playing || topBarWasInert;
      button.setAttribute('aria-pressed', String(playing));
      button.setAttribute('aria-label', playing ? 'Back to introduction' : 'Play Demo Reel');
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const end = button.getBoundingClientRect();
        moveAnimation = button.animate([
          { transform: `translate(${start.left - end.left}px, ${start.top - end.top}px)` },
          { transform: 'translate(0, 0)' }
        ], { duration: 760, easing: 'cubic-bezier(.22, 1, .36, 1)' });
      }
      if (playing) {
        video.loop = false;
        video.pause();
        try { video.currentTime = 0; } catch (_) { /* Wait for video metadata if needed. */ }
        const playback = video.play();
        if (playback && typeof playback.catch === 'function') {
          playback.catch(() => setReelMode(false));
        }
      } else {
        video.loop = ambientLoop;
      }
    };
    button.addEventListener('click', () => setReelMode(!hero.classList.contains('hero-reel-active')));
    video.addEventListener('ended', () => {
      if (!hero.classList.contains('hero-reel-active')) return;
      setReelMode(false);
      try { video.currentTime = 0; } catch (_) { /* Keep the final frame if seeking is unavailable. */ }
      const ambientPlayback = video.play();
      if (ambientPlayback && typeof ambientPlayback.catch === 'function') ambientPlayback.catch(() => {});
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && hero.classList.contains('hero-reel-active')) setReelMode(false);
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountHeroReel, { once: true });
  else mountHeroReel();
})();

// Keep the homepage Portfolio showcase focused on the three finished graphics projects.
(() => {
  const mountPortfolioSelection = () => {
    const anchor = document.querySelector('#portfolio, .portfolio-section, [data-section="portfolio"]');
    const portfolio = anchor?.closest('section') || anchor;
    if (!portfolio) return false;

    const pruneCards = () => {
      const selectors = ['.project-card', '.portfolio-card', '.portfolio-project', '.work-card', 'article'];
      let cards = [];
      for (const selector of selectors) {
        cards = [...portfolio.querySelectorAll(selector)];
        if (cards.length >= 2) break;
      }
      if (cards.length < 2) return;
      cards.forEach((card) => {
        const title = card.querySelector('.project-card__title, .project-title, h2, h3, h4')?.textContent || '';
        const links = [...card.querySelectorAll('a[href]')].map((link) => link.getAttribute('href')).join(' ');
        if (!/\bpaige\b|\baquarium\b|\btree\b/i.test(`${title} ${links}`)) card.remove();
      });
    };

    new MutationObserver(pruneCards).observe(portfolio, { childList: true, subtree: true });
    pruneCards();
    return true;
  };

  const start = () => {
    if (mountPortfolioSelection()) return;
    const observer = new MutationObserver(() => {
      if (mountPortfolioSelection()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
