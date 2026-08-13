const paintSwirlModules = import.meta.glob(
  "../assets/images/paint-swirls/*.{png,jpg,jpeg,webp,avif,gif,PNG,JPG,JPEG,WEBP,AVIF,GIF}",
  { eager: true, import: "default" },
);

const outdoorModules = import.meta.glob(
  "../assets/images/outdoors/*.{png,jpg,jpeg,webp,avif,gif,PNG,JPG,JPEG,WEBP,AVIF,GIF}",
  { eager: true, import: "default" },
);

const dialog = document.querySelector("[data-gallery-window]");
const openButtons = [...document.querySelectorAll("[data-gallery]")];
const closeButton = document.querySelector("[data-close-gallery]");
const minimizeButton = document.querySelector("[data-minimize-gallery]");
const maximizeButton = document.querySelector("[data-maximize-gallery]");
const grid = document.querySelector("[data-gallery-grid]");
const imageCount = document.querySelector("[data-image-count]");
const galleryTitle = document.querySelector("[data-gallery-title]");
const galleryPath = document.querySelector("[data-gallery-path]");
const scrollUpButton = document.querySelector("[data-scroll-up]");
const scrollDownButton = document.querySelector("[data-scroll-down]");
const scrollTrack = document.querySelector("[data-scroll-track]");
const scrollThumb = document.querySelector("[data-scroll-thumb]");

let scrollMetrics = {
  maxScroll: 0,
  thumbTravel: 0,
};
let dragStartY = 0;
let dragStartScroll = 0;
let activeOpenButton = null;

const getFileName = (path) => path.split("/").pop() || path;

const getImageName = (fileName) =>
  fileName
    .replace(/\.[^.]+$/, "")
    .replaceAll("-", " ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

const createImageList = (modules) =>
  Object.entries(modules)
    .map(([path, src]) => {
      const fileName = getFileName(path);
      return { src, fileName, name: getImageName(fileName) };
    })
    .sort((a, b) =>
      a.fileName.localeCompare(b.fileName, undefined, {
        numeric: true,
        sensitivity: "base",
      })
    );

const galleries = {
  "paint-swirls": {
    title: "Paint Swirls",
    path: "Paint_Swirls",
    description: "paint swirl photograph",
    images: createImageList(paintSwirlModules),
  },
  outdoors: {
    title: "Outdoors",
    path: "Outdoors",
    description: "outdoor photograph",
    images: createImageList(outdoorModules),
  },
};

if (!dialog || openButtons.length === 0 || !grid) {
  throw new Error("Photograph gallery interface not found.");
}

const renderGallery = (gallery) => {
  grid.replaceChildren();
  grid.scrollTop = 0;
  galleryTitle.textContent = `${gallery.title} / Visual Archive`;
  galleryPath.textContent = `Archive / ${gallery.path}`;
  grid.setAttribute("aria-label", `${gallery.title} photographs`);
  imageCount.textContent = `${gallery.images.length} visual ${gallery.images.length === 1 ? "record" : "records"}`;

  if (gallery.images.length === 0) {
    const empty = document.createElement("p");
    empty.className = "gallery-empty";
    empty.textContent = "This folder is ready for photographs.";
    grid.append(empty);
    return;
  }

  gallery.images.forEach((image) => {
    const item = document.createElement("figure");
    const photograph = document.createElement("img");

    item.className = "gallery-item";
    photograph.className = "gallery-image";
    photograph.src = image.src;
    photograph.alt = `${image.name} ${gallery.description}`;
    photograph.loading = "lazy";
    photograph.decoding = "async";

    item.append(photograph);
    grid.append(item);
  });
};

const updateScrollbar = () => {
  if (!scrollTrack || !scrollThumb) return;

  const maxScroll = Math.max(0, grid.scrollHeight - grid.clientHeight);
  const trackHeight = scrollTrack.clientHeight;
  const visibleRatio =
    grid.scrollHeight > 0 ? grid.clientHeight / grid.scrollHeight : 1;
  const thumbHeight = Math.max(
    40,
    Math.min(trackHeight, trackHeight * visibleRatio)
  );
  const thumbTravel = Math.max(0, trackHeight - thumbHeight);
  const scrollRatio = maxScroll > 0 ? grid.scrollTop / maxScroll : 0;

  scrollMetrics = { maxScroll, thumbTravel };
  scrollThumb.style.height = `${thumbHeight}px`;
  scrollThumb.style.transform = `translateY(${scrollRatio * thumbTravel}px)`;
  scrollThumb.setAttribute(
    "aria-valuenow",
    String(Math.round(scrollRatio * 100))
  );

  if (scrollUpButton) scrollUpButton.disabled = grid.scrollTop <= 0;
  if (scrollDownButton) {
    scrollDownButton.disabled = grid.scrollTop >= maxScroll;
  }
};

const scrollByPageFraction = (direction) => {
  grid.scrollBy({
    top: direction * Math.max(80, grid.clientHeight * 0.35),
    behavior: "auto",
  });
};

const openGallery = (button) => {
  const gallery = galleries[button.dataset.gallery];
  if (!gallery) return;
  activeOpenButton = button;
  renderGallery(gallery);
  dialog.showModal();
  requestAnimationFrame(() => requestAnimationFrame(updateScrollbar));
};

const closeGallery = () => {
  dialog.classList.remove("is-maximized");
  dialog.close();
  activeOpenButton?.focus();
};

openButtons.forEach((button) => {
  button.addEventListener("click", () => openGallery(button));
});
closeButton?.addEventListener("click", closeGallery);
minimizeButton?.addEventListener("click", closeGallery);

maximizeButton?.addEventListener("click", () => {
  const isMaximized = dialog.classList.toggle("is-maximized");
  maximizeButton.setAttribute(
    "aria-label",
    isMaximized ? "Restore gallery" : "Maximize gallery"
  );
  requestAnimationFrame(updateScrollbar);
});

grid.addEventListener("scroll", updateScrollbar, { passive: true });
scrollUpButton?.addEventListener("click", () => scrollByPageFraction(-1));
scrollDownButton?.addEventListener("click", () => scrollByPageFraction(1));

scrollTrack?.addEventListener("pointerdown", (event) => {
  if (event.target !== scrollTrack || !scrollThumb) return;

  const trackRect = scrollTrack.getBoundingClientRect();
  const thumbRect = scrollThumb.getBoundingClientRect();
  const clickY = event.clientY - trackRect.top;
  const thumbTop = thumbRect.top - trackRect.top;

  scrollByPageFraction(clickY < thumbTop ? -1 : 1);
});

scrollThumb?.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  dragStartY = event.clientY;
  dragStartScroll = grid.scrollTop;
  scrollThumb.classList.add("is-dragging");
  scrollThumb.setPointerCapture(event.pointerId);
});

scrollThumb?.addEventListener("pointermove", (event) => {
  if (
    !scrollThumb.hasPointerCapture(event.pointerId) ||
    scrollMetrics.thumbTravel <= 0
  ) {
    return;
  }

  const dragDistance = event.clientY - dragStartY;
  grid.scrollTop =
    dragStartScroll +
    (dragDistance / scrollMetrics.thumbTravel) * scrollMetrics.maxScroll;
});

const stopThumbDrag = (event) => {
  if (scrollThumb?.hasPointerCapture(event.pointerId)) {
    scrollThumb.releasePointerCapture(event.pointerId);
  }
  scrollThumb?.classList.remove("is-dragging");
};

scrollThumb?.addEventListener("pointerup", stopThumbDrag);
scrollThumb?.addEventListener("pointercancel", stopThumbDrag);

dialog.addEventListener("click", (event) => {
  if (event.target === dialog) closeGallery();
});

dialog.addEventListener("close", () => {
  dialog.classList.remove("is-maximized");
});

if ("ResizeObserver" in window && scrollTrack) {
  const resizeObserver = new ResizeObserver(updateScrollbar);
  resizeObserver.observe(grid);
  resizeObserver.observe(scrollTrack);
}
