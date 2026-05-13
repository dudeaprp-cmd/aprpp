/* APRP Federal Archive — Budget Builder
   This file must be saved as:
   public/assets/js/budget-builder.js
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
    spending: {},
    specialItems: []
  };

  function $(selector, root = document) {
    return root.querySelector(selector);
  }

  function $all(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
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

  function fmtNumber(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "—";
    return n.toLocaleString("en-US", { maximumFractionDigits: 1 });
  }

  function parseRate(value) {
    const raw = cleanCell(value);
    if (!raw) return 0;
    return toNumber(raw, 0);
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
      throw new Error("APRP.fetchSheets missing. Make sure sheets.js loads before budget-builder.js.");
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
        const y = toNumber(row.year, NaN);
        if (Number.isFinite(y)) years.add(y);
      });
    });

    const sorted = Array.from(years).sort((a, b) => a - b);

    if (sorted.length) return sorted;

    return Array.from({ length: 20 }, (_, i) => 2011 + i);
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

    const exact = rows.filter((row) => toNumber(row.year, NaN) === target);

    if (exact.length) return exact;

    const previousYears = rows
      .map((row) => toNumber(row.year, NaN))
      .filter((y) => Number.isFinite(y) && y <= target)
      .sort((a, b) => b - a);

    const fallbackYear = previousYears[0];

    if (fallbackYear) {
      return rows.filter((row) => toNumber(row.year, NaN) === fallbackYear);
    }

    return rows.slice(0, 30);
  }

  function taxRowName(row, index) {
    const taxType = cleanCell(row.tax_type || row.type || row.category || "tax");
    const bracket = cleanCell(row.bracket || row.name || row.group || `item_${index + 1}`);

    return `${taxType.replaceAll("_", " ")} — ${bracket}`;
  }

  function taxRowRate(row) {
    return parseRate(row.applied_rate || row.rule_rate || row.rate || row.tax_rate);
  }

  function copyBaselineIntoState() {
    state.taxRows = getTaxRowsForYear(selectedYear).map((row, index) => {
      const rate = taxRowRate(row);
      const baseRevenue = toNumber(row.final_revenue, NaN) ||
        toNumber(row.base_revenue, NaN) ||
        toNumber(row.revenue, 0);

      return {
        id: `${cleanCell(row.tax_type || "tax")}_${cleanCell(row.bracket || index)}`.replace(/[^\w]+/g, "_"),
        label: taxRowName(row, index),
        baseRate: rate,
        proposedRate: rate,
        baseRevenue,
        row
      };
    });

    state.spending = {};

    SPENDING_FIELDS.forEach(([key]) => {
      state.spending[key] = toNumber(baseline.disc?.[key], 0);
    });

    state.specialItems = [];
  }

  function renderTaxSliders() {
    const container = $("#budget-tax-sliders");
    if (!container) return;

    if (!state.taxRows.length) {
      container.innerHTML = `<p class="budget-note">No TAX_RATES_BY_YEAR rows found for FY${safeHTML(selectedYear)}.</p>`;
      return;
    }

    container.innerHTML = state.taxRows.map((item, index) => {
      const safeId = `tax-slider-${index}`;

      return `
        <div class="budget-slider-row">
          <label for="${safeId}">${safeHTML(item.label)}</label>
          <input
            id="${safeId}"
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
      return baseTotal;
    }

    const unmodeledRevenue = Math.max(0, baseTotal - baseModeledRevenue);
    return unmodeledRevenue + proposedModeledRevenue;
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
    const deficitChange = proposedDeficit - baseline.deficit;

    const proposedDebt = baseline.debt - proposedDeficit;
    const proposedDebtToGdp = baseline.gdp ? (proposedDebt / baseline.gdp) * 100 : 0;

    return {
      specialCostB,
      specialRevenueB,
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
      ["Special Cost", 0, p.specialCostB, "money"],
      ["Special Revenue", 0, p.specialRevenueB, "money"],
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

  function mostChangedTaxes(limit = 10) {
    return state.taxRows
      .map((item) => ({
        label: item.label,
        base: item.baseRate,
        proposed: item.proposedRate,
        change: item.proposedRate - item.baseRate
      }))
      .filter((item) => Math.abs(item.change) >= 0.01)
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
      .slice(0, limit);
  }

  function mostChangedSpending(limit = 10) {
    return SPENDING_FIELDS.map(([key, label]) => {
      const base = toNumber(baseline.disc?.[key], 0);
      const proposed = toNumber(state.spending[key], 0);

      return {
        label,
        base,
        proposed,
        change: proposed - base
      };
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
      ? taxChanges.map((item) => {
          const sign = item.change >= 0 ? "+" : "";
          return `- ${item.label}: ${fmtPercent(item.base)} → ${fmtPercent(item.proposed)} (${sign}${item.change.toFixed(1)} pp)`;
        }).join("\n")
      : "- No tax rate changes from baseline.";

    const spendingLines = spendingChanges.length
      ? spendingChanges.map((item) => {
          const sign = item.change >= 0 ? "+" : "";
          return `- ${item.label}: ${fmtMoneyB(item.base)} → ${fmtMoneyB(item.proposed)} (${sign}${fmtMoneyB(item.change)})`;
        }).join("\n")
      : "- No discretionary spending changes from baseline.";

    const specialLines = state.specialItems.length
      ? state.specialItems.map((item, i) => {
          const costB = toNumber(item.directCost, 0) / 1_000_000_000;
          const revB = toNumber(item.directRevenue, 0) / 1_000_000_000;
          return `- ${i + 1}. ${item.name} (${item.type}) — Cost ${fmtMoneyB(costB)}, Revenue ${fmtMoneyB(revB)}, GDP ${item.gdpEffect}, Inflation ${item.inflationEffect}`;
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
Generated locally by APRP Budget Builder. Final adoption requires manual admin review and official sheet entry.`;
  }

  function buildTaxRowExport() {
    const rows = state.taxRows.map((item) => {
      return [
        selectedYear,
        item.label,
        fmtPercent(item.baseRate),
        fmtPercent(item.proposedRate),
        (item.proposedRate - item.baseRate).toFixed(1)
      ].join("\t");
    });

    return ["year\ttax_item\tbase_rate\tproposed_rate\tchange_pp", ...rows].join("\n");
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
      <p>Projected deficit/surplus after local tax, spending, and special item changes.</p>
    `;
  }

  function updateAllOutputs() {
    if (!baseline) return;

    renderKpis();
    renderPreviewTable();
    renderSpecialItems();
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

  function setupLawButtons() {
    $("#add-law-item")?.addEventListener("click", () => {
      const item = {
        name: cleanCell($("#law-name")?.value) || `Special Item ${state.specialItems.length + 1}`,
        type: cleanCell($("#law-type")?.value) || "BILL",
        directCost: toNumber($("#law-direct-cost")?.value, 0),
        directRevenue: toNumber($("#law-direct-revenue")?.value, 0),
        gdpEffect: cleanCell($("#law-gdp-effect")?.value) || "0.00%",
        inflationEffect: cleanCell($("#law-inflation-effect")?.value) || "0.00%",
        approvalImpact: toNumber($("#law-approval-impact")?.value, 0),
        stockImpact: toNumber($("#law-stock-impact")?.value, 0)
      };

      state.specialItems.push(item);

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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initBudgetBuilder);
  } else {
    initBudgetBuilder();
  }
})();
