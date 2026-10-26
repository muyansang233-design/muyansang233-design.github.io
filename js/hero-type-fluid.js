(() => {
  const hero = document.getElementById("intro");
  const title = document.getElementById("hero-name");
  if (!hero || !title) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (reducedMotion.matches) return;

  const mount = () => {
    const nameNode = [...title.childNodes].find((node) =>
      node.nodeType === Node.TEXT_NODE && node.textContent.trim());
    const roleLine = title.querySelector(":scope > span");
    if (!nameNode || !roleLine) return;

    const name = nameNode.textContent.trim();
    const role = roleLine.textContent.trim();
    const nameLine = document.createElement("span");
    nameLine.className = "hero-type-line hero-type-line--name";
    nameNode.replaceWith(nameLine);
    roleLine.classList.add("hero-type-line", "hero-type-line--role");

    const segmenter = typeof Intl.Segmenter === "function"
      ? new Intl.Segmenter(document.documentElement.lang, { granularity: "grapheme" })
      : null;
    const glyphs = [];
    const splitLine = (line, text, lineNumber) => {
      line.replaceChildren();
      for (const part of text.split(/(\s+)/)) {
        if (!part) continue;
        if (/^\s+$/.test(part)) {
          line.append(document.createTextNode(part));
          continue;
        }
        const word = document.createElement("span");
        word.className = "hero-type-word";
        const characters = segmenter
          ? [...segmenter.segment(part)].map((item) => item.segment)
          : Array.from(part);
        for (const character of characters) {
          const element = document.createElement("span");
          element.className = "hero-type-glyph";
          element.textContent = character;
          word.append(element);
          glyphs.push({ element, line: lineNumber, x: 0, y: 0,
            width: 0, height: 0, dx: 0, dy: 0, vx: 0, vy: 0,
            burstX: 0, burstY: 0, burstVx: 0, burstVy: 0,
            angle: 0, angularVelocity: 0 });
        }
        line.append(word);
      }
    };
    splitLine(nameLine, name, 0);
    splitLine(roleLine, role, 1);

    const pointer = { active: false, id: null, x: 0, y: 0, vx: 0, vy: 0, time: 0 };
    const forceX = new Float32Array(glyphs.length);
    const forceY = new Float32Array(glyphs.length);
    const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
    let frame = 0;
    let lastFrameTime = 0;
    let visible = true;
    let touchId = null;
    let returnAt = 0;
    let returnTimer = 0;

    const measure = () => {
      const bounds = hero.getBoundingClientRect();
      for (const glyph of glyphs) {
        glyph.dx = glyph.dy = glyph.vx = glyph.vy = 0;
        glyph.burstX = glyph.burstY = glyph.burstVx = glyph.burstVy = 0;
        glyph.angle = glyph.angularVelocity = 0;
        glyph.element.style.transform = "";
        const rect = glyph.element.getBoundingClientRect();
        glyph.x = rect.left - bounds.left + rect.width / 2;
        glyph.y = rect.top - bounds.top + rect.height / 2;
        glyph.width = rect.width;
        glyph.height = rect.height;
      }
    };

    const tick = (time) => {
      frame = 0;
      if (!visible || document.hidden || reducedMotion.matches) return;
      const dt = clamp((time - (lastFrameTime || time - 16)) / 1000, 0.008, 0.033);
      lastFrameTime = time;
      const reelPlaying = hero.querySelector('.hero-reel-toggle[aria-pressed="true"]');
      const active = pointer.active && !reelPlaying;
      const returning = time >= returnAt;
      const spring = 40;
      const damping = 9;
      let moving = false;

      glyphs.forEach((glyph, index) => {
        let fx = -spring * glyph.dx - damping * glyph.vx;
        let fy = -spring * glyph.dy - damping * glyph.vy;
        for (const neighborIndex of [index - 1, index + 1]) {
          const neighbor = glyphs[neighborIndex];
          if (!neighbor || neighbor.line !== glyph.line ||
              Math.abs(neighbor.y - glyph.y) > glyph.height * 0.5) continue;
          fx += (neighbor.dx - glyph.dx) * 15;
          fy += (neighbor.dy - glyph.dy) * 15;
        }
        if (active) {
          const dx = glyph.x + glyph.dx - pointer.x;
          const dy = glyph.y + glyph.dy - pointer.y;
          const distance = Math.hypot(dx, dy);
          const radius = clamp(glyph.height * 1.5, 78, 125) + glyph.width * 0.25;
          if (distance < radius) {
            const pressure = (1 - distance / radius) ** 2;
            const directionX = distance > 1 ? dx / distance : (index % 2 ? 1 : -1);
            const directionY = distance > 1 ? dy / distance : -0.35;
            fx += directionX * 2250 * pressure + pointer.vx * 1.6 * pressure;
            fy += directionY * 2250 * pressure + pointer.vy * 1.6 * pressure;
            moving = true;
          }
        }
        forceX[index] = fx;
        forceY[index] = fy;
      });

      glyphs.forEach((glyph, index) => {
        glyph.vx += forceX[index] * dt;
        glyph.vy += forceY[index] * dt;
        glyph.dx += glyph.vx * dt;
        glyph.dy += glyph.vy * dt;
        const burstSpring = returning ? 13 : 0;
        const burstDamping = returning ? 7 : 4;
        glyph.burstVx += (-burstSpring * glyph.burstX - burstDamping * glyph.burstVx) * dt;
        glyph.burstVy += (-burstSpring * glyph.burstY - burstDamping * glyph.burstVy) * dt;
        glyph.burstX += glyph.burstVx * dt;
        glyph.burstY += glyph.burstVy * dt;
        glyph.angularVelocity += (-(returning ? 15 : 0) * glyph.angle -
          burstDamping * glyph.angularVelocity) * dt;
        glyph.angle = clamp(glyph.angle + glyph.angularVelocity * dt, -23, 23);
        const burstLimit = clamp(glyph.height * 0.9, 38, 72);
        const burstDistance = Math.hypot(glyph.burstX, glyph.burstY);
        if (burstDistance > burstLimit) {
          glyph.burstX *= burstLimit / burstDistance;
          glyph.burstY *= burstLimit / burstDistance;
          glyph.burstVx *= Math.min(0.45, 0.93);
          glyph.burstVy *= Math.min(0.45, 0.93);
        }
        const limit = clamp(glyph.height * 0.78, 32, 68);
        const distance = Math.hypot(glyph.dx, glyph.dy);
        if (distance > limit) {
          glyph.dx *= limit / distance;
          glyph.dy *= limit / distance;
          glyph.vx *= 0.5;
          glyph.vy *= 0.5;
        }
      });

      // Keep adjacent glyphs in order while allowing the word to bend around the cursor.
      for (let index = 1; index < glyphs.length; index++) {
        const left = glyphs[index - 1];
        const right = glyphs[index];
        if (left.line !== right.line || Math.abs(left.y - right.y) > left.height * 0.5) continue;
        const restGap = right.x - left.x;
        if (restGap <= 0) continue;
        const currentGap = right.x + right.dx - left.x - left.dx;
        const minimumGap = restGap * 0.58;
        if (currentGap < minimumGap) {
          const correction = (minimumGap - currentGap) * 0.5;
          left.dx -= correction;
          right.dx += correction;
          left.vx = Math.min(left.vx, 0);
          right.vx = Math.max(right.vx, 0);
        }
      }

      for (const glyph of glyphs) {
        if (Math.abs(glyph.dx) + Math.abs(glyph.dy) +
            Math.abs(glyph.vx) * 0.03 + Math.abs(glyph.vy) * 0.03 > 0.06) moving = true;
        if (Math.abs(glyph.burstVx) + Math.abs(glyph.burstVy) +
            Math.abs(glyph.angularVelocity) > 0.2 ||
            returning && Math.abs(glyph.burstX) + Math.abs(glyph.burstY) +
            Math.abs(glyph.angle) > 0.06) moving = true;
        glyph.element.style.transform = `translate3d(${(glyph.dx + glyph.burstX).toFixed(2)}px, ${(glyph.dy + glyph.burstY).toFixed(2)}px, 0) rotate(${glyph.angle.toFixed(2)}deg)`;
      }
      pointer.vx *= Math.exp(-dt * 13);
      pointer.vy *= Math.exp(-dt * 13);
      if (moving) frame = requestAnimationFrame(tick);
    };

    const wake = () => {
      if (!frame && visible && !document.hidden && !reducedMotion.matches) {
        frame = requestAnimationFrame(tick);
      }
    };
    const setPointer = (event) => {
      const bounds = hero.getBoundingClientRect();
      const x = event.clientX - bounds.left;
      const y = event.clientY - bounds.top;
      const time = performance.now();
      if (pointer.active && pointer.id === event.pointerId) {
        const seconds = clamp((time - pointer.time) / 1000, 0.016, 0.08);
        pointer.vx = clamp((x - pointer.x) / seconds, -800, 800);
        pointer.vy = clamp((y - pointer.y) / seconds, -800, 800);
      } else {
        pointer.vx = pointer.vy = 0;
      }
      pointer.x = x;
      pointer.y = y;
      pointer.time = time;
      pointer.id = event.pointerId;
      pointer.active = true;
      wake();
    };

    const scatter = (x, y) => {
    title.classList.add("hero-type-scattering");
    window.clearTimeout(title._heroScatterEaseTimer);
    title._heroScatterEaseTimer = window.setTimeout(() => {
      title.classList.remove("hero-type-scattering");
    }, 3000);
      returnAt = performance.now() + 3000;
      window.clearTimeout(returnTimer);
      returnTimer = window.setTimeout(wake, 3000);
      const radius = clamp(hero.clientWidth * 0.26, 160, 300);
      glyphs.forEach((glyph, index) => {
        const dx = glyph.x + glyph.burstX - x;
        const dy = glyph.y + glyph.burstY - y;
        const distance = Math.hypot(dx, dy);
        const directionX = distance > 1 ? dx / distance : (index % 2 ? 1 : -1);
        const directionY = distance > 1 ? dy / distance : -0.4;
        const falloff = Math.exp(-distance * distance / (2 * radius * radius));
        const influence = 0.18 + 0.82 * falloff;
        const speed = (140 + 130 * falloff) * influence;
        glyph.burstVx += (directionX * speed - directionY * 48 * falloff) * 0.55;
        glyph.burstVy += (directionY * speed + directionX * 48 * falloff) * 0.35;
        glyph.angularVelocity += ((dx * dy >= 0 ? 1 : -1) * (75 + 55 * falloff) * influence) * 0.38;
      });
      wake();
    };

    hero.addEventListener("pointermove", (event) => {
      if (event.pointerType !== "mouse" && event.pointerId !== touchId) return;
      setPointer(event);
    }, { passive: true });
    hero.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "mouse") touchId = event.pointerId;
      setPointer(event);
    }, { passive: true });
    title.addEventListener("pointerdown", (event) => {
      if (!event.target.closest(".hero-type-word") ||
          event.pointerType === "mouse" && event.button !== 0) return;
      event.stopPropagation();
      if (event.pointerType !== "mouse") touchId = event.pointerId;
      setPointer(event);
      scatter(pointer.x, pointer.y);
    });
    title.tabIndex = 0;
    title.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      const center = glyphs[Math.floor(glyphs.length / 2)];
      scatter(center.x, center.y);
    });
    const release = (event) => {
      if (event.pointerType === "mouse" && event.type !== "pointerleave") return;
      if (event.pointerId === touchId) touchId = null;
      pointer.active = false;
      wake();
    };
    hero.addEventListener("pointerup", release);
    hero.addEventListener("pointercancel", release);
    hero.addEventListener("pointerleave", release);

    const reelButton = hero.querySelector(".hero-reel-toggle");
    if (reelButton) new MutationObserver(() => {
      if (reelButton.getAttribute("aria-pressed") === "true") pointer.active = false;
      wake();
    }).observe(reelButton, { attributes: true, attributeFilter: ["aria-pressed"] });
    new ResizeObserver(measure).observe(title);
    document.fonts?.ready.then(measure);
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) measure();
      else {
        pointer.active = false;
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        measure();
      }
    }).observe(hero);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) pointer.active = false;
      else wake();
    });
    reducedMotion.addEventListener?.("change", () => {
      pointer.active = false;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      measure();
    });
    measure();
  };

  Promise.resolve(window.siteI18n?.ready).catch(() => null).then(mount);
})();
