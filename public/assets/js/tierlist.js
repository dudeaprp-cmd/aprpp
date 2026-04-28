/* APRP Federal Archive — President Tier List
   Fixed for current HTML:
   - Uses #tier-board-root and [data-tier-dropzone]
   - Loads WEB_POTUS safely
   - Removes stuck "Loading presidents..."
   - Supports drag/drop, save, export, import, reset, clear
*/

(function () {
  const APRP = window.APRP || {};

  const fetchSheets = APRP.fetchSheets;
  const cleanCell = APRP.cleanCell || ((value) => String(value ?? "").trim());
  const safeHTML = APRP.safeHTML || ((value) =>
    cleanCell(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;")
  );

  const STORAGE_KEY = "aprp-president-tierlist-local-v1";
  const TIER_ORDER = ["S", "A", "B", "C", "D", "F", "Unranked"];

  let PRESIDENTS = [];
  let LOCAL_TIERS = {};

  function getEl(selector) {
    return document.querySelector(selector);
  }

  function getAll(selector) {
    return Array.from(document.querySelectorAll(selector));
  }

  function firstValue(row, keys, fallback = "") {
    for (const key of keys) {
      const value = cleanCell(row?.[key]);
      if (value) return value;
    }
    return fallback;
  }

  function normalizeParty(value) {
    const raw = cleanCell(value).toUpperCase();

    if (["D", "DEM", "DEMOCRAT", "DEMOCRATIC", "DNC"].includes(raw)) return "DNC";
    if (["R", "REP", "REPUBLICAN", "GOP"].includes(raw)) return "GOP";
    if (["I", "IND", "INDEPENDENT"].includes(raw)) return "IND";

    return raw || "OTHER";
  }

  function officialTier(row) {
    const raw = firstValue(row, ["tier", "rank", "ranking", "tier_rank", "legacy_tier"], "");
    const upper = cleanCell(raw).toUpperCase();

    if (["S", "A", "B", "C", "D", "F"].includes(upper)) return upper;
    return "Unranked";
  }

  function slugify(value) {
    return cleanCell(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function normalizePresident(row, index) {
    const name = firstValue(
      row,
      ["president", "name", "full_name", "person", "officeholder", "winner"],
      "Unknown President"
    );

    const number = firstValue(row, ["number", "president_number", "no", "order", "num"], "");
    const party = normalizeParty(firstValue(row, ["party", "party_id", "president_party", "winner_party"], ""));
    const term = firstValue(row, ["term", "years", "term_years", "served", "dates"], "");
    const image = firstValue(
      row,
      ["portrait_url", "portrait", "photo", "image", "image_url", "img", "picture"],
      "./assets/img/president-placeholder.png"
    );

    const directId = firstValue(row, ["id", "slug", "president_id"], "");
    const id = directId || `${number || index + 1}-${slugify(name)}`;

    return {
      id,
      name,
      number,
      party,
      term,
      image,
      officialTier: officialTier(row),
    };
  }

  function getTier(president) {
    return LOCAL_TIERS[president.id] || president.officialTier || "Unranked";
  }

  function loadLocal() {
    try {
      LOCAL_TIERS = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {};
    } catch {
      LOCAL_TIERS = {};
    }
  }

  function saveLocal() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(LOCAL_TIERS));
  }

  function setStats() {
    const total = PRESIDENTS.length;
    const ranked = PRESIDENTS.filter((p) => getTier(p) !== "Unranked").length;

    const totalEl = getEl("#tier-total-presidents");
    const rankedEl = getEl("#tier-ranked-count");

    if (totalEl) totalEl.textContent = total.toLocaleString();
    if (rankedEl) rankedEl.textContent = ranked.toLocaleString();
  }

  function cardHTML(president) {
    return `
      <article
        class="president-token"
        draggable="true"
        data-president-id="${safeHTML(president.id)}"
      >
        <img
          src="${safeHTML(president.image)}"
          alt="${safeHTML(president.name)}"
          onerror="this.src='./assets/img/president-placeholder.png'"
        />
        <div class="president-token-info">
          <strong>${safeHTML(president.name)}</strong>
          <span>
            ${president.number ? `#${safeHTML(president.number)} · ` : ""}
            ${safeHTML(president.party)}
            ${president.term ? ` · ${safeHTML(president.term)}` : ""}
          </span>
        </div>
      </article>
    `;
  }

  function renderBoard() {
    const zones = getAll("[data-tier-dropzone]");

    zones.forEach((zone) => {
      zone.innerHTML = "";
    });

    const grouped = {};
    TIER_ORDER.forEach((tier) => {
      grouped[tier] = [];
    });

    PRESIDENTS.forEach((president) => {
      const tier = TIER_ORDER.includes(getTier(president)) ? getTier(president) : "Unranked";
      grouped[tier].push(president);
    });

    TIER_ORDER.forEach((tier) => {
      const zone = getEl(`[data-tier-dropzone="${tier}"]`);
      if (!zone) return;

      const presidents = grouped[tier] || [];
      zone.innerHTML = presidents.length
        ? presidents.map(cardHTML).join("")
        : `<div class="tier-empty">Drop presidents here</div>`;
    });

    bindDragDrop();
    setStats();
  }

  function bindDragDrop() {
    getAll(".president-token").forEach((card) => {
      card.addEventListener("dragstart", (event) => {
        event.dataTransfer.setData("text/plain", card.dataset.presidentId);
        card.classList.add("is-dragging");
      });

      card.addEventListener("dragend", () => {
        card.classList.remove("is-dragging");
      });

      card.addEventListener("click", () => {
        window.location.href = "./hall-of-presidents.html";
      });
    });

    getAll("[data-tier-dropzone]").forEach((zone) => {
      zone.addEventListener("dragover", (event) => {
        event.preventDefault();
        zone.classList.add("is-over");
      });

      zone.addEventListener("dragleave", () => {
        zone.classList.remove("is-over");
      });

      zone.addEventListener("drop", (event) => {
        event.preventDefault();

        const presidentId = event.dataTransfer.getData("text/plain");
        const tier = zone.dataset.tierDropzone;

        if (!presidentId || !tier) return;

        LOCAL_TIERS[presidentId] = tier;
        saveLocal();
        zone.classList.remove("is-over");
        renderBoard();
      });
    });
  }

  function showBoardError(message) {
    const firstZone = getEl('[data-tier-dropzone="S"]');
    if (firstZone) {
      firstZone.innerHTML = `
        <div class="tier-empty">
          Tier list failed to load: ${safeHTML(message)}
        </div>
      `;
    }

    setStats();
  }

  async function loadPresidents() {
    if (typeof fetchSheets !== "function") {
      throw new Error("fetchSheets is missing. Make sure sheets.js loads before president-tierlist.js.");
    }

    const data = await fetchSheets(["WEB_POTUS"]);
    const rows = data?.WEB_POTUS || [];

    PRESIDENTS = rows
      .map(normalizePresident)
      .filter((president) => president.name && president.name !== "Unknown President");

    if (!PRESIDENTS.length) {
      throw new Error("WEB_POTUS loaded but no president rows were found. Check tab name and headers.");
    }
  }

  function setupButtons() {
    getEl("#tier-save-button")?.addEventListener("click", () => {
      saveLocal();
      alert("Tier list saved locally.");
    });

    getEl("#tier-export-button")?.addEventListener("click", () => {
      const box = getEl("#tier-share-box");
      if (!box) return;

      box.value = JSON.stringify(LOCAL_TIERS, null, 2);
      box.classList.add("is-visible");
      box.focus();
      box.select();
    });

    getEl("#tier-import-button")?.addEventListener("click", () => {
      const raw = prompt("Paste exported tier list JSON:");
      if (!raw) return;

      try {
        const parsed = JSON.parse(raw);
        LOCAL_TIERS = parsed && typeof parsed === "object" ? parsed : {};
        saveLocal();
        renderBoard();

        const box = getEl("#tier-share-box");
        if (box) {
          box.value = JSON.stringify(LOCAL_TIERS, null, 2);
          box.classList.add("is-visible");
        }
      } catch {
        alert("Invalid JSON.");
      }
    });

    getEl("#tier-official-button")?.addEventListener("click", () => {
      LOCAL_TIERS = {};
      saveLocal();
      renderBoard();
    });

    getEl("#tier-clear-button")?.addEventListener("click", () => {
      LOCAL_TIERS = {};
      localStorage.removeItem(STORAGE_KEY);
      renderBoard();
    });
  }

  async function initTierList() {
    setupButtons();
    loadLocal();

    try {
      await loadPresidents();
      renderBoard();
    } catch (error) {
      console.error("President tier list failed:", error);
      showBoardError(error.message);
    }
  }

  document.addEventListener("DOMContentLoaded", initTierList);
})();
