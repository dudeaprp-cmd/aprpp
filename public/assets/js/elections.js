/* APRP Federal Archive — Election Hall
   Reads:
   WEB_POTUSELECTION
   WEB_CONGRESSELECTION

   POTUS columns:
   year, election_type, title, winner, winner_party,
   dnc_candidate, gop_candidate, other_candidate,
   dnc_ev, gop_ev, other_ev,
   dnc_popular, gop_popular, other_popular,
   summary, map_link

   Congress columns:
   year, cycle,
   house_dnc, house_gop, house_ind, house_vacant,
   senate_dnc, senate_gop, senate_ind, senate_vacant,
   house_control, senate_control, overall_summary
*/

(function () {
  const APRP = window.APRP || {};
  const UI = window.APRP_UI || {};

  const fetchSheets = APRP.fetchSheets;

  const cleanCell =
    APRP.cleanCell ||
    ((value) => String(value ?? "").trim());

  const safeHTML =
    APRP.safeHTML ||
    ((value) =>
      cleanCell(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;"));

  /* FIXED:
     Handles values like:
     56,873,688 (48.0%)
     49,688,917 [47.7%]
     245 Electors
  */
  const toNumber = (value, fallback = 0) => {
    if (value === null || value === undefined || value === "") return fallback;

    const raw = String(value).trim();
    const leadingNumber = raw.match(/-?\d[\d,]*(?:\.\d+)?/);

    if (!leadingNumber) return fallback;

    const parsed = Number(leadingNumber[0].replace(/,/g, ""));

    return Number.isFinite(parsed) ? parsed : fallback;
  };

  let POTUS_ELECTIONS = [];
  let CONGRESS_ELECTIONS = [];
  let ALL_RECORDS = [];
  let FILTERED_RECORDS = [];

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

    VACANT: "#94a3b8",
    SPLIT: "#7c3aed",
    DIVIDED: "#7c3aed",
    OTHER: "#64748b",
  };

  function getEl(selector) {
    return document.querySelector(selector);
  }

  function firstValue(row, keys, fallback = "") {
    for (const key of keys) {
      const value = cleanCell(row?.[key]);
      if (value !== "") return value;
    }

    return fallback;
  }

  function normalizeParty(value) {
    const raw = cleanCell(value).toUpperCase();

    if (["D", "DEM", "DEMOCRAT", "DEMOCRATIC", "DNC"].includes(raw)) return "DNC";
    if (["R", "REP", "REPUBLICAN", "GOP"].includes(raw)) return "GOP";
    if (["I", "IND", "INDEPENDENT"].includes(raw)) return "IND";
    if (["VACANT", "VAC"].includes(raw)) return "VACANT";
    if (["SPLIT", "TIE", "DIVIDED", "MIXED"].includes(raw)) return "SPLIT";

    return raw || "OTHER";
  }

  function partyColor(party) {
    return PARTY_COLORS[normalizeParty(party)] || PARTY_COLORS.OTHER;
  }

  function partyBadge(party) {
    if (UI.partyBadge) return UI.partyBadge(party);

    const normalized = normalizeParty(party);
    const color = partyColor(normalized);

    return `
      <span class="party-badge" style="background:${safeHTML(color)}22;border-color:${safeHTML(color)}55;color:${safeHTML(color)};">
        ${safeHTML(normalized)}
      </span>
    `;
  }

  function percent(value, total) {
    if (!total) return "0.0";
    return ((value / total) * 100).toFixed(1);
  }

  function looksLikeImage(url) {
    const value = cleanCell(url).toLowerCase();

    return (
      value.endsWith(".png") ||
      value.endsWith(".jpg") ||
      value.endsWith(".jpeg") ||
      value.endsWith(".webp") ||
      value.endsWith(".gif") ||
      value.includes("kommodo.ai/i/") ||
      value.includes("i.postimg.cc") ||
      value.includes("postimg.cc") ||
      value.includes("imgur.com") ||
      value.includes("cdn.discordapp.com") ||
      value.includes("media.discordapp.net")
    );
  }

  async function safeFetchMany(sheetNames) {
    try {
      if (!fetchSheets) {
        throw new Error("APRP.fetchSheets is missing. Check sheets.js loads before elections.js.");
      }

      return await fetchSheets(sheetNames);
    } catch (error) {
      console.warn("Election sheet load failed:", error);
      return {};
    }
  }

  function normalizePotusElection(row, index) {
    const year = firstValue(row, ["year"], "");
    const electionType = firstValue(row, ["election_type"], "Presidential Election");
    const title = firstValue(row, ["title"], `${year} Presidential Election`);
    const winner = firstValue(row, ["winner"], "");
    const winnerParty = normalizeParty(firstValue(row, ["winner_party"], ""));

    const dncEv = toNumber(firstValue(row, ["dnc_ev"], 0), 0);
    const gopEv = toNumber(firstValue(row, ["gop_ev"], 0), 0);
    const otherEv = toNumber(firstValue(row, ["other_ev"], 0), 0);
    const totalEv = dncEv + gopEv + otherEv;

    const dncPopular = toNumber(firstValue(row, ["dnc_popular"], 0), 0);
    const gopPopular = toNumber(firstValue(row, ["gop_popular"], 0), 0);
    const otherPopular = toNumber(firstValue(row, ["other_popular"], 0), 0);
    const totalPopular = dncPopular + gopPopular + otherPopular;

    const mapLink = firstValue(row, ["map_link", "map_url", "map", "source"], "");

    return {
      ...row,
      _id: `potus-${index}`,
      _recordType: "POTUS",
      _recordLabel: "Presidential",
      _year: year,
      _yearNumber: toNumber(year, 0),
      _cycle: electionType,
      _title: title,
      _winner: winner,
      _winnerParty: winnerParty,
      _winnerColor: partyColor(winnerParty),
      _dncCandidate: firstValue(row, ["dnc_candidate"], ""),
      _gopCandidate: firstValue(row, ["gop_candidate"], ""),
      _otherCandidate: firstValue(row, ["other_candidate"], ""),
      _dncEv: dncEv,
      _gopEv: gopEv,
      _otherEv: otherEv,
      _totalEv: totalEv,
      _dncPopular: dncPopular,
      _gopPopular: gopPopular,
      _otherPopular: otherPopular,
      _totalPopular: totalPopular,
      _summary: firstValue(row, ["summary"], "No presidential election summary provided."),
      _mapLink: mapLink,
      _mapIsImage: looksLikeImage(mapLink),
      _searchText: "",
    };
  }

  function resolveCongressWinnerParty(houseControl, senateControl) {
    const house = normalizeParty(houseControl);
    const senate = normalizeParty(senateControl);

    if (house === senate && house !== "OTHER") return house;

    const validHouse = ["DNC", "GOP", "IND"].includes(house);
    const validSenate = ["DNC", "GOP", "IND"].includes(senate);

    if (validHouse && validSenate && house !== senate) return "SPLIT";

    if (house === "SPLIT" || senate === "SPLIT") return "SPLIT";

    if (house === "DNC" || senate === "DNC") return "DNC";
    if (house === "GOP" || senate === "GOP") return "GOP";

    return "SPLIT";
  }

  function normalizeCongressElection(row, index) {
    const year = firstValue(row, ["year"], "");
    const cycle = firstValue(row, ["cycle"], "Congressional Election");

    const houseDnc = toNumber(firstValue(row, ["house_dnc"], 0), 0);
    const houseGop = toNumber(firstValue(row, ["house_gop"], 0), 0);
    const houseInd = toNumber(firstValue(row, ["house_ind"], 0), 0);
    const houseVacant = toNumber(firstValue(row, ["house_vacant"], 0), 0);

    const senateDnc = toNumber(firstValue(row, ["senate_dnc"], 0), 0);
    const senateGop = toNumber(firstValue(row, ["senate_gop"], 0), 0);
    const senateInd = toNumber(firstValue(row, ["senate_ind"], 0), 0);
    const senateVacant = toNumber(firstValue(row, ["senate_vacant"], 0), 0);

    const houseControl = normalizeParty(firstValue(row, ["house_control"], ""));
    const senateControl = normalizeParty(firstValue(row, ["senate_control"], ""));
    const winnerParty = resolveCongressWinnerParty(houseControl, senateControl);

    const overallSummary = firstValue(row, ["overall_summary"], "No congressional election summary provided.");

    return {
      ...row,
      _id: `congress-${index}`,
      _recordType: "CONGRESS",
      _recordLabel: "Congressional",
      _year: year,
      _yearNumber: toNumber(year, 0),
      _cycle: cycle,
      _title: `${year} ${cycle}`,
      _winner: `${houseControl} House / ${senateControl} Senate`,
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
      _summary: overallSummary,
      _mapLink: "",
      _mapIsImage: false,
      _searchText: "",
    };
  }

  function buildSearchText(record) {
    return [
      record._recordType,
      record._recordLabel,
      record._year,
      record._cycle,
      record._title,
      record._winner,
      record._winnerParty,
      record._houseControl,
      record._senateControl,
      record._dncCandidate,
      record._gopCandidate,
      record._otherCandidate,
      record._summary,
    ]
      .map((value) => cleanCell(value).toLowerCase())
      .join(" ");
  }

  async function loadRecords() {
    const data = await safeFetchMany(["WEB_POTUSELECTION", "WEB_CONGRESSELECTION"]);

    POTUS_ELECTIONS = (data.WEB_POTUSELECTION || [])
      .map(normalizePotusElection)
      .filter((record) => record._year || record._title || record._winner);

    CONGRESS_ELECTIONS = (data.WEB_CONGRESSELECTION || [])
      .map(normalizeCongressElection)
      .filter((record) => record._year || record._cycle);

    ALL_RECORDS = [...POTUS_ELECTIONS, ...CONGRESS_ELECTIONS]
      .map((record) => ({
        ...record,
        _searchText: buildSearchText(record),
      }))
      .sort((a, b) => b._yearNumber - a._yearNumber || a._recordType.localeCompare(b._recordType));

    FILTERED_RECORDS = [...ALL_RECORDS];
  }

  function injectElectionStyles() {
    if (document.querySelector("#aprp-election-hall-style")) return;

    const style = document.createElement("style");
    style.id = "aprp-election-hall-style";
    style.textContent = `
      .election-hall {
        display: grid;
        gap: 20px;
      }

      .election-top-grid {
        display: grid;
        grid-template-columns: 300px minmax(0, 1fr);
        gap: 18px;
        align-items: start;
      }

      .election-filter-panel {
        position: sticky;
        top: 86px;
        display: grid;
        gap: 12px;
      }

      .election-filter-card,
      .election-card {
        border: 1px solid rgba(15,23,42,.12);
        border-radius: 24px;
        background: rgba(255,255,255,.94);
        box-shadow: 0 18px 42px rgba(15,23,42,.08);
        padding: 16px;
      }

      .election-filter-card h3 {
        margin: 6px 0 12px;
        font-family: Georgia, serif;
        color: #0f172a;
        font-size: 1.28rem;
      }

      .election-control {
        display: grid;
        gap: 5px;
        margin-bottom: 10px;
      }

      .election-control label {
        color: #2563eb;
        font-size: .68rem;
        font-weight: 950;
        letter-spacing: .14em;
        text-transform: uppercase;
      }

      .election-control input,
      .election-control select {
        width: 100%;
        border: 1px solid rgba(15,23,42,.14);
        border-radius: 12px;
        background: #fff;
        color: #0f172a;
        padding: 10px 11px;
        font-weight: 750;
        outline: none;
      }

      .election-stat-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }

      .election-stat {
        border: 1px solid rgba(15,23,42,.10);
        border-radius: 14px;
        background: rgba(248,250,252,.92);
        padding: 10px;
      }

      .election-stat strong {
        display: block;
        color: #0f172a;
        font-size: 1.12rem;
        font-weight: 1000;
      }

      .election-stat span {
        display: block;
        color: #64748b;
        font-size: .68rem;
        font-weight: 950;
        letter-spacing: .08em;
        text-transform: uppercase;
      }

      .election-quick-bar {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 14px;
      }

      .election-pill-btn {
        border: 1px solid rgba(15,23,42,.14);
        border-radius: 999px;
        background: rgba(255,255,255,.9);
        color: #0f172a;
        padding: 8px 12px;
        font-size: .8rem;
        font-weight: 950;
        cursor: pointer;
      }

      .election-pill-btn.is-active {
        background: #0f172a;
        border-color: #0f172a;
        color: #fff;
      }

      .election-list {
        display: grid;
        gap: 14px;
      }

      .election-card {
        display: grid;
        grid-template-columns: 215px minmax(0, 1fr);
        gap: 16px;
        overflow: hidden;
        position: relative;
      }

      .election-card::before {
        content: "";
        position: absolute;
        inset: 0 auto 0 0;
        width: 7px;
        background: var(--winner-color, #64748b);
      }

      .election-card-left {
        border-radius: 18px;
        background: linear-gradient(180deg, #13243d, #07111f);
        color: #fff;
        padding: 16px;
        display: grid;
        align-content: space-between;
        gap: 22px;
        min-height: 245px;
      }

      .election-year {
        font-family: Georgia, serif;
        font-size: 3rem;
        line-height: .9;
        font-weight: 950;
      }

      .election-type {
        margin-top: 8px;
        color: #bfdbfe;
        font-size: .72rem;
        font-weight: 950;
        letter-spacing: .15em;
        text-transform: uppercase;
      }

      .election-winner-box {
        display: grid;
        gap: 6px;
      }

      .election-winner-box span.label {
        color: #93c5fd;
        font-size: .66rem;
        font-weight: 950;
        letter-spacing: .14em;
        text-transform: uppercase;
      }

      .election-winner-box strong {
        color: #fff;
        font-family: Georgia, serif;
        font-size: 1.13rem;
        line-height: 1.08;
      }

      .election-card-main {
        display: grid;
        gap: 12px;
      }

      .election-card-main h2 {
        margin: 0;
        color: #0f172a;
        font-family: Georgia, serif;
        font-size: clamp(1.65rem, 3vw, 2.35rem);
        line-height: 1.02;
      }

      .election-subline {
        color: #64748b;
        font-size: .92rem;
        font-weight: 750;
      }

      .election-layout-main {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 310px;
        gap: 12px;
        align-items: start;
      }

      .election-map-box {
        border: 1px solid rgba(15,23,42,.12);
        border-radius: 18px;
        background: linear-gradient(180deg, #0f172a, #07111f);
        overflow: hidden;
        min-height: 225px;
        display: grid;
      }

      .election-map-box img {
        width: 100%;
        height: 100%;
        min-height: 225px;
        object-fit: cover;
        object-position: center;
        display: block;
      }

      .election-map-empty {
        display: grid;
        place-items: center;
        padding: 18px;
        color: #cbd5e1;
        text-align: center;
        font-weight: 850;
        min-height: 225px;
      }

      .election-map-empty strong {
        display: block;
        color: #fff;
        font-family: Georgia, serif;
        font-size: 1.1rem;
        margin-bottom: 6px;
      }

      .election-grid-3 {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 9px;
      }

      .election-grid-2 {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 9px;
      }

      .election-info-tile {
        border: 1px solid rgba(15,23,42,.10);
        border-radius: 16px;
        background: rgba(248,250,252,.92);
        padding: 10px;
      }

      .election-info-tile strong {
        display: block;
        color: #0f172a;
        font-weight: 950;
        line-height: 1.15;
      }

      .election-info-tile span {
        display: block;
        margin-top: 4px;
        color: #64748b;
        font-size: .78rem;
        font-weight: 850;
      }

      .election-popular-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
      }

      .election-popular-tile {
        border: 1px solid rgba(15,23,42,.10);
        border-radius: 14px;
        background: #fff;
        padding: 10px;
      }

      .election-popular-tile .name {
        color: #0f172a;
        font-weight: 950;
        line-height: 1.15;
      }

      .election-popular-tile .votes {
        margin-top: 6px;
        color: #0f172a;
        font-size: 1.15rem;
        font-weight: 1000;
      }

      .election-popular-tile .percent {
        margin-top: 2px;
        color: #64748b;
        font-size: .82rem;
        font-weight: 900;
      }

      .election-meter {
        overflow: hidden;
        height: 15px;
        border-radius: 999px;
        background: rgba(15,23,42,.08);
        display: flex;
      }

      .election-meter-seg {
        min-width: 0;
      }

      .election-meter-dnc {
        background: #2563eb;
      }

      .election-meter-gop {
        background: #dc2626;
      }

      .election-meter-ind {
        background: #7c3aed;
      }

      .election-meter-vacant {
        background: #94a3b8;
      }

      .election-summary {
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
        border: 1px solid rgba(15,23,42,.14);
        border-radius: 999px;
        background: #fff;
        color: #0f172a;
        padding: 8px 12px;
        font-size: .8rem;
        font-weight: 950;
        cursor: pointer;
        text-decoration: none;
      }

      .election-actions a.primary,
      .election-actions button.primary {
        background: #0f172a;
        color: #fff;
        border-color: #0f172a;
      }

      .election-empty {
        border: 1px dashed rgba(15,23,42,.20);
        border-radius: 20px;
        background: rgba(255,255,255,.72);
        padding: 22px;
        text-align: center;
        color: #64748b;
        font-weight: 850;
      }

      @media (max-width: 1200px) {
        .election-layout-main {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 1050px) {
        .election-top-grid,
        .election-card {
          grid-template-columns: 1fr;
        }

        .election-filter-panel {
          position: static;
        }

        .election-grid-3,
        .election-grid-2,
        .election-popular-grid {
          grid-template-columns: 1fr;
        }

        .election-card-left {
          min-height: auto;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function resultTile(label, value, party) {
    return `
      <div class="election-info-tile">
        <strong>${safeHTML(value.toLocaleString())}</strong>
        <span>${safeHTML(label)} ${partyBadge(party)}</span>
      </div>
    `;
  }

  function candidateTile(label, name, party, ev, popular, totalPopular) {
    if (!name && !ev && !popular) return "";

    return `
      <div class="election-info-tile">
        <strong>${safeHTML(name || label)}</strong>
        <span>${partyBadge(party)}</span>
        <span>${ev ? `${safeHTML(ev.toLocaleString())} electors` : "— electors"}</span>
        <span>${popular ? `${safeHTML(popular.toLocaleString())} votes • ${safeHTML(percent(popular, totalPopular))}%` : "— votes"}</span>
      </div>
    `;
  }

  function popularTile(label, candidate, party, votes, totalPopular) {
    if (!candidate && !votes) return "";

    return `
      <div class="election-popular-tile">
        <div class="name">${safeHTML(candidate || label)}</div>
        <div>${partyBadge(party)}</div>
        <div class="votes">${safeHTML(votes ? votes.toLocaleString() : "—")}</div>
        <div class="percent">${safeHTML(percent(votes, totalPopular))}% popular vote</div>
      </div>
    `;
  }

  function meterSeg(value, total, className) {
    if (!total || value <= 0) return "";
    const pct = (value / total) * 100;

    return `
      <div class="election-meter-seg ${safeHTML(className)}" style="width:${pct}%;"></div>
    `;
  }

  function summaryTrim(text) {
    const value = cleanCell(text);
    if (value.length <= 520) return value;
    return `${value.slice(0, 520).trim()}...`;
  }

  function mapBox(record) {
    if (record._mapLink && record._mapIsImage) {
      return `
        <a class="election-map-box" href="${safeHTML(record._mapLink)}" target="_blank" rel="noopener">
          <img
            src="${safeHTML(record._mapLink)}"
            alt="${safeHTML(record._title)} map"
            loading="lazy"
            onerror="this.closest('.election-map-box').innerHTML='<div class=&quot;election-map-empty&quot;><div><strong>Map image failed</strong><span>Open source link below.</span></div></div>';"
          />
        </a>
      `;
    }

    if (record._mapLink) {
      return `
        <a class="election-map-box" href="${safeHTML(record._mapLink)}" target="_blank" rel="noopener">
          <div class="election-map-empty">
            <div>
              <strong>Open Election Map</strong>
              <span>Map/source link is attached, but is not a direct image URL.</span>
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
            <span>Add a direct image URL in map_link to show it here.</span>
          </div>
        </div>
      </div>
    `;
  }

  function potusCard(record) {
    const hasEV = record._totalEv > 0;
    const hasPopular = record._totalPopular > 0;

    return `
      <article class="election-card" style="--winner-color:${safeHTML(record._winnerColor)};">
        <aside class="election-card-left">
          <div>
            <div class="election-year">${safeHTML(record._year || "—")}</div>
            <div class="election-type">Presidential Election</div>
          </div>

          <div class="election-winner-box">
            <span class="label">Winner</span>
            <strong>${safeHTML(record._winner || "Undeclared")}</strong>
            ${partyBadge(record._winnerParty)}
          </div>
        </aside>

        <div class="election-card-main">
          <div>
            <h2>${safeHTML(record._title)}</h2>
            <div class="election-subline">${safeHTML(record._cycle)} • ${safeHTML(record._year)}</div>
          </div>

          <div class="election-layout-main">
            <div class="election-card-main">
              <div class="election-grid-3">
                ${candidateTile("DNC Candidate", record._dncCandidate, "DNC", record._dncEv, record._dncPopular, record._totalPopular)}
                ${candidateTile("GOP Candidate", record._gopCandidate, "GOP", record._gopEv, record._gopPopular, record._totalPopular)}
                ${candidateTile("Other Candidate", record._otherCandidate, "IND", record._otherEv, record._otherPopular, record._totalPopular)}
              </div>

              ${
                hasEV
                  ? `
                    <div class="election-meter" title="Electoral vote">
                      ${meterSeg(record._dncEv, record._totalEv, "election-meter-dnc")}
                      ${meterSeg(record._gopEv, record._totalEv, "election-meter-gop")}
                      ${meterSeg(record._otherEv, record._totalEv, "election-meter-ind")}
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
                hasPopular
                  ? `
                    <div>
                      <div class="election-subline" style="margin-bottom:8px;">Popular Vote</div>
                      <div class="election-meter" title="Popular vote">
                        ${meterSeg(record._dncPopular, record._totalPopular, "election-meter-dnc")}
                        ${meterSeg(record._gopPopular, record._totalPopular, "election-meter-gop")}
                        ${meterSeg(record._otherPopular, record._totalPopular, "election-meter-ind")}
                      </div>

                      <div class="election-popular-grid" style="margin-top:9px;">
                        ${popularTile("DNC Popular Vote", record._dncCandidate, "DNC", record._dncPopular, record._totalPopular)}
                        ${popularTile("GOP Popular Vote", record._gopCandidate, "GOP", record._gopPopular, record._totalPopular)}
                        ${popularTile("Other Popular Vote", record._otherCandidate, "IND", record._otherPopular, record._totalPopular)}
                      </div>
                    </div>
                  `
                  : `
                    <div class="election-info-tile">
                      <strong>Popular Vote</strong>
                      <span>No popular vote totals entered for this election.</span>
                    </div>
                  `
              }
            </div>

            ${mapBox(record)}
          </div>

          <p class="election-summary">${safeHTML(summaryTrim(record._summary))}</p>

          <div class="election-actions">
            ${record._mapLink ? `<a class="primary" href="${safeHTML(record._mapLink)}" target="_blank" rel="noopener">Open Map / Source</a>` : ""}
            <button type="button" data-election-copy="${safeHTML(record._id)}">Copy Summary</button>
          </div>
        </div>
      </article>
    `;
  }

  function congressCard(record) {
    return `
      <article class="election-card" style="--winner-color:${safeHTML(record._winnerColor)};">
        <aside class="election-card-left">
          <div>
            <div class="election-year">${safeHTML(record._year || "—")}</div>
            <div class="election-type">Congressional Election</div>
          </div>

          <div class="election-winner-box">
            <span class="label">Control</span>
            <strong>House: ${safeHTML(record._houseControl)}<br>Senate: ${safeHTML(record._senateControl)}</strong>
            ${partyBadge(record._winnerParty)}
          </div>
        </aside>

        <div class="election-card-main">
          <div>
            <h2>${safeHTML(record._title)}</h2>
            <div class="election-subline">${safeHTML(record._cycle)} • ${safeHTML(record._year)}</div>
          </div>

          <div class="election-grid-2">
            <section class="election-info-tile">
              <strong>House Control: ${safeHTML(record._houseControl)}</strong>
              <span>DNC ${safeHTML(record._houseDnc)} | GOP ${safeHTML(record._houseGop)} | IND ${safeHTML(record._houseInd)} | Vacant ${safeHTML(record._houseVacant)}</span>
              <div class="election-meter" style="margin-top:10px;">
                ${meterSeg(record._houseDnc, record._houseTotal, "election-meter-dnc")}
                ${meterSeg(record._houseGop, record._houseTotal, "election-meter-gop")}
                ${meterSeg(record._houseInd, record._houseTotal, "election-meter-ind")}
                ${meterSeg(record._houseVacant, record._houseTotal, "election-meter-vacant")}
              </div>
            </section>

            <section class="election-info-tile">
              <strong>Senate Control: ${safeHTML(record._senateControl)}</strong>
              <span>DNC ${safeHTML(record._senateDnc)} | GOP ${safeHTML(record._senateGop)} | IND ${safeHTML(record._senateInd)} | Vacant ${safeHTML(record._senateVacant)}</span>
              <div class="election-meter" style="margin-top:10px;">
                ${meterSeg(record._senateDnc, record._senateTotal, "election-meter-dnc")}
                ${meterSeg(record._senateGop, record._senateTotal, "election-meter-gop")}
                ${meterSeg(record._senateInd, record._senateTotal, "election-meter-ind")}
                ${meterSeg(record._senateVacant, record._senateTotal, "election-meter-vacant")}
              </div>
            </section>
          </div>

          <div class="election-grid-3">
            ${resultTile("House DNC", record._houseDnc, "DNC")}
            ${resultTile("House GOP", record._houseGop, "GOP")}
            ${resultTile("Senate DNC", record._senateDnc, "DNC")}
            ${resultTile("Senate GOP", record._senateGop, "GOP")}
            ${resultTile("House Vacant", record._houseVacant, "VACANT")}
            ${resultTile("Senate Vacant", record._senateVacant, "VACANT")}
          </div>

          <p class="election-summary">${safeHTML(summaryTrim(record._summary))}</p>

          <div class="election-actions">
            <button type="button" data-election-copy="${safeHTML(record._id)}">Copy Summary</button>
          </div>
        </div>
      </article>
    `;
  }

  function recordCard(record) {
    if (record._recordType === "CONGRESS") return congressCard(record);
    return potusCard(record);
  }

  function uniqueYears() {
    return Array.from(new Set(ALL_RECORDS.map((record) => record._year).filter(Boolean)))
      .sort((a, b) => toNumber(b, 0) - toNumber(a, 0));
  }

  function renderFilters() {
    const years = uniqueYears();

    return `
      <aside class="election-filter-panel">
        <section class="election-filter-card">
          <div class="eyebrow">Filter Hall</div>
          <h3>Election Records</h3>

          <div class="election-control">
            <label for="election-search">Search</label>
            <input id="election-search" type="search" placeholder="Search winner, party, year, summary..." />
          </div>

          <div class="election-control">
            <label for="election-record-filter">Record Type</label>
            <select id="election-record-filter">
              <option value="all">All Records</option>
              <option value="POTUS">Presidential</option>
              <option value="CONGRESS">Congressional</option>
            </select>
          </div>

          <div class="election-control">
            <label for="election-year-filter">Year</label>
            <select id="election-year-filter">
              <option value="all">All Years</option>
              ${years.map((year) => `<option value="${safeHTML(year)}">${safeHTML(year)}</option>`).join("")}
            </select>
          </div>

          <div class="election-control">
            <label for="election-party-filter">Party / Control</label>
            <select id="election-party-filter">
              <option value="all">All Parties</option>
              <option value="DNC">DNC</option>
              <option value="GOP">GOP</option>
              <option value="IND">IND</option>
              <option value="SPLIT">Split</option>
            </select>
          </div>

          <div class="election-control">
            <label for="election-sort-filter">Sort</label>
            <select id="election-sort-filter">
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="type">Record Type</option>
              <option value="winner">Winner / Control</option>
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

        <section class="election-filter-card">
          <div class="eyebrow">Loaded Sheets</div>
          <h3>Archive Sources</h3>

          <div class="election-stat-grid">
            <div class="election-stat">
              <strong>${safeHTML(POTUS_ELECTIONS.length.toLocaleString())}</strong>
              <span>POTUS</span>
            </div>
            <div class="election-stat">
              <strong>${safeHTML(CONGRESS_ELECTIONS.length.toLocaleString())}</strong>
              <span>Congress</span>
            </div>
          </div>
        </section>
      </aside>
    `;
  }

  function renderShell() {
    const root = getEl("#election-hall-root");
    if (!root) return;

    root.innerHTML = `
      <div class="election-hall">
        <div class="election-top-grid">
          ${renderFilters()}

          <section>
            <div class="election-quick-bar">
              <button class="election-pill-btn is-active" type="button" data-election-quick="all">All</button>
              <button class="election-pill-btn" type="button" data-election-quick="potus">Presidential</button>
              <button class="election-pill-btn" type="button" data-election-quick="congress">Congress</button>
              <button class="election-pill-btn" type="button" data-election-quick="dnc">DNC</button>
              <button class="election-pill-btn" type="button" data-election-quick="gop">GOP</button>
              <button class="election-pill-btn" type="button" data-election-quick="split">Split</button>
            </div>

            <div id="election-list" class="election-list"></div>
          </section>
        </div>
      </div>
    `;
  }

  function sortRecords(rows, sort) {
    return [...rows].sort((a, b) => {
      if (sort === "oldest") return a._yearNumber - b._yearNumber;
      if (sort === "type") return a._recordType.localeCompare(b._recordType) || b._yearNumber - a._yearNumber;
      if (sort === "winner") return cleanCell(a._winner).localeCompare(cleanCell(b._winner));

      return b._yearNumber - a._yearNumber || a._recordType.localeCompare(b._recordType);
    });
  }

  function applyFilters() {
    const search = cleanCell(getEl("#election-search")?.value || "").toLowerCase();
    const recordType = cleanCell(getEl("#election-record-filter")?.value || "all");
    const year = cleanCell(getEl("#election-year-filter")?.value || "all");
    const party = cleanCell(getEl("#election-party-filter")?.value || "all");
    const sort = cleanCell(getEl("#election-sort-filter")?.value || "newest");

    FILTERED_RECORDS = ALL_RECORDS.filter((record) => {
      if (search && !record._searchText.includes(search)) return false;
      if (recordType !== "all" && record._recordType !== recordType) return false;
      if (year !== "all" && record._year !== year) return false;

      if (party !== "all") {
        const matchesWinner = record._winnerParty === party;
        const matchesHouse = record._houseControl === party;
        const matchesSenate = record._senateControl === party;

        if (!matchesWinner && !matchesHouse && !matchesSenate) return false;
      }

      return true;
    });

    FILTERED_RECORDS = sortRecords(FILTERED_RECORDS, sort);

    renderList();
    renderCounts();
  }

  function setQuick(type) {
    const search = getEl("#election-search");
    const recordFilter = getEl("#election-record-filter");
    const partyFilter = getEl("#election-party-filter");
    const yearFilter = getEl("#election-year-filter");

    if (search) search.value = "";
    if (recordFilter) recordFilter.value = "all";
    if (partyFilter) partyFilter.value = "all";
    if (yearFilter) yearFilter.value = "all";

    if (type === "potus" && recordFilter) recordFilter.value = "POTUS";
    if (type === "congress" && recordFilter) recordFilter.value = "CONGRESS";
    if (type === "dnc" && partyFilter) partyFilter.value = "DNC";
    if (type === "gop" && partyFilter) partyFilter.value = "GOP";
    if (type === "split" && partyFilter) partyFilter.value = "SPLIT";

    document.querySelectorAll("[data-election-quick]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.electionQuick === type);
    });

    applyFilters();
  }

  function renderList() {
    const slot = getEl("#election-list");
    if (!slot) return;

    if (!FILTERED_RECORDS.length) {
      slot.innerHTML = `
        <div class="election-empty">
          No election records match the current filters.
        </div>
      `;
      return;
    }

    slot.innerHTML = FILTERED_RECORDS.map(recordCard).join("");

    slot.querySelectorAll("[data-election-copy]").forEach((button) => {
      button.addEventListener("click", async () => {
        const id = button.dataset.electionCopy;
        const record = ALL_RECORDS.find((item) => item._id === id);

        if (!record) return;

        const text = `${record._title} — ${record._summary}`;

        try {
          await navigator.clipboard.writeText(text);
          button.textContent = "Copied";
          setTimeout(() => {
            button.textContent = "Copy Summary";
          }, 1200);
        } catch {
          button.textContent = "Copy Failed";
          setTimeout(() => {
            button.textContent = "Copy Summary";
          }, 1200);
        }
      });
    });
  }

  function renderCounts() {
    const count = getEl("#election-count");
    const total = getEl("#election-total-count");

    if (count) count.textContent = FILTERED_RECORDS.length.toLocaleString();
    if (total) total.textContent = ALL_RECORDS.length.toLocaleString();
  }

  function setupEvents() {
    getEl("#election-search")?.addEventListener("input", applyFilters);
    getEl("#election-record-filter")?.addEventListener("change", applyFilters);
    getEl("#election-year-filter")?.addEventListener("change", applyFilters);
    getEl("#election-party-filter")?.addEventListener("change", applyFilters);
    getEl("#election-sort-filter")?.addEventListener("change", applyFilters);

    document.querySelectorAll("[data-election-quick]").forEach((button) => {
      button.addEventListener("click", () => setQuick(button.dataset.electionQuick || "all"));
    });
  }

  function updateHeroCard() {
    const hero = getEl("#elections-hero-card");
    if (!hero) return;

    const latest = [...ALL_RECORDS].sort((a, b) => b._yearNumber - a._yearNumber)[0];

    hero.innerHTML = `
      <div class="eyebrow">Archive Status</div>
      <h2>${safeHTML(ALL_RECORDS.length.toLocaleString())} Election Records Loaded</h2>
      <p>
        ${safeHTML(POTUS_ELECTIONS.length.toLocaleString())} presidential records and
        ${safeHTML(CONGRESS_ELECTIONS.length.toLocaleString())} congressional records.
        ${latest ? ` Latest: ${safeHTML(latest._year)}.` : ""}
      </p>
    `;
  }

  async function initElections() {
    try {
      injectElectionStyles();
      await loadRecords();

      renderShell();
      renderList();
      renderCounts();
      setupEvents();
      updateHeroCard();
    } catch (error) {
      console.error("Election Hall failed:", error);

      const root = getEl("#election-hall-root");
      if (root) {
        root.innerHTML = `
          <div class="archive-card">
            <div class="eyebrow">Error</div>
            <h2>Election Hall failed to load</h2>
            <p>${safeHTML(error.message)}</p>
          </div>
        `;
      }
    }
  }

  document.addEventListener("DOMContentLoaded", initElections);
})();