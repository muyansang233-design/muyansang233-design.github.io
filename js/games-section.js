(() => {
  const mountGamesSlider = (section) => {
    const cards = [...section.querySelectorAll(".standalone-games__card")];
    if (cards.length < 2) return;

    const viewport = document.createElement("div");
    viewport.className = "games-slider__viewport";
    viewport.tabIndex = 0;
    viewport.setAttribute("role", "region");
    viewport.setAttribute("aria-label", "Games showcase");
    viewport.setAttribute("aria-roledescription", "carousel");

    const track = document.createElement("div");
    track.className = "games-slider__track";
    cards.forEach((card) => track.append(card));
    viewport.append(track);

    const deck = document.createElement("div");
    deck.className = "games-slider__deck";
    deck.setAttribute("aria-label", "Other games");
    const previews = cards.map((card, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "games-slider__preview";
      const title = card.querySelector(".standalone-games__name")?.textContent.trim() || `Game ${index + 1}`;
      button.setAttribute("aria-label", `Show ${title}`);
      const image = card.querySelector(".standalone-games__image");
      if (image) {
        const thumbnail = document.createElement("img");
        thumbnail.src = image.getAttribute("src");
        thumbnail.alt = "";
        thumbnail.loading = "lazy";
        button.append(thumbnail);
      }
      const label = document.createElement("span");
      label.textContent = title;
      button.append(label);
      button.addEventListener("click", () => goTo(index));
      deck.append(button);
      return button;
    });

    const controls = document.createElement("div");
    controls.className = "games-slider__controls";
    const previous = document.createElement("button");
    previous.type = "button";
    previous.innerHTML = "&larr;";
    previous.setAttribute("aria-label", "Previous game");
    const count = document.createElement("span");
    count.className = "games-slider__count";
    count.setAttribute("aria-live", "polite");
    const next = document.createElement("button");
    next.type = "button";
    next.innerHTML = "&rarr;";
    next.setAttribute("aria-label", "Next game");
    controls.append(previous, count, next);

    section.querySelector(".standalone-games__title").after(viewport, deck, controls);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let activeIndex = 0;
    let scrollFrame = 0;
    let navigationToken = 0;
    let programmaticScroll = false;

    const updateActive = (index) => {
      activeIndex = index;
      cards.forEach((card, cardIndex) => {
        card.inert = cardIndex !== index;
        card.setAttribute("aria-hidden", String(cardIndex !== index));
      });
      previews.forEach((preview, previewIndex) => {
        preview.hidden = previewIndex === index;
      });
      count.textContent = `${String(index + 1).padStart(2, "0")} / ${String(cards.length).padStart(2, "0")}`;
    };

    const nearestCardIndex = () => {
      const firstOffset = cards[0].offsetLeft;
      return cards.reduce((nearest, card, index) =>
        Math.abs(card.offsetLeft - firstOffset - viewport.scrollLeft) <
        Math.abs(cards[nearest].offsetLeft - firstOffset - viewport.scrollLeft) ? index : nearest, 0);
    };

    const goTo = (index) => {
      const target = (index + cards.length) % cards.length;
      const token = ++navigationToken;
      programmaticScroll = true;
      updateActive(target);
      viewport.scrollTo({
        left: cards[target].offsetLeft - cards[0].offsetLeft,
        behavior: reducedMotion.matches ? "auto" : "smooth"
      });
      window.setTimeout(() => {
        if (token !== navigationToken) return;
        programmaticScroll = false;
        updateActive(nearestCardIndex());
      }, reducedMotion.matches ? 0 : 700);
    };

    previous.addEventListener("click", () => goTo(activeIndex - 1));
    next.addEventListener("click", () => goTo(activeIndex + 1));
    viewport.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        goTo(activeIndex + (event.key === "ArrowRight" ? 1 : -1));
      }
    });
    viewport.addEventListener("scroll", () => {
      if (programmaticScroll || scrollFrame) return;
      scrollFrame = requestAnimationFrame(() => {
        updateActive(nearestCardIndex());
        scrollFrame = 0;
      });
    }, { passive: true });
    updateActive(0);
  };

  const buildGamesSection = () => {
    if (document.getElementById("featured-games")) return true;

    const gameJamsHeading = [...document.querySelectorAll("h1, h2, h3")]
      .find((heading) => heading.textContent.trim().toLowerCase() === "game jams");
    const gameJamsSection = gameJamsHeading?.closest("section");
    if (!gameJamsSection) return false;

    const section = document.createElement("section");
    section.id = "featured-games";
    section.className = "standalone-games";
    section.setAttribute("aria-labelledby", "featured-games-title");
    section.innerHTML = `
      <h2 class="standalone-games__title" id="featured-games-title">Games</h2>
      <article class="standalone-games__card">
        <a class="standalone-games__image-link" href="gnome-more-shrooms.html" aria-label="View Gnome More Shrooms">
          <img class="standalone-games__image" src="https://d3stdg5so273ei.cloudfront.net/muyansang/2026-06-21/493513/1400xAUTO/%25E6%259C%25AA%25E6%25A0%2587%25E9%25A2%2598-1-muyansang-crop.png" alt="Gnome More Shrooms game artwork" loading="lazy">
        </a>
        <div class="standalone-games__content">
          <span class="standalone-games__year">Year: 2026</span>
          <h3 class="standalone-games__name">Gnome More Shrooms</h3>
          <p class="standalone-games__description">A 2D isometric mobile strategy game where farming fuels tower defense. Grow crops, supply towers, expand the garden, and fight through waves of mushroom enemies.</p>
          <p class="standalone-games__role"><strong>My role:</strong> Lead Programmer, Art Lead, and Technical Artist (VFX and shaders).</p>
          <a class="standalone-games__button" href="gnome-more-shrooms.html">View Project</a>
        </div>
      </article>
      <article class="standalone-games__card">
        <a class="standalone-games__image-link" href="toymare.html" aria-label="View Toymare">
          <img class="standalone-games__image" src="media/toymare/toymare.png" alt="Toymare game artwork" loading="lazy">
        </a>
        <div class="standalone-games__content">
          <span class="standalone-games__year">Year: 2025</span>
          <h3 class="standalone-games__name">Toymare</h3>
          <p class="standalone-games__description">Play as Nox the delivery cat, assembling toys from rebellious living parcels to restore order to a chaotic warehouse.</p>
          <div class="standalone-games__facts">
            <p><strong>Gameplay:</strong> Recognize order shapes, combine toy parts, use color bonuses, and erase mistakes under time pressure.</p>
            <p><strong>My role:</strong> Programmer, UI/UX Lead, and Game Designer.</p>
            <p><strong>Engine and tools:</strong> LibGDX (Java), IntelliJ, Git, and Tiled.</p>
          </div>
          <a class="standalone-games__button" href="toymare.html">View Project</a>
        </div>
      </article>
    `;
  gameJamsSection.replaceWith(section);
  const portfolioAnchor = document.getElementById('portfolio')
    || [...document.querySelectorAll('h1, h2, h3')].find((heading) => heading.textContent.trim().toLowerCase() === 'portfolio');
  const portfolioSection = portfolioAnchor?.closest('section') || portfolioAnchor;
  if (portfolioSection && portfolioSection !== section) portfolioSection.before(section);
    mountGamesSlider(section);

    const gameJamsNavLinks = [...document.querySelectorAll("nav a, header a")]
      .filter((link) => link.textContent.trim().toLowerCase() === "game jams");
    gameJamsNavLinks.forEach((gameJamsNav) => {
      const gamesNav = document.createElement("a");
      gamesNav.href = "#featured-games";
      gamesNav.textContent = "Games";
      gamesNav.className = gameJamsNav.className;
      gameJamsNav.replaceWith(gamesNav);
    });

    return true;
  };

  const start = () => {
    if (buildGamesSection()) return;
    const observer = new MutationObserver(() => {
      if (buildGamesSection()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();

// Use the real project cards for a non-wrapping, layered Games slider.
(() => {
  const mountLayeredGames = () => {
    const section = document.querySelector('#featured-games, .standalone-games');
    const oldViewport = section?.querySelector('.games-slider__viewport');
    const track = oldViewport?.querySelector('.games-slider__track');
    const cards = track ? [...track.querySelectorAll(':scope > .standalone-games__card')] : [];
    if (!oldViewport || cards.length < 2) return false;

    const stage = document.createElement('div');
    stage.className = 'games-slider__stage';
    stage.setAttribute('role', 'region');
    stage.setAttribute('aria-roledescription', 'carousel');
    stage.setAttribute('aria-label', 'Games');
    stage.tabIndex = 0;

    const slides = cards.map((card) => {
      const slide = document.createElement('div');
      slide.className = 'games-slider__slide';
      card.before(slide);
      slide.append(card);
      return slide;
    });
    stage.append(track);
    oldViewport.replaceWith(stage);
    section.querySelector('.games-slider__deck')?.remove();

    const controls = document.createElement('div');
    controls.className = 'games-slider__controls';
    const previous = document.createElement('button');
    previous.type = 'button';
    previous.setAttribute('aria-label', 'Previous game');
    previous.textContent = '<';
    const next = document.createElement('button');
    next.type = 'button';
    next.setAttribute('aria-label', 'Next game');
    next.textContent = '>';
    const count = document.createElement('span');
    count.className = 'games-slider__count';
    count.setAttribute('aria-live', 'polite');
    controls.append(previous, count, next);
    section.querySelector('.games-slider__controls')?.remove();
    stage.append(controls);

    let active = Math.max(0, cards.findIndex((card) => card.getAttribute('aria-hidden') !== 'true'));
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let visible = false;
    const syncVideos = () => {
      cards.forEach((card, index) => {
        card.querySelectorAll('video').forEach((video) => {
          video.muted = true;
          video.defaultMuted = true;
          video.loop = true;
          video.playsInline = true;
          video.autoplay = index === active;
          if (index === active && visible && !document.hidden && !reducedMotion.matches) {
            video.play().catch(() => {});
          } else {
            video.pause();
          }
        });
      });
    };
    const setActive = (index) => {
      active = Math.max(0, Math.min(index, slides.length - 1));
      slides.forEach((slide, slideIndex) => {
        const position = slideIndex === active ? 'active'
          : slideIndex === active - 1 ? 'previous'
          : slideIndex === active + 1 ? 'next' : 'hidden';
        slide.dataset.position = position;
        const card = cards[slideIndex];
        card.inert = position === 'hidden';
        card.setAttribute('aria-hidden', position === 'hidden' ? 'true' : 'false');
        card.querySelectorAll('a, button').forEach((element) => {
          if (position === 'active') {
            if (element.dataset.gamesTabindex === '') element.removeAttribute('tabindex');
            else if (element.dataset.gamesTabindex !== undefined) element.setAttribute('tabindex', element.dataset.gamesTabindex);
          } else {
            if (element.dataset.gamesTabindex === undefined) element.dataset.gamesTabindex = element.getAttribute('tabindex') ?? '';
            element.tabIndex = -1;
          }
        });
      });
      previous.disabled = active === 0;
      next.disabled = active === slides.length - 1;
      count.textContent = `${String(active + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;
      syncVideos();
    };

    previous.addEventListener('click', () => setActive(active - 1));
    next.addEventListener('click', () => setActive(active + 1));
    track.addEventListener('click', (event) => {
      const slide = event.target.closest('.games-slider__slide');
      if (!slide) return;
      const index = slides.indexOf(slide);
      if (index !== active && index >= 0) {
        event.preventDefault();
        event.stopPropagation();
        setActive(index);
      }
    }, true);
    stage.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        setActive(active + (event.key === 'ArrowRight' ? 1 : -1));
      }
    });
    let touchX = null;
    stage.addEventListener('touchstart', (event) => { touchX = event.changedTouches[0]?.clientX ?? null; }, { passive: true });
    stage.addEventListener('touchend', (event) => {
      if (touchX === null) return;
      const distance = (event.changedTouches[0]?.clientX ?? touchX) - touchX;
      if (Math.abs(distance) > 55) setActive(active + (distance < 0 ? 1 : -1));
      touchX = null;
    }, { passive: true });
    setActive(active);
    const videoVisibilityObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      syncVideos();
    }, { threshold: 0.25 });
    videoVisibilityObserver.observe(section);
    document.addEventListener('visibilitychange', syncVideos);
    reducedMotion.addEventListener('change', syncVideos);
    return true;
  };

  if (!mountLayeredGames()) {
    const observe = () => {
      const observer = new MutationObserver(() => {
        if (mountLayeredGames()) observer.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    };
    if (document.body) observe();
    else document.addEventListener('DOMContentLoaded', observe, { once: true });
  }
})();
