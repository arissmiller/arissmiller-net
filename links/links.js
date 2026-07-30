import { categories } from "./catalog.js";

const tabsElement = document.querySelector("[data-category-tabs]");
const panelElement = document.querySelector("[data-link-panel]");
const listElement = document.querySelector("[data-link-list]");
const emptyState = document.querySelector("[data-empty-state]");
const activeLabel = document.querySelector("[data-active-label]");
const resultCount = document.querySelector("[data-result-count]");
const canvas = document.querySelector("[data-circuit-field]");
const linkItems = [...listElement.querySelectorAll("[data-category-id]")];

const allCategory = {
  id: "all",
  label: "All",
  hue: "#f5f7ff",
  links: categories.flatMap((category) => category.links),
};

const catalog = [allCategory, ...categories];

function categoryFromHash() {
  const requestedId = decodeURIComponent(window.location.hash.slice(1))
    .trim()
    .toLowerCase();
  return catalog.find((category) => category.id === requestedId) ?? allCategory;
}

function render(category) {
  const selectedTab = tabsElement.querySelector(
    `[data-category-id="${category.id}"]`,
  );

  tabsElement.querySelectorAll('[role="tab"]').forEach((tab) => {
    const selected = tab === selectedTab;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });

  panelElement.setAttribute("aria-labelledby", selectedTab.id);
  activeLabel.textContent =
    category.id === "all" ? "Everything" : category.label;
  const count = category.links.length;
  resultCount.textContent = `${String(count).padStart(2, "0")} ${
    count === 1 ? "entry" : "entries"
  }`;
  linkItems.forEach((item) => {
    item.hidden =
      category.id !== "all" && item.dataset.categoryId !== category.id;
  });
  listElement.hidden = count === 0;
  emptyState.hidden = count !== 0;
  panelElement.scrollTop = 0;
}

function selectCategory(category, { focus = false } = {}) {
  const nextHash = `#${category.id}`;

  if (window.location.hash !== nextHash) {
    window.location.hash = category.id;
  } else {
    render(category);
  }

  if (focus) {
    tabsElement
      .querySelector(`[data-category-id="${category.id}"]`)
      ?.focus({ preventScroll: true });
  }
}

tabsElement.addEventListener("click", (event) => {
  const tab = event.target.closest('[role="tab"]');
  if (!tab) return;
  const category = catalog.find(
    (candidate) => candidate.id === tab.dataset.categoryId,
  );
  if (category) selectCategory(category);
});

tabsElement.addEventListener("keydown", (event) => {
  const currentTab = event.target.closest('[role="tab"]');
  if (!currentTab) return;

  const currentIndex = catalog.findIndex(
    (category) => category.id === currentTab.dataset.categoryId,
  );
  let nextIndex;

  if (event.key === "ArrowRight" || event.key === "ArrowDown") {
    nextIndex = (currentIndex + 1) % catalog.length;
  } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
    nextIndex = (currentIndex - 1 + catalog.length) % catalog.length;
  } else if (event.key === "Home") {
    nextIndex = 0;
  } else if (event.key === "End") {
    nextIndex = catalog.length - 1;
  } else {
    return;
  }

  event.preventDefault();
  selectCategory(catalog[nextIndex], { focus: true });
});

window.addEventListener("hashchange", () => {
  const category = categoryFromHash();
  const canonicalHash = `#${category.id}`;

  if (window.location.hash !== canonicalHash) {
    window.history.replaceState(null, "", canonicalHash);
  }

  render(category);
});

const initialCategory = categoryFromHash();
if (window.location.hash !== `#${initialCategory.id}`) {
  window.history.replaceState(null, "", `#${initialCategory.id}`);
}
render(initialCategory);

if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  import("./circuit-background.js").then(({ mountCircuitBackground }) => {
    mountCircuitBackground(canvas);
  });
}
