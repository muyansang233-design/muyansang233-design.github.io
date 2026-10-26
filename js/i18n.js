(() => {
  const storageKey = "jacky-portfolio-language";
  const supported = ["en", "zh-CN"];
  let saved;
  try { saved = localStorage.getItem(storageKey); } catch { saved = null; }
  const locale = supported.includes(saved) ? saved : "en";
  document.documentElement.lang = locale;

  let bundle = null;
  const ready = fetch("./data/site-content.json", { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error("Language content is unavailable");
      return response.json();
    })
    .then((data) => {
      bundle = data;
      apply(document);
      return data;
    });

  const dictionary = () => bundle?.locales?.[locale]?.strings || {};
  const normalize = (value) => value.replace(/\s+/g, " ").trim();

  function translate(value) {
    const key = normalize(value);
    if (!key || locale === "en" && !bundle) return value;
    const exact = dictionary()[key];
    if (exact !== undefined) return exact;
    const dynamic = key.match(/^(Year|Tools):\s*(.+)$/);
    if (dynamic) return `${dictionary()[`${dynamic[1]}:`] || `${dynamic[1]}:`} ${dynamic[2]}`;
    const open = key.match(/^Open (.+)$/);
    if (open) return `${dictionary().Open || "Open"} ${open[1]}`;
    return value;
  }

  function translateText(node) {
    const parent = node.parentElement;
    if (!parent || parent.closest("script, style, pre, code, svg, .site-language")) return;
    const raw = node.nodeValue;
    const key = normalize(raw);
    if (!key) return;
    const replacement = translate(key);
    if (replacement === key) return;
    const leading = raw.match(/^\s*/)[0];
    const trailing = raw.match(/\s*$/)[0];
    node.nodeValue = `${leading}${replacement}${trailing}`;
  }

  function apply(root) {
    if (!bundle || !root) return;
    if (root.nodeType === Node.TEXT_NODE) {
      translateText(root);
      return;
    }
    if (root.nodeType !== Node.DOCUMENT_NODE && root.nodeType !== Node.ELEMENT_NODE) return;
    const elements = root.nodeType === Node.DOCUMENT_NODE
      ? [root.documentElement, ...root.querySelectorAll("*")]
      : [root, ...root.querySelectorAll("*")];
    for (const element of elements) {
      if (element.closest?.(".site-language")) continue;
      for (const name of ["aria-label", "alt", "title", "placeholder", "content"]) {
        if (!element.hasAttribute?.(name)) continue;
        const before = element.getAttribute(name);
        const after = translate(before);
        if (after !== before) element.setAttribute(name, after);
      }
      for (const child of element.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) translateText(child);
      }
    }
    const title = root.ownerDocument?.title || (root.nodeType === Node.DOCUMENT_NODE ? root.title : "");
    if (title && root.nodeType === Node.DOCUMENT_NODE) root.title = translate(title);
  }

  function makePicker() {
    const wrapper = document.createElement("div");
    wrapper.className = "site-language";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "site-language__toggle";
    button.setAttribute("aria-label", locale === "zh-CN" ? "选择语言" : "Choose language");
    button.setAttribute("aria-haspopup", "menu");
    button.setAttribute("aria-expanded", "false");
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-2.6 2.5-4 5.5-4 9s1.4 6.5 4 9M12 3c2.6 2.5 4 5.5 4 9s-1.4 6.5-4 9"/></svg><span class="site-language__code">' + (locale === "zh-CN" ? "中" : "EN") + '</span>';
    const menu = document.createElement("div");
    menu.className = "site-language__menu";
    menu.setAttribute("role", "menu");
    menu.hidden = true;
    const options = supported.map((code) => {
      const option = document.createElement("button");
      option.type = "button";
      option.className = "site-language__option";
      option.setAttribute("role", "menuitemradio");
      option.setAttribute("aria-checked", String(code === locale));
      option.textContent = code === "en" ? "English" : "简体中文";
      option.addEventListener("click", () => {
        try { localStorage.setItem(storageKey, code); } catch { /* Browsing without storage still works for this page. */ }
        if (code !== locale) window.location.reload();
        else close();
      });
      menu.append(option);
      return option;
    });
    wrapper.append(button, menu);
    const close = () => {
      menu.hidden = true;
      button.setAttribute("aria-expanded", "false");
    };
    const open = () => {
      menu.hidden = false;
      button.setAttribute("aria-expanded", "true");
      options[supported.indexOf(locale)].focus();
    };
    button.addEventListener("click", () => menu.hidden ? open() : close());
    wrapper.addEventListener("keydown", (event) => {
      if (event.key === "Escape") { close(); button.focus(); }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (menu.hidden) return open();
        const delta = event.key === "ArrowDown" ? 1 : -1;
        const current = options.indexOf(document.activeElement);
        options[(current + delta + options.length) % options.length].focus();
      }
    });
    document.addEventListener("pointerdown", (event) => {
      if (!wrapper.contains(event.target)) close();
    });
    return wrapper;
  }

  function mountPickers() {
    const desktop = document.querySelector("#nav-menu-container .nav-menu");
    if (desktop) {
      const item = document.createElement("li");
      item.className = "site-language-item";
      item.append(makePicker());
      desktop.append(item);
      const mobile = document.querySelector("#mobile-nav .mobile-nav-list");
      if (mobile) {
        const mobileItem = document.createElement("li");
        mobileItem.className = "site-language-item";
        mobileItem.append(makePicker());
        mobile.append(mobileItem);
      }
    } else {
      const nav = document.querySelector(".paige-header nav, .gnome-header nav, .tm-topbar nav");
      if (nav) nav.append(makePicker());
    }
  }

  function observe(root) {
    const observer = new MutationObserver((changes) => {
      for (const change of changes) {
        if (change.type === "characterData") apply(change.target);
        for (const node of change.addedNodes || []) apply(node);
      }
    });
    observer.observe(root, { childList: true, characterData: true, subtree: true });
  }

  function mountFrameTranslation() {
    const frame = document.getElementById("project-module-frame");
    if (!frame) return;
    frame.addEventListener("load", () => {
      try {
        const frameDocument = frame.contentDocument;
        if (!frameDocument?.body) return;
        frameDocument.documentElement.lang = locale;
        apply(frameDocument);
        observe(frameDocument.body);
      } catch { /* Cross-origin frames keep their own language. */ }
    });
  }

  window.siteI18n = {
    locale,
    ready,
    portfolio() {
      const content = bundle?.locales?.[locale]?.content;
      if (!content) throw new Error("Portfolio content is unavailable");
      return content;
    },
    t: translate,
  };

  const start = () => {
    mountPickers();
    mountFrameTranslation();
    apply(document);
    observe(document.body);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
  ready.catch(() => {});
})();
