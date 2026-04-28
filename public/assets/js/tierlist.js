/* APRP Federal Archive — President Tier List with drag/drop player rankings */

(function () {
  const APRP = window.APRP || {};

  const fetchSheets = APRP.fetchSheets;
  const cleanCell = APRP.cleanCell || ((value) => String(value ?? "").trim());
  const toNumber = APRP.toNumber || ((value, fallback = 0) => {
    const parsed = Number(String(value ?? "").replace(/[$,%]/g, "").replace(/,/g, "").trim());
    return Number.isFinite(parsed) ? parsed : fallback;
  });
  const safeHTML = APRP.safeHTML || ((value) => {
    return cleanCell(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  });

  let ALL_PRESIDENTS = [];
  let FILTERED_PRESIDENTS = [];
  let PLAYER_TIERS = {};

  const STORAGE_KEY = "aprp-president-player-tierlist-v1";
  const TIER_ORDER = ["S", "A", "B", "C", "D", "F", "Unranked"];

  const TIER_CLASS = {
    S: "s",
    A: "a",
    B: "b",
    C: "c",
    D: "d",
    F: "f",
    Unranked: "unranked",
  };

  const PARTY_COLORS = {
    DNC: "#2563eb",
    DEM: "#2563eb",
    DEMOCRAT: "#2563eb",
    DEMOCRATIC: "#2563eb",
    GOP: "#b91c1c",
    REP: "#b91c1c",
    REPUBLICAN: "#b91c1c",
    IND: "#7c3aed",
    INDEPENDENT: "#7c3aed",
    OTHER: "#64748b",
  };

  function getEl(selector) {
    return document.querySelector(selector);
  }

  function setText(selector, value) {
    const el = getEl(selector);
    if (el) el.textContent = value;
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

  function partyColor(value) {
    return PARTY_COLORS[normalizeParty(value)] || PARTY_COLORS.OTHER;
  }

  function presidentName(row) {
    return firstValue(row, ["president", "name", "full_name", "person", "officeholder", "winner"], "Unknown President");
  }

  function presidentNumber(row) {
    return toNumber(firstValue(row, ["number", "president_number", "no", "order", "num"], 0), 0);
  }

  function presidentParty(row) {
    return firstValue(row, ["party", "party_id", "president_party", "winner_party"], "OTHER");
  }

  function presidentTerm(row) {
    const direct = firstValue(row, ["term", "years", "term_years", "served", "dates"], "");
    if (direct) return direct;

    const start = firstValue(row, ["term_start", "start_year", "inauguration_year", "start"], "");
    const end = firstValue(row, ["term_end", "end_year", "left_office_year", "end"], "");

    if (start && end) return `${start}–${end}`;
    if (start) return `${start}–`;

    return "";
  }

  function presidentVP(row) {
    return firstValue(row, ["vice_president", "vp", "vice", "running_mate"], "");
  }

  function presidentTier(row) {
    const raw = firstValue(row, ["tier", "rank", "tier_rank", "legacy_tier", "ranking"], "");
    const upper = cleanCell(raw).toUpperCase();

    if (["S", "A", "B", "C", "D", "F"].includes(upper)) return upper;
    if (["UNRANKED", "NONE", "N/A", "-"].includes(upper)) return "Unranked";

    return "Unranked";
  }

  function presidentScore(row) {
    const direct = firstValue(row, ["score", "rating", "legacy_score", "tier_score", "ranking_score"], "");

    if (direct !== "") return toNumber(direct, 0);

    const fallbackScores = {
      S: 95,
      A: 85,
      B: 75,
      C: 65,
      D: 50,
      F: 30,
      Unranked: 0,
    };

    return fallbackScores[presidentTier(row)] || 0;
  }

  function presidentImage(row) {
    return firstValue(
      row,
      [
        "portrait_url",
        "portrait_url2",
        "portrait_url3",
        "portrait_url4",
        "photo",
        "image",
        "image_url",
        "portrait",
        "portrait2",
        "portrait3",
        "portrait4",
        "img",
        "picture"
      ],
      "./assets/img/president-placeholder.png"
    );
  }

  function presidentSummary(row) {
    return firstValue(
      row,
      ["summary", "legacy_summary", "description", "bio", "short_summary", "one_liner", "tagline"],
      "No presidential summary provided."
    );
  }

  function presidentAccomplishments(row) {
    return firstValue(row, ["accomplishments", "achievements", "major_actions", "top_actions", "actions"], "");
  }

  function presidentScandals(row) {
    return firstValue(row, ["scandals", "controversies", "failures", "crises"], "");
  }

  function presidentHomeState(row) {
    return firstValue(row, ["home_state", "state", "home"], "");
  }

  function presidentPreviousOffice(row) {
    return firstValue(row, ["previous_office", "previous_roles", "prior_office", "former_office"], "");
  }

  function stableId(row, index) {
    const slug = firstValue(row, ["slug", "id"], "");
    if (slug) return slug;

    const number = presidentNumber(row);
    const name = presidentName(row).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

    return number ? `${number}-${name}` : `${index}-${name}`;
  }

  function effectiveTier(president) {
    return PLAYER_TIERS[president._stableId] || president._tier || "Unranked";
  }

  function normalizePresident(row, index) {
    const tier = presidentTier(row);
    const score = presidentScore(row);
    const party = presidentParty(row);
    const id = stableId(row, index);

    return {
      ...row,
      _id: `president-${index}`,
      _stableId: id,
      _name: presidentName(row),
      _number: presidentNumber(row),
      _party: normalizeParty(party),
      _partyRaw: party,
      _partyColor: partyColor(party),
      _term: presidentTerm(row),
      _vp: presidentVP(row),
      _tier: tier,
      _score: score,
      _image: presidentImage(row),
      _summary: presidentSummary(row),
      _accomplishments: presidentAccomplishments(row),
      _scandals: presidentScandals(row),
      _homeState: presidentHomeState(row),
      _previousOffice: presidentPreviousOffice(row),
    };
  }

  function loadPlayerTiers() {
    try {
      PLAYER_TIERS = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {};
    } catch {
      PLAYER_TIERS = {};
    }
  }

  function savePlayerTiers() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(PLAYER_TIERS));
  }

  function populateFilters(presidents) {
    const partySelect = getEl("#tier-party-filter");

    if (!partySelect) return;

    const parties = Array.from(
      new Set(presidents.map((president) => president._party).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));

    partySelect.innerHTML = `
      <option value="all">All Parties</option>
      ${parties.map((party) => `
        <option value="${safeHTML(party)}">${safeHTML(party)}</option>
      `).join("")}
    `;
  }

  function presidentMatchesSearch(president, search) {
    if (!search) return true;

    const haystack = [
      president._name,
      president._party,
      president._term,
      president._vp,
      president._summary,
      president._accomplishments,
      president._scandals,
      president._homeState,
      president._previousOffice,
    ].map((value) => cleanCell(value).toLowerCase()).join(" ");

    return haystack.includes(search.toLowerCase());
  }

  function sortPresidents(presidents) {
    const sortMode = cleanCell(getEl("#tier-sort-filter")?.value || "tier");

    return [...presidents].sort((a, b) => {
      if (sortMode === "score-desc") return b._score - a._score;
      if (sortMode === "score-asc") return a._score - b._score;
      if (sortMode === "number") return a._number - b._number;
      if (sortMode === "name") return a._name.localeCompare(b._name);

      const tierA = TIER_ORDER.indexOf(effectiveTier(a));
      const tierB = TIER_ORDER.indexOf(effectiveTier(b));

      if (tierA !== tierB) return tierA - tierB;
      return b._score - a._score;
    });
  }

  function applyFilters() {
    const search = cleanCell(getEl("#tier-search")?.value || "");
    const party = cleanCell(getEl("#tier-party-filter")?.value || "all");
    const tier = cleanCell(getEl("#tier-rank-filter")?.value || "all");

    FILTERED_PRESIDENTS = ALL_PRESIDENTS.filter((president) => {
      if (!presidentMatchesSearch(president, search)) return false;
      if (party !== "all" && president._party !== party) return false;
      if (tier !== "all" && effectiveTier(president) !== tier) return false;

      return true;
    });

    FILTERED_PRESIDENTS = sortPresidents(FILTERED_PRESIDENTS);

    renderTierBoard();
    renderStats();
    renderFilterSummary();
  }

  function applyQuickFilter(type) {
    const tierSelect = getEl("#tier-rank-filter");
    const partySelect = getEl("#tier-party-filter");

    document.querySelectorAll("[data-tier-quick]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.tierQuick === type);
    });

    if (partySelect) partySelect.value = "all";

    if (type === "all") {
      if (tierSelect) tierSelect.value = "all";
    }

    if (type === "top") {
      if (tierSelect) tierSelect.value = "S";
    }

    if (type === "mid") {
      if (tierSelect) tierSelect.value = "B";
    }

    if (type === "low") {
      if (tierSelect) tierSelect.value = "D";
    }

    if (type === "unranked") {
      if (tierSelect) tierSelect.value = "Unranked";
    }

    applyFilters();
  }

  function renderStats() {
    const total = FILTERED_PRESIDENTS.length;
    const ranked = FILTERED_PRESIDENTS.filter((president) => effectiveTier(president) !== "Unranked").length;

    setText("#tier-total-count", total.toLocaleString());
    setText("#tier-ranked-count", ranked.toLocaleString());
  }

  function renderFilterSummary() {
    const title = getEl("#tier-filter-title");
    const summary = getEl("#tier-filter-summary");

    const party = cleanCell(getEl("#tier-party-filter")?.value || "all");
    const tier = cleanCell(getEl("#tier-rank-filter")?.value || "all");

    const parts = [];

    if (party !== "all") parts.push(party);
    if (tier !== "all") parts.push(`${tier} Tier`);

    if (title) title.textContent = parts.length ? parts.join(" • ") : "All Presidents";

    if (summary) {
      summary.textContent = `${FILTERED_PRESIDENTS.length.toLocaleString()} shown from ${ALL_PRESIDENTS.length.toLocaleString()} presidential records. Drag presidents between tiers to make your own ranking.`;
    }
  }

  function renderFeaturedPresident() {
    const featured = [...ALL_PRESIDENTS]
      .filter((president) => effectiveTier(president) !== "Unranked")
      .sort((a, b) => b._score - a._score || a._number - b._number)[0];

    if (!featured) {
      setText("#featured-president-title", "No ranked president");
      setText("#featured-president-summary", "Drag presidents into tiers to create a player ranking.");
      return;
    }

    setText("#featured-president-title", featured._name);
    setText("#featured-president-summary", `${effectiveTier(featured)} Tier • ${featured._score} score — ${featured._summary}`);
  }

  function presidentCardHTML(president) {
    return `
      <article
        class="president-card"
        data-president-id="${safeHTML(president._id)}"
        data-stable-id="${safeHTML(president._stableId)}"
        draggable="true"
        title="Drag to another tier"
      >
        <img
          src="${safeHTML(president._image)}"
          alt="${safeHTML(president._name)}"
          onerror="this.src='./assets/img/president-placeholder.png'"
        />

        <div class="president-card-body">
          <h4>${safeHTML(president._name)}</h4>
          <p>
            ${president._number ? `#${safeHTML(president._number)} • ` : ""}
            ${safeHTML(president._term || "Term unknown")}
          </p>

          <div class="president-meta-row">
            <span class="party-pill" style="border-color:${safeHTML(president._partyColor)}55;color:${safeHTML(president._partyColor)};">
              ${safeHTML(president._party)}
            </span>
            <span class="score-pill">${safeHTML(effectiveTier(president))}</span>
            <span class="score-pill">${safeHTML(president._score)}</span>
          </div>
        </div>
      </article>
    `;
  }

  function groupByTier(presidents) {
    const groups = {};

    TIER_ORDER.forEach((tier) => {
      groups[tier] = [];
    });

    presidents.forEach((president) => {
      const tier = TIER_ORDER.includes(effectiveTier(president)) ? effectiveTier(president) : "Unranked";
      groups[tier].push(president);
    });

    return groups;
  }

  function renderTierBoard() {
    const slot = getEl("#tier-board");

    if (!slot) return;

    if (!FILTERED_PRESIDENTS.length) {
      slot.innerHTML = `
        <div class="tier-empty">
          No presidents match the current filters.
        </div>
      `;
      return;
    }

    const groups = groupByTier(FILTERED_PRESIDENTS);

    slot.innerHTML = TIER_ORDER.map((tier) => {
      const presidents = groups[tier] || [];

      return `
        <section class="tier-row" data-tier-drop="${safeHTML(tier)}">
          <div class="tier-label ${safeHTML(TIER_CLASS[tier] || "unranked")}">
            ${safeHTML(tier)}
          </div>

          <div class="tier-content" data-tier-content="${safeHTML(tier)}">
            ${
              presidents.length
                ? presidents.map(presidentCardHTML).join("")
                : `<div class="tier-drop-empty">Drop presidents here</div>`
            }
          </div>
        </section>
      `;
    }).join("");

    bindCardClicks();
    bindDragDrop();
  }

  function bindCardClicks() {
    const slot = getEl("#tier-board");
    if (!slot) return;

    slot.querySelectorAll("[data-president-id]").forEach((card) => {
      card.addEventListener("click", () => {
        const id = card.dataset.presidentId;
        const selected = ALL_PRESIDENTS.find((president) => president._id === id);

        if (selected) renderPresidentDetail(selected);
      });
    });
  }

  function bindDragDrop() {
    const slot = getEl("#tier-board");
    if (!slot) return;

    slot.querySelectorAll(".president-card").forEach((card) => {
      card.addEventListener("dragstart", (event) => {
        event.dataTransfer.setData("text/plain", card.dataset.stableId);
        card.classList.add("is-dragging");
      });

      card.addEventListener("dragend", () => {
        card.classList.remove("is-dragging");
      });
    });

    slot.querySelectorAll("[data-tier-content]").forEach((dropZone) => {
      dropZone.addEventListener("dragover", (event) => {
        event.preventDefault();
        dropZone.classList.add("is-drop-target");
      });

      dropZone.addEventListener("dragleave", () => {
        dropZone.classList.remove("is-drop-target");
      });

      dropZone.addEventListener("drop", (event) => {
        event.preventDefault();

        const stableId = event.dataTransfer.getData("text/plain");
        const tier = dropZone.dataset.tierContent;

        if (!stableId || !tier) return;

        PLAYER_TIERS[stableId] = tier;
        savePlayerTiers();

        dropZone.classList.remove("is-drop-target");

        applyFilters();
        renderFeaturedPresident();
      });
    });
  }

  function detailRow(label, value) {
    if (!cleanCell(value)) return "";

    return `
      <div class="tier-detail-row">
        <strong>${safeHTML(label)}</strong>
        <span>${safeHTML(value)}</span>
      </div>
    `;
  }

  function renderPresidentDetail(president) {
    const slot = getEl("#president-tier-detail");

    if (!slot) return;

    slot.innerHTML = `
      <div class="eyebrow">Selected President</div>
      <h3>${safeHTML(president._name)}</h3>

      <p>
        <span class="party-pill" style="border-color:${safeHTML(president._partyColor)}55;color:${safeHTML(president._partyColor)};">
          ${safeHTML(president._party)}
        </span>
        <span class="score-pill">${safeHTML(effectiveTier(president))} Tier</span>
        <span class="score-pill">${safeHTML(president._score)} Score</span>
      </p>

      <p>${safeHTML(president._summary)}</p>

      <div class="tier-detail-grid">
        ${detailRow("Number", president._number ? `#${president._number}` : "")}
        ${detailRow("Term", president._term)}
        ${detailRow("Vice President", president._vp)}
        ${detailRow("Home State", president._homeState)}
        ${detailRow("Previous Office", president._previousOffice)}
        ${detailRow("Accomplishments", president._accomplishments)}
        ${detailRow("Scandals", president._scandals)}
      </div>
    `;
  }

  function resetPlayerTierList() {
    PLAYER_TIERS = {};
    savePlayerTiers();
    applyFilters();
    renderFeaturedPresident();
  }

  function addResetButton() {
    const toolbar = getEl(".tier-toolbar");
    if (!toolbar || getEl("#reset-player-tiers")) return;

    const button = document.createElement("button");
    button.id = "reset-player-tiers";
    button.className = "tier-chip";
    button.type = "button";
    button.textContent = "Reset Player Tiers";
    button.addEventListener("click", resetPlayerTierList);

    toolbar.appendChild(button);
  }

  function setupEvents() {
    getEl("#tier-search")?.addEventListener("input", applyFilters);
    getEl("#tier-party-filter")?.addEventListener("change", applyFilters);
    getEl("#tier-rank-filter")?.addEventListener("change", applyFilters);
    getEl("#tier-sort-filter")?.addEventListener("change", applyFilters);

    document.querySelectorAll("[data-tier-quick]").forEach((button) => {
      button.addEventListener("click", () => {
        applyQuickFilter(button.dataset.tierQuick || "all");
      });
    });

    addResetButton();
  }

  async function initTierList() {
    try {
      if (!fetchSheets) throw new Error("Sheet loader is unavailable.");

      loadPlayerTiers();

      const data = await fetchSheets(["WEB_POTUS"]);
      const rows = data.WEB_POTUS || [];

      ALL_PRESIDENTS = rows
        .map(normalizePresident)
        .filter((president) => president._name && president._name !== "Unknown President");

      FILTERED_PRESIDENTS = sortPresidents(ALL_PRESIDENTS);

      populateFilters(ALL_PRESIDENTS);
      renderFeaturedPresident();
      renderTierBoard();
      renderStats();
      renderFilterSummary();

      if (FILTERED_PRESIDENTS[0]) renderPresidentDetail(FILTERED_PRESIDENTS[0]);
    } catch (error) {
      console.error(error);

      const slot = getEl("#tier-board");
      if (slot) {
        slot.innerHTML = `
          <div class="tier-empty">
            President tier list failed to load: ${safeHTML(error.message)}
          </div>
        `;
      }
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    setupEvents();
    initTierList();
  });
})();