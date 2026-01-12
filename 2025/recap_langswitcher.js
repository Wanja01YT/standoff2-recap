/* recap_langswitcher.js
   Centered drop-up language switcher for the archived Recap page.
   - Works offline (file://) and on GitHub Pages.
   - Applies language LIVE via window.recapSetLang when available.
   - Updates ?hl=... with history.replaceState (handled by recap_i18n.js).
   - Opens drop-up at the BOTTOM of the list.
   - Clamps dropdown so it never goes above TOP_PAD px from top of viewport.
*/
(() => {
  if (window.__RECAP_LANG_SWITCHER__) return;
  window.__RECAP_LANG_SWITCHER__ = true;

  const PARAM = "hl";

  // Dropdown viewport clamp
  const TOP_PAD = 10; // stop 10px before top of visible screen
  const GAP = 8;      // gap between button and dropdown (matches CSS bottom: calc(100% + 8px))

  // Supported languages (must match available packs; EN is the base default).
  const LANGS = [
    { hl: "ro",    code: "RO", flag: "🇷🇴", name: "Română" },
    { hl: "id",    code: "ID", flag: "🇮🇩", name: "Bahasa Indonesia" },
    { hl: "uk",    code: "UK", flag: "🇺🇦", name: "Українська" },
    { hl: "ja",    code: "JA", flag: "🇯🇵", name: "日本語" },
    { hl: "pl",    code: "PL", flag: "🇵🇱", name: "Polski" },
    { hl: "it",    code: "IT", flag: "🇮🇹", name: "Italiano" },
    { hl: "ko",    code: "KO", flag: "🇰🇷", name: "한국어" },
    { hl: "zh-tw", code: "TW", flag: "🇹🇼", name: "中文（繁體）" },
    { hl: "zh-cn", code: "CN", flag: "🇨🇳", name: "中文（简体）" },
    { hl: "fr",    code: "FR", flag: "🇫🇷", name: "Français" },
    { hl: "de",    code: "DE", flag: "🇩🇪", name: "Deutsch" },
    { hl: "hi",    code: "HI", flag: "🇮🇳", name: "हिन्दी" },
    { hl: "es",    code: "ES", flag: "🇪🇸", name: "Español" },
    { hl: "pt-br", code: "BR", flag: "🇧🇷", name: "Português (BR)" },
    { hl: "tr",    code: "TR", flag: "🇹🇷", name: "Türkçe" },
    { hl: "ru",    code: "RU", flag: "🇷🇺", name: "Русский" },
    { hl: "en",    code: "EN", flag: "🇬🇧", name: "English" }
  ];

  function getCurrentHl() {
    try {
      // Prefer i18n runtime state if present
      if (typeof window.recapGetLang === "function") return (window.recapGetLang() || "en").toLowerCase();
      const url = new URL(location.href);
      const hl = (url.searchParams.get(PARAM) || "en").toLowerCase();
      if (hl === "pt_br") return "pt-br";
      return hl;
    } catch {
      return "en";
    }
  }

  function setHlLive(hl) {
    const target = (hl || "en").toLowerCase();
    // If i18n API exists, apply live; else fall back to changing the URL + reload.
    if (typeof window.recapSetLang === "function") {
      return window.recapSetLang(target);
    }

    try {
      const url = new URL(location.href);
      if (!target || target === "en") url.searchParams.delete(PARAM);
      else url.searchParams.set(PARAM, target);
      location.href = url.toString();
    } catch {
      // worst-case: reload
      location.reload();
    }
    return Promise.resolve();
  }

  function buildSwitcher(currentHl) {
    const current = LANGS.find(x => x.hl === currentHl) || LANGS.find(x => x.hl === "en");

    const root = document.createElement("div");
    root.className = "recap-lang-switcher";
    root.innerHTML = `
      <div class="rls-shell">
        <div class="rls-menu" role="listbox" aria-label="Language">
          ${LANGS.map(l => `
            <button type="button" class="rls-item" role="option"
              data-hl="${l.hl}"
              aria-selected="${l.hl === current.hl ? "true" : "false"}"
              title="${l.name}">
              <span class="rls-flag" aria-hidden="true">${l.flag}</span>
              <span class="rls-code">${l.code}</span>
            </button>
          `).join("")}
        </div>
        <button type="button" class="rls-current" aria-haspopup="listbox" aria-expanded="false">
          <span class="rls-flag" aria-hidden="true">${current.flag}</span>
          <span class="rls-code">${current.code}</span>
          <span class="rls-caret" aria-hidden="true"></span>
        </button>
      </div>
    `;

    const btn = root.querySelector(".rls-current");
    const menu = root.querySelector(".rls-menu");
    // Prevent interactions inside menu from affecting the page/swiper
["touchstart","touchmove","touchend","pointerdown","pointermove","pointerup"].forEach((evt) => {
  menu.addEventListener(evt, (e) => e.stopPropagation(), { passive: evt !== "touchmove" });
});

// iOS Safari: keep scroll inside menu (avoid rubber-band / scroll chaining)
let touchStartY = 0;

menu.addEventListener("touchstart", (e) => {
  if (!e.touches || !e.touches.length) return;
  touchStartY = e.touches[0].clientY;

  // Nudge away from edges so Safari doesn't "bounce" the page
  if (menu.scrollTop <= 0) menu.scrollTop = 1;
  const maxScroll = menu.scrollHeight - menu.clientHeight;
  if (menu.scrollTop >= maxScroll) menu.scrollTop = maxScroll - 1;
}, { passive: true });

menu.addEventListener("touchmove", (e) => {
  if (!root.classList.contains("open")) return;
  if (!e.touches || !e.touches.length) return;

  const y = e.touches[0].clientY;
  const dy = y - touchStartY;

  const atTop = menu.scrollTop <= 0;
  const atBottom = menu.scrollTop + menu.clientHeight >= menu.scrollHeight - 1;

  // If user is trying to overscroll beyond edges, prevent default to stop page/swiper
  if ((atTop && dy > 0) || (atBottom && dy < 0)) {
    e.preventDefault(); // requires passive:false
  }
}, { passive: false });


    // Wheel over the dropdown should scroll the dropdown (not the page)
    menu.addEventListener("wheel", (e) => {
      if (!root.classList.contains("open")) return;
      if (menu.scrollHeight <= menu.clientHeight) return;
      e.preventDefault();
      e.stopPropagation();
      menu.scrollTop += e.deltaY;
    }, { passive: false });

    function setOpen(open) {
      root.classList.toggle("open", !!open);
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    }

    function setCurrent(hl) {
      const cur = LANGS.find(x => x.hl === hl) || LANGS.find(x => x.hl === "en");
      if (!cur) return;

      const flag = btn.querySelector(".rls-flag");
      const code = btn.querySelector(".rls-code");
      if (flag) flag.textContent = cur.flag;
      if (code) code.textContent = cur.code;

      menu.querySelectorAll(".rls-item").forEach((it) => {
        it.setAttribute("aria-selected", it.getAttribute("data-hl") === cur.hl ? "true" : "false");
      });
    }

    // Keep dropdown inside viewport (never above TOP_PAD)
    function clampMenuToViewport() {
      const btnRect = btn.getBoundingClientRect();
      // space available above button for a drop-up, leaving TOP_PAD at top
      const available = Math.floor(btnRect.top - TOP_PAD - GAP);

      // If available is tiny, still keep it usable
      const maxH = Math.max(140, available);
      menu.style.maxHeight = `${maxH}px`;
    }

    // ✅ UPDATED: open -> clamp height + jump scroll to bottom (bottom-aligned start)
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const willOpen = !root.classList.contains("open");
      setOpen(willOpen);

      if (willOpen) {
        // Wait until it's visible / has layout
        requestAnimationFrame(() => {
          clampMenuToViewport();
          // start at bottom
          menu.scrollTop = menu.scrollHeight;

          // Extra robustness if heights change right after (fonts, etc.)
          setTimeout(() => {
            clampMenuToViewport();
            menu.scrollTop = menu.scrollHeight;
          }, 0);
        });
      }
    });

    // If viewport changes while open, keep it clamped
    window.addEventListener("resize", () => {
      if (root.classList.contains("open")) clampMenuToViewport();
    });

    menu.addEventListener("click", async (e) => {
      const item = e.target.closest(".rls-item");
      if (!item) return;
      const hl = item.getAttribute("data-hl") || "en";
      setOpen(false);
      await setHlLive(hl);
      setCurrent(getCurrentHl());
    });

    document.addEventListener("click", () => setOpen(false));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") setOpen(false);
    });

    // React to external lang changes (e.g., from URL or other UI)
    window.addEventListener("recap:langchange", (ev) => {
      const hl = (ev && ev.detail && ev.detail.hl) ? ev.detail.hl : getCurrentHl();
      setCurrent((hl || "en").toLowerCase());

      // if menu is open, re-clamp (text metrics can change)
      if (root.classList.contains("open")) {
        requestAnimationFrame(() => clampMenuToViewport());
      }
    });

    return root;
  }

  // Positioning: anchor above the primary caption widget on the first slide.
  function place(root, widget) {
    const slide = widget.closest(".swiper-slide") || widget.parentElement;
    if (!slide) return false;

    // Ensure absolute positioning works
    const slideStyle = getComputedStyle(slide);
    if (slideStyle.position === "static") {
      slide.style.position = "relative";
    }

    // Insert into the slide so it's positioned in the same coordinate space.
    slide.appendChild(root);

    const margin = 14;

    const doPosition = () => {
      const slideRect = slide.getBoundingClientRect();
      const widgetRect = widget.getBoundingClientRect();

      // Measure after render
      const rootRect = root.getBoundingClientRect();

      // Center horizontally on the widget
      const centerX = widgetRect.left + widgetRect.width / 2;
      const left = centerX - slideRect.left;

      // Place above the widget (with a margin)
      const top = (widgetRect.top - slideRect.top) - rootRect.height - margin;

      root.style.left = `${left}px`;
      root.style.top = `${Math.max(8, top)}px`;
    };

    // Reposition helper (handles live language changes / layout shifts)
    let _raf = 0;
    const schedulePosition = () => {
      if (_raf) cancelAnimationFrame(_raf);
      _raf = requestAnimationFrame(() => {
        _raf = 0;
        doPosition();
      });
    };

    // Position now + on resize
    schedulePosition();
    window.addEventListener("resize", schedulePosition);

    // Also reposition after fonts load, etc.
    setTimeout(schedulePosition, 250);

    // If the title/caption grows (some languages wrap to 2 lines), keep the switcher aligned.
    try {
      const ro = new ResizeObserver(() => {
        schedulePosition();
      });
      ro.observe(widget);
    } catch {}

    // Also react to text changes (live i18n) even if ResizeObserver isn't available.
    try {
      const mo = new MutationObserver(() => schedulePosition());
      mo.observe(widget, { childList: true, subtree: true, characterData: true });
      setTimeout(() => mo.disconnect(), 12000);
    } catch {}

    // When language changes, layout may update after a short delay (font metrics, wraps).
    window.addEventListener("recap:langchange", () => {
      schedulePosition();
      setTimeout(schedulePosition, 80);
      setTimeout(schedulePosition, 220);
      setTimeout(schedulePosition, 520);
    });
    setTimeout(schedulePosition, 900);

    return true;
  }

  function findWidget() {
    // Robust: anchor above the first visible "Share" / primary CTA button on the hero slide,
    // then climb to the card-like container that also contains the username + recap title.
    const shareBtn = document.querySelector("button._primary_1vg7i_62") || null;
    if (shareBtn) {
      let cur = shareBtn.parentElement;
      for (let i = 0; i < 10 && cur; i++) {
        if (cur.tagName === "DIV" && cur.querySelector("h1") && cur.querySelector("button._primary_1vg7i_62")) {
          return cur;
        }
        cur = cur.parentElement;
      }
      return shareBtn.parentElement;
    }

    // Fallback: first H1
    const h1 = document.querySelector("h1");
    return h1 ? h1.parentElement : null;
  }

  function init() {
    const widget = findWidget();
    if (!widget) return;

    const sw = buildSwitcher(getCurrentHl());
    place(sw, widget);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
