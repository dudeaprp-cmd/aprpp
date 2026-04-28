/* APRP Election Calculator — Fully Sheet/Input Driven
   Inputs are the ONLY way to change state leans/results.
   Clicking a state only selects/details it. No manual state cycling.
*/

(function () {
  "use strict";

  const PARTY_MAP = { left: "dnc", right: "gop", other: "other", dnc: "dnc", gop: "gop" };
  const DISPLAY = { dnc: "DNC", gop: "GOP", other: "Other" };
  const COLORS = { dnc: "#2563eb", gop: "#dc2626", other: "#7c3aed", tossup: "#64748b" };
  const STORAGE_KEY = "aprp_sheet_driven_election_calculator_v2";

  let baselines = [];
  let lobbies = [];
  let experiences = [];
  let rules = {};
  let results = {};
  let selectedState = "";
  let activeIdeologyParty = "dnc";
  let activeCampaignParty = "dnc";

  const appState = {
    names: { dnc: "Democratic Candidate", gop: "Republican Candidate", other: "Independent Candidate" },
    experience: { dnc: "none", gop: "none", other: "none" },
    lobbies: { dnc: [], gop: [], other: [] },
    ideology: {
      dnc: { progressive: 0, liberal: 0, conservative: 0, nationalist: 0, libertarian: 0, populist: 0 },
      gop: { progressive: 0, liberal: 0, conservative: 0, nationalist: 0, libertarian: 0, populist: 0 },
      other: { progressive: 0, liberal: 0, conservative: 0, nationalist: 0, libertarian: 0, populist: 0 }
    },
    national: {
      incumbent_party: "none",
      incumbent_candidate: "none",
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
    special: {
      dnc: { convention: "", vp: "", home: "" },
      gop: { convention: "", vp: "", home: "" },
      other: { convention: "", vp: "", home: "" }
    }
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  function clean(v) { return String(v ?? "").trim(); }
  function key(v) { return clean(v).toLowerCase(); }
  function num(v, fallback = 0) {
    const parsed = Number(clean(v).replace(/[$,%]/g, "").replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  function html(v) {
    return clean(v)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
  function partyFrom(value) {
    return PARTY_MAP[key(value)] || key(value) || "other";
  }

  async function loadSheet(name) {
    if (window.APRP?.fetchSheets) {
      const data = await window.APRP.fetchSheets([name]);
      return data?.[name] || [];
    }
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

    if (!baselines.length) throw new Error("CALC_STATE_BASELINES loaded, but no valid state rows were found.");

    baselines.forEach((row) => {
      if (!appState.campaign[row.state_abbr]) appState.campaign[row.state_abbr] = { dnc: 0, gop: 0, other: 0 };
    });
  }

  function normalizeRules(rows) {
    const out = {};
    rows.forEach((row) => {
      const k = key(row.key || row.rule || row.name);
      const v = num(row.value, NaN);
      if (k && Number.isFinite(v)) out[k] = v;
    });
    return out;
  }

  function rule(name, fallback = 0) {
    return num(rules[key(name)], fallback);
  }

  function normalizeExperiences(rows) {
    const out = rows.map((row) => ({
      id: key(row.experience_id || row.id || row.label).replace(/\s+/g, "_"),
      label: clean(row.label || row.experience_id || row.id),
      shift: num(row.shift, 0)
    })).filter((row) => row.id);

    if (!out.some((row) => row.id === "none")) out.unshift({ id: "none", label: "None", shift: 0 });
    return out;
  }

  function normalizeLobbies(rows) {
    return rows.map((row) => ({
      id: key(row.lobby_id || row.id || row.lobby_name || row.name).replace(/\s+/g, "_"),
      name: clean(row.lobby_name || row.name || row.lobby_id || row.id),
      shift: num(row.shift, 0),
      states: clean(row.states || "ALL").toUpperCase().split(/[,;/|]+/).map(clean).filter(Boolean)
    })).filter((row) => row.id && row.name);
  }

  function normalizeBaselines(rows) {
    return rows.map((row) => {
      const abbr = clean(row.state_abbr || row.state || row.abbr).toUpperCase();
      return {
        raw: row,
        state_abbr: abbr,
        state_name: clean(row.state_name || row.name || row.state || abbr),
        ev: num(row.ev, num(row.electors, num(row.electoral_votes, 0))),
        base_gop: num(row.base_gop, NaN),
        base_dnc: num(row.base_dnc, num(row.base_dem, NaN)),
        base_other: num(row.base_other, NaN),
        progressive: num(row.progressive, 1),
        liberal: num(row.liberal, 1),
        conservative: num(row.conservative, 1),
        nationalist: num(row.nationalist, 1),
        libertarian: num(row.libertarian, 1),
        populist: num(row.populist, 1)
      };
    }).filter((row) =>
      row.state_abbr &&
      Number.isFinite(row.base_gop) &&
      Number.isFinite(row.base_dnc) &&
      Number.isFinite(row.base_other)
    );
  }

  function getBaseline(abbr) {
    return baselines.find((row) => row.state_abbr === abbr);
  }

  function getExperienceShift(party) {
    return experiences.find((row) => row.id === appState.experience[party])?.shift || 0;
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

    if (appState.national.incumbent_candidate === party) shift += rule("incumbency_shift", 0);

    const pvDivisor = rule("popular_vote_divisor", 1);
    if (pvDivisor) shift += num(appState.national[`${party}_pv_lead`]) / pvDivisor;

    shift -= num(appState.national[`${party}_debuff`]);
    shift += num(appState.national[`${party}_debate`]) * rule("debate_shift", 0);

    if (appState.national.incumbent_party === party) {
      const approvalDivisor = rule("approval_divisor", 1);
      if (approvalDivisor) shift += num(appState.national.approval_gap) / approvalDivisor;
    }

    return shift;
  }

  function getCampaignShift(party, abbr) {
    let points = num(appState.campaign[abbr]?.[party]);

    if (appState.special[party]?.convention === abbr) points += rule("convention_bonus_points", 0);
    if (appState.special[party]?.vp === abbr) points += rule("vp_bonus_points", 0);
    if (appState.special[party]?.home === abbr) points += rule("home_state_bonus_points", 0);

    return points * rule("campaign_point_shift", 0);
  }

  function calculateState(abbr) {
    const base = getBaseline(abbr);
    if (!base) return null;

    let dnc = base.base_dnc;
    let gop = base.base_gop;
    let other = base.base_other;

    for (const party of ["dnc", "gop", "other"]) {
      const shift =
        getNationalShift(party) +
        getExperienceShift(party) +
        getLobbyShift(party, abbr) +
        getIdeologyShift(party, base) +
        getCampaignShift(party, abbr);

      if (party === "dnc") dnc += shift;
      if (party === "gop") gop += shift;
      if (party === "other") other += shift;
    }

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

    return {
      state_abbr: abbr,
      state_name: base.state_name,
      ev: base.ev,
      dnc,
      gop,
      other,
      finalWinner: sorted[0].party,
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
      if (result) totals[result.finalWinner] += num(result.ev);
    });
    return totals;
  }

  function setText(selectors, value) {
    selectors.forEach((selector) => {
      const el = $(selector);
      if (el) el.textContent = value;
    });
  }

  function renderTotals() {
    const totals = getTotals();

    setText(["#calc-left-ev", "#calc-dnc-ev", "#dnc-ev", "[data-calc-dnc-ev]"], totals.dnc);
    setText(["#calc-right-ev", "#calc-gop-ev", "#gop-ev", "[data-calc-gop-ev]"], totals.gop);
    setText(["#calc-other-ev", "#other-ev", "[data-calc-other-ev]"], totals.other);

    const winner =
      totals.dnc >= 270 ? "DNC WINS" :
      totals.gop >= 270 ? "GOP WINS" :
      totals.other >= 270 ? "OTHER WINS" :
      totals.dnc > totals.gop && totals.dnc > totals.other ? "DNC LEADING" :
      totals.gop > totals.dnc && totals.gop > totals.other ? "GOP LEADING" :
      totals.other > totals.dnc && totals.other > totals.gop ? "OTHER LEADING" :
      "NO MAJORITY";

    setText(["#calc-winner", "[data-calc-winner]"], winner);
    setText(["#calc-margin", "[data-calc-margin]"], Math.abs(totals.dnc - totals.gop));
  }

  function findMapContainer() {
    return $("#calculator-map") || $("#election-calculator-map") || $("#calc-map") || $("[data-calculator-map]") || $(".calculator-map") || $(".calc-map");
  }

  function renderMap() {
    const container = findMapContainer();
    if (!container) return;

    container.classList.add("calc-sheet-map");

    const rows = baselines.map((row) => row.state_abbr).sort().map((abbr) => {
      const result = results[abbr];
      const winner = result?.finalWinner || "tossup";

      return `
        <button
          type="button"
          class="calc-state-button ${selectedState === abbr ? "is-selected" : ""}"
          data-state="${html(abbr)}"
          style="--state-color:${COLORS[winner] || COLORS.tossup};"
        >
          <strong>${html(abbr)}</strong>
          <span>${num(result?.ev)} EV</span>
          <em>${html(DISPLAY[winner] || "Tossup")} +${result ? result.margin.toFixed(1) : "0.0"}</em>
        </button>
      `;
    }).join("");

    container.innerHTML = `
      <div class="calc-map-note">
        Click states only to inspect. State winners are calculated from sheet baselines + form inputs.
      </div>
      <div class="calc-state-button-grid">${rows}</div>
    `;

    $$("[data-state]", container).forEach((button) => {
      button.addEventListener("click", () => {
        selectedState = button.dataset.state;
        renderMap();
        renderSelectedState();
      });
    });
  }

  function renderSelectedState() {
    const box = $("#calc-selected-state") || $("#selected-state-panel") || $("[data-selected-state]");
    if (!box) return;

    if (!selectedState || !results[selectedState]) {
      box.innerHTML = `<h3>Choose a State</h3><p>Tap or click a state to view its calculated result.</p>`;
      return;
    }

    const result = results[selectedState];
    const base = getBaseline(selectedState);

    box.innerHTML = `
      <h3>${html(selectedState)} — ${num(result.ev)} EV</h3>
      <p><b>Base:</b> DNC ${base.base_dnc}% / GOP ${base.base_gop}% / Other ${base.base_other}%</p>
      <p><b>Winner:</b> ${html(DISPLAY[result.finalWinner])}</p>
      <p><b>DNC:</b> ${result.dnc.toFixed(1)}%</p>
      <p><b>GOP:</b> ${result.gop.toFixed(1)}%</p>
      <p><b>Other:</b> ${result.other.toFixed(1)}%</p>
      <p><b>Margin:</b> ${result.margin.toFixed(1)}%</p>
      <p class="text-small">State clicks do not alter results. Use inputs only.</p>
    `;
  }

  function renderClosestStates() {
    const box = $("#calc-closest-states") || $("#closest-states") || $("[data-closest-states]");
    if (!box) return;

    box.innerHTML = Object.values(results).filter(Boolean).sort((a, b) => a.margin - b.margin).slice(0, 8).map((r) => `
      <div class="result-row calc-mini-row">
        <span>${html(r.state_abbr)}</span>
        <strong>${html(DISPLAY[r.finalWinner])} +${r.margin.toFixed(1)} • ${num(r.ev)} EV</strong>
      </div>
    `).join("");
  }

  function renderPathToVictory() {
    const box = $("#calc-path-to-victory") || $("#path-to-victory") || $("[data-path-to-victory]");
    if (!box) return;

    const totals = getTotals();
    box.innerHTML = ["dnc", "gop", "other"].map((party) => `
      <div class="result-row calc-mini-row">
        <span>${html(DISPLAY[party])}</span>
        <strong>${Math.max(0, 270 - totals[party])} EV needed</strong>
      </div>
    `).join("");
  }

  function buildExperienceOptions() {
    $$("[data-calc-experience], select[id*='experience']").forEach((select) => {
      const current = select.value || "none";
      select.innerHTML = experiences.map((exp) => `<option value="${html(exp.id)}">${html(exp.label)}</option>`).join("");
      select.value = experiences.some((e) => e.id === current) ? current : "none";
    });
  }

  function buildStateSelects() {
    $$("[data-special-state]").forEach((select) => {
      select.innerHTML = `<option value="">None</option>` + baselines.map((row) => `
        <option value="${html(row.state_abbr)}">${html(row.state_abbr)} — ${html(row.state_name)}</option>
      `).join("");
    });
  }

  function renderLobbyPanel() {
    const host = $("#calc-lobby-list") || $("#lobby-toggles") || $("#calc-lobbies") || $("[data-lobby-toggles]");
    if (!host) return;

    host.innerHTML = ["dnc", "gop", "other"].map((party) => `
      <div class="calc-lobby-party">
        <h4>${html(DISPLAY[party])} Lobbies</h4>
        ${lobbies.length ? lobbies.map((lobby) => `
          <label class="calc-check">
            <input type="checkbox" data-lobby-party="${party}" value="${html(lobby.id)}">
            <span>${html(lobby.name)} (${lobby.shift >= 0 ? "+" : ""}${lobby.shift})</span>
          </label>
        `).join("") : `<p class="text-small">No lobby rows found.</p>`}
      </div>
    `).join("");
  }

  function renderCampaignList() {
    const host = $("#calc-state-campaign-list");
    if (!host) return;

    host.innerHTML = baselines.map((row) => `
      <div class="state-campaign-item">
        <div>
          <strong>${html(row.state_abbr)} — ${html(row.state_name)}</strong>
          <span>${html(DISPLAY[activeCampaignParty])} campaign points</span>
        </div>
        <input
          type="number"
          step="0.1"
          value="${num(appState.campaign[row.state_abbr]?.[activeCampaignParty])}"
          data-campaign-state="${html(row.state_abbr)}"
          data-campaign-party="${html(activeCampaignParty)}"
        />
      </div>
    `).join("");
  }

  function syncIdeologyControls() {
    $$("[data-ideology]").forEach((input) => {
      const ideology = input.dataset.ideology;
      const value = num(appState.ideology[activeIdeologyParty]?.[ideology]);
      input.value = value;
      const output = input.closest(".ideology-control")?.querySelector("output");
      if (output) output.textContent = value;
    });
  }

  function setupTabs() {
    $$("[data-ideology-candidate]").forEach((button) => {
      button.addEventListener("click", () => {
        activeIdeologyParty = partyFrom(button.dataset.ideologyCandidate);
        $$("[data-ideology-candidate]").forEach((b) => b.classList.remove("is-active"));
        button.classList.add("is-active");
        syncIdeologyControls();
      });
    });

    $$("[data-campaign-candidate]").forEach((button) => {
      button.addEventListener("click", () => {
        activeCampaignParty = partyFrom(button.dataset.campaignCandidate);
        $$("[data-campaign-candidate]").forEach((b) => b.classList.remove("is-active"));
        button.classList.add("is-active");
        renderCampaignList();
      });
    });
  }

  function updateFromInput(element, shouldCalculate = true) {
    if (element.matches("[data-calc-name]")) {
      appState.names[partyFrom(element.dataset.calcName)] = element.value;
    }

    if (element.matches("[data-calc-experience]")) {
      appState.experience[partyFrom(element.dataset.calcExperience)] = element.value || "none";
    }

    if (element.matches("[data-calc-pv]")) {
      appState.national[`${partyFrom(element.dataset.calcPv)}_pv_lead`] = num(element.value);
    }

    if (element.matches("[data-calc-debuff]")) {
      appState.national[`${partyFrom(element.dataset.calcDebuff)}_debuff`] = num(element.value);
    }

    if (element.matches("[data-calc-debates]")) {
      appState.national[`${partyFrom(element.dataset.calcDebates)}_debate`] = num(element.value);
    }

    if (element.id === "calc-incumbent-party") {
      appState.national.incumbent_party = partyFrom(element.value || "none");
    }

    if (element.id === "calc-incumbent-candidate") {
      appState.national.incumbent_candidate = partyFrom(element.value || "none");
    }

    if (element.id && key(element.id).includes("approval")) {
      appState.national.approval_gap = num(element.value);
    }

    if (element.matches("[data-lobby-party]")) {
      const party = partyFrom(element.dataset.lobbyParty);
      if (element.checked && !appState.lobbies[party].includes(element.value)) appState.lobbies[party].push(element.value);
      if (!element.checked) appState.lobbies[party] = appState.lobbies[party].filter((item) => item !== element.value);
    }

    if (element.matches("[data-ideology]")) {
      const ideology = element.dataset.ideology;
      appState.ideology[activeIdeologyParty][ideology] = num(element.value);
      const output = element.closest(".ideology-control")?.querySelector("output");
      if (output) output.textContent = element.value;
    }

    if (element.matches("[data-campaign-state][data-campaign-party]")) {
      const abbr = clean(element.dataset.campaignState).toUpperCase();
      const party = partyFrom(element.dataset.campaignParty);
      if (!appState.campaign[abbr]) appState.campaign[abbr] = { dnc: 0, gop: 0, other: 0 };
      appState.campaign[abbr][party] = num(element.value);
    }

    if (element.matches("[data-special-state]")) {
      const type = element.dataset.specialState;
      appState.special[activeCampaignParty][type] = clean(element.value).toUpperCase();
    }

    if (shouldCalculate) calculateAll();
  }

  function bindInputs() {
    document.addEventListener("input", (event) => {
      if (event.target.matches("input, select, textarea")) updateFromInput(event.target);
    });

    document.addEventListener("change", (event) => {
      if (event.target.matches("input, select, textarea")) updateFromInput(event.target);
    });
  }

  function bindButtons() {
    ($("#calc-save-button") || $("#calc-save") || $("#save-local") || $("[data-save-local]"))?.addEventListener("click", () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
      alert("Saved locally.");
    });

    ($("#calc-export-button") || $("#calc-export") || $("#export-json") || $("[data-export-json]"))?.addEventListener("click", async () => {
      const data = JSON.stringify(appState, null, 2);
      if (navigator.clipboard) await navigator.clipboard.writeText(data);
      alert("Calculator JSON copied to clipboard.");
    });

    ($("#calc-import-button") || $("#calc-import") || $("#import-json") || $("[data-import-json]"))?.addEventListener("click", () => {
      const raw = prompt("Paste calculator JSON:");
      if (!raw) return;
      try {
        Object.assign(appState, JSON.parse(raw));
        renderCampaignList();
        syncIdeologyControls();
        calculateAll();
        alert("Imported.");
      } catch {
        alert("Invalid JSON.");
      }
    });

    ($("#calc-reset-button") || $("#calc-reset") || $("#reset-calculator") || $("[data-reset-calculator]"))?.addEventListener("click", () => {
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
        font-weight: 850;
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
      .calc-state-button strong { font-size: 1rem; }
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
      .calc-mini-row:last-child { border-bottom: 0; }
      .calc-check {
        display: flex;
        gap: 8px;
        align-items: center;
        padding: 6px 0;
        font-weight: 800;
      }
      .calc-lobby-party { margin-bottom: 14px; }
      .calc-lobby-party h4 { margin: 0 0 6px; }
    `;

    document.head.appendChild(style);
  }

  async function init() {
    try {
      injectStyles();
      loadLocal();
      await loadAllData();

      buildExperienceOptions();
      buildStateSelects();
      renderLobbyPanel();
      renderCampaignList();
      setupTabs();
      bindInputs();
      bindButtons();

      $$("input, select, textarea").forEach((element) => updateFromInput(element, false));

      syncIdeologyControls();
      calculateAll();

      console.log("APRP input-only calculator loaded:", { baselines, lobbies, experiences, rules, results });
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

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
