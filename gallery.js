const imageModules = import.meta.glob(
  "./assets/images/paint-swirls/*.{png,jpg,jpeg,webp,avif,gif,PNG,JPG,JPEG,WEBP,AVIF,GIF}",
  { eager: true, import: "default" },
);

function getFileName(path) {
  return path.split("/").pop() || path;
}

const images = Object.entries(imageModules)
  .map(function ([path, src]) {
    return { src: src, fileName: getFileName(path) };
  })
  .sort(function (a, b) {
    return a.fileName.localeCompare(b.fileName, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });

const grid = document.getElementById("paintGalleryGrid");
const empty = document.getElementById("paintGalleryEmpty");

if (!grid) {
  throw new Error("Gallery container not found.");
}

if (!images.length) {
  if (empty) {
    empty.hidden = false;
  }
} else {
  images.forEach(function (image, index) {
    const item = document.createElement("figure");
    item.className = "paint-gallery-item";

    const img = document.createElement("img");
    img.className = "paint-gallery-image";
    img.src = image.src;
    img.alt = "Paint swirl image " + (index + 1);
    img.loading = "lazy";
    img.decoding = "async";

    item.appendChild(img);
    grid.appendChild(item);
  });
}
