/* APRP Federal Archive — Government Directory
   Fixed state panel, darker compact popup, cleaner split House delegation stripes.
*/

(function () {
  const { fetchSheets, cleanCell, safeHTML, groupBy, showError } = window.APRP;
  const { partyBadge, renderSplitBar, officialNotice, emptyState } = window.APRP_UI;

  const MAPBOX_TOKEN = "YOUR_MAPBOX_TOKEN_HERE";
  const US_STATES_GEOJSON_URL = "https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json";

  let GOVERNMENT_DATA = { districts: [], governors: [], senate: [], leadership: [] };
  let CURRENT_MAP_MODE = "region";
  let govMap = null;
  let loadedGeoJSON = null;

  const STATE_NAME_TO_ABBR = {
    Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA",
    Colorado: "CO", Connecticut: "CT", Delaware: "DE", "District of Columbia": "DC",
    Florida: "FL", Georgia: "GA", Hawaii: "HI", Idaho: "ID", Illinois: "IL",
    Indiana: "IN", Iowa: "IA", Kansas: "KS", Kentucky: "KY", Louisiana: "LA",
    Maine: "ME", Maryland: "MD", Massachusetts: "MA", Michigan: "MI",
    Minnesota: "MN", Mississippi: "MS", Missouri: "MO", Montana: "MT",
    Nebraska: "NE", Nevada: "NV", "New Hampshire": "NH", "New Jersey": "NJ",
    "New Mexico": "NM", "New York": "NY", "North Carolina": "NC",
    "North Dakota": "ND", Ohio: "OH", Oklahoma: "OK", Oregon: "OR",
    Pennsylvania: "PA", "Rhode Island": "RI", "South Carolina": "SC",
    "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT",
    Vermont: "VT", Virginia: "VA", Washington: "WA", "West Virginia": "WV",
    Wisconsin: "WI", Wyoming: "WY",
  };

  const STATE_NAMES = Object.fromEntries(
    Object.entries(STATE_NAME_TO_ABBR).map(([name, abbr]) => [abbr, name])
  );

  const STATE_TO_REGION_FALLBACK = {
    AL: "columbia", AK: "phoenix", AZ: "yellowstone", AR: "austin", CA: "phoenix",
    CO: "yellowstone", CT: "cambridge", DE: "cambridge", DC: "columbia",
    FL: "columbia", GA: "columbia", HI: "phoenix", ID: "yellowstone",
    IL: "superior", IN: "superior", IA: "heartland", KS: "heartland",
    KY: "columbia", LA: "austin", ME: "cambridge", MD: "cambridge",
    MA: "cambridge", MI: "superior", MN: "heartland", MS: "columbia",
    MO: "heartland", MT: "yellowstone", NE: "heartland", NV: "phoenix",
    NH: "cambridge", NJ: "cambridge", NM: "yellowstone", NY: "cambridge",
    NC: "columbia", ND: "heartland", OH: "superior", OK: "austin",
    OR: "phoenix", PA: "cambridge", RI: "cambridge", SC: "columbia",
    SD: "heartland", TN: "columbia", TX: "austin", UT: "yellowstone",
    VT: "cambridge", VA: "columbia", WA: "phoenix", WV: "columbia",
    WI: "superior", WY: "yellowstone",
  };

  const REGION_NAMES = {
    columbia: "Columbia",
    cambridge: "Cambridge",
    yellowstone: "Yellowstone",
    phoenix: "Phoenix",
    austin: "Austin",
    superior: "Superior",
    heartland: "Heartland",
    unknown: "Unknown Region",
  };

  const REGION_ID_ALIASES = {
    CO: "columbia", COLUMBIA: "columbia",
    CA: "cambridge", CAMBRIDGE: "cambridge",
    YS: "yellowstone", YELLOWSTONE: "yellowstone",
    PH: "phoenix", PHOENIX: "phoenix",
    AU: "austin", AUSTIN: "austin",
    SU: "superior", SUPERIOR: "superior",
    HL: "heartland", HEARTLAND: "heartland",
  };

  const REGION_COLORS = {
    columbia: "#7f1d1d",
    cambridge: "#1e3a8a",
    yellowstone: "#92400e",
    phoenix: "#9a3412",
    austin: "#4c1d95",
    superior: "#166534",
    heartland: "#155e75",
    unknown: "#64748b",
  };

  const PARTY_COLORS = {
    DNC: "#2563eb",
    GOP: "#b91c1c",
    IND: "#7c3aed",
    OTHER: "#b0892f",
    VACANT: "#94a3b8",
    SPLIT: "#8b5cf6",
    UNKNOWN: "#64748b",
  };

  function injectGovernmentMapStyles() {
    if (document.querySelector("#aprp-government-map-style")) return;

    const style = document.createElement("style");
    style.id = "aprp-government-map-style";
    style.textContent = `
      #government-mapbox {
        position: relative;
        overflow: hidden;
      }

      .gov-fixed-popup {
        position: absolute;
        top: 16px;
        right: 16px;
        z-index: 20;
        width: 250px;
        max-height: calc(100% - 32px);
        overflow: auto;
        background: rgba(4, 13, 27, .96);
        color: #eaf2ff;
        border: 1px solid rgba(148, 163, 184, .22);
        border-radius: 16px;
        box-shadow: 0 22px 55px rgba(0, 0, 0, .42);
        backdrop-filter: blur(10px);
      }

      .gov-fixed-popup.is-hidden {
        display: none;
      }

      .gov-fixed-popup-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 10px;
        padding: 10px 11px;
        background: linear-gradient(135deg, rgba(11, 30, 61, .98), rgba(7, 17, 31, .98));
        border-bottom: 1px solid rgba(148, 163, 184, .18);
      }

      .gov-fixed-popup-header h3 {
        margin: 0;
        color: #fff;
        font-family: Georgia, serif;
        font-size: 1rem;
        line-height: 1.05;
      }

      .gov-fixed-popup-header p {
        margin: 3px 0 0;
        color: #9fb3cf;
        font-size: .68rem;
        font-weight: 800;
      }

      .gov-fixed-popup-close {
        width: 23px;
        height: 23px;
        border: 1px solid rgba(255,255,255,.12);
        border-radius: 999px;
        background: rgba(255,255,255,.08);
        color: #dbeafe;
        font-weight: 950;
        cursor: pointer;
      }

      .gov-fixed-popup-body {
        padding: 10px 11px 11px;
        display: grid;
        gap: 9px;
        font-size: .78rem;
      }

      .gov-fixed-popup-section {
        display: grid;
        gap: 4px;
      }

      .gov-fixed-popup-section strong {
        color: #f8fafc;
        font-size: .72rem;
        letter-spacing: .04em;
        text-transform: uppercase;
      }

      .gov-fixed-popup-section p {
        margin: 0;
        color: #cbd5e1;
      }

      .gov-fixed-delegation {
        display: grid;
        gap: 6px;
      }

      .gov-fixed-row {
        display: grid;
        gap: 3px;
        padding: 7px 8px;
        border-radius: 10px;
        background: rgba(255,255,255,.065);
        border: 1px solid rgba(255,255,255,.10);
      }

      .gov-fixed-row-top {
        display: flex;
        justify-content: space-between;
        gap: 7px;
        align-items: center;
        color: #fff;
        font-weight: 950;
        font-size: .74rem;
      }

      .gov-fixed-row-bottom {
        display: flex;
        justify-content: space-between;
        gap: 7px;
        align-items: center;
        color: #cbd5e1;
        font-weight: 750;
        font-size: .74rem;
      }

      .gov-fixed-score {
        padding-top: 7px;
        border-top: 1px solid rgba(255,255,255,.10);
        color: #dbeafe;
        font-weight: 850;
      }

      .gov-mini-list {
        display: grid;
        gap: 7px;
        margin-top: 7px;
      }

      .gov-mini-row {
        display: grid;
        gap: 3px;
        padding: 8px 9px;
        border-radius: 10px;
        background: rgba(255,255,255,.07);
        border: 1px solid rgba(255,255,255,.10);
      }

      .gov-mini-row strong {
        color: inherit;
        font-size: .82rem;
      }

      .gov-mini-row span {
        color: inherit;
        font-size: .84rem;
      }

      @media (max-width: 850px) {
        .gov-fixed-popup {
          left: 12px;
          right: 12px;
          top: auto;
          bottom: 12px;
          width: auto;
          max-height: 46%;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function normalizeRegionId(value) {
    const raw = cleanCell(value).trim();
    const upper = raw.toUpperCase();
    if (REGION_ID_ALIASES[upper]) return REGION_ID_ALIASES[upper];
    return raw.toLowerCase();
  }

  function normalizeParty(party) {
    const value = cleanCell(party).toUpperCase();
    if (["D", "DEM", "DEMOCRAT", "DEMOCRATIC", "DNC"].includes(value)) return "DNC";
    if (["R", "REP", "REPUBLICAN", "GOP"].includes(value)) return "GOP";
    if (["I", "IND", "INDEPENDENT"].includes(value)) return "IND";
    if (["VACANT", "-", "—", "NONE", "N/A", ""].includes(value)) return "VACANT";
    return value || "OTHER";
  }

  function partyColor(party) {
    return PARTY_COLORS[normalizeParty(party)] || PARTY_COLORS.OTHER;
  }

  function countParties(rows, partyKey = "party") {
    const counts = { DNC: 0, GOP: 0, IND: 0, VACANT: 0, OTHER: 0 };

    rows.forEach((row) => {
      const status = cleanCell(row.status).toLowerCase();
      const party = status === "vacant" ? "VACANT" : normalizeParty(row[partyKey]);
      if (counts[party] === undefined) counts.OTHER += 1;
      else counts[party] += 1;
    });

    return counts;
  }

  function rowRegion(row) {
    return normalizeRegionId(row?.region_id || row?.region || row?.region_name);
  }

  function rowRegionName(row) {
    const id = rowRegion(row);
    return REGION_NAMES[id] || cleanCell(row?.region_name) || id || "Unknown Region";
  }

  function splitStates(value) {
    return cleanCell(value)
      .split(/[,;/|]+/)
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
  }

  function districtMatchesState(district, stateAbbr) {
    const stateName = STATE_NAMES[stateAbbr] || stateAbbr;
    const lowerName = stateName.toLowerCase();
    const lowerAbbr = stateAbbr.toLowerCase();
    const states = splitStates(district.states);
    const explicitState = cleanCell(district.state || district.state_abbr).toLowerCase();

    return (
      explicitState === lowerAbbr ||
      explicitState === lowerName ||
      states.includes(lowerName) ||
      states.includes(lowerAbbr)
    );
  }

  function getDistrictsForState(stateAbbr) {
    return GOVERNMENT_DATA.districts.filter((district) => districtMatchesState(district, stateAbbr));
  }

  function getRegionForState(stateAbbr) {
    const district = getDistrictsForState(stateAbbr)[0];

    if (district) {
      const id = rowRegion(district);
      return {
        id,
        name: rowRegionName(district),
        color: cleanCell(district.color) || REGION_COLORS[id] || REGION_COLORS.unknown,
      };
    }

    const fallback = STATE_TO_REGION_FALLBACK[stateAbbr] || "unknown";
    return {
      id: fallback,
      name: REGION_NAMES[fallback] || "Unknown Region",
      color: REGION_COLORS[fallback] || REGION_COLORS.unknown,
    };
  }

  function getGovernorForRegion(regionId) {
    return GOVERNMENT_DATA.governors.find((row) => rowRegion(row) === regionId);
  }

  function getSenatorsForRegion(regionId) {
    return GOVERNMENT_DATA.senate.filter((row) => rowRegion(row) === regionId);
  }

  function getGovernorName(row) {
    if (!row) return "Vacant";
    return row.governor || row.name || row.officeholder || row.person || row.holder || row.current_governor || "Vacant";
  }

  function getSenatorName(row) {
    if (!row) return "Vacant";
    return row.senator || row.name || row.officeholder || row.person || row.holder || "Vacant";
  }

  function getSenatorClass(row) {
    const raw = row?.class || row?.senate_class || row?.senator_class || row?.seat_class || row?.class_number || row?.seat || "";
    const value = cleanCell(raw).replace(/class/i, "").trim();

    if (["1", "2", "3"].includes(value)) return `Class ${value}`;
    if (value) return value.toLowerCase().startsWith("class") ? value : `Class ${value}`;
    return "Senator";
  }

  function getRepresentativeName(row) {
    if (!row) return "Vacant";
    return row.representative || row.rep || row.name || row.officeholder || row.person || row.holder || "Vacant";
  }

  function getDistrictName(row) {
    if (!row) return "No district found";
    return row.district_name || row.district_code || row.district || row.seat || "District";
  }

  function getLeadershipTitle(row) {
    return row.title || row.office || row.position || row.role || "Office";
  }

  function getLeadershipName(row) {
    return row.name || row.officeholder || row.person || row.holder || row.value || "Vacant";
  }

  function getLeadershipParty(row) {
    return row.party || row.party_id || "";
  }

  function senateRegionParty(regionId) {
    const senators = getSenatorsForRegion(regionId);
    const counts = countParties(senators);

    if (!senators.length) return "VACANT";
    if (counts.DNC > counts.GOP && counts.DNC > counts.IND) return "DNC";
    if (counts.GOP > counts.DNC && counts.GOP > counts.IND) return "GOP";
    if (counts.IND > counts.DNC && counts.IND > counts.GOP) return "IND";
    return "SPLIT";
  }

  function houseDelegationCounts(stateAbbr) {
    return countParties(getDistrictsForState(stateAbbr));
  }

  function dominantHouseParty(stateAbbr) {
    const counts = houseDelegationCounts(stateAbbr);
    const entries = Object.entries(counts)
      .filter(([party]) => party !== "VACANT" && party !== "OTHER")
      .sort((a, b) => b[1] - a[1]);

    if (!entries.length) return counts.OTHER > 0 ? "OTHER" : "VACANT";
    if (entries.length > 1 && entries[0][1] === entries[1][1]) return "SPLIT";
    return entries[0][0];
  }

  function scoreStatePartyStrength(stateAbbr) {
    const districts = getDistrictsForState(stateAbbr);
    const region = getRegionForState(stateAbbr);
    const governor = getGovernorForRegion(region.id);
    const senators = getSenatorsForRegion(region.id);
    const scores = { DNC: 0, GOP: 0, IND: 0, OTHER: 0 };

    const add = (party, points) => {
      const normalized = normalizeParty(party);
      if (normalized === "VACANT") return;
      if (scores[normalized] === undefined) scores.OTHER += points;
      else scores[normalized] += points;
    };

    if (governor) add(governor.party, 4);
    senators.forEach((senator) => add(senator.party, 2));
    districts.forEach((district) => add(district.party, 0.5));

    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const leader = sorted[0];
    const runnerUp = sorted[1];
    const margin = leader[1] - runnerUp[1];

    let rating = "Mixed";
    if (margin >= 6) rating = `Strong ${leader[0]}`;
    else if (margin >= 3) rating = `Likely ${leader[0]}`;
    else if (margin >= 1) rating = `Lean ${leader[0]}`;

    return { scores, leader: leader[0], margin, rating, districts, governor, senators, region };
  }

  function getStrengthColor(stateAbbr) {
    const { leader, margin } = scoreStatePartyStrength(stateAbbr);

    if (margin < 1) return PARTY_COLORS.VACANT;

    if (leader === "DNC") {
      if (margin >= 6) return "#1d4ed8";
      if (margin >= 3) return "#3b82f6";
      return "#93c5fd";
    }

    if (leader === "GOP") {
      if (margin >= 6) return "#991b1b";
      if (margin >= 3) return "#dc2626";
      return "#fca5a5";
    }

    if (leader === "IND") return PARTY_COLORS.IND;
    return PARTY_COLORS.OTHER;
  }

  function baseStateColor(stateAbbr) {
    const region = getRegionForState(stateAbbr);
    const governor = getGovernorForRegion(region.id);
    const senateParty = senateRegionParty(region.id);
    const houseParty = dominantHouseParty(stateAbbr);

    if (CURRENT_MAP_MODE === "region") return region.color;
    if (CURRENT_MAP_MODE === "strength") return getStrengthColor(stateAbbr);

    if (CURRENT_MAP_MODE === "district") {
      if (houseParty === "SPLIT") return "#334155";
      return partyColor(houseParty);
    }

    if (CURRENT_MAP_MODE === "senate") {
      return senateParty === "SPLIT" ? PARTY_COLORS.SPLIT : partyColor(senateParty);
    }

    if (CURRENT_MAP_MODE === "governor") return partyColor(governor?.party || "VACANT");
    return REGION_COLORS.unknown;
  }

  function mapPatternId(stateAbbr) {
    if (CURRENT_MAP_MODE !== "district") return "";

    const counts = houseDelegationCounts(stateAbbr);
    const active = [
      counts.DNC > 0 ? "DNC" : "",
      counts.GOP > 0 ? "GOP" : "",
      counts.IND > 0 ? "IND" : "",
      counts.OTHER > 0 ? "OTHER" : "",
      counts.VACANT > 0 ? "VACANT" : "",
    ].filter(Boolean);

    if (active.length <= 1) return "";
    return `pattern-${stateAbbr}`;
  }

  function modeTitle() {
    if (CURRENT_MAP_MODE === "region") return "Region Mode";
    if (CURRENT_MAP_MODE === "strength") return "Party Strength Mode";
    if (CURRENT_MAP_MODE === "district") return "District Map";
    if (CURRENT_MAP_MODE === "senate") return "Senate Map";
    if (CURRENT_MAP_MODE === "governor") return "Governor Map";
    return "Government Map";
  }

  function renderNotice() {
    const slot = document.querySelector("#government-notice");
    if (!slot) return;

    slot.innerHTML = officialNotice(
      "Regional party strength is calculated as Governor = 4 points, each Senator = 2 points, and each Representative = 0.5 points. District mode shows split House delegations with clear proportional party blocks."
    );
  }

  function renderControlBars() {
    const houseCounts = countParties(GOVERNMENT_DATA.districts);
    const senateCounts = countParties(GOVERNMENT_DATA.senate);
    const governorCounts = countParties(GOVERNMENT_DATA.governors);

    renderSplitBar("#house-bar", [
      { label: "DNC", value: houseCounts.DNC, className: "party-dnc" },
      { label: "GOP", value: houseCounts.GOP, className: "party-gop" },
      { label: "IND", value: houseCounts.IND, className: "party-ind" },
      { label: "Vacant", value: houseCounts.VACANT, className: "party-vacant" },
    ]);

    renderSplitBar("#senate-bar", [
      { label: "DNC", value: senateCounts.DNC, className: "party-dnc" },
      { label: "GOP", value: senateCounts.GOP, className: "party-gop" },
      { label: "IND", value: senateCounts.IND, className: "party-ind" },
      { label: "Vacant", value: senateCounts.VACANT, className: "party-vacant" },
    ]);

    renderSplitBar("#governor-bar", [
      { label: "DNC", value: governorCounts.DNC, className: "party-dnc" },
      { label: "GOP", value: governorCounts.GOP, className: "party-gop" },
      { label: "IND", value: governorCounts.IND, className: "party-ind" },
      { label: "Vacant", value: governorCounts.VACANT, className: "party-vacant" },
    ]);
  }

  function renderExecutiveSummary() {
    const slotTitle = document.querySelector("#exec-title");
    const slotSummary = document.querySelector("#exec-summary");

    const president = GOVERNMENT_DATA.leadership.find((row) =>
      cleanCell(getLeadershipTitle(row)).toLowerCase().includes("president")
    );

    const vp = GOVERNMENT_DATA.leadership.find((row) => {
      const title = cleanCell(getLeadershipTitle(row)).toLowerCase();
      return title.includes("vice president") || title === "vp";
    });

    if (slotTitle) slotTitle.textContent = president ? getLeadershipName(president) : "Executive Branch";

    if (slotSummary) {
      slotSummary.innerHTML = `
        ${president ? `${safeHTML(getLeadershipTitle(president))}: ${partyBadge(getLeadershipParty(president))}` : "No president record found."}
        <br>
        ${vp ? `Vice President: ${safeHTML(getLeadershipName(vp))} ${partyBadge(getLeadershipParty(vp))}` : ""}
      `;
    }
  }

  function renderLeadership() {
    const slot = document.querySelector("#leadership-grid");
    if (!slot) return;

    if (!GOVERNMENT_DATA.leadership.length) {
      slot.innerHTML = emptyState("No leadership records found");
      return;
    }

    slot.innerHTML = GOVERNMENT_DATA.leadership.map((row) => `
      <article class="archive-card compact-card">
        <div class="eyebrow">${safeHTML(getLeadershipTitle(row))}</div>
        <h3>${safeHTML(getLeadershipName(row))}</h3>
        <p>${partyBadge(getLeadershipParty(row))}</p>
      </article>
    `).join("");
  }

  function districtListHTML(districts) {
    if (!districts.length) return `<p>No House district records found.</p>`;

    return `
      <div class="gov-mini-list">
        ${districts.map((district) => `
          <div class="gov-mini-row">
            <strong>${safeHTML(getDistrictName(district))}</strong>
            <span>${safeHTML(getRepresentativeName(district))} ${partyBadge(district.party)}</span>
          </div>
        `).join("")}
      </div>
    `;
  }

  function fixedDistrictListHTML(districts) {
    if (!districts.length) return `<p>No House district records found.</p>`;

    return `
      <div class="gov-fixed-delegation">
        ${districts.map((district) => `
          <div class="gov-fixed-row">
            <div class="gov-fixed-row-top">
              <span>${safeHTML(getDistrictName(district))}</span>
              <span>${partyBadge(district.party)}</span>
            </div>
            <div class="gov-fixed-row-bottom">
              <span>${safeHTML(getRepresentativeName(district))}</span>
            </div>
          </div>
        `).join("")}
      </div>
    `;
  }

  function delegationSummaryHTML(stateAbbr) {
    const counts = houseDelegationCounts(stateAbbr);
    const parts = [];

    if (counts.DNC) parts.push(`DNC ${counts.DNC}`);
    if (counts.GOP) parts.push(`GOP ${counts.GOP}`);
    if (counts.IND) parts.push(`IND ${counts.IND}`);
    if (counts.OTHER) parts.push(`OTH ${counts.OTHER}`);
    if (counts.VACANT) parts.push(`Vacant ${counts.VACANT}`);

    return parts.length ? parts.join(" | ") : "No House delegation";
  }

  function stateDetailHTML(stateAbbr) {
    const stateName = STATE_NAMES[stateAbbr] || stateAbbr;
    const result = scoreStatePartyStrength(stateAbbr);
    const { region, districts, governor, senators, scores, rating } = result;
    const senateParty = senateRegionParty(region.id);

    return `
      <div class="eyebrow">${safeHTML(modeTitle())}</div>
      <h3>${safeHTML(stateName)}</h3>

      <p>
        <strong>Region:</strong> ${safeHTML(region.name)}<br>
        <strong>House Delegation:</strong> ${safeHTML(delegationSummaryHTML(stateAbbr))}
      </p>

      <div class="mt-2">
        <strong>Representatives</strong>
        ${districtListHTML(districts)}
      </div>

      <div class="mt-2">
        <strong>Governor</strong>
        <p>${safeHTML(getGovernorName(governor))} ${partyBadge(governor?.party || "VACANT")}</p>
      </div>

      <div class="mt-2">
        <strong>Senate Control</strong>
        <p>${partyBadge(senateParty)} ${senateParty === "SPLIT" ? "Split delegation" : ""}</p>
      </div>

      <div class="mt-2">
        <strong>Senators</strong>
        ${
          senators.length
            ? senators.map((senator) => `
              <p>${safeHTML(getSenatorClass(senator))} Senator:
              ${safeHTML(getSenatorName(senator))}
              ${partyBadge(senator.party)}</p>
            `).join("")
            : "<p>No Senate records found.</p>"
        }
      </div>

      <div class="mt-2">
        <strong>Regional Party Strength</strong>
        <p>DNC ${scores.DNC.toFixed(1)} | GOP ${scores.GOP.toFixed(1)} | IND ${scores.IND.toFixed(1)}</p>
        <span class="status-badge">${safeHTML(rating)}</span>
      </div>
    `;
  }

  function selectState(stateAbbr) {
    const detail = document.querySelector("#state-detail");
    if (detail) detail.innerHTML = stateDetailHTML(stateAbbr);
    showFixedStatePanel(stateAbbr);
  }

  function showFixedStatePanel(stateAbbr) {
    const slot = document.querySelector("#gov-fixed-popup");
    if (!slot) return;

    const stateName = STATE_NAMES[stateAbbr] || stateAbbr;
    const result = scoreStatePartyStrength(stateAbbr);
    const { region, districts, governor, senators, scores, rating } = result;
    const senateParty = senateRegionParty(region.id);

    slot.innerHTML = `
      <div class="gov-fixed-popup-header">
        <div>
          <h3>${safeHTML(stateName)}</h3>
          <p>${safeHTML(modeTitle())}</p>
        </div>
        <button class="gov-fixed-popup-close" type="button">×</button>
      </div>

      <div class="gov-fixed-popup-body">
        <div class="gov-fixed-popup-section">
          <strong>Region</strong>
          <p>${safeHTML(region.name)}</p>
        </div>

        <div class="gov-fixed-popup-section">
          <strong>House Delegation</strong>
          <p>${safeHTML(delegationSummaryHTML(stateAbbr))}</p>
          ${fixedDistrictListHTML(districts)}
        </div>

        <div class="gov-fixed-popup-section">
          <strong>Governor</strong>
          <p>${safeHTML(getGovernorName(governor))} ${partyBadge(governor?.party || "VACANT")}</p>
        </div>

        <div class="gov-fixed-popup-section">
          <strong>Senate</strong>
          <p>${partyBadge(senateParty)} ${senateParty === "SPLIT" ? "Split delegation" : ""}</p>
          ${
            senators.length
              ? senators.map((senator) => `
                <p>${safeHTML(getSenatorClass(senator))}: ${safeHTML(getSenatorName(senator))} ${partyBadge(senator.party)}</p>
              `).join("")
              : "<p>No Senate records found.</p>"
          }
        </div>

        <div class="gov-fixed-score">
          DNC ${scores.DNC.toFixed(1)} | GOP ${scores.GOP.toFixed(1)} | IND ${scores.IND.toFixed(1)}
          <br>${safeHTML(rating)}
        </div>
      </div>
    `;

    slot.classList.remove("is-hidden");

    slot.querySelector(".gov-fixed-popup-close")?.addEventListener("click", () => {
      slot.classList.add("is-hidden");
    });
  }

  function renderRegionDirectory() {
    const slot = document.querySelector("#region-directory");
    if (!slot) return;

    if (!GOVERNMENT_DATA.districts.length) {
      slot.innerHTML = emptyState("No district records found");
      return;
    }

    const grouped = groupBy(GOVERNMENT_DATA.districts, "region_id");

    slot.innerHTML = Object.entries(grouped).map(([, rows]) => {
      const first = rows[0] || {};
      const regionName = rowRegionName(first);

      return `
        <article class="panel compact-card">
          <div class="eyebrow">${safeHTML(regionName)}</div>
          <h3>${safeHTML(regionName)}</h3>

          <div class="table-wrap mt-2">
            <table>
              <thead>
                <tr>
                  <th>District</th>
                  <th>States</th>
                  <th>Representative</th>
                  <th>Party</th>
                </tr>
              </thead>
              <tbody>
                ${rows.map((district) => `
                  <tr>
                    <td>${safeHTML(getDistrictName(district))}</td>
                    <td>${safeHTML(district.states || district.state || district.state_abbr)}</td>
                    <td>${safeHTML(getRepresentativeName(district))}</td>
                    <td>${partyBadge(district.party)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </article>
      `;
    }).join("");
  }

  function stateAbbrFromFeature(feature) {
    const name = feature?.properties?.name || feature?.properties?.NAME;
    return STATE_NAME_TO_ABBR[name] || "";
  }

  function hexToRgba(hex, alpha = 245) {
    const clean = String(hex || "#64748b").replace("#", "");
    const bigint = parseInt(clean, 16);
    return {
      r: (bigint >> 16) & 255,
      g: (bigint >> 8) & 255,
      b: bigint & 255,
      a: alpha,
    };
  }

  function makeEmptyPattern() {
    if (!govMap || govMap.hasImage("pattern-empty")) return;
    govMap.addImage("pattern-empty", { width: 1, height: 1, data: new Uint8Array([0, 0, 0, 0]) }, { pixelRatio: 1 });
  }

  function makeStripePattern(patternId, counts) {
    if (!govMap || govMap.hasImage(patternId)) return;

    const segments = [];
    const add = (party, amount) => {
      for (let i = 0; i < amount; i += 1) segments.push(partyColor(party));
    };

    add("DNC", counts.DNC);
    add("GOP", counts.GOP);
    add("IND", counts.IND);
    add("OTHER", counts.OTHER);
    add("VACANT", counts.VACANT);

    if (segments.length <= 1) return;

    const size = 96;
    const data = new Uint8Array(size * size * 4);

    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const segmentIndex = Math.min(segments.length - 1, Math.floor((x / size) * segments.length));
        const rgba = hexToRgba(segments[segmentIndex], 245);
        const index = (y * size + x) * 4;

        data[index] = rgba.r;
        data[index + 1] = rgba.g;
        data[index + 2] = rgba.b;
        data[index + 3] = rgba.a;

        const stripeWidth = size / segments.length;
        const boundaryDistance = Math.abs((x % stripeWidth) - 0);

        if (boundaryDistance < 1.5 && x > 1) {
          data[index] = 255;
          data[index + 1] = 255;
          data[index + 2] = 255;
          data[index + 3] = 255;
        }
      }
    }

    govMap.addImage(patternId, { width: size, height: size, data }, { pixelRatio: 1 });
  }

  function ensureDistrictPatterns() {
    if (!govMap) return;

    makeEmptyPattern();

    Object.keys(STATE_NAMES).forEach((stateAbbr) => {
      const pattern = mapPatternId(stateAbbr);
      if (!pattern) return;
      makeStripePattern(pattern, houseDelegationCounts(stateAbbr));
    });
  }

  function enrichGeoJSON(geojson) {
    const copy = JSON.parse(JSON.stringify(geojson));

    copy.features = copy.features.map((feature) => {
      const abbr = stateAbbrFromFeature(feature);

      return {
        ...feature,
        properties: {
          ...feature.properties,
          abbr,
          color: baseStateColor(abbr),
          pattern: mapPatternId(abbr),
        },
      };
    }).filter((feature) => feature.properties.abbr);

    return copy;
  }

  function updateMapColors() {
    if (!govMap || !govMap.getSource("gov-states") || !loadedGeoJSON) return;

    ensureDistrictPatterns();

    govMap.getSource("gov-states").setData(enrichGeoJSON(loadedGeoJSON));

    if (govMap.getLayer("gov-states-fill")) {
      govMap.setPaintProperty("gov-states-fill", "fill-color", ["get", "color"]);
    }

    if (govMap.getLayer("gov-states-stripes")) {
      govMap.setLayoutProperty("gov-states-stripes", "visibility", CURRENT_MAP_MODE === "district" ? "visible" : "none");

      govMap.setPaintProperty("gov-states-stripes", "fill-pattern", [
        "case",
        ["!=", ["get", "pattern"], ""],
        ["get", "pattern"],
        "pattern-empty",
      ]);
    }
  }

  async function loadStatesGeoJSON() {
    const response = await fetch(US_STATES_GEOJSON_URL, { cache: "force-cache" });
    if (!response.ok) throw new Error(`Could not load state GeoJSON: ${response.status}`);
    return response.json();
  }

  function setMapFallback(slot, message) {
    slot.innerHTML = `
      <div class="empty-state">
        <strong>Map failed to load</strong>
        <span>${safeHTML(message)}</span>
      </div>
    `;
  }

  function attachStateClick(layerId) {
    govMap.on("click", layerId, (event) => {
      const feature = event.features && event.features[0];
      const stateAbbr = cleanCell(feature?.properties?.abbr);
      if (!stateAbbr) return;
      selectState(stateAbbr);
    });

    govMap.on("mousemove", layerId, () => {
      govMap.getCanvas().style.cursor = "pointer";
    });

    govMap.on("mouseleave", layerId, () => {
      govMap.getCanvas().style.cursor = "";
    });
  }

  async function initMapboxMap() {
    const slot = document.querySelector("#government-mapbox");
    if (!slot) return;

    injectGovernmentMapStyles();

    if (!window.mapboxgl) {
      slot.innerHTML = emptyState("Mapbox did not load. Check internet connection.");
      return;
    }

    if (!document.querySelector("#gov-fixed-popup")) {
      const fixedPopup = document.createElement("div");
      fixedPopup.id = "gov-fixed-popup";
      fixedPopup.className = "gov-fixed-popup is-hidden";
      slot.appendChild(fixedPopup);
    }

    mapboxgl.accessToken = MAPBOX_TOKEN;

    govMap = new mapboxgl.Map({
      container: "government-mapbox",
      style: "mapbox://styles/mapbox/dark-v10",
      center: [-98.5795, 39.8283],
      zoom: window.innerWidth < 700 ? 2.5 : 3.25,
      minZoom: 2,
      maxZoom: 7,
      attributionControl: false,
    });

    govMap.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");

    govMap.on("load", async () => {
      try {
        makeEmptyPattern();
        loadedGeoJSON = await loadStatesGeoJSON();
        ensureDistrictPatterns();

        govMap.addSource("gov-states", {
          type: "geojson",
          data: enrichGeoJSON(loadedGeoJSON),
        });

        govMap.addLayer({
          id: "gov-states-fill",
          type: "fill",
          source: "gov-states",
          paint: {
            "fill-color": ["get", "color"],
            "fill-opacity": 0.9,
          },
        });

        govMap.addLayer({
          id: "gov-states-stripes",
          type: "fill",
          source: "gov-states",
          layout: {
            visibility: CURRENT_MAP_MODE === "district" ? "visible" : "none",
          },
          paint: {
            "fill-pattern": [
              "case",
              ["!=", ["get", "pattern"], ""],
              ["get", "pattern"],
              "pattern-empty",
            ],
            "fill-opacity": 1,
          },
        });

        govMap.addLayer({
          id: "gov-states-outline",
          type: "line",
          source: "gov-states",
          paint: {
            "line-color": "rgba(255,255,255,0.95)",
            "line-width": 1.35,
          },
        });

        attachStateClick("gov-states-fill");
        attachStateClick("gov-states-stripes");
      } catch (error) {
        console.error(error);
        setMapFallback(slot, error.message);
      }
    });

    govMap.on("error", (event) => {
      console.warn("Mapbox error:", event.error || event);
    });
  }

  function setupMapModeButtons() {
    const buttons = Array.from(document.querySelectorAll("[data-map-mode]"));

    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        CURRENT_MAP_MODE = button.dataset.mapMode || "region";

        buttons.forEach((btn) => btn.classList.remove("is-active"));
        button.classList.add("is-active");

        const fixedPopup = document.querySelector("#gov-fixed-popup");
        if (fixedPopup) fixedPopup.classList.add("is-hidden");

        updateMapColors();
      });
    });
  }

  async function initGovernment() {
    try {
      const data = await fetchSheets(["WEB_DISTRICTS", "WEB_GOV", "WEB_SEN", "WEB_LDR"]);

      GOVERNMENT_DATA = {
        districts: data.WEB_DISTRICTS || [],
        governors: data.WEB_GOV || [],
        senate: data.WEB_SEN || [],
        leadership: data.WEB_LDR || [],
      };

      renderNotice();
      renderControlBars();
      renderExecutiveSummary();
      renderLeadership();
      renderRegionDirectory();
      setupMapModeButtons();
      await initMapboxMap();
    } catch (error) {
      console.error(error);
      showError("#main", error.message);
    }
  }

  document.addEventListener("DOMContentLoaded", initGovernment);
})();