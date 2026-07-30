const imageModules = import.meta.glob(
  "../assets/images/paint-swirls/*.{png,jpg,jpeg,webp,avif,gif,PNG,JPG,JPEG,WEBP,AVIF,GIF}",
  { eager: true, import: "default" },
);

const dialog = document.querySelector("[data-gallery-window]");
const openButton = document.querySelector("[data-open-paint-swirls]");
const closeButton = document.querySelector("[data-close-gallery]");
const minimizeButton = document.querySelector("[data-minimize-gallery]");
const maximizeButton = document.querySelector("[data-maximize-gallery]");
const grid = document.querySelector("[data-gallery-grid]");
const imageCount = document.querySelector("[data-image-count]");
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

const getFileName = (path) => path.split("/").pop() || path;

const getImageName = (fileName) =>
  fileName
    .replace(/\.[^.]+$/, "")
    .replaceAll("-", " ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

const images = Object.entries(imageModules)
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

if (!dialog || !openButton || !grid) {
  throw new Error("Paint Swirls gallery interface not found.");
}

images.forEach((image) => {
  const item = document.createElement("figure");
  const photograph = document.createElement("img");

  item.className = "gallery-item";
  photograph.className = "gallery-image";
  photograph.src = image.src;
  photograph.alt = `${image.name} paint swirl photograph`;
  photograph.loading = "lazy";
  photograph.decoding = "async";

  item.append(photograph);
  grid.append(item);
});

if (imageCount) {
  imageCount.textContent = `${images.length} visual records`;
}

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

const openGallery = () => {
  dialog.showModal();
  requestAnimationFrame(() => requestAnimationFrame(updateScrollbar));
};

const closeGallery = () => {
  dialog.classList.remove("is-maximized");
  dialog.close();
  openButton.focus();
};

openButton.addEventListener("click", openGallery);
closeButton?.addEventListener("click", closeGallery);
minimizeButton?.addEventListener("click", closeGallery);

maximizeButton?.addEventListener("click", () => {
  const isMaximized = dialog.classList.toggle("is-maximized");
  maximizeButton.setAttribute(
    "aria-label",
    isMaximized ? "Restore Paint Swirls" : "Maximize Paint Swirls"
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
