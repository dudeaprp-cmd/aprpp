/* APRP Federal Archive — Budget Builder
   Reads public Google Sheet CSV data.
   Shows every tax and every spending field.
   No special laws tab.
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

    return SPENDING_FIELDS.reduce((sum, [key]) => {
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

    const wideItems = Object.keys(wideRow)
      .filter((key) => {
        if (METADATA_KEYS.has(key)) return false;
        const value = cleanCell(wideRow[key]);
        if (value === "") return false;
        const n = toNumber(value, NaN);
        if (!Number.isFinite(n)) return false;
        return key.includes("rate") || key.includes("tax") || key.includes("fica") || key.includes("medicare") || key.includes("social_security") || key.includes("capital") || key.includes("excise") || key.includes("income") || key.includes("corp");
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

    return wideItems;
  }

  function copyBaselineIntoState() {
    state.taxRows = getTaxRowsForYear(selectedYear);

    state.spending = {};
    SPENDING_FIELDS.forEach(([key]) => {
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

    container.innerHTML = SPENDING_FIELDS.map(([key, label]) => {
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

  function allTaxLines() {
    if (!state.taxRows.length) return "- No tax rates found.";

    return state.taxRows.map((item) => {
      const change = item.proposedRate - item.baseRate;
      const sign = change >= 0 ? "+" : "";
      return `- ${item.label}: ${fmtPercent(item.baseRate)} → ${fmtPercent(item.proposedRate)} (${sign}${change.toFixed(1)} pp)`;
    }).join("\n");
  }

  function allSpendingLines() {
    return SPENDING_FIELDS.map(([key, label]) => {
      const base = toNumber(baseline.disc?.[key], 0);
      const proposed = toNumber(state.spending[key], 0);
      const change = proposed - base;
      const sign = change >= 0 ? "+" : "";
      return `- ${label}: ${fmtMoneyB(base)} → ${fmtMoneyB(proposed)} (${sign}${fmtMoneyB(change)})`;
    }).join("\n");
  }

  function buildMarkdownExport() {
    if (!baseline) return "Budget Builder still loading...";

    const p = calculateProjection();

    const title = cleanCell($("#budget-title")?.value) || "Federal Budget Proposal";
    const sponsor = cleanCell($("#budget-sponsor")?.value) || "Unspecified";
    const party = cleanCell($("#budget-party")?.value) || "Unspecified";

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

### Full Tax Rate Schedule
${allTaxLines()}

### Full Discretionary Spending Schedule
${allSpendingLines()}

### Model Note
Generated locally by APRP Budget Builder. Final adoption requires manual admin review and official sheet entry.`;
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
      <p>Projected deficit/surplus after local tax and spending changes.</p>
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
        setTimeout(() => (btn.textContent = "Copy Markdown"), 1200);
      }
    });

    $("#copy-budget-tax-row")?.addEventListener("click", async () => {
      await copyText(buildTaxRowExport());

      const btn = $("#copy-budget-tax-row");
      if (btn) {
        btn.textContent = "Copied!";
        setTimeout(() => (btn.textContent = "Copy Tax Row"), 1200);
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
