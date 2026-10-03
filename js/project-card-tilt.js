(() => {
  const hoverMedia = window.matchMedia("(hover: hover) and (pointer: fine)");
  const motionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
  const cardSelector = [
    "#featured-games .standalone-games__card",
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

  let activeCard = null;
  let originalInlineTransform = "";
  let baseTransform = "";
  let frame = 0;

  function resetCard() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    if (!activeCard) return;
    activeCard.classList.remove("is-tilting");
    activeCard.style.transform = originalInlineTransform;
    activeCard = null;
  }

  function onPointerMove(event) {
    if (!hoverMedia.matches || motionMedia.matches || event.pointerType !== "mouse") {
      resetCard();
      return;
    }

    const card = event.target instanceof Element ? event.target.closest(cardSelector) : null;
    if (card !== activeCard) {
      resetCard();
      if (!card) return;
      activeCard = card;
      originalInlineTransform = card.style.transform;
      const computedTransform = getComputedStyle(card).transform;
      baseTransform = computedTransform === "none" ? "" : `${computedTransform} `;
      card.classList.add("project-card-tilt", "is-tilting");
    }
    if (!card) return;

    const bounds = card.getBoundingClientRect();
    const horizontal = Math.max(-1, Math.min(1, ((event.clientX - bounds.left) / bounds.width) * 2 - 1));
    const vertical = Math.max(-1, Math.min(1, ((event.clientY - bounds.top) / bounds.height) * 2 - 1));
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      card.style.transform = `${baseTransform}perspective(1200px) rotateX(${(-vertical * 4).toFixed(2)}deg) rotateY(${(horizontal * 5).toFixed(2)}deg)`;
      frame = 0;
    });
  }

  document.addEventListener("pointermove", onPointerMove, { passive: true });
  document.addEventListener("focusin", (event) => {
    const card = event.target instanceof Element ? event.target.closest(cardSelector) : null;
    if (card) card.classList.add("project-card-tilt");
  });
  document.addEventListener("pointerout", (event) => {
    if (activeCard && !activeCard.contains(event.relatedTarget)) resetCard();
  });
  window.addEventListener("blur", resetCard);
  motionMedia.addEventListener("change", resetCard);
})();
