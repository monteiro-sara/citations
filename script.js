const searchInput = document.querySelector("#search-input");
const filters = [...document.querySelectorAll(".filter")];
const entries = [...document.querySelectorAll(".entry")];
const sections = [...document.querySelectorAll(".citation-section")];
const emptyState = document.querySelector("#empty-state");
const resultsStatus = document.querySelector("#results-status");
const toast = document.querySelector(".toast");
const themeToggle = document.querySelector(".theme-toggle");

let activeFilter = "all";

function normalize(value) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function updateView() {
  const query = normalize(searchInput.value.trim());
  let visibleCount = 0;

  entries.forEach((entry) => {
    const matchesFilter = activeFilter === "all" || entry.dataset.category === activeFilter;
    const matchesSearch = !query || normalize(entry.textContent).includes(query);
    const visible = matchesFilter && matchesSearch;
    entry.hidden = !visible;
    if (visible) visibleCount += 1;
  });

  sections.forEach((section) => {
    const visibleEntries = [...section.querySelectorAll(".entry")].filter((entry) => !entry.hidden);
    section.hidden = visibleEntries.length === 0;

    const count = section.querySelector(".section-count");
    if (count) count.textContent = visibleEntries.length;
  });

  emptyState.hidden = visibleCount !== 0;
  resultsStatus.textContent =
    query || activeFilter !== "all"
      ? `${visibleCount} citation${visibleCount === 1 ? "" : "s"} shown`
      : "";
}

searchInput.addEventListener("input", updateView);

filters.forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    filters.forEach((item) => item.classList.toggle("active", item === button));
    updateView();
  });
});

document.querySelectorAll(".copy-btn").forEach((button) => {
  button.addEventListener("click", async () => {
    const citation = button.closest(".entry").querySelector(".citation").innerText.trim();
    try {
      await navigator.clipboard.writeText(citation);
      toast.textContent = "Citation copied";
    } catch {
      const area = document.createElement("textarea");
      area.value = citation;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
      toast.textContent = "Citation copied";
    }
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 1400);
  });
});

function preferredTheme() {
  const saved = localStorage.getItem("citation-theme");
  if (saved) return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("citation-theme", theme);
}

setTheme(preferredTheme());

themeToggle.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  setTheme(next);
});
