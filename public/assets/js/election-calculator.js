/* APRP Election Calculator — Sheet-Driven Version
   Data source:
   - CALC_STATE_BASELINES
   - CALC_LOBBIES
   - CALC_EXPERIENCE
   - CALC_RULES

   No hardcoded baseline / lobby / experience / rule data.
*/

(function () {
  "use strict";

  const COLORS = {
    dnc: "#2563eb",
    gop: "#dc2626",
    other: "#7c3aed",
    tossup: "#64748b"
  };

  const STORAGE_KEY = "aprp_sheet_driven_election_calculator";

  let baselines = [];
  let lobbies = [];
  let experiences = [];
  let rules = {};
  let results = {};
  let selectedState = "";

  const appState = {
    names: {
      dnc: "Democratic Candidate",
      gop: "Republican Candidate",
      other: "Independent Candidate"
    },
    experience: {
      dnc: "none",
      gop: "none",
      other: "none"
    },
    lobbies: {
      dnc: [],
      gop: [],
      other: []
    },
    ideology: {
      dnc: { progressive: 0, liberal: 0, conservative: 0, nationalist: 0, libertarian: 0, populist: 0 },
      gop: { progressive: 0, liberal: 0, conservative: 0, nationalist: 0, libertarian: 0, populist: 0 },
      other: { progressive: 0, liberal: 0, conservative: 0, nationalist: 0, libertarian: 0, populist: 0 }
    },
    national: {
      incumbent_party: "none",
      incumbent_candidate: "no",
      dnc_pv_lead: 0,
      gop_pv_lead: 0,
      other_pv_lead: 0,
      dnc_debuff: 0,
      gop_debuff: 0,
      other_debuff: 0,
      dnc_debate: 0,
      gop_debate: 0,
      other_debate: 0,
      approval_gap: 0
    },
    campaign: {},
    manual: {}
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function clean(value) {
    return String(value ?? "").trim();
  }

  function key(value) {
    return clean(value).toLowerCase();
  }

  function num(value, fallback = 0) {
    const cleaned = clean(value).replace(/[$,%]/g, "").replace(/,/g, "");
    if (cleaned === "") return fallback;

    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function html(value) {
    return clean(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function loadSheet(name) {
    if (window.APRP?.fetchSheet) return window.APRP.fetchSheet(name, { bustCache: true });
    if (window.APRP?.loadSheet) return window.APRP.loadSheet(name, { bustCache: true });
    if (window.APRP_SHEETS?.loadSheet) return window.APRP_SHEETS.loadSheet(name, { bustCache: true });

    throw new Error("No sheet loader found. sheets.js must load before election-calculator.js.");
  }

  async function loadAllData() {
    const [baselineRows, lobbyRows, experienceRows, ruleRows] = await Promise.all([
      loadSheet("CALC_STATE_BASELINES"),
      loadSheet("CALC_LOBBIES"),
      loadSheet("CALC_EXPERIENCE"),
      loadSheet("CALC_RULES")
    ]);

    baselines = normalizeBaselines(baselineRows);
    lobbies = normalizeLobbies(lobbyRows);
    experiences = normalizeExperiences(experienceRows);
    rules = normalizeRules(ruleRows);

    if (!baselines.length) {
      throw new Error("CALC_STATE_BASELINES loaded, but no valid state rows were found.");
    }

    if (!lobbies.length) {
      console.warn("CALC_LOBBIES loaded with no valid lobby rows.");
    }

    if (!experiences.length) {
      console.warn("CALC_EXPERIENCE loaded with no valid experience rows.");
    }

    if (!Object.keys(rules).length) {
      throw new Error("CALC_RULES loaded, but no key/value rules were found.");
    }

    baselines.forEach((row) => {
      if (!appState.campaign[row.state_abbr]) {
        appState.campaign[row.state_abbr] = { dnc: 0, gop: 0, other: 0 };
      }
    });
  }

  function normalizeRules(rows) {
    const out = {};

    rows.forEach((row) => {
      const ruleKey = key(row.key);
      const value = num(row.value, NaN);

      if (ruleKey && Number.isFinite(value)) {
        out[ruleKey] = value;
      }
    });

    return out;
  }

  function rule(name, fallback = 0) {
    return num(rules[key(name)], fallback);
  }

  function normalizeExperiences(rows) {
    const out = rows
      .map((row) => ({
        id: key(row.experience_id || row.id || row.label).replace(/\s+/g, "_"),
        label: clean(row.label || row.experience_id || row.id),
        shift: num(row.shift, 0)
      }))
      .filter((row) => row.id);

    if (!out.some((row) => row.id === "none")) {
      out.unshift({ id: "none", label: "None", shift: 0 });
    }

    return out;
  }

  function normalizeLobbies(rows) {
    return rows
      .map((row) => ({
        id: key(row.lobby_id || row.id || row.lobby_name).replace(/\s+/g, "_"),
        name: clean(row.lobby_name || row.name || row.lobby_id),
        shift: num(row.shift, 0),
        states: clean(row.states || "ALL")
          .toUpperCase()
          .split(",")
          .map(clean)
          .filter(Boolean)
      }))
      .filter((row) => row.id && row.name);
  }

  function normalizeBaselines(rows) {
    return rows
      .map((row) => {
        const abbr = clean(row.state_abbr || row.state || row.abbr).toUpperCase();

        const baseGop = num(row.base_gop, NaN);
        const baseDnc = num(row.base_dnc, num(row.base_dem, NaN));
        const baseOther = num(row.base_other, NaN);

        const ev = num(row.ev, num(row.electors, num(row.electoral_votes, 0)));

        return {
          raw: row,
          state_abbr: abbr,
          ev,
          base_gop: baseGop,
          base_dnc: baseDnc,
          base_other: baseOther,

          progressive: num(row.progressive, 1),
          liberal: num(row.liberal, 1),
          conservative: num(row.conservative, 1),
          nationalist: num(row.nationalist, 1),
          libertarian: num(row.libertarian, 1),
          populist: num(row.populist, 1)
        };
      })
      .filter((row) => {
        return (
          row.state_abbr &&
          Number.isFinite(row.base_gop) &&
          Number.isFinite(row.base_dnc) &&
          Number.isFinite(row.base_other)
        );
      });
  }

  function getBaseline(abbr) {
    return baselines.find((row) => row.state_abbr === abbr);
  }

  function getExperienceShift(party) {
    const selected = appState.experience[party] || "none";
    return experiences.find((row) => row.id === selected)?.shift || 0;
  }

  function getLobbyShift(party, abbr) {
    return lobbies.reduce((total, lobby) => {
      if (!appState.lobbies[party].includes(lobby.id)) return total;
      if (!lobby.states.includes("ALL") && !lobby.states.includes(abbr)) return total;

      return total + lobby.shift;
    }, 0);
  }

  function getIdeologyShift(party, baseline) {
    const values = appState.ideology[party];

    const raw =
      num(values.progressive) * baseline.progressive +
      num(values.liberal) * baseline.liberal +
      num(values.conservative) * baseline.conservative +
      num(values.nationalist) * baseline.nationalist +
      num(values.libertarian) * baseline.libertarian +
      num(values.populist) * baseline.populist;

    const divisor = rule("ideology_shift_divisor", 40);
    const cap = rule("ideology_shift_cap", 5);

    const shifted = divisor ? raw / divisor : 0;

    return Math.max(-cap, Math.min(cap, shifted));
  }

  function getNationalShift(party) {
    let shift = 0;

    if (appState.national.incumbent_candidate === "yes" && appState.national.incumbent_party === party) {
      shift += rule("incumbency_shift", 0);
    }

    const pvDivisor = rule("popular_vote_divisor", 1);
    if (pvDivisor) {
      shift += num(appState.national[`${party}_pv_lead`]) / pvDivisor;
    }

    shift -= num(appState.national[`${party}_debuff`]);

    shift += num(appState.national[`${party}_debate`]) * rule("debate_shift", 0);

    if (appState.national.incumbent_party === party) {
      const approvalDivisor = rule("approval_divisor", 1);
      if (approvalDivisor) {
        shift += num(appState.national.approval_gap) / approvalDivisor;
      }
    }

    return shift;
  }

  function getCampaignShift(party, abbr) {
    return num(appState.campaign[abbr]?.[party]) * rule("campaign_point_shift", 0);
  }

  function calculateState(abbr) {
    const base = getBaseline(abbr);
    if (!base) return null;

    let dnc = base.base_dnc;
    let gop = base.base_gop;
    let other = base.base_other;

    dnc += getNationalShift("dnc");
    gop += getNationalShift("gop");
    other += getNationalShift("other");

    dnc += getExperienceShift("dnc");
    gop += getExperienceShift("gop");
    other += getExperienceShift("other");

    dnc += getLobbyShift("dnc", abbr);
    gop += getLobbyShift("gop", abbr);
    other += getLobbyShift("other", abbr);

    dnc += getIdeologyShift("dnc", base);
    gop += getIdeologyShift("gop", base);
    other += getIdeologyShift("other", base);

    dnc += getCampaignShift("dnc", abbr);
    gop += getCampaignShift("gop", abbr);
    other += getCampaignShift("other", abbr);

    dnc = Math.max(0, dnc);
    gop = Math.max(0, gop);
    other = Math.max(0, other);

    const total = dnc + gop + other || 1;

    dnc = (dnc / total) * 100;
    gop = (gop / total) * 100;
    other = (other / total) * 100;

    const sorted = [
      { party: "dnc", pct: dnc },
      { party: "gop", pct: gop },
      { party: "other", pct: other }
    ].sort((a, b) => b.pct - a.pct);

    const autoWinner = sorted[0].party;
    const finalWinner = appState.manual[abbr] || autoWinner;

    return {
      state_abbr: abbr,
      ev: base.ev,
      dnc,
      gop,
      other,
      autoWinner,
      finalWinner,
      margin: sorted[0].pct - sorted[1].pct,
      leaderPct: sorted[0].pct,
      secondParty: sorted[1].party
    };
  }

  function calculateAll() {
    results = {};

    baselines.forEach((row) => {
      results[row.state_abbr] = calculateState(row.state_abbr);
    });

    renderTotals();
    renderMap();
    renderSelectedState();
    renderClosestStates();
    renderPathToVictory();
  }

  function getTotals() {
    const totals = { dnc: 0, gop: 0, other: 0 };

    Object.values(results).forEach((result) => {
      if (!result) return;
      totals[result.finalWinner] += num(result.ev);
    });

    return totals;
  }

  function setText(selectors, value) {
    selectors.forEach((selector) => {
      const element = $(selector);
      if (element) element.textContent = value;
    });
  }

  function renderTotals() {
    const totals = getTotals();

    setText(["#calc-dnc-ev", "#dnc-ev", "[data-calc-dnc-ev]"], totals.dnc);
    setText(["#calc-gop-ev", "#gop-ev", "[data-calc-gop-ev]"], totals.gop);
    setText(["#calc-other-ev", "#other-ev", "[data-calc-other-ev]"], totals.other);

    const winner =
      totals.dnc >= 270 ? "DNC" :
      totals.gop >= 270 ? "GOP" :
      totals.other >= 270 ? "OTHER" :
      totals.dnc > totals.gop && totals.dnc > totals.other ? "DNC LEADING" :
      totals.gop > totals.dnc && totals.gop > totals.other ? "GOP LEADING" :
      "NO MAJORITY";

    setText(["#calc-winner", "[data-calc-winner]"], winner);
    setText(["#calc-margin", "[data-calc-margin]"], Math.abs(totals.dnc - totals.gop));
  }

  function findMapContainer() {
    return (
      $("#calculator-map") ||
      $("#election-calculator-map") ||
      $("#calc-map") ||
      $("[data-calculator-map]") ||
      $(".calculator-map") ||
      $(".calc-map")
    );
  }

  function renderMap() {
    const container = findMapContainer();
    if (!container) return;

    container.classList.add("calc-sheet-map");

    const rows = baselines
      .map((row) => row.state_abbr)
      .sort()
      .map((abbr) => {
        const result = results[abbr];
        const winner = result?.finalWinner || "tossup";

        return `
          <button
            type="button"
            class="calc-state-button ${selectedState === abbr ? "is-selected" : ""} ${appState.manual[abbr] ? "is-manual" : ""}"
            data-state="${html(abbr)}"
            style="--state-color:${COLORS[winner] || COLORS.tossup};"
          >
            <strong>${html(abbr)}</strong>
            <span>${num(result?.ev)} EV</span>
            <em>${html(winner.toUpperCase())} +${result ? result.margin.toFixed(1) : "0.0"}</em>
          </button>
        `;
      })
      .join("");

    container.innerHTML = `
      <div class="calc-map-note">
        Sheet-driven state map. Add/edit states in <code>CALC_STATE_BASELINES</code>.
      </div>
      <div class="calc-state-button-grid">
        ${rows}
      </div>
    `;

    $$("[data-state]", container).forEach((button) => {
      button.addEventListener("click", () => {
        selectedState = button.dataset.state;
        cycleManual(selectedState);
      });
    });
  }

  function cycleManual(abbr) {
    const current = appState.manual[abbr];

    if (!current) appState.manual[abbr] = "dnc";
    else if (current === "dnc") appState.manual[abbr] = "gop";
    else if (current === "gop") appState.manual[abbr] = "other";
    else delete appState.manual[abbr];

    calculateAll();
  }

  function renderSelectedState() {
    const box = $("#selected-state-panel") || $("#calc-selected-state") || $("[data-selected-state]");
    if (!box) return;

    if (!selectedState || !results[selectedState]) {
      box.innerHTML = `
        <h3>Choose a State</h3>
        <p>Tap or click a state to view sheet baseline, final result, and EV allocation.</p>
      `;
      return;
    }

    const result = results[selectedState];
    const base = getBaseline(selectedState);

    box.innerHTML = `
      <h3>${html(selectedState)} — ${num(result.ev)} EV</h3>
      <p><b>Base:</b> DNC ${base.base_dnc}% / GOP ${base.base_gop}% / Other ${base.base_other}%</p>
      <p><b>Winner:</b> ${html(result.finalWinner.toUpperCase())} ${appState.manual[selectedState] ? "(manual)" : "(auto)"}</p>
      <p><b>DNC:</b> ${result.dnc.toFixed(1)}%</p>
      <p><b>GOP:</b> ${result.gop.toFixed(1)}%</p>
      <p><b>Other:</b> ${result.other.toFixed(1)}%</p>
      <p><b>Margin:</b> ${result.margin.toFixed(1)}%</p>
      <p class="text-small">Click again to cycle: DNC → GOP → Other → Auto.</p>
    `;
  }

  function renderClosestStates() {
    const box = $("#closest-states") || $("#calc-closest-states") || $("[data-closest-states]");
    if (!box) return;

    const rows = Object.values(results)
      .filter(Boolean)
      .sort((a, b) => a.margin - b.margin)
      .slice(0, 8);

    box.innerHTML = rows.map((result) => `
      <div class="calc-mini-row">
        <strong>${html(result.state_abbr)}</strong>
        <span>${html(result.finalWinner.toUpperCase())} +${result.margin.toFixed(1)} • ${num(result.ev)} EV</span>
      </div>
    `).join("");
  }

  function renderPathToVictory() {
    const box = $("#path-to-victory") || $("#calc-path-to-victory") || $("[data-path-to-victory]");
    if (!box) return;

    const totals = getTotals();

    box.innerHTML = ["dnc", "gop", "other"].map((party) => `
      <div class="calc-mini-row">
        <strong>${party.toUpperCase()}</strong>
        <span>${Math.max(0, 270 - totals[party])} EV needed</span>
      </div>
    `).join("");
  }

  function buildExperienceOptions() {
    const selects = $$("select").filter((select) => {
      const id = key(select.id);
      const name = key(select.name);
      return id.includes("experience") || name.includes("experience");
    });

    selects.forEach((select) => {
      const current = select.value;

      select.innerHTML = experiences.map((experience) => `
        <option value="${html(experience.id)}">${html(experience.label)}</option>
      `).join("");

      if (current) select.value = current;
    });
  }

  function injectLobbyPanel() {
    const host = $("#lobby-toggles") || $("#calc-lobbies") || $("[data-lobby-toggles]");
    if (!host) return;

    host.innerHTML = ["dnc", "gop", "other"].map((party) => `
      <div class="calc-lobby-party">
        <h4>${party.toUpperCase()} Lobbies</h4>
        ${lobbies.map((lobby) => `
          <label class="calc-check">
            <input type="checkbox" data-lobby-party="${party}" value="${html(lobby.id)}">
            <span>${html(lobby.name)} (+${lobby.shift})</span>
          </label>
        `).join("")}
      </div>
    `).join("");
  }

  function updateFromInput(element, shouldCalculate = true) {
    const id = key(element.id);
    const name = key(element.name);
    const label = key(element.closest("label")?.textContent || "");
    const joined = `${id} ${name} ${label}`;

    ["dnc", "gop", "other"].forEach((party) => {
      if (joined.includes(party) && joined.includes("name")) {
        appState.names[party] = element.value;
      }

      if (joined.includes(party) && joined.includes("experience")) {
        appState.experience[party] = element.value || "none";
      }

      ["progressive", "liberal", "conservative", "nationalist", "libertarian", "populist"].forEach((ideology) => {
        if (joined.includes(party) && joined.includes(ideology)) {
          appState.ideology[party][ideology] = num(element.value);
        }
      });

      if (joined.includes(party) && joined.includes("pv")) {
        appState.national[`${party}_pv_lead`] = num(element.value);
      }

      if (joined.includes(party) && joined.includes("debuff")) {
        appState.national[`${party}_debuff`] = num(element.value);
      }

      if (joined.includes(party) && joined.includes("debate")) {
        appState.national[`${party}_debate`] = num(element.value);
      }
    });

    if (joined.includes("incumbent") && joined.includes("party")) {
      appState.national.incumbent_party = key(element.value);
    }

    if (joined.includes("incumbent") && joined.includes("candidate")) {
      appState.national.incumbent_candidate = key(element.value);
    }

    if (joined.includes("approval")) {
      appState.national.approval_gap = num(element.value);
    }

    if (element.matches("[data-lobby-party]")) {
      const party = element.dataset.lobbyParty;

      if (element.checked && !appState.lobbies[party].includes(element.value)) {
        appState.lobbies[party].push(element.value);
      }

      if (!element.checked) {
        appState.lobbies[party] = appState.lobbies[party].filter((item) => item !== element.value);
      }
    }

    if (element.matches("[data-campaign-state][data-campaign-party]")) {
      const abbr = clean(element.dataset.campaignState).toUpperCase();
      const party = key(element.dataset.campaignParty);

      if (!appState.campaign[abbr]) {
        appState.campaign[abbr] = { dnc: 0, gop: 0, other: 0 };
      }

      appState.campaign[abbr][party] = num(element.value);
    }

    if (shouldCalculate) calculateAll();
  }

  function bindInputs() {
    document.addEventListener("input", (event) => {
      if (event.target.matches("input, select, textarea")) {
        updateFromInput(event.target);
      }
    });

    document.addEventListener("change", (event) => {
      if (event.target.matches("input, select, textarea")) {
        updateFromInput(event.target);
      }
    });
  }

  function bindButtons() {
    const save = $("#calc-save") || $("#save-local") || $("[data-save-local]");
    const exportButton = $("#calc-export") || $("#export-json") || $("[data-export-json]");
    const importButton = $("#calc-import") || $("#import-json") || $("[data-import-json]");
    const reset = $("#calc-reset") || $("#reset-calculator") || $("[data-reset-calculator]");

    save?.addEventListener("click", () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
      alert("Saved locally.");
    });

    exportButton?.addEventListener("click", async () => {
      const data = JSON.stringify(appState, null, 2);
      await navigator.clipboard?.writeText(data);
      alert("Calculator JSON copied to clipboard.");
    });

    importButton?.addEventListener("click", () => {
      const raw = prompt("Paste calculator JSON:");
      if (!raw) return;

      try {
        Object.assign(appState, JSON.parse(raw));
        calculateAll();
        alert("Imported.");
      } catch {
        alert("Invalid JSON.");
      }
    });

    reset?.addEventListener("click", () => {
      localStorage.removeItem(STORAGE_KEY);
      location.reload();
    });
  }

  function loadLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) Object.assign(appState, JSON.parse(raw));
    } catch {}
  }

  function injectStyles() {
    if ($("#sheet-calculator-style")) return;

    const style = document.createElement("style");
    style.id = "sheet-calculator-style";
    style.textContent = `
      .calc-sheet-map {
        min-height: 540px !important;
        padding: 18px !important;
        background: #07111f !important;
        overflow: auto !important;
      }

      .calc-map-note {
        color: #dbeafe;
        font-weight: 800;
        margin-bottom: 12px;
      }

      .calc-state-button-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(74px, 1fr));
        gap: 8px;
      }

      .calc-state-button {
        min-height: 70px;
        border-radius: 13px;
        border: 1px solid rgba(255,255,255,.18);
        background: color-mix(in srgb, var(--state-color, #64748b) 62%, #0f172a);
        color: white;
        cursor: pointer;
        display: grid;
        align-content: center;
        gap: 2px;
        padding: 8px;
      }

      .calc-state-button:hover,
      .calc-state-button.is-selected {
        outline: 3px solid rgba(255,255,255,.35);
      }

      .calc-state-button.is-manual {
        box-shadow: 0 0 0 3px rgba(250,204,21,.65);
      }

      .calc-state-button strong {
        font-size: 1rem;
      }

      .calc-state-button span,
      .calc-state-button em {
        font-size: .7rem;
        font-style: normal;
        opacity: .9;
      }

      .calc-mini-row {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        padding: 7px 0;
        border-bottom: 1px solid rgba(255,255,255,.12);
      }

      .calc-mini-row:last-child {
        border-bottom: 0;
      }

      .calc-check {
        display: flex;
        gap: 8px;
        align-items: center;
        padding: 6px 0;
        font-weight: 800;
      }

      .calc-lobby-party {
        margin-bottom: 14px;
      }

      .calc-lobby-party h4 {
        margin: 0 0 6px;
      }
    `;

    document.head.appendChild(style);
  }

  async function init() {
    try {
      injectStyles();
      loadLocal();
      await loadAllData();

      buildExperienceOptions();
      injectLobbyPanel();
      bindInputs();
      bindButtons();

      $$("input, select, textarea").forEach((element) => {
        updateFromInput(element, false);
      });

      calculateAll();

      console.log("Sheet-driven APRP calculator loaded:", {
        baselines,
        lobbies,
        experiences,
        rules,
        results
      });
    } catch (error) {
      console.error("Election calculator failed:", error);

      const container = findMapContainer() || $("#main") || document.body;

      container.innerHTML = `
        <div style="color:white;background:#7f1d1d;padding:24px;border-radius:18px;">
          <h3>Election calculator failed to load</h3>
          <p>${html(error.message || String(error))}</p>
        </div>
      `;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
