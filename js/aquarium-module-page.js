const moduleFallback = {
  title: "Aquarium Zen",
  subtitle: "Computer Graphics Project",
  summary: "An AI-driven biomimicry simulation that recreates lifelike aquatic behaviors through procedural animation, Bézier curve interpolation, and a particle system.",
  introSummary:
    "This project is an AI-driven biomimicry simulation that recreates lifelike aquatic behaviors through procedural animation, Bézier curve interpolation, and a particle system. By combining AI behavioral modeling, procedural motion, and particle-driven visual effects, the project captures the essence of biomimicry in digital ecosystems, transforming algorithmic design into organic, expressive movement.",
  description:
    "This module is embedded as a full viewport inside the portfolio while keeping the original interaction, explanation blocks, and control flow from the source project intact.",
  role: "Preserved the original aquarium interaction experience and wrapped it as a dedicated portfolio project module inside the current site.",
  responsibilities: [
    "Retain the source interaction behavior and event handling logic.",
    "Embed the existing module as an iframe without replacing its built-in explanatory content.",
    "Rebuild the surrounding page structure to match the existing portfolio style system.",
  ],
  notes: [
    "All original on-page text and interaction context from the original module remains accessible inside the embedded frame.",
    "The page follows the site’s visual system for layout and typography while leaving module behavior untouched.",
  ],
  process: [
    "Keep the original project build output as the iframe source for stable interaction behavior.",
    "Create a project page shell in the main site and bind it to portfolio data.",
    "Render project metadata and technical details below the module and introductory section.",
  ],
  tools: ["TypeScript", "React", "Three.js", "WebGL", "GLSL", "Physics"],
  link: "https://example.com/projects/aquarium",
  source: "",
  moduleEmbedPath: "./aquarium/index.html?embed=1",
  mediaTitle: "Original Module Resources",
  mediaText:
    "Use this block to keep direct access to the interactive content and its original explanatory UI.",
};

function normalizeProjectList(data) {
  const sections = [data?.games, data?.tech, data?.digital];
  const found = [];
  sections.forEach((section) => {
    if (Array.isArray(section)) {
      section.forEach((item) => found.push(item));
    }
  });
  return found;
}

function renderTools(container, tools) {
  if (!container) return;
  container.innerHTML = "";
  (tools || []).forEach((tool) => {
    const span = document.createElement("span");
    span.className = "project-tool";
    span.textContent = tool;
    container.appendChild(span);
  });
}

function normalizeListEntry(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return `${value}`;
  if (typeof value === "object") {
    return value.text || value.content || value.label || value.title || "";
  }
  return `${value}`;
}

function renderList(container, values) {
  if (!container) return;
  container.innerHTML = "";

  if (!Array.isArray(values) || values.length === 0) {
    const empty = document.createElement("li");
    empty.textContent = "—";
    container.appendChild(empty);
    return;
  }

  values.forEach((value) => {
    const text = normalizeListEntry(value);
    if (!text) return;
    const item = document.createElement("li");
    item.textContent = text;
    container.appendChild(item);
  });
}

function setText(el, value, fallback) {
  if (!el) return;
  el.textContent = value || fallback || "";
}

function initMobileNav() {
  const mobileToggle = document.getElementById("mobile-nav-toggle");
  const mobileNav = document.getElementById("mobile-nav");
  const overlay = document.getElementById("mobile-body-overly");

  if (!mobileToggle || !mobileNav || !overlay) return;

  const closeMobileMenu = () => {
    document.body.classList.remove("mobile-nav-active");
    mobileToggle.textContent = "☰";
  };

  mobileToggle.addEventListener("click", () => {
    if (document.body.classList.contains("mobile-nav-active")) {
      closeMobileMenu();
      return;
    }
    document.body.classList.add("mobile-nav-active");
    mobileToggle.textContent = "✕";
  });

  overlay.addEventListener("click", closeMobileMenu);
  mobileNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMobileMenu);
  });
}

function initScrollLinks() {
  document.querySelectorAll(".scrollto").forEach((link) => {
    link.addEventListener("click", (event) => {
      const hash = link.getAttribute("href");
      if (!hash || !hash.startsWith("#")) return;
      const target = document.querySelector(hash);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

async function loadModuleData() {
  const title = document.getElementById("project-title");
  const subtitle = document.getElementById("project-subtitle");
  const types = document.getElementById("project-types");
  const summary = document.getElementById("project-summary");
  const introSummary = document.getElementById("project-intro-summary");
  const aboutMe = document.getElementById("about-me");
  const description = document.getElementById("project-description");
  const role = document.getElementById("project-role");
  const tools = document.getElementById("project-tools");
  const responsibilities = document.getElementById("project-responsibilities");
  const notes = document.getElementById("project-notes");
  const process = document.getElementById("project-process");
  const link = document.getElementById("project-link");
  const source = document.querySelector(".project-source");
  const frame = document.getElementById("project-module-frame");
  const year = document.getElementById("current-year");

  let data = { tech: [] };
  try {
    const response = await fetch("./data/portfolio-content.json", { cache: "no-store" });
    if (response.ok) {
      data = await response.json();
    }
  } catch {
    data = { tech: [] };
  }

  const allProjects = normalizeProjectList(data);
  const project = allProjects.find((item) => item.modulePage === "./aquarium-module.html") ||
    allProjects.find((item) => item.name === moduleFallback.title) ||
    moduleFallback;

  setText(title, project.name || moduleFallback.title);
  setText(subtitle, project.type || moduleFallback.subtitle);
  setText(summary, project.summary || moduleFallback.summary);
  setText(introSummary, project.introSummary || moduleFallback.introSummary);
  const aboutText = data?.identity?.intro
    ? `${data.identity.name || "Jacky"} · ${data.identity.roles?.join(" / ") || "Technical Artist"} — ${data.identity.intro}`
    : "I combine technical art, graphics engineering, and interaction systems to create playable visual systems that are production-focused and playful.";
  setText(aboutMe, aboutText);
  setText(description, project.description || project.summary || moduleFallback.description);
  setText(role, project.role || moduleFallback.role);

  if (types) {
    types.innerHTML = "";
    const category = document.createElement("span");
    category.className = "project-type";
    category.textContent = project.type || moduleFallback.subtitle;
    types.appendChild(category);

    const sourceType = document.createElement("span");
    sourceType.className = "project-type";
    sourceType.textContent = project.mediaTitle || "Module Embed";
    types.appendChild(sourceType);
  }

  renderTools(tools, project.tools || moduleFallback.tools);
  renderList(responsibilities, project.responsibilities || moduleFallback.responsibilities);
  renderList(notes, project.notes || moduleFallback.notes);
  renderList(process, project.process || moduleFallback.process);

  if (link) {
    link.href = project.details || moduleFallback.link;
    link.textContent = project.details ? "Project Reference" : "Project Reference (No link set)";
    if (project.details) {
      link.target = "_blank";
      link.rel = "noreferrer";
      link.classList.remove("disabled");
    } else {
      link.removeAttribute("target");
      link.removeAttribute("rel");
      link.classList.add("disabled");
    }
  }

  if (source) {
    if (project.source) {
      source.href = project.source;
      source.textContent = "Source Repository";
      source.classList.remove("is-hidden");
    } else {
      source.remove();
    }
  }

  if (frame && project.moduleEmbedPath) {
    const embedSrc = project.moduleEmbedPath.includes("embed=1")
      ? project.moduleEmbedPath
      : `${project.moduleEmbedPath}${project.moduleEmbedPath.includes("?") ? "&" : "?"}embed=1`;
    frame.src = embedSrc;
    frame.setAttribute("title", project.name || moduleFallback.title);
  }

  if (year) {
    year.textContent = new Date().getFullYear();
  }

  document.title = `${project.name || moduleFallback.title} | Jacky Portfolio`;
}

initMobileNav();
initScrollLinks();
loadModuleData();
