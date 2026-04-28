/* APRP Federal Archive — Google Sheets Loader
   Public read-only CSV data source.
   This file exposes:
   window.APRP_SHEETS
   window.APRP
*/

const APRP_SHEETS = {
  WEB_DISTRICTS:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQdNuab7OkXjYKw_DEPLXz1Urb8q4-8kwhcqPt1M7A-fxJa-9F6Cq6opGIKpUCf3KU29vo5PfvMCUNu/pub?gid=54284877&single=true&output=csv",

  WEB_SCHEDULE:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQdNuab7OkXjYKw_DEPLXz1Urb8q4-8kwhcqPt1M7A-fxJa-9F6Cq6opGIKpUCf3KU29vo5PfvMCUNu/pub?gid=1653914288&single=true&output=csv",

  WEB_POTUS:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQdNuab7OkXjYKw_DEPLXz1Urb8q4-8kwhcqPt1M7A-fxJa-9F6Cq6opGIKpUCf3KU29vo5PfvMCUNu/pub?gid=901665208&single=true&output=csv",

  WEB_POTUSELECTION:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQdNuab7OkXjYKw_DEPLXz1Urb8q4-8kwhcqPt1M7A-fxJa-9F6Cq6opGIKpUCf3KU29vo5PfvMCUNu/pub?gid=1353061052&single=true&output=csv",

  WEB_CONGRESSELECTION:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQdNuab7OkXjYKw_DEPLXz1Urb8q4-8kwhcqPt1M7A-fxJa-9F6Cq6opGIKpUCf3KU29vo5PfvMCUNu/pub?gid=1659353703&single=true&output=csv",

  WEB_EVENTS:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQdNuab7OkXjYKw_DEPLXz1Urb8q4-8kwhcqPt1M7A-fxJa-9F6Cq6opGIKpUCf3KU29vo5PfvMCUNu/pub?gid=529032081&single=true&output=csv",

  WEB_ECON:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQdNuab7OkXjYKw_DEPLXz1Urb8q4-8kwhcqPt1M7A-fxJa-9F6Cq6opGIKpUCf3KU29vo5PfvMCUNu/pub?gid=141774572&single=true&output=csv",

  WEB_MONTHLY:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQdNuab7OkXjYKw_DEPLXz1Urb8q4-8kwhcqPt1M7A-fxJa-9F6Cq6opGIKpUCf3KU29vo5PfvMCUNu/pub?gid=176907832&single=true&output=csv",

  WEB_SEN:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQdNuab7OkXjYKw_DEPLXz1Urb8q4-8kwhcqPt1M7A-fxJa-9F6Cq6opGIKpUCf3KU29vo5PfvMCUNu/pub?gid=1840346777&single=true&output=csv",

  WEB_LDR:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQdNuab7OkXjYKw_DEPLXz1Urb8q4-8kwhcqPt1M7A-fxJa-9F6Cq6opGIKpUCf3KU29vo5PfvMCUNu/pub?gid=454262652&single=true&output=csv",

  WEB_GOV:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQdNuab7OkXjYKw_DEPLXz1Urb8q4-8kwhcqPt1M7A-fxJa-9F6Cq6opGIKpUCf3KU29vo5PfvMCUNu/pub?gid=1471855876&single=true&output=csv",

  WEB_LIVECANDIDATES:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQdNuab7OkXjYKw_DEPLXz1Urb8q4-8kwhcqPt1M7A-fxJa-9F6Cq6opGIKpUCf3KU29vo5PfvMCUNu/pub?gid=617619834&single=true&output=csv",

  WEB_LIVECONFIG:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQdNuab7OkXjYKw_DEPLXz1Urb8q4-8kwhcqPt1M7A-fxJa-9F6Cq6opGIKpUCf3KU29vo5PfvMCUNu/pub?gid=1797016145&single=true&output=csv",

  WEB_LIVESTATES:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQdNuab7OkXjYKw_DEPLXz1Urb8q4-8kwhcqPt1M7A-fxJa-9F6Cq6opGIKpUCf3KU29vo5PfvMCUNu/pub?gid=2055041221&single=true&output=csv",

  WEB_LIVERESULTS:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQdNuab7OkXjYKw_DEPLXz1Urb8q4-8kwhcqPt1M7A-fxJa-9F6Cq6opGIKpUCf3KU29vo5PfvMCUNu/pub?gid=1250982415&single=true&output=csv",

  CALC_STATE_BASELINES:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQdNuab7OkXjYKw_DEPLXz1Urb8q4-8kwhcqPt1M7A-fxJa-9F6Cq6opGIKpUCf3KU29vo5PfvMCUNu/pub?gid=861381015&single=true&output=csv",

  CALC_LOBBIES:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQdNuab7OkXjYKw_DEPLXz1Urb8q4-8kwhcqPt1M7A-fxJa-9F6Cq6opGIKpUCf3KU29vo5PfvMCUNu/pub?gid=1863807899&single=true&output=csv",

  CALC_EXPERIENCE:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQdNuab7OkXjYKw_DEPLXz1Urb8q4-8kwhcqPt1M7A-fxJa-9F6Cq6opGIKpUCf3KU29vo5PfvMCUNu/pub?gid=1581446706&single=true&output=csv",

  CALC_RULES:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQdNuab7OkXjYKw_DEPLXz1Urb8q4-8kwhcqPt1M7A-fxJa-9F6Cq6opGIKpUCf3KU29vo5PfvMCUNu/pub?gid=1782585164&single=true&output=csv",
};

const APRP_CACHE = new Map();

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

async function fetchSheet(sheetName, options = {}) {
  const { bustCache = false } = options;
  const url = APRP_SHEETS[sheetName];

  if (!url) {
    throw new Error(`Unknown APRP sheet name: ${sheetName}`);
  }

  if (!bustCache && APRP_CACHE.has(sheetName)) {
    return APRP_CACHE.get(sheetName);
  }

  const cacheParam = `cache=${Date.now()}`;
  const requestUrl = url.includes("?") ? `${url}&${cacheParam}` : `${url}?${cacheParam}`;

  const response = await fetch(requestUrl, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Could not load ${sheetName}: ${response.status} ${response.statusText}`);
  }

  const csvText = await response.text();
  const rows = parseCSV(csvText);
  const data = rowsToObjects(rows);

  APRP_CACHE.set(sheetName, data);

  return data;
}

async function fetchSheets(sheetNames, options = {}) {
  const entries = await Promise.all(
    sheetNames.map(async (sheetName) => {
      const data = await fetchSheet(sheetName, options);
      return [sheetName, data];
    })
  );

  return Object.fromEntries(entries);
}

function toNumber(value, fallback = 0) {
  const cleaned = cleanCell(value)
    .replace(/[$,%]/g, "")
    .replace(/,/g, "");

  if (cleaned === "") return fallback;

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBool(value) {
  const normalized = cleanCell(value).toLowerCase();
  return ["true", "yes", "y", "1", "live", "on"].includes(normalized);
}

function formatNumber(value, fallback = "—") {
  const number = toNumber(value, NaN);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return new Intl.NumberFormat("en-US").format(number);
}

function formatCompactNumber(value, fallback = "—") {
  const number = toNumber(value, NaN);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(number);
}

function formatMoneyBillions(value, fallback = "—") {
  const number = toNumber(value, NaN);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return `$${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
  }).format(number)}B`;
}

function formatPercent(value, fallback = "—") {
  const number = toNumber(value, NaN);

  if (!Number.isFinite(number)) {
    return fallback;
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
  const found = configRows.find(
    (row) => cleanCell(row.key).toLowerCase() === cleanCell(key).toLowerCase()
  );

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
  const current = rows.find((row) => cleanCell(row.is_current).toLowerCase() === "true");

  if (current) {
    return current;
  }

  return sortByNumber(rows, "year", "desc")[0] || null;
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

  if (["D", "DEM", "DEMOCRAT", "DEMOCRATIC"].includes(normalized)) return "DNC";
  if (["R", "REP", "REPUBLICAN"].includes(normalized)) return "GOP";
  if (["I", "INDEPENDENT"].includes(normalized)) return "IND";

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

  if (element) {
    element.textContent = value;
  }
}

function setHTML(selector, value, root = document) {
  const element = root.querySelector(selector);

  if (element) {
    element.innerHTML = value;
  }
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

window.APRP_SHEETS = APRP_SHEETS;

window.APRP = {
  fetchSheet,
  fetchSheets,
  parseCSV,
  rowsToObjects,
  cleanCell,
  normalizeHeader,
  toNumber,
  toBool,
  formatNumber,
  formatCompactNumber,
  formatMoneyBillions,
  formatPercent,
  groupBy,
  sortByNumber,
  sortByText,
  getConfigValue,
  getMostRecentByDate,
  getCurrentYearRow,
  getPartyClass,
  getPartyLabel,
  safeHTML,
  setText,
  setHTML,
  showError,
  showLoading,
};
(function () {
  "use strict";

  const existing = window.APRP_SHEETS || {};

  function parseCSV(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const next = text[i + 1];

      if (char === '"' && inQuotes && next === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        row.push(cell);
        cell = "";
      } else if ((char === "\n" || char === "\r") && !inQuotes) {
        if (char === "\r" && next === "\n") i++;
        row.push(cell);

        if (row.some((value) => String(value).trim() !== "")) {
          rows.push(row);
        }

        row = [];
        cell = "";
      } else {
        cell += char;
      }
    }

    row.push(cell);
    if (row.some((value) => String(value).trim() !== "")) {
      rows.push(row);
    }

    return rows;
  }

  function rowsToObjects(rows) {
    if (!rows.length) return [];

    const headers = rows[0].map((header) =>
      String(header || "")
        .trim()
        .replace(/\s+/g, "_")
        .toLowerCase()
    );

    return rows.slice(1).map((row) => {
      const obj = {};

      headers.forEach((header, index) => {
        obj[header] = String(row[index] ?? "").trim();
      });

      return obj;
    });
  }

  async function loadSheet(sheetName) {
    const url = existing[sheetName];

    if (!url) {
      throw new Error(`No sheet URL configured for ${sheetName}`);
    }

    const cacheBust = url.includes("?") ? `&v=${Date.now()}` : `?v=${Date.now()}`;
    const response = await fetch(url + cacheBust, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${sheetName}: ${response.status}`);
    }

    const text = await response.text();
    const rows = parseCSV(text);
    return rowsToObjects(rows);
  }

  async function loadSheets(sheetNames) {
    const entries = await Promise.all(
      sheetNames.map(async (name) => {
        const rows = await loadSheet(name);
        return [name, rows];
      })
    );

    return Object.fromEntries(entries);
  }

  window.APRP_SHEETS = {
    ...existing,
    loadSheet,
    loadSheets,
    parseCSV,
    rowsToObjects
  };
})();
(function () {
  "use strict";

  const sheetUrls = { ...window.APRP_SHEETS };

  function parseCSV(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const next = text[i + 1];

      if (char === '"' && inQuotes && next === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        row.push(cell);
        cell = "";
      } else if ((char === "\n" || char === "\r") && !inQuotes) {
        if (char === "\r" && next === "\n") i++;
        row.push(cell);

        if (row.some((v) => String(v).trim() !== "")) {
          rows.push(row);
        }

        row = [];
        cell = "";
      } else {
        cell += char;
      }
    }

    row.push(cell);

    if (row.some((v) => String(v).trim() !== "")) {
      rows.push(row);
    }

    return rows;
  }

  function normalizeHeader(header) {
    return String(header || "")
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^\w]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")
      .toLowerCase();
  }

  function rowsToObjects(rows) {
    if (!rows.length) return [];

    const headers = rows[0].map(normalizeHeader);

    return rows.slice(1).map((row) => {
      const obj = {};

      headers.forEach((header, index) => {
        if (!header) return;
        obj[header] = String(row[index] ?? "").trim();
      });

      return obj;
    });
  }

  async function loadSheet(sheetName) {
    const url = sheetUrls[sheetName];

    if (!url) {
      throw new Error(`Missing CSV URL for ${sheetName}`);
    }

    const cacheBust = url.includes("?")
      ? `&cache=${Date.now()}`
      : `?cache=${Date.now()}`;

    const response = await fetch(url + cacheBust, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${sheetName}: HTTP ${response.status}`);
    }

    const text = await response.text();
    return rowsToObjects(parseCSV(text));
  }

  async function loadSheets(sheetNames) {
    const entries = await Promise.all(
      sheetNames.map(async (sheetName) => {
        const rows = await loadSheet(sheetName);
        return [sheetName, rows];
      })
    );

    return Object.fromEntries(entries);
  }

  window.APRP_SHEETS = {
    ...sheetUrls,
    loadSheet,
    loadSheets,
    parseCSV,
    rowsToObjects
  };

  console.log("APRP sheet loader ready", window.APRP_SHEETS);
})();
