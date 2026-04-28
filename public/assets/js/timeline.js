/* APRP Federal Archive — Timeline Page */

(function () {
  const APRP = window.APRP || {};

  const fetchSheets = APRP.fetchSheets;
  const cleanCell = APRP.cleanCell || ((value) => String(value ?? "").trim());
  const toNumber = APRP.toNumber || ((value, fallback = 0) => {
    const parsed = Number(String(value ?? "").replace(/[$,%]/g, "").trim());
    return Number.isFinite(parsed) ? parsed : fallback;
  });
  const safeHTML = APRP.safeHTML || ((value) => {
    return cleanCell(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  });

  let ALL_EVENTS = [];
  let FILTERED_EVENTS = [];
  let SORT_DESC = true;

  const CATEGORY_COLORS = {
    crisis: "#b91c1c",
    security: "#991b1b",
    war: "#7f1d1d",
    economy: "#166534",
    economic: "#166534",
    election: "#1d4ed8",
    elections: "#1d4ed8",
    government: "#4338ca",
    legislation: "#7c3aed",
    foreign: "#0f766e",
    diplomacy: "#0f766e",
    domestic: "#b45309",
    social: "#be123c",
    administration: "#0f172a",
    default: "#2563eb",
  };

  function getEl(selector) {
    return document.querySelector(selector);
  }

  function setText(selector, value) {
    const el = getEl(selector);
    if (el) el.textContent = value;
  }

  function firstValue(row, keys, fallback = "") {
    for (const key of keys) {
      const value = cleanCell(row?.[key]);
      if (value !== "") return value;
    }

    return fallback;
  }

  function eventTitle(row) {
    return firstValue(row, ["title", "headline", "event", "name"], "Untitled Event");
  }

  function eventSummary(row) {
    return firstValue(row, ["summary", "description", "details", "body", "text"], "No summary provided.");
  }

  function eventCategory(row) {
    return firstValue(row, ["category", "type", "tag", "section"], "General");
  }

  function eventImportance(row) {
    return toNumber(firstValue(row, ["importance", "priority", "weight", "score"], 50), 50);
  }

  function eventLink(row) {
    return firstValue(row, ["link", "url", "source", "doc", "document"], "");
  }

  function eventDateRaw(row) {
    return firstValue(row, ["date", "full_date", "event_date", "day"], "");
  }

  function eventMonth(row) {
    const direct = firstValue(row, ["month_name", "month"], "");
    if (direct) return direct;

    const raw = eventDateRaw(row);
    const match = raw.match(/[A-Za-z]+/);
    return match ? match[0] : "";
  }

  function eventYear(row) {
    const direct = firstValue(row, ["year", "rp_year"], "");
    if (direct) return cleanCell(direct);

    const raw = eventDateRaw(row);
    const match = raw.match(/\b(19|20)\d{2}\b/);
    return match ? match[0] : "Unknown";
  }

  function eventDay(row) {
    const direct = firstValue(row, ["day_number", "day_num"], "");
    if (direct) return direct;

    const raw = eventDateRaw(row);
    const match = raw.match(/\b([0-3]?\d)\b/);
    return match ? match[1] : "";
  }

  function eventDateLabel(row) {
    const raw = eventDateRaw(row);
    if (raw) return raw;

    return [eventMonth(row), eventDay(row), eventYear(row)]
      .filter(Boolean)
      .join(" ");
  }

  function eventSortValue(row) {
    const year = toNumber(eventYear(row), 0);
    const monthRaw = String(eventMonth(row)).toLowerCase();
    const monthMap = {
      january: 1,
      jan: 1,
      february: 2,
      feb: 2,
      march: 3,
      mar: 3,
      april: 4,
      apr: 4,
      may: 5,
      june: 6,
      jun: 6,
      july: 7,
      jul: 7,
      august: 8,
      aug: 8,
      september: 9,
      sep: 9,
      october: 10,
      oct: 10,
      november: 11,
      nov: 11,
      december: 12,
      dec: 12,
    };

    const month = monthMap[monthRaw] || toNumber(monthRaw, 0);
    const day = toNumber(eventDay(row), 0);

    return year * 10000 + month * 100 + day;
  }

  function categoryColor(category) {
    const key = cleanCell(category).toLowerCase();
    return CATEGORY_COLORS[key] || CATEGORY_COLORS.default;
  }

  function normalizeEvent(row, index) {
    return {
      ...row,
      _id: `event-${index}`,
      _title: eventTitle(row),
      _summary: eventSummary(row),
      _category: eventCategory(row),
      _importance: eventImportance(row),
      _link: eventLink(row),
      _year: eventYear(row),
      _month: eventMonth(row),
      _day: eventDay(row),
      _dateLabel: eventDateLabel(row),
      _sort: eventSortValue(row),
    };
  }

  function populateFilters(events) {
    const categorySelect = getEl("#timeline-category-filter");
    const yearSelect = getEl("#timeline-year-filter");

    const categories = Array.from(new Set(events.map((event) => event._category).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b));

    const years = Array.from(new Set(events.map((event) => event._year).filter(Boolean)))
      .sort((a, b) => toNumber(b, 0) - toNumber(a, 0));

    if (categorySelect) {
      categorySelect.innerHTML = `
        <option value="all">All Categories</option>
        ${categories.map((category) => `
          <option value="${safeHTML(category.toLowerCase())}">${safeHTML(category)}</option>
        `).join("")}
      `;
    }

    if (yearSelect) {
      yearSelect.innerHTML = `
        <option value="all">All Years</option>
        ${years.map((year) => `
          <option value="${safeHTML(year)}">${safeHTML(year)}</option>
        `).join("")}
      `;
    }
  }

  function eventMatchesSearch(event, search) {
    if (!search) return true;

    const haystack = [
      event._title,
      event._summary,
      event._category,
      event._dateLabel,
      event._year,
      event.notes,
      event.author,
    ]
      .map((value) => cleanCell(value).toLowerCase())
      .join(" ");

    return haystack.includes(search.toLowerCase());
  }

  function applyFilters() {
    const search = cleanCell(getEl("#timeline-search")?.value || "");
    const category = cleanCell(getEl("#timeline-category-filter")?.value || "all").toLowerCase();
    const year = cleanCell(getEl("#timeline-year-filter")?.value || "all");
    const importance = cleanCell(getEl("#timeline-importance-filter")?.value || "all");

    FILTERED_EVENTS = ALL_EVENTS.filter((event) => {
      if (!eventMatchesSearch(event, search)) return false;

      if (category !== "all" && cleanCell(event._category).toLowerCase() !== category) {
        return false;
      }

      if (year !== "all" && event._year !== year) {
        return false;
      }

      if (importance === "major" && event._importance < 80) return false;
      if (importance === "high" && event._importance < 60) return false;

      return true;
    }).sort((a, b) => {
      return SORT_DESC ? b._sort - a._sort : a._sort - b._sort;
    });

    renderTimeline();
    renderStats();
    renderFilterSummary();
  }

  function applyQuickFilter(type) {
    const categorySelect = getEl("#timeline-category-filter");
    const importanceSelect = getEl("#timeline-importance-filter");

    document.querySelectorAll("[data-quick-filter]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.quickFilter === type);
    });

    if (type === "all") {
      if (categorySelect) categorySelect.value = "all";
      if (importanceSelect) importanceSelect.value = "all";
    }

    if (type === "major") {
      if (categorySelect) categorySelect.value = "all";
      if (importanceSelect) importanceSelect.value = "major";
    }

    if (type === "crisis") {
      if (categorySelect) {
        const option = Array.from(categorySelect.options).find((opt) => {
          return ["crisis", "security", "war"].includes(opt.value);
        });

        categorySelect.value = option ? option.value : "all";
      }

      if (importanceSelect) importanceSelect.value = "all";
    }

    if (type === "economic") {
      if (categorySelect) {
        const option = Array.from(categorySelect.options).find((opt) => {
          return ["economy", "economic"].includes(opt.value);
        });

        categorySelect.value = option ? option.value : "all";
      }

      if (importanceSelect) importanceSelect.value = "all";
    }

    if (type === "election") {
      if (categorySelect) {
        const option = Array.from(categorySelect.options).find((opt) => {
          return ["election", "elections"].includes(opt.value);
        });

        categorySelect.value = option ? option.value : "all";
      }

      if (importanceSelect) importanceSelect.value = "all";
    }

    applyFilters();
  }

  function renderStats() {
    const total = FILTERED_EVENTS.length;
    const major = FILTERED_EVENTS.filter((event) => event._importance >= 80).length;

    setText("#timeline-total-count", total.toLocaleString());
    setText("#timeline-major-count", major.toLocaleString());
  }

  function renderFilterSummary() {
    const title = getEl("#timeline-filter-title");
    const summary = getEl("#timeline-filter-summary");

    const category = cleanCell(getEl("#timeline-category-filter")?.value || "all");
    const year = cleanCell(getEl("#timeline-year-filter")?.value || "all");
    const importance = cleanCell(getEl("#timeline-importance-filter")?.value || "all");

    const parts = [];

    if (category !== "all") parts.push(category);
    if (year !== "all") parts.push(year);
    if (importance === "major") parts.push("major events");
    if (importance === "high") parts.push("high-importance events");

    if (title) {
      title.textContent = parts.length ? parts.join(" • ") : "All Events";
    }

    if (summary) {
      summary.textContent = `${FILTERED_EVENTS.length.toLocaleString()} records shown from ${ALL_EVENTS.length.toLocaleString()} total timeline events.`;
    }
  }

  function renderFeaturedEvent() {
    const featured = [...ALL_EVENTS].sort((a, b) => {
      return b._importance - a._importance || b._sort - a._sort;
    })[0];

    if (!featured) {
      setText("#timeline-feature-title", "No featured event");
      setText("#timeline-feature-summary", "No timeline records found.");
      return;
    }

    setText("#timeline-feature-title", featured._title);
    setText("#timeline-feature-summary", featured._summary);
  }

  function groupEventsByYear(events) {
    return events.reduce((groups, event) => {
      const year = event._year || "Unknown";

      if (!groups[year]) groups[year] = [];
      groups[year].push(event);

      return groups;
    }, {});
  }

  function eventCardHTML(event) {
    const color = categoryColor(event._category);
    const linkHTML = event._link
      ? `<a class="timeline-open-link" href="${safeHTML(event._link)}" target="_blank" rel="noopener">Open Source</a>`
      : `<span class="timeline-open-link">Preview</span>`;

    return `
      <article class="timeline-event-card" data-event-id="${safeHTML(event._id)}">
        <div class="timeline-date-block">
          <strong>${safeHTML(event._day || event._month || event._year)}</strong>
          <span>${safeHTML(event._dateLabel || event._year)}</span>
        </div>

        <div class="timeline-event-body">
          <div class="timeline-event-top">
            <span class="timeline-category" style="color:${safeHTML(color)};border-color:${safeHTML(color)}33;background:${safeHTML(color)}12;">
              ${safeHTML(event._category)}
            </span>
            <span class="timeline-importance">Importance ${safeHTML(event._importance)}</span>
          </div>

          <h3>${safeHTML(event._title)}</h3>
          <p>${safeHTML(event._summary)}</p>
        </div>

        <div class="timeline-event-actions">
          ${linkHTML}
        </div>
      </article>
    `;
  }

  function renderTimeline() {
    const slot = getEl("#timeline-list");

    if (!slot) return;

    if (!FILTERED_EVENTS.length) {
      slot.innerHTML = `
        <div class="timeline-empty">
          No timeline records match the current filters.
        </div>
      `;
      return;
    }

    const grouped = groupEventsByYear(FILTERED_EVENTS);
    const years = Object.keys(grouped).sort((a, b) => {
      return SORT_DESC ? toNumber(b, 0) - toNumber(a, 0) : toNumber(a, 0) - toNumber(b, 0);
    });

    slot.innerHTML = years.map((year) => {
      return `
        <section class="timeline-group">
          <div class="timeline-year-header">
            <h2>${safeHTML(year)}</h2>
            <div class="timeline-year-line"></div>
          </div>

          ${grouped[year].map(eventCardHTML).join("")}
        </section>
      `;
    }).join("");

    slot.querySelectorAll("[data-event-id]").forEach((card) => {
      card.addEventListener("click", (event) => {
        if (event.target.closest("a")) return;

        const id = card.dataset.eventId;
        const selected = ALL_EVENTS.find((item) => item._id === id);

        if (selected) renderSelectedEvent(selected);
      });
    });
  }

  function renderSelectedEvent(event) {
    const slot = getEl("#timeline-selected-detail");

    if (!slot) return;

    const color = categoryColor(event._category);

    slot.innerHTML = `
      <div class="eyebrow">Selected Event</div>
      <h3>${safeHTML(event._title)}</h3>

      <p>
        <strong>Date:</strong> ${safeHTML(event._dateLabel || event._year)}<br>
        <strong>Category:</strong>
        <span style="color:${safeHTML(color)};font-weight:900;">${safeHTML(event._category)}</span><br>
        <strong>Importance:</strong> ${safeHTML(event._importance)}
      </p>

      <p>${safeHTML(event._summary)}</p>

      ${
        event._link
          ? `<a class="btn btn-primary btn-small" href="${safeHTML(event._link)}" target="_blank" rel="noopener">Open Source</a>`
          : ""
      }
    `;
  }

  function setupEvents() {
    getEl("#timeline-search")?.addEventListener("input", applyFilters);
    getEl("#timeline-category-filter")?.addEventListener("change", applyFilters);
    getEl("#timeline-year-filter")?.addEventListener("change", applyFilters);
    getEl("#timeline-importance-filter")?.addEventListener("change", applyFilters);

    getEl("#timeline-sort-toggle")?.addEventListener("click", () => {
      SORT_DESC = !SORT_DESC;

      const button = getEl("#timeline-sort-toggle");
      if (button) button.textContent = SORT_DESC ? "Newest First" : "Oldest First";

      applyFilters();
    });

    document.querySelectorAll("[data-quick-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        applyQuickFilter(button.dataset.quickFilter || "all");
      });
    });
  }

  async function initTimeline() {
    try {
      if (!fetchSheets) {
        throw new Error("Sheet loader is unavailable.");
      }

      const data = await fetchSheets(["WEB_EVENTS"]);
      const rows = data.WEB_EVENTS || [];

      ALL_EVENTS = rows.map(normalizeEvent).filter((event) => {
        return cleanCell(event._title) && event._title !== "Untitled Event";
      });

      FILTERED_EVENTS = [...ALL_EVENTS].sort((a, b) => b._sort - a._sort);

      populateFilters(ALL_EVENTS);
      renderFeaturedEvent();
      renderTimeline();
      renderStats();
      renderFilterSummary();

      if (FILTERED_EVENTS[0]) {
        renderSelectedEvent(FILTERED_EVENTS[0]);
      }
    } catch (error) {
      console.error(error);

      const slot = getEl("#timeline-list");
      if (slot) {
        slot.innerHTML = `
          <div class="timeline-empty">
            Timeline failed to load: ${safeHTML(error.message)}
          </div>
        `;
      }
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    setupEvents();
    initTimeline();
  });
})();