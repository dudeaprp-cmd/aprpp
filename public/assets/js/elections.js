/* APRP Federal Archive — Election Hall
   Full resilient rewrite.
   Reads:
   - WEB_POTUSELECTION
   - WEB_CONGRESSELECTION
*/

(function () {
  "use strict";

  const STATE = {
    potus: [],
    congress: [],
    all: [],
    filtered: [],
    quick: "all"
  };

  const PARTY_COLORS = {
    DNC: "#2563eb",
    DEM: "#2563eb",
    DEMOCRAT: "#2563eb",
    DEMOCRATIC: "#2563eb",
    GOP: "#dc2626",
    REP: "#dc2626",
    REPUBLICAN: "#dc2626",
    IND: "#7c3aed",
    INDEPENDENT: "#7c3aed",
    OTHER: "#64748b",
    SPLIT: "#7c3aed",
    DIVIDED: "#7c3aed",
    VACANT: "#94a3b8"
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function clean(value) {
    return String(value ?? "").trim();
  }

  function safeHTML(value) {
    return clean(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function toNumber(value, fallback = 0) {
    if (value === null || value === undefined || value === "") return fallback;

    const raw = String(value).trim();
    const match = raw.match(/-?\d[\d,]*(?:\.\d+)?/);

    if (!match) return fallback;

    const parsed = Number(match[0].replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function formatNumber(value) {
    const num = toNumber(value, NaN);
    if (!Number.isFinite(num)) return "—";
    return new Intl.NumberFormat("en-US").format(num);
  }

  function percent(value, total) {
    if (!total) return "0.0";
    return ((value / total) * 100).toFixed(1);
  }

  function firstValue(row, keys, fallback = "") {
    for (const key of keys) {
      const value = clean(row?.[key]);
      if (value !== "") return value;
    }

    return fallback;
  }

  function normalizeParty(value) {
    const raw = clean(value).toUpperCase();

    if (["D", "DEM", "DEMOCRAT", "DEMOCRATIC", "DNC", "LEFT"].includes(raw)) return "DNC";
    if (["R", "REP", "REPUBLICAN", "GOP", "RIGHT"].includes(raw)) return "GOP";
    if (["I", "IND", "INDEPENDENT"].includes(raw)) return "IND";
    if (["VACANT", "VAC"].includes(raw)) return "VACANT";
    if (["SPLIT", "TIE", "DIVIDED", "MIXED"].includes(raw)) return "SPLIT";

    return raw || "OTHER";
  }

  function partyColor(party) {
    return PARTY_COLORS[normalizeParty(party)] || PARTY_COLORS.OTHER;
  }

  function partyBadge(party) {
    const normalized = normalizeParty(party);
    const color = partyColor(normalized);

    return `
      <span class="election-party-badge" style="--party-color:${safeHTML(color)};">
        ${safeHTML(normalized)}
      </span>
    `;
  }

  async function loadSheet(sheetName) {
    if (window.APRP && typeof window.APRP.fetchSheet === "function") {
      return window.APRP.fetchSheet(sheetName);
    }

    if (window.APRP && typeof window.APRP.loadSheet === "function") {
      return window.APRP.loadSheet(sheetName);
    }

    if (window.APRP_SHEETS && typeof window.APRP_SHEETS.loadSheet === "function") {
      return window.APRP_SHEETS.loadSheet(sheetName);
    }

    throw new Error("No sheet loader found. Check public/assets/js/sheets.js loads before elections.js.");
  }

  async function loadSheets(sheetNames) {
    if (window.APRP && typeof window.APRP.fetchSheets === "function") {
      return window.APRP.fetchSheets(sheetNames);
    }

    if (window.APRP && typeof window.APRP.loadSheets === "function") {
      return window.APRP.loadSheets(sheetNames);
    }

    if (window.APRP_SHEETS && typeof window.APRP_SHEETS.loadSheets === "function") {
      return window.APRP_SHEETS.loadSheets(sheetNames);
    }

    const entries = await Promise.all(
      sheetNames.map(async (sheetName) => {
        const rows = await loadSheet(sheetName);
        return [sheetName, rows];
      })
    );

    return Object.fromEntries(entries);
  }

  function looksLikeImage(url) {
    const value = clean(url).toLowerCase();

    return (
      value.endsWith(".png") ||
      value.endsWith(".jpg") ||
      value.endsWith(".jpeg") ||
      value.endsWith(".webp") ||
      value.endsWith(".gif") ||
      value.includes("i.postimg.cc") ||
      value.includes("postimg.cc") ||
      value.includes("imgur.com") ||
      value.includes("cdn.discordapp.com") ||
      value.includes("media.discordapp.net") ||
      value.includes("kommodo.ai/i/")
    );
  }

  function resolveCongressWinnerParty(houseControl, senateControl) {
    const house = normalizeParty(houseControl);
    const senate = normalizeParty(senateControl);

    if (house === senate && house !== "OTHER") return house;
    if (house === "SPLIT" || senate === "SPLIT") return "SPLIT";

    const validHouse = ["DNC", "GOP", "IND"].includes(house);
    const validSenate = ["DNC", "GOP", "IND"].includes(senate);

    if (validHouse && validSenate && house !== senate) return "SPLIT";
    if (house === "DNC" || senate === "DNC") return "DNC";
    if (house === "GOP" || senate === "GOP") return "GOP";

    return "SPLIT";
  }

  function normalizePotus(row, index) {
    const year = firstValue(row, ["year", "election_year", "cycle"], "");
    const electionType = firstValue(row, ["election_type", "type"], "Presidential Election");
    const title = firstValue(row, ["title", "name"], year ? `${year} Presidential Election` : "Presidential Election");
    const winner = firstValue(row, ["winner", "winning_candidate", "president"], "");
    const winnerParty = normalizeParty(firstValue(row, ["winner_party", "party", "winning_party"], ""));

    const dncEv = toNumber(firstValue(row, ["dnc_ev", "dem_ev", "left_ev"], 0), 0);
    const gopEv = toNumber(firstValue(row, ["gop_ev", "rep_ev", "right_ev"], 0), 0);
    const otherEv = toNumber(firstValue(row, ["other_ev", "ind_ev"], 0), 0);
    const totalEv = dncEv + gopEv + otherEv;

    const dncPopular = toNumber(firstValue(row, ["dnc_popular", "dem_popular", "left_popular", "dnc_votes"], 0), 0);
    const gopPopular = toNumber(firstValue(row, ["gop_popular", "rep_popular", "right_popular", "gop_votes"], 0), 0);
    const otherPopular = toNumber(firstValue(row, ["other_popular", "ind_popular", "other_votes"], 0), 0);
    const totalPopular = dncPopular + gopPopular + otherPopular;

    const mapLink = firstValue(row, ["map_link", "map_url", "map", "source", "url"], "");

    const record = {
      ...row,
      _id: `potus-${index}`,
      _type: "POTUS",
      _label: "Presidential",
      _year: year,
      _yearNumber: toNumber(year, 0),
      _cycle: electionType,
      _title: title,
      _winner: winner,
      _winnerParty: winnerParty,
      _winnerColor: partyColor(winnerParty),

      _dncCandidate: firstValue(row, ["dnc_candidate", "dem_candidate", "democrat", "left_candidate"], ""),
      _gopCandidate: firstValue(row, ["gop_candidate", "rep_candidate", "republican", "right_candidate"], ""),
      _otherCandidate: firstValue(row, ["other_candidate", "ind_candidate", "independent"], ""),

      _dncEv: dncEv,
      _gopEv: gopEv,
      _otherEv: otherEv,
      _totalEv: totalEv,

      _dncPopular: dncPopular,
      _gopPopular: gopPopular,
      _otherPopular: otherPopular,
      _totalPopular: totalPopular,

      _summary: firstValue(row, ["summary", "description", "notes", "overview"], "No presidential election summary provided."),
      _mapLink: mapLink,
      _mapIsImage: looksLikeImage(mapLink)
    };

    record._search = buildSearch(record);
    return record;
  }

  function normalizeCongress(row, index) {
    const year = firstValue(row, ["year", "election_year", "cycle_year"], "");
    const cycle = firstValue(row, ["cycle", "election_type", "type"], "Congressional Election");

    const houseDnc = toNumber(firstValue(row, ["house_dnc", "dnc_house", "dem_house"], 0), 0);
    const houseGop = toNumber(firstValue(row, ["house_gop", "gop_house", "rep_house"], 0), 0);
    const houseInd = toNumber(firstValue(row, ["house_ind", "house_other", "other_house", "ind_house"], 0), 0);
    const houseVacant = toNumber(firstValue(row, ["house_vacant", "vacant_house"], 0), 0);

    const senateDnc = toNumber(firstValue(row, ["senate_dnc", "dnc_senate", "sen_dnc", "dem_senate"], 0), 0);
    const senateGop = toNumber(firstValue(row, ["senate_gop", "gop_senate", "sen_gop", "rep_senate"], 0), 0);
    const senateInd = toNumber(firstValue(row, ["senate_ind", "senate_other", "other_senate", "ind_senate"], 0), 0);
    const senateVacant = toNumber(firstValue(row, ["senate_vacant", "vacant_senate"], 0), 0);

    const houseControl = normalizeParty(firstValue(row, ["house_control", "house_winner"], ""));
    const senateControl = normalizeParty(firstValue(row, ["senate_control", "senate_winner"], ""));
    const winnerParty = resolveCongressWinnerParty(houseControl, senateControl);

    const record = {
      ...row,
      _id: `congress-${index}`,
      _type: "CONGRESS",
      _label: "Congressional",
      _year: year,
      _yearNumber: toNumber(year, 0),
      _cycle: cycle,
      _title: firstValue(row, ["title", "name"], `${year} ${cycle}`),
      _winner: `House: ${houseControl} / Senate: ${senateControl}`,
      _winnerParty: winnerParty,
      _winnerColor: partyColor(winnerParty),

      _houseDnc: houseDnc,
      _houseGop: houseGop,
      _houseInd: houseInd,
      _houseVacant: houseVacant,
      _houseTotal: houseDnc + houseGop + houseInd + houseVacant,

      _senateDnc: senateDnc,
      _senateGop: senateGop,
      _senateInd: senateInd,
      _senateVacant: senateVacant,
      _senateTotal: senateDnc + senateGop + senateInd + senateVacant,

      _houseControl: houseControl,
      _senateControl: senateControl,
      _summary: firstValue(row, ["overall_summary", "summary", "description", "notes"], "No congressional election summary provided.")
    };

    record._search = buildSearch(record);
    return record;
  }

  function buildSearch(record) {
    return Object.values(record)
      .filter((value) => typeof value === "string" || typeof value === "number")
      .join(" ")
      .toLowerCase();
  }

  function injectStyles() {
    if ($("#aprp-election-rewrite-style")) return;

    const style = document.createElement("style");
    style.id = "aprp-election-rewrite-style";
    style.textContent = `
      .election-hall-root {
        display: grid;
        gap: 18px;
      }

      .election-hall-layout {
        display: grid;
        grid-template-columns: 310px minmax(0, 1fr);
        gap: 18px;
        align-items: start;
      }

      .election-filter-card,
      .election-card,
      .election-source-card {
        border: 1px solid rgba(15, 23, 42, .12);
        border-radius: 24px;
        background: rgba(255, 255, 255, .94);
        box-shadow: 0 18px 42px rgba(15, 23, 42, .08);
      }

      .election-filter-card,
      .election-source-card {
        padding: 16px;
      }

      .election-sidebar {
        display: grid;
        gap: 14px;
        position: sticky;
        top: 88px;
      }

      .election-filter-card h3,
      .election-source-card h3 {
        margin: 0 0 12px;
        font-family: Georgia, serif;
        color: #0f172a;
        font-size: 1.35rem;
        line-height: 1.05;
      }

      .election-field {
        display: grid;
        gap: 6px;
        margin-bottom: 10px;
      }

      .election-field label,
      .election-eyebrow {
        color: #60a5fa;
        font-size: .68rem;
        font-weight: 950;
        letter-spacing: .16em;
        text-transform: uppercase;
      }

      .election-field input,
      .election-field select {
        width: 100%;
        border: 1px solid rgba(15, 23, 42, .14);
        border-radius: 13px;
        background: white;
        color: #0f172a;
        padding: 10px 11px;
        font: inherit;
        font-weight: 750;
        outline: none;
      }

      .election-stat-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }

      .election-stat {
        padding: 10px;
        border: 1px solid rgba(15, 23, 42, .10);
        border-radius: 14px;
        background: #f8fafc;
      }

      .election-stat strong {
        display: block;
        color: #0f172a;
        font-size: 1.2rem;
        line-height: 1;
      }

      .election-stat span {
        display: block;
        margin-top: 5px;
        color: #64748b;
        font-size: .68rem;
        font-weight: 950;
        letter-spacing: .08em;
        text-transform: uppercase;
      }

      .election-main {
        display: grid;
        gap: 14px;
        min-width: 0;
      }

      .election-quick-bar {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        padding: 12px;
        border: 1px solid rgba(15, 23, 42, .10);
        border-radius: 22px;
        background: rgba(255, 255, 255, .86);
        box-shadow: 0 14px 34px rgba(15, 23, 42, .06);
      }

      .election-quick-bar button {
        border: 1px solid rgba(15, 23, 42, .14);
        border-radius: 999px;
        background: white;
        color: #0f172a;
        padding: 8px 12px;
        font-size: .82rem;
        font-weight: 950;
        cursor: pointer;
      }

      .election-quick-bar button.is-active {
        color: white;
        background: #0f172a;
        border-color: #0f172a;
      }

      .election-list {
        display: grid;
        gap: 14px;
      }

      .election-card {
        display: grid;
        grid-template-columns: 215px minmax(0, 1fr);
        gap: 16px;
        padding: 16px;
        position: relative;
        overflow: hidden;
      }

      .election-card::before {
        content: "";
        position: absolute;
        inset: 0 auto 0 0;
        width: 7px;
        background: var(--winner-color, #64748b);
      }

      .election-side {
        border-radius: 18px;
        background: linear-gradient(180deg, #13243d, #07111f);
        color: white;
        padding: 16px;
        display: grid;
        align-content: space-between;
        gap: 22px;
        min-height: 230px;
      }

      .election-year {
        font-family: Georgia, serif;
        font-size: 3rem;
        font-weight: 950;
        line-height: .9;
      }

      .election-type {
        margin-top: 8px;
        color: #bfdbfe;
        font-size: .72rem;
        font-weight: 950;
        letter-spacing: .15em;
        text-transform: uppercase;
      }

      .election-winner-label {
        color: #93c5fd;
        font-size: .66rem;
        font-weight: 950;
        letter-spacing: .14em;
        text-transform: uppercase;
      }

      .election-winner-name {
        display: block;
        margin-top: 5px;
        font-family: Georgia, serif;
        font-size: 1.2rem;
        font-weight: 950;
        line-height: 1.08;
      }

      .election-body {
        display: grid;
        gap: 12px;
      }

      .election-body h2 {
        margin: 0;
        color: #0f172a;
        font-family: Georgia, serif;
        font-size: clamp(1.6rem, 3vw, 2.35rem);
        line-height: 1.02;
      }

      .election-subline {
        color: #64748b;
        font-size: .9rem;
        font-weight: 750;
      }

      .election-grid-2,
      .election-grid-3 {
        display: grid;
        gap: 9px;
      }

      .election-grid-2 {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .election-grid-3 {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .election-tile {
        border: 1px solid rgba(15, 23, 42, .10);
        border-radius: 16px;
        background: #f8fafc;
        padding: 10px;
      }

      .election-tile strong {
        display: block;
        color: #0f172a;
        font-weight: 950;
        line-height: 1.15;
      }

      .election-tile span {
        display: block;
        margin-top: 4px;
        color: #64748b;
        font-size: .78rem;
        font-weight: 850;
      }

      .election-party-badge {
        display: inline-flex;
        width: fit-content;
        align-items: center;
        border-radius: 999px;
        padding: 4px 8px;
        margin-top: 6px;
        color: var(--party-color);
        border: 1px solid color-mix(in srgb, var(--party-color) 35%, transparent);
        background: color-mix(in srgb, var(--party-color) 12%, white);
        font-size: .72rem;
        font-weight: 950;
      }

      .election-meter {
        height: 15px;
        border-radius: 999px;
        overflow: hidden;
        background: rgba(15, 23, 42, .08);
        display: flex;
      }

      .election-meter-dnc { background: #2563eb; }
      .election-meter-gop { background: #dc2626; }
      .election-meter-ind { background: #7c3aed; }
      .election-meter-vacant { background: #94a3b8; }

      .election-summary {
        margin: 0;
        color: #475569;
        line-height: 1.45;
        font-size: .94rem;
      }

      .election-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .election-actions a,
      .election-actions button {
        border: 1px solid rgba(15, 23, 42, .14);
        border-radius: 999px;
        background: white;
        color: #0f172a;
        padding: 8px 12px;
        font-size: .8rem;
        font-weight: 950;
        cursor: pointer;
        text-decoration: none;
      }

      .election-actions .primary {
        background: #0f172a;
        color: white;
        border-color: #0f172a;
      }

      .election-map-box {
        border: 1px solid rgba(15, 23, 42, .12);
        border-radius: 18px;
        background: linear-gradient(180deg, #0f172a, #07111f);
        overflow: hidden;
        min-height: 220px;
        display: grid;
        color: white;
        text-decoration: none;
      }

      .election-map-box img {
        width: 100%;
        height: 100%;
        min-height: 220px;
        object-fit: cover;
        display: block;
      }

      .election-map-empty {
        display: grid;
        place-items: center;
        padding: 18px;
        color: #cbd5e1;
        text-align: center;
        font-weight: 850;
      }

      .election-map-empty strong {
        display: block;
        color: white;
        font-family: Georgia, serif;
        font-size: 1.1rem;
        margin-bottom: 6px;
      }

      .election-empty,
      .election-error {
        border: 1px dashed rgba(15, 23, 42, .20);
        border-radius: 20px;
        background: rgba(255, 255, 255, .72);
        padding: 22px;
        text-align: center;
        color: #64748b;
        font-weight: 850;
      }

      .election-error strong {
        display: block;
        color: #0f172a;
        margin-bottom: 5px;
      }

      @media (max-width: 1050px) {
        .election-hall-layout,
        .election-card,
        .election-grid-2,
        .election-grid-3 {
          grid-template-columns: 1fr;
        }

        .election-sidebar {
          position: static;
        }

        .election-side {
          min-height: auto;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function meterSegment(value, total, className) {
    if (!total || value <= 0) return "";
    return `<div class="${className}" style="width:${(value / total) * 100}%"></div>`;
  }

  function trimSummary(text) {
    const value = clean(text);
    if (value.length <= 520) return value;
    return `${value.slice(0, 520).trim()}...`;
  }

  function candidateTile(label, name, party, ev, popular, totalPopular) {
    if (!name && !ev && !popular) return "";

    return `
      <div class="election-tile">
        <strong>${safeHTML(name || label)}</strong>
        ${partyBadge(party)}
        <span>${ev ? `${formatNumber(ev)} electors` : "— electors"}</span>
        <span>${popular ? `${formatNumber(popular)} votes • ${percent(popular, totalPopular)}%` : "— votes"}</span>
      </div>
    `;
  }

  function resultTile(label, value, party) {
    return `
      <div class="election-tile">
        <strong>${formatNumber(value)}</strong>
        <span>${safeHTML(label)}</span>
        ${partyBadge(party)}
      </div>
    `;
  }

  function mapBox(record) {
    if (record._mapLink && record._mapIsImage) {
      return `
        <a class="election-map-box" href="${safeHTML(record._mapLink)}" target="_blank" rel="noopener">
          <img src="${safeHTML(record._mapLink)}" alt="${safeHTML(record._title)} map" loading="lazy">
        </a>
      `;
    }

    if (record._mapLink) {
      return `
        <a class="election-map-box" href="${safeHTML(record._mapLink)}" target="_blank" rel="noopener">
          <div class="election-map-empty">
            <div>
              <strong>Open Election Map</strong>
              <span>Attached source is not a direct image URL.</span>
            </div>
          </div>
        </a>
      `;
    }

    return `
      <div class="election-map-box">
        <div class="election-map-empty">
          <div>
            <strong>No map attached</strong>
            <span>Add map_link to show one here.</span>
          </div>
        </div>
      </div>
    `;
  }

  function potusCard(record) {
    return `
      <article class="election-card" style="--winner-color:${safeHTML(record._winnerColor)}">
        <aside class="election-side">
          <div>
            <div class="election-year">${safeHTML(record._year || "—")}</div>
            <div class="election-type">Presidential</div>
          </div>

          <div>
            <div class="election-winner-label">Winner</div>
            <strong class="election-winner-name">${safeHTML(record._winner || "Undeclared")}</strong>
            ${partyBadge(record._winnerParty)}
          </div>
        </aside>

        <section class="election-body">
          <div>
            <h2>${safeHTML(record._title)}</h2>
            <div class="election-subline">${safeHTML(record._cycle)} • ${safeHTML(record._year)}</div>
          </div>

          <div class="election-grid-3">
            ${candidateTile("DNC Candidate", record._dncCandidate, "DNC", record._dncEv, record._dncPopular, record._totalPopular)}
            ${candidateTile("GOP Candidate", record._gopCandidate, "GOP", record._gopEv, record._gopPopular, record._totalPopular)}
            ${candidateTile("Other Candidate", record._otherCandidate, "IND", record._otherEv, record._otherPopular, record._totalPopular)}
          </div>

          ${
            record._totalEv
              ? `
                <div class="election-meter">
                  ${meterSegment(record._dncEv, record._totalEv, "election-meter-dnc")}
                  ${meterSegment(record._gopEv, record._totalEv, "election-meter-gop")}
                  ${meterSegment(record._otherEv, record._totalEv, "election-meter-ind")}
                </div>

                <div class="election-grid-3">
                  ${resultTile("DNC Electors", record._dncEv, "DNC")}
                  ${resultTile("GOP Electors", record._gopEv, "GOP")}
                  ${resultTile("Other Electors", record._otherEv, "IND")}
                </div>
              `
              : ""
          }

          ${
            record._totalPopular
              ? `
                <div class="election-meter">
                  ${meterSegment(record._dncPopular, record._totalPopular, "election-meter-dnc")}
                  ${meterSegment(record._gopPopular, record._totalPopular, "election-meter-gop")}
                  ${meterSegment(record._otherPopular, record._totalPopular, "election-meter-ind")}
                </div>
              `
              : ""
          }

          ${mapBox(record)}

          <p class="election-summary">${safeHTML(trimSummary(record._summary))}</p>

          <div class="election-actions">
            ${record._mapLink ? `<a class="primary" href="${safeHTML(record._mapLink)}" target="_blank" rel="noopener">Open Map / Source</a>` : ""}
            <button type="button" data-copy-election="${safeHTML(record._id)}">Copy Summary</button>
          </div>
        </section>
      </article>
    `;
  }

  function congressCard(record) {
    return `
      <article class="election-card" style="--winner-color:${safeHTML(record._winnerColor)}">
        <aside class="election-side">
          <div>
            <div class="election-year">${safeHTML(record._year || "—")}</div>
            <div class="election-type">Congress</div>
          </div>

          <div>
            <div class="election-winner-label">Control</div>
            <strong class="election-winner-name">
              House: ${safeHTML(record._houseControl)}<br>
              Senate: ${safeHTML(record._senateControl)}
            </strong>
            ${partyBadge(record._winnerParty)}
          </div>
        </aside>

        <section class="election-body">
          <div>
            <h2>${safeHTML(record._title)}</h2>
            <div class="election-subline">${safeHTML(record._cycle)} • ${safeHTML(record._year)}</div>
          </div>

          <div class="election-grid-2">
            <div class="election-tile">
              <strong>House Control: ${safeHTML(record._houseControl)}</strong>
              <span>DNC ${record._houseDnc} • GOP ${record._houseGop} • IND ${record._houseInd} • Vacant ${record._houseVacant}</span>
              <div class="election-meter" style="margin-top:10px;">
                ${meterSegment(record._houseDnc, record._houseTotal, "election-meter-dnc")}
                ${meterSegment(record._houseGop, record._houseTotal, "election-meter-gop")}
                ${meterSegment(record._houseInd, record._houseTotal, "election-meter-ind")}
                ${meterSegment(record._houseVacant, record._houseTotal, "election-meter-vacant")}
              </div>
            </div>

            <div class="election-tile">
              <strong>Senate Control: ${safeHTML(record._senateControl)}</strong>
              <span>DNC ${record._senateDnc} • GOP ${record._senateGop} • IND ${record._senateInd} • Vacant ${record._senateVacant}</span>
              <div class="election-meter" style="margin-top:10px;">
                ${meterSegment(record._senateDnc, record._senateTotal, "election-meter-dnc")}
                ${meterSegment(record._senateGop, record._senateTotal, "election-meter-gop")}
                ${meterSegment(record._senateInd, record._senateTotal, "election-meter-ind")}
                ${meterSegment(record._senateVacant, record._senateTotal, "election-meter-vacant")}
              </div>
            </div>
          </div>

          <div class="election-grid-3">
            ${resultTile("House DNC", record._houseDnc, "DNC")}
            ${resultTile("House GOP", record._houseGop, "GOP")}
            ${resultTile("House IND", record._houseInd, "IND")}
            ${resultTile("Senate DNC", record._senateDnc, "DNC")}
            ${resultTile("Senate GOP", record._senateGop, "GOP")}
            ${resultTile("Senate IND", record._senateInd, "IND")}
          </div>

          <p class="election-summary">${safeHTML(trimSummary(record._summary))}</p>

          <div class="election-actions">
            <button type="button" data-copy-election="${safeHTML(record._id)}">Copy Summary</button>
          </div>
        </section>
      </article>
    `;
  }

  function card(record) {
    return record._type === "CONGRESS" ? congressCard(record) : potusCard(record);
  }

  function uniqueYears() {
    return Array.from(new Set(STATE.all.map((record) => record._year).filter(Boolean)))
      .sort((a, b) => toNumber(b) - toNumber(a));
  }

  function renderRootShell() {
    const root = $("#election-hall-root");

    if (!root) return false;

    const years = uniqueYears();

    root.classList.add("election-hall-root");

    root.innerHTML = `
      <div class="election-hall-layout">
        <aside class="election-sidebar">
          <section class="election-filter-card">
            <div class="election-eyebrow">Filter Elections</div>
            <h3>Election Records</h3>

            <div class="election-field">
              <label for="election-search">Search</label>
              <input id="election-search" type="search" placeholder="Search year, winner, party...">
            </div>

            <div class="election-field">
              <label for="election-type-filter">Type</label>
              <select id="election-type-filter">
                <option value="all">All Records</option>
                <option value="POTUS">Presidential</option>
                <option value="CONGRESS">Congress</option>
              </select>
            </div>

            <div class="election-field">
              <label for="election-year-filter">Year</label>
              <select id="election-year-filter">
                <option value="all">All Years</option>
                ${years.map((year) => `<option value="${safeHTML(year)}">${safeHTML(year)}</option>`).join("")}
              </select>
            </div>

            <div class="election-field">
              <label for="election-party-filter">Party</label>
              <select id="election-party-filter">
                <option value="all">All Parties</option>
                <option value="DNC">DNC</option>
                <option value="GOP">GOP</option>
                <option value="IND">IND</option>
                <option value="SPLIT">Split</option>
              </select>
            </div>

            <div class="election-stat-grid">
              <div class="election-stat">
                <strong id="election-count">0</strong>
                <span>Shown</span>
              </div>
              <div class="election-stat">
                <strong id="election-total-count">0</strong>
                <span>Total</span>
              </div>
            </div>
          </section>

          <section class="election-source-card">
            <div class="election-eyebrow">Sources</div>
            <h3>Loaded Sheets</h3>
            <div class="election-stat-grid">
              <div class="election-stat">
                <strong>${STATE.potus.length}</strong>
                <span>POTUS</span>
              </div>
              <div class="election-stat">
                <strong>${STATE.congress.length}</strong>
                <span>Congress</span>
              </div>
            </div>
          </section>
        </aside>

        <main class="election-main">
          <nav class="election-quick-bar">
            <button type="button" class="is-active" data-election-quick="all">All</button>
            <button type="button" data-election-quick="potus">Presidential</button>
            <button type="button" data-election-quick="congress">Congress</button>
            <button type="button" data-election-quick="dnc">DNC Wins</button>
            <button type="button" data-election-quick="gop">GOP Wins</button>
            <button type="button" data-election-quick="split">Split</button>
          </nav>

          <div id="election-list" class="election-list"></div>
        </main>
      </div>
    `;

    return true;
  }

  function renderOldLayout() {
    const potusList = $("#presidential-election-list");
    const congressList = $("#congress-control-list");

    if (!potusList && !congressList) return false;

    if (potusList) {
      potusList.innerHTML = STATE.filtered
        .filter((record) => record._type === "POTUS")
        .map(card)
        .join("") || `<div class="election-empty">No presidential election records found.</div>`;
    }

    if (congressList) {
      congressList.innerHTML = STATE.filtered
        .filter((record) => record._type === "CONGRESS")
        .map(card)
        .join("") || `<div class="election-empty">No congressional control records found.</div>`;
    }

    const totalCount = $("#elections-total-count");
    const yearCount = $("#elections-year-count");

    if (totalCount) totalCount.textContent = String(STATE.all.length);
    if (yearCount) yearCount.textContent = String(uniqueYears().length);

    const featureTitle = $("#elections-feature-title");
    const featureSummary = $("#elections-feature-summary");
    const latest = STATE.all[0];

    if (featureTitle && latest) featureTitle.textContent = `${latest._year}: ${latest._title}`;
    if (featureSummary && latest) featureSummary.textContent = latest._summary;

    return true;
  }

  function applyFilters() {
    const search = clean($("#election-search")?.value || $("#elections-search")?.value || "").toLowerCase();
    const type = clean($("#election-type-filter")?.value || $("#elections-type-filter")?.value || "all");
    const year = clean($("#election-year-filter")?.value || $("#elections-year-filter")?.value || "all");
    const party = clean($("#election-party-filter")?.value || "all");

    STATE.filtered = STATE.all.filter((record) => {
      if (search && !record._search.includes(search)) return false;

      if (type !== "all") {
        if (type === "president" && record._type !== "POTUS") return false;
        if (type === "congress" && record._type !== "CONGRESS") return false;
        if (type === "POTUS" && record._type !== "POTUS") return false;
        if (type === "CONGRESS" && record._type !== "CONGRESS") return false;
      }

      if (year !== "all" && record._year !== year) return false;

      if (party !== "all") {
        if (
          record._winnerParty !== party &&
          record._houseControl !== party &&
          record._senateControl !== party
        ) {
          return false;
        }
      }

      if (STATE.quick === "potus" && record._type !== "POTUS") return false;
      if (STATE.quick === "congress" && record._type !== "CONGRESS") return false;
      if (STATE.quick === "dnc" && record._winnerParty !== "DNC") return false;
      if (STATE.quick === "gop" && record._winnerParty !== "GOP") return false;
      if (STATE.quick === "split" && record._winnerParty !== "SPLIT") return false;

      return true;
    });

    STATE.filtered.sort((a, b) => b._yearNumber - a._yearNumber || a._type.localeCompare(b._type));

    renderLists();
  }

  function renderLists() {
    const electionList = $("#election-list");

    if (electionList) {
      electionList.innerHTML =
        STATE.filtered.map(card).join("") ||
        `<div class="election-empty">No election records match the current filters.</div>`;
    } else {
      renderOldLayout();
    }

    const count = $("#election-count");
    const total = $("#election-total-count");

    if (count) count.textContent = String(STATE.filtered.length);
    if (total) total.textContent = String(STATE.all.length);

    bindCopyButtons();
  }

  function bindFilters() {
    $("#election-search")?.addEventListener("input", applyFilters);
    $("#election-type-filter")?.addEventListener("change", applyFilters);
    $("#election-year-filter")?.addEventListener("change", applyFilters);
    $("#election-party-filter")?.addEventListener("change", applyFilters);

    $("#elections-search")?.addEventListener("input", applyFilters);
    $("#elections-type-filter")?.addEventListener("change", applyFilters);
    $("#elections-year-filter")?.addEventListener("change", applyFilters);

    $$("[data-election-quick]").forEach((button) => {
      button.addEventListener("click", () => {
        STATE.quick = button.dataset.electionQuick || "all";

        $$("[data-election-quick]").forEach((item) => {
          item.classList.toggle("is-active", item === button);
        });

        applyFilters();
      });
    });
  }

  function bindCopyButtons() {
    $$("[data-copy-election]").forEach((button) => {
      button.addEventListener("click", async () => {
        const record = STATE.all.find((item) => item._id === button.dataset.copyElection);
        if (!record) return;

        const text = `${record._title} — ${record._summary}`;

        try {
          await navigator.clipboard.writeText(text);
          button.textContent = "Copied";
        } catch {
          button.textContent = "Copy Failed";
        }

        setTimeout(() => {
          button.textContent = "Copy Summary";
        }, 1200);
      });
    });
  }

  function renderError(message) {
    const root = $("#election-hall-root");
    const potusList = $("#presidential-election-list");
    const congressList = $("#congress-control-list");

    const html = `
      <div class="election-error">
        <strong>Election data failed to load.</strong>
        ${safeHTML(message)}
      </div>
    `;

    if (root) root.innerHTML = html;
    if (potusList) potusList.innerHTML = html;
    if (congressList) congressList.innerHTML = html;
  }

  async function init() {
    try {
      injectStyles();

      const data = await loadSheets(["WEB_POTUSELECTION", "WEB_CONGRESSELECTION"]);

      STATE.potus = (data.WEB_POTUSELECTION || [])
        .map(normalizePotus)
        .filter((record) => record._year || record._winner || record._title);

      STATE.congress = (data.WEB_CONGRESSELECTION || [])
        .map(normalizeCongress)
        .filter((record) => record._year || record._cycle || record._title);

      STATE.all = [...STATE.potus, ...STATE.congress].sort(
        (a, b) => b._yearNumber - a._yearNumber || a._type.localeCompare(b._type)
      );

      STATE.filtered = [...STATE.all];

      const usedRoot = renderRootShell();
      if (!usedRoot) renderOldLayout();

      bindFilters();
      applyFilters();

      console.log("Election Hall loaded:", {
        potus: STATE.potus,
        congress: STATE.congress,
        all: STATE.all
      });
    } catch (error) {
      console.error("Election Hall failed:", error);
      renderError(error.message || String(error));
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
