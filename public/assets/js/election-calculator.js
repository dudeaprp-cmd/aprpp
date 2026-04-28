/* APRP Election Calculator
   Interactive path-to-270 custom prediction map.
*/

(function () {
  const MAPBOX_TOKEN =
    "YOUR_MAPBOX_TOKEN_HERE";

  const US_STATES_GEOJSON_URL =
    "https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json";

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

  const STATUS = {
    DNC: {
      label: "DNC",
      color: "#2563eb",
      soft: "rgba(37,99,235,.16)",
    },
    GOP: {
      label: "GOP",
      color: "#dc2626",
      soft: "rgba(220,38,38,.16)",
    },
    IND: {
      label: "IND",
      color: "#7c3aed",
      soft: "rgba(124,58,237,.16)",
    },
    TOSSUP: {
      label: "Tossup",
      color: "#64748b",
      soft: "rgba(100,116,139,.16)",
    },
  };

  let map = null;
  let currentPaint = "DNC";
  let selectedState = "";
  let states = {};
  let geojsonCache = null;

  Object.keys(EV_2012).forEach((abbr) => {
    states[abbr] = "TOSSUP";
  });

  function cleanCell(value) {
    return String(value ?? "").trim();
  }

  function safeHTML(value) {
    return cleanCell(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getEl(selector) {
    return document.querySelector(selector);
  }

  function stateAbbrFromFeature(feature) {
    const name = feature?.properties?.name || feature?.properties?.NAME;
    return STATE_NAME_TO_ABBR[name] || "";
  }

  function totalFor(status) {
    return Object.entries(states).reduce((sum, [abbr, stateStatus]) => {
      if (stateStatus !== status) return sum;
      return sum + (EV_2012[abbr] || 0);
    }, 0);
  }

  function tossupTotal() {
    return totalFor("TOSSUP");
  }

  function leader() {
    const dnc = totalFor("DNC");
    const gop = totalFor("GOP");
    const ind = totalFor("IND");

    if (dnc >= 270) return "DNC";
    if (gop >= 270) return "GOP";
    if (ind >= 270) return "IND";
    if (dnc > gop && dnc > ind) return "DNC";
    if (gop > dnc && gop > ind) return "GOP";
    if (ind > dnc && ind > gop) return "IND";

    return "TOSSUP";
  }

  function neededToWin(status) {
    return Math.max(0, 270 - totalFor(status));
  }

  function injectStyles() {
    if (document.querySelector("#aprp-election-calculator-style")) return;

    const style = document.createElement("style");
    style.id = "aprp-election-calculator-style";
    style.textContent = `
      .calculator-shell {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 360px;
        gap: 18px;
        align-items: start;
      }

      .calculator-panel,
      .calculator-map-card {
        border: 1px solid rgba(15,23,42,.12);
        border-radius: 24px;
        background: rgba(255,255,255,.94);
        box-shadow: 0 18px 42px rgba(15,23,42,.08);
        padding: 16px;
      }

      .calculator-map-card {
        background: linear-gradient(180deg, #13243d, #07111f);
        color: #fff;
      }

      .calculator-toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 12px;
      }

      .calc-btn {
        border: 1px solid rgba(255,255,255,.14);
        border-radius: 999px;
        background: rgba(255,255,255,.08);
        color: #fff;
        padding: 8px 12px;
        font-size: .82rem;
        font-weight: 950;
        cursor: pointer;
      }

      .calc-btn.light {
        background: #fff;
        color: #0f172a;
        border-color: rgba(15,23,42,.14);
      }

      .calc-btn.is-active {
        background: #2563eb;
        border-color: #60a5fa;
        color: #fff;
      }

      .calc-btn.dnc.is-active {
        background: #2563eb;
      }

      .calc-btn.gop.is-active {
        background: #dc2626;
      }

      .calc-btn.ind.is-active {
        background: #7c3aed;
      }

      .calc-btn.tossup.is-active {
        background: #64748b;
      }

      #calculator-map {
        height: 620px;
        border-radius: 18px;
        overflow: hidden;
        border: 1px solid rgba(255,255,255,.12);
        background: #07111f;
      }

      .calculator-scoreboard {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 9px;
        margin-bottom: 12px;
      }

      .calc-score {
        border: 1px solid rgba(15,23,42,.10);
        border-radius: 16px;
        background: rgba(255,255,255,.86);
        padding: 12px;
      }

      .calc-score strong {
        display: block;
        color: #0f172a;
        font-size: 1.6rem;
        font-weight: 1000;
        line-height: 1;
      }

      .calc-score span {
        display: block;
        margin-top: 5px;
        color: #64748b;
        font-size: .7rem;
        font-weight: 950;
        letter-spacing: .10em;
        text-transform: uppercase;
      }

      .calc-score.dnc {
        border-color: rgba(37,99,235,.35);
        background: rgba(37,99,235,.10);
      }

      .calc-score.gop {
        border-color: rgba(220,38,38,.35);
        background: rgba(220,38,38,.10);
      }

      .calc-score.ind {
        border-color: rgba(124,58,237,.35);
        background: rgba(124,58,237,.10);
      }

      .calculator-status {
        border-radius: 18px;
        padding: 14px;
        background: linear-gradient(180deg, #13243d, #07111f);
        color: #fff;
        margin-bottom: 12px;
      }

      .calculator-status .eyebrow {
        color: #93c5fd;
      }

      .calculator-status h3 {
        margin: 5px 0 3px;
        font-family: Georgia, serif;
        font-size: 1.35rem;
      }

      .calculator-status p {
        margin: 0;
        color: #cbd5e1;
        line-height: 1.35;
      }

      .calculator-state-list {
        display: grid;
        gap: 7px;
        max-height: 500px;
        overflow: auto;
        padding-right: 4px;
      }

      .state-row {
        display: grid;
        grid-template-columns: 1fr auto auto;
        gap: 7px;
        align-items: center;
        border: 1px solid rgba(15,23,42,.10);
        border-radius: 14px;
        background: #fff;
        padding: 9px;
      }

      .state-row strong {
        color: #0f172a;
        font-weight: 950;
      }

      .state-row span {
        color: #64748b;
        font-size: .78rem;
        font-weight: 850;
      }

      .state-party-pill {
        border-radius: 999px;
        padding: 5px 8px;
        color: #fff;
        font-size: .72rem;
        font-weight: 1000;
        min-width: 58px;
        text-align: center;
      }

      .state-row button {
        border: 1px solid rgba(15,23,42,.14);
        background: #fff;
        color: #0f172a;
        border-radius: 999px;
        padding: 6px 9px;
        cursor: pointer;
        font-size: .72rem;
        font-weight: 950;
      }

      .calculator-search {
        width: 100%;
        border: 1px solid rgba(15,23,42,.14);
        border-radius: 14px;
        padding: 10px 11px;
        margin: 0 0 10px;
        font-weight: 850;
      }

      .calc-selected-box {
        border: 1px solid rgba(15,23,42,.10);
        border-radius: 16px;
        background: rgba(248,250,252,.92);
        padding: 12px;
        margin-bottom: 12px;
      }

      .calc-selected-box h3 {
        margin: 4px 0 5px;
        color: #0f172a;
        font-family: Georgia, serif;
      }

      .calc-selected-box p {
        margin: 0;
        color: #64748b;
      }

      @media (max-width: 1150px) {
        .calculator-shell {
          grid-template-columns: 1fr;
        }

        #calculator-map {
          height: 520px;
        }

        .calculator-scoreboard {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 700px) {
        #calculator-map {
          height: 420px;
        }

        .calculator-scoreboard {
          grid-template-columns: 1fr;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function colorExpression() {
    const expression = ["match", ["get", "abbr"]];

    Object.entries(states).forEach(([abbr, stateStatus]) => {
      expression.push(abbr, STATUS[stateStatus].color);
    });

    expression.push(STATUS.TOSSUP.color);
    return expression;
  }

  function opacityExpression() {
    const expression = ["match", ["get", "abbr"]];

    Object.entries(states).forEach(([abbr, stateStatus]) => {
      expression.push(abbr, stateStatus === "TOSSUP" ? 0.45 : 0.86);
    });

    expression.push(0.45);
    return expression;
  }

  function updateMapPaint() {
    if (!map || !map.getLayer("states-fill")) return;

    map.setPaintProperty("states-fill", "fill-color", colorExpression());
    map.setPaintProperty("states-fill", "fill-opacity", opacityExpression());
  }

  function setState(abbr, status) {
    if (!EV_2012[abbr]) return;

    states[abbr] = status;
    selectedState = abbr;

    updateMapPaint();
    renderScores();
    renderSelectedState();
    renderStateList();
  }

  function cycleState(abbr) {
    const current = states[abbr] || "TOSSUP";
    const order = ["TOSSUP", "DNC", "GOP", "IND"];
    const next = order[(order.indexOf(current) + 1) % order.length];

    setState(abbr, next);
  }

  function renderScores() {
    const dnc = totalFor("DNC");
    const gop = totalFor("GOP");
    const ind = totalFor("IND");
    const tossup = tossupTotal();
    const currentLeader = leader();

    const scoreSlot = getEl("#calculator-scoreboard");
    if (scoreSlot) {
      scoreSlot.innerHTML = `
        <div class="calc-score dnc">
          <strong>${dnc}</strong>
          <span>DNC EV</span>
        </div>
        <div class="calc-score gop">
          <strong>${gop}</strong>
          <span>GOP EV</span>
        </div>
        <div class="calc-score ind">
          <strong>${ind}</strong>
          <span>IND EV</span>
        </div>
        <div class="calc-score">
          <strong>${tossup}</strong>
          <span>Tossup EV</span>
        </div>
      `;
    }

    const statusSlot = getEl("#calculator-status");
    if (statusSlot) {
      const label = currentLeader === "TOSSUP" ? "No one has won yet" : `${STATUS[currentLeader].label} leading`;
      const needed =
        currentLeader === "TOSSUP"
          ? `DNC needs ${neededToWin("DNC")}, GOP needs ${neededToWin("GOP")}.`
          : `${STATUS[currentLeader].label} needs ${neededToWin(currentLeader)} more EV to reach 270.`;

      statusSlot.innerHTML = `
        <div class="eyebrow">Path to 270</div>
        <h3>${safeHTML(label)}</h3>
        <p>${safeHTML(needed)}</p>
      `;
    }

    const hero = getEl("#calculator-hero-card");
    if (hero) {
      hero.innerHTML = `
        <div class="eyebrow">Current Count</div>
        <h2>DNC ${dnc} • GOP ${gop}</h2>
        <p>IND ${ind} • Tossup ${tossup} • 270 to win.</p>
      `;
    }
  }

  function renderSelectedState() {
    const slot = getEl("#calculator-selected-state");
    if (!slot) return;

    if (!selectedState) {
      slot.innerHTML = `
        <h3>Choose a state</h3>
        <p>Click a state on the map or in the list to assign it.</p>
      `;
      return;
    }

    const status = states[selectedState];
    slot.innerHTML = `
      <h3>${safeHTML(STATE_NAMES[selectedState] || selectedState)}</h3>
      <p>${safeHTML(EV_2012[selectedState])} electoral votes • ${safeHTML(STATUS[status].label)}</p>
    `;
  }

  function stateRow(abbr) {
    const name = STATE_NAMES[abbr] || abbr;
    const status = states[abbr] || "TOSSUP";

    return `
      <div class="state-row" data-state-row="${safeHTML(abbr)}">
        <div>
          <strong>${safeHTML(name)}</strong>
          <span>${safeHTML(abbr)} • ${safeHTML(EV_2012[abbr])} EV</span>
        </div>
        <div class="state-party-pill" style="background:${safeHTML(STATUS[status].color)};">
          ${safeHTML(STATUS[status].label)}
        </div>
        <button type="button" data-state-cycle="${safeHTML(abbr)}">Change</button>
      </div>
    `;
  }

  function renderStateList() {
    const slot = getEl("#calculator-state-list");
    if (!slot) return;

    const search = cleanCell(getEl("#calculator-search")?.value || "").toLowerCase();

    const abbrs = Object.keys(EV_2012)
      .filter((abbr) => {
        const name = STATE_NAMES[abbr] || abbr;
        if (!search) return true;
        return name.toLowerCase().includes(search) || abbr.toLowerCase().includes(search);
      })
      .sort((a, b) => (STATE_NAMES[a] || a).localeCompare(STATE_NAMES[b] || b));

    slot.innerHTML = abbrs.map(stateRow).join("");

    slot.querySelectorAll("[data-state-cycle]").forEach((button) => {
      button.addEventListener("click", () => cycleState(button.dataset.stateCycle));
    });

    slot.querySelectorAll("[data-state-row]").forEach((row) => {
      row.addEventListener("dblclick", () => {
        const abbr = row.dataset.stateRow;
        setState(abbr, currentPaint);
      });
    });
  }

  function resetMap() {
    Object.keys(states).forEach((abbr) => {
      states[abbr] = "TOSSUP";
    });

    selectedState = "";
    updateMapPaint();
    renderScores();
    renderSelectedState();
    renderStateList();
  }

  function copyMap() {
    const dnc = Object.keys(states).filter((abbr) => states[abbr] === "DNC");
    const gop = Object.keys(states).filter((abbr) => states[abbr] === "GOP");
    const ind = Object.keys(states).filter((abbr) => states[abbr] === "IND");
    const tossup = Object.keys(states).filter((abbr) => states[abbr] === "TOSSUP");

    const text = [
      "APRP Election Calculator",
      `DNC: ${totalFor("DNC")} EV — ${dnc.join(", ") || "None"}`,
      `GOP: ${totalFor("GOP")} EV — ${gop.join(", ") || "None"}`,
      `IND: ${totalFor("IND")} EV — ${ind.join(", ") || "None"}`,
      `TOSSUP: ${tossupTotal()} EV — ${tossup.join(", ") || "None"}`,
    ].join("\n");

    navigator.clipboard
      .writeText(text)
      .then(() => {
        const btn = getEl("#calculator-copy");
        if (!btn) return;
        btn.textContent = "Copied";
        setTimeout(() => {
          btn.textContent = "Copy Map";
        }, 1200);
      })
      .catch(() => {
        const btn = getEl("#calculator-copy");
        if (!btn) return;
        btn.textContent = "Copy Failed";
        setTimeout(() => {
          btn.textContent = "Copy Map";
        }, 1200);
      });
  }

  function renderShell() {
    const root = getEl("#election-calculator-root");
    if (!root) return;

    root.innerHTML = `
      <div class="calculator-shell">
        <section class="calculator-map-card">
          <div class="calculator-toolbar">
            <button class="calc-btn dnc is-active" type="button" data-paint="DNC">Paint DNC</button>
            <button class="calc-btn gop" type="button" data-paint="GOP">Paint GOP</button>
            <button class="calc-btn ind" type="button" data-paint="IND">Paint IND</button>
            <button class="calc-btn tossup" type="button" data-paint="TOSSUP">Paint Tossup</button>
            <button class="calc-btn" type="button" id="calculator-reset">Reset</button>
            <button class="calc-btn" type="button" id="calculator-copy">Copy Map</button>
          </div>

          <div id="calculator-map"></div>
        </section>

        <aside class="calculator-panel">
          <div id="calculator-scoreboard" class="calculator-scoreboard"></div>
          <div id="calculator-status" class="calculator-status"></div>

          <div id="calculator-selected-state" class="calc-selected-box"></div>

          <input id="calculator-search" class="calculator-search" type="search" placeholder="Search states..." />

          <div id="calculator-state-list" class="calculator-state-list"></div>
        </aside>
      </div>
    `;

    document.querySelectorAll("[data-paint]").forEach((button) => {
      button.addEventListener("click", () => {
        currentPaint = button.dataset.paint;

        document.querySelectorAll("[data-paint]").forEach((btn) => {
          btn.classList.toggle("is-active", btn.dataset.paint === currentPaint);
        });
      });
    });

    getEl("#calculator-reset")?.addEventListener("click", resetMap);
    getEl("#calculator-copy")?.addEventListener("click", copyMap);
    getEl("#calculator-search")?.addEventListener("input", renderStateList);

    renderScores();
    renderSelectedState();
    renderStateList();
  }

  async function initMap() {
    if (!window.mapboxgl) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    map = new mapboxgl.Map({
      container: "calculator-map",
      style: "mapbox://styles/mapbox/dark-v10",
      center: [-98.5795, 39.8283],
      zoom: window.innerWidth < 700 ? 2.35 : 3.05,
      minZoom: 2,
      maxZoom: 6,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");

    map.on("load", async () => {
      const response = await fetch(US_STATES_GEOJSON_URL);
      const geojson = await response.json();

      geojson.features = geojson.features
        .map((feature) => {
          const abbr = stateAbbrFromFeature(feature);

          return {
            ...feature,
            properties: {
              ...feature.properties,
              abbr,
              ev: EV_2012[abbr] || 0,
            },
          };
        })
        .filter((feature) => feature.properties.abbr && EV_2012[feature.properties.abbr]);

      geojsonCache = geojson;

      map.addSource("states", {
        type: "geojson",
        data: geojsonCache,
      });

      map.addLayer({
        id: "states-fill",
        type: "fill",
        source: "states",
        paint: {
          "fill-color": colorExpression(),
          "fill-opacity": opacityExpression(),
        },
      });

      map.addLayer({
        id: "states-outline",
        type: "line",
        source: "states",
        paint: {
          "line-color": "rgba(255,255,255,.88)",
          "line-width": 1.15,
        },
      });

      map.on("click", "states-fill", (event) => {
        const abbr = cleanCell(event.features?.[0]?.properties?.abbr);
        if (!abbr) return;
        setState(abbr, currentPaint);
      });

      map.on("mousemove", "states-fill", () => {
        map.getCanvas().style.cursor = "pointer";
      });

      map.on("mouseleave", "states-fill", () => {
        map.getCanvas().style.cursor = "";
      });
    });
  }

  function initCalculator() {
    injectStyles();
    renderShell();
    initMap();
  }

  document.addEventListener("DOMContentLoaded", initCalculator);
})();