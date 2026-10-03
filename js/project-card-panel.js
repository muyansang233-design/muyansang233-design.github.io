(() => {
  const cardSelector = [
    "#portfolio .project-card",
    "#portfolio .project-showcase-card",
    "#portfolio .portfolio-card",
    "#portfolio .portfolio-item",
    "#portfolio .portfolio-wrap",
    "#portfolio .project-slide",
    "#portfolio .project-tile",
    "#portfolio .showcase-card",
    "#portfolio [data-project-card]",
    "#portfolio article"
  ].join(", ");
  const known = {
    "flowline relay": {
      subtitle: "Action Strategy",
      description: "A co-op rhythm-heavy prototype focused on movement tuning and environmental feedback.",
      features: ["Movement Tuning", "Rhythm Systems", "Environmental Feedback"]
    },
    "gnome more shrooms": {
      subtitle: "2D Isometric Strategy",
      description: "Farm crops to supply your defenses, expand the garden, and fight back waves of mushroom enemies.",
      features: ["CUGL Gameplay", "2D Animation", "VFX & Shaders"]
    },
    "the paige": {
      features: ["Physically Based Rendering", "Path Tracing", "Volumetric Rendering"]
    }
  };
  let projectData = null;

  function findProject(value, title, depth = 0) {
    if (!value || typeof value !== "object" || depth > 8) return null;
    if (Array.isArray(value)) {
      for (const item of value) {
        const match = findProject(item, title, depth + 1);
        if (match) return match;
      }
      return null;
    }
    const name = value.title || value.name || value.projectName;
    if (typeof name === "string" && name.trim().toLowerCase() === title) return value;
    for (const child of Object.values(value)) {
      const match = findProject(child, title, depth + 1);
      if (match) return match;
    }
    return null;
  }

  function featureNames(value) {
    const items = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,|]/) : [];
    return items.map((item) => typeof item === "string" ? item.trim() : item?.label || item?.title || item?.name || "")
      .filter(Boolean).slice(0, 3);
  }

  function makeElement(tag, className, content = "") {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = content;
    return element;
  }

  function updatePanel(card) {
    const title = card.dataset.morphTitle;
    const record = findProject(projectData, title.toLowerCase());
    const fallback = known[title.toLowerCase()] || {};
    const subtitle = record?.subtitle || record?.type || fallback.subtitle || card.dataset.morphSubtitle || "Project";
    const description = record?.summary || record?.shortDescription || record?.description || fallback.description || card.dataset.morphDescription || "Explore the project details and technical process.";
    const features = featureNames(record?.technicalFeatures || record?.features || record?.tools || record?.tags);
    const threeFeatures = [...features, ...(fallback.features || [])].filter((item, index, all) => all.indexOf(item) === index).slice(0, 3);
    while (threeFeatures.length < 3) threeFeatures.push(`Technical Feature 0${threeFeatures.length + 1}`);

    card.querySelector(".project-card-morph__subtitle").textContent = subtitle;
    card.querySelector(".project-card-morph__description").textContent = description;
    card.querySelector(".project-card-morph__features").replaceChildren(
      ...threeFeatures.map((feature) => makeElement("div", "project-card-morph__feature", feature))
    );
    card.querySelector(".project-card-morph__preview-features").replaceChildren(
      ...threeFeatures.map((feature) => makeElement("div", "project-card-morph__preview-feature", feature))
    );

    const detail = card.querySelector(".project-card-morph__detail");
    const route = record?.modulePage || record?.modulePath || record?.detailPage;
    if (route && detail.tagName === "A") detail.href = route;
  }

  function decorate(card) {
    if (card.dataset.morphReady) return;
    const heading = card.querySelector("h2, h3, h4");
    if (!heading) return;

    const title = heading.textContent.trim();
    if (!title) return;
    const paragraphs = [...card.querySelectorAll("p")].map((item) => item.textContent.trim()).filter(Boolean);
    const fallback = known[title.toLowerCase()] || {};
    const subtitle = paragraphs.find((item) => item.length < 80) || fallback.subtitle || "Project";
    const description = paragraphs.find((item) => item.length >= 80) || "";
    const category = card.querySelector(".portfolio-category, .project-category, .portfolio-cat, .project-type")?.textContent.trim() || "PROJECT";
    const image = card.querySelector("img");
    const cover = image?.currentSrc || image?.src || image?.getAttribute("data-src");
    const originalAction = card.matches("a[href]") ? card : card.querySelector("a[href], button");
    const href = originalAction?.getAttribute("href");

    card.dataset.morphReady = "true";
    card.dataset.morphTitle = title;
    card.dataset.morphSubtitle = subtitle;
    card.dataset.morphDescription = description;
    card.classList.add("project-card-morph");
    if (!card.matches("a, button") && !card.hasAttribute("tabindex")) card.tabIndex = 0;
    if (cover) card.style.setProperty("--project-card-cover", `url("${cover.replace(/"/g, "\\\"")}")`);

    const info = heading.closest(".portfolio-info, .project-info, .card-info, .portfolio-caption, .project-caption") || heading.parentElement;
    if (info && info !== card && !info.querySelector("img, video, iframe")) {
      info.classList.add("project-card-morph__original-info");
    }

    const panel = makeElement("div", "project-card-morph__panel");
    const header = makeElement("div", "project-card-morph__header");
    const previewFeatures = makeElement("div", "project-card-morph__preview-features");
    previewFeatures.setAttribute("aria-label", "Technical features");
    header.append(
      makeElement("h3", "project-card-morph__title", title),
      previewFeatures,
      makeElement("p", "project-card-morph__subtitle", subtitle),
      makeElement("p", "project-card-morph__category", category)
    );
    const expanded = makeElement("div", "project-card-morph__expanded");
    const summary = makeElement("p", "project-card-morph__description");
    const features = makeElement("div", "project-card-morph__features");
    features.setAttribute("aria-label", "Technical features");
    const detailSlot = makeElement("div", "project-card-morph__detail-slot");
    let detail;
    if (card.matches("a[href]") || card.closest("a[href]")) {
      detail = makeElement("span", "project-card-morph__detail", "Detail");
    } else if (href && href !== "#") {
      detail = makeElement("a", "project-card-morph__detail", "Detail");
      detail.href = href;
    } else if (originalAction) {
      detail = makeElement("button", "project-card-morph__detail", "Detail");
      detail.type = "button";
      detail.addEventListener("click", (event) => {
        event.stopPropagation();
        originalAction.click();
      });
    } else {
      detail = makeElement("span", "project-card-morph__detail", "Detail");
    }
    detailSlot.append(detail);
    expanded.append(summary, features, detailSlot);
    panel.append(header, expanded);
    const motes = makeElement("div", "project-card-morph__motes");
    motes.setAttribute("aria-hidden", "true");
    let rngState = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) || 1;
    const rng = () => {
      rngState ^= rngState << 13;
      rngState ^= rngState >>> 17;
      rngState ^= rngState << 5;
      return (rngState >>> 0) / 4294967296;
    };
    const moteAnimations = new Set();
    for (let i = 0; i < 20; i++) {
      const mote = makeElement("span", "project-card-morph__mote");
      mote.style.animation = "none";
      motes.append(mote);
    }
    const spawnMote = (mote, initial = false) => {
      const edge = Math.floor(rng() * 4);
      const position = `${rng() * 100}%`;
      const outward = 5 + rng() * 10;
      const sideways = (rng() - .5) * 16;
      const x = edge === 0 ? "-2px" : edge === 1 ? "calc(100% + 2px)" : position;
      const y = edge === 2 ? "-2px" : edge === 3 ? "calc(100% + 2px)" : position;
      const driftX = edge === 0 ? -outward : edge === 1 ? outward : sideways;
      const driftY = edge === 2 ? -outward : edge === 3 ? outward : sideways;
      const life = .6 + rng() * .4;
      mote.style.setProperty("--mote-x", x);
      mote.style.setProperty("--mote-y", y);
      mote.style.setProperty("--mote-size", `${11 + rng() * 11}px`);
      const animation = mote.animate([
        { opacity: 0, transform: "translate3d(0, 0, 0) scale(.55)", offset: 0 },
        { opacity: .72, offset: .2 },
        { opacity: .42, offset: .65 },
        { opacity: 0, transform: `translate3d(${driftX}px, ${driftY}px, 0) scale(1.25)`, offset: 1 }
      ], { duration: life * 1000, delay: initial ? rng() * 1100 : rng() * 180, easing: "ease-out" });
      moteAnimations.add(animation);
      animation.onfinish = () => {
        moteAnimations.delete(animation);
        if (motes.classList.contains("is-active")) spawnMote(mote);
      };
    };
    let moteFrame = 0;
    const followCard = () => {
      const rect = card.getBoundingClientRect();
      motes.style.left = `${rect.left}px`;
      motes.style.top = `${rect.top}px`;
      motes.style.width = `${rect.width}px`;
      motes.style.height = `${rect.height}px`;
      moteFrame = motes.classList.contains("is-active") ? requestAnimationFrame(followCard) : 0;
    };
    const showMotes = () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      if (!motes.isConnected) document.body.append(motes);
      if (motes.classList.contains("is-active")) return;
      motes.classList.add("is-active");
      for (const mote of motes.children) spawnMote(mote, true);
      if (!moteFrame) moteFrame = requestAnimationFrame(followCard);
    };
    const hideMotes = () => {
      if (card.matches(":hover") || card.contains(document.activeElement)) return;
      motes.classList.remove("is-active");
      for (const animation of moteAnimations) animation.cancel();
      moteAnimations.clear();
      cancelAnimationFrame(moteFrame);
      moteFrame = 0;
      setTimeout(() => { if (!motes.classList.contains("is-active")) motes.remove(); }, 450);
    };
    card.addEventListener("pointerenter", showMotes);
    card.addEventListener("pointerleave", hideMotes);
    card.addEventListener("focusin", showMotes);
    card.addEventListener("focusout", () => queueMicrotask(hideMotes));
    card.append(panel);
    updatePanel(card);
  }

  function decorateAll() {
    const candidates = [...document.querySelectorAll(cardSelector)];
    for (const card of candidates) {
      const nestedCard = [...card.querySelectorAll(cardSelector)].some((nested) => nested.querySelector("h2, h3, h4"));
      if (!nestedCard) decorate(card);
    }
  }

  function start() {
    decorateAll();
    new MutationObserver(decorateAll).observe(document.body, { childList: true, subtree: true });
    fetch("data/portfolio-content.json")
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        projectData = data;
        document.querySelectorAll(".project-card-morph").forEach(updatePanel);
      })
      .catch(() => {});
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
