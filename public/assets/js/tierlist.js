/* APRP Federal Archive — President Tier List
   Fixed loading, matching current president-tierlist.html structure.
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

  const STORAGE_KEY = "aprp-president-player-tierlist-v2";
  const TIER_ORDER = ["S", "A", "B", "C", "D", "F", "Unranked"];

  let PRESIDENTS = [];
  let CURRENT_TIERS = {};

  function $(selector) {
    return document.querySelector(selector);
  }

  function $all(selector) {
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
    if (["R", "REP", "REPUBLICAN", "REPUBLICANS", "GOP"].includes(raw)) return "GOP";
    if (["I", "IND", "INDEPENDENT"].includes(raw)) return "IND";
    if (!raw || ["VACANT", "-", "—", "N/A"].includes(raw)) return "VACANT";
    return raw;
  }

  function presidentName(row) {
    return firstValue(row, ["president", "name", "full_name", "person", "officeholder", "winner"], "Unknown President");
  }

  function presidentNumber(row) {
    return firstValue(row, ["number", "president_number", "no", "order", "num"], "");
  }

  function presidentParty(row) {
    return normalizeParty(firstValue(row, ["party", "party_id", "president_party", "winner_party"], "VACANT"));
  }

  function presidentTerm(row) {
    const direct = firstValue(row, ["term", "years", "term_years", "served", "dates"], "");
    if (direct) return direct;

    const start = firstValue(row, ["term_start", "start_year", "inauguration_year", "start"], "");
    const end = firstValue(row, ["term_end", "end_year", "left_office_year", "end"], "");

    if (start && end) return `${start}–${end}`;
    if (start) return `${start}–`;
    return "Term unknown";
  }

  function presidentImage(row) {
    return firstValue(
      row,
      [
        "portrait_url",
        "portrait",
        "photo",
        "image",
        "image_url",
        "img",
        "picture"
      ],
      "./assets/img/president-placeholder.png"
    );
  }

  function officialTier(row) {
    const raw = firstValue(row, ["tier", "rank", "tier_rank", "legacy_tier", "ranking"], "");
    const upper = cleanCell(raw).toUpperCase();

    if (["S", "A", "B", "C", "D", "F"].includes(upper)) return upper;
    return "Unranked";
  }

  function stableId(row, index) {
    const direct = firstValue(row, ["slug", "id", "president_id"], "");
    if (direct) return direct;

    const name = presidentName(row)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const number = presidentNumber(row);
    return number ? `${number}-${name}` : `${index}-${name}`;
  }

  function normalizePresident(row, index) {
    const id = stableId(row, index);

    return {
      id,
      name: presidentName(row),
      number: presidentNumber(row),
      party: presidentParty(row),
      term: presidentTerm(row),
      image: presidentImage(row),
      officialTier: officialTier(row),
    };
  }

  function getTier(president) {
    return CURRENT_TIERS[president.id] || president.officialTier || "Unranked";
  }

  function saveLocal() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(CURRENT_TIERS));
  }

  function loadLocal() {
    try {
      CURRENT_TIERS = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {};
    } catch {
      CURRENT_TIERS = {};
    }
  }

  function clearDropzones() {
    $all("[data-tier-dropzone]").forEach((zone) => {
      zone.innerHTML = "";
    });
  }

  function presidentCardHTML(president) {
    return `
      <article
        class="president-token"
        draggable="true"
        data-president-id="${safeHTML(president.id)}"
        title="Drag ${safeHTML(president.name)} to another tier"
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
            ${safeHTML(president.party)} · ${safeHTML(president.term)}
          </span>
        </div>
      </article>
    `;
  }

  function renderBoard() {
    clearDropzones();

    const grouped = {};
    TIER_ORDER.forEach((tier) => {
      grouped[tier] = [];
    });

    PRESIDENTS.forEach((president) => {
      const tier = TIER_ORDER.includes(getTier(president)) ? getTier(president) : "Unranked";
      grouped[tier].push(president);
    });

    TIER_ORDER.forEach((tier) => {
      const zone = document.querySelector(`[data-tier-dropzone="${tier}"]`);
      if (!zone) return;

      const presidents = grouped[tier] || [];

      zone.innerHTML = presidents.length
        ? presidents.map(presidentCardHTML).join("")
        : `<div class="tier-empty">Drop presidents here</div>`;
    });

    bindDragDrop();
    renderStats();
  }

  function bindDragDrop() {
    $all(".president-token").forEach((card) => {
      card.addEventListener("dragstart", (event) => {
        event.dataTransfer.setData("text/plain", card.dataset.presidentId);
        card.classList.add("is-dragging");
      });

      card.addEventListener("dragend", () => {
        card.classList.remove("is-dragging");
      });

      card.addEventListener("click", () => {
        const president = PRESIDENTS.find((item) => item.id === card.dataset.presidentId);
        if (!president) return;
        window.location.href = `./hall-of-presidents.html`;
      });
    });

    $all("[data-tier-dropzone]").forEach((zone) => {
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

        CURRENT_TIERS[presidentId] = tier;
        saveLocal();

        zone.classList.remove("is-over");
        renderBoard();
      });
    });
  }

  function renderStats() {
    const total = PRESIDENTS.length;
    const ranked = PRESIDENTS.filter((president) => getTier(president) !== "Unranked").length;

    const totalEl = $("#tier-total-presidents");
    const rankedEl = $("#tier-ranked-count");

    if (totalEl) totalEl.textContent = total.toLocaleString();
    if (rankedEl) rankedEl.textContent = ranked.toLocaleString();
  }

  function exportJSON() {
    const box = $("#tier-share-box");
    if (!box) return;

    box.value = JSON.stringify(CURRENT_TIERS, null, 2);
    box.classList.add("is-visible");
    box.focus();
    box.select();
  }

  function importJSON() {
    const box = $("#tier-share-box");
    if (!box) return;

    box.classList.add("is-visible");

    const raw = prompt("Paste exported tier list JSON:");
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      CURRENT_TIERS = parsed && typeof parsed === "object" ? parsed : {};
      saveLocal();
      renderBoard();
      box.value = JSON.stringify(CURRENT_TIERS, null, 2);
    } catch {
      alert("Invalid JSON.");
    }
  }

  function resetToOfficial() {
    CURRENT_TIERS = {};
    saveLocal();
    renderBoard();
  }

  function clearLocal() {
    CURRENT_TIERS = {};
    localStorage.removeItem(STORAGE_KEY);
    renderBoard();
  }

  function setupButtons() {
    $("#tier-save-button")?.addEventListener("click", () => {
      saveLocal();
      alert("Tier list saved locally.");
    });

    $("#tier-export-button")?.addEventListener("click", exportJSON);
    $("#tier-import-button")?.addEventListener("click", importJSON);
    $("#tier-official-button")?.addEventListener("click", resetToOfficial);
    $("#tier-clear-button")?.addEventListener("click", clearLocal);
  }

  async function init() {
    setupButtons();
    loadLocal();

    try {
      if (typeof fetchSheets !== "function") {
        throw new Error("fetchSheets is unavailable. Check script order: sheets.js, shared.js, president-tierlist.js.");
      }

      const data = await fetchSheets(["WEB_POTUS"]);
      const rows = data?.WEB_POTUS || [];

      PRESIDENTS = rows
        .map(normalizePresident)
        .filter((president) => president.name && president.name !== "Unknown President");

      if (!PRESIDENTS.length) {
        throw new Error("WEB_POTUS loaded, but no president rows were found. Check sheet headers.");
      }

      renderBoard();
    } catch (error) {
      console.error("Tier list failed:", error);

      const firstZone = document.querySelector('[data-tier-dropzone="S"]');
      if (firstZone) {
        firstZone.innerHTML = `
          <div class="tier-empty">
            Tier list failed to load: ${safeHTML(error.message)}
          </div>
        `;
      }
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
