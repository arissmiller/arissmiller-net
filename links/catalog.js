/**
 * @typedef {Object} InterestingThing
 * @property {string} title
 * @property {string} [creator]
 * @property {"music"|"games"|"books"|"film"|"web"|"other"} category
 * @property {"recommendation"|"resource"} [role]
 * @property {string} description
 * @property {string} [image]
 * @property {string} [imageAlt]
 * @property {string|number} [year]
 * @property {string} [embedUrl]
 * @property {{label: string, url: string}[]} links
 */

export const categories = [
  { id: "all", label: "All", hue: "#4da3ff" },
  { id: "music", label: "Music", hue: "#ff5cce" },
  { id: "games", label: "Games", hue: "#72e681" },
  { id: "books", label: "Books", hue: "#ffc857" },
  { id: "film", label: "Film", hue: "#ff5d6c" },
  { id: "web", label: "Web", hue: "#36dff8" },
  { id: "other", label: "Other", hue: "#ad8cff" },
];

/** @type {InterestingThing[]} */
export const things = [
  {
    title: "Mirror's Edge Original Videogame Score",
    creator: "Solar Fields",
    category: "music",
    role: "recommendation",
    description:
      "Airy ambient electronics and propulsive rhythms that capture the game's clean, restless cityscape.",
    year: 2009,
    image: "/assets/images/interesting-things/mirrors-edge-soundtrack.jpg",
    links: [
      {
        label: "Listen on Spotify",
        url: "https://open.spotify.com/album/07igNBjUqmgregGtDpnTNg?si=hx0Df4tbT5W5_VsHg7IdPQ",
      },
    ],
  },
  {
    title: "TRON: Legacy",
    creator: "Daft Punk",
    category: "music",
    role: "recommendation",
    description:
      "A huge, precise blend of orchestral scoring and Daft Punk's electronic sound.",
    year: 2010,
    image:"/assets/images/interesting-things/tron-legacy-soundtrack.jpg",
    links: [
      {
        label: "Listen on Spotify",
        url: "https://open.spotify.com/album/3AMXFnwHWXCvNr5NCCpLZI?si=1DSI8ZlTQ2SsVFxOB0FifQ",
      },
    ],
  },
  {
    title: "Protocol 7: First Sequence",
    creator: "Noah B",
    category: "music",
    role: "recommendation",
    description:
      "A euphoric blend of trance, ambient, drum and bass, and wave with a distinctly early-digital atmosphere.",
    year: 2023,
    image: "/assets/images/interesting-things/protocol-7.jpg",
    links: [
      {
        label: "Listen on Bandcamp",
        url: "https://thisisnoahb.bandcamp.com/album/protocol-7-first-sequence",
      },
    ],
  },
  {
    title: "Neon White Soundtrack",
    creator: "Machine Girl",
    category: "music",
    role: "recommendation",
    description:
      "Two volumes of breakcore, drum and bass, footwork, and jungle that give the game its relentless momentum.",
    year: 2022,
    image: "/assets/images/interesting-things/neon-white-soundtrack.jpg",
    links: [
      {
        label: "Listen to OST 1",
        url: "https://machinegirl.bandcamp.com/album/neon-white-ost-1-the-wicked-heart",
      },
      {
        label: "Listen to OST 2",
        url: "https://machinegirl.bandcamp.com/album/neon-white-ost-2-the-burn-that-cures",
      },
    ],
  },
  {
    title: "Skitzofrenia Simulation",
    creator: "Sewerslvt",
    category: "music",
    role: "recommendation",
    description:
      "A dense, atmospheric jungle and drum-and-bass album that moves between abrasion, melancholy, and release.",
    year: 2021,
    image: "/assets/images/interesting-things/skitzofrenia-simulation.jpg",
    links: [
      {
        label: "Listen on Bandcamp",
        url: "https://sewerslvt.bandcamp.com/album/skitzofrenia-simulation",
      },
    ],
  },
  {
    title: "Katana ZERO",
    creator: "Askiisoft",
    category: "games",
    role: "recommendation",
    description:
      "A razor-sharp action platformer built around instant retries, time manipulation, and a fractured neo-noir story.",
    year: 2019,
    image: "/assets/images/interesting-things/katana-zero.jpg",
    links: [
      {
        label: "View on Steam",
        url: "https://store.steampowered.com/app/460950/Katana_ZERO/",
      },
    ],
  },
  {
    title: "Neon White",
    creator: "Angel Matrix",
    category: "games",
    role: "recommendation",
    description:
      "A fast, expressive first-person platformer where every level becomes a puzzle about finding the perfect line.",
    year: 2022,
    image: "/assets/images/interesting-things/neon-white.jpg",
    links: [
      {
        label: "View on Steam",
        url: "https://store.steampowered.com/app/1533420/Neon_White/",
      },
    ],
  },
  {
    title: "Portal 2",
    creator: "Valve",
    category: "games",
    role: "recommendation",
    description:
      "An inventive, funny puzzle game that is still unmatched at teaching ideas through play—and then twisting them.",
    year: 2011,
    image: "/assets/images/interesting-things/portal-2.jpg",
    links: [
      {
        label: "View on Steam",
        url: "https://store.steampowered.com/app/620/Portal_2/",
      },
    ],
  },
  {
    title: "The Public Domain Review",
    category: "books",
    role: "resource",
    description:
      "Curious works, images, and ideas rescued from the history of the public domain.",
    image: "/assets/images/interesting-things/public-domain-review.jpg",
    links: [{ label: "Start reading", url: "https://publicdomainreview.org/" }],
  },
  {
    title: "Wikisource",
    category: "books",
    role: "resource",
    image: "/assets/images/interesting-things/wikisource.png",
    description:
      "A free library of source texts, historical documents, translations, and public-domain books.",
    links: [
      { label: "Open the library", url: "https://en.wikisource.org/wiki/Main_Page" },
    ],
  },
  {
    title: "Project Gutenberg",
    category: "books",
    role: "resource",
    image: "/assets/images/interesting-things/project-gutenberg.svg",
    description:
      "A volunteer-built library of free ebooks, with a focus on older works whose copyrights have expired.",
    links: [{ label: "Browse books", url: "https://www.gutenberg.org/" }],
  },
];
