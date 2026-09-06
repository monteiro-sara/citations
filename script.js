const MD_PATH = "./CITATIONS.md";

const searchInput = document.querySelector("#search-input");
const filters = [...document.querySelectorAll(".filter")];
const sectionsContainer = document.querySelector("#citation-sections");
const emptyState = document.querySelector("#empty-state");
const resultsStatus = document.querySelector("#results-status");
const toast = document.querySelector(".toast");
const themeToggle = document.querySelector(".theme-toggle");
const recordCount = document.querySelector("#record-count");
const updatedDate = document.querySelector("#updated-date");

let activeFilter = "all";
let entries = [];
let sections = [];

const SECTION_CONFIG = {
  "peer-reviewed publication": {
    category: "publication",
    kicker: "Published"
  },
  "manuscript under peer review": {
    category: "manuscript",
    kicker: "In review"
  },
  "preprints": {
    category: "preprint",
    kicker: "Preprint"
  },
  "manuscripts under internal review for submission": {
    category: "manuscript",
    kicker: "Pre-submission"
  },
  "manuscripts in preparation": {
    category: "manuscript",
    kicker: "In preparation"
  },
  "meeting & workshop contributions": {
    category: "conference",
    kicker: "Meetings"
  },
  "research software": {
    category: "software",
    kicker: "Open tools"
  },
  "public datasets": {
    category: "dataset",
    kicker: "Open data"
  }
};

function normalize(value = "") {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function escapeHTML(value = "") {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function inferSectionConfig(heading) {
  const key = heading.trim().toLowerCase();
  if (SECTION_CONFIG[key]) return SECTION_CONFIG[key];

  if (key.includes("dataset") || key.includes("data")) {
    return { category: "dataset", kicker: "Open data" };
  }
  if (key.includes("software") || key.includes("tool")) {
    return { category: "software", kicker: "Open tools" };
  }
  if (
    key.includes("meeting") ||
    key.includes("conference") ||
    key.includes("workshop")
  ) {
    return { category: "conference", kicker: "Meetings" };
  }
  if (key.includes("preprint")) {
    return { category: "preprint", kicker: "Preprint" };
  }
  if (key.includes("publication") || key.includes("peer-reviewed")) {
    return { category: "publication", kicker: "Published" };
  }

  return { category: "manuscript", kicker: "Manuscript" };
}

function parseMarkdown(md) {
  const lines = md.replace(/\r/g, "").split("\n");
  const parsedSections = [];
  let currentSection = null;
  let currentItem = null;
  let lastUpdated = "";

  function flushItem() {
    if (currentItem && currentSection) {
      currentItem.text = currentItem.text.trim();

      if (currentItem.text) {
        currentSection.items.push(currentItem);
      }
    }

    currentItem = null;
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();

    const updatedMatch = line.match(/^_?Last updated:\s*(.+?)[._]*$/i);

    if (updatedMatch) {
      lastUpdated = updatedMatch[1]
        .replace(/\.$/, "")
        .trim();

      continue;
    }

    const headingMatch = line.match(/^##\s+(.+)$/);

    if (headingMatch) {
      flushItem();

      const heading = headingMatch[1].trim();
      const config = inferSectionConfig(heading);

      currentSection = {
        heading,
        category: config.category,
        kicker: config.kicker,
        items: [],
        notes: []
      };

      parsedSections.push(currentSection);
      continue;
    }

    if (!currentSection) continue;

    const itemMatch = line.match(/^(\d+)\.\s+(.+)$/);

    if (itemMatch) {
      flushItem();

      currentItem = {
        number: Number(itemMatch[1]),
        text: itemMatch[2].trim()
      };

      continue;
    }

    if (/^[†‡§]\s*/.test(line)) {
      flushItem();
      currentSection.notes.push(line);
      continue;
    }

    if (!line) {
      flushItem();
      continue;
    }

    // Allows a citation to wrap onto several Markdown lines.
    if (currentItem) {
      currentItem.text += ` ${line}`;
    }
  }

  flushItem();

  return {
    lastUpdated,
    sections: parsedSections.filter(
      (section) => section.items.length
    )
  };
}

function cleanURL(url) {
  let cleaned = url.trim();

  cleaned = cleaned.replace(/[),.;]+$/g, "");

  if (!/^https?:\/\//i.test(cleaned)) {
    cleaned = `https://${cleaned}`;
  }

  return cleaned;
}

function extractLinks(text) {
  const urls = [];

  // Finds https links and bare URLs such as osf.io/preprints/...
  const urlPattern =
    /(?:https?:\/\/[^\s]+|(?:[a-z0-9-]+\.)+[a-z]{2,}\/[^\s]+)/gi;

  const withoutLinks = text.replace(urlPattern, (match) => {
    const url = cleanURL(match);

    if (!urls.includes(url)) {
      urls.push(url);
    }

    return "";
  });

  return {
    text: withoutLinks
      .replace(/\s{2,}/g, " ")
      .replace(/\s+([.,;:])/g, "$1")
      .trim(),
    urls
  };
}

function renderInlineMarkdown(text) {
  let html = escapeHTML(text);

  // Bold Markdown.
  // Sara gets the existing self-author styling hook.
  html = html.replace(
    /\*\*([^*]+)\*\*/g,
    (_, content) => {
      const plain = content.replace(/&amp;/g, "&");

      const className = /Monteiro,\s*S\./i.test(plain)
        ? ' class="self-author"'
        : "";

      return `<strong${className}>${content}</strong>`;
    }
  );

  // Italic Markdown.
  html = html.replace(
    /\*([^*]+)\*/g,
    '<em class="work-title">$1</em>'
  );

  return html;
}

function getStatus(section, citation) {
  const heading = section.heading.toLowerCase();
  const text = citation.toLowerCase();

  if (section.category === "publication") {
    return {
      className: "published",
      label: "Peer reviewed"
    };
  }

  if (section.category === "preprint") {
    return {
      className: "preprint",
      label: "Preprint"
    };
  }

  if (section.category === "manuscript") {
    if (heading.includes("peer review")) {
      return {
        className: "review",
        label: "Under review"
      };
    }

    if (heading.includes("internal review")) {
      return {
        className: "prep",
        label: "Internal review"
      };
    }

    return {
      className: "prep",
      label: "In preparation"
    };
  }

  if (section.category === "conference") {
    if (text.includes("workshop")) {
      return {
        className: "conference",
        label: "Workshop"
      };
    }

    if (
      text.includes("ismrm") ||
      text.includes("conference")
    ) {
      return {
        className: "conference",
        label: "Conference"
      };
    }

    return {
      className: "conference",
      label: "Meeting"
    };
  }

  if (section.category === "software") {
    if (
      text.includes("wiki") ||
      text.includes("documentation")
    ) {
      return {
        className: "software",
        label: "Documentation"
      };
    }

    return {
      className: "software",
      label: "Software"
    };
  }

  if (section.category === "dataset") {
    return {
      className: "dataset",
      label: "Dataset"
    };
  }

  return {
    className: "prep",
    label: "Record"
  };
}

function linkLabel(url) {
  const lower = url.toLowerCase();

  if (lower.includes("doi.org/")) {
    return "DOI ↗";
  }

  if (lower.includes("osf.io/preprints/psyarxiv")) {
    return "PsyArXiv ↗";
  }

  if (lower.includes("github.com/")) {
    return "GitHub ↗";
  }

  if (lower.includes("readthedocs.io")) {
    return "Website ↗";
  }

  if (lower.includes("echo.ismrm.org")) {
    return "Program ↗";
  }

  return "Link ↗";
}

function renderSections(parsedSections) {
  sectionsContainer.innerHTML = parsedSections
    .map((section) => {
      const itemsHTML = section.items
        .map((item) => {
          const { text, urls } = extractLinks(item.text);
          const status = getStatus(section, text);
          const index = String(item.number).padStart(2, "0");

          const linksHTML = urls
            .map(
              (url) => `
                <a
                  href="${escapeHTML(url)}"
                  target="_blank"
                  rel="noopener"
                >
                  ${linkLabel(url)}
                </a>
              `
            )
            .join("");

          return `
            <article
              class="entry"
              data-category="${section.category}"
            >
              <div class="entry-index">${index}</div>

              <div class="entry-body">
                <p class="citation">
                  ${renderInlineMarkdown(text)}
                </p>

                <div class="entry-meta">
                  <span class="status ${status.className}">
                    ${status.label}
                  </span>

                  ${linksHTML}

                  <button
                    class="copy-btn"
                    type="button"
                  >
                    Copy citation
                  </button>
                </div>
              </div>
            </article>
          `;
        })
        .join("");

      const notesHTML = section.notes
        .map(
          (note) => `
            <p class="note">
              ${renderInlineMarkdown(note)}
            </p>
          `
        )
        .join("");

      return `
        <section
          class="citation-section"
          data-section="${section.category}"
        >
          <div class="section-heading">
            <div>
              <p class="section-kicker">
                ${escapeHTML(section.kicker)}
              </p>

              <h2>
                ${escapeHTML(section.heading)}
              </h2>
            </div>

            <span class="section-count">
              ${section.items.length}
            </span>
          </div>

          ${itemsHTML}

          ${notesHTML}
        </section>
      `;
    })
    .join("");

  entries = [
    ...document.querySelectorAll(".entry")
  ];

  sections = [
    ...document.querySelectorAll(".citation-section")
  ];

  bindCopyButtons();
}

function updateView() {
  const query = normalize(
    searchInput.value.trim()
  );

  let visibleCount = 0;

  entries.forEach((entry) => {
    const matchesFilter =
      activeFilter === "all" ||
      entry.dataset.category === activeFilter;

    const matchesSearch =
      !query ||
      normalize(entry.textContent).includes(query);

    const visible =
      matchesFilter &&
      matchesSearch;

    entry.hidden = !visible;

    if (visible) {
      visibleCount += 1;
    }
  });

  sections.forEach((section) => {
    const visibleEntries = [
      ...section.querySelectorAll(".entry")
    ].filter((entry) => !entry.hidden);

    section.hidden =
      visibleEntries.length === 0;

    const count =
      section.querySelector(".section-count");

    if (count) {
      count.textContent =
        visibleEntries.length;
    }
  });

  emptyState.hidden =
    visibleCount !== 0;

  resultsStatus.textContent =
    query || activeFilter !== "all"
      ? `${visibleCount} citation${
          visibleCount === 1 ? "" : "s"
        } shown`
      : "";
}

function showToast(message = "Citation copied") {
  toast.textContent = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 1400);
}

function bindCopyButtons() {
  document
    .querySelectorAll(".copy-btn")
    .forEach((button) => {
      button.addEventListener(
        "click",
        async () => {
          const citation = button
            .closest(".entry")
            .querySelector(".citation")
            .innerText
            .trim();

          try {
            await navigator.clipboard.writeText(
              citation
            );
          } catch {
            const area =
              document.createElement("textarea");

            area.value = citation;

            document.body.appendChild(area);
            area.select();

            document.execCommand("copy");

            area.remove();
          }

          showToast();
        }
      );
    });
}

function preferredTheme() {
  const saved =
    localStorage.getItem("citation-theme");

  if (saved) {
    return saved;
  }

  return window.matchMedia(
    "(prefers-color-scheme: dark)"
  ).matches
    ? "dark"
    : "light";
}

function setTheme(theme) {
  document.documentElement.dataset.theme =
    theme;

  localStorage.setItem(
    "citation-theme",
    theme
  );
}

async function loadCitations() {
  try {
    // Prevent stale Markdown responses.
    const response = await fetch(
      `${MD_PATH}?v=${Date.now()}`,
      {
        cache: "no-store"
      }
    );

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    const markdown =
      await response.text();

    const parsed =
      parseMarkdown(markdown);

    const total =
      parsed.sections.reduce(
        (sum, section) =>
          sum + section.items.length,
        0
      );

    renderSections(parsed.sections);

    recordCount.textContent =
      `${total} record${
        total === 1 ? "" : "s"
      }`;

    updatedDate.textContent =
      parsed.lastUpdated
        ? `Updated ${parsed.lastUpdated}`
        : "Loaded from CITATIONS.md";

    updateView();
  } catch (error) {
    console.error(
      "Could not load CITATIONS.md:",
      error
    );

    recordCount.textContent =
      "Citation list unavailable";

    updatedDate.textContent =
      "Could not read CITATIONS.md";

    sectionsContainer.innerHTML = `
      <div class="empty-state">
        <strong>
          Could not load CITATIONS.md.
        </strong>

        <span>
          Check that CITATIONS.md exists
          in the repository root and
          GitHub Pages has finished deploying.
        </span>
      </div>
    `;
  }
}

searchInput.addEventListener(
  "input",
  updateView
);

filters.forEach((button) => {
  button.addEventListener(
    "click",
    () => {
      activeFilter =
        button.dataset.filter;

      filters.forEach((item) => {
        item.classList.toggle(
          "active",
          item === button
        );
      });

      updateView();
    }
  );
});

setTheme(
  preferredTheme()
);

themeToggle.addEventListener(
  "click",
  () => {
    const next =
      document.documentElement.dataset.theme ===
      "dark"
        ? "light"
        : "dark";

    setTheme(next);
  }
);

loadCitations();
