/*
  recap_i18n.js
  Offline-friendly localization loader for archived Recap pages.

  - Loads translation packs from lang/<code>.js (generated from lang/*.html).
  - Applies translations live (no reload required).
  - Updates the URL parameter ?hl=<code> via history.replaceState.
  - Can restore the original (base) text when switching to EN / no ?hl.

  Public API:
    window.recapSetLang(hl)  -> Promise<void>
    window.recapGetLang()    -> string
*/
(() => {
  if (window.__RECAP_I18N_LOADER__) return;
  window.__RECAP_I18N_LOADER__ = true;

  const PARAM = "hl";
  const FALLBACKS = {
    "pt": "pt-br",
    "pt_br": "pt-br",
    "pt-br": "pt-br",
    "zh": "zh-cn",
    "zh_cn": "zh-cn",
    "zh_tw": "zh-tw",
    "zh-hans": "zh-cn",
    "zh-hant": "zh-tw",
  };

  // Base snapshot (so we can go back to EN/base without reloading).
  const baseText = new Map(); // sel -> original textContent
  const baseAttr = new Map(); // sel|attr -> original attr value (or null if missing)
  let baseCaptured = false;

  function normLang(raw) {
    if (!raw) return "";
    let l = String(raw).trim().toLowerCase().replace(/_/g, "-");
    if (FALLBACKS[l]) l = FALLBACKS[l];
    return l;
  }

  function getLangFromUrl() {
    try {
      const url = new URL(window.location.href);
      return normLang(url.searchParams.get(PARAM));
    } catch {
      return "";
    }
  }

  function setLangInUrl(lang) {
    try {
      const url = new URL(window.location.href);
      if (!lang || lang === "en") url.searchParams.delete(PARAM);
      else url.searchParams.set(PARAM, lang);
      history.replaceState({}, "", url.toString());
    } catch {}
  }

  function captureBaseOnce(pack) {
    if (baseCaptured) return;
    baseCaptured = true;

    const text = (pack && pack.text) ? pack.text : {};
    for (const sel in text) {
      try {
        const el = document.querySelector(sel);
        if (el && !baseText.has(sel)) baseText.set(sel, el.textContent);
      } catch {}
    }

    const attrs = (pack && pack.attrs) ? pack.attrs : [];
    for (const item of attrs) {
      if (!item || !item.sel || !item.attr) continue;
      const key = `${item.sel}||${item.attr}`;
      try {
        const el = document.querySelector(item.sel);
        if (!el || baseAttr.has(key)) continue;
        const had = el.hasAttribute(item.attr);
        baseAttr.set(key, had ? el.getAttribute(item.attr) : null);
      } catch {}
    }
  }

  // Apply pack (leaf-node safe: we only touch elements that were text-leaves in the source packs).
  function applyPack(lang, pack) {
    if (!pack) return;

    // Optional: document title
    if (pack.title != null) document.title = pack.title;

    const text = pack.text || {};
    for (const sel in text) {
      try {
        const el = document.querySelector(sel);
        if (el) el.textContent = text[sel];
      } catch {
        // ignore invalid selectors
      }
    }

    const attrs = pack.attrs || [];
    for (const item of attrs) {
      if (!item || !item.sel || !item.attr) continue;
      try {
        const el = document.querySelector(item.sel);
        if (el) el.setAttribute(item.attr, item.value ?? "");
      } catch {}
    }

    try {
      document.documentElement.setAttribute("lang", lang || "en");
    } catch {}
  }

  function restoreBase() {
    // Restore attributes first (so placeholder/title etc are correct before text).
    for (const [key, value] of baseAttr.entries()) {
      const [sel, attr] = key.split("||");
      try {
        const el = document.querySelector(sel);
        if (!el) continue;
        if (value === null) el.removeAttribute(attr);
        else el.setAttribute(attr, value);
      } catch {}
    }

    for (const [sel, value] of baseText.entries()) {
      try {
        const el = document.querySelector(sel);
        if (el) el.textContent = value;
      } catch {}
    }

    try {
      document.documentElement.setAttribute("lang", "en");
    } catch {}
  }

  function loadPack(lang, cb) {
    const existing = window.__RECAP_I18N__ && window.__RECAP_I18N__[lang];
    if (existing) return cb(existing);

    const s = document.createElement("script");
    s.async = true;
    s.src = `lang/${encodeURIComponent(lang)}.js`;
    s.onload = () => {
      const pack = window.__RECAP_I18N__ && window.__RECAP_I18N__[lang];
      cb(pack || null);
    };
    s.onerror = () => cb(null);

    document.head.appendChild(s);
  }

  function setLangLive(rawLang, opts = {}) {
    const lang = normLang(rawLang);
    const updateUrl = opts.updateUrl !== false;

    return new Promise((resolve) => {
      // EN/base: restore without reload
      if (!lang || lang === "en") {
        if (updateUrl) setLangInUrl("en");
        if (baseCaptured) restoreBase();
        window.__RECAP_I18N_CURRENT__ = "en";
        window.dispatchEvent(new CustomEvent("recap:langchange", { detail: { hl: "en" } }));
        return resolve();
      }

      loadPack(lang, (pack) => {
        if (!pack) {
          // If pack missing, just fall back to base and keep URL sensible.
          if (updateUrl) setLangInUrl("en");
          if (baseCaptured) restoreBase();
          window.__RECAP_I18N_CURRENT__ = "en";
          window.dispatchEvent(new CustomEvent("recap:langchange", { detail: { hl: "en" } }));
          return resolve();
        }

        // Capture base on first successful apply (using this pack's selector set).
        captureBaseOnce(pack);

        // Apply now, then re-apply shortly (some nodes can render late).
        const doApply = () => applyPack(lang, pack);
        doApply();
        setTimeout(doApply, 200);

        if (updateUrl) setLangInUrl(lang);
        window.__RECAP_I18N_CURRENT__ = lang;
        window.dispatchEvent(new CustomEvent("recap:langchange", { detail: { hl: lang } }));
        resolve();
      });
    });
  }

  function init() {
    const lang = getLangFromUrl();
    if (!lang || lang === "en") {
      window.__RECAP_I18N_CURRENT__ = "en";
      return;
    }

    // Apply after everything has settled so we don't fight any JS that may populate values.
    const go = () => setLangLive(lang, { updateUrl: true });
    if (document.readyState === "complete") {
      go();
    } else {
      window.addEventListener("load", go, { once: true });
    }
  }

  // Public API
  window.recapSetLang = (hl) => setLangLive(hl, { updateUrl: true });
  window.recapGetLang = () => window.__RECAP_I18N_CURRENT__ || "en";

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
