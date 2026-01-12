/* recap_share.js
   Make Share buttons share/copy THIS archived page URL (works locally + GitHub Pages).
   - Uses Web Share API when available; otherwise copies the link to clipboard.
*/
(() => {
  if (window.__RECAP_SHARE_FIX__) return;
  window.__RECAP_SHARE_FIX__ = true;

  function getShareUrl() {
    try {
      return new URL(window.location.href).toString();
    } catch {
      return String(window.location.href || "");
    }
  }

  function toast(msg) {
    try {
      const id = "__recap_share_toast__";
      let el = document.getElementById(id);
      if (!el) {
        el = document.createElement("div");
        el.id = id;
        el.style.position = "fixed";
        el.style.left = "50%";
        el.style.bottom = "18px";
        el.style.transform = "translateX(-50%)";
        el.style.padding = "10px 12px";
        el.style.borderRadius = "10px";
        el.style.background = "rgba(20, 24, 30, 0.86)";
        el.style.color = "rgba(255,255,255,0.95)";
        el.style.fontFamily = "var(--font-family-base, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif)";
        el.style.fontSize = "14px";
        el.style.zIndex = "99999";
        el.style.boxShadow = "0 10px 26px rgba(0,0,0,0.35)";
        el.style.backdropFilter = "blur(6px)";
        el.style.webkitBackdropFilter = "blur(6px)";
        el.style.pointerEvents = "none";
        el.style.opacity = "0";
        el.style.transition = "opacity 180ms ease";
        document.body.appendChild(el);
      }
      el.textContent = msg;
      el.style.opacity = "1";
      clearTimeout(el.__t);
      el.__t = setTimeout(() => { el.style.opacity = "0"; }, 1400);
    } catch {}
  }

  async function shareOrCopy() {
    const url = getShareUrl();
    const title = document.title || "Recap";
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
    } catch {
      // ignore and fall back to clipboard
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
        toast("Link copied");
        return;
      }
    } catch {}

    // Last resort fallback
    try {
      window.prompt("Copy this link:", url);
    } catch {}
  }

  function bind() {
    // In this build, both Share CTAs are primary buttons.
    const btns = Array.from(document.querySelectorAll("button._primary_1vg7i_62"));
    if (!btns.length) return;

    for (const b of btns) {
      b.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        shareOrCopy();
      }, { passive: false });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind, { once: true });
  } else {
    bind();
  }
})();
