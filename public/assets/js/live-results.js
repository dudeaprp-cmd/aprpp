/* APRP Federal Archive — CNN-style Live Election Results
   Features:
   - Results map
   - Prediction/path-to-victory map
   - Poll closing time map
   - Turnout/reporting map
   - Smaller fixed state popup
*/

(function () {
  const {
    fetchSheets,
    cleanCell,
    toNumber,
    safeHTML,
  } = window.APRP;

  const MAPBOX_TOKEN = "YOUR_MAPBOX_TOKEN_HERE";

  const US_STATES_GEOJSON_URL =
    "https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json";

  const TOTAL_EV_FALLBACK = 538;
  const WIN_THRESHOLD_FALLBACK = 270;

  let map = null;
  let loadedGeoJSON = null;
  let currentRows = [];
  let currentConfig = {};
  let currentCandidates = {};
  let currentMapMode = "results";
  let predictionSelections = {};

  const STATE_NAME_TO_ABBR = {
    Alabama: "AL",
    Alaska: "AK",
    Arizona: "AZ",
    Arkansas: "AR",
    California: "CA",
    Colorado: "CO",
    Connecticut: "CT",
    Delaware: "DE",
    "District of Columbia": "DC",
    Florida: "FL",
    Georgia: "GA",
    Hawaii: "HI",
    Idaho: "ID",
    Illinois: "IL",
    Indiana: "IN",
    Iowa: "IA",
    Kansas: "KS",
    Kentucky: "KY",
    Louisiana: "LA",
    Maine: "ME",
    Maryland: "MD",
    Massachusetts: "MA",
    Michigan: "MI",
    Minnesota: "MN",
    Mississippi: "MS",
    Missouri: "MO",
    Montana: "MT",
    Nebraska: "NE",
    Nevada: "NV",
    "New Hampshire": "NH",
    "New Jersey": "NJ",
    "New Mexico": "NM",
    "New York": "NY",
    "North Carolina": "NC",
    "North Dakota": "ND",
    Ohio: "OH",
    Oklahoma: "OK",
    Oregon: "OR",
    Pennsylvania: "PA",
    "Rhode Island": "RI",
    "South Carolina": "SC",
    "South Dakota": "SD",
    Tennessee: "TN",
    Texas: "TX",
    Utah: "UT",
    Vermont: "VT",
    Virginia: "VA",
    Washington: "WA",
    "West Virginia": "WV",
    Wisconsin: "WI",
    Wyoming: "WY",
  };

  const STATE_NAMES = Object.fromEntries(
    Object.entries(STATE_NAME_TO_ABBR).map(([name, abbr]) => [abbr, name])
  );

  const EV_2012 = {
    AL: 9,
    AK: 3,
    AZ: 11,
    AR: 6,
    CA: 55,
    CO: 9,
    CT: 7,
    DE: 3,
    DC: 3,
    FL: 29,
    GA: 16,
    HI: 4,
    ID: 4,
    IL: 20,
    IN: 11,
    IA: 6,
    KS: 6,
    KY: 8,
    LA: 8,
    ME: 4,
    MD: 10,
    MA: 11,
    MI: 16,
    MN: 10,
    MS: 6,
    MO: 10,
    MT: 3,
    NE: 5,
    NV: 6,
    NH: 4,
    NJ: 14,
    NM: 5,
    NY: 29,
    NC: 15,
    ND: 3,
    OH: 18,
    OK: 7,
    OR: 7,
    PA: 20,
    RI: 4,
    SC: 9,
    SD: 3,
    TN: 11,
    TX: 38,
    UT: 6,
    VT: 3,
    VA: 13,
    WA: 12,
    WV: 5,
    WI: 10,
    WY: 3,
  };

  const PREDICTION_COLORS = {
    left: "#155eef",
    right: "#d71920",
    other: "#7c3aed",
    tossup: "#94a3b8",
    none: "#475569",
  };

  function getEl(selector) {
    return document.querySelector(selector);
  }

  function setText(selector, value) {
    const el = getEl(selector);
    if (el) el.textContent = value;
  }

  function configValue(rows, key, fallback = "") {
    const lowerKey = key.toLowerCase();

    const found = rows.find((row) => {
      return cleanCell(row.key || row.setting || row.name).toLowerCase() === lowerKey;
    });

    return cleanCell(found?.value ?? found?.val ?? found?.setting_value ?? found?.data ?? fallback);
  }

  function normalizeParty(value) {
    const party = cleanCell(value).toUpperCase();

    if (["D", "DEM", "DEMOCRAT", "DEMOCRATIC", "DNC", "LEFT"].includes(party)) return "DNC";
    if (["R", "REP", "REPUBLICAN", "GOP", "RIGHT"].includes(party)) return "GOP";
    if (["I", "IND", "INDEPENDENT", "OTHER"].includes(party)) return "OTHER";

    return party || "OTHER";
  }

  function sideFromParty(party) {
    const normalized = normalizeParty(party);

    if (normalized === "DNC") return "left";
    if (normalized === "GOP") return "right";

    return "other";
  }

  function parsePercent(value) {
    const n = toNumber(value, 0);

    if (!Number.isFinite(n)) return 0;

    return Math.max(0, Math.min(100, n));
  }

  function firstValue(row, keys, fallback = "") {
    for (const key of keys) {
      const value = cleanCell(row?.[key]);

      if (value !== "") return value;
    }

    return fallback;
  }

  function firstNumber(row, keys, fallback = 0) {
    for (const key of keys) {
      const raw = row?.[key];

      if (cleanCell(raw) !== "") {
        const n = toNumber(raw, fallback);

        if (Number.isFinite(n)) return n;
      }
    }

    return fallback;
  }

  function buildCandidates(rows) {
    const normalizedRows = rows.map((row) => {
      const party = normalizeParty(row.party);
      const side = cleanCell(row.side).toLowerCase() || sideFromParty(party);

      return {
        candidate_id: cleanCell(row.candidate_id || row.id || side),
        name:
          cleanCell(row.name || row.candidate || row.full_name) ||
          (side === "left"
            ? "Democratic Candidate"
            : side === "right"
              ? "Republican Candidate"
              : "Other"),
        short_name:
          cleanCell(row.short_name || row.label || row.name || row.candidate) ||
          (side === "left" ? "DNC" : side === "right" ? "GOP" : "Other"),
        party,
        side,
        color: cleanCell(row.color),
      };
    });

    const left =
      normalizedRows.find((c) => c.side === "left" || c.party === "DNC") || {
        candidate_id: "left",
        name: "Democratic Candidate",
        short_name: "DNC",
        party: "DNC",
        side: "left",
        color: "#155eef",
      };

    const right =
      normalizedRows.find((c) => c.side === "right" || c.party === "GOP") || {
        candidate_id: "right",
        name: "Republican Candidate",
        short_name: "GOP",
        party: "GOP",
        side: "right",
        color: "#d71920",
      };

    const other =
      normalizedRows.find((c) => c.side === "other") || {
        candidate_id: "other",
        name: "Other",
        short_name: "Other",
        party: "OTHER",
        side: "other",
        color: "#7c3aed",
      };

    left.color = left.color || "#155eef";
    right.color = right.color || "#d71920";
    other.color = other.color || "#7c3aed";

    return {
      left,
      right,
      other,
    };
  }

  function getStateAbbrFromRow(row) {
    const direct = cleanCell(row.state_abbr || row.abbr || row.code).toUpperCase();

    if (STATE_NAMES[direct]) return direct;

    const stateRaw = cleanCell(row.state || row.state_name || row.name);
    const upper = stateRaw.toUpperCase();

    if (STATE_NAMES[upper]) return upper;

    const found = STATE_NAME_TO_ABBR[stateRaw];

    if (found) return found;

    const foundCaseInsensitive = Object.entries(STATE_NAME_TO_ABBR).find(([name]) => {
      return name.toLowerCase() === stateRaw.toLowerCase();
    });

    return foundCaseInsensitive ? foundCaseInsensitive[1] : "";
  }

  function getRowEv(row, abbr) {
    const direct = firstNumber(row, ["ev", "electoral_votes", "electors", "electoral"], null);

    if (direct !== null && Number.isFinite(direct) && direct > 0) return direct;

    return EV_2012[abbr] || 0;
  }

  function calculateVotes(row) {
    const reportingPct = parsePercent(
      firstValue(row, [
        "reporting_pct",
        "reporting",
        "reporting_percent",
        "pct_reporting",
        "percent_reporting",
      ], 0)
    );

    const leftPct = parsePercent(
      firstValue(row, [
        "left_pct",
        "dem_pct",
        "dnc_pct",
        "democrat_pct",
        "democratic_pct",
        "blue_pct",
      ], 0)
    );

    const rightPct = parsePercent(
      firstValue(row, [
        "right_pct",
        "gop_pct",
        "rep_pct",
        "republican_pct",
        "red_pct",
      ], 0)
    );

    const otherPct = parsePercent(
      firstValue(row, [
        "other_pct",
        "ind_pct",
        "independent_pct",
      ], 0)
    );

    const baseTurnout = firstNumber(row, [
      "base_turnout",
      "turnout_base",
      "expected_turnout",
      "registered_voters",
      "population",
    ], 0);

    const countedVotesDirect = firstNumber(row, [
      "counted_votes",
      "total_votes",
      "votes_counted",
      "votes",
    ], null);

    const countedVotes =
      countedVotesDirect !== null && countedVotesDirect > 0
        ? countedVotesDirect
        : Math.round(baseTurnout * (reportingPct / 100));

    const leftVotesDirect = firstNumber(row, [
      "left_votes",
      "dem_votes",
      "dnc_votes",
      "democrat_votes",
      "democratic_votes",
      "blue_votes",
    ], null);

    const rightVotesDirect = firstNumber(row, [
      "right_votes",
      "gop_votes",
      "rep_votes",
      "republican_votes",
      "red_votes",
    ], null);

    const otherVotesDirect = firstNumber(row, [
      "other_votes",
      "ind_votes",
      "independent_votes",
    ], null);

    const leftVotes =
      leftVotesDirect !== null && leftVotesDirect > 0
        ? leftVotesDirect
        : Math.round(countedVotes * (leftPct / 100));

    const rightVotes =
      rightVotesDirect !== null && rightVotesDirect > 0
        ? rightVotesDirect
        : Math.round(countedVotes * (rightPct / 100));

    const otherVotes =
      otherVotesDirect !== null && otherVotesDirect > 0
        ? otherVotesDirect
        : Math.max(0, countedVotes - leftVotes - rightVotes);

    const totalVotes = leftVotes + rightVotes + otherVotes;

    return {
      reportingPct,
      countedVotes,
      leftVotes,
      rightVotes,
      otherVotes,
      totalVotes,
      leftPct: totalVotes ? (leftVotes / totalVotes) * 100 : leftPct,
      rightPct: totalVotes ? (rightVotes / totalVotes) * 100 : rightPct,
      otherPct: totalVotes ? (otherVotes / totalVotes) * 100 : otherPct,
    };
  }

  function determineLeader(votes) {
    const entries = [
      ["left", votes.leftVotes],
      ["right", votes.rightVotes],
      ["other", votes.otherVotes],
    ].sort((a, b) => b[1] - a[1]);

    const leader = entries[0][0];
    const runnerUp = entries[1][0];
    const marginVotes = entries[0][1] - entries[1][1];
    const marginPct = votes.totalVotes ? (marginVotes / votes.totalVotes) * 100 : 0;

    return {
      leader,
      runnerUp,
      marginVotes,
      marginPct,
    };
  }

  function determineCalled(votes, leaderInfo, row) {
    const manual = cleanCell(
      row.called_for ||
      row.call_for ||
      row.projected_for ||
      row.winner ||
      row.projected_winner
    ).toLowerCase();

    if (["left", "d", "dem", "dnc", "democrat", "democratic", "blue"].includes(manual)) {
      return {
        isCalled: true,
        calledFor: "left",
        reason: "Manual call",
      };
    }

    if (["right", "r", "rep", "gop", "republican", "red"].includes(manual)) {
      return {
        isCalled: true,
        calledFor: "right",
        reason: "Manual call",
      };
    }

    if (["other", "ind", "independent"].includes(manual)) {
      return {
        isCalled: true,
        calledFor: "other",
        reason: "Manual call",
      };
    }

    const reporting = votes.reportingPct;
    const lead = leaderInfo.marginPct;

    if (votes.totalVotes <= 0) {
      return {
        isCalled: false,
        calledFor: "",
        reason: "No results reported",
      };
    }

    if (reporting >= 99) {
      return {
        isCalled: true,
        calledFor: leaderInfo.leader,
        reason: "99% reporting",
      };
    }

    if (reporting >= 95 && lead >= 2) {
      return {
        isCalled: true,
        calledFor: leaderInfo.leader,
        reason: "95% reporting and 2% lead",
      };
    }

    if (reporting >= 90 && lead >= 3) {
      return {
        isCalled: true,
        calledFor: leaderInfo.leader,
        reason: "90% reporting and 3% lead",
      };
    }

    if (reporting >= 75 && lead >= 10) {
      return {
        isCalled: true,
        calledFor: leaderInfo.leader,
        reason: "75% reporting and 10% lead",
      };
    }

    return {
      isCalled: false,
      calledFor: "",
      reason: "Too early to call",
    };
  }

  function candidateForSide(side) {
    return currentCandidates[side] || {
      name: side,
      short_name: side,
      color: "#94a3b8",
    };
  }

  function ratingForRow(row) {
    if (!row || row.votes.totalVotes <= 0) {
      return {
        label: "No Data",
        strength: "none",
      };
    }

    const side = row.called.calledFor || row.leader.leader;
    const margin = row.leader.marginPct;
    const party =
      side === "left"
        ? currentCandidates.left.short_name
        : side === "right"
          ? currentCandidates.right.short_name
          : currentCandidates.other.short_name;

    if (row.called.isCalled) {
      return {
        label: `Called ${party}`,
        strength: "called",
      };
    }

    if (margin < 0.5) {
      return {
        label: "Tossup",
        strength: "tossup",
      };
    }

    if (margin < 3) {
      return {
        label: `Tilt ${party}`,
        strength: "tilt",
      };
    }

    if (margin < 8) {
      return {
        label: `Lean ${party}`,
        strength: "lean",
      };
    }

    if (margin < 15) {
      return {
        label: `Likely ${party}`,
        strength: "likely",
      };
    }

    return {
      label: `Solid ${party}`,
      strength: "solid",
    };
  }

  function resultColor(row) {
    if (!row || row.votes.totalVotes <= 0) return "#64748b";

    const leader = row.called.calledFor || row.leader.leader;
    const rating = ratingForRow(row);

    if (leader === "other") return "#7c3aed";
    if (rating.strength === "tossup") return "#94a3b8";

    if (leader === "left") {
      if (row.called.isCalled) return "#0b3fb3";
      if (rating.strength === "solid") return "#155eef";
      if (rating.strength === "likely") return "#3b82f6";
      if (rating.strength === "lean") return "#60a5fa";
      return "#bfdbfe";
    }

    if (leader === "right") {
      if (row.called.isCalled) return "#8b1117";
      if (rating.strength === "solid") return "#d71920";
      if (rating.strength === "likely") return "#ef4444";
      if (rating.strength === "lean") return "#fb7185";
      return "#fecaca";
    }

    return "#94a3b8";
  }

  function buildResultRows(rawRows) {
    return rawRows
      .map((row) => {
        const abbr = getStateAbbrFromRow(row);

        if (!abbr) return null;

        const votes = calculateVotes(row);
        const leader = determineLeader(votes);
        const called = determineCalled(votes, leader, row);
        const ev = getRowEv(row, abbr);

        const resultRow = {
          ...row,
          abbr,
          name: STATE_NAMES[abbr] || abbr,
          ev,
          votes,
          leader,
          called,
          notes: cleanCell(row.notes || row.summary),
          pollClose: cleanCell(
            row.poll_close ||
            row.poll_close_time ||
            row.close_time ||
            row.call_time ||
            row.call_time_set
          ),
        };

        resultRow.color = resultColor(resultRow);

        return resultRow;
      })
      .filter(Boolean);
  }

  function stateAbbrFromFeature(feature) {
    const name = feature?.properties?.name || feature?.properties?.NAME;

    return STATE_NAME_TO_ABBR[name] || "";
  }

  function rowForState(abbr) {
    return currentRows.find((row) => row.abbr === abbr);
  }

  function pollCloseColor(row) {
    const raw = cleanCell(row?.pollClose);

    if (!raw) return "#475569";

    const lower = raw.toLowerCase();

    if (lower.includes("7")) return "#1e3a8a";
    if (lower.includes("8")) return "#2563eb";
    if (lower.includes("9")) return "#7c3aed";
    if (lower.includes("10")) return "#b45309";
    if (lower.includes("11") || lower.includes("12")) return "#b91c1c";

    return "#0f766e";
  }

  function turnoutColor(row) {
    if (!row || row.votes.totalVotes <= 0) return "#374151";

    const reporting = row.votes.reportingPct;

    if (reporting >= 90) return "#0f766e";
    if (reporting >= 70) return "#14b8a6";
    if (reporting >= 50) return "#38bdf8";
    if (reporting >= 30) return "#64748b";
    if (reporting >= 10) return "#4b5563";

    return "#303846";
  }

  function predictionColor(abbr) {
    return PREDICTION_COLORS[predictionSelections[abbr] || "none"] || PREDICTION_COLORS.none;
  }

  function colorForMode(abbr) {
    const row = rowForState(abbr);

    if (currentMapMode === "prediction") return predictionColor(abbr);
    if (currentMapMode === "pollclose") return pollCloseColor(row);
    if (currentMapMode === "turnout") return turnoutColor(row);

    return row ? row.color : "#475569";
  }

  function enrichGeoJSON(geojson) {
    const copy = JSON.parse(JSON.stringify(geojson));

    copy.features = copy.features
      .map((feature) => {
        const abbr = stateAbbrFromFeature(feature);

        return {
          ...feature,
          properties: {
            ...feature.properties,
            abbr,
            color: colorForMode(abbr),
          },
        };
      })
      .filter((feature) => feature.properties.abbr);

    return copy;
  }

  async function loadStatesGeoJSON() {
    const response = await fetch(US_STATES_GEOJSON_URL, {
      cache: "force-cache",
    });

    if (!response.ok) {
      throw new Error(`State GeoJSON failed: ${response.status}`);
    }

    return response.json();
  }

  function updateMapData() {
    if (!map || !map.getSource("election-states") || !loadedGeoJSON) return;

    map.getSource("election-states").setData(enrichGeoJSON(loadedGeoJSON));
  }

  function calculateTotals(rows) {
    return rows.reduce(
      (acc, row) => {
        acc.leftVotes += row.votes.leftVotes;
        acc.rightVotes += row.votes.rightVotes;
        acc.otherVotes += row.votes.otherVotes;
        acc.totalVotes += row.votes.totalVotes;

        if (row.votes.reportingPct > 0) {
          acc.expectedVotes += row.votes.totalVotes / (row.votes.reportingPct / 100);
        } else {
          acc.expectedVotes += row.votes.totalVotes;
        }

        if (row.called.isCalled) {
          if (row.called.calledFor === "left") acc.leftEv += row.ev;
          if (row.called.calledFor === "right") acc.rightEv += row.ev;
          if (row.called.calledFor === "other") acc.otherEv += row.ev;
        }

        return acc;
      },
      {
        leftVotes: 0,
        rightVotes: 0,
        otherVotes: 0,
        totalVotes: 0,
        expectedVotes: 0,
        leftEv: 0,
        rightEv: 0,
        otherEv: 0,
      }
    );
  }

  function updatePredictionScore() {
    let left = 0;
    let right = 0;
    let other = 0;

    Object.entries(predictionSelections).forEach(([abbr, side]) => {
      const row = rowForState(abbr);
      const ev = row?.ev || EV_2012[abbr] || 0;

      if (side === "left") left += ev;
      if (side === "right") right += ev;
      if (side === "other") other += ev;
    });

    const text =
      other > 0
        ? `${currentCandidates.left.short_name} ${left} / ${currentCandidates.right.short_name} ${right} / OTH ${other}`
        : `${currentCandidates.left.short_name} ${left} / ${currentCandidates.right.short_name} ${right}`;

    setText("#prediction-score", text);
  }

  function updateScoreboard() {
    const rows = currentRows;
    const candidates = currentCandidates;
    const config = currentConfig;
    const totals = calculateTotals(rows);

    const totalEv = toNumber(config.total_ev, TOTAL_EV_FALLBACK) || TOTAL_EV_FALLBACK;
    const threshold = toNumber(config.win_threshold, WIN_THRESHOLD_FALLBACK) || WIN_THRESHOLD_FALLBACK;

    const leftPct = totals.totalVotes ? (totals.leftVotes / totals.totalVotes) * 100 : 0;
    const rightPct = totals.totalVotes ? (totals.rightVotes / totals.totalVotes) * 100 : 0;
    const reportingPct = totals.expectedVotes ? Math.min(100, (totals.totalVotes / totals.expectedVotes) * 100) : 0;

    setText("#live-title", config.title || "Live Election Results");
    setText("#side-race-title", config.subtitle || config.title || "Race Dashboard");
    setText("#left-name", candidates.left.short_name || candidates.left.name);
    setText("#right-name", candidates.right.short_name || candidates.right.name);
    setText("#left-ev", totals.leftEv.toLocaleString());
    setText("#right-ev", totals.rightEv.toLocaleString());
    setText("#left-pv", `${totals.leftVotes.toLocaleString()} votes • ${leftPct.toFixed(1)}%`);
    setText("#right-pv", `${totals.rightVotes.toLocaleString()} votes • ${rightPct.toFixed(1)}%`);
    setText("#win-threshold", threshold);
    setText("#reporting", `Reporting: ${reportingPct.toFixed(1)}%`);

    const calledCount = rows.filter((row) => row.called.isCalled).length;
    const uncalledCount = rows.length - calledCount;

    setText("#called-count", calledCount);
    setText("#uncalled-count", uncalledCount);
    setText("#side-called", calledCount);
    setText("#side-uncalled", uncalledCount);

    const leftBarPct = Math.max(0, Math.min(100, (totals.leftEv / totalEv) * 100));
    const rightBarPct = Math.max(0, Math.min(100, (totals.rightEv / totalEv) * 100));
    const thresholdPct = Math.max(0, Math.min(100, (threshold / totalEv) * 100));

    const bar = document.querySelector("#ev-bar");

    if (bar) {
      bar.innerHTML = `
        <div class="ev-fill left" style="width:${leftBarPct.toFixed(4)}%;"></div>
        <div class="ev-fill right" style="width:${rightBarPct.toFixed(4)}%;"></div>
        <div class="ev-threshold" style="left:${thresholdPct.toFixed(4)}%;"></div>
      `;
    }

    const winnerBanner = document.querySelector("#winner-banner");
    const winner =
      totals.leftEv >= threshold
        ? candidates.left.name
        : totals.rightEv >= threshold
          ? candidates.right.name
          : "";

    if (winnerBanner) {
      if (winner) {
        winnerBanner.textContent = `APRP PROJECTS: ${winner} WINS THE PRESIDENCY`;
        winnerBanner.classList.add("is-visible");
      } else {
        winnerBanner.textContent = "";
        winnerBanner.classList.remove("is-visible");
      }
    }

    updatePredictionScore();
  }

  function raceCard(row) {
    const leader = candidateForSide(row.called.calledFor || row.leader.leader);
    const rating = ratingForRow(row);

    return `
      <article class="race-card">
        <div class="race-card-top">
          <span>
            <span class="race-dot" style="background:${safeHTML(leader.color)};"></span>
            ${safeHTML(row.name)}
          </span>
          <span>${row.ev} EV</span>
        </div>
        <div class="race-card-meta">
          <span>${safeHTML(rating.label)} • +${row.leader.marginPct.toFixed(2)}%</span>
          <span>${row.votes.reportingPct.toFixed(0)}% in</span>
        </div>
      </article>
    `;
  }

  function updateSidePanels() {
    const closest = currentRows
      .filter((row) => row.votes.totalVotes > 0 && !row.called.isCalled)
      .sort((a, b) => a.leader.marginPct - b.leader.marginPct)
      .slice(0, 7);

    const called = currentRows
      .filter((row) => row.called.isCalled)
      .sort((a, b) => b.ev - a.ev)
      .slice(0, 14);

    const closestList = document.querySelector("#closest-list");
    const calledList = document.querySelector("#called-list");

    if (closestList) {
      closestList.innerHTML = closest.length
        ? closest.map((row) => raceCard(row)).join("")
        : `<div class="race-card">No active uncalled close states yet.</div>`;
    }

    if (calledList) {
      calledList.innerHTML = called.length
        ? called.map((row) => raceCard(row)).join("")
        : `<div class="race-card">No states have been called yet.</div>`;
    }
  }

  function updateTicker() {
    const closest = currentRows
      .filter((row) => row.votes.totalVotes > 0 && !row.called.isCalled)
      .sort((a, b) => a.leader.marginPct - b.leader.marginPct)
      .slice(0, 14);

    const track = document.querySelector("#ticker-track");

    if (!track) return;

    const html = closest.length
      ? closest
          .map((row) => {
            const leader = candidateForSide(row.leader.leader);
            const rating = ratingForRow(row);

            return `
              <span class="ticker-item">
                <span style="color:${safeHTML(leader.color)};">${safeHTML(row.name)}</span>:
                ${safeHTML(rating.label)}, leading by ${row.leader.marginPct.toFixed(2)}%
                / ${row.leader.marginVotes.toLocaleString()} votes • ${row.votes.reportingPct.toFixed(0)}% in
              </span>
            `;
          })
          .join("")
      : `<span class="ticker-item">No active uncalled close states yet.</span>`;

    track.innerHTML = html + html;
  }

  function statusColor(row) {
    const leader = row.called.calledFor || row.leader.leader;

    if (leader === "left") return currentCandidates.left.color;
    if (leader === "right") return currentCandidates.right.color;
    if (leader === "other") return currentCandidates.other.color;

    return "#94a3b8";
  }

  function fixedMiniCandidateRow(side, row) {
    const candidate = candidateForSide(side);

    const votes =
      side === "left"
        ? row.votes.leftVotes
        : side === "right"
          ? row.votes.rightVotes
          : row.votes.otherVotes;

    const pct =
      side === "left"
        ? row.votes.leftPct
        : side === "right"
          ? row.votes.rightPct
          : row.votes.otherPct;

    if (side === "other" && votes <= 0) return "";

    return `
      <div class="fixed-mini-row">
        <div>
          <div class="fixed-mini-name" style="color:${safeHTML(candidate.color)};">${safeHTML(candidate.short_name)}</div>
          <span class="fixed-mini-votes">${votes.toLocaleString()} votes</span>
        </div>
        <div class="fixed-mini-pct">${pct.toFixed(1)}%</div>
      </div>
    `;
  }

  function showFixedStatePopup(row, isPrediction = false) {
    const slot = document.querySelector("#fixed-state-popup");

    if (!slot) return;

    if (isPrediction) {
      const current = predictionSelections[row.abbr] || "none";

      const label =
        current === "left"
          ? currentCandidates.left.short_name
          : current === "right"
            ? currentCandidates.right.short_name
            : current === "other"
              ? currentCandidates.other.short_name
              : current === "tossup"
                ? "Tossup"
                : "Unassigned";

      slot.innerHTML = `
        <div class="fixed-state-popup-header">
          <div>
            <h3>${safeHTML(row.name)}</h3>
            <p>${row.ev} EV • Prediction Mode</p>
          </div>
          <button class="fixed-state-popup-close" type="button">×</button>
        </div>

        <div class="fixed-state-popup-status" style="background:${safeHTML(predictionColor(row.abbr))};">
          <span>${safeHTML(label)}</span>
          <span>Click to cycle</span>
        </div>

        <div class="fixed-state-popup-margin">
          Cycle: ${safeHTML(currentCandidates.left.short_name)} → ${safeHTML(currentCandidates.right.short_name)} → Other → Tossup → Clear
        </div>
      `;
    } else {
      const leader = candidateForSide(row.called.calledFor || row.leader.leader);
      const rating = ratingForRow(row);
      const stripColor = statusColor(row);
      const leadingBy = `${row.leader.marginVotes.toLocaleString()} votes / ${row.leader.marginPct.toFixed(2)}%`;

      slot.innerHTML = `
        <div class="fixed-state-popup-header">
          <div>
            <h3>${safeHTML(row.name)}</h3>
            <p>${row.ev} EV • ${row.votes.reportingPct.toFixed(1)}% reporting${row.pollClose ? ` • closes ${safeHTML(row.pollClose)}` : ""}</p>
          </div>
          <button class="fixed-state-popup-close" type="button">×</button>
        </div>

        <div class="fixed-state-popup-status" style="background:${safeHTML(stripColor)};">
          <span>${safeHTML(rating.label)}</span>
          <span>+${row.leader.marginPct.toFixed(2)}%</span>
        </div>

        <div class="fixed-state-popup-body">
          ${fixedMiniCandidateRow("left", row)}
          ${fixedMiniCandidateRow("right", row)}
          ${fixedMiniCandidateRow("other", row)}
        </div>

        <div class="fixed-state-popup-margin">
          ${safeHTML(leader.short_name)} leading by ${safeHTML(leadingBy)}
        </div>
      `;
    }

    slot.classList.remove("is-hidden");

    slot.querySelector(".fixed-state-popup-close")?.addEventListener("click", () => {
      slot.classList.add("is-hidden");
    });
  }

  async function initMap() {
    const slot = document.querySelector("#map");

    if (!slot) return;

    if (!window.mapboxgl) {
      slot.innerHTML = `<div style="padding:20px;color:white;">Mapbox failed to load.</div>`;
      return;
    }

    mapboxgl.accessToken = MAPBOX_TOKEN;

    map = new mapboxgl.Map({
      container: "map",
      style: "mapbox://styles/mapbox/dark-v10",
      center: [-98.5795, 39.8283],
      zoom: window.innerWidth < 760 ? 2.55 : 3.25,
      minZoom: 2,
      maxZoom: 7,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");

    map.on("load", async () => {
      loadedGeoJSON = await loadStatesGeoJSON();

      map.addSource("election-states", {
        type: "geojson",
        data: enrichGeoJSON(loadedGeoJSON),
      });

      map.addLayer({
        id: "election-states-fill",
        type: "fill",
        source: "election-states",
        paint: {
          "fill-color": ["get", "color"],
          "fill-opacity": 0.9,
        },
      });

      map.addLayer({
        id: "election-states-outline",
        type: "line",
        source: "election-states",
        paint: {
          "line-color": "rgba(255,255,255,.82)",
          "line-width": 1.1,
        },
      });

      map.on("click", "election-states-fill", (event) => {
        const feature = event.features && event.features[0];
        const abbr = cleanCell(feature?.properties?.abbr);
        const row = rowForState(abbr);

        if (!row) return;

        if (currentMapMode === "prediction") {
          cyclePrediction(abbr);
          showFixedStatePopup(row, true);
          return;
        }

        showFixedStatePopup(row, false);
      });

      map.on("mousemove", "election-states-fill", () => {
        map.getCanvas().style.cursor = "pointer";
      });

      map.on("mouseleave", "election-states-fill", () => {
        map.getCanvas().style.cursor = "";
      });

      hideLoader();
    });

    map.on("error", (event) => {
      console.warn("Mapbox error:", event.error || event);
    });
  }

  function cyclePrediction(abbr) {
    const current = predictionSelections[abbr] || "none";

    if (current === "none") predictionSelections[abbr] = "left";
    else if (current === "left") predictionSelections[abbr] = "right";
    else if (current === "right") predictionSelections[abbr] = "other";
    else if (current === "other") predictionSelections[abbr] = "tossup";
    else delete predictionSelections[abbr];

    updatePredictionScore();
    updateMapData();
  }

  function hideLoader() {
    const loader = document.querySelector("#loader");

    if (!loader) return;

    loader.style.opacity = "0";

    setTimeout(() => {
      loader.style.display = "none";
    }, 250);
  }

  function showLoader(text = "LOADING APRP ELECTION DESK...") {
    const loader = document.querySelector("#loader");

    if (!loader) return;

    loader.textContent = text;
    loader.style.display = "flex";
    loader.style.opacity = "1";
  }

  async function loadLiveResults() {
    const data = await fetchSheets([
      "WEB_LIVECONFIG",
      "WEB_LIVECANDIDATES",
      "WEB_LIVESTATES",
      "WEB_LIVERESULTS",
    ]);

    const configRows = data.WEB_LIVECONFIG || [];

    currentConfig = {
      title: configValue(configRows, "title", "Live Election Results"),
      subtitle: configValue(configRows, "subtitle", "Race Dashboard"),
      year: configValue(configRows, "year", ""),
      total_ev: configValue(configRows, "total_ev", TOTAL_EV_FALLBACK),
      win_threshold: configValue(configRows, "win_threshold", WIN_THRESHOLD_FALLBACK),
    };

    currentCandidates = buildCandidates(data.WEB_LIVECANDIDATES || []);

    const rawRows =
      data.WEB_LIVERESULTS && data.WEB_LIVERESULTS.length
        ? data.WEB_LIVERESULTS
        : data.WEB_LIVESTATES || [];

    currentRows = buildResultRows(rawRows);

    document.documentElement.style.setProperty("--cnn-blue", currentCandidates.left.color || "#155eef");
    document.documentElement.style.setProperty("--cnn-red", currentCandidates.right.color || "#d71920");

    updateScoreboard();
    updateSidePanels();
    updateTicker();
    updateLegend();
    updateMapData();
  }

  function updateLegend() {
    const title = document.querySelector("#legend-title");
    const body = document.querySelector("#legend-body");

    if (!title || !body) return;

    if (currentMapMode === "prediction") {
      title.textContent = "Prediction Mode";
      body.innerHTML = `
        <div class="legend-row"><span class="legend-swatch" style="background:#155eef"></span> ${safeHTML(currentCandidates.left.short_name)}</div>
        <div class="legend-row"><span class="legend-swatch" style="background:#d71920"></span> ${safeHTML(currentCandidates.right.short_name)}</div>
        <div class="legend-row"><span class="legend-swatch" style="background:#7c3aed"></span> Other</div>
        <div class="legend-row"><span class="legend-swatch" style="background:#94a3b8"></span> Tossup</div>
        <div class="legend-row"><span class="legend-swatch" style="background:#475569"></span> Unassigned</div>
      `;
      return;
    }

    if (currentMapMode === "pollclose") {
      title.textContent = "Poll Closing";
      body.innerHTML = `
        <div class="legend-row"><span class="legend-swatch" style="background:#1e3a8a"></span> 7 PM</div>
        <div class="legend-row"><span class="legend-swatch" style="background:#2563eb"></span> 8 PM</div>
        <div class="legend-row"><span class="legend-swatch" style="background:#7c3aed"></span> 9 PM</div>
        <div class="legend-row"><span class="legend-swatch" style="background:#b45309"></span> 10 PM</div>
        <div class="legend-row"><span class="legend-swatch" style="background:#b91c1c"></span> 11 PM+</div>
        <div class="legend-row"><span class="legend-swatch" style="background:#475569"></span> Unknown</div>
      `;
      return;
    }

    if (currentMapMode === "turnout") {
      title.textContent = "Turnout / Reporting";
      body.innerHTML = `
        <div class="legend-row"><span class="legend-swatch" style="background:#0f766e"></span> 90%+ reporting</div>
        <div class="legend-row"><span class="legend-swatch" style="background:#14b8a6"></span> 70%+</div>
        <div class="legend-row"><span class="legend-swatch" style="background:#38bdf8"></span> 50%+</div>
        <div class="legend-row"><span class="legend-swatch" style="background:#64748b"></span> 30%+</div>
        <div class="legend-row"><span class="legend-swatch" style="background:#303846"></span> Low / none</div>
      `;
      return;
    }

    title.textContent = "Race Status";
    body.innerHTML = `
      <div class="legend-row"><span class="legend-swatch" style="background:#0b3fb3"></span> Called ${safeHTML(currentCandidates.left.short_name)}</div>
      <div class="legend-row"><span class="legend-swatch" style="background:#60a5fa"></span> Lean ${safeHTML(currentCandidates.left.short_name)}</div>
      <div class="legend-row"><span class="legend-swatch" style="background:#8b1117"></span> Called ${safeHTML(currentCandidates.right.short_name)}</div>
      <div class="legend-row"><span class="legend-swatch" style="background:#fb7185"></span> Lean ${safeHTML(currentCandidates.right.short_name)}</div>
      <div class="legend-row"><span class="legend-swatch" style="background:#7c3aed"></span> Other lead</div>
      <div class="legend-row"><span class="legend-swatch" style="background:#94a3b8"></span> Tossup / no data</div>
    `;
  }

  async function refreshLiveResults() {
    try {
      showLoader("REFRESHING ELECTION DESK...");
      await loadLiveResults();

      if (!map) {
        await initMap();
      } else {
        hideLoader();
      }
    } catch (error) {
      console.error(error);
      showLoader(`FAILED TO LOAD: ${error.message}`);
    }
  }

  function setupEvents() {
    document.querySelector("#legend-button")?.addEventListener("click", () => {
      document.querySelector("#legend")?.classList.toggle("hidden");
    });

    document.querySelector("#refresh-button")?.addEventListener("click", () => {
      refreshLiveResults();
    });

    document.querySelector("#clear-prediction-button")?.addEventListener("click", () => {
      predictionSelections = {};
      updatePredictionScore();
      updateMapData();

      const fixedPopup = document.querySelector("#fixed-state-popup");
      if (fixedPopup) fixedPopup.classList.add("is-hidden");
    });

    document.querySelectorAll("[data-live-map-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        currentMapMode = button.dataset.liveMapMode || "results";

        document.querySelectorAll("[data-live-map-mode]").forEach((btn) => {
          btn.classList.remove("is-active");
        });

        button.classList.add("is-active");
        updateLegend();
        updateMapData();

        const fixedPopup = document.querySelector("#fixed-state-popup");
        if (fixedPopup) fixedPopup.classList.add("is-hidden");
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    setupEvents();
    refreshLiveResults();
  });
})();