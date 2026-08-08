import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { defineConfig } from "vite";
import { marked } from "marked";
import { categories as linkCategories } from "./links/catalog.js";

const NOTES_DIRECTORY = fileURLToPath(
  new URL("./notes/content/", import.meta.url),
);

const FILE_ICON = `
  <svg class="file-icon" viewBox="0 0 20 20" aria-hidden="true">
    <path d="M4 1.8h7l4.8 4.8v11.6H4z" />
    <path d="M11 1.8v4.8h4.8" />
    <path d="M7 10h5.8M7 13h5.8" />
  </svg>
`;

const FOLDER_ICON = `
  <svg class="folder-icon" viewBox="0 0 20 20" aria-hidden="true">
    <path d="M1.8 4.8h6l1.7-2h8.7v13.5H1.8z" />
    <path d="M1.8 7h16.4" />
  </svg>
`;

function escapeAttribute(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function readNotes(directory = NOTES_DIRECTORY, relativeDirectory = "") {
  const notes = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    const relativePath = path.posix.join(relativeDirectory, entry.name);

    if (entry.isDirectory()) {
      notes.push(...readNotes(absolutePath, relativePath));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      notes.push({
        absolutePath,
        content: readFileSync(absolutePath, "utf8"),
        filename: entry.name,
        path: relativePath,
      });
    }
  }

  return notes.sort((a, b) => a.path.localeCompare(b.path));
}

function createNoteId(notePath) {
  return `note-${notePath
    .replace(/\.md$/i, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()}`;
}

function createNoteTree(notes) {
  const root = { directories: new Map(), files: [] };

  notes.forEach((note, index) => {
    note.id = createNoteId(note.path);
    note.isDefault = index === 0;

    const segments = note.path.split("/");
    let directory = root;

    for (const segment of segments.slice(0, -1)) {
      if (!directory.directories.has(segment)) {
        directory.directories.set(segment, {
          directories: new Map(),
          files: [],
        });
      }

      directory = directory.directories.get(segment);
    }

    directory.files.push(note);
  });

  return root;
}

function renderNoteTree(directory) {
  const folders = [...directory.directories.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([folderName, childDirectory]) => `
        <li class="folder-item">
          <details open>
            <summary class="folder-row">
              ${FOLDER_ICON}
              <span class="folder-label">${escapeAttribute(folderName)}</span>
            </summary>
            <ul class="directory-children">
              ${renderNoteTree(childDirectory)}
            </ul>
          </details>
        </li>
      `,
    );

  const files = [...directory.files]
    .sort((a, b) => a.filename.localeCompare(b.filename))
    .map(
      (note) => `
        <li class="file-item">
          <a
            class="file-link${note.isDefault ? " file-link-default" : ""}"
            href="#${note.id}"
            title="${escapeAttribute(note.path)}"
          >
            ${FILE_ICON}
            <span class="file-label">${escapeAttribute(note.filename)}</span>
          </a>
        </li>
      `,
    );

  return [...folders, ...files].join("");
}

function renderNoteView(note) {
  return `
    <section
      class="preview-pane note-view${note.isDefault ? " note-view-default" : ""}"
      id="${note.id}"
      aria-labelledby="current-file-${note.id}"
    >
      <div class="preview-toolbar">
        <div class="file-tab">
          ${FILE_ICON.replace('class="file-icon"', 'class="file-tab-icon"')}
          <span id="current-file-${note.id}">${escapeAttribute(note.filename)}</span>
        </div>
        <div class="preview-mode">
          <span aria-hidden="true">◇</span>
          Preview
        </div>
      </div>

      <div class="preview-scroll">
        <article class="markdown-preview">
          ${marked.parse(note.content)}
        </article>
      </div>

      <footer class="preview-status">
        <span>${escapeAttribute(note.path)} · rendered markdown</span>
      </footer>
    </section>
  `;
}

function renderActiveNoteStyles(notes) {
  const selectors = [
    ".workspace-body:not(:has(.note-view:target)) .file-link-default",
    ...notes.map(
      (note) =>
        `.workspace-body:has(#${note.id}:target) .file-link[href="#${note.id}"]`,
    ),
  ].join(",\n");

  return `
    <style>
      ${selectors} {
        --file-color: #123f57;
        --file-border: rgba(4, 126, 191, 0.27);
        --file-background: linear-gradient(
          90deg,
          rgba(255, 255, 255, 0.88),
          rgba(220, 247, 255, 0.65)
        );
        --file-shadow: 0 0.35rem 1rem rgba(25, 118, 166, 0.08);
        --file-marker: linear-gradient(
          to bottom,
          var(--red) 0 64%,
          var(--amber) 64% 100%
        );
      }
    </style>
  `;
}

function staticNotes() {
  return {
    name: "static-notes",
    transformIndexHtml: {
      order: "pre",
      handler(html, context) {
        if (!context.filename.endsWith(path.join("notes", "index.html"))) {
          return html;
        }

        const notes = readNotes();
        const tree = createNoteTree(notes);
        const count = String(notes.length).padStart(2, "0");
        const label = `${notes.length} ${notes.length === 1 ? "note" : "notes"}`;

        return html
          .replace(
            "<!-- NOTES_COUNT -->",
            `<span class="file-count" aria-label="${label}">${count}</span>`,
          )
          .replace("<!-- NOTES_TREE -->", renderNoteTree(tree))
          .replace(
            "<!-- NOTES_VIEWS -->",
            notes.length > 0
              ? notes.map(renderNoteView).join("")
              : '<p class="error-note">No Markdown files were found.</p>',
          )
          .replace("</head>", `${renderActiveNoteStyles(notes)}</head>`);
      },
    },
    generateBundle() {
      for (const note of readNotes()) {
        this.emitFile({
          type: "asset",
          fileName: `notes/source/${note.path}`,
          source: note.content,
        });
      }
    },
  };
}

function renderLinkTabs() {
  const categories = [
    {
      id: "all",
      label: "All",
      hue: "#f5f7ff",
      links: linkCategories.flatMap((category) => category.links),
    },
    ...linkCategories,
  ];

  return categories
    .map(
      (category, index) => `
        <div
          class="category-tab-frame"
          style="--category-hue: ${escapeAttribute(category.hue)}"
        >
          <button
            class="category-tab"
            id="category-tab-${escapeAttribute(category.id)}"
            data-category-id="${escapeAttribute(category.id)}"
            type="button"
            role="tab"
            aria-controls="link-panel"
            aria-selected="${category.id === "all"}"
            tabindex="${category.id === "all" ? "0" : "-1"}"
          >
            <span class="category-index">${String(index).padStart(2, "0")}</span>
            <span class="category-label">${escapeAttribute(category.label)}</span>
            <span class="category-total">
              ${String(category.links.length).padStart(2, "0")} entries
            </span>
          </button>
        </div>
      `,
    )
    .join("");
}

function renderLinkItems() {
  return linkCategories
    .flatMap((category) =>
      category.links.map((link) => {
        const domain = new URL(link.url).hostname.replace(/^www\./, "");
        const kind = link.kind === "personal" ? "personal" : "resource";
        const kindLabel = kind === "personal" ? "Personal pick" : "Resource";
        return `
          <li
            class="link-item"
            data-category-id="${escapeAttribute(category.id)}"
            style="--category-hue: ${escapeAttribute(category.hue)}"
          >
            <a
              class="catalog-link"
              href="${escapeAttribute(link.url)}"
              target="_blank"
              rel="noopener noreferrer"
            >
              <div class="link-copy">
                <h3 class="link-title">${escapeAttribute(link.title)}</h3>
                <p class="link-description">${escapeAttribute(link.description)}</p>
              </div>
              <div class="link-meta">
                <span class="link-tags">
                  <span class="link-category">${escapeAttribute(category.label)}</span>
                  <span class="link-kind link-kind-${kind}">${kindLabel}</span>
                </span>
                <span class="link-domain">${escapeAttribute(domain)}</span>
              </div>
              <span class="external-mark" aria-hidden="true">↗</span>
            </a>
          </li>
        `;
      }),
    )
    .join("");
}

function renderLinkDetail() {
  const category = linkCategories[0];
  const link = category.links[0];
  const domain = new URL(link.url).hostname.replace(/^www\./, "");
  const kind = link.kind === "personal" ? "personal" : "resource";
  const kindLabel = kind === "personal" ? "Personal pick" : "Resource";

  return `
    <aside
      class="link-detail"
      style="--detail-hue: ${escapeAttribute(category.hue)}"
      data-link-detail
      aria-live="polite"
    >
      <div class="detail-tags">
        <span class="detail-category" data-detail-category>${escapeAttribute(category.label)}</span>
        <span class="link-kind link-kind-${kind}" data-detail-kind>${kindLabel}</span>
      </div>
      <div class="detail-copy">
        <h3 data-detail-title>${escapeAttribute(link.title)}</h3>
        <p data-detail-description>${escapeAttribute(link.description)}</p>
      </div>
      <div class="detail-action">
        <span data-detail-domain>${escapeAttribute(domain)}</span>
        <a
          href="${escapeAttribute(link.url)}"
          target="_blank"
          rel="noopener noreferrer"
          data-detail-link
        >Visit site <span aria-hidden="true">↗</span></a>
      </div>
    </aside>
  `;
}

function staticLinks() {
  return {
    name: "static-links",
    transformIndexHtml: {
      order: "pre",
      handler(html, context) {
        if (!context.filename.endsWith(path.join("links", "index.html"))) {
          return html;
        }

        return html
          .replace("<!-- LINKS_TABS -->", renderLinkTabs())
          .replace("<!-- LINKS_ITEMS -->", renderLinkItems())
          .replace("<!-- LINKS_DETAIL -->", renderLinkDetail());
      },
    },
  };
}

const TYPEWRITER_START_SECONDS = 1.95;
const TYPEWRITER_BASE_SECONDS = 0.04;
const TYPEWRITER_VARIATION_SECONDS = [
  -0.012, 0.006, -0.004, 0.013, -0.008, 0.003, 0.009, -0.006, 0.002,
];

function getTypingInterval(unit, unitIndex) {
  if (unit.type === "space") {
    return 0.055;
  }

  if (/[.!?]/.test(unit.character)) {
    return 0.18;
  }

  if (/[,;:]/.test(unit.character)) {
    return 0.11;
  }

  if (unit.character === "-") {
    return 0.065;
  }

  return (
    TYPEWRITER_BASE_SECONDS +
    TYPEWRITER_VARIATION_SECONDS[
      unitIndex % TYPEWRITER_VARIATION_SECONDS.length
    ]
  );
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderTypewriter(source) {
  const normalizedSource = source.replace(/\s+/g, " ").trim();
  const sourceParts = normalizedSource.split(/(<\/?strong>)/);
  const units = [];
  let emphasized = false;

  for (const part of sourceParts) {
    if (part === "<strong>") {
      emphasized = true;
      continue;
    }

    if (part === "</strong>") {
      emphasized = false;
      continue;
    }

    for (const character of part) {
      units.push(
        character === " "
          ? { type: "space" }
          : { type: "character", character, emphasized },
      );
    }
  }

  const characterUnits = units.filter((unit) => unit.type === "character");
  const finalCharacter = characterUnits.at(-1);
  const renderedWords = [];
  let renderedWord = [];
  let nextDelay = TYPEWRITER_START_SECONDS;

  units.forEach((unit, unitIndex) => {
    unit.delay = nextDelay;
    nextDelay += getTypingInterval(unit, unitIndex);
  });

  const finishWord = () => {
    if (renderedWord.length === 0) {
      return;
    }

    renderedWords.push(`<span class="typed-word">${renderedWord.join("")}</span>`);
    renderedWord = [];
  };

  units.forEach((unit, unitIndex) => {
    if (unit.type === "space") {
      finishWord();
      renderedWords.push(" ");
      return;
    }

    const nextCharacter = units.find(
      (candidate, candidateIndex) =>
        candidateIndex > unitIndex && candidate.type === "character",
    );
    const cursorDuration =
      nextCharacter === undefined
        ? TYPEWRITER_BASE_SECONDS
        : nextCharacter.delay - unit.delay;
    const element = unit.emphasized ? "strong" : "span";
    const finalClass = unit === finalCharacter ? " typed-character-final" : "";

    renderedWord.push(
      `<${element} class="typed-character${finalClass}" style="--character-delay: ${unit.delay.toFixed(3)}s; --cursor-duration: ${cursorDuration.toFixed(3)}s">${escapeHtml(unit.character)}</${element}>`,
    );
  });

  finishWord();

  return [
    '<span class="visually-hidden">',
    normalizedSource,
    "</span>",
    '<span class="typed-text" aria-hidden="true">',
    renderedWords.join(""),
    "</span>",
  ].join("");
}

function typewriterTagline() {
  return {
    name: "typewriter-tagline",
    transformIndexHtml(html) {
      return html.replace(
        /<p class="tagline" data-typewriter>([\s\S]*?)<\/p>/,
        (_, source) => `<p class="tagline">${renderTypewriter(source)}</p>`,
      );
    },
  };
}

export default defineConfig({
  plugins: [typewriterTagline(), staticNotes(), staticLinks()],
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        projects: fileURLToPath(
          new URL("./projects/index.html", import.meta.url),
        ),
        isometricBackgroundGenerator: fileURLToPath(
          new URL(
            "./projects/isometric-background-generator/index.html",
            import.meta.url,
          ),
        ),
        circuitsLikeFreeways: fileURLToPath(
          new URL(
            "./projects/circuits-like-freeways/index.html",
            import.meta.url,
          ),
        ),
        topographyGenerator: fileURLToPath(
          new URL(
            "./projects/topography-generator/index.html",
            import.meta.url,
          ),
        ),
        voronoiGenerator: fileURLToPath(
          new URL(
            "./projects/voronoi-generator/index.html",
            import.meta.url,
          ),
        ),
        animatedVoronoiField: fileURLToPath(
          new URL(
            "./projects/animated-voronoi-field/index.html",
            import.meta.url,
          ),
        ),
        photographs: fileURLToPath(
          new URL("./photographs/index.html", import.meta.url),
        ),
        notes: fileURLToPath(new URL("./notes/index.html", import.meta.url)),
        links: fileURLToPath(new URL("./links/index.html", import.meta.url)),
        snake: fileURLToPath(new URL("./snake.html", import.meta.url)),
        gallery: fileURLToPath(new URL("./gallery.html", import.meta.url)),
      },
    },
  },
  preview: {
    allowedHosts: ["arissmiller.net", "arissmiller-net-production.up.railway.app"],
  },
});
