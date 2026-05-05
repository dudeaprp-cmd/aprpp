/* APRP Federal Archive — Hall of Presidents
   WEB_POTUS supports:
   A number
   B slug
   C full_name
   D party
   E term_start
   F term_end
   G vice_president
   H first_lady
   I portrait_url
   J tagline
   K dob
   L pob
   M home_state
   N education
   O previous_offices
   P key_events
   Q crises
   R actions
   S summary
   T portrait_url2
   U portrait_url3
   V portrait_url4
   W yearlysummary
*/

(function () {
  const APRP = window.APRP || {};
  const fetchSheets = APRP.fetchSheets;

  const cleanCell = APRP.cleanCell || ((value) => String(value ?? "").trim());

  const toNumber = APRP.toNumber || ((value, fallback = 0) => {
    const parsed = Number(
      String(value ?? "")
        .replace(/[$,%]/g, "")
        .replace(/,/g, "")
        .trim()
    );

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

  function markdownHTML(value) {
    return safeHTML(value).replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  }

  function normalizeKey(key) {
    return cleanCell(key).toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function rowValue(row, keys, fallback = "") {
    if (!row) return fallback;

    const wanted = keys.map(normalizeKey);

    for (const key of Object.keys(row)) {
      if (wanted.includes(normalizeKey(key))) {
        const value = cleanCell(row[key]);
        if (value) return value;
      }
    }

    return fallback;
  }

  function rowColumn(row, index, fallback = "") {
    if (!row) return fallback;

    if (Array.isArray(row)) {
      return cleanCell(row[index]) || fallback;
    }

    const values = Object.values(row);
    return cleanCell(values[index]) || fallback;
  }

  let ALL_PRESIDENTS = [];
  let FILTERED_PRESIDENTS = [];

  const PARTY_COLORS = {
    DNC: "#2563eb",
    DEMOCRATIC: "#2563eb",
    DEMOCRAT: "#2563eb",
    DEM: "#2563eb",
    DEMOCRATICPARTY: "#2563eb",
    GOP: "#b91c1c",
    REPUBLICAN: "#b91c1c",
    REP: "#b91c1c",
    REPUBLICANPARTY: "#b91c1c",
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

  function normalizeParty(value) {
    const raw = normalizeKey(value).toUpperCase();

    if (["D", "DEM", "DEMOCRAT", "DEMOCRATIC", "DNC", "DEMOCRATICPARTY"].includes(raw)) return "DNC";
    if (["R", "REP", "REPUBLICAN", "GOP", "REPUBLICANPARTY"].includes(raw)) return "GOP";
    if (["I", "IND", "INDEPENDENT"].includes(raw)) return "IND";

    return raw || "OTHER";
  }

  function partyColor(value) {
    return PARTY_COLORS[normalizeParty(value)] || PARTY_COLORS.OTHER;
  }

  function presidentName(row) {
    return rowValue(row, ["full_name", "president", "name", "person", "officeholder"], rowColumn(row, 2, "Unknown President"));
  }

  function presidentNumber(row) {
    return toNumber(rowValue(row, ["number", "president_number", "no", "order", "num"], rowColumn(row, 0, 0)), 0);
  }

  function presidentParty(row) {
    return rowValue(row, ["party", "party_id", "president_party", "winner_party"], rowColumn(row, 3, "OTHER"));
  }

  function presidentPhoto(row) {
    return rowValue(row, ["portrait_url", "photo", "image", "image_url", "portrait", "img", "picture"], rowColumn(row, 8, "./assets/img/president-placeholder.png"));
  }

  function presidentExtraPhotos(row) {
    return [
      rowValue(row, ["portrait_url2", "portrait_2", "photo_2", "image_2"], rowColumn(row, 19, "")),
      rowValue(row, ["portrait_url3", "portrait_3", "photo_3", "image_3"], rowColumn(row, 20, "")),
      rowValue(row, ["portrait_url4", "portrait_4", "photo_4", "image_4"], rowColumn(row, 21, "")),
    ].map(cleanCell).filter(Boolean);
  }

  function allPresidentPhotos(row) {
    return [presidentPhoto(row), ...presidentExtraPhotos(row)]
      .map(cleanCell)
      .filter(Boolean)
      .filter((url, index, arr) => arr.indexOf(url) === index);
  }

  function presidentTerm(row) {
    const start = rowValue(row, ["term_start", "start_year", "inauguration_year", "start"], rowColumn(row, 4, ""));
    const end = rowValue(row, ["term_end", "end_year", "left_office_year", "end"], rowColumn(row, 5, ""));
    const direct = rowValue(row, ["term", "years", "term_years", "served", "dates"], "");

    if (direct) return direct;
    if (start && end) return `${start}–${end}`;
    if (start) return `${start}–`;

    return "";
  }

  function presidentStartYear(row) {
    const value = rowValue(row, ["term_start", "start_year", "inauguration_year", "start"], rowColumn(row, 4, ""));
    const match = cleanCell(value || presidentTerm(row)).match(/\b(19|20)\d{2}\b/);
    return match ? toNumber(match[0], 0) : 0;
  }

  function presidentEndYear(row) {
    const value = rowValue(row, ["term_end", "end_year", "left_office_year", "end"], rowColumn(row, 5, ""));
    const match = cleanCell(value).match(/\b(19|20)\d{2}\b/);

    if (match) return toNumber(match[0], 0);

    const years = presidentTerm(row).match(/\b(19|20)\d{2}\b/g);
    return years && years[1] ? toNumber(years[1], 0) : presidentStartYear(row);
  }

  function presidentVP(row) {
    return rowValue(row, ["vice_president", "vp", "vice", "running_mate"], rowColumn(row, 6, ""));
  }

  function presidentFirstLady(row) {
    return rowValue(row, ["first_lady", "flotus", "spouse"], rowColumn(row, 7, ""));
  }

  function presidentHomeState(row) {
    return rowValue(row, ["home_state", "state", "home"], rowColumn(row, 12, ""));
  }

  function presidentPreviousOffice(row) {
    return rowValue(row, ["previous_offices", "previous_office", "previous_roles", "prior_office", "former_office"], rowColumn(row, 14, ""));
  }

  function presidentEducation(row) {
    return rowValue(row, ["education", "school", "college", "university"], rowColumn(row, 13, ""));
  }

  function presidentDOB(row) {
    return rowValue(row, ["dob", "date_of_birth", "birthdate"], rowColumn(row, 10, ""));
  }

  function presidentPOB(row) {
    return rowValue(row, ["pob", "place_of_birth", "birthplace"], rowColumn(row, 11, ""));
  }

  function presidentTagline(row) {
    return rowValue(row, ["tagline", "one_liner", "short_line", "legacy_line"], rowColumn(row, 9, ""));
  }

  function presidentSummary(row) {
    return rowValue(row, ["summary", "legacy_summary", "description", "bio", "short_summary"], rowColumn(row, 18, "No presidential summary provided."));
  }

  function presidentYearSummary(row) {
    return rowValue(row, ["yearlysummary", "yearly_summary", "year_summary", "year_by_year", "annual_summary"], rowColumn(row, 22, ""));
  }

  function presidentActions(row) {
    return rowValue(row, ["actions", "top_actions", "major_actions", "accomplishments", "achievements"], rowColumn(row, 17, ""));
  }

  function presidentScandals(row) {
    return rowValue(row, ["scandals", "controversies", "failures"], "");
  }

  function presidentCrises(row) {
    return rowValue(row, ["crises", "crisis", "key_crises", "major_crisis"], rowColumn(row, 16, ""));
  }

  function presidentLink(row) {
    return rowValue(row, ["link", "url", "doc", "document", "source"], "");
  }

  function splitList(value) {
    return cleanCell(value)
      .split(/\n|;|\|/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function normalizePresident(row, index) {
    const party = presidentParty(row);
    const photos = allPresidentPhotos(row);

    return {
      ...row,
      _id: `president-${index}`,
      _name: presidentName(row),
      _number: presidentNumber(row),
      _party: normalizeParty(party),
      _partyRaw: party,
      _partyColor: partyColor(party),
      _photo: photos[0] || "./assets/img/president-placeholder.png",
      _photos: photos.length ? photos : ["./assets/img/president-placeholder.png"],
      _term: presidentTerm(row),
      _startYear: presidentStartYear(row),
      _endYear: presidentEndYear(row),
      _vp: presidentVP(row),
      _firstLady: presidentFirstLady(row),
      _homeState: presidentHomeState(row),
      _previousOffice: presidentPreviousOffice(row),
      _education: presidentEducation(row),
      _dob: presidentDOB(row),
      _pob: presidentPOB(row),
      _tagline: presidentTagline(row),
      _summary: presidentSummary(row),
      _yearSummary: presidentYearSummary(row),
      _actions: presidentActions(row),
      _scandals: presidentScandals(row),
      _crises: presidentCrises(row),
      _link: presidentLink(row),
    };
  }

  function injectPresidentCSS() {
    if (document.querySelector("#aprp-president-gallery-style")) return;

    const style = document.createElement("style");
    style.id = "aprp-president-gallery-style";
    style.textContent = `
      .president-record {
        grid-template-columns: 320px minmax(0, 1fr) !important;
        align-items: start !important;
      }

      .president-left-column {
        display: grid !important;
        gap: 16px !important;
        align-self: start !important;
        min-width: 0 !important;
      }

      .president-portrait-panel {
        position: relative !important;
        display: block !important;
        width: 100% !important;
        aspect-ratio: 1 / 1 !important;
        min-height: 0 !important;
        height: auto !important;
        overflow: hidden !important;
        align-self: start !important;
        background: #d8dee8 !important;
      }

      .president-main-photo-wrap {
        position: absolute !important;
        inset: 0 !important;
        width: 100% !important;
        height: 100% !important;
        overflow: hidden !important;
      }

      .president-main-photo {
        position: absolute !important;
        inset: 0 !important;
        width: 100% !important;
        height: 100% !important;
        min-height: 0 !important;
        max-height: none !important;
        object-fit: cover !important;
        object-position: center top !important;
        display: block !important;
      }

      .president-number-badge {
        z-index: 8 !important;
      }

      .president-party-band {
        z-index: 7 !important;
        padding-bottom: 76px !important;
      }

      .president-gallery-strip {
        position: absolute !important;
        left: 12px !important;
        right: 12px !important;
        bottom: 12px !important;
        z-index: 10 !important;
        display: flex !important;
        gap: 8px !important;
        padding: 8px !important;
        border-radius: 14px !important;
        background: rgba(7,17,31,.82) !important;
        border: 1px solid rgba(255,255,255,.18) !important;
        backdrop-filter: blur(8px) !important;
        overflow-x: auto !important;
      }

      .president-gallery-thumb {
        flex: 0 0 52px !important;
        width: 52px !important;
        height: 52px !important;
        min-width: 52px !important;
        max-width: 52px !important;
        min-height: 52px !important;
        max-height: 52px !important;
        display: block !important;
        border: 1px solid rgba(255,255,255,.30) !important;
        border-radius: 11px !important;
        overflow: hidden !important;
        background: rgba(255,255,255,.10) !important;
        cursor: pointer !important;
        padding: 0 !important;
      }

      .president-gallery-thumb-img {
        width: 52px !important;
        height: 52px !important;
        min-width: 52px !important;
        min-height: 52px !important;
        max-width: 52px !important;
        max-height: 52px !important;
        object-fit: cover !important;
        object-position: center top !important;
        display: block !important;
      }

      .president-gallery-thumb.is-active {
        outline: 2px solid #93c5fd !important;
        outline-offset: 1px !important;
      }

      .president-year-summary-box {
        padding: 16px !important;
        border-radius: 18px !important;
        background: rgba(255,255,255,.92) !important;
        border: 1px solid rgba(15,23,42,.12) !important;
        box-shadow: 0 12px 30px rgba(15,23,42,.08) !important;
      }

      .president-year-summary-box h4 {
        margin: 0 0 10px !important;
        font-family: Georgia, serif !important;
        font-size: 1.05rem !important;
        color: #111827 !important;
      }

      .president-year-summary-box ul {
        margin: 0 !important;
        padding-left: 18px !important;
        color: #64748b !important;
        font-size: .9rem !important;
        line-height: 1.45 !important;
      }

      .president-year-summary-box li + li {
        margin-top: 7px !important;
      }

      .president-summary-box p strong,
      .president-list-box li strong,
      .president-tagline strong,
      .selected-president-card p strong,
      .president-year-summary-box strong {
        font-weight: 950;
        color: inherit;
      }

      .selected-president-gallery {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 7px;
        margin-top: 12px;
      }

      .selected-president-gallery img {
        width: 100%;
        aspect-ratio: 1 / 1;
        object-fit: cover;
        object-position: center top;
        border-radius: 10px;
        border: 1px solid rgba(255,255,255,.14);
      }

      @media (max-width: 860px) {
        .president-record {
          grid-template-columns: 1fr !important;
        }

        .president-portrait-panel {
          aspect-ratio: 1 / 1 !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function populateFilters(presidents) {
    const partySelect = getEl("#presidents-party-filter");
    const yearSelect = getEl("#presidents-year-filter");

    const parties = Array.from(new Set(presidents.map((p) => p._party).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b));

    const years = Array.from(new Set(
      presidents.flatMap((p) => {
        const years = [];
        if (p._startYear) years.push(String(p._startYear));
        if (p._endYear && p._endYear !== p._startYear) years.push(String(p._endYear));
        return years;
      })
    )).sort((a, b) => toNumber(b, 0) - toNumber(a, 0));

    if (partySelect) {
      partySelect.innerHTML = `
        <option value="all">All Parties</option>
        ${parties.map((party) => `<option value="${safeHTML(party)}">${safeHTML(party)}</option>`).join("")}
      `;
    }

    if (yearSelect) {
      yearSelect.innerHTML = `
        <option value="all">All Years</option>
        ${years.map((year) => `<option value="${safeHTML(year)}">${safeHTML(year)}</option>`).join("")}
      `;
    }
  }

  function presidentMatchesSearch(president, search) {
    if (!search) return true;

    const haystack = [
      president._name,
      president._party,
      president._term,
      president._vp,
      president._firstLady,
      president._homeState,
      president._previousOffice,
      president._education,
      president._tagline,
      president._summary,
      president._yearSummary,
      president._actions,
      president._scandals,
      president._crises,
    ].map((value) => cleanCell(value).toLowerCase()).join(" ");

    return haystack.includes(search.toLowerCase());
  }

  function presidentMatchesYear(president, year) {
    if (year === "all") return true;

    const y = toNumber(year, 0);
    const start = president._startYear || 0;
    const end = president._endYear || start;

    return y >= start && y <= end;
  }

  function sortPresidents(presidents) {
    const sort = cleanCell(getEl("#presidents-sort-filter")?.value || "number-desc");

    return [...presidents].sort((a, b) => {
      if (sort === "number-asc") return a._number - b._number;
      if (sort === "name") return a._name.localeCompare(b._name);
      if (sort === "party") return a._party.localeCompare(b._party) || a._number - b._number;

      return b._number - a._number;
    });
  }

  function applyFilters() {
    const search = cleanCell(getEl("#presidents-search")?.value || "");
    const party = cleanCell(getEl("#presidents-party-filter")?.value || "all");
    const year = cleanCell(getEl("#presidents-year-filter")?.value || "all");

    FILTERED_PRESIDENTS = ALL_PRESIDENTS.filter((president) => {
      if (!presidentMatchesSearch(president, search)) return false;
      if (party !== "all" && president._party !== party) return false;
      if (!presidentMatchesYear(president, year)) return false;
      return true;
    });

    FILTERED_PRESIDENTS = sortPresidents(FILTERED_PRESIDENTS);

    renderPresidents();
    renderStats();
    renderFilterSummary();
  }

  function applyQuickFilter(type) {
    const partySelect = getEl("#presidents-party-filter");
    const search = getEl("#presidents-search");

    document.querySelectorAll("[data-president-quick]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.presidentQuick === type);
    });

    if (partySelect) partySelect.value = "all";
    if (search) search.value = "";

    if (type === "dnc" && partySelect) partySelect.value = "DNC";
    if (type === "gop" && partySelect) partySelect.value = "GOP";
    if (type === "crisis" && search) search.value = "crisis";
    if (type === "scandal" && search) search.value = "scandal";

    applyFilters();
  }

  function renderStats() {
    const parties = new Set(FILTERED_PRESIDENTS.map((p) => p._party).filter(Boolean));

    setText("#presidents-total-count", FILTERED_PRESIDENTS.length.toLocaleString());
    setText("#presidents-party-count", parties.size.toLocaleString());
  }

  function renderFilterSummary() {
    const title = getEl("#presidents-filter-title");
    const summary = getEl("#presidents-filter-summary");

    const party = cleanCell(getEl("#presidents-party-filter")?.value || "all");
    const year = cleanCell(getEl("#presidents-year-filter")?.value || "all");

    const parts = [];

    if (party !== "all") parts.push(party);
    if (year !== "all") parts.push(year);

    if (title) title.textContent = parts.length ? parts.join(" • ") : "All Presidents";
    if (summary) {
      summary.textContent = `${FILTERED_PRESIDENTS.length.toLocaleString()} shown from ${ALL_PRESIDENTS.length.toLocaleString()} presidential records.`;
    }
  }

  function partyPill(president) {
    return `
      <span style="background:${safeHTML(president._partyColor)}22;border-color:${safeHTML(president._partyColor)}55;color:${safeHTML(president._partyColor)};">
        ${safeHTML(president._party)}
      </span>
    `;
  }

  function infoTile(label, value) {
    if (!cleanCell(value)) return "";

    return `
      <div class="president-info-tile">
        <strong>${safeHTML(label)}</strong>
        <span>${markdownHTML(value)}</span>
      </div>
    `;
  }

  function listBox(title, value, fallback) {
    const items = splitList(value);

    return `
      <div class="president-list-box">
        <h4>${safeHTML(title)}</h4>
        ${
          items.length
            ? `<ul>${items.map((item) => `<li>${markdownHTML(item)}</li>`).join("")}</ul>`
            : `<p class="text-small">${markdownHTML(fallback)}</p>`
        }
      </div>
    `;
  }

  function yearSummaryBox(president) {
    const items = splitList(president._yearSummary);

    if (!items.length) return "";

    return `
      <div class="president-year-summary-box">
        <h4>Year-by-Year Summary</h4>
        <ul>
          ${items.map((item) => `<li>${markdownHTML(item)}</li>`).join("")}
        </ul>
      </div>
    `;
  }

  function numberSuffix(number) {
    const n = Number(number);
    if (!Number.isFinite(n)) return "";

    const lastTwo = n % 100;
    if (lastTwo >= 11 && lastTwo <= 13) return "th";

    const last = n % 10;
    if (last === 1) return "st";
    if (last === 2) return "nd";
    if (last === 3) return "rd";

    return "th";
  }

  function photoGalleryHTML(president) {
    const photos = president._photos || [];

    if (photos.length <= 1) return "";

    return `
      <div class="president-gallery-strip">
        ${photos.slice(0, 4).map((url, index) => `
          <button
            class="president-gallery-thumb ${index === 0 ? "is-active" : ""}"
            type="button"
            data-gallery-president="${safeHTML(president._id)}"
            data-gallery-image="${safeHTML(url)}"
            aria-label="Show image ${index + 1} for ${safeHTML(president._name)}"
          >
            <img
              class="president-gallery-thumb-img"
              src="${safeHTML(url)}"
              alt="${safeHTML(president._name)} image ${index + 1}"
              onerror="this.src='./assets/img/president-placeholder.png'"
            />
          </button>
        `).join("")}
      </div>
    `;
  }

  function presidentRecordHTML(president) {
    return `
      <article class="president-record" data-president-id="${safeHTML(president._id)}">
        <div class="president-left-column">
          <div class="president-portrait-panel">
            <div class="president-main-photo-wrap">
              <img
                class="president-main-photo"
                id="main-photo-${safeHTML(president._id)}"
                src="${safeHTML(president._photo)}"
                alt="${safeHTML(president._name)}"
                onerror="this.src='./assets/img/president-placeholder.png'"
              />
              <div class="president-number-badge">
                ${president._number ? `#${safeHTML(president._number)}` : "—"}
              </div>
              <div class="president-party-band">
                <strong>Party</strong>
                ${partyPill(president)}
              </div>
            </div>

            ${photoGalleryHTML(president)}
          </div>

          ${yearSummaryBox(president)}
        </div>

        <div class="president-info-panel">
          <div>
            <div class="president-kicker">
              ${president._number ? `${safeHTML(president._number)}${numberSuffix(president._number)} President` : "President"}
            </div>
            <h2>${safeHTML(president._name)}</h2>
            <p class="president-tagline">${markdownHTML(president._tagline || president._summary)}</p>
          </div>

          <div class="president-info-grid">
            ${infoTile("Term", president._term)}
            ${infoTile("Vice President", president._vp)}
            ${infoTile("First Lady", president._firstLady)}
            ${infoTile("Home State", president._homeState)}
            ${infoTile("Previous Office", president._previousOffice)}
            ${infoTile("Education", president._education)}
            ${infoTile("Born", president._dob)}
            ${infoTile("Birthplace", president._pob)}
          </div>

          <div class="president-summary-box">
            <strong>Administration Summary</strong>
            <p>${markdownHTML(president._summary)}</p>
          </div>

          <div class="president-lists">
            ${listBox("Top Actions", president._actions, "No major actions listed.")}
            ${listBox("Crises / Scandals", [president._crises, president._scandals].filter(Boolean).join("; "), "No crises or scandals listed.")}
          </div>

          <div class="president-actions">
            <button type="button" data-select-president="${safeHTML(president._id)}">Preview Record</button>
            ${president._link ? `<a href="${safeHTML(president._link)}" target="_blank" rel="noopener">Open Source</a>` : ""}
          </div>
        </div>
      </article>
    `;
  }

  function bindGalleryButtons() {
    document.querySelectorAll("[data-gallery-president]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();

        const presidentId = button.dataset.galleryPresident;
        const imageUrl = button.dataset.galleryImage;
        const mainPhoto = getEl(`#main-photo-${CSS.escape(presidentId)}`);

        if (mainPhoto && imageUrl) {
          mainPhoto.src = imageUrl;
        }

        document.querySelectorAll(`[data-gallery-president="${CSS.escape(presidentId)}"]`).forEach((thumb) => {
          thumb.classList.toggle("is-active", thumb === button);
        });
      });
    });
  }

  function renderPresidents() {
    const slot = getEl("#presidents-list");

    if (!slot) return;

    if (!FILTERED_PRESIDENTS.length) {
      slot.innerHTML = `<div class="presidents-empty">No presidents match the current filters.</div>`;
      return;
    }

    slot.innerHTML = FILTERED_PRESIDENTS.map(presidentRecordHTML).join("");

    slot.querySelectorAll("[data-president-id]").forEach((card) => {
      card.addEventListener("click", (event) => {
        if (event.target.closest("a") || event.target.closest("button")) return;

        const id = card.dataset.presidentId;
        const selected = ALL_PRESIDENTS.find((president) => president._id === id);

        if (selected) renderSelectedPresident(selected);
      });
    });

    slot.querySelectorAll("[data-select-president]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();

        const id = button.dataset.selectPresident;
        const selected = ALL_PRESIDENTS.find((president) => president._id === id);

        if (selected) renderSelectedPresident(selected);
      });
    });

    bindGalleryButtons();
  }

  function selectedDetailRow(label, value) {
    if (!cleanCell(value)) return "";

    return `
      <div class="selected-detail-row">
        <strong>${safeHTML(label)}</strong>
        <span>${markdownHTML(value)}</span>
      </div>
    `;
  }

  function selectedGalleryHTML(president) {
    const photos = president._photos || [];

    if (photos.length <= 1) return "";

    return `
      <div class="selected-president-gallery">
        ${photos.slice(0, 4).map((url, index) => `
          <img
            src="${safeHTML(url)}"
            alt="${safeHTML(president._name)} image ${index + 1}"
            onerror="this.src='./assets/img/president-placeholder.png'"
          />
        `).join("")}
      </div>
    `;
  }

  function renderSelectedPresident(president) {
    const slot = getEl("#selected-president");

    if (!slot) return;

    slot.innerHTML = `
      <div class="eyebrow">Selected President</div>
      <h3>${safeHTML(president._name)}</h3>
      <p>${markdownHTML(president._summary)}</p>

      ${selectedGalleryHTML(president)}

      <div class="selected-detail-grid">
        ${selectedDetailRow("Number", president._number ? `#${president._number}` : "")}
        ${selectedDetailRow("Party", president._party)}
        ${selectedDetailRow("Term", president._term)}
        ${selectedDetailRow("VP", president._vp)}
        ${selectedDetailRow("First Lady", president._firstLady)}
        ${selectedDetailRow("Home State", president._homeState)}
        ${selectedDetailRow("Previous", president._previousOffice)}
        ${selectedDetailRow("Education", president._education)}
        ${selectedDetailRow("Born", president._dob)}
        ${selectedDetailRow("Birthplace", president._pob)}
      </div>
    `;
  }

  function setupEvents() {
    getEl("#presidents-search")?.addEventListener("input", applyFilters);
    getEl("#presidents-party-filter")?.addEventListener("change", applyFilters);
    getEl("#presidents-year-filter")?.addEventListener("change", applyFilters);
    getEl("#presidents-sort-filter")?.addEventListener("change", applyFilters);

    document.querySelectorAll("[data-president-quick]").forEach((button) => {
      button.addEventListener("click", () => {
        applyQuickFilter(button.dataset.presidentQuick || "all");
      });
    });
  }

  async function initPresidents() {
    try {
      injectPresidentCSS();

      if (!fetchSheets) {
        throw new Error("Sheet loader is unavailable.");
      }

      const data = await fetchSheets(["WEB_POTUS"]);
      const rows = data.WEB_POTUS || [];

      ALL_PRESIDENTS = rows
        .map(normalizePresident)
        .filter((president) => president._name && president._name !== "Unknown President");

      FILTERED_PRESIDENTS = sortPresidents(ALL_PRESIDENTS);

      populateFilters(ALL_PRESIDENTS);
      renderPresidents();
      renderStats();
      renderFilterSummary();

      if (FILTERED_PRESIDENTS[0]) {
        renderSelectedPresident(FILTERED_PRESIDENTS[0]);
      }
    } catch (error) {
      console.error(error);

      const slot = getEl("#presidents-list");
      if (slot) {
        slot.innerHTML = `
          <div class="presidents-empty">
            Hall of Presidents failed to load: ${safeHTML(error.message)}
          </div>
        `;
      }
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    setupEvents();
    initPresidents();
  });
})();
