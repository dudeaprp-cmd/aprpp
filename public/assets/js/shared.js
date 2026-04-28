(function () {
  "use strict";

  const NAV_ITEMS = [
    { label: "Home", href: "./index.html", key: "home" },
    { label: "Government", href: "./government.html", key: "government" },
    { label: "Economy", href: "./economy.html", key: "economy" },
    { label: "Timeline", href: "./timeline.html", key: "timeline" },
    { label: "Presidents", href: "./hall-of-presidents.html", key: "presidents" },
    { label: "Elections", href: "./elections.html", key: "elections" },
    { label: "Tier List", href: "./president-tierlist.html", key: "tierlist" },
    { label: "Live Results", href: "./live-results.html", key: "live", live: true },
    { label: "Calculator", href: "./election-calculator.html", key: "calculator" }
  ];

  const MOBILE_ITEMS = [
    { label: "Home", href: "./index.html", key: "home" },
    { label: "Gov", href: "./government.html", key: "government" },
    { label: "Econ", href: "./economy.html", key: "economy" },
    { label: "Pres", href: "./hall-of-presidents.html", key: "presidents" },
    { label: "Live", href: "./live-results.html", key: "live", live: true }
  ];

  function getCurrentFile() {
    const path = window.location.pathname || "";
    const file = path.split("/").pop() || "index.html";
    return file.toLowerCase();
  }

  function keyForFile(file) {
    const map = {
      "index.html": "home",
      "": "home",
      "government.html": "government",
      "economy.html": "economy",
      "timeline.html": "timeline",
      "hall-of-presidents.html": "presidents",
      "elections.html": "elections",
      "president-tierlist.html": "tierlist",
      "live-results.html": "live",
      "election-calculator.html": "calculator"
    };

    return map[file] || "";
  }

  function createNavLink(item, currentKey, extraClass = "") {
    const a = document.createElement("a");
    a.href = item.href;
    a.textContent = item.label;

    const classes = [];
    if (extraClass) classes.push(extraClass);
    if (item.live) classes.push("is-live");
    if (item.key === currentKey) classes.push("is-active");

    if (classes.length) {
      a.className = classes.join(" ");
    }

    if (item.key === currentKey) {
      a.setAttribute("aria-current", "page");
    }

    return a;
  }

  function renderPrimaryNav() {
    const currentKey = keyForFile(getCurrentFile());
    const navs = document.querySelectorAll("[data-aprp-nav]");

    navs.forEach((nav) => {
      nav.innerHTML = "";

      NAV_ITEMS.forEach((item) => {
        nav.appendChild(createNavLink(item, currentKey));
      });
    });
  }

  function renderMobileNav() {
    const currentKey = keyForFile(getCurrentFile());
    const navs = document.querySelectorAll("[data-mobile-nav]");

    navs.forEach((nav) => {
      nav.innerHTML = "";

      MOBILE_ITEMS.forEach((item) => {
        nav.appendChild(createNavLink(item, currentKey));
      });
    });
  }

  function setupCollapsingHeader() {
    const header = document.querySelector("[data-collapsing-header]");
    if (!header) return;

    const onScroll = () => {
      if (window.scrollY > 36) {
        header.classList.add("is-collapsed");
      } else {
        header.classList.remove("is-collapsed");
      }
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  function addBodyClassForPage() {
    const key = keyForFile(getCurrentFile());
    if (key) document.body.classList.add(`page-${key}`);
  }

  function initShared() {
    addBodyClassForPage();
    renderPrimaryNav();
    renderMobileNav();
    setupCollapsingHeader();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initShared);
  } else {
    initShared();
  }

  window.APRP_SHARED = {
    NAV_ITEMS,
    MOBILE_ITEMS,
    getCurrentFile,
    keyForFile
  };
})();
