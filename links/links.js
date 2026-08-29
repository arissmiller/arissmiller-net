import { categories, things } from "./catalog.js";

document.documentElement.classList.add("has-js");

const root = document.documentElement;
const tabsElement = document.querySelector("[data-category-tabs]");
const panelElement = document.querySelector("[data-catalog-panel]");
const listElement = document.querySelector("[data-catalog-list]");
const scrollElement = document.querySelector("[data-catalog-scroll]");
const emptyState = document.querySelector("[data-empty-state]");
const activeLabel = document.querySelector("[data-active-label]");
const resultCount = document.querySelector("[data-result-count]");
const canvas = document.querySelector("[data-circuit-field]");
const cards = [...listElement.querySelectorAll("[data-category-id]")];
let circuitController;

function categoryFromHash() {
  const requestedId = decodeURIComponent(window.location.hash.slice(1))
    .trim()
    .toLowerCase();
  return categories.find(({ id }) => id === requestedId) ?? categories[0];
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

  const visibleThings =
    category.id === "all"
      ? things
      : things.filter((thing) => thing.category === category.id);

  panelElement.setAttribute("aria-labelledby", selectedTab.id);
  root.style.setProperty("--active-accent", category.hue);
  activeLabel.textContent = category.label.toUpperCase();
  resultCount.textContent = `${String(visibleThings.length).padStart(2, "0")} ${
    visibleThings.length === 1 ? "entry" : "entries"
  }`;

  cards.forEach((card) => {
    card.hidden =
      category.id !== "all" && card.dataset.categoryId !== category.id;
  });
  listElement.hidden = visibleThings.length === 0;
  emptyState.hidden = visibleThings.length !== 0;
  scrollElement.scrollTop = 0;
  circuitController?.setAccent(category.hue);
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
  const category = categories.find(({ id }) => id === tab.dataset.categoryId);
  if (category) selectCategory(category);
});

tabsElement.addEventListener("keydown", (event) => {
  const currentTab = event.target.closest('[role="tab"]');
  if (!currentTab) return;

  const currentIndex = categories.findIndex(
    ({ id }) => id === currentTab.dataset.categoryId,
  );
  let nextIndex;

  if (event.key === "ArrowRight" || event.key === "ArrowDown") {
    nextIndex = (currentIndex + 1) % categories.length;
  } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
    nextIndex = (currentIndex - 1 + categories.length) % categories.length;
  } else if (event.key === "Home") {
    nextIndex = 0;
  } else if (event.key === "End") {
    nextIndex = categories.length - 1;
  } else {
    return;
  }

  event.preventDefault();
  selectCategory(categories[nextIndex], { focus: true });
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
    circuitController = mountCircuitBackground(canvas, {
      accent: categoryFromHash().hue,
    });
    window.addEventListener("pagehide", () => circuitController.destroy(), {
      once: true,
    });
  });
}
