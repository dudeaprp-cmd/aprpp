/* APRP Federal Archive — Shared UI + Navigation Helpers */

(function () {
  window.APRP = window.APRP || {};
  window.APRP_UI = window.APRP_UI || {};

  const APRP = window.APRP;
  const APRP_UI = window.APRP_UI;

  const NAV_ITEMS = [
    { label: "Home", href: "./index.html", match: ["index.html", "/public/", "/public"] },
    { label: "Government", href: "./government.html", match: ["government.html"] },
    { label: "Economy", href: "./economy.html", match: ["economy.html"] },
    { label: "Timeline", href: "./timeline.html", match: ["timeline.html"] },
    { label: "Presidents", href: "./hall-of-presidents.html", match: ["hall-of-presidents.html", "presidents.html"] },
    { label: "Elections", href: "./elections.html", match: ["elections.html", "election.html"] },
    { label: "Live Results", href: "./live-results.html", match: ["live-results.html"] },
  ];

  function cleanCell(value) {
    return String(value ?? "").trim();
  }

  function toNumber(value, fallback = 0) {
    if (value === null || value === undefined || value === "") return fallback;

    const parsed = Number(
      String(value)
        .replace(/[$,%]/g, "")
        .replace(/,/g, "")
        .trim()
    );

    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function safeHTML(value) {
    return cleanCell(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function groupBy(rows, key) {
    return (rows || []).reduce((groups, row) => {
      const groupKey = cleanCell(row?.[key]) || "Unknown";
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(row);
      return groups;
    }, {});
  }

  function slugify(value) {
    return cleanCell(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function normalizeParty(party) {
    const raw = cleanCell(party).toUpperCase();

    if (["D", "DEM", "DEMOCRAT", "DEMOCRATIC", "DNC"].includes(raw)) return "DNC";
    if (["R", "REP", "REPUBLICAN", "GOP"].includes(raw)) return "GOP";
    if (["I", "IND", "INDEPENDENT"].includes(raw)) return "IND";
    if (["VACANT", "-", "—", "NONE", "N/A", ""].includes(raw)) return "VACANT";

    return raw || "OTHER";
  }

  function partyClass(party) {
    const normalized = normalizeParty(party);

    if (normalized === "DNC") return "party-dnc";
    if (normalized === "GOP") return "party-gop";
    if (normalized === "IND") return "party-ind";
    if (normalized === "VACANT") return "party-vacant";

    return "party-other";
  }

  function partyBadge(party) {
    const normalized = normalizeParty(party);
    return `<span class="party-badge ${partyClass(normalized)}">${safeHTML(normalized)}</span>`;
  }

  function emptyState(message = "No records found.") {
    return `
      <div class="empty-state">
        <strong>No Data</strong>
        <span>${safeHTML(message)}</span>
      </div>
    `;
  }

  function officialNotice(message) {
    return `
      <div class="official-notice">
        <strong>Official Archive Record</strong>
        <span>${safeHTML(message)}</span>
      </div>
    `;
  }

  function showError(selector, message) {
    const slot = document.querySelector(selector);
    if (!slot) return;

    slot.innerHTML = `
      <div class="empty-state error-state">
        <strong>Page failed to load</strong>
        <span>${safeHTML(message)}</span>
      </div>
    `;
  }

  function formatNumber(value, options = {}) {
    return toNumber(value, 0).toLocaleString(undefined, options);
  }

  function formatMoney(value) {
    const number = toNumber(value, 0);
    const abs = Math.abs(number);

    if (abs >= 1_000_000_000_000) return `$${(number / 1_000_000_000_000).toFixed(2)}T`;
    if (abs >= 1_000_000_000) return `$${(number / 1_000_000_000).toFixed(2)}B`;
    if (abs >= 1_000_000) return `$${(number / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000) return `$${(number / 1_000).toFixed(1)}K`;

    return `$${number.toLocaleString()}`;
  }

  function renderSplitBar(selector, items) {
    const slot = document.querySelector(selector);
    if (!slot) return;

    const total = items.reduce((sum, item) => sum + toNumber(item.value, 0), 0);

    if (!total) {
      slot.innerHTML = `
        <div class="split-bar empty">
          <span>No data</span>
        </div>
      `;
      return;
    }

    slot.innerHTML = `
      <div class="split-bar">
        ${items.map((item) => {
          const value = toNumber(item.value, 0);
          const width = total ? (value / total) * 100 : 0;

          if (value <= 0) return "";

          return `
            <div
              class="split-segment ${safeHTML(item.className || "")}"
              style="width:${width.toFixed(4)}%;"
              title="${safeHTML(item.label)}: ${value}"
            >
              <span>${safeHTML(item.label)} ${safeHTML(value)}</span>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  function currentPath() {
    return window.location.pathname.split("/").pop() || "index.html";
  }

  function isActiveNavItem(item) {
    const path = currentPath();

    return item.match.some((match) => {
      return path === match || window.location.pathname.includes(match);
    });
  }

  function navHTML(items = NAV_ITEMS) {
    return items.map((item) => {
      const active = isActiveNavItem(item) ? "is-active" : "";

      return `
        <a class="${active}" href="${safeHTML(item.href)}">
          ${safeHTML(item.label)}
        </a>
      `;
    }).join("");
  }

  function renderPrimaryNav() {
    document.querySelectorAll("[data-aprp-nav]").forEach((nav) => {
      nav.innerHTML = navHTML();
    });
  }

  function renderMobileNav() {
    document.querySelectorAll("[data-mobile-nav]").forEach((nav) => {
      nav.innerHTML = navHTML([
        { label: "Home", href: "./index.html", match: ["index.html", "/public/", "/public"] },
        { label: "Gov", href: "./government.html", match: ["government.html"] },
        { label: "Econ", href: "./economy.html", match: ["economy.html"] },
        { label: "Pres", href: "./hall-of-presidents.html", match: ["hall-of-presidents.html", "presidents.html"] },
        { label: "Live", href: "./live-results.html", match: ["live-results.html"] },
      ]);
    });
  }

  function fixBadPresidentLinks() {
    document.querySelectorAll("a[href]").forEach((anchor) => {
      const href = cleanCell(anchor.getAttribute("href"));

      const badPresidentLinks = [
        "presidents.js",
        "./presidents.js",
        "./assets/js/presidents.js",
        "assets/js/presidents.js",
        "/assets/js/presidents.js",
        "public/assets/js/presidents.js",
        "./public/assets/js/presidents.js",
        "presidents.html",
        "./presidents.html",
      ];

      const isBad = badPresidentLinks.some((bad) => href === bad || href.endsWith(bad));

      if (isBad) {
        anchor.setAttribute("href", "./hall-of-presidents.html");
      }
    });
  }

  function setupHeaderScroll() {
    const header = document.querySelector("[data-collapsing-header]");
    if (!header) return;

    const update = () => {
      header.classList.toggle("is-scrolled", window.scrollY > 12);
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
  }

  function initShared() {
    renderPrimaryNav();
    renderMobileNav();
    fixBadPresidentLinks();
    setupHeaderScroll();
  }

  APRP.cleanCell = APRP.cleanCell || cleanCell;
  APRP.toNumber = APRP.toNumber || toNumber;
  APRP.safeHTML = APRP.safeHTML || safeHTML;
  APRP.groupBy = APRP.groupBy || groupBy;
  APRP.slugify = APRP.slugify || slugify;
  APRP.showError = APRP.showError || showError;
  APRP.formatNumber = APRP.formatNumber || formatNumber;
  APRP.formatMoney = APRP.formatMoney || formatMoney;
  APRP.fixBadPresidentLinks = fixBadPresidentLinks;

  APRP_UI.partyBadge = APRP_UI.partyBadge || partyBadge;
  APRP_UI.renderSplitBar = APRP_UI.renderSplitBar || renderSplitBar;
  APRP_UI.officialNotice = APRP_UI.officialNotice || officialNotice;
  APRP_UI.emptyState = APRP_UI.emptyState || emptyState;

  document.addEventListener("DOMContentLoaded", initShared);
})();