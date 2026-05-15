(function () {
  "use strict";

  console.log("ECONOMY.JS LOADED — v20260515-revenue-total-fullfix");

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

  function toNumber(value, fallback = null) {
    if (value === null || value === undefined || value === "") return fallback;

    const raw = String(value)
      .replace(/[$,%]/g, "")
      .replace(/,/g, "")
      .trim();

    if (raw === "") return fallback;

    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function normalizePct(value) {
    const raw = cleanCell(value);
    const num = toNumber(raw, null);

    if (num === null || !Number.isFinite(num)) return null;
    if (raw.includes("%")) return num;
    if (Math.abs(num) <= 1) return num * 100;

    return num;
  }

  let ECON_ROWS = [];
  let MONTHLY_ROWS = [];
  let CONTROL_ROWS = [];
  let MACRO_ROWS = [];
  let FISCAL_ROWS = [];
  let REVENUE_ROWS = [];
  let DISCRETIONARY_ROWS = [];
  let MANDATORY_ROWS = [];
  let DASHBOARD_ROWS = [];

  let CURRENT_YEAR = null;
  let CURRENT_MONTH = null;
  let MONTHLY_RANGE = "all";
  let CHART_START_YEAR = null;
  let CHART_END_YEAR = null;
  let SELECTED_COMPARE_YEAR = null;

  const YEARLY_STATS = [
    { id: "gdp", title: "GDP", keys: ["real_gdp", "gdp", "nominal_gdp"], prefix: "$", group: "Output", changeType: "absolute" },
    { id: "debt", title: "National Debt", keys: ["ending_debt", "debt", "national_debt"], prefix: "$", group: "Fiscal", changeType: "absolute" },
    { id: "total_revenue", title: "Total Revenue", keys: ["total_revenue"], prefix: "$", group: "Fiscal", changeType: "absolute" },
    { id: "total_spending", title: "Total Spending", keys: ["total_spending"], prefix: "$", group: "Fiscal", changeType: "absolute" },
    { id: "deficit", title: "Raw Deficit", keys: ["__raw_deficit_display__"], prefix: "$", group: "Fiscal", changeType: "absolute" },
    { id: "interest_cost", title: "Interest on Debt", keys: ["__interest_from_fiscal__"], prefix: "$", group: "Fiscal", changeType: "absolute" },
    { id: "growth", title: "GDP Growth", keys: ["final_gdp_growth", "gdp_growth", "growth", "real_growth", "annual_gdp_growth"], suffix: "%", group: "Output", changeType: "pp" },
    { id: "job_creation", title: "Job Creation", keys: ["job_creation", "annual_job_creation", "jobs", "jobs_created", "net_jobs"], group: "Labor", changeType: "absolute" },
    { id: "unemployment", title: "Unemployment", keys: ["final_unemployment", "unemployment", "unemployment_rate"], suffix: "%", group: "Labor", changeType: "pp" },
    { id: "inflation", title: "Inflation", keys: ["final_inflation", "inflation", "inflation_rate"], suffix: "%", group: "Prices", changeType: "pp" },
    { id: "median_wage", title: "Median Wage", keys: ["final_median_wage", "median_wage", "wage", "median_income"], prefix: "$", group: "Labor", changeType: "absolute" },
    { id: "population", title: "Population", keys: ["population"], suffix: "M", group: "Population", changeType: "absolute" },
    { id: "gdp_per_capita", title: "GDP Per Capita", keys: ["__gdp_per_capita__"], prefix: "$", group: "Population", changeType: "absolute" },
    { id: "debt_gdp", title: "Debt-to-GDP", keys: ["__debt_gdp_display__"], suffix: "%", group: "Fiscal", changeType: "pp" },
    { id: "deficit_gdp", title: "Deficit-to-GDP", keys: ["__deficit_gdp_display__"], suffix: "%", group: "Fiscal", changeType: "pp" }
  ];

  const TOP_YEARLY_TILES = [
    "gdp",
    "debt",
    "total_revenue",
    "total_spending",
    "deficit",
    "interest_cost",
    "growth",
    "job_creation",
    "unemployment",
    "inflation",
    "population",
    "gdp_per_capita",
    "debt_gdp",
    "deficit_gdp",
    "median_wage"
  ];

  const MONTHLY_STATS = [
    { id: "gdp_monthly", title: "Monthly GDP", keys: ["gdp_monthly", "gdp_month_base"], prefix: "$", group: "Output", changeType: "absolute" },
    { id: "approval", title: "POTUS Approval", keys: ["potus_approval", "approval", "approval_rating"], suffix: "%", group: "Political", changeType: "pp" },
    { id: "oil", title: "Oil Price", keys: ["oil_price", "oil", "crude_oil"], prefix: "$", group: "Markets", changeType: "absolute" },
    { id: "job_creation", title: "Job Creation", keys: ["job_creation_monthly", "job_creation", "jobs", "jobs_created", "net_jobs"], group: "Labor", changeType: "absolute" },
    { id: "stock", title: "Stock Index", keys: ["stock_market_index", "stock_market_in", "stock", "stocks", "stock_index", "market", "sp500"], group: "Markets", changeType: "absolute" }
  ];

  const REVENUE_STATS = [
    { id: "income_0_10k", title: "Income $0–10k", keys: ["income_0_10k_revenue"], prefix: "$", group: "Income", changeType: "absolute" },
    { id: "income_10_30k", title: "Income $10k–30k", keys: ["income_10_30k_revenue"], prefix: "$", group: "Income", changeType: "absolute" },
    { id: "income_30_60k", title: "Income $30k–60k", keys: ["income_30_60k_revenue"], prefix: "$", group: "Income", changeType: "absolute" },
    { id: "income_60_100k", title: "Income $60k–100k", keys: ["income_60_100k_revenue"], prefix: "$", group: "Income", changeType: "absolute" },
    { id: "income_100_250k", title: "Income $100k–250k", keys: ["income_100_250k_revenue"], prefix: "$", group: "Income", changeType: "absolute" },
    { id: "income_250_500k", title: "Income $250k–500k", keys: ["income_250_500k_revenue"], prefix: "$", group: "Income", changeType: "absolute" },
    { id: "payroll_medicare", title: "Medicare Payroll", keys: ["payroll_medicare_revenue"], prefix: "$", group: "Payroll", changeType: "absolute" },
    { id: "payroll_social_security", title: "Social Security Payroll", keys: ["payroll_social_security_revenue"], prefix: "$", group: "Payroll", changeType: "absolute" },
    { id: "payroll_worker", title: "Worker Payroll", keys: ["payroll_worker_revenue"], prefix: "$", group: "Payroll", changeType: "absolute" },
    { id: "ucare", title: "UCare Revenue", keys: ["ucare_revenue"], prefix: "$", group: "UCare", changeType: "absolute" },
    { id: "sales_tax", title: "Sales Tax", keys: ["sales_tax_revenue"], prefix: "$", group: "Other", changeType: "absolute" },
    { id: "cap_short", title: "Short-Term Capital Gains", keys: ["cap_gains_short_term_revenue"], prefix: "$", group: "Capital Gains", changeType: "absolute" },
    { id: "cap_long", title: "Long-Term Capital Gains", keys: ["cap_gains_long_term_revenue"], prefix: "$", group: "Capital Gains", changeType: "absolute" },
    { id: "excise", title: "Excise Tax", keys: ["excise_tax_revenue"], prefix: "$", group: "Other", changeType: "absolute" },
    { id: "event_revenue", title: "Event Revenue Impact", keys: ["event_revenue_impact"], prefix: "$", group: "Other", changeType: "absolute" },
    { id: "direct_revenue", title: "Direct Revenue", keys: ["direct_revenue"], prefix: "$", group: "Other", changeType: "absolute" },
    { id: "total_revenue", title: "Total Revenue", keys: ["total_revenue"], prefix: "$", group: "Totals", changeType: "absolute" }
  ];

  const SPENDING_STATS = [
    { id: "defense", title: "Defense", keys: ["defense_spending"], prefix: "$", group: "Security", changeType: "absolute" },
    { id: "education", title: "Education", keys: ["education_spending"], prefix: "$", group: "Domestic", changeType: "absolute" },
    { id: "health_social_admin", title: "Health & Social Admin", keys: ["health_social_admin_spending"], prefix: "$", group: "Domestic", changeType: "absolute" },
    { id: "transportation", title: "Transportation", keys: ["transportation_spending"], prefix: "$", group: "Domestic", changeType: "absolute" },
    { id: "treasury", title: "Treasury", keys: ["treasury_spending"], prefix: "$", group: "Agency", changeType: "absolute" },
    { id: "veterans", title: "Veterans Affairs", keys: ["veterans_affairs_spending"], prefix: "$", group: "Security", changeType: "absolute" },
    { id: "homeland", title: "Homeland Security", keys: ["homeland_security_spending"], prefix: "$", group: "Security", changeType: "absolute" },
    { id: "justice", title: "Justice", keys: ["justice_spending"], prefix: "$", group: "Security", changeType: "absolute" },
    { id: "state", title: "State / Foreign Affairs", keys: ["state_foreign_affairs_spending"], prefix: "$", group: "Security", changeType: "absolute" },
    { id: "interior", title: "Interior / Natural Resources", keys: ["interior_natural_resources_spending"], prefix: "$", group: "Domestic", changeType: "absolute" },
    { id: "agriculture", title: "Agriculture", keys: ["agriculture_spending"], prefix: "$", group: "Domestic", changeType: "absolute" },
    { id: "energy", title: "Energy", keys: ["energy_spending"], prefix: "$", group: "Domestic", changeType: "absolute" },
    { id: "commerce", title: "Commerce", keys: ["commerce_spending"], prefix: "$", group: "Agency", changeType: "absolute" },
    { id: "labor", title: "Labor", keys: ["labor_spending"], prefix: "$", group: "Agency", changeType: "absolute" },
    { id: "hud", title: "HUD", keys: ["housing_urban_development_spending"], prefix: "$", group: "Domestic", changeType: "absolute" },
    { id: "epa", title: "EPA", keys: ["environmental_protection_spending"], prefix: "$", group: "Domestic", changeType: "absolute" },
    { id: "nasa", title: "NASA", keys: ["nasa_spending"], prefix: "$", group: "Agency", changeType: "absolute" },
    { id: "sba", title: "SBA", keys: ["sba_spending"], prefix: "$", group: "Agency", changeType: "absolute" },
    { id: "other", title: "Other Agencies", keys: ["other_agencies_spending"], prefix: "$", group: "Other", changeType: "absolute" },
    { id: "general_government", title: "General Government", keys: ["general_government_spending"], prefix: "$", group: "Other", changeType: "absolute" },
    { id: "event_direct_cost", title: "Other Event Direct Cost", keys: ["event_direct_cost"], prefix: "$", group: "Other", changeType: "absolute" },
    { id: "event_cost_from_pct_gdp", title: "Other Event GDP Cost", keys: ["event_cost_from_pct_gdp"], prefix: "$", group: "Other", changeType: "absolute" },
    { id: "total_discretionary", title: "Total Discretionary", keys: ["total_discretionary_spending"], prefix: "$", group: "Totals", changeType: "absolute" }
  ];

  const MANDATORY_STATS = [
    { id: "social_security", title: "Social Security", keys: ["social_security_cost"], prefix: "$", group: "Core Entitlements", changeType: "absolute" },
    { id: "medicare", title: "Medicare", keys: ["medicare_cost"], prefix: "$", group: "Core Entitlements", changeType: "absolute" },
    { id: "medicaid", title: "Medicaid", keys: ["medicaid_cost"], prefix: "$", group: "Core Entitlements", changeType: "absolute" },
    { id: "ucare", title: "UCare Spending", keys: ["ucare_cost"], prefix: "$", group: "Health", changeType: "absolute" },
    { id: "snap", title: "SNAP", keys: ["snap_cost"], prefix: "$", group: "Income Support", changeType: "absolute" },
    { id: "child_health", title: "Child Health", keys: ["child_health_cost"], prefix: "$", group: "Health", changeType: "absolute" },
    { id: "fcwa", title: "FCWA", keys: ["fcwa_cost"], prefix: "$", group: "Worker Benefits", changeType: "absolute" },
    { id: "civilian_retirement", title: "Civilian Retirement", keys: ["fed_civilian_retirement_cost"], prefix: "$", group: "Retirement", changeType: "absolute" },
    { id: "military_retirement", title: "Military Retirement", keys: ["fed_military_retirement_cost"], prefix: "$", group: "Retirement", changeType: "absolute" },
    { id: "ssi", title: "SSI", keys: ["ssi_cost"], prefix: "$", group: "Income Support", changeType: "absolute" },
    { id: "interest_cost", title: "Interest on Debt", keys: ["__interest_from_fiscal__"], prefix: "$", group: "Debt Service", changeType: "absolute" },
    { id: "other_mandatory", title: "Other Mandatory", keys: ["other_mandatory_cost"], prefix: "$", group: "Other", changeType: "absolute" },
    { id: "mandatory_direct", title: "Other Mandatory Direct Cost", keys: ["mandatory_direct_cost"], prefix: "$", group: "Other", changeType: "absolute" },
    { id: "total_mandatory", title: "Total Mandatory", keys: ["total_mandatory_spending"], prefix: "$", group: "Totals", changeType: "absolute" }
  ];

  const PIE_REVENUE_FIELDS = [
    ["payroll_social_security_revenue", "Social Security Payroll"],
    ["payroll_medicare_revenue", "Medicare Payroll"],
    ["payroll_worker_revenue", "Worker Payroll"],

    ["income_0_10k_revenue", "Income $0–10k"],
    ["income_10_30k_revenue", "Income $10k–30k"],
    ["income_30_60k_revenue", "Income $30k–60k"],
    ["income_60_100k_revenue", "Income $60k–100k"],
    ["income_100_250k_revenue", "Income $100k–250k"],
    ["income_250_500k_revenue", "Income $250k–500k"],

    ["ucare_revenue", "UCare Revenue"],

    ["sales_tax_revenue", "Sales Tax"],
    ["cap_gains_short_term_revenue", "Short-Term Capital Gains"],
    ["cap_gains_long_term_revenue", "Long-Term Capital Gains"],
    ["excise_tax_revenue", "Excise Tax"],

    ["event_revenue_impact", "Event Revenue Impact"],
    ["direct_revenue", "Direct Revenue"]
  ];

  const PIE_DISCRETIONARY_FIELDS = [
    ["defense_spending", "Defense"],
    ["transportation_spending", "Transportation"],
    ["education_spending", "Education"],
    ["veterans_affairs_spending", "Veterans Affairs"],
    ["health_social_admin_spending", "Health & Social Admin"],
    ["homeland_security_spending", "Homeland Security"],
    ["energy_spending", "Energy"],
    ["justice_spending", "Justice"],
    ["state_foreign_affairs_spending", "State / Foreign Affairs"],
    ["housing_urban_development_spending", "HUD"],
    ["treasury_spending", "Treasury"],
    ["interior_natural_resources_spending", "Interior / Natural Resources"],
    ["agriculture_spending", "Agriculture"],
    ["commerce_spending", "Commerce"],
    ["labor_spending", "Labor"],
    ["environmental_protection_spending", "EPA"],
    ["nasa_spending", "NASA"],
    ["sba_spending", "SBA"],
    ["other_agencies_spending", "Other Agencies"],
    ["general_government_spending", "General Government"],
    ["event_direct_cost", "Event Direct Cost"],
    ["event_cost_from_pct_gdp", "Event GDP Cost"]
  ];

  const PIE_MANDATORY_FIELDS = [
    ["social_security_cost", "Social Security"],
    ["medicare_cost", "Medicare"],
    ["other_mandatory_cost", "Other Mandatory"],
    ["__interest_from_fiscal__", "Interest on Debt"],
    ["medicaid_cost", "Medicaid"],
    ["ucare_cost", "UCare Spending"],
    ["fcwa_cost", "FCWA"],
    ["ssi_cost", "SSI"],
    ["child_health_cost", "Child Health"],
    ["fed_military_retirement_cost", "Military Retirement"],
    ["fed_civilian_retirement_cost", "Civilian Retirement"],
    ["snap_cost", "SNAP"],
    ["mandatory_direct_cost", "Other Mandatory Direct Cost"]
  ];

  const PIE_COLORS = [
    "#1d4ed8", "#ef4444", "#10b981", "#c084fc", "#f97316",
    "#14b8a6", "#f43f5e", "#6366f1", "#eab308", "#0ea5e9",
    "#22c55e", "#8b5cf6", "#dc2626", "#2563eb", "#7c3aed",
    "#b45309", "#0f766e", "#be123c", "#4338ca", "#64748b"
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

  function yearKey(row) {
    const raw = firstValue(row, ["year", "fiscal_year", "date", "label"], "");
    const match = String(raw).match(/\d{4}/);
    return match ? match[0] : "";
  }

  function yearNumber(row) {
    return toNumber(yearKey(row), null);
  }

  function findRowByYear(rows, year) {
    const target = String(year || "");
    return rows.find((row) => yearKey(row) === target) || null;
  }

  function mergeRowsByYear(...groups) {
    const map = new Map();

    for (const group of groups) {
      for (const row of group || []) {
        const key = yearKey(row);
        if (!key) continue;

        const existing = map.get(key) || {};
        map.set(key, { ...existing, ...row });
      }
    }

    return [...map.values()].sort((a, b) => Number(yearKey(a)) - Number(yearKey(b)));
  }

  function getGDP(row) {
    const direct = toNumber(row?.real_gdp ?? row?.gdp ?? row?.nominal_gdp, null);
    if (direct !== null && Number.isFinite(direct)) return direct;

    const macroRow = findRowByYear(MACRO_ROWS, yearKey(row));
    const macro = toNumber(macroRow?.real_gdp ?? macroRow?.gdp ?? macroRow?.nominal_gdp, null);

    return macro !== null && Number.isFinite(macro) ? macro : null;
  }

  function getDebt(row) {
    const fiscalRow = findRowByYear(FISCAL_ROWS, yearKey(row)) || row;

    const direct = toNumber(
      fiscalRow?.ending_debt ??
      fiscalRow?.debt ??
      fiscalRow?.national_debt ??
      row?.ending_debt ??
      row?.debt ??
      row?.national_debt,
      null
    );

    return direct !== null && Number.isFinite(direct) ? direct : null;
  }

  function getPopulationRaw(row) {
    const direct = toNumber(row?.population, null);
    if (direct !== null && Number.isFinite(direct)) return direct;

    const macroRow = findRowByYear(MACRO_ROWS, yearKey(row));
    const macro = toNumber(macroRow?.population, null);

    return macro !== null && Number.isFinite(macro) ? macro : null;
  }

  function getPopulationMillions(row) {
    const raw = getPopulationRaw(row);
    if (raw === null || !Number.isFinite(raw)) return null;
    return raw > 10000 ? raw / 1000000 : raw;
  }

  function getGDPPerCapita(row) {
    const gdpBillions = getGDP(row);
    const popRaw = getPopulationRaw(row);

    if (gdpBillions === null || popRaw === null || popRaw <= 0) return null;

    if (popRaw > 10000) return (gdpBillions * 1000000000) / popRaw;

    return (gdpBillions * 1000) / popRaw;
  }

  function getRawInterestFromFiscal(row) {
    const fiscalRow = findRowByYear(FISCAL_ROWS, yearKey(row));

    // Interest only exists in YEARLY_FISCAL_OUTPUT from FY2011 onward.
    // Returning null completely removes FY2001–FY2010 from the interest chart.
    if (!fiscalRow) return null;

    let value = toNumber(fiscalRow.interest_cost, null);
    if (value === null || !Number.isFinite(value)) return null;

    // Safety guard for accidentally scaled sheet values.
    if (value > 5000) value = value / 100;
    if (value > 5000) return null;

    return value;
  }

  function getRawDeficitDisplay(row) {
    const fiscalRow = findRowByYear(FISCAL_ROWS, yearKey(row)) || row;

    const finalSurplusDeficit = toNumber(fiscalRow?.final_surplus_deficit, null);

    if (finalSurplusDeficit !== null && Number.isFinite(finalSurplusDeficit)) {
      return finalSurplusDeficit < 0
        ? Math.abs(finalSurplusDeficit)
        : -Math.abs(finalSurplusDeficit);
    }

    const fallback = toNumber(
      fiscalRow?.raw_deficit ??
      fiscalRow?.deficit ??
      fiscalRow?.deficit_surplus,
      null
    );

    if (fallback !== null && Number.isFinite(fallback)) {
      return Math.abs(fallback);
    }

    return null;
  }

  function getDeficitGDPDisplay(row) {
    const fiscalRow = findRowByYear(FISCAL_ROWS, yearKey(row)) || row;

    const finalSurplusDeficit = toNumber(fiscalRow?.final_surplus_deficit, null);
    const gdp = getGDP(row);

    if (
      finalSurplusDeficit !== null &&
      Number.isFinite(finalSurplusDeficit) &&
      gdp !== null &&
      Number.isFinite(gdp) &&
      gdp > 0
    ) {
      const pct = (Math.abs(finalSurplusDeficit) / gdp) * 100;
      return finalSurplusDeficit < 0 ? pct : -pct;
    }

    const rawDeficit = getRawDeficitDisplay(row);

    if (rawDeficit !== null && gdp !== null && gdp > 0) {
      return rawDeficit >= 0
        ? (Math.abs(rawDeficit) / gdp) * 100
        : -(Math.abs(rawDeficit) / gdp) * 100;
    }

    const direct = normalizePct(
      fiscalRow?.deficit_pct_gdp ??
      fiscalRow?.deficit_gdp ??
      fiscalRow?.deficit_to_gdp ??
      row?.deficit_pct_gdp ??
      row?.deficit_gdp ??
      row?.deficit_to_gdp
    );

    if (direct !== null && Number.isFinite(direct)) {
      return Math.abs(direct);
    }

    return null;
  }

  function getDebtGDPDisplay(row) {
    const fiscalRow = findRowByYear(FISCAL_ROWS, yearKey(row)) || row;

    const direct = normalizePct(
      fiscalRow?.debt_to_gdp ??
      fiscalRow?.debt_gdp ??
      row?.debt_to_gdp ??
      row?.debt_gdp
    );

    if (direct !== null && Number.isFinite(direct)) {
      return Math.abs(direct);
    }

    const debt = getDebt(row);
    const gdp = getGDP(row);

    if (debt !== null && gdp !== null && gdp > 0) {
      return (debt / gdp) * 100;
    }

    return null;
  }

  function getComputedValue(row, key) {
    if (!row || !key) return null;

    if (key === "__interest_from_fiscal__") return getRawInterestFromFiscal(row);
    if (key === "__raw_deficit_display__") return getRawDeficitDisplay(row);
    if (key === "__deficit_gdp_display__") return getDeficitGDPDisplay(row);
    if (key === "__debt_gdp_display__") return getDebtGDPDisplay(row);
    if (key === "__gdp_per_capita__") return getGDPPerCapita(row);
    if (key === "population") return getPopulationMillions(row);

    const direct = toNumber(row[key], null);
    return direct !== null && Number.isFinite(direct) ? direct : null;
  }

  function getValue(row, keys) {
    for (const key of keys) {
      const value = getComputedValue(row, key);
      if (value !== null && value !== undefined && Number.isFinite(value)) return value;
    }

    return null;
  }

  function yearLabel(row, index = 0) {
    return firstValue(row, ["label", "year", "date", "fiscal_year"], String(index + 1));
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
      return `${monthNumberToName(month) || month} ${year}`;
    }

    return month || year || String(index + 1);
  }

  function formatValue(value, stat = {}) {
    if (value === null || value === undefined || Number.isNaN(value)) return "—";

    if (stat.id === "population") {
      return `${value.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}${stat.suffix || ""}`;
    }

    if (stat.id === "gdp_per_capita") {
      return `${stat.prefix || ""}${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    }

    const body = value.toLocaleString(undefined, { maximumFractionDigits: 2 });
    return `${stat.prefix || ""}${body}${stat.suffix || ""}`;
  }

  function formatMovement(diff, stat = {}) {
    if (diff === null || diff === undefined || Number.isNaN(diff)) return "—";

    const sign = diff > 0 ? "+" : "";

    if (stat.changeType === "pp") {
      return `${sign}${diff.toFixed(2)} pp`;
    }

    return `${sign}${formatValue(diff, stat)}`;
  }

  function movementClass(diff) {
    if (diff > 0) return "up";
    if (diff < 0) return "down";
    return "flat";
  }

  async function safeFetch(sheetName) {
    try {
      if (!fetchSheets) {
        throw new Error("APRP.fetchSheets missing. sheets.js did not load before economy.js.");
      }

      const data = await fetchSheets([sheetName]);
      return data?.[sheetName] || [];
    } catch (error) {
      console.warn(`Failed loading ${sheetName}`, error);
      return [];
    }
  }

  function getConfigValue(key, fallback = null) {
    if (APRP.getConfigValue) return APRP.getConfigValue(CONTROL_ROWS, key, fallback);

    const target = cleanCell(key).toLowerCase();

    const found = CONTROL_ROWS.find((row) => {
      const rowKey = cleanCell(row.key || row.setting || row.name).toLowerCase();
      return rowKey === target;
    });

    return found ? cleanCell(found.value) : fallback;
  }

  function resolveCurrentPeriod(allRows) {
    CURRENT_YEAR = toNumber(getConfigValue("current_year", null), null);
    CURRENT_MONTH = toNumber(getConfigValue("current_month", null), null);

    if (CURRENT_YEAR) return;

    const activeRow = (allRows || []).find((row) => {
      const active = cleanCell(row.active || row.is_current).toLowerCase();
      return active === "true" || active === "current" || active === "yes" || active === "1";
    });

    if (activeRow) {
      CURRENT_YEAR = toNumber(yearKey(activeRow), null);
      CURRENT_MONTH = toNumber(activeRow.month, 12);
    }
  }

  function filterRowsToCurrentPeriod(rows) {
    if (!Array.isArray(rows)) return [];
    if (!CURRENT_YEAR) return rows;

    return rows.filter((row) => {
      const y = yearNumber(row);
      const m = toNumber(row.month, null);

      if (!y) return false;
      if (y < CURRENT_YEAR) return true;
      if (y > CURRENT_YEAR) return false;
      if (!m || !CURRENT_MONTH) return true;

      return m <= CURRENT_MONTH;
    });
  }

  function allAvailableYears() {
    return DASHBOARD_ROWS
      .map((row) => yearNumber(row))
      .filter((year) => Number.isFinite(year))
      .sort((a, b) => a - b);
  }

  function clampDefaultChartYears() {
    const years = allAvailableYears();
    if (!years.length) return;

    if (!CHART_START_YEAR) CHART_START_YEAR = years[0];
    if (!CHART_END_YEAR) CHART_END_YEAR = years[years.length - 1];

    if (!SELECTED_COMPARE_YEAR) {
      SELECTED_COMPARE_YEAR = CURRENT_YEAR || years[years.length - 1];
    }
  }

  function applyYearRange(points) {
    return points.filter((point) => {
      const y = yearNumber(point.row);
      if (!y) return true;
      if (CHART_START_YEAR && y < CHART_START_YEAR) return false;
      if (CHART_END_YEAR && y > CHART_END_YEAR) return false;
      return true;
    });
  }

  async function loadData() {
    const [econ, monthly, control, macro, fiscal, revenue, discretionary, mandatory] = await Promise.all([
      safeFetch("WEB_ECON"),
      safeFetch("MONTHLY_ENGINE"),
      safeFetch("CONTROL_CONFIG"),
      safeFetch("YEARLY_MACRO_ENGINE"),
      safeFetch("YEARLY_FISCAL_OUTPUT"),
      safeFetch("YEARLY_REVENUE_ENGINE"),
      safeFetch("YEARLY_DISCRETIONARY_ENGINE"),
      safeFetch("YEARLY_MANDATORY_ENGINE")
    ]);

    CONTROL_ROWS = control || [];

    resolveCurrentPeriod([
      ...(econ || []),
      ...(monthly || []),
      ...(macro || []),
      ...(fiscal || []),
      ...(revenue || []),
      ...(discretionary || []),
      ...(mandatory || [])
    ]);

    ECON_ROWS = filterRowsToCurrentPeriod(econ || []);
    MONTHLY_ROWS = filterRowsToCurrentPeriod(monthly || []);
    MACRO_ROWS = filterRowsToCurrentPeriod(macro || []);
    FISCAL_ROWS = filterRowsToCurrentPeriod(fiscal || []);
    REVENUE_ROWS = filterRowsToCurrentPeriod(revenue || []);
    DISCRETIONARY_ROWS = filterRowsToCurrentPeriod(discretionary || []);
    MANDATORY_ROWS = mergeRowsByYear(filterRowsToCurrentPeriod(mandatory || []), MACRO_ROWS);

    DASHBOARD_ROWS = mergeRowsByYear(
      ECON_ROWS,
      MACRO_ROWS,
      REVENUE_ROWS,
      DISCRETIONARY_ROWS,
      MANDATORY_ROWS,
      FISCAL_ROWS
    );

    clampDefaultChartYears();

    console.log("ECONOMY CHECK", DASHBOARD_ROWS.map((row) => ({
      year: yearKey(row),
      totalRevenue: getComputedValue(row, "total_revenue"),
      rawDeficit: getRawDeficitDisplay(row),
      deficitGdp: getDeficitGDPDisplay(row),
      interest: getRawInterestFromFiscal(row)
    })));
  }

  function latestRow(rows, stats) {
    const valid = rows.filter((row) => stats.some((stat) => getValue(row, stat.keys) !== null));
    return valid[valid.length - 1] || {};
  }

  function rowForSelectedCompareYear() {
    return findRowByYear(DASHBOARD_ROWS, SELECTED_COMPARE_YEAR) || latestRow(DASHBOARD_ROWS, YEARLY_STATS);
  }

  function rowBeforeYear(year) {
    const years = allAvailableYears().filter((item) => item < Number(year));
    if (!years.length) return {};
    return findRowByYear(DASHBOARD_ROWS, years[years.length - 1]) || {};
  }

  function yearlyPoints(stat) {
    const raw = DASHBOARD_ROWS.map((row, index) => {
      const value = getValue(row, stat.keys);
      if (value === null) return null;
      return { label: yearLabel(row, index), value, row };
    }).filter(Boolean);

    return applyYearRange(raw);
  }

  function rowPoints(rows, stat) {
    const raw = rows.map((row, index) => {
      const value = getValue(row, stat.keys);
      if (value === null) return null;
      return { label: yearLabel(row, index), value, row };
    }).filter(Boolean);

    return applyYearRange(raw);
  }

  function monthlyPoints(stat) {
    const points = MONTHLY_ROWS.map((row, index) => {
      const value = getValue(row, stat.keys);
      if (value === null) return null;
      return { label: monthLabel(row, index), value, row };
    }).filter(Boolean);

    return MONTHLY_RANGE === "12" ? points.slice(-12) : points;
  }

  function injectStyles() {
    if (document.querySelector("#aprp-economy-runtime-style")) return;

    const style = document.createElement("style");
    style.id = "aprp-economy-runtime-style";
    style.textContent = `
      .section { padding: 24px 0; }
      .section-tight { padding-top: 22px; }
      .container-wide { width: min(1540px, calc(100% - 44px)); margin: 0 auto; }

      .econ-clean-page { display: grid; gap: 16px; }
      .econ-section { display: grid; gap: 10px; }

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
        font-size: clamp(1.55rem, 2.4vw, 2.75rem);
        line-height: .95;
      }

      .econ-heading p {
        margin: 0;
        color: #475569;
        max-width: 800px;
        font-size: .92rem;
        line-height: 1.45;
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

      .econ-panel h3,
      .econ-chart-card h3,
      .econ-pie-card h3 {
        margin: 4px 0 10px;
        color: #07111f;
        font-family: Georgia, serif;
      }

      .econ-panel.dark h3 { color: #fff; }
      .econ-panel.dark .econ-eyebrow { color: #93c5fd; }

      .econ-note {
        color: #64748b;
        font-size: .8rem;
        line-height: 1.35;
      }

      .econ-panel.dark .econ-note { color: #cbd5e1; }

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

      .econ-range-panel {
        border: 1px solid rgba(15,23,42,.12);
        border-radius: 16px;
        background: rgba(255,255,255,.66);
        padding: 10px;
        display: flex;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
      }

      .econ-control-card {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
        justify-content: flex-end;
      }

      .econ-select {
        border: 1px solid rgba(15,23,42,.16);
        border-radius: 999px;
        background: rgba(255,255,255,.9);
        color: #07111f;
        padding: 7px 10px;
        font-size: .72rem;
        font-weight: 1000;
        outline: none;
      }

      .econ-control-label {
        color: #475569;
        font-size: .62rem;
        font-weight: 1000;
        letter-spacing: .08em;
        text-transform: uppercase;
      }

      .econ-movement-list { display: grid; gap: 7px; }

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

      .econ-movement-row strong { color: #fff; font-size: .78rem; }
      .econ-movement-row span { color: #cbd5e1; font-size: .68rem; font-weight: 800; }

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

      .econ-pill.up { background: rgba(22,101,52,.28); border-color: rgba(34,197,94,.35); }
      .econ-pill.down { background: rgba(153,27,27,.30); border-color: rgba(248,113,113,.35); }

      .econ-filter-bar { display: flex; flex-wrap: wrap; gap: 6px; }

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

      .econ-chart-svg { width: 100%; height: 128px; display: block; }
      .econ-chart-axis { stroke: rgba(15,23,42,.14); stroke-width: 1; }
      .econ-chart-line { fill: none; stroke: #1d4ed8; stroke-width: 2.3; stroke-linecap: round; stroke-linejoin: round; }
      .econ-chart-area { fill: rgba(30,64,175,.13); }
      .econ-chart-dot { fill: #1d4ed8; stroke: #fff; stroke-width: 1.4; }
      .econ-chart-label { fill: #334155; font-size: 8px; font-weight: 900; }

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

      .econ-pie-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
      }

      .econ-pie-card {
        border: 1px solid rgba(15,23,42,.14);
        border-radius: 18px;
        background: linear-gradient(180deg, rgba(255,255,255,.94), rgba(241,245,249,.9));
        box-shadow: 0 12px 26px rgba(15,23,42,.08);
        padding: 12px;
      }

      .econ-pie-wrap {
        display: grid;
        grid-template-columns: 150px minmax(0, 1fr);
        gap: 10px;
        align-items: center;
      }

      .econ-pie-svg { width: 150px; height: 150px; }

      .econ-pie-legend {
        display: grid;
        gap: 5px;
        max-height: 150px;
        overflow: auto;
        padding-right: 4px;
      }

      .econ-pie-legend-row {
        display: grid;
        grid-template-columns: 10px minmax(0, 1fr) auto;
        gap: 6px;
        align-items: center;
        color: #334155;
        font-size: .68rem;
        font-weight: 850;
      }

      .econ-pie-legend-row span:nth-child(2) {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .econ-pie-dot {
        width: 10px;
        height: 10px;
        border-radius: 999px;
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
        .econ-top-grid, .econ-chart-grid { grid-template-columns: 1fr; }
        .econ-tile-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      }

      @media (max-width: 1000px) {
        .econ-pie-grid { grid-template-columns: 1fr; }
      }

      @media (max-width: 700px) {
        .container-wide { width: min(100% - 22px, 1540px); }
        .econ-heading { display: grid; }
        .econ-tile-grid, .econ-chart-footer { grid-template-columns: 1fr; }
        .econ-movement-row { grid-template-columns: 1fr; }
        .econ-pie-wrap { grid-template-columns: 1fr; }
        .econ-pie-svg { margin: auto; }
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
    if (!points.length) {
      return `<div class="econ-empty">No data for ${safeHTML(stat.title)}.</div>`;
    }

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

    const linePath = points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${xFor(index).toFixed(2)} ${yFor(point.value).toFixed(2)}`)
      .join(" ");

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

  function polarToCartesian(cx, cy, r, angleDeg) {
    const angleRad = (angleDeg - 90) * Math.PI / 180;
    return {
      x: cx + r * Math.cos(angleRad),
      y: cy + r * Math.sin(angleRad)
    };
  }

  function pieSlicePath(cx, cy, rOuter, rInner, startAngle, endAngle) {
    const startOuter = polarToCartesian(cx, cy, rOuter, endAngle);
    const endOuter = polarToCartesian(cx, cy, rOuter, startAngle);
    const startInner = polarToCartesian(cx, cy, rInner, startAngle);
    const endInner = polarToCartesian(cx, cy, rInner, endAngle);
    const largeArc = endAngle - startAngle <= 180 ? 0 : 1;

    return [
      `M ${startOuter.x} ${startOuter.y}`,
      `A ${rOuter} ${rOuter} 0 ${largeArc} 0 ${endOuter.x} ${endOuter.y}`,
      `L ${startInner.x} ${startInner.y}`,
      `A ${rInner} ${rInner} 0 ${largeArc} 1 ${endInner.x} ${endInner.y}`,
      "Z"
    ].join(" ");
  }

  function buildPieData(row, fields) {
    return fields
      .map(([key, label]) => ({
        key,
        label,
        value: getComputedValue(row, key)
      }))
      .filter((item) => item.value !== null && item.value > 0)
      .sort((a, b) => b.value - a.value);
  }

  function findOfficialTotal(row, officialTotalKeys = []) {
    for (const key of officialTotalKeys) {
      const value = getComputedValue(row, key);

      if (value !== null && Number.isFinite(value)) {
        return value;
      }
    }

    return null;
  }

  function addUnlistedSlice(items, officialTotal, label) {
    const sliceTotal = items.reduce((sum, item) => sum + item.value, 0);

    if (officialTotal === null || !Number.isFinite(officialTotal)) {
      return items;
    }

    const missing = officialTotal - sliceTotal;

    if (missing > 0.01) {
      return [
        ...items,
        {
          key: "__unlisted__",
          label,
          value: missing
        }
      ];
    }

    return items;
  }

  function renderPieSvg(items, size = 150, officialTotal = null) {
    const sliceTotal = items.reduce((sum, item) => sum + item.value, 0);
    const total = officialTotal !== null && Number.isFinite(officialTotal) ? officialTotal : sliceTotal;

    if (!items.length || total <= 0) {
      return `<div class="econ-empty">No current-year data.</div>`;
    }

    const cx = size / 2;
    const cy = size / 2;
    const rOuter = size * 0.46;
    const rInner = size * 0.27;

    let angle = 0;

    const paths = items.map((item, index) => {
      const slice = Math.max(0, (item.value / total) * 360);
      const start = angle;
      const end = angle + slice;
      angle = end;

      const color = PIE_COLORS[index % PIE_COLORS.length];

      return `
        <path d="${pieSlicePath(cx, cy, rOuter, rInner, start, end)}" fill="${color}">
          <title>${safeHTML(item.label)}: ${safeHTML(formatValue(item.value, { prefix: "$" }))}</title>
        </path>
      `;
    }).join("");

    return `
      <svg class="econ-pie-svg" viewBox="0 0 ${size} ${size}" role="img">
        ${paths}
        <circle cx="${cx}" cy="${cy}" r="${rInner * 0.82}" fill="#f8fafc"></circle>
        <text x="${cx}" y="${cy - 2}" text-anchor="middle" fill="#07111f" font-size="${size * 0.075}" font-weight="1000">
          ${safeHTML(formatValue(total, { prefix: "$" }))}
        </text>
        <text x="${cx}" y="${cy + size * 0.075}" text-anchor="middle" fill="#64748b" font-size="${size * 0.048}" font-weight="900">
          Total
        </text>
      </svg>
    `;
  }

  function renderPieLegend(items, officialTotal = null) {
    const sliceTotal = items.reduce((sum, item) => sum + item.value, 0);
    const total = officialTotal !== null && Number.isFinite(officialTotal) ? officialTotal : sliceTotal;

    return `
      <div class="econ-pie-legend">
        ${items.map((item, index) => {
          const pct = total ? (item.value / total) * 100 : 0;

          return `
            <div class="econ-pie-legend-row">
              <span class="econ-pie-dot" style="background:${PIE_COLORS[index % PIE_COLORS.length]}"></span>
              <span title="${safeHTML(item.label)}">${safeHTML(item.label)}</span>
              <strong>${safeHTML(pct.toFixed(1))}%</strong>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  function pieCard(title, subtitle, row, fields, officialTotalKeys = [], unlistedLabel = "Other / Unlisted") {
    const rawItems = buildPieData(row, fields);
    const officialTotal = findOfficialTotal(row, officialTotalKeys);
    const sliceTotal = rawItems.reduce((sum, item) => sum + item.value, 0);
    const displayTotal = officialTotal !== null && Number.isFinite(officialTotal) ? officialTotal : sliceTotal;
    const items = addUnlistedSlice(rawItems, displayTotal, unlistedLabel);

    return `
      <article class="econ-pie-card">
        <div class="econ-eyebrow">Current Fiscal Year</div>
        <h3>${safeHTML(title)}</h3>
        <div class="econ-chart-meta">${safeHTML(subtitle)} • ${safeHTML(formatValue(displayTotal, { prefix: "$" }))}</div>
        <div class="econ-pie-wrap">
          ${renderPieSvg(items, 150, displayTotal)}
          ${renderPieLegend(items, displayTotal)}
        </div>
      </article>
    `;
  }

  function macroTile(stat, latest, previous) {
    const value = getValue(latest, stat.keys);
    const previousValue = getValue(previous, stat.keys);
    const diff = value === null || previousValue === null ? null : value - previousValue;

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

  function renderRevenueCharts(group = "All") {
    const slot = getEl("#econ-revenue-charts");
    if (!slot) return;

    const stats = filterStats(REVENUE_STATS, group);

    slot.innerHTML = `
      <div class="econ-chart-grid">
        ${stats.map((stat) => chartCard(stat, rowPoints(REVENUE_ROWS, stat), "yearly")).join("")}
      </div>
    `;
  }

  function renderSpendingCharts(group = "All") {
    const slot = getEl("#econ-spending-charts");
    if (!slot) return;

    const stats = filterStats(SPENDING_STATS, group);

    slot.innerHTML = `
      <div class="econ-chart-grid">
        ${stats.map((stat) => chartCard(stat, rowPoints(DISCRETIONARY_ROWS, stat), "yearly")).join("")}
      </div>
    `;
  }

  function renderMandatoryCharts(group = "All") {
    const slot = getEl("#econ-mandatory-charts");
    if (!slot) return;

    const stats = filterStats(MANDATORY_STATS, group);

    slot.innerHTML = `
      <div class="econ-chart-grid">
        ${stats.map((stat) => chartCard(stat, rowPoints(MANDATORY_ROWS, stat), "yearly")).join("")}
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

  function currentYearRangeLabel() {
    if (!CHART_START_YEAR || !CHART_END_YEAR) return "All years";
    return `FY${CHART_START_YEAR}–FY${CHART_END_YEAR}`;
  }

  function renderYearRangeControls() {
    const years = allAvailableYears();
    if (!years.length) return "";

    const options = years.map((year) => `<option value="${year}">FY${year}</option>`).join("");

    return `
      <div class="econ-range-panel">
        <div>
          <div class="econ-eyebrow">Chart Range</div>
          <p class="econ-note">Viewing ${safeHTML(currentYearRangeLabel())}. Use the controls to narrow chart years.</p>
        </div>

        <div class="econ-control-card">
          <span class="econ-control-label">From</span>
          <select class="econ-select" id="econ-chart-start">${options}</select>

          <span class="econ-control-label">To</span>
          <select class="econ-select" id="econ-chart-end">${options}</select>

          <button class="econ-filter-btn" type="button" id="econ-chart-range-apply">Apply</button>
          <button class="econ-filter-btn" type="button" id="econ-chart-range-all">All</button>
        </div>
      </div>
    `;
  }

  function rerenderChartsOnly() {
    renderYearlyCharts(getEl("#econ-yearly-filters .econ-filter-btn.is-active")?.textContent || "All");
    renderMonthlyCharts(getEl("#econ-monthly-filters .econ-filter-btn.is-active")?.textContent || "All");
    renderRevenueCharts(getEl("#econ-revenue-filters .econ-filter-btn.is-active")?.textContent || "All");
    renderSpendingCharts(getEl("#econ-spending-filters .econ-filter-btn.is-active")?.textContent || "All");
    renderMandatoryCharts(getEl("#econ-mandatory-filters .econ-filter-btn.is-active")?.textContent || "All");
  }

  function setupYearRangeControls() {
    const start = getEl("#econ-chart-start");
    const end = getEl("#econ-chart-end");

    if (start && CHART_START_YEAR) start.value = String(CHART_START_YEAR);
    if (end && CHART_END_YEAR) end.value = String(CHART_END_YEAR);

    getEl("#econ-chart-range-apply")?.addEventListener("click", () => {
      const startValue = toNumber(start?.value, null);
      const endValue = toNumber(end?.value, null);

      if (startValue && endValue && startValue <= endValue) {
        CHART_START_YEAR = startValue;
        CHART_END_YEAR = endValue;
      }

      rerenderChartsOnly();
    });

    getEl("#econ-chart-range-all")?.addEventListener("click", () => {
      const years = allAvailableYears();
      CHART_START_YEAR = years[0] || null;
      CHART_END_YEAR = years[years.length - 1] || null;

      if (start && CHART_START_YEAR) start.value = String(CHART_START_YEAR);
      if (end && CHART_END_YEAR) end.value = String(CHART_END_YEAR);

      rerenderChartsOnly();
    });
  }

  function renderCompareDropdown() {
    const years = allAvailableYears();
    if (!years.length) return "";

    const options = years
      .map((year) => `<option value="${year}" ${Number(SELECTED_COMPARE_YEAR) === year ? "selected" : ""}>FY${year}</option>`)
      .join("");

    return `
      <div class="econ-range-panel">
        <div>
          <div class="econ-eyebrow">Previous Fiscal Year Lookup</div>
          <p class="econ-note">Choose any fiscal year to show its macro snapshot above.</p>
        </div>

        <div class="econ-control-card">
          <span class="econ-control-label">Fiscal Year</span>
          <select class="econ-select" id="econ-compare-year">${options}</select>
        </div>
      </div>
    `;
  }

  function setupCompareDropdown() {
    const select = getEl("#econ-compare-year");
    if (!select) return;

    select.addEventListener("change", () => {
      SELECTED_COMPARE_YEAR = toNumber(select.value, SELECTED_COMPARE_YEAR);

      const selected = rowForSelectedCompareYear();
      const previous = rowBeforeYear(SELECTED_COMPARE_YEAR);

      const title = getEl("#econ-key-title");
      if (title) title.textContent = `${yearKey(selected)} Key Indicators`;

      const grid = getEl("#econ-key-tile-grid");

      if (grid) {
        const tileStats = TOP_YEARLY_TILES
          .map((id) => YEARLY_STATS.find((stat) => stat.id === id))
          .filter(Boolean);

        grid.innerHTML = tileStats.map((stat) => macroTile(stat, selected, previous)).join("");
      }
    });
  }

  function renderRecords() {
    const rows = [...DASHBOARD_ROWS]
      .filter((row) => YEARLY_STATS.some((stat) => getValue(row, stat.keys) !== null))
      .slice(-10)
      .reverse();

    if (!rows.length) return "";

    const stat = (id) => YEARLY_STATS.find((s) => s.id === id);

    return `
      <section class="econ-panel">
        <div class="econ-eyebrow">Official Archive</div>
        <h3>Recent Fiscal Year Records</h3>
        <table class="econ-record-table">
          <thead>
            <tr>
              <th>Year</th>
              <th>GDP</th>
              <th>Debt</th>
              <th>Revenue</th>
              <th>Spending</th>
              <th>Deficit</th>
              <th>Interest</th>
              <th>Deficit/GDP</th>
              <th>Unemployment</th>
              <th>Inflation</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row, index) => `
              <tr>
                <td>${safeHTML(yearLabel(row, index))}</td>
                <td>${safeHTML(formatValue(getValue(row, stat("gdp").keys), stat("gdp")))}</td>
                <td>${safeHTML(formatValue(getValue(row, stat("debt").keys), stat("debt")))}</td>
                <td>${safeHTML(formatValue(getValue(row, stat("total_revenue").keys), stat("total_revenue")))}</td>
                <td>${safeHTML(formatValue(getValue(row, stat("total_spending").keys), stat("total_spending")))}</td>
                <td>${safeHTML(formatValue(getValue(row, stat("deficit").keys), stat("deficit")))}</td>
                <td>${safeHTML(formatValue(getValue(row, stat("interest_cost").keys), stat("interest_cost")))}</td>
                <td>${safeHTML(formatValue(getValue(row, stat("deficit_gdp").keys), stat("deficit_gdp")))}</td>
                <td>${safeHTML(formatValue(getValue(row, stat("unemployment").keys), stat("unemployment")))}</td>
                <td>${safeHTML(formatValue(getValue(row, stat("inflation").keys), stat("inflation")))}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </section>
    `;
  }

  function rebuildEconomyPage() {
    const main = document.querySelector("main") || document.body;

    const latest = rowForSelectedCompareYear();
    const previous = rowBeforeYear(SELECTED_COMPARE_YEAR);

    const latestRevenue = latestRow(REVENUE_ROWS, REVENUE_STATS);
    const latestDiscretionary = latestRow(DISCRETIONARY_ROWS, SPENDING_STATS);
    const latestMandatory = latestRow(MANDATORY_ROWS, MANDATORY_STATS);

    const displayYear = yearKey(latest) || CURRENT_YEAR || "Latest";

    const currentPeriodLabel = CURRENT_YEAR
      ? CURRENT_MONTH
        ? `Showing through ${monthNumberToName(CURRENT_MONTH)} ${CURRENT_YEAR}`
        : `Showing through FY${CURRENT_YEAR}`
      : "Showing all loaded records";

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
                <p>${safeHTML(displayYear)} fiscal snapshot. ${safeHTML(currentPeriodLabel)}. Deficit and deficit-to-GDP are displayed as positive deficit pressure unless the year is a surplus.</p>
              </div>
            </div>

            <div class="econ-top-grid">
              <section class="econ-panel">
                <div class="econ-eyebrow">Current Year</div>
                <h3 id="econ-key-title">${safeHTML(displayYear)} Key Indicators</h3>
                <div class="econ-tile-grid" id="econ-key-tile-grid">
                  ${tileStats.map((stat) => macroTile(stat, latest, previous)).join("")}
                </div>
              </section>

              <aside class="econ-panel dark">
                <div class="econ-eyebrow">Monthly Movement</div>
                <h3>Latest Moves</h3>
                <p class="econ-note">Uses monthly records up to the current configured period.</p>
                <div class="econ-movement-list">
                  ${MONTHLY_STATS.map(movementRow).join("") || `<p class="econ-note">No monthly records found.</p>`}
                </div>
              </aside>
            </div>

            ${renderCompareDropdown()}
          </section>

          <section class="econ-section">
            <div class="econ-heading">
              <div>
                <div class="econ-eyebrow">Current Fiscal Year Breakdown</div>
                <h2>Budget Composition</h2>
                <p>Revenue includes UCare revenue and adds missing categories as Other / Unlisted Revenue when the listed categories do not equal total revenue.</p>
              </div>
            </div>

            <div class="econ-pie-grid">
              ${pieCard(
                "Revenue Breakdown",
                "Federal receipts by category",
                latestRevenue,
                PIE_REVENUE_FIELDS,
                ["total_revenue"],
                "Other / Unlisted Revenue"
              )}

              ${pieCard(
                "Discretionary Spending",
                "Departments, agencies, and event costs",
                latestDiscretionary,
                PIE_DISCRETIONARY_FIELDS,
                ["total_discretionary_spending"],
                "Other / Unlisted Discretionary"
              )}

              ${pieCard(
                "Mandatory Spending",
                "Entitlements, interest, obligations, and other costs",
                latestMandatory,
                PIE_MANDATORY_FIELDS,
                ["total_mandatory_spending"],
                "Other / Unlisted Mandatory"
              )}
            </div>
          </section>

          <section class="econ-section">
            <div class="econ-heading">
              <div>
                <div class="econ-eyebrow">Yearly Charts</div>
                <h2>Economic Trends</h2>
                <p>Yearly indicators filtered by chart range. Interest on debt starts at FY2011 and does not show fake pre-2011 zero data.</p>
              </div>
              <div class="econ-filter-bar" id="econ-yearly-filters"></div>
            </div>

            ${renderYearRangeControls()}
            <div id="econ-yearly-charts"></div>
          </section>

          <section class="econ-section">
            <div class="econ-heading">
              <div>
                <div class="econ-eyebrow">Monthly Charts</div>
                <h2>Approval, Markets, Jobs & Monthly GDP</h2>
                <p>MONTHLY_ENGINE indicators filtered to the current active month.</p>
              </div>
              <div>
                <div class="econ-filter-bar" id="econ-monthly-range" style="margin-bottom:6px;"></div>
                <div class="econ-filter-bar" id="econ-monthly-filters"></div>
              </div>
            </div>
            <div id="econ-monthly-charts"></div>
          </section>

          <section class="econ-section">
            <div class="econ-heading">
              <div>
                <div class="econ-eyebrow">Revenue Engine</div>
                <h2>Revenue Breakdown</h2>
                <p>Tracks income, payroll, UCare revenue, capital gains, excise, event revenue, direct revenue, and total revenue.</p>
              </div>
              <div class="econ-filter-bar" id="econ-revenue-filters"></div>
            </div>
            <div id="econ-revenue-charts"></div>
          </section>

          <section class="econ-section">
            <div class="econ-heading">
              <div>
                <div class="econ-eyebrow">Discretionary Spending</div>
                <h2>Department Spending Breakdown</h2>
                <p>Tracks department spending, other agencies, general government, and event direct/GDP costs.</p>
              </div>
              <div class="econ-filter-bar" id="econ-spending-filters"></div>
            </div>
            <div id="econ-spending-charts"></div>
          </section>

          <section class="econ-section">
            <div class="econ-heading">
              <div>
                <div class="econ-eyebrow">Mandatory Spending</div>
                <h2>Entitlement & Obligation Breakdown</h2>
                <p>Tracks Social Security, Medicare, Medicaid, UCare spending, SNAP, FCWA, retirement, SSI, interest on debt, other mandatory cost, and total mandatory spending.</p>
              </div>
              <div class="econ-filter-bar" id="econ-mandatory-filters"></div>
            </div>
            <div id="econ-mandatory-charts"></div>
          </section>

          <section class="econ-section">
            ${renderRecords()}
          </section>
        </div>
      </section>
    `;

    const yearlyFilters = getEl("#econ-yearly-filters");
    if (yearlyFilters) {
      ["All", "Output", "Fiscal", "Labor", "Prices", "Population"].forEach((group, index) => {
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
      ["All", "Output", "Political", "Markets", "Labor"].forEach((group, index) => {
        addFilterButton(monthlyFilters, group, index === 0, renderMonthlyCharts);
      });
    }

    const revenueFilters = getEl("#econ-revenue-filters");
    if (revenueFilters) {
      ["All", "Income", "Payroll", "UCare", "Capital Gains", "Other", "Totals"].forEach((group, index) => {
        addFilterButton(revenueFilters, group, index === 0, renderRevenueCharts);
      });
    }

    const spendingFilters = getEl("#econ-spending-filters");
    if (spendingFilters) {
      ["All", "Security", "Domestic", "Agency", "Other", "Totals"].forEach((group, index) => {
        addFilterButton(spendingFilters, group, index === 0, renderSpendingCharts);
      });
    }

    const mandatoryFilters = getEl("#econ-mandatory-filters");
    if (mandatoryFilters) {
      ["All", "Core Entitlements", "Income Support", "Health", "Worker Benefits", "Retirement", "Debt Service", "Other", "Totals"].forEach((group, index) => {
        addFilterButton(mandatoryFilters, group, index === 0, renderMandatoryCharts);
      });
    }

    setupYearRangeControls();
    setupCompareDropdown();

    renderYearlyCharts("All");
    renderMonthlyCharts("All");
    renderRevenueCharts("All");
    renderSpendingCharts("All");
    renderMandatoryCharts("All");
  }

  function updateHeroCard() {
    const heroCard = getEl(".hero-side-card");
    if (!heroCard) return;

    const latest = rowForSelectedCompareYear();
    const latestRevenue = latestRow(REVENUE_ROWS, REVENUE_STATS);
    const latestSpending = latestRow(DISCRETIONARY_ROWS, SPENDING_STATS);
    const latestMandatory = latestRow(MANDATORY_ROWS, MANDATORY_STATS);

    const year = yearKey(latest) || CURRENT_YEAR || "Latest";
    const monthlyCount = MONTHLY_ROWS.length.toLocaleString();
    const yearlyCount = DASHBOARD_ROWS.length.toLocaleString();

    const revenue = getValue(latestRevenue, ["total_revenue"]);
    const discretionary = getValue(latestSpending, ["total_discretionary_spending"]);
    const mandatory = getValue(latestMandatory, ["total_mandatory_spending"]);
    const totalSpending = getValue(latest, ["total_spending"]);
    const deficitGdp = getValue(latest, ["__deficit_gdp_display__"]);
    const interest = getValue(latest, ["__interest_from_fiscal__"]);
    const ucareRevenue = getValue(latestRevenue, ["ucare_revenue"]);
    const ucareCost = getValue(latestMandatory, ["ucare_cost"]);

    heroCard.innerHTML = `
      <div class="eyebrow">OBM Record</div>
      <h2>${safeHTML(year)} Economy Loaded</h2>
      <p>${safeHTML(yearlyCount)} yearly rows and ${safeHTML(monthlyCount)} monthly rows loaded through the active period.</p>
      <p class="text-small">
        Revenue: ${safeHTML(formatValue(revenue, { prefix: "$" }))} •
        Discretionary: ${safeHTML(formatValue(discretionary, { prefix: "$" }))} •
        Mandatory: ${safeHTML(formatValue(mandatory, { prefix: "$" }))} •
        Total Spending: ${safeHTML(formatValue(totalSpending, { prefix: "$" }))} •
        Deficit/GDP: ${safeHTML(formatValue(deficitGdp, { suffix: "%" }))} •
        Interest: ${safeHTML(formatValue(interest, { prefix: "$" }))} •
        UCare Revenue: ${safeHTML(formatValue(ucareRevenue, { prefix: "$" }))} •
        UCare Cost: ${safeHTML(formatValue(ucareCost, { prefix: "$" }))}
      </p>
    `;
  }

  async function initEconomy() {
    try {
      injectStyles();
      await loadData();
      rebuildEconomyPage();
      updateHeroCard();

      const status = document.getElementById("economy-load-status");
      if (status) status.textContent = "Dashboard Ready";
    } catch (error) {
      console.error("Economy page failed:", error);

      const status = document.getElementById("economy-load-status");
      if (status) status.textContent = "Load Error";

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
