/* APRP Federal Archive — Budget Builder
   Four markdown budget export:
   1. Tax Rates / Revenue Budget
   2. Mandatory Rules and Laws
   3. Defense, Homeland, Justice, State, and Agency Appropriations
   4. Health, Education, Energy, Infrastructure, Agriculture, Interior, EPA, HUD Appropriations
*/

(function () {
  "use strict";

  const APRP = window.APRP || {};
  const fetchSheetsSafe = APRP.fetchSheetsSafe;
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

  const toNumber = APRP.toNumber || ((value, fallback = 0) => {
    const cleaned = cleanCell(value).replace(/[$,%]/g, "").replace(/,/g, "");
    if (cleaned === "") return fallback;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : fallback;
  });

  const SHEETS = [
    "CONTROL_CONFIG",
    "YEARLY_FISCAL_OUTPUT",
    "TAX_RATES_BY_YEAR",
    "YEARLY_REVENUE_ENGINE",
    "YEARLY_DISCRETIONARY_ENGINE",
    "YEARLY_MANDATORY_ENGINE",
    "YEARLY_MACRO_ENGINE",
    "YEARLY_CONFIG"
  ];

  const METADATA_KEYS = new Set([
    "year",
    "label",
    "active",
    "is_current",
    "period",
    "period_num",
    "start_period",
    "start_num",
    "end_period",
    "end_num",
    "notes",
    "note",
    "description",
    "source"
  ]);

  const DEFENSE_AGENCY_FIELDS = [
    ["defense_spending", "Department of Defense"],
    ["treasury_spending", "Department of Treasury"],
    ["veterans_affairs_spending", "Department of Veterans Affairs"],
    ["homeland_security_spending", "Department of Homeland Security"],
    ["justice_spending", "Department of Justice"],
    ["state_foreign_affairs_spending", "Department of State and Foreign Affairs"],
    ["commerce_spending", "Department of Commerce"],
    ["labor_spending", "Department of Labor"],
    ["nasa_spending", "NASA"],
    ["sba_spending", "Small Business Administration"],
    ["other_agencies_spending", "Other Agencies"],
    ["general_government_spending", "General Government"]
  ];

  const DOMESTIC_FIELDS = [
    ["education_spending", "Department of Education"],
    ["health_social_admin_spending", "Health and Social Administration"],
    ["transportation_spending", "Department of Transportation"],
    ["interior_natural_resources_spending", "Department of the Interior and Natural Resources"],
    ["agriculture_spending", "Department of Agriculture"],
    ["energy_spending", "Department of Energy"],
    ["housing_urban_development_spending", "Department of Housing and Urban Development"],
    ["environmental_protection_spending", "Environmental Protection Agency"]
  ];

  const ALL_SPENDING_FIELDS = [...DEFENSE_AGENCY_FIELDS, ...DOMESTIC_FIELDS];

  const REVENUE_FIELDS = [
    ["income_0_10k_revenue", "Income $0–10k"],
    ["income_10_30k_revenue", "Income $10k–30k"],
    ["income_30_60k_revenue", "Income $30k–60k"],
    ["income_60_100k_revenue", "Income $60k–100k"],
    ["income_100_250k_revenue", "Income $100k–250k"],
    ["income_250_500k_revenue", "Income $250k–500k"],
    ["income_500_1000k_revenue", "Income $500k–1M"],
    ["income_1000k_5m_revenue", "Income $1M–5M"],
    ["income_5m_10m_revenue", "Income $5M–10M"],
    ["income_10m_plus_revenue", "Income $10M+"],
    ["corp_0_50k_revenue", "Corporate $0–50k"],
    ["corp_50_500k_revenue", "Corporate $50k–500k"],
    ["corp_500k_5m_revenue", "Corporate $500k–5M"],
    ["corp_5m_10m_revenue", "Corporate $5M–10M"],
    ["corp_10m_100m_revenue", "Corporate $10M–100M"],
    ["corp_100m_1b_revenue", "Corporate $100M–1B"],
    ["corp_1b_plus_revenue", "Corporate $1B+"],
    ["payroll_medicare_revenue", "Medicare Payroll"],
    ["payroll_social_security_revenue", "Social Security Payroll"],
    ["payroll_worker_revenue", "Worker Payroll"],
    ["sales_tax_revenue", "Sales Tax"],
    ["cap_gains_short_term_revenue", "Short-Term Capital Gains"],
    ["cap_gains_long_term_revenue", "Long-Term Capital Gains"],
    ["excise_tax_revenue", "Excise Tax"],
    ["ucare_revenue", "UCare Revenue"],
    ["event_revenue_impact", "Event Revenue Impact"],
    ["direct_revenue", "Direct Revenue"]
  ];

  let DATA = {};
  let selectedYear = null;
  let baseline = null;

  let state = {
    taxRows: [],
    spending: {}
  };

  function $(selector, root = document) {
    return root.querySelector(selector);
  }

  function $all(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  function titleCase(value) {
    return cleanCell(value)
      .replace(/_/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (m) => m.toUpperCase());
  }

  function fmtMoneyB(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "—";
    const sign = n < 0 ? "-" : "";
    return `${sign}$${Math.abs(n).toLocaleString("en-US", {
      maximumFractionDigits: 1
    })}B`;
  }

  function fmtPercent(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "—";
    return `${n.toFixed(n % 1 === 0 ? 0 : 1)}%`;
  }

  function fmtPlain(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return cleanCell(value) || "—";
    return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }

  function parseRate(value) {
    return toNumber(value, 0);
  }

  function updateStatus(text) {
    const el = $("#budget-load-status");
    if (el) el.textContent = text;
  }

  async function loadData() {
    if (fetchSheetsSafe) {
      DATA = await fetchSheetsSafe(SHEETS);
      return;
    }

    if (!fetchSheets) {
      throw new Error("APRP.fetchSheets missing. Check sheets.js loads before budget-builder.js.");
    }

    DATA = {};

    await Promise.all(
      SHEETS.map(async (sheetName) => {
        try {
          const result = await fetchSheets([sheetName]);
          DATA[sheetName] = result?.[sheetName] || [];
        } catch (error) {
          console.warn(`Could not load ${sheetName}`, error);
          DATA[sheetName] = [];
        }
      })
    );
  }

  function getControlValue(key, fallback = "") {
    const target = cleanCell(key).toLowerCase();

    const found = (DATA.CONTROL_CONFIG || []).find((row) => {
      const rowKey = cleanCell(row.key || row.setting || row.name).toLowerCase();
      return rowKey === target;
    });

    return found ? cleanCell(found.value) : fallback;
  }

  function findYearRow(sheetName, year) {
    const rows = DATA[sheetName] || [];
    const target = Number(year);
    return rows.find((row) => toNumber(row.year, NaN) === target) || null;
  }

  function getAvailableYears() {
    const years = new Set();

    SHEETS.forEach((sheetName) => {
      (DATA[sheetName] || []).forEach((row) => {
        const year = toNumber(row.year, NaN);
        if (Number.isFinite(year)) years.add(year);
      });
    });

    const sorted = Array.from(years).sort((a, b) => a - b);
    if (sorted.length) return sorted;

    return Array.from({ length: 20 }, (_, index) => 2011 + index);
  }

  function renderYearSelect() {
    const select = $("#budget-year");
    if (!select) return;

    const years = getAvailableYears();
    const currentYear = toNumber(getControlValue("current_year", ""), NaN);

    let defaultYear = years[0] || 2012;

    if (Number.isFinite(currentYear)) {
      if (years.includes(currentYear + 1)) defaultYear = currentYear + 1;
      else if (years.includes(currentYear)) defaultYear = currentYear;
    }

    selectedYear = selectedYear || defaultYear;

    select.innerHTML = years
      .map((year) => {
        const selected = Number(year) === Number(selectedYear) ? "selected" : "";
        return `<option value="${year}" ${selected}>FY${year}</option>`;
      })
      .join("");

    select.addEventListener("change", () => {
      selectedYear = toNumber(select.value, selectedYear);
      refreshForYear();
    });
  }

  function sumSpendingRow(row) {
    if (!row) return 0;

    return ALL_SPENDING_FIELDS.reduce((sum, [key]) => {
      return sum + toNumber(row[key], 0);
    }, 0);
  }

  function getBaselineForYear(year) {
    const fiscal = findYearRow("YEARLY_FISCAL_OUTPUT", year) || {};
    const disc = findYearRow("YEARLY_DISCRETIONARY_ENGINE", year) || {};
    const mandatory = findYearRow("YEARLY_MANDATORY_ENGINE", year) || {};
    const macro = findYearRow("YEARLY_MACRO_ENGINE", year) || {};
    const revenue = findYearRow("YEARLY_REVENUE_ENGINE", year) || {};

    const gdp =
      toNumber(fiscal.real_gdp, NaN) ||
      toNumber(fiscal.gdp, NaN) ||
      toNumber(macro.real_gdp, NaN) ||
      toNumber(macro.gdp, NaN) ||
      toNumber(revenue.real_gdp, NaN) ||
      toNumber(disc.real_gdp, 0);

    const totalRevenue =
      toNumber(fiscal.total_revenue, NaN) ||
      toNumber(revenue.total_revenue, NaN) ||
      toNumber(fiscal.revenue, 0);

    const mandatorySpending =
      toNumber(fiscal.mandatory_spending, NaN) ||
      toNumber(fiscal.mandatory_sper, NaN) ||
      toNumber(mandatory.total_mandatory_spending, NaN) ||
      toNumber(mandatory.total_spending, 0);

    const discretionarySpending =
      toNumber(fiscal.discretionary_spending, NaN) ||
      toNumber(fiscal.discretionary_sper, NaN) ||
      toNumber(disc.total_discretionary_spending, NaN) ||
      sumSpendingRow(disc);

    const interestCost = toNumber(fiscal.interest_cost, 0);

    const totalSpending =
      toNumber(fiscal.total_spending, NaN) ||
      mandatorySpending + discretionarySpending + interestCost;

    const deficit =
      toNumber(fiscal.deficit_surplus, NaN) ||
      toNumber(fiscal.final_surplus_deficit, NaN) ||
      toNumber(fiscal.deficit, NaN) ||
      totalRevenue - totalSpending;

    const debt =
      toNumber(fiscal.ending_debt, NaN) ||
      toNumber(fiscal.debt, NaN) ||
      toNumber(macro.debt, 0);

    const debtToGdp =
      toNumber(fiscal.debt_to_gdp, NaN) ||
      toNumber(fiscal.debt_gdp, NaN) ||
      (gdp ? (debt / gdp) * 100 : 0);

    return {
      fiscal,
      disc,
      mandatory,
      macro,
      revenue,
      gdp,
      totalRevenue,
      mandatorySpending,
      discretionarySpending,
      interestCost,
      totalSpending,
      deficit,
      debt,
      debtToGdp
    };
  }

  function getTaxRowsForYear(year) {
    const rows = DATA.TAX_RATES_BY_YEAR || [];
    const target = Number(year);
    const exactRows = rows.filter((row) => toNumber(row.year, NaN) === target);
    const sourceRows = exactRows.length ? exactRows : rows;

    const longRows = sourceRows.filter((row) => {
      return cleanCell(row.tax_type || row.bracket || row.applied_rate || row.rule_rate || row.rate || row.tax_rate) !== "";
    });

    if (longRows.length > 1) {
      return longRows.map((row, index) => {
        const taxType = cleanCell(row.tax_type || row.type || row.category || "tax");
        const bracket = cleanCell(row.bracket || row.name || row.group || `item_${index + 1}`);
        const label = `${titleCase(taxType)} — ${bracket}`;
        const rate = parseRate(row.applied_rate || row.rule_rate || row.rate || row.tax_rate);
        const baseRevenue =
          toNumber(row.final_revenue, NaN) ||
          toNumber(row.base_revenue, NaN) ||
          toNumber(row.revenue, 0);

        return {
          id: `${taxType}_${bracket}`.replace(/[^\w]+/g, "_"),
          label,
          baseRate: rate,
          proposedRate: rate,
          baseRevenue,
          source: row
        };
      });
    }

    const wideRow =
      exactRows[0] ||
      rows.find((row) => cleanCell(row.active).toLowerCase() === "true") ||
      rows[0] ||
      {};

    return Object.keys(wideRow)
      .filter((key) => {
        if (METADATA_KEYS.has(key)) return false;
        const value = cleanCell(wideRow[key]);
        if (value === "") return false;
        const n = toNumber(value, NaN);
        if (!Number.isFinite(n)) return false;
        return key.includes("rate") ||
          key.includes("tax") ||
          key.includes("fica") ||
          key.includes("medicare") ||
          key.includes("social_security") ||
          key.includes("capital") ||
          key.includes("excise") ||
          key.includes("income") ||
          key.includes("corp") ||
          key.includes("ucare");
      })
      .map((key) => {
        const cleanKey = key
          .replace(/_rate$/i, "")
          .replace(/^rate_/i, "")
          .replace(/_pct$/i, "")
          .replace(/_percent$/i, "");

        const rate = parseRate(wideRow[key]);

        return {
          id: key,
          label: titleCase(cleanKey),
          baseRate: rate,
          proposedRate: rate,
          baseRevenue: 0,
          source: wideRow
        };
      });
  }

  function copyBaselineIntoState() {
    state.taxRows = getTaxRowsForYear(selectedYear);

    state.spending = {};
    ALL_SPENDING_FIELDS.forEach(([key]) => {
      state.spending[key] = toNumber(baseline.disc?.[key], 0);
    });
  }

  function renderTaxSliders() {
    const container = $("#budget-tax-sliders");
    if (!container) return;

    if (!state.taxRows.length) {
      container.innerHTML = `<p class="budget-note">No tax rates found in TAX_RATES_BY_YEAR for FY${safeHTML(selectedYear)}.</p>`;
      return;
    }

    container.innerHTML = state.taxRows.map((item, index) => {
      return `
        <div class="budget-slider-row">
          <label>${safeHTML(item.label)}</label>
          <input
            type="range"
            min="0"
            max="65"
            step="0.5"
            value="${safeHTML(item.proposedRate)}"
            data-tax-index="${index}"
          />
          <div class="budget-slider-value" data-tax-value="${index}">
            ${safeHTML(fmtPercent(item.proposedRate))}
          </div>
        </div>
      `;
    }).join("");

    $all("[data-tax-index]", container).forEach((input) => {
      input.addEventListener("input", () => {
        const index = toNumber(input.dataset.taxIndex, 0);
        state.taxRows[index].proposedRate = toNumber(input.value, 0);

        const output = container.querySelector(`[data-tax-value="${index}"]`);
        if (output) output.textContent = fmtPercent(state.taxRows[index].proposedRate);

        updateAllOutputs();
      });
    });
  }

  function renderSpendingInputs() {
    const container = $("#budget-spending-inputs");
    if (!container) return;

    container.innerHTML = ALL_SPENDING_FIELDS.map(([key, label]) => {
      const value = toNumber(state.spending[key], 0);

      return `
        <div class="budget-spending-row">
          <label>${safeHTML(label)}</label>
          <input
            type="number"
            min="0"
            step="1"
            value="${safeHTML(value)}"
            data-spending-key="${safeHTML(key)}"
          />
          <div class="budget-slider-value">${safeHTML(fmtMoneyB(value))}</div>
        </div>
      `;
    }).join("");

    $all("[data-spending-key]", container).forEach((input) => {
      input.addEventListener("input", () => {
        const key = input.dataset.spendingKey;
        state.spending[key] = toNumber(input.value, 0);

        const row = input.closest(".budget-spending-row");
        const output = row?.querySelector(".budget-slider-value");

        if (output) output.textContent = fmtMoneyB(state.spending[key]);

        updateAllOutputs();
      });
    });
  }

  function calculateTaxRevenueProjection() {
    const baseTotal = baseline.totalRevenue || 0;

    let baseModeledRevenue = 0;
    let proposedModeledRevenue = 0;

    state.taxRows.forEach((item) => {
      const baseRate = Number(item.baseRate || 0);
      const proposedRate = Number(item.proposedRate || 0);
      const baseRevenue = Number(item.baseRevenue || 0);

      if (baseRate > 0 && baseRevenue > 0) {
        baseModeledRevenue += baseRevenue;
        proposedModeledRevenue += baseRevenue * (proposedRate / baseRate);
      }
    });

    if (baseModeledRevenue <= 0) {
      let changeSum = 0;
      let count = 0;

      state.taxRows.forEach((item) => {
        if (item.baseRate > 0) {
          changeSum += (item.proposedRate - item.baseRate) / item.baseRate;
          count += 1;
        }
      });

      const averageChange = count ? changeSum / count : 0;
      return baseTotal * (1 + averageChange * 0.35);
    }

    const unmodeledRevenue = Math.max(0, baseTotal - baseModeledRevenue);
    return unmodeledRevenue + proposedModeledRevenue;
  }

  function calculateProjection() {
    const proposedRevenue = calculateTaxRevenueProjection();

    const proposedDiscretionary = Object.values(state.spending).reduce((sum, value) => {
      return sum + toNumber(value, 0);
    }, 0);

    const proposedSpending =
      proposedDiscretionary +
      baseline.mandatorySpending +
      baseline.interestCost;

    const proposedDeficit = proposedRevenue - proposedSpending;
    const deficitChange = proposedDeficit - baseline.deficit;

    const proposedDebt = baseline.debt - proposedDeficit;
    const proposedDebtToGdp = baseline.gdp ? (proposedDebt / baseline.gdp) * 100 : 0;

    return {
      proposedRevenue,
      proposedDiscretionary,
      proposedSpending,
      proposedDeficit,
      deficitChange,
      proposedDebt,
      proposedDebtToGdp
    };
  }

  function renderKpis() {
    const container = $("#budget-kpis");
    if (!container || !baseline) return;

    const p = calculateProjection();

    container.innerHTML = `
      <div class="budget-kpi">
        <strong>Revenue</strong>
        <span>${safeHTML(fmtMoneyB(p.proposedRevenue))}</span>
        <small>Baseline ${safeHTML(fmtMoneyB(baseline.totalRevenue))}</small>
      </div>
      <div class="budget-kpi">
        <strong>Spending</strong>
        <span>${safeHTML(fmtMoneyB(p.proposedSpending))}</span>
        <small>Baseline ${safeHTML(fmtMoneyB(baseline.totalSpending))}</small>
      </div>
      <div class="budget-kpi">
        <strong>${p.proposedDeficit >= 0 ? "Surplus" : "Deficit"}</strong>
        <span>${safeHTML(fmtMoneyB(p.proposedDeficit))}</span>
        <small>Change ${safeHTML(fmtMoneyB(p.deficitChange))}</small>
      </div>
      <div class="budget-kpi">
        <strong>Debt-to-GDP</strong>
        <span>${safeHTML(fmtPercent(p.proposedDebtToGdp))}</span>
        <small>Baseline ${safeHTML(fmtPercent(baseline.debtToGdp))}</small>
      </div>
    `;
  }

  function renderPreviewTable() {
    const tbody = $("#budget-preview-table");
    if (!tbody || !baseline) return;

    const p = calculateProjection();

    const rows = [
      ["Total Revenue", baseline.totalRevenue, p.proposedRevenue, "money"],
      ["Total Spending", baseline.totalSpending, p.proposedSpending, "money"],
      ["Discretionary Spending", baseline.discretionarySpending, p.proposedDiscretionary, "money"],
      ["Mandatory Spending", baseline.mandatorySpending, baseline.mandatorySpending, "money"],
      ["Interest Cost", baseline.interestCost, baseline.interestCost, "money"],
      ["Deficit / Surplus", baseline.deficit, p.proposedDeficit, "money"],
      ["Debt-to-GDP", baseline.debtToGdp, p.proposedDebtToGdp, "percent"]
    ];

    tbody.innerHTML = rows.map(([label, base, proposed, type]) => {
      const change = proposed - base;
      const format = type === "percent" ? fmtPercent : fmtMoneyB;

      return `
        <tr>
          <td>${safeHTML(label)}</td>
          <td>${safeHTML(format(base))}</td>
          <td>${safeHTML(format(proposed))}</td>
          <td>${safeHTML(format(change))}</td>
        </tr>
      `;
    }).join("");
  }

  function tableRows(fields, row, formatter = fmtMoneyB) {
    return fields.map(([key, label]) => {
      return `| ${label} | ${formatter(toNumber(row?.[key], 0))} |`;
    }).join("\n");
  }

  function revenueTableRows() {
    const revenue = baseline.revenue || {};
    return REVENUE_FIELDS.map(([key, label]) => {
      return `| ${label} | ${fmtMoneyB(toNumber(revenue[key], 0))} |`;
    }).join("\n");
  }

  function taxRateRows() {
    if (!state.taxRows.length) return "| No tax rates found | — | — | — |";

    return state.taxRows.map((item) => {
      const change = item.proposedRate - item.baseRate;
      const sign = change >= 0 ? "+" : "";
      return `| ${item.label} | ${fmtPercent(item.baseRate)} | ${fmtPercent(item.proposedRate)} | ${sign}${change.toFixed(1)} pp |`;
    }).join("\n");
  }

  function spendingRows(fields) {
    return fields.map(([key, label]) => {
      const base = toNumber(baseline.disc?.[key], 0);
      const proposed = toNumber(state.spending[key], 0);
      const change = proposed - base;
      const sign = change >= 0 ? "+" : "";
      return `| ${label} | ${fmtMoneyB(base)} | ${fmtMoneyB(proposed)} | ${sign}${fmtMoneyB(change)} |`;
    }).join("\n");
  }

  function mandatoryValue(key, fallback = 0) {
    return baseline.mandatory?.[key] ?? fallback;
  }

  function buildTaxBudgetMarkdown() {
    const p = calculateProjection();
    const title = cleanCell($("#budget-title")?.value) || "Federal Budget Package";
    const sponsor = cleanCell($("#budget-sponsor")?.value) || "Unspecified";
    const party = cleanCell($("#budget-party")?.value) || "Unspecified";

    return `TAX RATES AND REVENUE BUDGET ACT


IN THE UNITED STATES CONGRESS
IN THE YEAR ${selectedYear}


Author: ${sponsor}
Sponsor(s): ${party}
Co-Sponsors:


Be it enacted by the Senate and House of Representatives of the United States of America in Congress assembled,


Title I - General Information


SECTION 101. SHORT TITLE.
This Act may be cited as the "FY${selectedYear} Tax Rates and Revenue Budget."


SECTION 102. PURPOSE.
The purpose of this Act is to establish the federal tax rate schedule, revenue assumptions, and projected receipts for Fiscal Year ${selectedYear}, including individual income taxes, corporate taxes, payroll taxes, capital gains taxes, excise taxes, UCare revenue, direct revenue, and event revenue impacts.


SECTION 103. FINDINGS.
Congress finds that:
(a) Federal tax policy must be clearly recorded each fiscal year to support accurate budget projections.
(b) Individual, corporate, payroll, capital gains, excise, and other revenues directly affect the federal deficit and debt outlook.
(c) Congress has a responsibility to certify the revenue basis used by the Office of Budget Management.
(d) Transparent revenue schedules improve accountability for taxpayers, agencies, and Congress.


SECTION 104. DEFINITIONS.
For the purposes of this Act:
"Revenue category" means any tax, duty, payroll contribution, special charge, or direct revenue source recorded in the federal revenue engine.
"Fiscal year" means Fiscal Year ${selectedYear}.
"Office of Budget Management" means the fiscal authority responsible for recording APRP budget outputs.


Title II - Bill Content


SECTION 201. TAX RATE SCHEDULE.
The following tax rates are authorized for Fiscal Year ${selectedYear}:

| Tax Category | Baseline Rate | Proposed Rate | Change |
|---|---:|---:|---:|
${taxRateRows()}


SECTION 202. PROJECTED REVENUE BY CATEGORY.
The following revenue projections are certified for Fiscal Year ${selectedYear}:

| Revenue Category | Projected Revenue |
|---|---:|
${revenueTableRows()}


SECTION 203. TOTAL REVENUE CERTIFICATION.
The Office of Budget Management shall record the following revenue totals:

| Revenue Measure | Amount |
|---|---:|
| Baseline Total Revenue | ${fmtMoneyB(baseline.totalRevenue)} |
| Proposed Total Revenue | ${fmtMoneyB(p.proposedRevenue)} |
| Revenue Change | ${fmtMoneyB(p.proposedRevenue - baseline.totalRevenue)} |
| Revenue as % of GDP | ${fmtPercent(toNumber(baseline.revenue?.revenue_pct_gdp, baseline.gdp ? (p.proposedRevenue / baseline.gdp) * 100 : 0))} |


SECTION 204. EFFECTIVE DATE.
This Act shall take effect upon enactment and shall apply to Fiscal Year ${selectedYear}.`;
  }

  function buildMandatoryMarkdown() {
    return `MANDATORY PROGRAMS AND FEDERAL OBLIGATIONS ACT


IN THE UNITED STATES CONGRESS
IN THE YEAR ${selectedYear}


Author: ${cleanCell($("#budget-sponsor")?.value) || "Unspecified"}
Sponsor(s): ${cleanCell($("#budget-party")?.value) || "Unspecified"}
Co-Sponsors:


Be it enacted by the Senate and House of Representatives of the United States of America in Congress assembled,


Title I - General Information


SECTION 101. SHORT TITLE.
This Act may be cited as the "FY${selectedYear} Mandatory Programs and Federal Obligations Act."


SECTION 102. PURPOSE.
The purpose of this Act is to certify mandatory spending rules, demographic assumptions, eligibility formulas, benefit formulas, and entitlement obligations for Fiscal Year ${selectedYear}.


SECTION 103. FINDINGS.
Congress finds that:
(a) Mandatory programs are continuing legal obligations and must be recorded separately from discretionary appropriations.
(b) Social Security, Medicare, Medicaid, SNAP, child health, FCWA, retirement, SSI, and related obligations must be calculated under clear rules.
(c) Demographic assumptions such as population, over-65 population, under-18 population, and median wage affect mandatory spending projections.
(d) Congress must record both formula rules and final costs for federal obligations.


SECTION 104. DEFINITIONS.
For the purposes of this Act:
"Mandatory spending" means spending required by eligibility rules, benefit formulas, automatic obligations, or existing law.
"Eligibility percentage" means the share of a population group eligible for a mandatory program.
"Benefit formula" means the wage, population, poverty, age, or usage-based rule used to estimate cost.
"Fiscal year" means Fiscal Year ${selectedYear}.


Title II - Bill Content


SECTION 201. DEMOGRAPHIC AND WAGE ASSUMPTIONS.

| Assumption | Value |
|---|---:|
| Population | ${fmtPlain(mandatoryValue("population"))} |
| Over-65 Population | ${fmtPlain(mandatoryValue("over65_population"))} |
| Under-18 Population | ${fmtPlain(mandatoryValue("under18_population"))} |
| Final Median Wage | ${fmtMoneyB(toNumber(mandatoryValue("final_median_wage"), 0) / 1000000000)} |


SECTION 202. SOCIAL SECURITY, MEDICARE, AND MEDICAID.

| Program / Rule | Value |
|---|---:|
| Social Security Eligibility % Over 65 | ${fmtPercent(toNumber(mandatoryValue("ss_eligibility_pct_over65"), 0))} |
| Social Security Base Cost % Median Wage | ${fmtPercent(toNumber(mandatoryValue("ss_base_cost_pct_median_wage"), 0))} |
| Social Security Cost | ${fmtMoneyB(toNumber(mandatoryValue("social_security_cost"), 0))} |
| Medicare Eligibility % Over 65 | ${fmtPercent(toNumber(mandatoryValue("medicare_eligibility_pct_over65"), 0))} |
| Medicare Base Cost % Median Wage | ${fmtPercent(toNumber(mandatoryValue("medicare_base_cost_pct_median_wage"), 0))} |
| Health Cost Growth Extra | ${fmtPercent(toNumber(mandatoryValue("health_cost_growth_extra"), 0))} |
| Medicare Cost | ${fmtMoneyB(toNumber(mandatoryValue("medicare_cost"), 0))} |
| Medicaid Eligibility % Population | ${fmtPercent(toNumber(mandatoryValue("medicaid_eligibility_pct_population"), 0))} |
| Medicaid Base Cost % Median Wage | ${fmtPercent(toNumber(mandatoryValue("medicaid_base_cost_pct_median_wage"), 0))} |
| Medicaid Cost | ${fmtMoneyB(toNumber(mandatoryValue("medicaid_cost"), 0))} |


SECTION 203. SNAP, CHILD HEALTH, FCWA, RETIREMENT, AND SSI.

| Program / Rule | Value |
|---|---:|
| SNAP Eligibility % Population | ${fmtPercent(toNumber(mandatoryValue("snap_eligibility_pct_population"), 0))} |
| SNAP Base Cost % Median Wage | ${fmtPercent(toNumber(mandatoryValue("snap_base_cost_pct_median_wage"), 0))} |
| SNAP Cost | ${fmtMoneyB(toNumber(mandatoryValue("snap_cost"), 0))} |
| Child Health Eligibility % Uninsured Under 18 | ${fmtPercent(toNumber(mandatoryValue("child_health_eligibility_pct_uninsured_under18"), 0))} |
| Child Health Poverty Multiplier | ${fmtPlain(mandatoryValue("child_health_poverty_multiplier"))} |
| Child Health Base Cost % Median Wage | ${fmtPercent(toNumber(mandatoryValue("child_health_base_cost_pct_median_wage"), 0))} |
| Child Health Cost | ${fmtMoneyB(toNumber(mandatoryValue("child_health_cost"), 0))} |
| FCWA Eligible % Labor Force | ${fmtPercent(toNumber(mandatoryValue("fcwa_eligible_pct_labor_force"), 0))} |
| FCWA Wage Reimbursement Rate | ${fmtPercent(toNumber(mandatoryValue("fcwa_wage_reimbursement_rate"), 0))} |
| FCWA Parental Leave Weeks | ${fmtPlain(mandatoryValue("fcwa_parental_leave_weeks"))} |
| FCWA Paid Vacation Days | ${fmtPlain(mandatoryValue("fcwa_paid_vacation_days"))} |
| FCWA Usage Rate | ${fmtPercent(toNumber(mandatoryValue("fcwa_usage_rate"), 0))} |
| FCWA Cost | ${fmtMoneyB(toNumber(mandatoryValue("fcwa_cost"), 0))} |
| Federal Civilian Retirement Cost | ${fmtMoneyB(toNumber(mandatoryValue("fed_civilian_retirement_cost"), 0))} |
| Federal Military Retirement Cost | ${fmtMoneyB(toNumber(mandatoryValue("fed_military_retirement_cost"), 0))} |
| SSI Final Eligibility % Population | ${fmtPercent(toNumber(mandatoryValue("ssi_final_eligibility_pct_population"), 0))} |
| SSI Cost | ${fmtMoneyB(toNumber(mandatoryValue("ssi_cost"), 0))} |


SECTION 204. TOTAL MANDATORY CERTIFICATION.

| Measure | Value |
|---|---:|
| Mandatory Event Cost % GDP | ${fmtPercent(toNumber(mandatoryValue("mandatory_event_cost_pct_gdp"), 0))} |
| Mandatory Direct Cost | ${fmtMoneyB(toNumber(mandatoryValue("mandatory_direct_cost"), 0))} |
| Total Mandatory Spending | ${fmtMoneyB(toNumber(mandatoryValue("total_mandatory_spending", baseline.mandatorySpending), 0))} |
| Mandatory Spending % GDP | ${fmtPercent(toNumber(mandatoryValue("mandatory_spending_pct_gdp"), baseline.gdp ? (baseline.mandatorySpending / baseline.gdp) * 100 : 0))} |


SECTION 205. EFFECTIVE DATE.
This Act shall take effect upon enactment and shall apply to Fiscal Year ${selectedYear}.`;
  }

  function buildDefenseAgencyMarkdown() {
    return `DEFENSE, HOMELAND, JUSTICE, STATE, AND AGENCY APPROPRIATIONS ACT


IN THE UNITED STATES CONGRESS
IN THE YEAR ${selectedYear}


Author: ${cleanCell($("#budget-sponsor")?.value) || "Unspecified"}
Sponsor(s): ${cleanCell($("#budget-party")?.value) || "Unspecified"}
Co-Sponsors:


Be it enacted by the Senate and House of Representatives of the United States of America in Congress assembled,


Title I - General Information


SECTION 101. SHORT TITLE.
This Act may be cited as the "FY${selectedYear} Defense, Homeland, Justice, State, and Agency Appropriations Act."


SECTION 102. PURPOSE.
The purpose of this Act is to provide department-specific discretionary appropriations for defense, treasury, veterans affairs, homeland security, justice, state and foreign affairs, commerce, labor, NASA, SBA, other agencies, and general government for Fiscal Year ${selectedYear}.


SECTION 103. FINDINGS.
Congress finds that:
(a) National defense, homeland security, justice, foreign affairs, and federal administration require clear annual appropriations.
(b) Department-specific appropriations improve accountability and prevent vague or untracked spending.
(c) Congress must record each department under the exact fiscal category used by the budget sheet.
(d) Transfers between departments should be limited unless authorized by law.


SECTION 104. DEFINITIONS.
For the purposes of this Act:
"Department-specific appropriation" means funding assigned to a named department or agency category in the discretionary spending engine.
"Fiscal year" means Fiscal Year ${selectedYear}.


Title II - Bill Content


SECTION 201. DEPARTMENT-SPECIFIC APPROPRIATIONS.
The following appropriations are authorized for Fiscal Year ${selectedYear}:

| Department / Agency | Baseline | Proposed | Change |
|---|---:|---:|---:|
${spendingRows(DEFENSE_AGENCY_FIELDS)}


SECTION 202. OVERSIGHT.
Each department funded under this Act shall administer funds only for authorized federal purposes. Transfers between departments shall require congressional notice unless emergency authority is expressly granted.


SECTION 203. EFFECTIVE DATE.
This Act shall take effect upon enactment and shall apply to Fiscal Year ${selectedYear}.`;
  }

  function buildDomesticMarkdown() {
    return `HEALTH, EDUCATION, ENERGY, INFRASTRUCTURE, AGRICULTURE, INTERIOR, EPA, AND HUD APPROPRIATIONS ACT


IN THE UNITED STATES CONGRESS
IN THE YEAR ${selectedYear}


Author: ${cleanCell($("#budget-sponsor")?.value) || "Unspecified"}
Sponsor(s): ${cleanCell($("#budget-party")?.value) || "Unspecified"}
Co-Sponsors:


Be it enacted by the Senate and House of Representatives of the United States of America in Congress assembled,


Title I - General Information


SECTION 101. SHORT TITLE.
This Act may be cited as the "FY${selectedYear} Domestic Investment and Public Services Appropriations Act."


SECTION 102. PURPOSE.
The purpose of this Act is to provide department-specific discretionary appropriations for education, health and social administration, transportation, interior and natural resources, agriculture, energy, housing and urban development, and environmental protection for Fiscal Year ${selectedYear}.


SECTION 103. FINDINGS.
Congress finds that:
(a) Domestic department funding must be listed by exact department and agency category.
(b) Education, health, transportation, agriculture, energy, interior, housing, and environmental protection directly affect public welfare and economic stability.
(c) Congress must record domestic appropriations transparently for budget, deficit, and debt projections.
(d) Department funding shall be administered only for its authorized public purpose.


SECTION 104. DEFINITIONS.
For the purposes of this Act:
"Domestic investment" means department-specific discretionary funding for public welfare, infrastructure, education, health, natural resources, energy, agriculture, housing, and environmental protection.
"Fiscal year" means Fiscal Year ${selectedYear}.


Title II - Bill Content


SECTION 201. DEPARTMENT-SPECIFIC APPROPRIATIONS.
The following appropriations are authorized for Fiscal Year ${selectedYear}:

| Department / Agency | Baseline | Proposed | Change |
|---|---:|---:|---:|
${spendingRows(DOMESTIC_FIELDS)}


SECTION 202. DISCRETIONARY TOTALS.
The Office of Budget Management shall record the following discretionary totals:

| Measure | Value |
|---|---:|
| Event Direct Cost | ${fmtMoneyB(toNumber(baseline.disc?.event_direct_cost, 0))} |
| Event Cost From % GDP | ${fmtMoneyB(toNumber(baseline.disc?.event_cost_from_pct_gdp, 0))} |
| Total Discretionary Spending | ${fmtMoneyB(calculateProjection().proposedDiscretionary)} |
| Discretionary Spending % GDP | ${fmtPercent(baseline.gdp ? (calculateProjection().proposedDiscretionary / baseline.gdp) * 100 : 0)} |


SECTION 203. OVERSIGHT.
Each department funded under this Act shall administer funds only for authorized domestic purposes. Domestic investment funds shall be reported by department, program area, and projected fiscal impact.


SECTION 204. EFFECTIVE DATE.
This Act shall take effect upon enactment and shall apply to Fiscal Year ${selectedYear}.`;
  }

  function buildMarkdownExport() {
    if (!baseline) return "Budget Builder still loading...";

    return [
      buildTaxBudgetMarkdown(),
      "\n\n---\n\n",
      buildMandatoryMarkdown(),
      "\n\n---\n\n",
      buildDefenseAgencyMarkdown(),
      "\n\n---\n\n",
      buildDomesticMarkdown()
    ].join("");
  }

  function buildTaxRowExport() {
    const header = "year\ttax_item\tbase_rate\tproposed_rate\tchange_pp";

    const rows = state.taxRows.map((item) => {
      const change = item.proposedRate - item.baseRate;
      return [
        selectedYear,
        item.label,
        fmtPercent(item.baseRate),
        fmtPercent(item.proposedRate),
        change.toFixed(1)
      ].join("\t");
    });

    return [header, ...rows].join("\n");
  }

  function updateExport() {
    const box = $("#budget-export-text");
    if (box) box.value = buildMarkdownExport();
  }

  function updateHeroCard() {
    const card = $("#budget-hero-card");
    if (!card || !baseline) return;

    const p = calculateProjection();

    card.innerHTML = `
      <div class="eyebrow">FY${safeHTML(selectedYear)} Budget Preview</div>
      <h2>${safeHTML(fmtMoneyB(p.proposedDeficit))}</h2>
      <p>Projected deficit/surplus after local tax and department funding changes.</p>
    `;
  }

  function updateAllOutputs() {
    if (!baseline) return;

    renderKpis();
    renderPreviewTable();
    updateExport();
    updateHeroCard();
  }

  function setupTabs() {
    $all("[data-budget-tab]").forEach((button) => {
      button.addEventListener("click", () => {
        const target = button.dataset.budgetTab;

        $all("[data-budget-tab]").forEach((btn) => btn.classList.remove("is-active"));
        $all("[data-budget-panel]").forEach((panel) => panel.classList.remove("is-active"));

        button.classList.add("is-active");

        const panel = document.querySelector(`[data-budget-panel="${target}"]`);
        if (panel) panel.classList.add("is-active");
      });
    });
  }

  async function copyText(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const temp = document.createElement("textarea");
    temp.value = text;
    document.body.appendChild(temp);
    temp.select();
    document.execCommand("copy");
    temp.remove();
  }

  function setupCopyButtons() {
    $("#copy-budget-markdown")?.addEventListener("click", async () => {
      await copyText(buildMarkdownExport());

      const btn = $("#copy-budget-markdown");
      if (btn) {
        btn.textContent = "Copied!";
        setTimeout(() => (btn.textContent = "Copy All Markdown"), 1200);
      }
    });

    $("#copy-budget-tax-row")?.addEventListener("click", async () => {
      await copyText(buildTaxRowExport());

      const btn = $("#copy-budget-tax-row");
      if (btn) {
        btn.textContent = "Copied!";
        setTimeout(() => (btn.textContent = "Copy Tax Rows"), 1200);
      }
    });

    $("#reset-budget-builder")?.addEventListener("click", () => {
      copyBaselineIntoState();
      renderTaxSliders();
      renderSpendingInputs();
      updateAllOutputs();
    });
  }

  function setupProposalInputs() {
    ["#budget-title", "#budget-sponsor", "#budget-party"].forEach((selector) => {
      $(selector)?.addEventListener("input", updateExport);
    });
  }

  function refreshForYear() {
    baseline = getBaselineForYear(selectedYear);
    copyBaselineIntoState();
    renderTaxSliders();
    renderSpendingInputs();
    updateAllOutputs();
  }

  async function initBudgetBuilder() {
    try {
      updateStatus("Loading");

      await loadData();

      console.log("Budget Builder loaded sheets:", DATA);

      renderYearSelect();

      baseline = getBaselineForYear(selectedYear);
      copyBaselineIntoState();

      setupTabs();
      setupCopyButtons();
      setupProposalInputs();

      renderTaxSliders();
      renderSpendingInputs();
      updateAllOutputs();

      updateStatus("Ready");
    } catch (error) {
      console.error("Budget Builder failed:", error);
      updateStatus("Error");

      const root = $("#budget-builder-root");
      if (root) {
        root.innerHTML = `
          <div class="budget-panel">
            <div class="eyebrow">Error</div>
            <h2>Budget Builder failed to load</h2>
            <p class="budget-note">${safeHTML(error.message)}</p>
          </div>
        `;
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initBudgetBuilder);
  } else {
    initBudgetBuilder();
  }
})();
