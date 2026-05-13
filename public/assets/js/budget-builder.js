/* APRP Federal Archive — Budget Builder
   Local read-only budget simulator.
   Reads public Google Sheet CSV data, lets members adjust budget assumptions,
   then exports markdown / tax rows for manual review.
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
    "EVENT_POLICY_INPUTS",
    "YEARLY_CONFIG"
  ];

  const TAX_FIELDS = [
    ["income_0_10k_rate", "Income Tax: $0–10k"],
    ["income_10_30k_rate", "Income Tax: $10k–30k"],
    ["income_30_60k_rate", "Income Tax: $30k–60k"],
    ["income_60_100k_rate", "Income Tax: $60k–100k"],
    ["income_100_250k_rate", "Income Tax: $100k–250k"],
    ["income_250_500k_rate", "Income Tax: $250k–500k"],
    ["income_500_1000k_rate", "Income Tax: $500k–1M"],
    ["income_1000k_5m_rate", "Income Tax: $1M–5M"],
    ["income_5m_10m_rate", "Income Tax: $5M–10M"],
    ["income_10m_plus_rate", "Income Tax: $10M+"],
    ["corp_0_50k_rate", "Corporate Tax: $0–50k"],
    ["corp_50_500k_rate", "Corporate Tax: $50k–500k"],
    ["corp_500k_5m_rate", "Corporate Tax: $500k–5M"],
    ["corp_5m_10m_rate", "Corporate Tax: $5M–10M"],
    ["corp_10m_100m_rate", "Corporate Tax: $10M–100M"],
    ["corp_100m_1b_rate", "Corporate Tax: $100M–1B"],
    ["corp_1b_plus_rate", "Corporate Tax: $1B+"],
    ["payroll_medicare_rate", "Payroll: Medicare"],
    ["payroll_social_security_rate", "Payroll: Social Security"],
    ["payroll_worker_rate", "Payroll: Worker"],
    ["sales_tax_rate", "Sales Tax"],
    ["cap_gains_short_term_rate", "Capital Gains: Short-Term"],
    ["cap_gains_long_term_rate", "Capital Gains: Long-Term"],
    ["excise_tax_rate", "Excise Tax"],
    ["ucare_rate", "UCare Rate"]
  ];

  const SPENDING_FIELDS = [
    ["defense_spending", "Defense"],
    ["education_spending", "Education"],
    ["health_social_admin_spending", "Health & Social Admin"],
    ["transportation_spending", "Transportation"],
    ["treasury_spending", "Treasury"],
    ["veterans_affairs_spending", "Veterans Affairs"],
    ["homeland_security_spending", "Homeland Security"],
    ["justice_spending", "Justice"],
    ["state_foreign_affairs_spending", "State / Foreign Affairs"],
    ["interior_natural_resources_spending", "Interior / Natural Resources"],
    ["agriculture_spending", "Agriculture"],
    ["energy_spending", "Energy"],
    ["commerce_spending", "Commerce"],
    ["labor_spending", "Labor"],
    ["housing_urban_development_spending", "Housing & Urban Development"],
    ["environmental_protection_spending", "Environmental Protection"],
    ["nasa_spending", "NASA"],
    ["sba_spending", "SBA"],
    ["other_agencies_spending", "Other Agencies"],
    ["general_government_spending", "General Government"]
  ];

  let DATA = {};
  let selectedYear = null;
  let baseline = null;

  let state = {
    taxRates: {},
    spending: {},
    specialItems: []
  };

  function $(selector, root = document) {
    return root.querySelector(selector);
  }

  function $all(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === "function") {
      return window.CSS.escape(value);
    }

    return String(value).replace(/["\\]/g, "\\$&");
  }

  function fmtMoneyB(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "—";

    const sign = n < 0 ? "-" : "";
    return `${sign}$${Math.abs(n).toLocaleString("en-US", {
      maximumFractionDigits: 1
    })}B`;
  }

  function fmtNumber(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "—";

    return n.toLocaleString("en-US", {
      maximumFractionDigits: 1
    });
  }

  function fmtPercent(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "—";

    return `${n.toFixed(n % 1 === 0 ? 0 : 1)}%`;
  }

  function parsePercentLike(value) {
    const raw = cleanCell(value);
    if (!raw) return 0;

    return toNumber(raw, 0);
  }

  function getControlValue(key, fallback = "") {
    const target = cleanCell(key).toLowerCase();

    const found = (DATA.CONTROL_CONFIG || []).find((row) => {
      const rowKey = cleanCell(row.setting || row.key || row.name).toLowerCase();
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

    [
      "YEARLY_FISCAL_OUTPUT",
      "TAX_RATES_BY_YEAR",
      "YEARLY_DISCRETIONARY_ENGINE",
      "YEARLY_MACRO_ENGINE",
      "YEARLY_REVENUE_ENGINE"
    ].forEach((sheetName) => {
      (DATA[sheetName] || []).forEach((row) => {
        const year = toNumber(row.year, NaN);
        if (Number.isFinite(year)) years.add(year);
      });
    });

    const sorted = Array.from(years).sort((a, b) => a - b);

    if (sorted.length) return sorted;

    return Array.from({ length: 20 }, (_, index) => 2011 + index);
  }

  function sumSpendingRow(row) {
    if (!row) return 0;

    return SPENDING_FIELDS.reduce((sum, [key]) => {
      return sum + toNumber(row[key], 0);
    }, 0);
  }

  function totalSpendingFromFiscal(row) {
    const direct = toNumber(row?.total_spending, NaN);
    if (Number.isFinite(direct)) return direct;

    const mandatory =
      toNumber(row?.mandatory_spending, NaN) ||
      toNumber(row?.mandatory_sper, NaN) ||
      toNumber(row?.mandatory_spending_b, 0);

    const discretionary =
      toNumber(row?.discretionary_spending, NaN) ||
      toNumber(row?.discretionary_sper, NaN) ||
      toNumber(row?.discretionary_spending_b, 0);

    const interest = toNumber(row?.interest_cost, 0);

    return mandatory + discretionary + interest;
  }

  function getBaselineForYear(year) {
    const fiscal = findYearRow("YEARLY_FISCAL_OUTPUT", year) || {};
    const tax = findYearRow("TAX_RATES_BY_YEAR", year) || {};
    const disc = findYearRow("YEARLY_DISCRETIONARY_ENGINE", year) || {};
    const revenue = findYearRow("YEARLY_REVENUE_ENGINE", year) || {};
    const macro = findYearRow("YEARLY_MACRO_ENGINE", year) || {};
    const mandatory = findYearRow("YEARLY_MANDATORY_ENGINE", year) || {};

    const gdp =
      toNumber(fiscal.real_gdp, NaN) ||
      toNumber(fiscal.gdp, NaN) ||
      toNumber(macro.real_gdp, NaN) ||
      toNumber(macro.gdp, NaN) ||
      toNumber(revenue.real_gdp, 0);

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
      sumSpendingRow(disc);

    const interestCost = toNumber(fiscal.interest_cost, 0);

    const totalSpending =
      toNumber(fiscal.total_spending, NaN) ||
      totalSpendingFromFiscal(fiscal) ||
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
      tax,
      disc,
      revenue,
      macro,
      mandatory,
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

  function copyBaselineIntoState() {
    state.taxRates = {};
    state.spending = {};
    state.specialItems = [];

    TAX_FIELDS.forEach(([key]) => {
      state.taxRates[key] = parsePercentLike(baseline.tax?.[key]);
    });

    SPENDING_FIELDS.forEach(([key]) => {
      state.spending[key] = toNumber(baseline.disc?.[key], 0);
    });
  }

  function calculateTaxRevenueProjection() {
    const baseTotal = baseline.totalRevenue || 0;

    let baseWeightedRevenue = 0;
    let newWeightedRevenue = 0;

    TAX_FIELDS.forEach(([key]) => {
      const baseRate = parsePercentLike(baseline.tax?.[key]);
      const newRate = Number(state.taxRates[key] ?? baseRate);

      const revenueKey = key.replace("_rate", "_revenue");
      const baseRevenueForCategory = toNumber(baseline.revenue?.[revenueKey], 0);

      if (baseRevenueForCategory > 0 && baseRate > 0) {
        const baseTaxable = baseRevenueForCategory / baseRate;
        baseWeightedRevenue += baseTaxable * baseRate;
        newWeightedRevenue += baseTaxable * newRate;
      }
    });

    if (baseWeightedRevenue <= 0 || newWeightedRevenue <= 0) {
      let totalRateChange = 0;
      let changedCount = 0;

      TAX_FIELDS.forEach(([key]) => {
        const baseRate = parsePercentLike(baseline.tax?.[key]);
        const newRate = Number(state.taxRates[key] ?? baseRate);

        if (baseRate > 0) {
          totalRateChange += (newRate - baseRate) / Math.max(baseRate, 1);
          changedCount += 1;
        }
      });

      const avgRateChange = changedCount ? totalRateChange / changedCount : 0;
      return baseTotal * (1 + avgRateChange * 0.35);
    }

    const untouchedRevenue = Math.max(0, baseTotal - baseWeightedRevenue);
    return untouchedRevenue + newWeightedRevenue;
  }

  function calculateProjection() {
    const specialCostB = state.specialItems.reduce((sum, item) => {
      return sum + toNumber(item.directCost, 0) / 1_000_000_000;
    }, 0);

    const specialRevenueB = state.specialItems.reduce((sum, item) => {
      return sum + toNumber(item.directRevenue, 0) / 1_000_000_000;
    }, 0);

    const proposedRevenue = calculateTaxRevenueProjection() + specialRevenueB;

    const proposedDiscretionary = Object.values(state.spending).reduce((sum, value) => {
      return sum + toNumber(value, 0);
    }, 0);

    const proposedSpending =
      proposedDiscretionary +
      baseline.mandatorySpending +
      baseline.interestCost +
      specialCostB;

    const proposedDeficit = proposedRevenue - proposedSpending;
    const baselineDeficit = baseline.deficit;
    const deficitChange = proposedDeficit - baselineDeficit;

    const proposedDebt = baseline.debt - proposedDeficit;
    const proposedDebtToGdp = baseline.gdp ? (proposedDebt / baseline.gdp) * 100 : 0;

    return {
      specialCostB,
      specialRevenueB,
      proposedRevenue,
      proposedDiscretionary,
      proposedSpending,
      proposedDeficit,
      baselineDeficit,
      deficitChange,
      proposedDebt,
      proposedDebtToGdp
    };
  }

  function renderYearSelect() {
    const select = $("#budget-year");
    if (!select) return;

    const years = getAvailableYears();
    const currentYear = toNumber(getControlValue("current_year", ""), NaN);

    let defaultYear = years[0];

    if (Number.isFinite(currentYear)) {
      if (years.includes(currentYear + 1)) defaultYear = currentYear + 1;
      else if (years.includes(currentYear)) defaultYear = currentYear;
    }

    selectedYear = selectedYear || defaultYear || new Date().getFullYear();

    select.innerHTML = years.map((year) => {
      return `<option value="${year}" ${Number(year) === Number(selectedYear) ? "selected" : ""}>FY${year}</option>`;
    }).join("");

    select.addEventListener("change", () => {
      selectedYear = toNumber(select.value, selectedYear);
      refreshForYear();
    });
  }

  function renderTaxSliders() {
    const container = $("#budget-tax-sliders");
    if (!container) return;

    container.innerHTML = TAX_FIELDS.map(([key, label]) => {
      const value = Number(state.taxRates[key] ?? 0);
      const max = key === "sales_tax_rate" ? 25 : 65;
      const step = key.includes("ucare") ? 0.1 : 0.5;

      return `
        <div class="budget-slider-row" data-tax-row="${safeHTML(key)}">
          <label for="tax-${safeHTML(key)}">${safeHTML(label)}</label>
          <input
            id="tax-${safeHTML(key)}"
            type="range"
            min="0"
            max="${max}"
            step="${step}"
            value="${safeHTML(value)}"
            data-tax-key="${safeHTML(key)}"
          />
          <div class="budget-slider-value" data-tax-value="${safeHTML(key)}">${safeHTML(fmtPercent(value))}</div>
        </div>
      `;
    }).join("");

    $all("[data-tax-key]", container).forEach((input) => {
      input.addEventListener("input", () => {
        const key = input.dataset.taxKey;
        state.taxRates[key] = toNumber(input.value, 0);

        const output = document.querySelector(`[data-tax-value="${cssEscape(key)}"]`);
        if (output) output.textContent = fmtPercent(state.taxRates[key]);

        updateAllOutputs();
      });
    });
  }

  function renderSpendingInputs() {
    const container = $("#budget-spending-inputs");
    if (!container) return;

    container.innerHTML = SPENDING_FIELDS.map(([key, label]) => {
      const value = Number(state.spending[key] ?? 0);

      return `
        <div class="budget-spending-row" data-spending-row="${safeHTML(key)}">
          <label for="spending-${safeHTML(key)}">${safeHTML(label)}</label>
          <input
            id="spending-${safeHTML(key)}"
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

  function renderSpecialItems() {
    const table = $("#budget-law-table");
    if (!table) return;

    if (!state.specialItems.length) {
      table.innerHTML = `<tr><td colspan="7">No special items added.</td></tr>`;
      return;
    }

    table.innerHTML = state.specialItems.map((item) => `
      <tr>
        <td>${safeHTML(item.name)}</td>
        <td>${safeHTML(item.type)}</td>
        <td>${safeHTML(fmtMoneyB(toNumber(item.directCost, 0) / 1_000_000_000))}</td>
        <td>${safeHTML(fmtMoneyB(toNumber(item.directRevenue, 0) / 1_000_000_000))}</td>
        <td>${safeHTML(item.gdpEffect)}</td>
        <td>${safeHTML(fmtNumber(item.approvalImpact))}</td>
        <td>${safeHTML(fmtNumber(item.stockImpact))}</td>
      </tr>
    `).join("");
  }

  function renderKpis() {
    const container = $("#budget-kpis");
    if (!container || !baseline) return;

    const projection = calculateProjection();
    const deficitLabel = projection.proposedDeficit >= 0 ? "Surplus" : "Deficit";

    container.innerHTML = `
      <div class="budget-kpi">
        <strong>Revenue</strong>
        <span>${safeHTML(fmtMoneyB(projection.proposedRevenue))}</span>
        <small>Baseline ${safeHTML(fmtMoneyB(baseline.totalRevenue))}</small>
      </div>
      <div class="budget-kpi">
        <strong>Spending</strong>
        <span>${safeHTML(fmtMoneyB(projection.proposedSpending))}</span>
        <small>Baseline ${safeHTML(fmtMoneyB(baseline.totalSpending))}</small>
      </div>
      <div class="budget-kpi">
        <strong>${safeHTML(deficitLabel)}</strong>
        <span>${safeHTML(fmtMoneyB(projection.proposedDeficit))}</span>
        <small>Change ${safeHTML(fmtMoneyB(projection.deficitChange))}</small>
      </div>
      <div class="budget-kpi">
        <strong>Debt-to-GDP</strong>
        <span>${safeHTML(fmtPercent(projection.proposedDebtToGdp))}</span>
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
      ["Special Item Cost", 0, p.specialCostB, "money"],
      ["Special Item Revenue", 0, p.specialRevenueB, "money"],
      ["Deficit / Surplus", baseline.deficit, p.proposedDeficit, "money"],
      ["Debt-to-GDP", baseline.debtToGdp, p.proposedDebtToGdp, "percent"]
    ];

    tbody.innerHTML = rows.map(([label, base, proposed, type]) => {
      const change = proposed - base;
      const formatter = type === "percent" ? fmtPercent : fmtMoneyB;

      return `
        <tr>
          <td>${safeHTML(label)}</td>
          <td>${safeHTML(formatter(base))}</td>
          <td>${safeHTML(formatter(proposed))}</td>
          <td>${safeHTML(formatter(change))}</td>
        </tr>
      `;
    }).join("");
  }

  function mostChangedTaxes(limit = 8) {
    return TAX_FIELDS.map(([key, label]) => {
      const base = parsePercentLike(baseline.tax?.[key]);
      const proposed = Number(state.taxRates[key] ?? base);
      return { key, label, base, proposed, change: proposed - base };
    })
      .filter((item) => Math.abs(item.change) >= 0.01)
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
      .slice(0, limit);
  }

  function mostChangedSpending(limit = 8) {
    return SPENDING_FIELDS.map(([key, label]) => {
      const base = toNumber(baseline.disc?.[key], 0);
      const proposed = Number(state.spending[key] ?? base);
      return { key, label, base, proposed, change: proposed - base };
    })
      .filter((item) => Math.abs(item.change) >= 0.1)
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
      .slice(0, limit);
  }

  function buildMarkdownExport() {
    if (!baseline) return "Budget Builder still loading...";

    const p = calculateProjection();

    const title = cleanCell($("#budget-title")?.value) || "Federal Budget Proposal";
    const sponsor = cleanCell($("#budget-sponsor")?.value) || "Unspecified";
    const party = cleanCell($("#budget-party")?.value) || "Unspecified";

    const taxChanges = mostChangedTaxes();
    const spendingChanges = mostChangedSpending();

    const taxLines = taxChanges.length
      ? taxChanges.map((item) => `- ${item.label}: ${fmtPercent(item.base)} → ${fmtPercent(item.proposed)} (${item.change >= 0 ? "+" : ""}${item.change.toFixed(1)} pp)`).join("\n")
      : "- No tax rate changes from baseline.";

    const spendingLines = spendingChanges.length
      ? spendingChanges.map((item) => `- ${item.label}: ${fmtMoneyB(item.base)} → ${fmtMoneyB(item.proposed)} (${item.change >= 0 ? "+" : ""}${fmtMoneyB(item.change)})`).join("\n")
      : "- No discretionary spending changes from baseline.";

    const specialLines = state.specialItems.length
      ? state.specialItems.map((item, index) => {
        const costB = toNumber(item.directCost, 0) / 1_000_000_000;
        const revB = toNumber(item.directRevenue, 0) / 1_000_000_000;
        return `- ${index + 1}. ${item.name} (${item.type}) — Cost ${fmtMoneyB(costB)}, Revenue ${fmtMoneyB(revB)}, GDP ${item.gdpEffect}, Inflation ${item.inflationEffect}`;
      }).join("\n")
      : "- No special appropriations or law/event items added.";

    return `## FY${selectedYear} FEDERAL BUDGET PROPOSAL

**Title:** ${title}
**Sponsor:** ${sponsor}
**Party/Caucus:** ${party}
**Status:** Draft / Pending Review

### Fiscal Summary
- Revenue: ${fmtMoneyB(p.proposedRevenue)} / Baseline ${fmtMoneyB(baseline.totalRevenue)}
- Spending: ${fmtMoneyB(p.proposedSpending)} / Baseline ${fmtMoneyB(baseline.totalSpending)}
- Deficit/Surplus: ${fmtMoneyB(p.proposedDeficit)} / Baseline ${fmtMoneyB(baseline.deficit)}
- Debt-to-GDP: ${fmtPercent(p.proposedDebtToGdp)} / Baseline ${fmtPercent(baseline.debtToGdp)}
- Discretionary Spending: ${fmtMoneyB(p.proposedDiscretionary)}
- Mandatory Spending: ${fmtMoneyB(baseline.mandatorySpending)}
- Interest Cost: ${fmtMoneyB(baseline.interestCost)}

### Major Tax Changes
${taxLines}

### Major Discretionary Spending Changes
${spendingLines}

### Special Laws / Appropriations
${specialLines}

### Model Note
This proposal was generated from the APRP Budget Builder using public economy model data. Final adoption requires manual admin review and entry into the official sheets.`;
  }

  function buildTaxRowExport() {
    if (!baseline) return "";

    const row = [
      selectedYear,
      ...TAX_FIELDS.map(([key]) => `${Number(state.taxRates[key] || 0).toFixed(1)}%`)
    ];

    return row.join("\t");
  }

  function updateExport() {
    const box = $("#budget-export-text");
    if (!box) return;
    box.value = buildMarkdownExport();
  }

  function updateHeroCard() {
    const card = $("#budget-hero-card");
    if (!card || !baseline) return;

    const p = calculateProjection();

    card.innerHTML = `
      <div class="eyebrow">FY${safeHTML(selectedYear)} Budget Preview</div>
      <h2>${safeHTML(fmtMoneyB(p.proposedDeficit))}</h2>
      <p>Projected deficit/surplus after local tax, spending, and special item changes.</p>
    `;
  }

  function updateAllOutputs() {
    if (!baseline) return;
    renderKpis();
    renderSpecialItems();
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

        const panel = document.querySelector(`[data-budget-panel="${cssEscape(target)}"]`);
        if (panel) panel.classList.add("is-active");
      });
    });
  }

  function setupLawButtons() {
    $("#add-law-item")?.addEventListener("click", () => {
      const name = cleanCell($("#law-name")?.value) || `Special Item ${state.specialItems.length + 1}`;
      const type = cleanCell($("#law-type")?.value) || "BILL";
      const directCost = toNumber($("#law-direct-cost")?.value, 0);
      const directRevenue = toNumber($("#law-direct-revenue")?.value, 0);
      const gdpEffect = cleanCell($("#law-gdp-effect")?.value) || "0.00%";
      const inflationEffect = cleanCell($("#law-inflation-effect")?.value) || "0.00%";
      const approvalImpact = toNumber($("#law-approval-impact")?.value, 0);
      const stockImpact = toNumber($("#law-stock-impact")?.value, 0);

      state.specialItems.push({
        name,
        type,
        directCost,
        directRevenue,
        gdpEffect,
        inflationEffect,
        approvalImpact,
        stockImpact
      });

      if ($("#law-name")) $("#law-name").value = "";
      if ($("#law-direct-cost")) $("#law-direct-cost").value = "0";
      if ($("#law-direct-revenue")) $("#law-direct-revenue").value = "0";
      if ($("#law-gdp-effect")) $("#law-gdp-effect").value = "0.00%";
      if ($("#law-inflation-effect")) $("#law-inflation-effect").value = "0.00%";
      if ($("#law-approval-impact")) $("#law-approval-impact").value = "0";
      if ($("#law-stock-impact")) $("#law-stock-impact").value = "0";

      updateAllOutputs();
    });

    $("#clear-law-items")?.addEventListener("click", () => {
      state.specialItems = [];
      updateAllOutputs();
    });
  }

  async function copyText(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    const temp = document.createElement("textarea");
    temp.value = text;
    document.body.appendChild(temp);
    temp.select();
    document.execCommand("copy");
    temp.remove();

    return true;
  }

  function setupCopyButtons() {
    $("#copy-budget-markdown")?.addEventListener("click", async () => {
      await copyText(buildMarkdownExport());

      const btn = $("#copy-budget-markdown");
      if (btn) {
        btn.textContent = "Copied!";
        setTimeout(() => {
          btn.textContent = "Copy Markdown";
        }, 1200);
      }
    });

    $("#copy-budget-tax-row")?.addEventListener("click", async () => {
      await copyText(buildTaxRowExport());

      const btn = $("#copy-budget-tax-row");
      if (btn) {
        btn.textContent = "Copied!";
        setTimeout(() => {
          btn.textContent = "Copy Tax Row";
        }, 1200);
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

  function updateStatus(text) {
    const status = $("#budget-load-status");
    if (status) status.textContent = text;
  }

  function refreshForYear() {
    baseline = getBaselineForYear(selectedYear);
    copyBaselineIntoState();
    renderTaxSliders();
    renderSpendingInputs();
    updateAllOutputs();
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
          console.warn(`Budget Builder could not load ${sheetName}`, error);
          DATA[sheetName] = [];
        }
      })
    );
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
      setupLawButtons();
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

  document.addEventListener("DOMContentLoaded", initBudgetBuilder);
})();
