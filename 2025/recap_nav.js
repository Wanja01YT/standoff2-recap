/*
  recap_nav.js
  Fallback navigation for an archived (static) Standoff 2 Recap page.

  The live recap uses Swiper (runtime JS) for vertical slide navigation.
  If the JS bundle is missing in an archive, the markup still contains
  slides, but navigation (↑/↓ buttons, keyboard arrows) stops working.

  This script restores:
    - Click/tap navigation via the on-screen ↑/↓ buttons
    - Keyboard ArrowUp/ArrowDown (plus PageUp/PageDown)
    - Optional mouse wheel + touch swipe navigation

  Works offline (file://) and requires no external libraries.
*/

(() => {
  "use strict";

  // Prevent double-installation (which would multiply event handlers)
  // in edge cases (bfcache restores, duplicate script tags, etc.)
  if (window.__recapNavInstalled) return;
  window.__recapNavInstalled = true;

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  function isTypingContext(el) {
    if (!el) return false;
    const tag = (el.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return true;
    if (el.isContentEditable) return true;
    return false;
  }

  function init() {
    const swiperEl = document.querySelector(".recap-swiper.swiper");
    if (!swiperEl) return;

    const wrapper = swiperEl.querySelector(".swiper-wrapper");
    if (!wrapper) return;

    const slides = Array.from(wrapper.querySelectorAll(".swiper-slide"));
    if (!slides.length) return;

    // Find nav buttons (right-side ↑/↓).
    const navWrap = document.querySelector(".GQTlKzDA");
    const navButtons = navWrap ? Array.from(navWrap.querySelectorAll("button")) : [];
    const btnUp = navButtons[0] || null;
    const btnDown = navButtons[1] || null;

    // Determine initial index from existing classes.
    let index = Math.max(0, slides.findIndex((s) => s.classList.contains("swiper-slide-active")));
    if (index === -1) index = 0;

    // Ensure we actually translate the wrapper (archived HTML often has duration 0ms).
    wrapper.style.willChange = "transform";

    // Precompute stable slide offsets (offsetTop is not affected by transforms).
    let offsets = [];
    function recalcOffsets() {
      offsets = slides.map((s) => s.offsetTop);
    }
    recalcOffsets();

    function setSlideClasses(i) {
      slides.forEach((s) => {
        s.classList.remove("swiper-slide-active", "swiper-slide-prev", "swiper-slide-next");
      });
      slides[i].classList.add("swiper-slide-active");
      if (i > 0) slides[i - 1].classList.add("swiper-slide-prev");
      if (i < slides.length - 1) slides[i + 1].classList.add("swiper-slide-next");
    }

    function updateButtons(i) {
      if (btnUp) btnUp.disabled = i <= 0;
      if (btnDown) btnDown.disabled = i >= slides.length - 1;
    }

    // NOTE: We intentionally avoid using getBoundingClientRect() to compute
    // offsets, because transforms would make the math drift/compound over time.

    let isAnimating = false;
    let lastNavAt = 0;

    function slideTo(nextIndex, { animated = true, force = false } = {}) {
      nextIndex = clamp(nextIndex, 0, slides.length - 1);
      if (!force && nextIndex === index) {
        updateButtons(index);
        return;
      }

      // Basic throttle so wheel/touch doesn't spam.
      const now = performance.now();
      if (!force && now - lastNavAt < 220) return;
      lastNavAt = now;

      index = nextIndex;
      setSlideClasses(index);
      updateButtons(index);

      // Keep offsets fresh if layout changes (fonts/images finishing load, etc.)
      if (!offsets.length || offsets.length !== slides.length) recalcOffsets();
      const y = -(offsets[index] || 0);

      // Apply transition
      wrapper.style.transitionProperty = "transform";
      wrapper.style.transitionTimingFunction = "ease";
      wrapper.style.transitionDuration = animated ? "350ms" : "0ms";

      // Trigger translate
      isAnimating = animated;
      wrapper.style.transform = `translate3d(0px, ${y}px, 0px)`;

      if (animated) {
        // Re-enable after transition ends (with a fallback timeout)
        const onEnd = () => {
          isAnimating = false;
          wrapper.removeEventListener("transitionend", onEnd);
        };
        wrapper.addEventListener("transitionend", onEnd, { once: true });
        setTimeout(() => {
          isAnimating = false;
          wrapper.removeEventListener("transitionend", onEnd);
        }, 600);
      } else {
        isAnimating = false;
      }
    }

    // Initial sync (in case the archived file opens mid-slide or layout differs).
    setSlideClasses(index);
    updateButtons(index);
    slideTo(index, { animated: false, force: true });

    // Once all images/fonts are fully loaded, slide heights can change.
    // Recompute offsets and re-align the current slide.
    window.addEventListener(
      "load",
      () => {
        recalcOffsets();
        slideTo(index, { animated: false, force: true });
      },
      { once: true }
    );

    // Button navigation
    if (btnUp) {
      btnUp.addEventListener("click", (e) => {
        e.preventDefault();
        if (isAnimating) return;
        slideTo(index - 1);
      });
    }
    if (btnDown) {
      btnDown.addEventListener("click", (e) => {
        e.preventDefault();
        if (isAnimating) return;
        slideTo(index + 1);
      });
    }

    // Keyboard navigation
    window.addEventListener(
      "keydown",
      (e) => {
        if (e.defaultPrevented) return;
        if (isTypingContext(e.target)) return;

        const key = e.key;
        if (key === "ArrowUp" || key === "PageUp") {
          e.preventDefault();
          if (isAnimating) return;
          slideTo(index - 1);
        } else if (key === "ArrowDown" || key === "PageDown") {
          e.preventDefault();
          if (isAnimating) return;
          slideTo(index + 1);
        }
      },
      { passive: false }
    );

    // Optional mouse wheel navigation (helps on desktop).
    let wheelAccum = 0;
    let wheelResetTimer = null;
    swiperEl.addEventListener(
      "wheel",
      (e) => {
        // Don't hijack when the user is scrolling inside an overflow element.
        if (isTypingContext(e.target)) return;
        e.preventDefault();

        wheelAccum += e.deltaY;
        if (wheelResetTimer) clearTimeout(wheelResetTimer);
        wheelResetTimer = setTimeout(() => {
          wheelAccum = 0;
        }, 120);

        const threshold = 60; // pixels
        if (Math.abs(wheelAccum) >= threshold && !isAnimating) {
          const dir = wheelAccum > 0 ? 1 : -1;
          wheelAccum = 0;
          slideTo(index + dir);
        }
      },
      { passive: false }
    );

    // Optional touch swipe navigation.
    let touchStartY = null;
    swiperEl.addEventListener(
      "touchstart",
      (e) => {
        if (!e.touches || !e.touches.length) return;
        touchStartY = e.touches[0].clientY;
      },
      { passive: true }
    );
    swiperEl.addEventListener(
      "touchend",
      (e) => {
        if (touchStartY === null) return;
        const touch = (e.changedTouches && e.changedTouches[0]) || null;
        if (!touch) {
          touchStartY = null;
          return;
        }
        const dy = touch.clientY - touchStartY;
        touchStartY = null;

        const threshold = 50;
        if (Math.abs(dy) < threshold || isAnimating) return;

        // Swipe up (dy < 0) => next slide (down)
        if (dy < 0) slideTo(index + 1);
        else slideTo(index - 1);
      },
      { passive: true }
    );

    // Keep the current slide aligned on resize/orientation changes.
    let resizeRaf = null;
    window.addEventListener("resize", () => {
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => {
        recalcOffsets();
        slideTo(index, { animated: false, force: true });
      });
    });

    // Expose a tiny debug helper (optional).
    window.__recapNav = {
      slideTo: (i) => slideTo(i, { animated: true, force: true }),
      get index() {
        return index;
      },
      get total() {
        return slides.length;
      },
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
