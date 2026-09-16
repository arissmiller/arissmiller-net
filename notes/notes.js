const noteLinks = document.querySelectorAll('.file-link[href^="#note-"]');

function markCurrentNote() {
  const currentHash = window.location.hash;

  noteLinks.forEach((link) => {
    const isCurrent = currentHash
      ? link.hash === currentHash
      : link.classList.contains("file-link-default");

    if (isCurrent) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

function keepWindowAt(x, y) {
  window.scrollTo(x, y);

  requestAnimationFrame(() => {
    window.scrollTo(x, y);
  });
}

noteLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();

    if (window.location.hash !== link.hash) {
      const scrollX = window.scrollX;
      const scrollY = window.scrollY;

      window.location.hash = link.hash;
      keepWindowAt(scrollX, scrollY);
    }

    markCurrentNote();
  });
});

window.addEventListener("hashchange", markCurrentNote);
window.addEventListener("popstate", markCurrentNote);
markCurrentNote();
