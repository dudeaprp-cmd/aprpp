/* APRP Federal Archive — Economy Page
   OMB-style compact dashboard.
   Monthly charts default to ALL records, with toggle for Last 12 Months.
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

  const toNumber = (value, fallback = null) => {
    if (value === null || value === undefined || value === "") return fallback;
    const parsed = Number(String(value).replace(/[$,%]/g, "").replace(/,/g, "").trim());
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  let ECON_ROWS = [];
  let MONTHLY_ROWS = [];
  let MONTHLY_RANGE = "all";

  const YEARLY_STATS = [
    { id: "gdp", title: "GDP", keys: ["gdp", "GDP", "nominal_gdp"], prefix: "$", group: "Output", changeType: "absolute" },
    { id: "debt", title: "National Debt", keys: ["debt", "Debt", "national_debt"], prefix: "$", group: "Fiscal", changeType: "absolute" },
    { id: "growth", title: "GDP Growth", keys: ["growth", "gdp_growth", "real_growth"], suffix: "%", group: "Output", changeType: "pp" },
    { id: "job_creation", title: "Job Creation", keys: ["job_creation", "jobs", "jobs_created", "net_jobs"], group: "Labor", changeType: "absolute" },
    { id: "deficit", title: "Raw Deficit", keys: ["deficit", "Deficit", "raw_deficit"], prefix: "$", group: "Fiscal", changeType: "absolute" },
    { id: "unemployment", title: "Unemployment", keys: ["unemployment", "unemployment_rate"], suffix: "%", group: "Labor", changeType: "pp" },
    { id: "debt_gdp", title: "Debt-to-GDP", keys: ["debt_to_gdp", "debt_gdp"], suffix: "%", group: "Fiscal", changeType: "pp" },
    { id: "deficit_gdp", title: "Deficit-to-GDP", keys: ["deficit_gdp", "deficit_to_gdp"], suffix: "%", group: "Fiscal", changeType: "pp" },
    { id: "inflation", title: "Inflation", keys: ["inflation", "inflation_rate"], suffix: "%", group: "Prices", changeType: "pp" },
    { id: "median_wage", title: "Median Wage", keys: ["median_wage", "wage", "median_income"], prefix: "$", group: "Labor", changeType: "absolute" },
  ];

  const MONTHLY_STATS = [
    { id: "approval", title: "POTUS Approval", keys: ["potus_approval", "approval", "approval_rating"], suffix: "%", group: "Political", changeType: "pp" },
    { id: "oil", title: "Oil Price", keys: ["oil_price", "oil", "crude_oil"], prefix: "$", group: "Markets", changeType: "absolute" },
    { id: "job_creation", title: "Job Creation", keys: ["job_creation", "jobs", "jobs_created", "net_jobs"], group: "Labor", changeType: "absolute" },
    { id: "stock", title: "Stock Index", keys: ["stock_market_index", "stock_market_in", "stock", "stocks", "stock_index", "market", "sp500"], group: "Markets", changeType: "absolute" },
  ];

  const TOP_YEARLY_TILES = ["gdp", "debt", "growth", "job_creation", "deficit", "unemployment", "debt_gdp", "deficit_gdp", "inflation", "median_wage"];

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

  function getValue(row, keys) {
    return toNumber(firstValue(row, keys, ""), null);
  }

  function yearLabel(row, index = 0) {
    return firstValue(row, ["year", "date", "fiscal_year"], String(index + 1));
  }

  function monthNumberToName(value) {
    const n = toNumber(value, null);
    if (!n || n < 1 || n > 12) return "";
    return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][n - 1];
  }

  function monthLabel(row, index = 0) {
    const label = firstValue(row, ["label", "month_label", "period_label"], "");
    if (label) return label;

    const month = firstValue(row, ["month", "date", "period"], "");
    const year = firstValue(row, ["year"], "");

    if (month && year && !String(month).includes(String(year))) {
      const monthName = monthNumberToName(month);
      return `${monthName || month} ${year}`;
    }

    return month || year || String(index + 1);
  }

  function formatValue(value, stat = {}) {
    if (value === null || value === undefined || Number.isNaN(value)) return "—";

    const abs = Math.abs(value);
    let body;

    if (stat.prefix === "$" && abs >= 1_000_000_000_000) body = `${(value / 1_000_000_000_000).toFixed(2)}T`;
    else if (stat.prefix === "$" && abs >= 1_000_000_000) body = `${(value / 1_000_000_000).toFixed(2)}B`;
    else if (stat.prefix === "$" && abs >= 1_000_000) body = `${(value / 1_000_000).toFixed(2)}M`;
    else body = value.toLocaleString(undefined, { maximumFractionDigits: 2 });

    return `${stat.prefix || ""}${body}${stat.suffix || ""}`;
  }

  function formatMovement(diff, stat = {}) {
    if (diff === null || diff === undefined || Number.isNaN(diff)) return "—";
    const sign = diff > 0 ? "+" : "";
    if (stat.changeType === "pp") return `${sign}${diff.toFixed(2)} pp`;
    return `${sign}${formatValue(diff, stat)}`;
  }

  function movementClass(diff) {
    if (diff > 0) return "up";
    if (diff < 0) return "down";
    return "flat";
  }

  async function safeFetch(sheetName) {
    try {
      if (!fetchSheets) throw new Error("APRP.fetchSheets missing. Check sheets.js loads before economy.js.");
      const data = await fetchSheets([sheetName]);
      return data?.[sheetName] || [];
    } catch (error) {
      console.warn(`Failed loading ${sheetName}`, error);
      return [];
    }
  }

  async function loadData() {
    const [econ, monthly] = await Promise.all([
      safeFetch("WEB_ECON"),
      safeFetch("WEB_MONTHLY"),
    ]);

    ECON_ROWS = econ || [];
    MONTHLY_ROWS = monthly || [];
  }

  function yearlyPoints(stat) {
    return ECON_ROWS.map((row, index) => {
      const value = getValue(row, stat.keys);
      if (value === null) return null;
      return { label: yearLabel(row, index), value, row };
    }).filter(Boolean);
  }

  function monthlyPoints(stat) {
    const points = MONTHLY_ROWS.map((row, index) => {
      const value = getValue(row, stat.keys);
      if (value === null) return null;
      return { label: monthLabel(row, index), value, row };
    }).filter(Boolean);

    return MONTHLY_RANGE === "12" ? points.slice(-12) : points;
  }

  function latestMacroRow() {
    const valid = ECON_ROWS.filter((row) => YEARLY_STATS.some((stat) => getValue(row, stat.keys) !== null));
    return valid[valid.length - 1] || {};
  }

  function previousMacroRow() {
    const valid = ECON_ROWS.filter((row) => YEARLY_STATS.some((stat) => getValue(row, stat.keys) !== null));
    return valid[valid.length - 2] || {};
  }

  function injectStyles() {
    if (document.querySelector("#aprp-economy-omb-style")) return;

    const style = document.createElement("style");
    style.id = "aprp-economy-omb-style";
    style.textContent = `
      body {
        background:
          radial-gradient(circle at top left, rgba(15,23,42,.10), transparent 34%),
          radial-gradient(circle at top right, rgba(30,64,175,.10), transparent 30%),
          #eee8dc;
      }

      .econ-clean-page {
        display: grid;
        gap: 16px;
      }

      .econ-section {
        display: grid;
        gap: 10px;
      }

      .econ-heading {
        display: flex;
        justify-content: space-between;
        align-items: end;
        gap: 14px;
      }

      .econ-heading h2 {
        margin: 2px 0;
        font-family: Georgia, serif;
        color: #07111f;
        font-size: clamp(1.55rem, 2.4vw, 2.35rem);
        line-height: .95;
      }

      .econ-heading p {
        margin: 0;
        color: #475569;
        max-width: 720px;
        font-size: .92rem;
      }

      .econ-eyebrow {
        color: #1d4ed8;
        font-size: .62rem;
        font-weight: 1000;
        letter-spacing: .19em;
        text-transform: uppercase;
      }

      .econ-top-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.2fr) minmax(330px, .8fr);
        gap: 12px;
      }

      .econ-panel {
        border: 1px solid rgba(15,23,42,.16);
        border-radius: 18px;
        background: rgba(248,250,252,.88);
        box-shadow: 0 14px 34px rgba(15,23,42,.10);
        padding: 13px;
        overflow: hidden;
      }

      .econ-panel.dark {
        background: linear-gradient(180deg, #17253c, #07111f);
        color: #fff;
        border-color: rgba(255,255,255,.12);
      }

      .econ-panel h3 {
        margin: 4px 0 10px;
        color: #07111f;
        font-family: Georgia, serif;
        font-size: 1.08rem;
      }

      .econ-panel.dark h3 {
        color: #fff;
      }

      .econ-panel.dark .econ-eyebrow {
        color: #93c5fd;
      }

      .econ-note {
        color: #64748b;
        font-size: .8rem;
        line-height: 1.35;
      }

      .econ-panel.dark .econ-note {
        color: #cbd5e1;
      }

      .econ-tile-grid {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 7px;
      }

      .econ-tile {
        border: 1px solid rgba(15,23,42,.11);
        border-radius: 13px;
        background: linear-gradient(180deg, rgba(255,255,255,.90), rgba(241,245,249,.90));
        padding: 8px;
        min-height: 72px;
      }

      .econ-tile strong {
        display: block;
        color: #1d4ed8;
        font-size: .52rem;
        font-weight: 1000;
        letter-spacing: .09em;
        text-transform: uppercase;
      }

      .econ-tile .value {
        display: block;
        margin-top: 4px;
        color: #07111f;
        font-size: .95rem;
        font-weight: 1000;
        line-height: 1.05;
      }

      .econ-tile .move {
        display: block;
        margin-top: 4px;
        color: #64748b;
        font-size: .64rem;
        font-weight: 850;
      }

      .econ-movement-list {
        display: grid;
        gap: 7px;
      }

      .econ-movement-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto auto;
        gap: 7px;
        align-items: center;
        padding: 8px;
        border-radius: 12px;
        background: rgba(255,255,255,.075);
        border: 1px solid rgba(255,255,255,.10);
      }

      .econ-movement-row strong {
        color: #fff;
        font-size: .78rem;
      }

      .econ-movement-row span {
        color: #cbd5e1;
        font-size: .68rem;
        font-weight: 800;
      }

      .econ-pill {
        border-radius: 999px;
        padding: 4px 7px;
        font-size: .66rem;
        font-weight: 1000;
        color: #fff;
        background: rgba(148,163,184,.22);
        border: 1px solid rgba(255,255,255,.12);
        white-space: nowrap;
      }

      .econ-pill.up {
        background: rgba(22,101,52,.28);
        border-color: rgba(34,197,94,.35);
      }

      .econ-pill.down {
        background: rgba(153,27,27,.30);
        border-color: rgba(248,113,113,.35);
      }

      .econ-filter-bar {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .econ-filter-btn {
        border: 1px solid rgba(15,23,42,.15);
        background: rgba(255,255,255,.86);
        color: #07111f;
        border-radius: 999px;
        padding: 6px 10px;
        font-size: .72rem;
        font-weight: 1000;
        cursor: pointer;
      }

      .econ-filter-btn.is-active {
        color: #fff;
        background: #07111f;
        border-color: #07111f;
      }

      .econ-chart-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
      }

      .econ-chart-card {
        border: 1px solid rgba(15,23,42,.14);
        border-radius: 16px;
        background: linear-gradient(180deg, rgba(255,255,255,.92), rgba(241,245,249,.88));
        box-shadow: 0 12px 26px rgba(15,23,42,.08);
        padding: 10px;
        overflow: hidden;
      }

      .econ-chart-card h3 {
        margin: 3px 0 2px;
        color: #07111f;
        font-family: Georgia, serif;
        font-size: 1rem;
      }

      .econ-chart-meta {
        color: #475569;
        font-size: .66rem;
        font-weight: 850;
        margin-bottom: 6px;
      }

      .econ-chart-wrap {
        border: 1px solid rgba(15,23,42,.11);
        border-radius: 13px;
        background: #f8fafc;
        padding: 6px;
        min-height: 132px;
      }

      .econ-chart-svg {
        width: 100%;
        height: 128px;
        display: block;
      }

      .econ-chart-axis {
        stroke: rgba(15,23,42,.14);
        stroke-width: 1;
      }

      .econ-chart-line {
        fill: none;
        stroke: #1d4ed8;
        stroke-width: 2.3;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      .econ-chart-area {
        fill: rgba(30,64,175,.13);
      }

      .econ-chart-dot {
        fill: #1d4ed8;
        stroke: #fff;
        stroke-width: 1.4;
      }

      .econ-chart-label {
        fill: #334155;
        font-size: 8px;
        font-weight: 900;
      }

      .econ-chart-footer {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 5px;
        margin-top: 6px;
      }

      .econ-small {
        border: 1px solid rgba(15,23,42,.10);
        background: rgba(248,250,252,.96);
        border-radius: 10px;
        padding: 5px;
      }

      .econ-small strong {
        display: block;
        color: #475569;
        font-size: .50rem;
        font-weight: 1000;
        letter-spacing: .07em;
        text-transform: uppercase;
      }

      .econ-small span {
        display: block;
        margin-top: 2px;
        color: #07111f;
        font-size: .72rem;
        font-weight: 1000;
      }

      .econ-empty {
        display: grid;
        place-items: center;
        min-height: 112px;
        color: #64748b;
        font-size: .78rem;
        font-weight: 850;
        text-align: center;
      }

      .econ-record-table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0 6px;
      }

      .econ-record-table th {
        text-align: left;
        color: #1d4ed8;
        font-size: .56rem;
        letter-spacing: .1em;
        text-transform: uppercase;
        padding: 0 7px;
      }

      .econ-record-table td {
        padding: 8px 7px;
        background: rgba(248,250,252,.92);
        border-top: 1px solid rgba(15,23,42,.09);
        border-bottom: 1px solid rgba(15,23,42,.09);
        color: #07111f;
        font-size: .78rem;
        font-weight: 850;
      }

      .econ-record-table td:first-child {
        border-left: 1px solid rgba(15,23,42,.09);
        border-radius: 10px 0 0 10px;
      }

      .econ-record-table td:last-child {
        border-right: 1px solid rgba(15,23,42,.09);
        border-radius: 0 10px 10px 0;
      }

      @media (max-width: 1200px) {
        .econ-top-grid,
        .econ-chart-grid {
          grid-template-columns: 1fr;
        }

        .econ-tile-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 700px) {
        .econ-heading {
          display: grid;
        }

        .econ-tile-grid,
        .econ-chart-footer {
          grid-template-columns: 1fr;
        }

        .econ-movement-row {
          grid-template-columns: 1fr;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function shortLabel(label) {
    const text = cleanCell(label);
    if (text.length <= 8) return text;
    const parts = text.split(/\s+/);
    if (parts.length >= 2) return `${parts[0].slice(0, 3)} ${parts[parts.length - 1]}`;
    return text.slice(0, 8);
  }

  function svgLineChart(points, stat) {
    if (!points.length) return `<div class="econ-empty">No data for ${safeHTML(stat.title)}.</div>`;

    const width = 520;
    const height = 128;
    const pad = { top: 10, right: 8, bottom: 22, left: 40 };
    const chartW = width - pad.left - pad.right;
    const chartH = height - pad.top - pad.bottom;

    const values = points.map((point) => point.value);
    let min = Math.min(...values);
    let max = Math.max(...values);

    if (min === max) {
      min -= Math.abs(min * 0.1) || 1;
      max += Math.abs(max * 0.1) || 1;
    }

    const spread = max - min;
    min -= spread * 0.08;
    max += spread * 0.08;

    const xFor = (i) => pad.left + (points.length === 1 ? chartW / 2 : (i / (points.length - 1)) * chartW);
    const yFor = (value) => pad.top + ((max - value) / (max - min)) * chartH;

    const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${xFor(index).toFixed(2)} ${yFor(point.value).toFixed(2)}`).join(" ");
    const areaPath = `${linePath} L ${xFor(points.length - 1).toFixed(2)} ${height - pad.bottom} L ${xFor(0).toFixed(2)} ${height - pad.bottom} Z`;

    const ticks = [min, min + (max - min) / 2, max];
    const labelEvery = Math.max(1, Math.ceil(points.length / 4));

    return `
      <svg class="econ-chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
        ${ticks.map((tick) => `
          <line class="econ-chart-axis" x1="${pad.left}" x2="${width - pad.right}" y1="${yFor(tick)}" y2="${yFor(tick)}"></line>
          <text class="econ-chart-label" x="3" y="${yFor(tick) + 3}">${safeHTML(formatValue(tick, stat))}</text>
        `).join("")}

        <path class="econ-chart-area" d="${areaPath}"></path>
        <path class="econ-chart-line" d="${linePath}"></path>

        ${points.map((point, index) => `
          <circle class="econ-chart-dot" cx="${xFor(index)}" cy="${yFor(point.value)}" r="2.8">
            <title>${safeHTML(point.label)}: ${safeHTML(formatValue(point.value, stat))}</title>
          </circle>
        `).join("")}

        ${points.map((point, index) => {
          if (index % labelEvery !== 0 && index !== points.length - 1) return "";
          return `<text class="econ-chart-label" x="${xFor(index) - 13}" y="${height - 7}">${safeHTML(shortLabel(point.label))}</text>`;
        }).join("")}
      </svg>
    `;
  }

  function macroTile(stat, latest, previous) {
    const value = getValue(latest, stat.keys);
    if (value === null) return "";

    const previousValue = getValue(previous, stat.keys);
    const diff = previousValue === null ? null : value - previousValue;

    return `
      <div class="econ-tile">
        <strong>${safeHTML(stat.title)}</strong>
        <span class="value">${safeHTML(formatValue(value, stat))}</span>
        <span class="move">YoY: ${safeHTML(formatMovement(diff, stat))}</span>
      </div>
    `;
  }

  function movementRow(stat) {
    const allPoints = MONTHLY_ROWS.map((row, index) => {
      const value = getValue(row, stat.keys);
      if (value === null) return null;
      return { label: monthLabel(row, index), value, row };
    }).filter(Boolean);

    const points = allPoints.slice(-13);
    if (!points.length) return "";

    const latest = points[points.length - 1];
    const previous = points[points.length - 2] || null;
    const twelveAgo = points.length >= 13 ? points[0] : null;

    const oneMonth = previous ? latest.value - previous.value : null;
    const twelveMonth = twelveAgo ? latest.value - twelveAgo.value : null;

    return `
      <div class="econ-movement-row">
        <div>
          <strong>${safeHTML(stat.title)}</strong>
          <span>${safeHTML(latest.label)} • ${safeHTML(formatValue(latest.value, stat))}</span>
        </div>
        <div class="econ-pill ${safeHTML(movementClass(oneMonth || 0))}">
          1M ${safeHTML(formatMovement(oneMonth, stat))}
        </div>
        <div class="econ-pill ${safeHTML(movementClass(twelveMonth || 0))}">
          12M ${safeHTML(formatMovement(twelveMonth, stat))}
        </div>
      </div>
    `;
  }

  function chartFooter(points, stat, mode) {
    if (!points.length) return "";

    const latest = points[points.length - 1];
    const previous = points[points.length - 2] || null;
    const comparison = mode === "monthly"
      ? points.length >= 13 ? points[points.length - 13] : points[0]
      : points[0];

    const oneMove = previous ? latest.value - previous.value : null;
    const longMove = comparison ? latest.value - comparison.value : null;

    return `
      <div class="econ-chart-footer">
        <div class="econ-small">
          <strong>Latest</strong>
          <span>${safeHTML(formatValue(latest.value, stat))}</span>
        </div>
        <div class="econ-small">
          <strong>${mode === "monthly" ? "1M Move" : "YoY Move"}</strong>
          <span>${safeHTML(formatMovement(oneMove, stat))}</span>
        </div>
        <div class="econ-small">
          <strong>${mode === "monthly" ? "Range Move" : "Full Move"}</strong>
          <span>${safeHTML(formatMovement(longMove, stat))}</span>
        </div>
      </div>
    `;
  }

  function chartCard(stat, points, mode) {
    const first = points[0]?.label || "—";
    const last = points[points.length - 1]?.label || "—";

    return `
      <article class="econ-chart-card">
        <div class="econ-eyebrow">${safeHTML(stat.group)}</div>
        <h3>${safeHTML(stat.title)}</h3>
        <div class="econ-chart-meta">
          ${safeHTML(points.length ? `${first} → ${last} • ${points.length} records` : "No records")}
        </div>
        <div class="econ-chart-wrap">
          ${svgLineChart(points, stat)}
        </div>
        ${chartFooter(points, stat, mode)}
      </article>
    `;
  }

  function filterStats(stats, group) {
    return group === "All" ? stats : stats.filter((stat) => stat.group === group);
  }

  function renderYearlyCharts(group = "All") {
    const slot = getEl("#econ-yearly-charts");
    if (!slot) return;

    const stats = filterStats(YEARLY_STATS, group);

    slot.innerHTML = `
      <div class="econ-chart-grid">
        ${stats.map((stat) => chartCard(stat, yearlyPoints(stat), "yearly")).join("")}
      </div>
    `;
  }

  function renderMonthlyCharts(group = "All") {
    const slot = getEl("#econ-monthly-charts");
    if (!slot) return;

    const stats = filterStats(MONTHLY_STATS, group);

    slot.innerHTML = `
      <div class="econ-chart-grid">
        ${stats.map((stat) => chartCard(stat, monthlyPoints(stat), "monthly")).join("")}
      </div>
    `;
  }

  function addFilterButton(container, label, active, callback) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `econ-filter-btn ${active ? "is-active" : ""}`;
    button.textContent = label;

    button.addEventListener("click", () => {
      container.querySelectorAll(".econ-filter-btn").forEach((btn) => btn.classList.remove("is-active"));
      button.classList.add("is-active");
      callback(label);
    });

    container.appendChild(button);
  }

  function addMonthlyRangeButton(container, label, value, active) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `econ-filter-btn ${active ? "is-active" : ""}`;
    button.textContent = label;

    button.addEventListener("click", () => {
      MONTHLY_RANGE = value;
      container.querySelectorAll(".econ-filter-btn").forEach((btn) => btn.classList.remove("is-active"));
      button.classList.add("is-active");

      const activeGroup = getEl("#econ-monthly-filters .econ-filter-btn.is-active")?.textContent || "All";
      renderMonthlyCharts(activeGroup);
    });

    container.appendChild(button);
  }

  function renderRecords() {
    const rows = [...ECON_ROWS]
      .filter((row) => YEARLY_STATS.some((stat) => getValue(row, stat.keys) !== null))
      .slice(-10)
      .reverse();

    if (!rows.length) return `<div class="econ-panel"><p class="econ-note">No yearly records found.</p></div>`;

    const gdp = YEARLY_STATS.find((s) => s.id === "gdp");
    const debt = YEARLY_STATS.find((s) => s.id === "debt");
    const deficit = YEARLY_STATS.find((s) => s.id === "deficit");
    const growth = YEARLY_STATS.find((s) => s.id === "growth");
    const unemployment = YEARLY_STATS.find((s) => s.id === "unemployment");
    const inflation = YEARLY_STATS.find((s) => s.id === "inflation");
    const jobs = YEARLY_STATS.find((s) => s.id === "job_creation");

    return `
      <section class="econ-panel">
        <div class="econ-eyebrow">Official Archive</div>
        <h3>Recent Fiscal Year Records</h3>
        <table class="econ-record-table">
          <thead>
            <tr>
              <th>Year</th><th>GDP</th><th>Debt</th><th>Deficit</th>
              <th>Growth</th><th>Unemployment</th><th>Inflation</th><th>Jobs</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row, index) => `
              <tr>
                <td>${safeHTML(yearLabel(row, index))}</td>
                <td>${safeHTML(formatValue(getValue(row, gdp.keys), gdp))}</td>
                <td>${safeHTML(formatValue(getValue(row, debt.keys), debt))}</td>
                <td>${safeHTML(formatValue(getValue(row, deficit.keys), deficit))}</td>
                <td>${safeHTML(formatValue(getValue(row, growth.keys), growth))}</td>
                <td>${safeHTML(formatValue(getValue(row, unemployment.keys), unemployment))}</td>
                <td>${safeHTML(formatValue(getValue(row, inflation.keys), inflation))}</td>
                <td>${safeHTML(formatValue(getValue(row, jobs.keys), jobs))}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </section>
    `;
  }

  function rebuildEconomyPage() {
    const main = document.querySelector("main") || document.body;

    const latest = latestMacroRow();
    const previous = previousMacroRow();
    const year = firstValue(latest, ["year", "date"], "Latest Year");

    const tileStats = TOP_YEARLY_TILES
      .map((id) => YEARLY_STATS.find((stat) => stat.id === id))
      .filter(Boolean);

    main.innerHTML = `
      <section class="section section-tight">
        <div class="container-wide econ-clean-page">
          <section class="econ-section">
            <div class="econ-heading">
              <div>
                <div class="econ-eyebrow">Office of Budget Management</div>
                <h2>Macro Dashboard</h2>
                <p>${safeHTML(year)} fiscal snapshot. Movement is shown as absolute movement or percentage points.</p>
              </div>
            </div>

            <div class="econ-top-grid">
              <section class="econ-panel">
                <div class="econ-eyebrow">Current Year</div>
                <h3>${safeHTML(year)} Key Indicators</h3>
                <div class="econ-tile-grid">
                  ${tileStats.map((stat) => macroTile(stat, latest, previous)).join("")}
                </div>
              </section>

              <aside class="econ-panel dark">
                <div class="econ-eyebrow">Monthly Movement</div>
                <h3>Latest Moves</h3>
                <p class="econ-note">Uses the latest 13 monthly records for 1M and 12M movement.</p>
                <div class="econ-movement-list">
                  ${MONTHLY_STATS.map(movementRow).join("") || `<p class="econ-note">No monthly records found.</p>`}
                </div>
              </aside>
            </div>
          </section>

          <section class="econ-section">
            <div class="econ-heading">
              <div>
                <div class="econ-eyebrow">Yearly Charts</div>
                <h2>Economic Trends</h2>
                <p>WEB_ECON yearly indicators, grouped by output, fiscal, labor, and prices.</p>
              </div>
              <div class="econ-filter-bar" id="econ-yearly-filters"></div>
            </div>
            <div id="econ-yearly-charts"></div>
          </section>

          <section class="econ-section">
            <div class="econ-heading">
              <div>
                <div class="econ-eyebrow">Monthly Charts</div>
                <h2>Approval, Markets & Jobs</h2>
                <p>Default view shows all monthly records. Use Last 12 Months for a shorter dashboard.</p>
              </div>
              <div>
                <div class="econ-filter-bar" id="econ-monthly-range" style="margin-bottom:6px;"></div>
                <div class="econ-filter-bar" id="econ-monthly-filters"></div>
              </div>
            </div>
            <div id="econ-monthly-charts"></div>
          </section>

          <section class="econ-section">
            ${renderRecords()}
          </section>
        </div>
      </section>
    `;

    const yearlyFilters = getEl("#econ-yearly-filters");
    if (yearlyFilters) {
      ["All", "Output", "Fiscal", "Labor", "Prices"].forEach((group, index) => {
        addFilterButton(yearlyFilters, group, index === 0, renderYearlyCharts);
      });
    }

    const monthlyRange = getEl("#econ-monthly-range");
    if (monthlyRange) {
      addMonthlyRangeButton(monthlyRange, "All Monthly Data", "all", true);
      addMonthlyRangeButton(monthlyRange, "Last 12 Months", "12", false);
    }

    const monthlyFilters = getEl("#econ-monthly-filters");
    if (monthlyFilters) {
      ["All", "Political", "Markets", "Labor"].forEach((group, index) => {
        addFilterButton(monthlyFilters, group, index === 0, renderMonthlyCharts);
      });
    }

    renderYearlyCharts("All");
    renderMonthlyCharts("All");
  }

  function updateHeroCard() {
    const heroCard = getEl(".hero-side-card");
    if (!heroCard) return;

    const latest = latestMacroRow();
    const year = firstValue(latest, ["year", "date"], "Latest");
    const monthlyCount = MONTHLY_ROWS.length.toLocaleString();
    const yearlyCount = ECON_ROWS.length.toLocaleString();

    heroCard.innerHTML = `
      <div class="eyebrow">OBM Record</div>
      <h2>${safeHTML(year)} Economy Loaded</h2>
      <p>${safeHTML(yearlyCount)} yearly rows and ${safeHTML(monthlyCount)} monthly rows loaded.</p>
    `;
  }

  async function initEconomy() {
    try {
      injectStyles();
      await loadData();
      rebuildEconomyPage();
      updateHeroCard();
    } catch (error) {
      console.error("Economy page failed:", error);

      const main = document.querySelector("main") || document.body;
      main.innerHTML = `
        <section class="section section-tight">
          <div class="container-wide">
            <div class="econ-panel">
              <div class="econ-eyebrow">Error</div>
              <h3>Economy failed to load</h3>
              <p class="econ-note">${safeHTML(error.message)}</p>
            </div>
          </div>
        </section>
      `;
    }
  }

  document.addEventListener("DOMContentLoaded", initEconomy);
})();
