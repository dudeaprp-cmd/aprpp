/* APRP Federal Archive — Google Sheets Loader
   Public read-only CSV data source.

   Exposes:
   window.APRP_SHEETS.loadSheet("WEB_POTUS")
   window.APRP.fetchSheet("WEB_POTUS")
*/

(function () {
  "use strict";

  const BASE_PUBLISHED =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQdNuab7OkXjYKw_DEPLXz1Urb8q4-8kwhcqPt1M7A-fxJa-9F6Cq6opGIKpUCf3KU29vo5PfvMCUNu/pub";

  function csvUrl(gid) {
    return `${BASE_PUBLISHED}?gid=${gid}&single=true&output=csv`;
  }

  const SHEET_URLS = {
    /* Existing public website sheets */
    WEB_DISTRICTS: csvUrl("54284877"),
    WEB_SCHEDULE: csvUrl("1653914288"),
    WEB_POTUS: csvUrl("901665208"),
    WEB_POTUSELECTION: csvUrl("1353061052"),
    WEB_CONGRESSELECTION: csvUrl("1659353703"),
    WEB_EVENTS: csvUrl("529032081"),
    WEB_ECON: csvUrl("141774572"),

    /*
      IMPORTANT:
      WEB_MONTHLY now points to MONTHLY_ENGINE.
      This keeps old pages working while new economy.js reads MONTHLY_ENGINE directly.
    */
    WEB_MONTHLY: csvUrl("1827825411"),
    MONTHLY_ENGINE: csvUrl("1827825411"),

    WEB_SEN: csvUrl("1840346777"),
    WEB_LDR: csvUrl("454262652"),
    WEB_GOV: csvUrl("1471855876"),

    WEB_LIVECANDIDATES: csvUrl("617619834"),
    WEB_LIVECONFIG: csvUrl("1797016145"),
    WEB_LIVESTATES: csvUrl("2055041221"),
    WEB_LIVERESULTS: csvUrl("1250982415"),

    CALC_STATE_BASELINES: csvUrl("861381015"),
    CALC_LOBBIES: csvUrl("1863807899"),
    CALC_EXPERIENCE: csvUrl("1581446706"),
    CALC_EXPERIANCE: csvUrl("1581446706"),
    CALC_RULES: csvUrl("1782585164"),

    /* New economy model sheets */
    CONTROL_CONFIG: csvUrl("1448726664"),
    YEARLY_FISCAL_OUTPUT: csvUrl("845310261"),
    YEARLY_MANDATORY_ENGINE: csvUrl("30195170"),
    YEARLY_DISCRETIONARY_ENGINE: csvUrl("74370148"),
    TAX_RATES_BY_YEAR: csvUrl("166104065"),
    YEARLY_REVENUE_ENGINE: csvUrl("1809546509"),
    YEARLY_MACRO_ENGINE: csvUrl("1835858612"),
    MODEL_RULES: csvUrl("1216190815"),
    EVENT_POLICY_INPUTS: csvUrl("1492685747"),
    YEARLY_CONFIG: csvUrl("759592504")
  };

  const CACHE = new Map();

  function cleanCell(value) {
    return String(value ?? "").trim();
  }

  function normalizeHeader(header) {
    return cleanCell(header)
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^\w]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");
  }

  function parseCSV(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let insideQuotes = false;

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      const next = text[i + 1];

      if (char === '"' && insideQuotes && next === '"') {
        cell += '"';
        i += 1;
        continue;
      }

      if (char === '"') {
        insideQuotes = !insideQuotes;
        continue;
      }

      if (char === "," && !insideQuotes) {
        row.push(cleanCell(cell));
        cell = "";
        continue;
      }

      if ((char === "\n" || char === "\r") && !insideQuotes) {
        if (char === "\r" && next === "\n") i += 1;

        row.push(cleanCell(cell));

        if (row.some((item) => item !== "")) {
          rows.push(row);
        }

        row = [];
        cell = "";
        continue;
      }

      cell += char;
    }

    row.push(cleanCell(cell));

    if (row.some((item) => item !== "")) {
      rows.push(row);
    }

    return rows;
  }

  function rowsToObjects(rows) {
    if (!Array.isArray(rows) || rows.length === 0) return [];

    const headers = rows[0].map(normalizeHeader);

    return rows.slice(1).map((row) => {
      const obj = {};

      headers.forEach((header, index) => {
        if (!header) return;
        obj[header] = cleanCell(row[index]);
      });

      return obj;
    });
  }

  async function loadSheet(sheetName, options = {}) {
    const { bustCache = false } = options;

    let url = SHEET_URLS[sheetName];

    if (!url && sheetName === "CALC_EXPERIENCE") {
      url = SHEET_URLS.CALC_EXPERIANCE;
    }

    if (!url && sheetName === "CALC_EXPERIANCE") {
      url = SHEET_URLS.CALC_EXPERIENCE;
    }

    if (!url) {
      throw new Error(`Unknown APRP sheet name: ${sheetName}`);
    }

    if (!bustCache && CACHE.has(sheetName)) {
      return CACHE.get(sheetName);
    }

    const cacheParam = `cache=${Date.now()}`;
    const requestUrl = url.includes("?") ? `${url}&${cacheParam}` : `${url}?${cacheParam}`;

    const response = await fetch(requestUrl, {
      method: "GET",
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Could not load ${sheetName}: ${response.status} ${response.statusText}`);
    }

    const csvText = await response.text();
    const rows = parseCSV(csvText);
    const data = rowsToObjects(rows);

    CACHE.set(sheetName, data);
    return data;
  }

  async function loadSheets(sheetNames, options = {}) {
    const entries = await Promise.all(
      sheetNames.map(async (sheetName) => {
        const data = await loadSheet(sheetName, options);
        return [sheetName, data];
      })
    );

    return Object.fromEntries(entries);
  }

  async function loadEconomyModel(options = {}) {
    return loadSheets(
      [
        "MONTHLY_ENGINE",
        "CONTROL_CONFIG",
        "YEARLY_FISCAL_OUTPUT",
        "YEARLY_MANDATORY_ENGINE",
        "YEARLY_DISCRETIONARY_ENGINE",
        "TAX_RATES_BY_YEAR",
        "YEARLY_REVENUE_ENGINE",
        "YEARLY_MACRO_ENGINE",
        "MODEL_RULES",
        "EVENT_POLICY_INPUTS",
        "YEARLY_CONFIG"
      ],
      options
    );
  }

  function toNumber(value, fallback = 0) {
    const cleaned = cleanCell(value)
      .replace(/[$,%]/g, "")
      .replace(/,/g, "");

    if (cleaned === "") return fallback;

    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function toPercentDecimal(value, fallback = 0) {
    const raw = cleanCell(value);
    if (raw === "") return fallback;

    const number = toNumber(raw, NaN);
    if (!Number.isFinite(number)) return fallback;

    return raw.includes("%") ? number / 100 : number;
  }

  function toBool(value) {
    const normalized = cleanCell(value).toLowerCase();
    return ["true", "yes", "y", "1", "live", "on", "previous"].includes(normalized);
  }

  function formatNumber(value, fallback = "—") {
    const number = toNumber(value, NaN);
    if (!Number.isFinite(number)) return fallback;
    return new Intl.NumberFormat("en-US").format(number);
  }

  function formatCompactNumber(value, fallback = "—") {
    const number = toNumber(value, NaN);
    if (!Number.isFinite(number)) return fallback;

    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1
    }).format(number);
  }

  function formatMoneyBillions(value, fallback = "—") {
    const number = toNumber(value, NaN);
    if (!Number.isFinite(number)) return fallback;

    return `$${new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 1
    }).format(number)}B`;
  }

  function formatMoney(value, fallback = "—") {
    const number = toNumber(value, NaN);
    if (!Number.isFinite(number)) return fallback;

    return `$${new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 0
    }).format(number)}`;
  }

  function formatPercent(value, fallback = "—") {
    const raw = cleanCell(value);
    const number = toNumber(raw, NaN);
    if (!Number.isFinite(number)) return fallback;

    if (raw.includes("%")) {
      return `${number.toFixed(number % 1 === 0 ? 0 : 1)}%`;
    }

    if (Math.abs(number) <= 1) {
      const pct = number * 100;
      return `${pct.toFixed(pct % 1 === 0 ? 0 : 1)}%`;
    }

    return `${number.toFixed(number % 1 === 0 ? 0 : 1)}%`;
  }

  function groupBy(items, key) {
    return items.reduce((acc, item) => {
      const groupKey = cleanCell(item[key]) || "unknown";

      if (!acc[groupKey]) {
        acc[groupKey] = [];
      }

      acc[groupKey].push(item);
      return acc;
    }, {});
  }

  function sortByNumber(items, key, direction = "asc") {
    return [...items].sort((a, b) => {
      const av = toNumber(a[key]);
      const bv = toNumber(b[key]);
      return direction === "desc" ? bv - av : av - bv;
    });
  }

  function sortByText(items, key, direction = "asc") {
    return [...items].sort((a, b) => {
      const av = cleanCell(a[key]).toLowerCase();
      const bv = cleanCell(b[key]).toLowerCase();

      if (av < bv) return direction === "asc" ? -1 : 1;
      if (av > bv) return direction === "asc" ? 1 : -1;
      return 0;
    });
  }

  function getConfigValue(configRows, key, fallback = "") {
    const target = cleanCell(key).toLowerCase();

    const found = configRows.find((row) => {
      const rowKey = cleanCell(row.key || row.setting || row.name).toLowerCase();
      return rowKey === target;
    });

    return found ? cleanCell(found.value) : fallback;
  }

  function getMostRecentByDate(rows, yearKey = "year", monthKey = "month", dayKey = "day") {
    return [...rows].sort((a, b) => {
      const ay = toNumber(a[yearKey]);
      const am = toNumber(a[monthKey]);
      const ad = toNumber(a[dayKey]);
      const by = toNumber(b[yearKey]);
      const bm = toNumber(b[monthKey]);
      const bd = toNumber(b[dayKey]);

      return by - ay || bm - am || bd - ad;
    })[0];
  }

  function getCurrentYearRow(rows) {
    const current = rows.find((row) => {
      const value = cleanCell(row.is_current || row.active).toLowerCase();
      return value === "true" || value === "current";
    });

    if (current) return current;

    return sortByNumber(rows, "year", "desc")[0] || null;
  }

  function getCurrentModelYear(controlConfig, fallback = "") {
    return toNumber(getConfigValue(controlConfig, "current_year", fallback), fallback);
  }

  function getCurrentModelMonth(controlConfig, fallback = "") {
    return toNumber(getConfigValue(controlConfig, "current_month", fallback), fallback);
  }

  function findYearRow(rows, year) {
    const target = Number(year);
    return rows.find((row) => toNumber(row.year, NaN) === target) || null;
  }

  function getPartyClass(party) {
    const normalized = cleanCell(party).toUpperCase();

    if (["D", "DEM", "DNC", "DEMOCRAT", "DEMOCRATIC"].includes(normalized)) {
      return "party-dnc";
    }

    if (["R", "REP", "GOP", "REPUBLICAN"].includes(normalized)) {
      return "party-gop";
    }

    if (["I", "IND", "INDEPENDENT", "OTHER"].includes(normalized)) {
      return "party-ind";
    }

    if (["VACANT", "—", "-", ""].includes(normalized)) {
      return "party-vacant";
    }

    return "party-other";
  }

  function getPartyLabel(party) {
    const normalized = cleanCell(party).toUpperCase();

    if (["D", "DEM", "DNC", "DEMOCRAT", "DEMOCRATIC"].includes(normalized)) return "DNC";
    if (["R", "REP", "GOP", "REPUBLICAN"].includes(normalized)) return "GOP";
    if (["I", "IND", "INDEPENDENT"].includes(normalized)) return "IND";

    return cleanCell(party) || "—";
  }

  function safeHTML(value) {
    return cleanCell(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function setText(selector, value, root = document) {
    const element = root.querySelector(selector);
    if (element) element.textContent = value;
  }

  function setHTML(selector, value, root = document) {
    const element = root.querySelector(selector);
    if (element) element.innerHTML = value;
  }

  function showError(container, message) {
    const element =
      typeof container === "string" ? document.querySelector(container) : container;

    if (!element) return;

    element.innerHTML = `
      <div class="notice notice-error">
        <strong>Archive data temporarily unavailable.</strong>
        <span>${safeHTML(message)}</span>
      </div>
    `;
  }

  function showLoading(container, message = "Loading public archive records...") {
    const element =
      typeof container === "string" ? document.querySelector(container) : container;

    if (!element) return;

    element.innerHTML = `
      <div class="notice">
        <span>${safeHTML(message)}</span>
      </div>
    `;
  }

  window.APRP_SHEETS = {
    ...SHEET_URLS,
    urls: SHEET_URLS,
    loadSheet,
    loadSheets,
    loadEconomyModel,
    fetchSheet: loadSheet,
    fetchSheets: loadSheets,
    parseCSV,
    rowsToObjects
  };

  window.APRP = {
    fetchSheet: loadSheet,
    fetchSheets: loadSheets,
    loadSheet,
    loadSheets,
    loadEconomyModel,
    parseCSV,
    rowsToObjects,
    cleanCell,
    normalizeHeader,
    toNumber,
    toPercentDecimal,
    toBool,
    formatNumber,
    formatCompactNumber,
    formatMoney,
    formatMoneyBillions,
    formatPercent,
    groupBy,
    sortByNumber,
    sortByText,
    getConfigValue,
    getMostRecentByDate,
    getCurrentYearRow,
    getCurrentModelYear,
    getCurrentModelMonth,
    findYearRow,
    getPartyClass,
    getPartyLabel,
    safeHTML,
    setText,
    setHTML,
    showError,
    showLoading
  };

  console.log("APRP sheet loader ready:", window.APRP_SHEETS);
})();
