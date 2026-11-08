const MD_PATH = "./CITATIONS.md";

const searchInput = document.querySelector("#search-input");
const filters = [...document.querySelectorAll(".filter")];
const roleFilters = [...document.querySelectorAll(".role-filter")];
const clearRolesButton = document.querySelector("#clear-roles");
const sectionsContainer = document.querySelector("#citation-sections");
const emptyState = document.querySelector("#empty-state");
const resultsStatus = document.querySelector("#results-status");
const toast = document.querySelector(".toast");
const themeToggle = document.querySelector(".theme-toggle");
const recordCount = document.querySelector("#record-count");
const updatedDate = document.querySelector("#updated-date");

let activeFilter = "all";
const activeRoles = new Set();
let entries = [];
let sections = [];

const SECTION_CONFIG = {
  "peer-reviewed publication": {
    category: "publication",
    kicker: "Published"
  },

  "submitted manuscripts / under peer review": {
    category: "submitted",
    kicker: "Under review"
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

  "international conferences, meetings, workshops": {
    category: "conference",
    kicker: "Conference contributions"
  },

  "conference contributions": {
    category: "conference",
    kicker: "Conference contributions"
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

  if (SECTION_CONFIG[key]) {
    return SECTION_CONFIG[key];
  }

  if (
    key.includes("submitted") ||
    key.includes("under peer review")
  ) {
    return {
      category: "submitted",
      kicker: "Under review"
    };
  }

  if (
    key.includes("dataset") ||
    key.includes("data")
  ) {
    return {
      category: "dataset",
      kicker: "Open data"
    };
  }

  if (
    key.includes("software") ||
    key.includes("tool")
  ) {
    return {
      category: "software",
      kicker: "Open tools"
    };
  }

  if (
    key.includes("meeting") ||
    key.includes("conference") ||
    key.includes("workshop") ||
    key.includes("symposium")
  ) {
    return {
      category: "conference",
      kicker: "Conference contributions"
    };
  }

  if (key.includes("preprint")) {
    return {
      category: "preprint",
      kicker: "Preprint"
    };
  }

  if (
    key.includes("publication") ||
    key.includes("peer-reviewed")
  ) {
    return {
      category: "publication",
      kicker: "Published"
    };
  }

  return {
    category: "manuscript",
    kicker: "Manuscript"
  };
}

function parseMarkdown(md) {
  const lines = md
    .replace(/\r/g, "")
    .split("\n");

  const parsedSections = [];

  let currentSection = null;
  let currentItem = null;
  let currentSubheading = "";
  let lastUpdated = "";

  function flushItem() {
    if (
      currentItem &&
      currentSection
    ) {
      currentItem.text =
        currentItem.text.trim();

      if (currentItem.text) {
        currentSection.items.push(
          currentItem
        );
      }
    }

    currentItem = null;
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();

    const updatedMatch = line.match(
      /^_?Last updated:\s*(.+?)[._]*$/i
    );

    if (updatedMatch) {
      lastUpdated = updatedMatch[1]
        .replace(/\.$/, "")
        .trim();

      continue;
    }

    const headingMatch = line.match(
      /^##\s+(.+)$/
    );

    if (headingMatch) {
      flushItem();

      const heading =
        headingMatch[1].trim();

      const config =
        inferSectionConfig(heading);

      currentSection = {
        heading,
        category: config.category,
        kicker: config.kicker,
        items: [],
        notes: []
      };

      parsedSections.push(
        currentSection
      );
      currentSubheading = "";

      continue;
    }

    if (!currentSection) {
      continue;
    }

    const subheadingMatch = line.match(
      /^###\s+(.+)$/
    );

    if (subheadingMatch) {
      flushItem();
      currentSubheading =
        subheadingMatch[1].trim();
      continue;
    }

    const itemMatch = line.match(
      /^(\d+)\.\s+(.+)$/
    );

    if (itemMatch) {
      flushItem();

      currentItem = {
        number: Number(itemMatch[1]),
        text: itemMatch[2].trim(),
        subheading: currentSubheading
      };

      continue;
    }

    if (/^[†‡§]\s*/.test(line)) {
      flushItem();

      currentSection.notes.push(
        line
      );

      continue;
    }

    if (!line) {
      flushItem();
      continue;
    }

    // Allows a citation to wrap onto
    // several Markdown lines.
    if (currentItem) {
      currentItem.text +=
        ` ${line}`;
    }
  }

  flushItem();

  return {
    lastUpdated,

    sections: parsedSections.filter(
      (section) =>
        section.items.length
    )
  };
}

function cleanURL(url) {
  let cleaned = url.trim();

  cleaned = cleaned.replace(
    /[),.;]+$/g,
    ""
  );

  if (!/^https?:\/\//i.test(cleaned)) {
    cleaned = `https://${cleaned}`;
  }

  return cleaned;
}

function extractLinks(text) {
  const links = [];
  const seen = new Set();

  function addLink(rawURL, label = "") {
    const url = cleanURL(rawURL);
    if (!seen.has(url)) {
      links.push({ url, label });
      seen.add(url);
    }
  }

  // Consume the *whole* Markdown link first, otherwise
  // extracting its URL leaves a broken [label]() behind.
  let cleaned = text.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi,
    (_, label, url) => {
      addLink(url, label);
      return "";
    }
  );

  // Also recognise standalone DOIs, GitHub URLs and
  // bare domains such as osf.io/preprints/...
  const bareURLPattern =
    /(?:https?:\/\/[^\s]+|(?:[a-z0-9-]+\.)+[a-z]{2,}\/[^\s]+)/gi;
  cleaned = cleaned.replace(bareURLPattern, (match) => {
    addLink(match);
    return "";
  });

  return {
    text: cleaned
      .replace(/\(\s*\)/g, "")
      .replace(/\s{2,}/g, " ")
      .replace(/\s+([.,;:])/g, "$1")
      .trim(),
    links
  };
}

function getItemCategory(section, item) {
  // Preprints are sometimes placed under a broader
  // manuscript heading in older CITATIONS.md versions.
  if (/\[Preprint\]|PsyArXiv/i.test(item.text)) {
    return "preprint";
  }
  return section.category;
}

function describeContribution(item) {
  const explicit = [];
  const text = item.text.replace(
    /\*\*\[([^\]]+)\]\*\*/g,
    (_, label) => {
      explicit.push(label);
      return "";
    }
  ).replace(
    /\[(?:Preprint|Poster presentation|Manuscript in preparation|Computer software|Dataset)\]/gi,
    ""
  );
  const copyText = item.text
    .replace(/\*\*/g, "")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/gi, "$1 ($2)")
    .replace(/\s{2,}/g, " ")
    .trim();

  const heading = normalize(item.subheading || "");
  const roleText = normalize(explicit.join(" "));
  const roles = [];

  if (heading.includes("invited oral") || roleText.includes("invited speaker")) {
    roles.push("speaker");
  }
  if (heading.includes("invited panel") || roleText.includes("invited panelist")) {
    roles.push("panelist");
  }

  // Author position applies to scholarly and software
  // outputs, not to a solo invitation to speak.
  let authorship = "";
  if (!roles.includes("speaker") && !roles.includes("panelist")) {
    const title = text.match(/(^|[^*])\*[^*]+\*(?!\*)/);
    const authors = (title ? text.slice(0, title.index) : text)
      .replace(/\*\*/g, "")
      .trim();
    const saraIndex = authors.search(/Monteiro,?\s*S\.?/i);

    if (saraIndex >= 0) {
      const lead = /^Monteiro,?\s*S\.?/i.test(authors);
      const precedingAuthors = authors.slice(0, saraIndex);
      const saraDesignation = authors.slice(saraIndex, saraIndex + 24);
      const equalFirst = !lead &&
        precedingAuthors.includes("†") &&
        /Monteiro,?\s*S\.?\s*†/i.test(saraDesignation);

      authorship = equalFirst ? "Equal first author" :
        lead ? "First author" : "Co-author";
      roles.push(lead || equalFirst ? "first-author" : "co-author");
    }
  }

  const roleDetail = explicit[0] || "";
  return { text: text.trim(), roles, authorship, roleDetail, copyText };
}

function renderInlineMarkdown(text) {
  let html = escapeHTML(text);

  // Bold Markdown.
  // Sara gets the existing
  // self-author styling hook.
  html = html.replace(
    /\*\*([^*]+)\*\*/g,
    (_, content) => {
      const plain =
        content.replace(
          /&amp;/g,
          "&"
        );

      const className =
        /Monteiro,?\s*S\.?/i.test(
          plain
        )
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

function getStatus(
  section,
  citation,
  item,
  roles,
  category
) {
  const heading =
    section.heading.toLowerCase();

  const text =
    citation.toLowerCase();

  if (
    category ===
    "publication"
  ) {
    return {
      className: "published",
      label: "Peer reviewed"
    };
  }

  if (
    category ===
    "submitted"
  ) {
    return {
      className: "review",
      label: "Under review"
    };
  }

  if (
    category ===
    "preprint"
  ) {
    return {
      className: "preprint",
      label: "Preprint"
    };
  }

  if (
    category ===
    "manuscript"
  ) {
    if (
      heading.includes(
        "internal review"
      )
    ) {
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

  if (
    category ===
    "conference"
  ) {
    if (roles.includes("speaker")) {
      return {
        className: "invited",
        label: "Invited speaker"
      };
    }

    if (roles.includes("panelist")) {
      return {
        className: "invited",
        label: "Invited panelist"
      };
    }

    if (/\bposter presentation\b/i.test(item.text)) {
      return {
        className: "conference",
        label: "Poster"
      };
    }

    if (
      text.includes("workshop")
    ) {
      return {
        className: "conference",
        label: "Workshop"
      };
    }

    if (
      text.includes("symposium")
    ) {
      return {
        className: "conference",
        label: "Conference"
      };
    }

    if (
      text.includes("ismrm") ||
      text.includes("conference") ||
      text.includes("congress")
    ) {
      return {
        className: "conference",
        label: "Conference"
      };
    }

    if (
      text.includes("meeting")
    ) {
      return {
        className: "conference",
        label: "Meeting"
      };
    }

    return {
      className: "conference",
      label: "Conference"
    };
  }

  if (
    category ===
    "software"
  ) {
    if (
      text.includes("wiki") ||
      text.includes(
        "documentation"
      )
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

  if (
    category ===
    "dataset"
  ) {
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
  const lower =
    url.toLowerCase();

  if (
    lower.includes("doi.org/")
  ) {
    return "DOI ↗";
  }

  if (
    lower.includes(
      "osf.io/preprints/psyarxiv"
    )
  ) {
    return "PsyArXiv ↗";
  }

  if (
    lower.includes("github.com/")
  ) {
    return "GitHub ↗";
  }

  if (
    lower.includes(
      "readthedocs.io"
    )
  ) {
    return "Website ↗";
  }

  if (
    lower.includes(
      "echo.ismrm.org"
    )
  ) {
    return "Program ↗";
  }

  return "Link ↗";
}

function renderEntry(section, item) {
  const contribution = describeContribution(item);
  const { text, links } = extractLinks(contribution.text);
  const category = getItemCategory(section, item);
  const status = getStatus(
    section, text, item, contribution.roles, category
  );
  const index = String(item.number).padStart(2, "0");

  const linksHTML = links.map(({ url, label }) => `
    <a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">
      ${escapeHTML(label || linkLabel(url))}${label ? " ↗" : ""}
    </a>
  `).join("");

  const authorshipHTML = contribution.authorship ? `
    <span class="authorship-tag">
      ${escapeHTML(contribution.authorship)}
    </span>
  ` : "";

  const detail = contribution.roleDetail
    .replace(/^Invited (?:speaker|panelist)\s*[:—-]\s*/i, "")
    .trim();
  const detailHTML = detail && !/^poster presentation$/i.test(detail)
    ? `<span class="role-detail">${escapeHTML(detail)}</span>`
    : "";

  return `
    <article
      class="entry"
      data-category="${category}"
      data-roles="${contribution.roles.join(" ")}"
      data-copy-text="${escapeHTML(contribution.copyText)}"
    >
      <div class="entry-index">${index}</div>
      <div class="entry-body">
        <p class="citation">${renderInlineMarkdown(text)}</p>
        <div class="entry-meta">
          <span class="status ${status.className}">
            ${status.label}
          </span>
          ${authorshipHTML}
          ${detailHTML}
          ${linksHTML}
          <button class="copy-btn" type="button">Copy citation</button>
        </div>
      </div>
    </article>
  `;
}

function renderSections(
  parsedSections
) {
  sectionsContainer.innerHTML =
    parsedSections
      .map((section) => {
        const groups = [];
        for (const item of section.items) {
          const heading = item.subheading || "";
          let group = groups[groups.length - 1];
          if (!group || group.heading !== heading) {
            group = { heading, items: [] };
            groups.push(group);
          }
          group.items.push(item);
        }

        const itemsHTML = groups.map((group) => `
          <div class="citation-subgroup">
            ${group.heading ? `
              <h3 class="subsection-heading">
                ${escapeHTML(group.heading)}
              </h3>
            ` : ""}
            ${group.items.map((item) => renderEntry(section, item)).join("")}
          </div>
        `).join("");

        const notesHTML =
          section.notes
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
    ...document.querySelectorAll(
      ".entry"
    )
  ];

  sections = [
    ...document.querySelectorAll(
      ".citation-section"
    )
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
      entry.dataset.category ===
        activeFilter;

    const itemRoles = entry.dataset.roles.split(" ").filter(Boolean);
    const matchesRole = activeRoles.size === 0 ||
      [...activeRoles].some((role) => itemRoles.includes(role));

    const matchesSearch =
      !query ||
      normalize(
        entry.textContent
      ).includes(query);

    const visible =
      matchesFilter &&
      matchesRole &&
      matchesSearch;

    entry.hidden = !visible;

    if (visible) {
      visibleCount += 1;
    }
  });

  sections.forEach(
    (section) => {
      section.querySelectorAll(".citation-subgroup").forEach((group) => {
        group.hidden = ![...group.querySelectorAll(".entry")]
          .some((entry) => !entry.hidden);
      });

      const visibleEntries = [
        ...section.querySelectorAll(
          ".entry"
        )
      ].filter(
        (entry) =>
          !entry.hidden
      );

      section.hidden =
        visibleEntries.length === 0;

      const count =
        section.querySelector(
          ".section-count"
        );

      if (count) {
        count.textContent =
          visibleEntries.length;
      }
    }
  );

  emptyState.hidden =
    visibleCount !== 0;

  resultsStatus.textContent =
    query ||
    activeFilter !== "all" ||
    activeRoles.size > 0
      ? `${visibleCount} of ${entries.length} citations shown`
      : "";
}

function showToast(
  message = "Citation copied"
) {
  toast.textContent = message;

  toast.classList.add(
    "show"
  );

  setTimeout(() => {
    toast.classList.remove(
      "show"
    );
  }, 1400);
}

function bindCopyButtons() {
  document
    .querySelectorAll(
      ".copy-btn"
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        async () => {
          const citation =
            button
              .closest(".entry")
              .dataset.copyText;

          try {
            await navigator
              .clipboard
              .writeText(
                citation
              );
          } catch {
            const area =
              document.createElement(
                "textarea"
              );

            area.value =
              citation;

            document.body
              .appendChild(
                area
              );

            area.select();

            document.execCommand(
              "copy"
            );

            area.remove();
          }

          showToast();
        }
      );
    });
}

function preferredTheme() {
  const saved =
    localStorage.getItem(
      "citation-theme"
    );

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
  document.documentElement
    .dataset.theme =
    theme;

  localStorage.setItem(
    "citation-theme",
    theme
  );
}

async function loadCitations() {
  try {
    // Prevent stale Markdown
    // responses.
    const response =
      await fetch(
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
      parseMarkdown(
        markdown
      );

    const total =
      parsed.sections.reduce(
        (
          sum,
          section
        ) =>
          sum +
          section.items.length,
        0
      );

    renderSections(
      parsed.sections
    );

    recordCount.textContent =
      `${total} record${
        total === 1
          ? ""
          : "s"
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

      filters.forEach(
        (item) => {
          item.classList.toggle(
            "active",
            item === button
          );
        }
      );

      updateView();
    }
  );
});

function syncRoleButtons() {
  roleFilters.forEach((button) => {
    const selected = activeRoles.has(button.dataset.role);
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  clearRolesButton.hidden = activeRoles.size === 0;
}

roleFilters.forEach((button) => {
  button.addEventListener("click", () => {
    const role = button.dataset.role;
    if (activeRoles.has(role)) {
      activeRoles.delete(role);
    } else {
      activeRoles.add(role);
    }
    syncRoleButtons();
    updateView();
  });
});

clearRolesButton.addEventListener("click", () => {
  activeRoles.clear();
  syncRoleButtons();
  updateView();
});

setTheme(
  preferredTheme()
);

themeToggle.addEventListener(
  "click",
  () => {
    const next =
      document.documentElement
        .dataset.theme ===
      "dark"
        ? "light"
        : "dark";

    setTheme(next);
  }
);

loadCitations();
