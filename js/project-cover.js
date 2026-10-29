(() => {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const header = document.querySelector('.media-topbar');
  if (header) {
    const syncHeader = () => header.classList.toggle('header-scrolled', window.scrollY > 100);
    window.addEventListener('scroll', syncHeader, { passive: true });
    syncHeader();
  }
  const nav = header?.querySelector('nav');
  if (nav && header.id !== 'header') {
    const sections = [...nav.querySelectorAll('a[href^="#"]')]
      .map(link => ({ link, section: document.getElementById(link.hash.slice(1)) }))
      .filter(item => item.section);
    const syncSection = () => {
      const boundary = header.getBoundingClientRect().height + 26;
      let current;
      for (const item of sections) {
        if (item.section.getBoundingClientRect().top <= boundary) current = item;
      }
      if (window.scrollY > 0 && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) {
        current = sections.at(-1);
      }
      for (const item of sections) {
        if (item === current) item.link.setAttribute('aria-current', 'location');
        else item.link.removeAttribute('aria-current');
      }
    };
    window.addEventListener('scroll', syncSection, { passive: true });
    window.addEventListener('resize', syncSection);
    window.addEventListener('load', syncSection, { once: true });
    syncSection();
    const mobile = matchMedia('(max-width: 991px)');
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'project-nav-toggle';
    toggle.textContent = '☰';
    nav.id ||= 'project-navigation';
    toggle.setAttribute('aria-controls', nav.id);
    const overlay = document.createElement('button');
    overlay.type = 'button';
    overlay.className = 'project-nav-overlay';
    overlay.tabIndex = -1;
    const setOpen = (open, returnFocus = false) => {
      open = mobile.matches && open;
      const chinese = document.documentElement.lang.startsWith('zh');
      const closeLabel = chinese ? '关闭导航' : 'Close navigation';
      header.classList.toggle('project-nav-open', open);
      nav.inert = mobile.matches && !open;
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? closeLabel : chinese ? '打开导航' : 'Open navigation');
      overlay.setAttribute('aria-label', closeLabel);
      toggle.textContent = open ? '×' : '☰';
      if (open) nav.querySelector('a')?.focus();
      else if (returnFocus) toggle.focus();
    };
    toggle.addEventListener('click', () => setOpen(!header.classList.contains('project-nav-open')));
    overlay.addEventListener('click', () => setOpen(false, true));
    nav.addEventListener('click', (event) => {
      if (event.target.closest('a')) setOpen(false);
    });
    header.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || !header.classList.contains('project-nav-open')) return;
      if (nav.querySelector('.site-language__toggle[aria-expanded="true"]')) return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false, true);
    }, true);
    document.addEventListener('focusin', (event) => {
      if (!header.contains(event.target)) setOpen(false);
    });
    mobile.addEventListener('change', () => setOpen(false));
    header.append(overlay, toggle);
    setOpen(false);
  }
  for (const cover of document.querySelectorAll('.project-cover')) {
    const video = cover.querySelector('video');
    if (!video) continue;
    let userPaused = reducedMotion.matches;
    let visible = false;
    video.muted = true;
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'project-cover__toggle';
    const update = () => {
      toggle.textContent = video.paused ? '▶' : 'Ⅱ';
      toggle.setAttribute('aria-label', video.paused ? 'Play cover video' : 'Pause cover video');
    };
    const sync = () => {
      if (userPaused || !visible || document.hidden) video.pause();
      else video.play().catch(update);
      update();
    };
    toggle.addEventListener('click', () => { userPaused = !video.paused; sync(); });
    video.addEventListener('play', update);
    video.addEventListener('pause', update);
    cover.append(toggle);
    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }).observe(cover);
    document.addEventListener('visibilitychange', sync);
    reducedMotion.addEventListener('change', () => { userPaused = reducedMotion.matches; sync(); });
    update();
  }
})();
