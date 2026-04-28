/* APRP Election Calculator — Full Working Rewrite
   Requires:
   - sheets.js before this file
   - Mapbox loaded on calculator page
   - CALC_STATE_BASELINES
   - CALC_LOBBIES
   - CALC_EXPERIENCE or CALC_EXPERIANCE
   - CALC_RULES
*/

(function () {
  "use strict";

  const DEFAULT_RULES = {
    campaign_point_shift: 0.5,
    convention_points: 3,
    vp_points: 2,
    home_state_points: 3,
    debate_shift: 2.5,
    incumbency_shift: 1.5,
    primary_unopposed_shift: 1,
    primary_80plus_shift: 0.5,
    popular_vote_divisor: 5,
    approval_divisor: 10,
    ideology_base_points: 20,
    ideology_points_per_lobby: 10,
    ideology_shift_divisor: 40,
    ideology_shift_cap: 5
  };

  const STATE_ELECTORS_2012 = {
    AL: 9, AK: 3, AZ: 11, AR: 6, CA: 55, CO: 9, CT: 7, DE: 3, DC: 3,
    FL: 29, GA: 16, HI: 4, ID: 4, IL: 20, IN: 11, IA: 6, KS: 6, KY: 8,
    LA: 8, ME: 4, MD: 10, MA: 11, MI: 16, MN: 10, MS: 6, MO: 10, MT: 3,
    NE: 5, NV: 6, NH: 4, NJ: 14, NM: 5, NY: 29, NC: 15, ND: 3, OH: 18,
    OK: 7, OR: 7, PA: 20, RI: 4, SC: 9, SD: 3, TN: 11, TX: 38, UT: 6,
    VT: 3, VA: 13, WA: 12, WV: 5, WI: 10, WY: 3
  };

  const STATE_ORDER = [
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI",
    "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN",
    "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH",
    "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA",
    "WV", "WI", "WY"
  ];

  const PARTY_COLORS = {
    dnc: "#2563eb",
    gop: "#dc2626",
    other: "#7c3aed",
    tossup: "#64748b"
  };

  const STORAGE_KEY = "aprp_election_calculator_v2";

  let map = null;
  let mapReady = false;
  let stateRows = [];
  let lobbyRows = [];
  let experienceRows = [];
  let ideologyRows = [];
  let rules = { ...DEFAULT_RULES };
  let results = {};
  let selectedState = null;

  const state = {
    candidates: {
      dnc: {
        name: "Democratic Candidate",
        experience: "none",
        lobbies: [],
        ideology: {
          progressive: 0,
          liberal: 0,
          conservative: 0,
          nationalist: 0,
          libertarian: 0,
          populist: 0
        },
        debateWins: 0,
        primary: "none"
      },
      gop: {
        name: "Republican Candidate",
        experience: "none",
        lobbies: [],
        ideology: {
          progressive: 0,
          liberal: 0,
          conservative: 0,
          nationalist: 0,
          libertarian: 0,
          populist: 0
        },
        debateWins: 0,
        primary: "none"
      },
      other: {
        name: "Independent Candidate",
        experience: "none",
        lobbies: [],
        ideology: {
          progressive: 0,
          liberal: 0,
          conservative: 0,
          nationalist: 0,
          libertarian: 0,
          populist: 0
        },
        debateWins: 0,
        primary: "none"
      }
    },

    national: {
      incumbentParty: "none",
      incumbentCandidate: "no",
      dncPvLead: 0,
      gopPvLead: 0,
      otherPvLead: 0,
      dncDebuff: 0,
      gopDebuff: 0,
      otherDebuff: 0,
      approvalGap: 0
    },

    campaignPoints: {},
    manualCalls: {}
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function clean(value) {
    return String(value ?? "").trim();
  }

  function toNumber(value, fallback = 0) {
    const raw = clean(value).replace(/[$,%]/g, "").replace(/,/g, "");
    if (!raw) return fallback;

    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function safeHTML(value) {
    return clean(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function loadSheet(name) {
    if (window.APRP && typeof window.APRP.fetchSheet === "function") {
      return window.APRP.fetchSheet(name);
    }

    if (window.APRP && typeof window.APRP.loadSheet === "function") {
      return window.APRP.loadSheet(name);
    }

    if (window.APRP_SHEETS && typeof window.APRP_SHEETS.loadSheet === "function") {
      return window.APRP_SHEETS.loadSheet(name);
    }

    throw new Error("No sheet loader found. Check sheets.js is loaded before election-calculator.js.");
  }

  async function loadCalculatorData() {
    const [baselines, lobbies, rulesData] = await Promise.all([
      loadSheet("CALC_STATE_BASELINES"),
      loadSheet("CALC_LOBBIES"),
      loadSheet("CALC_RULES")
    ]);

    let experience = [];
    try {
      experience = await loadSheet("CALC_EXPERIENCE");
    } catch {
      experience = await loadSheet("CALC_EXPERIANCE");
    }

    stateRows = normalizeBaselines(baselines);
    lobbyRows = normalizeLobbies(lobbies);
    experienceRows = normalizeExperience(experience);
    rules = normalizeRules(rulesData);

    ideologyRows = stateRows.map((row, index) => ({
      state_abbr: row.state_abbr,
      base_other: toNumber(row.base_other, Math.max(0, 100 - row.base_gop - row.base_dem)),
      progressive: toNumber(row.progressive, 1),
      liberal: toNumber(row.liberal, 1),
      conservative: toNumber(row.conservative, 1),
      nationalist: toNumber(row.nationalist, 1),
      libertarian: toNumber(row.libertarian, 1),
      populist: toNumber(row.populist, 1),
      _index: index
    }));

    STATE_ORDER.forEach((abbr) => {
      if (!state.campaignPoints[abbr]) {
        state.campaignPoints[abbr] = { dnc: 0, gop: 0, other: 0 };
      }
    });
  }

  function normalizeRules(rows) {
    const out = { ...DEFAULT_RULES };

    rows.forEach((row) => {
      const key = clean(row.key).toLowerCase();
      const value = toNumber(row.value, NaN);

      if (key && Number.isFinite(value)) {
        out[key] = value;
      }
    });

    return out;
  }

  function normalizeBaselines(rows) {
    return rows
      .filter((row) => clean(row.state_abbr))
      .map((row, index) => {
        const abbr = clean(row.state_abbr).toUpperCase();

        return {
          ...row,
          state_abbr: abbr,
          base_gop: toNumber(row.base_gop, 0),
          base_dem: toNumber(row.base_dem, 0),
          base_dnc: toNumber(row.base_dnc, toNumber(row.base_dem, 0)),
          base_other: toNumber(row.base_other, Math.max(0, 100 - toNumber(row.base_gop, 0) - toNumber(row.base_dem, 0))),
          ev: toNumber(row.ev, STATE_ELECTORS_2012[abbr] || 0),
          _index: index
        };
      })
      .filter((row) => STATE_ELECTORS_2012[row.state_abbr] !== undefined);
  }

  function normalizeLobbies(rows) {
    return rows
      .filter((row) => clean(row.lobby_id) || clean(row.lobby_name))
      .map((row) => ({
        id: clean(row.lobby_id || row.id || row.lobby_name).toLowerCase().replace(/\s+/g, "_"),
        name: clean(row.lobby_name || row.name || row.lobby_id),
        shift: toNumber(row.shift, 0),
        states: clean(row.states || "ALL")
          .toUpperCase()
          .split(",")
          .map((item) => clean(item))
          .filter(Boolean)
      }));
  }

  function normalizeExperience(rows) {
    const base = rows
      .filter((row) => clean(row.experience_id) || clean(row.label))
      .map((row) => ({
        id: clean(row.experience_id || row.id || row.label).toLowerCase().replace(/\s+/g, "_"),
        label: clean(row.label || row.experience_id || row.id),
        shift: toNumber(row.shift, 0)
      }));

    if (!base.some((row) => row.id === "none")) {
      base.unshift({ id: "none", label: "None", shift: 0 });
    }

    return base;
  }

  function getBaseline(abbr) {
    return stateRows.find((row) => row.state_abbr === abbr);
  }

  function getIdeologyRow(abbr) {
    return ideologyRows.find((row) => row.state_abbr === abbr);
  }

  function getExperienceShift(candidateKey) {
    const id = state.candidates[candidateKey].experience;
    const found = experienceRows.find((row) => row.id === id);
    return found ? found.shift : 0;
  }

  function lobbyApplies(lobby, abbr) {
    return lobby.states.includes("ALL") || lobby.states.includes(abbr);
  }

  function getLobbyShift(candidateKey, abbr) {
    const selected = state.candidates[candidateKey].lobbies;

    return lobbyRows.reduce((sum, lobby) => {
      if (!selected.includes(lobby.id)) return sum;
      if (!lobbyApplies(lobby, abbr)) return sum;
      return sum + lobby.shift;
    }, 0);
  }

  function getIdeologyShift(candidateKey, abbr) {
    const candidate = state.candidates[candidateKey];
    const row = getIdeologyRow(abbr);

    if (!row) return 0;

    const ideology = candidate.ideology;
    const raw =
      toNumber(ideology.progressive) * toNumber(row.progressive, 1) +
      toNumber(ideology.liberal) * toNumber(row.liberal, 1) +
      toNumber(ideology.conservative) * toNumber(row.conservative, 1) +
      toNumber(ideology.nationalist) * toNumber(row.nationalist, 1) +
      toNumber(ideology.libertarian) * toNumber(row.libertarian, 1) +
      toNumber(ideology.populist) * toNumber(row.populist, 1);

    const shifted = raw / toNumber(rules.ideology_shift_divisor, 40);
    const cap = toNumber(rules.ideology_shift_cap, 5);

    return Math.max(-cap, Math.min(cap, shifted));
  }

  function getCampaignShift(candidateKey, abbr) {
    const points = toNumber(state.campaignPoints[abbr]?.[candidateKey], 0);
    return points * toNumber(rules.campaign_point_shift, 0.5);
  }

  function getNationalShift(candidateKey) {
    let shift = 0;

    if (state.national.incumbentCandidate === "yes") {
      if (state.national.incumbentParty === candidateKey) {
        shift += toNumber(rules.incumbency_shift, 1.5);
      }
    }

    shift += toNumber(state.national[`${candidateKey}PvLead`], 0) / toNumber(rules.popular_vote_divisor, 5);
    shift -= toNumber(state.national[`${candidateKey}Debuff`], 0);

    shift += toNumber(state.candidates[candidateKey].debateWins, 0) * toNumber(rules.debate_shift, 2.5);

    if (state.candidates[candidateKey].primary === "unopposed") {
      shift += toNumber(rules.primary_unopposed_shift, 1);
    }

    if (state.candidates[candidateKey].primary === "80plus") {
      shift += toNumber(rules.primary_80plus_shift, 0.5);
    }

    if (state.national.incumbentParty === candidateKey) {
      shift += toNumber(state.national.approvalGap, 0) / toNumber(rules.approval_divisor, 10);
    }

    return shift;
  }

  function calculateState(abbr) {
    const baseline = getBaseline(abbr);

    if (!baseline) {
      return null;
    }

    const ev = STATE_ELECTORS_2012[abbr] || baseline.ev || 0;

    let dnc = baseline.base_dnc || baseline.base_dem || 0;
    let gop = baseline.base_gop || 0;
    let other = baseline.base_other || Math.max(0, 100 - dnc - gop);

    dnc += getNationalShift("dnc");
    gop += getNationalShift("gop");
    other += getNationalShift("other");

    dnc += getExperienceShift("dnc");
    gop += getExperienceShift("gop");
    other += getExperienceShift("other");

    dnc += getLobbyShift("dnc", abbr);
    gop += getLobbyShift("gop", abbr);
    other += getLobbyShift("other", abbr);

    dnc += getIdeologyShift("dnc", abbr);
    gop += getIdeologyShift("gop", abbr);
    other += getIdeologyShift("other", abbr);

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

    let winner = "dnc";
    let winnerPct = dnc;

    if (gop > winnerPct) {
      winner = "gop";
      winnerPct = gop;
    }

    if (other > winnerPct) {
      winner = "other";
      winnerPct = other;
    }

    const sorted = [
      { party: "dnc", pct: dnc },
      { party: "gop", pct: gop },
      { party: "other", pct: other }
    ].sort((a, b) => b.pct - a.pct);

    let finalWinner = winner;

    if (state.manualCalls[abbr]) {
      finalWinner = state.manualCalls[abbr];
    }

    return {
      state_abbr: abbr,
      ev,
      dnc,
      gop,
      other,
      winner,
      finalWinner,
      margin: sorted[0].pct - sorted[1].pct,
      leaderPct: sorted[0].pct,
      secondParty: sorted[1].party,
      secondPct: sorted[1].pct
    };
  }

  function calculateAll() {
    results = {};

    STATE_ORDER.forEach((abbr) => {
      const result = calculateState(abbr);

      if (result) {
        results[abbr] = result;
      }
    });

    updateTotals();
    updateMapColors();
    updateSelectedState();
    updateClosestStates();
    updatePathToVictory();
  }

  function getTotals() {
    const totals = { dnc: 0, gop: 0, other: 0 };

    Object.values(results).forEach((result) => {
      totals[result.finalWinner] += result.ev;
    });

    return totals;
  }

  function updateTotals() {
    const totals = getTotals();

    setTextAny(["#calc-dnc-ev", "#dnc-ev", "[data-calc-dnc-ev]"], totals.dnc);
    setTextAny(["#calc-gop-ev", "#gop-ev", "[data-calc-gop-ev]"], totals.gop);
    setTextAny(["#calc-other-ev", "#other-ev", "[data-calc-other-ev]"], totals.other);

    const winner = totals.dnc >= 270 ? "DNC" : totals.gop >= 270 ? "GOP" : totals.other >= 270 ? "OTHER" : "NO MAJORITY";
    const margin = Math.abs(totals.dnc - totals.gop);

    setTextAny(["#calc-winner", "[data-calc-winner]"], winner);
    setTextAny(["#calc-margin", "[data-calc-margin]"], margin);
  }

  function setTextAny(selectors, value) {
    selectors.forEach((selector) => {
      const el = $(selector);
      if (el) el.textContent = value;
    });
  }

  function updateMapColors() {
    if (!mapReady || !map || !map.getLayer("state-fills")) return;

    const expression = ["match", ["get", "abbr"]];

    STATE_ORDER.forEach((abbr) => {
      const result = results[abbr];
      const color = result ? PARTY_COLORS[result.finalWinner] : PARTY_COLORS.tossup;
      expression.push(abbr, color);
    });

    expression.push(PARTY_COLORS.tossup);

    map.setPaintProperty("state-fills", "fill-color", expression);
  }

  function initMap() {
    const container =
      $("#calculator-map") ||
      $("#election-calculator-map") ||
      $("#calc-map") ||
      $("[data-calculator-map]");

    if (!container) {
      console.warn("No calculator map container found.");
      return;
    }

    if (!window.mapboxgl) {
      container.innerHTML = `<div class="notice">Mapbox is not loaded. Check calculator HTML scripts.</div>`;
      return;
    }

    if (window.APRP_ENV?.MAPBOX_TOKEN) {
      window.mapboxgl.accessToken = window.APRP_ENV.MAPBOX_TOKEN;
    }

    map = new mapboxgl.Map({
      container,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [-98.5, 39.8],
      zoom: 3.05,
      attributionControl: true
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");

    map.on("load", () => {
      map.addSource("aprp-states", {
        type: "geojson",
        data: buildStateGeoJSON()
      });

      map.addLayer({
        id: "state-fills",
        type: "fill",
        source: "aprp-states",
        paint: {
          "fill-color": PARTY_COLORS.tossup,
          "fill-opacity": 0.72
        }
      });

      map.addLayer({
        id: "state-lines",
        type: "line",
        source: "aprp-states",
        paint: {
          "line-color": "#ffffff",
          "line-width": 1.2,
          "line-opacity": 0.65
        }
      });

      map.on("click", "state-fills", (event) => {
        const feature = event.features?.[0];
        const abbr = feature?.properties?.abbr;

        if (abbr) {
          selectedState = abbr;
          cycleManualState(abbr);
        }
      });

      map.on("mousemove", "state-fills", () => {
        map.getCanvas().style.cursor = "pointer";
      });

      map.on("mouseleave", "state-fills", () => {
        map.getCanvas().style.cursor = "";
      });

      mapReady = true;
      calculateAll();
    });
  }

  function buildStateGeoJSON() {
    const features = STATE_ORDER.map((abbr) => {
      const coords = roughStateBox(abbr);

      return {
        type: "Feature",
        properties: { abbr },
        geometry: {
          type: "Polygon",
          coordinates: [coords]
        }
      };
    });

    return {
      type: "FeatureCollection",
      features
    };
  }

  function roughStateBox(abbr) {
    const boxes = {
      WA: [-124.8, 45.5, -116.9, 49.1], OR: [-124.8, 42.0, -116.4, 46.3],
      CA: [-124.6, 32.4, -114.1, 42.1], ID: [-117.3, 42.0, -111.0, 49.1],
      NV: [-120.1, 35.0, -114.0, 42.1], AZ: [-114.9, 31.3, -109.0, 37.1],
      MT: [-116.1, 44.3, -104.0, 49.1], WY: [-111.1, 41.0, -104.0, 45.1],
      UT: [-114.1, 37.0, -109.0, 42.1], CO: [-109.1, 37.0, -102.0, 41.1],
      NM: [-109.1, 31.3, -103.0, 37.1], ND: [-104.1, 45.9, -96.5, 49.1],
      SD: [-104.1, 42.4, -96.4, 46.0], NE: [-104.1, 40.0, -95.3, 43.1],
      KS: [-102.1, 37.0, -94.6, 40.1], OK: [-103.1, 33.6, -94.4, 37.1],
      TX: [-106.7, 25.8, -93.5, 36.6], MN: [-97.3, 43.5, -89.4, 49.4],
      IA: [-96.7, 40.3, -90.1, 43.6], MO: [-95.8, 35.9, -89.1, 40.7],
      AR: [-94.7, 33.0, -89.6, 36.6], LA: [-94.1, 28.9, -88.8, 33.1],
      WI: [-92.9, 42.5, -86.7, 47.1], IL: [-91.6, 37.0, -87.0, 42.6],
      MI: [-90.5, 41.7, -82.1, 48.4], IN: [-88.1, 37.7, -84.7, 41.8],
      KY: [-89.6, 36.5, -81.9, 39.2], TN: [-90.4, 34.9, -81.6, 36.7],
      MS: [-91.7, 30.1, -88.1, 35.1], AL: [-88.5, 30.1, -84.9, 35.1],
      OH: [-84.9, 38.4, -80.5, 42.3], GA: [-85.7, 30.3, -80.8, 35.1],
      FL: [-87.7, 24.4, -80.0, 31.1], SC: [-83.4, 32.0, -78.5, 35.3],
      NC: [-84.4, 33.8, -75.4, 36.7], VA: [-83.8, 36.5, -75.2, 39.5],
      WV: [-82.7, 37.1, -77.7, 40.7], PA: [-80.6, 39.7, -74.6, 42.3],
      NY: [-79.8, 40.5, -71.8, 45.1], VT: [-73.5, 42.7, -71.4, 45.1],
      NH: [-72.6, 42.6, -70.6, 45.3], ME: [-71.2, 43.0, -66.8, 47.5],
      MA: [-73.6, 41.2, -69.8, 42.9], RI: [-71.9, 41.1, -71.0, 42.1],
      CT: [-73.8, 40.9, -71.7, 42.1], NJ: [-75.6, 38.9, -73.8, 41.4],
      DE: [-75.8, 38.4, -75.0, 39.9], MD: [-79.5, 37.8, -75.0, 39.8],
      DC: [-77.2, 38.75, -76.85, 39.05], AK: [-170, 52, -130, 71],
      HI: [-161, 18, -154, 23]
    };

    const b = boxes[abbr] || [-100, 40, -99, 41];
    const [w, s, e, n] = b;

    return [
      [w, s],
      [e, s],
      [e, n],
      [w, n],
      [w, s]
    ];
  }

  function cycleManualState(abbr) {
    const current = state.manualCalls[abbr];

    if (!current) {
      state.manualCalls[abbr] = "dnc";
    } else if (current === "dnc") {
      state.manualCalls[abbr] = "gop";
    } else if (current === "gop") {
      state.manualCalls[abbr] = "other";
    } else {
      delete state.manualCalls[abbr];
    }

    calculateAll();
  }

  function updateSelectedState() {
    const box =
      $("#selected-state-panel") ||
      $("#calc-selected-state") ||
      $("[data-selected-state]");

    if (!box) return;

    if (!selectedState || !results[selectedState]) {
      box.innerHTML = `
        <h3>Choose a State</h3>
        <p>Tap or click a state to view baseline lean, applied shifts, final result, and EV allocation.</p>
      `;
      return;
    }

    const r = results[selectedState];

    box.innerHTML = `
      <h3>${safeHTML(selectedState)} — ${r.ev} EV</h3>
      <p><strong>Winner:</strong> ${safeHTML(r.finalWinner.toUpperCase())}</p>
      <p><strong>DNC:</strong> ${r.dnc.toFixed(1)}%</p>
      <p><strong>GOP:</strong> ${r.gop.toFixed(1)}%</p>
      <p><strong>Other:</strong> ${r.other.toFixed(1)}%</p>
      <p><strong>Margin:</strong> ${r.margin.toFixed(1)}%</p>
      <p><strong>Manual:</strong> ${state.manualCalls[selectedState] ? state.manualCalls[selectedState].toUpperCase() : "Auto"}</p>
    `;
  }

  function updateClosestStates() {
    const box =
      $("#closest-states") ||
      $("#calc-closest-states") ||
      $("[data-closest-states]");

    if (!box) return;

    const closest = Object.values(results)
      .sort((a, b) => a.margin - b.margin)
      .slice(0, 8);

    box.innerHTML = closest
      .map((r) => `
        <div class="calc-mini-row">
          <strong>${safeHTML(r.state_abbr)}</strong>
          <span>${safeHTML(r.finalWinner.toUpperCase())} +${r.margin.toFixed(1)} • ${r.ev} EV</span>
        </div>
      `)
      .join("");
  }

  function updatePathToVictory() {
    const box =
      $("#path-to-victory") ||
      $("#calc-path-to-victory") ||
      $("[data-path-to-victory]");

    if (!box) return;

    const totals = getTotals();

    const rows = ["dnc", "gop", "other"].map((party) => {
      const needed = Math.max(0, 270 - totals[party]);
      return `
        <div class="calc-mini-row">
          <strong>${party.toUpperCase()}</strong>
          <span>${needed === 0 ? "At / above 270" : `${needed} EV needed`}</span>
        </div>
      `;
    });

    box.innerHTML = rows.join("");
  }

  function buildControls() {
    buildExperienceOptions();
    buildLobbyToggles();
    bindInputs();
    bindButtons();
    calculateAll();
  }

  function buildExperienceOptions() {
    const selects = $$("select").filter((select) => {
      const id = select.id.toLowerCase();
      const name = clean(select.name).toLowerCase();
      return id.includes("experience") || name.includes("experience");
    });

    selects.forEach((select) => {
      const current = select.value;

      select.innerHTML = experienceRows
        .map((row) => `<option value="${safeHTML(row.id)}">${safeHTML(row.label)}</option>`)
        .join("");

      if (current) select.value = current;
    });
  }

  function buildLobbyToggles() {
    const containers = [
      $("#lobby-toggles"),
      $("#calc-lobbies"),
      $("[data-lobby-toggles]")
    ].filter(Boolean);

    if (!containers.length) return;

    const html = ["dnc", "gop", "other"]
      .map((party) => `
        <div class="calc-lobby-party">
          <h4>${party.toUpperCase()} Lobbies</h4>
          ${lobbyRows.map((lobby) => `
            <label class="calc-check">
              <input type="checkbox" data-lobby-party="${party}" value="${safeHTML(lobby.id)}">
              <span>${safeHTML(lobby.name)} (+${lobby.shift})</span>
            </label>
          `).join("")}
        </div>
      `)
      .join("");

    containers.forEach((container) => {
      container.innerHTML = html;
    });
  }

  function bindInputs() {
    document.addEventListener("input", handleInput);
    document.addEventListener("change", handleInput);
  }

  function handleInput(event) {
    const el = event.target;
    if (!el) return;

    const id = clean(el.id).toLowerCase();
    const name = clean(el.name).toLowerCase();
    const key = id || name;

    if (key.includes("dnc") && key.includes("name")) state.candidates.dnc.name = el.value;
    if (key.includes("gop") && key.includes("name")) state.candidates.gop.name = el.value;
    if (key.includes("other") && key.includes("name")) state.candidates.other.name = el.value;

    if (key.includes("dnc") && key.includes("experience")) state.candidates.dnc.experience = el.value;
    if (key.includes("gop") && key.includes("experience")) state.candidates.gop.experience = el.value;
    if (key.includes("other") && key.includes("experience")) state.candidates.other.experience = el.value;

    ["dnc", "gop", "other"].forEach((party) => {
      ["progressive", "liberal", "conservative", "nationalist", "libertarian", "populist"].forEach((ideology) => {
        if (key.includes(party) && key.includes(ideology)) {
          state.candidates[party].ideology[ideology] = toNumber(el.value, 0);
        }
      });

      if (key.includes(party) && key.includes("pv")) {
        state.national[`${party}PvLead`] = toNumber(el.value, 0);
      }

      if (key.includes(party) && key.includes("debuff")) {
        state.national[`${party}Debuff`] = toNumber(el.value, 0);
      }

      if (key.includes(party) && key.includes("debate")) {
        state.candidates[party].debateWins = toNumber(el.value, 0);
      }

      if (key.includes(party) && key.includes("primary")) {
        state.candidates[party].primary = el.value;
      }
    });

    if (key.includes("incumbent") && key.includes("party")) {
      state.national.incumbentParty = el.value;
    }

    if (key.includes("incumbent") && key.includes("candidate")) {
      state.national.incumbentCandidate = el.value;
    }

    if (key.includes("approval")) {
      state.national.approvalGap = toNumber(el.value, 0);
    }

    if (el.matches("[data-lobby-party]")) {
      const party = el.dataset.lobbyParty;
      const id = el.value;

      if (el.checked) {
        if (!state.candidates[party].lobbies.includes(id)) {
          state.candidates[party].lobbies.push(id);
        }
      } else {
        state.candidates[party].lobbies = state.candidates[party].lobbies.filter((item) => item !== id);
      }
    }

    if (el.matches("[data-campaign-state][data-campaign-party]")) {
      const abbr = clean(el.dataset.campaignState).toUpperCase();
      const party = clean(el.dataset.campaignParty).toLowerCase();

      if (!state.campaignPoints[abbr]) {
        state.campaignPoints[abbr] = { dnc: 0, gop: 0, other: 0 };
      }

      state.campaignPoints[abbr][party] = toNumber(el.value, 0);
    }

    calculateAll();
  }

  function bindButtons() {
    $("#calc-save")?.addEventListener("click", saveLocal);
    $("#save-local")?.addEventListener("click", saveLocal);
    $("[data-save-local]")?.addEventListener("click", saveLocal);

    $("#calc-export")?.addEventListener("click", exportJSON);
    $("#export-json")?.addEventListener("click", exportJSON);
    $("[data-export-json]")?.addEventListener("click", exportJSON);

    $("#calc-import")?.addEventListener("click", importJSON);
    $("#import-json")?.addEventListener("click", importJSON);
    $("[data-import-json]")?.addEventListener("click", importJSON);

    $("#calc-reset")?.addEventListener("click", resetCalculator);
    $("#reset-calculator")?.addEventListener("click", resetCalculator);
    $("[data-reset-calculator]")?.addEventListener("click", resetCalculator);
  }

  function saveLocal() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    alert("Calculator saved locally.");
  }

  function loadLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw);
      Object.assign(state, parsed);
    } catch (error) {
      console.warn("Could not load local calculator state.", error);
    }
  }

  function exportJSON() {
    const payload = JSON.stringify(state, null, 2);
    navigator.clipboard?.writeText(payload);
    alert("Calculator JSON copied to clipboard.");
  }

  function importJSON() {
    const raw = prompt("Paste calculator JSON:");
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      Object.assign(state, parsed);
      calculateAll();
      alert("Calculator imported.");
    } catch {
      alert("Invalid calculator JSON.");
    }
  }

  function resetCalculator() {
    if (!confirm("Reset calculator inputs?")) return;
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  }

  function injectSupportStyles() {
    if ($("#calc-support-style")) return;

    const style = document.createElement("style");
    style.id = "calc-support-style";
    style.textContent = `
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
        display: grid;
        gap: 4px;
        margin-bottom: 14px;
      }

      .calc-lobby-party h4 {
        margin: 0 0 4px;
      }
    `;

    document.head.appendChild(style);
  }

  async function init() {
    try {
      injectSupportStyles();
      loadLocal();
      await loadCalculatorData();
      initMap();
      buildControls();
      calculateAll();

      console.log("Election calculator loaded:", {
        stateRows,
        lobbyRows,
        experienceRows,
        rules
      });
    } catch (error) {
      console.error("Election calculator failed:", error);

      const root = $("#calculator-root") || $("#election-calculator-root") || $("#main");
      if (root) {
        const warning = document.createElement("div");
        warning.className = "notice notice-error";
        warning.innerHTML = `
          <strong>Election calculator failed to load.</strong>
          <span>${safeHTML(error.message || String(error))}</span>
        `;
        root.prepend(warning);
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
