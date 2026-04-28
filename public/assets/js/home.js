/* APRP Federal Archive — Home Page Fixed
   Fixes:
   - Monthly Indicators card now reads WEB_MONTHLY correctly.
   - Latest monthly row ignores blank rows.
   - Supports potus_approval, oil_price, stock_market_index, job_creation.
   - Major events shortened to title + date.
   - Macro snapshot reads latest full WEB_ECON row.
   - Current administration image/background remains supported.
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

  const toNumber = (value, fallback = null) => {
    if (value === null || value === undefined || value === "") return fallback;

    const raw = String(value).trim();
    const leadingNumber = raw.match(/-?\d[\d,]*(?:\.\d+)?/);

    if (!leadingNumber) return fallback;

    const parsed = Number(leadingNumber[0].replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const CONFIG_CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQdNuab7OkXjYKw_DEPLXz1Urb8q4-8kwhcqPt1M7A-fxJa-9F6Cq6opGIKpUCf3KU29vo5PfvMCUNu/pub?gid=2117823602&single=true&output=csv";

  const FALLBACK_WHITE_HOUSE_IMAGE =
    "https://kommodo.ai/i/A8yXf2ZZf4SHHfDFegcO";

  const MAPBOX_TOKEN =
    "YOUR_MAPBOX_TOKEN_HERE";

  const US_STATES_GEOJSON_URL =
    "https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json";

  const STATE_NAME_TO_ABBR = {
    Alabama: "AL",
    Alaska: "AK",
    Arizona: "AZ",
    Arkansas: "AR",
    California: "CA",
    Colorado: "CO",
    Connecticut: "CT",
    Delaware: "DE",
    "District of Columbia": "DC",
    Florida: "FL",
    Georgia: "GA",
    Hawaii: "HI",
    Idaho: "ID",
    Illinois: "IL",
    Indiana: "IN",
    Iowa: "IA",
    Kansas: "KS",
    Kentucky: "KY",
    Louisiana: "LA",
    Maine: "ME",
    Maryland: "MD",
    Massachusetts: "MA",
    Michigan: "MI",
    Minnesota: "MN",
    Mississippi: "MS",
    Missouri: "MO",
    Montana: "MT",
    Nebraska: "NE",
    Nevada: "NV",
    "New Hampshire": "NH",
    "New Jersey": "NJ",
    "New Mexico": "NM",
    "New York": "NY",
    "North Carolina": "NC",
    "North Dakota": "ND",
    Ohio: "OH",
    Oklahoma: "OK",
    Oregon: "OR",
    Pennsylvania: "PA",
    "Rhode Island": "RI",
    "South Carolina": "SC",
    "South Dakota": "SD",
    Tennessee: "TN",
    Texas: "TX",
    Utah: "UT",
    Vermont: "VT",
    Virginia: "VA",
    Washington: "WA",
    "West Virginia": "WV",
    Wisconsin: "WI",
    Wyoming: "WY",
  };

  const STATE_NAMES = Object.fromEntries(
    Object.entries(STATE_NAME_TO_ABBR).map(([name, abbr]) => [abbr, name])
  );

  const STATE_TO_REGION = {
    AL: "Columbia",
    AK: "Phoenix",
    AZ: "Yellowstone",
    AR: "Austin",
    CA: "Phoenix",
    CO: "Yellowstone",
    CT: "Cambridge",
    DE: "Cambridge",
    DC: "Columbia",
    FL: "Columbia",
    GA: "Columbia",
    HI: "Phoenix",
    ID: "Yellowstone",
    IL: "Superior",
    IN: "Superior",
    IA: "Heartland",
    KS: "Heartland",
    KY: "Columbia",
    LA: "Austin",
    ME: "Cambridge",
    MD: "Cambridge",
    MA: "Cambridge",
    MI: "Superior",
    MN: "Heartland",
    MS: "Columbia",
    MO: "Heartland",
    MT: "Yellowstone",
    NE: "Heartland",
    NV: "Phoenix",
    NH: "Cambridge",
    NJ: "Cambridge",
    NM: "Yellowstone",
    NY: "Cambridge",
    NC: "Columbia",
    ND: "Heartland",
    OH: "Superior",
    OK: "Austin",
    OR: "Phoenix",
    PA: "Cambridge",
    RI: "Cambridge",
    SC: "Columbia",
    SD: "Heartland",
    TN: "Columbia",
    TX: "Austin",
    UT: "Yellowstone",
    VT: "Cambridge",
    VA: "Columbia",
    WA: "Phoenix",
    WV: "Columbia",
    WI: "Superior",
    WY: "Yellowstone",
  };

  const REGION_COLORS = {
    Columbia: "#7f1d1d",
    Cambridge: "#1e3a8a",
    Yellowstone: "#92400e",
    Phoenix: "#9a3412",
    Austin: "#4c1d95",
    Superior: "#166534",
    Heartland: "#155e75",
    Unknown: "#64748b",
  };

  let DATA = {
    config: {},
    potus: [],
    events: [],
    econ: [],
    monthly: [],
    schedule: [],
    gov: [],
    senate: [],
    districts: [],
  };

  const MONTHLY_STATS = [
    {
      id: "approval",
      label: "POTUS Approval",
      keys: ["potus_approval", "approval", "approval_rating", "approval_rate", "presidential_approval"],
      suffix: "%",
    },
    {
      id: "oil",
      label: "Oil Price",
      keys: ["oil_price", "oil", "crude_oil", "oil_index"],
      prefix: "$",
    },
    {
      id: "stock",
      label: "Stock Index",
      keys: ["stock_market_index", "stock_market_in", "stock", "stocks", "stock_index", "market", "markets", "sp500"],
    },
    {
      id: "job_creation",
      label: "Job Creation",
      keys: ["job_creation", "jobs", "jobs_created", "net_jobs", "employment_change"],
    },
  ];

  const YEARLY_STATS = [
    { id: "gdp", label: "GDP", keys: ["gdp", "GDP", "nominal_gdp"], prefix: "$" },
    { id: "debt", label: "Debt", keys: ["debt", "national_debt", "raw_debt"], prefix: "$" },
    { id: "growth", label: "Growth", keys: ["growth", "gdp_growth", "real_growth"], suffix: "%" },
    { id: "jobs", label: "Jobs", keys: ["job_creation", "jobs", "jobs_created"] },
    { id: "deficit", label: "Deficit", keys: ["deficit", "raw_deficit", "annual_deficit"], prefix: "$" },
    { id: "unemployment", label: "Unemployment", keys: ["unemployment", "unemployment_rate"], suffix: "%" },
    { id: "debt_gdp", label: "Debt/GDP", keys: ["debt_to_gdp", "debt_gdp"], suffix: "%" },
    { id: "inflation", label: "Inflation", keys: ["inflation", "inflation_rate"], suffix: "%" },
    { id: "median_wage", label: "Median Wage", keys: ["median_wage", "wage", "median_income"], prefix: "$" },
  ];

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

  function hasAnyValue(row, stats) {
    if (!row) return false;
    return stats.some((stat) => firstValue(row, stat.keys, "") !== "");
  }

  function latestValidRow(rows, stats) {
    const valid = [...(rows || [])].filter((row) => hasAnyValue(row, stats));
    return valid[valid.length - 1] || {};
  }

  function formatValue(value, stat = {}) {
    const n = toNumber(value, null);
    if (n === null) return cleanCell(value) || "—";

    const abs = Math.abs(n);
    let body;

    if (stat.prefix === "$" && abs >= 1_000_000_000_000) body = `${(n / 1_000_000_000_000).toFixed(2)}T`;
    else if (stat.prefix === "$" && abs >= 1_000_000_000) body = `${(n / 1_000_000_000).toFixed(2)}B`;
    else if (stat.prefix === "$" && abs >= 1_000_000) body = `${(n / 1_000_000).toFixed(2)}M`;
    else if (stat.prefix === "$" && abs >= 1_000) body = n.toLocaleString(undefined, { maximumFractionDigits: 0 });
    else body = n.toLocaleString(undefined, { maximumFractionDigits: 2 });

    return `${stat.prefix || ""}${body}${stat.suffix || ""}`;
  }

  function normalizeParty(value) {
    const raw = cleanCell(value).toUpperCase();

    if (["D", "DEM", "DEMOCRAT", "DEMOCRATIC", "DNC"].includes(raw)) return "DNC";
    if (["R", "REP", "REPUBLICAN", "GOP"].includes(raw)) return "GOP";
    if (["I", "IND", "INDEPENDENT"].includes(raw)) return "IND";

    return raw || "OTHER";
  }

  function partyBadge(party) {
    if (UI.partyBadge) return UI.partyBadge(party);

    return `<span class="party-badge">${safeHTML(normalizeParty(party))}</span>`;
  }

  function parseCSVLine(line) {
    const out = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      const next = line[i + 1];

      if (char === '"' && next === '"') {
        current += '"';
        i += 1;
        continue;
      }

      if (char === '"') {
        inQuotes = !inQuotes;
        continue;
      }

      if (char === "," && !inQuotes) {
        out.push(current);
        current = "";
        continue;
      }

      current += char;
    }

    out.push(current);
    return out.map(cleanCell);
  }

  async function fetchConfig() {
    try {
      const response = await fetch(CONFIG_CSV_URL, { cache: "no-store" });
      if (!response.ok) throw new Error(`CONFIG failed ${response.status}`);

      const text = await response.text();
      const lines = text.split(/\r?\n/).filter(Boolean);
      const rows = lines.map(parseCSVLine);

      const config = {};
      rows.slice(1).forEach((row) => {
        const key = cleanCell(row[0]);
        const value = cleanCell(row[1]);
        if (key) config[key] = value;
      });

      return config;
    } catch {
      return {};
    }
  }

  async function safeFetch(sheetName) {
    try {
      if (!fetchSheets) throw new Error("APRP.fetchSheets missing");
      const data = await fetchSheets([sheetName]);
      return data?.[sheetName] || [];
    } catch (error) {
      console.warn(`Failed loading ${sheetName}`, error);
      return [];
    }
  }

  async function loadData() {
    const [config, potus, events, econ, monthly, schedule, gov, senate, districts] = await Promise.all([
      fetchConfig(),
      safeFetch("WEB_POTUS"),
      safeFetch("WEB_EVENTS"),
      safeFetch("WEB_ECON"),
      safeFetch("WEB_MONTHLY"),
      safeFetch("WEB_SCHEDULE"),
      safeFetch("WEB_GOV"),
      safeFetch("WEB_SEN"),
      safeFetch("WEB_DISTRICTS"),
    ]);

    DATA = {
      config,
      potus,
      events,
      econ,
      monthly,
      schedule,
      gov,
      senate,
      districts,
    };
  }

  function injectHomeStyles() {
    if (document.querySelector("#aprp-home-fix-style")) return;

    const style = document.createElement("style");
    style.id = "aprp-home-fix-style";
    style.textContent = `
      .home-hero {
        position: relative;
        isolation: isolate;
        overflow: hidden;
      }

      .home-hero::before {
        content: "";
        position: absolute;
        inset: 0;
        z-index: -3;
        background:
          linear-gradient(90deg, rgba(7,17,31,.97), rgba(7,17,31,.82), rgba(7,17,31,.48)),
          var(--white-house-bg);
        background-size: cover;
        background-position: center;
      }

      .home-hero::after {
        content: "";
        position: absolute;
        inset: 0;
        z-index: -2;
        background:
          radial-gradient(circle at 25% 28%, rgba(255,255,255,.08), transparent 36%),
          linear-gradient(180deg, rgba(7,17,31,.10), rgba(7,17,31,.35));
      }

      .home-hero .hero-title,
      .home-hero .hero-subtitle,
      .home-hero .hero-kicker {
        color: #fff !important;
        text-shadow: 0 3px 24px rgba(0,0,0,.55);
      }

      .home-hero .hero-actions {
        gap: 8px !important;
      }

      .home-hero .hero-actions .btn {
        padding: 8px 13px !important;
        font-size: .82rem !important;
        border-radius: 999px !important;
        min-height: 0 !important;
      }

      .home-card-grid-fix {
        display: grid;
        gap: 8px;
      }

      .home-mini-row {
        border: 1px solid rgba(15,23,42,.10);
        background: rgba(255,255,255,.78);
        border-radius: 13px;
        padding: 9px 10px;
      }

      .home-mini-row strong {
        display: block;
        color: #0f172a;
        font-weight: 950;
        line-height: 1.15;
      }

      .home-mini-row span {
        display: block;
        margin-top: 3px;
        color: #64748b;
        font-size: .78rem;
        font-weight: 850;
      }

      .home-stat-grid-fix {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
        margin-top: 10px;
      }

      .home-stat-tile-fix {
        border: 1px solid rgba(15,23,42,.10);
        background: rgba(255,255,255,.82);
        border-radius: 14px;
        padding: 10px;
      }

      .home-stat-tile-fix strong {
        display: block;
        color: #2563eb;
        font-size: .62rem;
        font-weight: 950;
        letter-spacing: .10em;
        text-transform: uppercase;
      }

      .home-stat-tile-fix span {
        display: block;
        margin-top: 5px;
        color: #0f172a;
        font-weight: 1000;
      }

      #home-region-map {
        min-height: 350px;
        height: 350px;
        border-radius: 18px;
        overflow: hidden;
        background: #07111f;
      }

      @media (max-width: 850px) {
        .home-stat-grid-fix {
          grid-template-columns: 1fr;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function statTile(label, value) {
    if (!cleanCell(value)) return "";

    return `
      <div class="home-stat-tile-fix">
        <strong>${safeHTML(label)}</strong>
        <span>${safeHTML(value)}</span>
      </div>
    `;
  }

  function miniRow(title, meta) {
    return `
      <div class="home-mini-row">
        <strong>${safeHTML(title)}</strong>
        <span>${safeHTML(meta)}</span>
      </div>
    `;
  }

  function presidentName(row) {
    return firstValue(row, ["president", "full_name", "name", "person", "officeholder"], "Loading President");
  }

  function presidentParty(row) {
    return firstValue(row, ["party", "party_id", "president_party"], "");
  }

  function presidentVP(row) {
    return firstValue(row, ["vice_president", "vp", "vice"], "");
  }

  function presidentTerm(row) {
    const direct = firstValue(row, ["term", "years", "term_years", "served", "dates"], "");
    if (direct) return direct;

    const start = firstValue(row, ["term_start", "start_year", "inauguration_year", "start"], "");
    const end = firstValue(row, ["term_end", "end_year", "left_office_year", "end"], "");

    if (start && end) return `${start}–${end}`;
    if (start) return `${start}–CURRENT`;

    return "";
  }

  function presidentSummary(row) {
    return firstValue(
      row,
      ["summary", "legacy_summary", "description", "bio", "short_summary", "tagline", "one_liner"],
      "Current administration record is loading from the public archive sheet."
    );
  }

  function presidentPhoto(row) {
    return firstValue(
      row,
      ["portrait_url", "portrait_url2", "portrait_url3", "portrait_url4", "photo", "image", "image_url", "portrait", "img"],
      "./assets/img/president-placeholder.png"
    );
  }

  function currentPresident() {
    const valid = DATA.potus.filter((row) => presidentName(row) !== "Loading President");

    const current = valid.find((row) => {
      const term = cleanCell(presidentTerm(row)).toLowerCase();
      const end = firstValue(row, ["term_end", "end_year", "left_office_year", "end"], "").toLowerCase();
      return term.includes("current") || term.includes("present") || end === "current";
    });

    return current || valid[valid.length - 1] || {};
  }

  function renderCurrentPresident() {
    const row = currentPresident();
    const name = presidentName(row);
    const party = presidentParty(row);
    const vp = presidentVP(row);
    const term = presidentTerm(row);
    const summary = presidentSummary(row);
    const photo = presidentPhoto(row);
    const whiteHouseUrl = cleanCell(DATA.config.white_house_url) || FALLBACK_WHITE_HOUSE_IMAGE;

    const hero = getEl(".home-hero") || getEl(".archive-hero");
    if (hero) {
      hero.classList.add("home-hero");
      hero.style.setProperty("--white-house-bg", `url("${whiteHouseUrl}")`);
    }

    const cycle = getEl("#home-current-cycle-card");
    if (cycle) {
      cycle.innerHTML = `
        <div class="eyebrow">Current Cycle</div>
        <h2>${safeHTML(name)}</h2>
        <p>${safeHTML(term || "Current administration")}</p>
      `;
    }

    const img = getEl("#current-president-photo");
    if (img) {
      img.src = photo;
      img.alt = name;
      img.onerror = () => {
        img.src = "./assets/img/president-placeholder.png";
      };
    }

    const nameSlot = getEl("#current-president-name");
    if (nameSlot) nameSlot.textContent = name;

    const partySlot = getEl("#current-president-party");
    if (partySlot) partySlot.innerHTML = partyBadge(party);

    const vpSlot = getEl("#current-president-vp");
    if (vpSlot) {
      vpSlot.innerHTML = vp ? `<span class="party-badge">VP: ${safeHTML(vp)}</span>` : "";
    }

    const summarySlot = getEl("#current-president-summary");
    if (summarySlot) summarySlot.textContent = summary;
  }

  function renderMajorEvents() {
    const slot = getEl("#major-event-card");
    if (!slot) return;

    const rows = [...DATA.events]
      .filter((row) => firstValue(row, ["title", "headline", "event", "name"], ""))
      .reverse()
      .slice(0, 3);

    slot.innerHTML = `
      <div class="eyebrow">Major Events</div>
      <h3>Latest Timeline Events</h3>
      <div class="home-card-grid-fix">
        ${
          rows.length
            ? rows
                .map((row) =>
                  miniRow(
                    firstValue(row, ["title", "headline", "event", "name"], "Timeline Event"),
                    firstValue(row, ["date", "year", "month"], "")
                  )
                )
                .join("")
            : `<p>No timeline rows found.</p>`
        }
      </div>
    `;
  }

  function renderMacroSnapshot() {
    const slot = getEl("#macro-snapshot-card");
    if (!slot) return;

    const row = latestValidRow(DATA.econ, YEARLY_STATS);
    const year = firstValue(row, ["year", "date", "fiscal_year"], "Latest Year");

    const tiles = YEARLY_STATS.slice(0, 6)
      .map((stat) => {
        const raw = firstValue(row, stat.keys, "");
        if (!raw) return "";
        return statTile(stat.label, formatValue(raw, stat));
      })
      .join("");

    slot.innerHTML = `
      <div class="eyebrow">Macro Snapshot</div>
      <h3>${safeHTML(year)}</h3>
      ${
        tiles
          ? `<div class="home-stat-grid-fix">${tiles}</div>`
          : `<p>No economy row found. Check WEB_ECON column names.</p>`
      }
    `;
  }

  function renderMonthlyIndicators() {
    const slot = getEl("#markets-card");
    if (!slot) return;

    const row = latestValidRow(DATA.monthly, MONTHLY_STATS);
    const month = firstValue(row, ["label", "month_label", "period_label", "date", "month"], "Latest Month");
    const year = firstValue(row, ["year"], "");

    const title = year && !month.includes(year) ? `${month} ${year}` : month;

    const tiles = MONTHLY_STATS.map((stat) => {
      const raw = firstValue(row, stat.keys, "");
      if (!raw) return "";
      return statTile(stat.label, formatValue(raw, stat));
    }).join("");

    slot.innerHTML = `
      <div class="eyebrow">Markets & Approval</div>
      <h3>Monthly Indicators</h3>
      ${
        tiles
          ? `
            <p style="margin-top:-4px;color:#64748b;font-weight:800;">${safeHTML(title)}</p>
            <div class="home-stat-grid-fix">${tiles}</div>
          `
          : `<p>No monthly row found. Check WEB_MONTHLY column names.</p>`
      }
    `;
  }

  function renderSchedule() {
    const slot = getEl("#current-schedule-list");
    if (!slot) return;

    const rows = DATA.schedule
      .filter((row) => firstValue(row, ["name", "event", "title"], ""))
      .slice(0, 5);

    slot.innerHTML = rows.length
      ? rows
          .map((row) =>
            miniRow(
              firstValue(row, ["name", "event", "title"], "Schedule Item"),
              firstValue(row, ["date", "day"], "")
            )
          )
          .join("")
      : miniRow("No schedule records", "WEB_SCHEDULE has no rows.");
  }

  function countParties(rows) {
    const counts = { DNC: 0, GOP: 0, IND: 0, VACANT: 0, OTHER: 0 };

    rows.forEach((row) => {
      const party = normalizeParty(firstValue(row, ["party", "party_id", "governor_party", "senator_party"], ""));
      if (counts[party] === undefined) counts.OTHER += 1;
      else counts[party] += 1;
    });

    return counts;
  }

  function renderGovernmentControl() {
    const slot = getEl("#home-government-control");
    if (!slot) return;

    const senate = countParties(DATA.senate);
    const house = countParties(DATA.districts);
    const gov = countParties(DATA.gov);

    slot.innerHTML = `
      ${miniRow("Senate", `DNC ${senate.DNC} | GOP ${senate.GOP} | IND ${senate.IND}`)}
      ${miniRow("House", `DNC ${house.DNC} | GOP ${house.GOP} | IND ${house.IND}`)}
      ${miniRow("Governors", `DNC ${gov.DNC} | GOP ${gov.GOP} | IND ${gov.IND}`)}
    `;
  }

  function renderRecentEvents() {
    const slot = getEl("#recent-events-list");
    if (!slot) return;

    const rows = [...DATA.events]
      .filter((row) => firstValue(row, ["title", "headline", "event", "name"], ""))
      .reverse()
      .slice(0, 5);

    slot.innerHTML = rows.length
      ? rows
          .map((row) =>
            miniRow(
              firstValue(row, ["title", "headline", "event", "name"], "Timeline Event"),
              firstValue(row, ["date", "year", "month"], "")
            )
          )
          .join("")
      : miniRow("No events found", "WEB_EVENTS has no rows.");
  }

  function stateAbbrFromFeature(feature) {
    const name = feature?.properties?.name || feature?.properties?.NAME;
    return STATE_NAME_TO_ABBR[name] || "";
  }

  function renderMapDetail(abbr) {
    const detail = getEl("#home-map-detail");
    if (!detail) return;

    const stateName = STATE_NAMES[abbr] || abbr;
    const region = STATE_TO_REGION[abbr] || "Unknown";

    detail.innerHTML = `
      <div class="eyebrow">Selected State</div>
      <h3>${safeHTML(stateName)}</h3>
      <p><strong>Region:</strong> ${safeHTML(region)}</p>
      <a class="btn btn-outline" href="./government.html">Open Full Map</a>
    `;
  }

  async function renderHomeMap() {
    const slot = getEl("#home-region-map");
    if (!slot || !window.mapboxgl) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: "home-region-map",
      style: "mapbox://styles/mapbox/dark-v10",
      center: [-98.5795, 39.8283],
      zoom: window.innerWidth < 700 ? 2.35 : 3.05,
      minZoom: 2,
      maxZoom: 6,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");

    map.on("load", async () => {
      const response = await fetch(US_STATES_GEOJSON_URL);
      const geojson = await response.json();

      geojson.features = geojson.features
        .map((feature) => {
          const abbr = stateAbbrFromFeature(feature);
          const region = STATE_TO_REGION[abbr] || "Unknown";

          return {
            ...feature,
            properties: {
              ...feature.properties,
              abbr,
              region,
              color: REGION_COLORS[region] || REGION_COLORS.Unknown,
            },
          };
        })
        .filter((feature) => feature.properties.abbr);

      map.addSource("states", {
        type: "geojson",
        data: geojson,
      });

      map.addLayer({
        id: "states-fill",
        type: "fill",
        source: "states",
        paint: {
          "fill-color": ["get", "color"],
          "fill-opacity": 0.84,
        },
      });

      map.addLayer({
        id: "states-outline",
        type: "line",
        source: "states",
        paint: {
          "line-color": "rgba(255,255,255,.82)",
          "line-width": 1,
        },
      });

      map.on("click", "states-fill", (event) => {
        const abbr = cleanCell(event.features?.[0]?.properties?.abbr);
        if (abbr) renderMapDetail(abbr);
      });

      map.on("mousemove", "states-fill", () => {
        map.getCanvas().style.cursor = "pointer";
      });

      map.on("mouseleave", "states-fill", () => {
        map.getCanvas().style.cursor = "";
      });
    });
  }

  async function initHome() {
    try {
      injectHomeStyles();
      await loadData();

      renderCurrentPresident();
      renderMajorEvents();
      renderMacroSnapshot();
      renderMonthlyIndicators();
      renderSchedule();
      renderGovernmentControl();
      renderRecentEvents();
      renderHomeMap();
    } catch (error) {
      console.error("Home page failed:", error);
    }
  }

  document.addEventListener("DOMContentLoaded", initHome);
})();