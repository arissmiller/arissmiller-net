import { categories } from "./catalog.js";

document.documentElement.classList.add("has-js");

const tabsElement = document.querySelector("[data-category-tabs]");
const panelElement = document.querySelector("[data-link-panel]");
const listElement = document.querySelector("[data-link-list]");
const linkIndex = document.querySelector(".link-index");
const emptyState = document.querySelector("[data-empty-state]");
const activeLabel = document.querySelector("[data-active-label]");
const resultCount = document.querySelector("[data-result-count]");
const canvas = document.querySelector("[data-circuit-field]");
const linkItems = [...listElement.querySelectorAll("[data-category-id]")];
const detail = document.querySelector("[data-link-detail]");
const detailCategory = document.querySelector("[data-detail-category]");
const detailKind = document.querySelector("[data-detail-kind]");
const detailTitle = document.querySelector("[data-detail-title]");
const detailDescription = document.querySelector("[data-detail-description]");
const detailDomain = document.querySelector("[data-detail-domain]");
const detailLink = document.querySelector("[data-detail-link]");

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

function selectLink(item) {
  if (!item || item.hidden) return;

  linkItems.forEach((candidate) => {
    candidate.dataset.selected = String(candidate === item);
  });

  const sourceLink = item.querySelector(".catalog-link");
  const sourceKind = item.querySelector(".link-kind");
  const personal = sourceKind.classList.contains("link-kind-personal");
  const domain = new URL(sourceLink.href).hostname.replace(/^www\./, "");

  detail.style.setProperty(
    "--detail-hue",
    item.style.getPropertyValue("--category-hue"),
  );
  detailCategory.textContent = item.querySelector(".link-category").textContent;
  detailKind.textContent = personal ? "Personal pick" : "Resource";
  detailKind.classList.toggle("link-kind-personal", personal);
  detailKind.classList.toggle("link-kind-resource", !personal);
  detailTitle.textContent = item.querySelector(".link-title").textContent;
  detailDescription.textContent = item.querySelector(
    ".link-description",
  ).textContent;
  detailDomain.textContent = domain;
  detailLink.href = sourceLink.href;
  detailLink.setAttribute(
    "aria-label",
    `Visit ${detailTitle.textContent}. Opens in a new tab.`,
  );
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
  detail.hidden = count === 0;
  linkIndex.scrollTop = 0;
  selectLink(linkItems.find((item) => !item.hidden));
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

listElement.addEventListener("click", (event) => {
  const link = event.target.closest(".catalog-link");
  if (
    !link ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return;
  }

  event.preventDefault();
  selectLink(link.closest(".link-item"));
});

listElement.addEventListener("keydown", (event) => {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;

  const current = event.target.closest(".link-item");
  if (!current) return;
  const visibleItems = linkItems.filter((item) => !item.hidden);
  const currentIndex = visibleItems.indexOf(current);
  const direction = event.key === "ArrowDown" ? 1 : -1;
  const nextIndex =
    (currentIndex + direction + visibleItems.length) % visibleItems.length;

  event.preventDefault();
  selectLink(visibleItems[nextIndex]);
  visibleItems[nextIndex].querySelector(".catalog-link").focus();
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
