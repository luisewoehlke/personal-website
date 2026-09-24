const year = document.getElementById("year");
if (year) {
  year.textContent = String(new Date().getFullYear());
}

const siteHeader = document.querySelector(".site-header");
const peachSticker = document.querySelector(".sticker-peach");
const placePeachSticker = () => {
  if (!peachSticker || !siteHeader) return;
  if (siteHeader.classList.contains("is-hidden")) return;
  const brand = siteHeader.querySelector(".site-brand");
  if (!brand) return;
  const box = brand.getBoundingClientRect();
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  peachSticker.style.left = `${box.left - 1.85 * rem}px`;
  peachSticker.style.top = `${box.bottom - 1.7 * rem}px`;
};
if (siteHeader) {
  let lastScrollY = window.scrollY;
  let headerHidden = false;
  const updateHeader = () => {
    const scrollY = window.scrollY;
    const delta = scrollY - lastScrollY;
    if (scrollY <= 0) headerHidden = false;
    else if (delta > 8) headerHidden = true;
    else if (delta < -8) headerHidden = false;
    siteHeader.classList.toggle("is-hidden", headerHidden);
    document
      .querySelector(".site-header-bg")
      ?.classList.toggle("is-hidden", headerHidden);
    lastScrollY = scrollY;
  };
  const syncHeaderHeight = () => {
    document.documentElement.style.setProperty(
      "--header-h",
      `${siteHeader.offsetHeight}px`
    );
    placePeachSticker();
  };
  syncHeaderHeight();
  window.addEventListener("resize", syncHeaderHeight);
  window.addEventListener("scroll", updateHeader, { passive: true });
  placePeachSticker();
}

const landingScrollHint = document.querySelector(".landing .scroll-hint");
if (landingScrollHint) {
  const updateScrollHint = () => {
    landingScrollHint.classList.toggle("is-hidden", window.scrollY > 0);
  };
  updateScrollHint();
  window.addEventListener("scroll", updateScrollHint, { passive: true });
}

const backgroundStickers = () =>
  document.querySelectorAll(
    ".landing-sticker-back .sticker, .landing-stickers .sticker, .sticker-peach"
  );

let piledHint = null;
const stickerRestCenters = new WeakMap();

const applyStickerPile = (el, x, y, duration = "0.5s", delay = "0s") => {
  el.style.transform = "";
  el.style.transition = `translate ${duration} cubic-bezier(0.22, 0.8, 0.24, 1) ${delay}`;
  el.style.translate = `${x}px ${y}px 0px`;
};

const cacheStickerRestCenters = (stickers) => {
  stickers.forEach((el) => {
    if (stickerRestCenters.has(el)) return;
    const box = el.getBoundingClientRect();
    stickerRestCenters.set(el, {
      x: box.left + box.width / 2,
      y: box.top + box.height / 2,
    });
  });
};

const clearStickerRestCenters = () => {
  backgroundStickers().forEach((el) => stickerRestCenters.delete(el));
};

const spreadBackgroundStickers = () => {
  backgroundStickers().forEach((el) =>
    applyStickerPile(el, 0, 0, "0.65s", "0.1s")
  );
  document.body.classList.remove("is-piling-stickers");
  document.querySelectorAll(".scroll-hint.is-gathering").forEach((hint) => {
    hint.classList.remove("is-gathering");
  });
  piledHint = null;
};

const pileBackgroundStickers = (hint) => {
  if (!hint) return;
  const stickers = [...backgroundStickers()];
  if (!stickers.length) return;
  cacheStickerRestCenters(stickers);
  const arrow = hint.querySelector("svg") || hint;
  const arrowBox = arrow.getBoundingClientRect();
  const lift = window.innerHeight * 0.1;
  const isLanding = Boolean(hint.closest(".landing"));
  const pileX = arrowBox.left + arrowBox.width / 2;
  const pileY = arrowBox.bottom - lift + (isLanding ? 22 : 12);
  const n = stickers.length;
  stickers.forEach((el, i) => {
    const rest = stickerRestCenters.get(el);
    const t = (i / n) * Math.PI * 2;
    const drop = isLanding
      ? ((i * 5 + 3) % n) / Math.max(1, n - 1)
      : 0;
    const tail = Math.pow(drop, 2.7);
    const jitterX = Math.cos(t * 1.55 + 0.4) * (isLanding ? 16 + tail * 22 : 30);
    const topSink =
      isLanding && tail < 0.38 && Math.sin(t * 2.1 + 0.7) > -0.25 ? 22 : 0;
    const midSink =
      isLanding && tail >= 0.18 && tail < 0.62 && Math.cos(t * 1.7 + 0.4) > -0.15
        ? 14
        : 0;
    const jitterY = isLanding
      ? 2 +
        Math.abs(Math.sin(t * 1.2 + 0.15)) * 10 +
        tail * 50 +
        topSink +
        midSink
      : 6 + Math.abs(Math.sin(t * 1.2 + 0.15)) * 28;
    const sushiShift =
      el.classList.contains("sticker-maki") ||
      el.classList.contains("sticker-nigiri")
        ? 16
        : 0;
    const orangeDown = el.classList.contains("sticker-orange-2") ? 20 : 0;
    applyStickerPile(
      el,
      pileX + jitterX + sushiShift - rest.x,
      pileY + jitterY + orangeDown - rest.y
    );
  });
  document.body.classList.add("is-piling-stickers");
  document.querySelectorAll(".scroll-hint.is-gathering").forEach((el) => {
    if (el !== hint) el.classList.remove("is-gathering");
  });
  hint.classList.add("is-gathering");
  piledHint = hint;
};

document.querySelectorAll(".scroll-hint").forEach((hint) => {
  hint.addEventListener("pointerenter", () => pileBackgroundStickers(hint));
  hint.addEventListener("focusin", () => pileBackgroundStickers(hint));
  hint.addEventListener("pointerleave", spreadBackgroundStickers);
  hint.addEventListener("focusout", (event) => {
    if (!hint.contains(event.relatedTarget)) spreadBackgroundStickers();
  });
  hint.addEventListener("click", () => {
    spreadBackgroundStickers();
    const target = document.querySelector(hint.getAttribute("href"));
    if (target) target.style.scrollMarginTop = "20px";
  });
});

const postFilter = document.querySelector(".post-filter");
const latestPosts = document.querySelector("#latest-posts");
const emptyMessage = document.querySelector(".post-empty");

const POSTS_URL = "posts.json";
const EA_FORUM_LOGO = "images/ea-forum-logo.png";
const LESSWRONG_LOGO = "images/lesswrong-logo.svg";
const RAINDROPS_URL = "raindrops.json";
const FAVORITES_BOARD =
  "https://luise-woehlke.raindrop.page/luises-favorite-things-74011177";
let savedRaindrops = [];
const HIDDEN_RAINDROP_TAG = "hide from website";

const isHiddenRaindrop = (item) =>
  (Array.isArray(item.tags) ? item.tags : []).some(
    (tag) =>
      String(tag).replace(/^#/, "").trim().toLowerCase() === HIDDEN_RAINDROP_TAG
  );

const substackFallback = [
  {
    title: "Select Which Posts to Receive From Me",
    subtitle: "To unclog your inbox",
    url: "https://luisew.substack.com/p/select-which-posts-to-receive-from",
    date: "2026-07-26T05:21:37.060Z",
    section: "newsletter",
    image:
      "https://substackcdn.com/image/fetch/w_800,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F80ef6d69-0dea-45c1-8be6-3563c65e15a2_833x888.jpeg",
    likes: 2,
    comments: 1,
  },
  {
    title: '"Do Things That New Comedians Do That Turn off Audiences"',
    subtitle: 'Favorite Quotes from "Comedy Book" by Jesse David Fox',
    url: "https://luisew.substack.com/p/he-would-do-things-that-new-comedians",
    date: "2026-07-11T18:39:52.361Z",
    section: "For Comedians",
    image:
      "https://substack-post-media.s3.amazonaws.com/public/images/ac262ecd-5ee2-4c4b-9276-9b2855617627_837x471.jpeg",
    likes: 6,
    comments: 4,
  },
  {
    title:
      "The Single Most Important Tool in Stand-Up Comedy: Attitude (+15min Writing Exercise)",
    subtitle: "Essential Mechanics of Stand-Up Comedy 1",
    url: "https://luisew.substack.com/p/attitude",
    date: "2026-07-09T16:36:20.043Z",
    section: "For Comedians",
    image:
      "https://substack-post-media.s3.amazonaws.com/public/images/96f11c33-3d2e-44e4-899e-88f4e076a559_4528x2824.jpeg",
    likes: 25,
    comments: 5,
  },
  {
    title: "Essential Mechanics of Stand-Up Comedy",
    subtitle:
      "Your essential guide to stand-up writing theory and tools (+15min exercises)",
    url: "https://luisew.substack.com/p/essential-mechanics-of-stand-up-comedy",
    date: "2026-07-09T16:34:49.719Z",
    section: "For Comedians",
    image:
      "https://substack-post-media.s3.amazonaws.com/public/images/601b4343-8c39-48de-b62f-a5b4e87e7d58_1254x706.png",
    likes: 8,
    comments: 0,
  },
  {
    title:
      "Unreasonably Easy Ways to Make People Laugh That Comedians Use—Part 2",
    subtitle: "And on the other hand, what are the *hardest* things to do in comedy?",
    url: "https://luisew.substack.com/p/unreasonably-easy-ways-to-make-part-2",
    date: "2026-06-17T23:08:10.024Z",
    section: "newsletter",
    image:
      "https://substack-post-media.s3.amazonaws.com/public/images/29c4e720-ac5d-4f6b-8be3-7435eaa519c6_4096x2302.jpeg",
    likes: 49,
    comments: 9,
  },
  {
    title: "Unreasonably Easy Ways to Make People Laugh That Comedians Use",
    subtitle: "Not all jokes are born equal",
    url: "https://luisew.substack.com/p/unreasonably-easy-ways-to-make-people",
    date: "2026-06-17T23:06:42.009Z",
    section: "newsletter",
    image:
      "https://substack-post-media.s3.amazonaws.com/public/images/ca87f98c-a9df-45b9-a064-b6e032b37bc5_2769x1605.jpeg",
    likes: 250,
    comments: 13,
  },
  {
    title: "5 Things I Learned About People From Doing Stand-Up Comedy",
    subtitle: "People need to put you in a box",
    url: "https://luisew.substack.com/p/5-things-i-learned-about-people-from",
    date: "2026-06-09T08:39:23.562Z",
    section: "newsletter",
    image:
      "https://substack-post-media.s3.amazonaws.com/public/images/f7cfc26b-0a22-4c4e-a483-28888a3970d0_2041x1171.png",
    likes: 172,
    comments: 33,
  },
];

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const formatPostDate = (iso) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { datetime: "", label: "" };
  const label = date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return { datetime: date.toISOString().slice(0, 10), label };
};

const excerptFrom = (post) => {
  const text = String(post.excerpt || post.truncated_body_text || "")
    .replace(/\s+/g, " ")
    .replace(/…$/, "")
    .trim();
  const limit = 80;
  if (!text || text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const space = cut.lastIndexOf(" ");
  const word = (space > 0 ? cut.slice(0, space) : cut).replace(/[.,;:—-]+$/, "");
  return `${word}…`;
};

const normalizePosts = (posts) =>
  posts.map((post) => ({
    title: post.title,
    subtitle: post.subtitle || post.description || "",
    url: post.url || post.canonical_url,
    date: post.date || post.post_date,
    section: post.section || post.section_name || "",
    image: post.image || post.cover_image || "",
    likes: post.likes ?? post.reaction_count ?? 0,
    comments: post.comments ?? post.comment_count ?? 0,
    excerpt: excerptFrom(post),
    category: post.category || "stand-up",
  }));

const monthHeading = (iso) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const thisYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString("en-GB", {
    month: "long",
    year: thisYear ? undefined : "numeric",
  });
};

const BEST_OF_STICKERS = [
  { src: "images/stickers/peach.png", cls: "is-peach" },
  { src: "images/stickers/lemon.png", cls: "is-lemon" },
  { src: "images/stickers/apricot.png", cls: "is-apricot" },
  { src: "images/stickers/orange%202.png", cls: "is-orange" },
];

const BEST_OF_URLS = [
  "https://luisew.substack.com/p/unreasonably-easy-ways-to-make-people",
  "https://www.lesswrong.com/posts/7Q7DPSk4iGFJd8DRk/an-opinionated-guide-to-using-anki-correctly",
  "https://luisew.substack.com/p/5-things-i-learned-about-people-from",
  "https://forum.effectivealtruism.org/posts/yMptv5msFnnfESCqm/how-i-solved-my-problems-with-low-energy-or-burnout",
];

const isForumPost = (url) =>
  url.includes("forum.effectivealtruism.org") || url.includes("lesswrong.com");

const forumPreview = (text) => {
  const trimmed = String(text || "")
    .trim()
    .replace(/[.!?…\s]+$/u, "");
  return trimmed ? `${trimmed}…` : "";
};

const postCardHtml = (post) => {
  const when = formatPostDate(post.date);
  const url = post.url || "";
  const forum = isForumPost(url);
  const subtitle = forum ? forumPreview(post.subtitle) : post.subtitle;
  const fallbackLogo = url.includes("forum.effectivealtruism.org")
    ? EA_FORUM_LOGO
    : url.includes("lesswrong.com")
    ? LESSWRONG_LOGO
    : "";
  const imageSrc = post.image || fallbackLogo;
  const image = imageSrc
    ? `<span class="post-card-media"><img class="post-card-image${
        imageSrc === EA_FORUM_LOGO || imageSrc === LESSWRONG_LOGO ? " is-logo" : ""
      }" src="${escapeHtml(imageSrc)}" alt="" /></span>`
    : `<span class="post-card-media"><span class="post-card-image"></span></span>`;
  const sourceLogo = url.includes("forum.effectivealtruism.org")
    ? `<img class="post-source is-ea" src="images/ea-mark.png" alt="EA Forum" />`
    : url.includes("lesswrong.com")
    ? `<img class="post-source is-lw" src="images/lesswrong-mark.svg" alt="LessWrong" />`
    : url.includes("substack.com")
    ? `<img class="post-source" src="images/substack-logo.svg" alt="Substack" />`
    : "";
  const likes = Number(post.likes) || 0;
  const comments = Number(post.comments) || 0;
  const likeStat = likes
    ? `<span class="post-stat"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-9a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 4.6-7 9-7 9z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg><span class="visually-hidden">Likes</span>${likes}</span>`
    : "";
  const commentStat = comments
    ? `<span class="post-stat"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6h14v9H8l-3 3V6z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg><span class="visually-hidden">Comments</span>${comments}</span>`
    : "";
  const stats =
    likeStat || commentStat
      ? `<p class="post-meta"><span class="post-stats">${likeStat}${commentStat}</span></p>`
      : "";
  const card = `<a class="post-card${forum ? " is-forum" : ""}" href="${escapeHtml(
    url
  )}" target="_blank" rel="noopener noreferrer">
          ${image}
          <svg class="post-card-external" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M7 17 17 7M9 7h8v8" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <div class="post-card-text">
            <div class="post-card-body">
              <h3>${escapeHtml(post.title)}</h3>
              <p>${escapeHtml(subtitle)}</p>
            </div>
            ${stats}
          </div>
          ${sourceLogo}
        </a>`;
  const date = `<time class="post-date" datetime="${when.datetime}">${when.label}</time>`;
  return { card, date, category: post.category || "stand-up" };
};

const alignStandupLabel = (label) => {
  if (!label) return;
  label.style.marginTop = "";
  if (!label.textContent) return;
  const narrow = window.matchMedia("(max-width: 1000px)").matches;
  const labelBox = label.getBoundingClientRect();
  let targetY;
  if (narrow) {
    const card = label.closest("li");
    if (!card) return;
    targetY = card.getBoundingClientRect().bottom - 10;
  } else {
    const orange = label
      .closest(".standup-mark")
      ?.querySelector(".standup-orange");
    if (!orange) return;
    const orangeBox = orange.getBoundingClientRect();
    targetY = orangeBox.top + orangeBox.height / 2 - 14;
  }
  const dy = targetY - (labelBox.top + labelBox.height / 2);
  if (Math.abs(dy) >= 0.5) {
    label.style.marginTop = `${dy}px`;
  }
};

const placeStandupStickers = () => {
  const narrow = window.matchMedia("(max-width: 1000px)").matches;
  document
    .querySelectorAll('.work-list > li[data-category="stand-up"] .standup-mark')
    .forEach((mark) => {
      const card = mark.closest("li");
      if (!card || card.hidden) return;
      if (narrow) {
        mark.style.left = "";
      } else {
        const left = card.getBoundingClientRect().left;
        mark.style.left = `${-left / 2}px`;
      }
      alignStandupLabel(mark.querySelector(".standup-label"));
    });
};

const typeStandupLabel = (label, show) => {
  if (!label) return;
  window.clearTimeout(label._standupType);
  const word = "stand-up";
  const live = label.querySelector(".typeout-live") || label;
  const shadows = label.querySelectorAll(".typeout-shadow, .typeout-shadow-left");
  const setText = (value) => {
    live.textContent = value;
    shadows.forEach((shadow) => {
      shadow.textContent = value;
    });
    alignStandupLabel(label);
  };
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) {
    setText(show ? word : "");
    return;
  }
  const step = () => {
    const current = live.textContent;
    if (show) {
      if (current.length >= word.length) return;
      setText(word.slice(0, current.length + 1));
    } else if (current.length) {
      setText(current.slice(0, -1));
    } else {
      return;
    }
    label._standupType = window.setTimeout(step, 48);
  };
  step();
};

const renderBestOf = (posts) => {
  const grid = document.querySelector("#best-of .best-of-grid");
  if (!grid) return;
  const byUrl = new Map(posts.map((post) => [post.url, post]));
  const picked = BEST_OF_URLS.map((url) => byUrl.get(url)).filter(Boolean);
  if (picked.length !== BEST_OF_URLS.length) return;
  grid.innerHTML = picked
    .map((post, i) => {
      const { card, date } = postCardHtml(post);
      const sticker = BEST_OF_STICKERS[i];
      return `<li><span class="best-of-sticker-wrap ${sticker.cls}"><img class="sticker best-of-sticker" src="${sticker.src}" alt="" /><span class="best-of-num" aria-hidden="true">${i + 1}</span></span>${card}${date}<span class="best-of-rule" aria-hidden="true"><span class="best-of-rule-num">${i + 1}</span></span></li>`;
    })
    .join("");
};

const renderLatestPosts = (posts) => {
  if (!latestPosts) return;
  const ordered = [...posts].sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  );
  let lastMonth = "";
  latestPosts.innerHTML = ordered
    .map((post) => {
      const when = formatPostDate(post.date);
      const monthKey = when.datetime.slice(0, 7);
      const heading =
        monthKey !== lastMonth
          ? `<li class="post-month"><span class="month-label">${escapeHtml(monthHeading(post.date))}</span></li>`
          : "";
      lastMonth = monthKey;
      const { card, date, category } = postCardHtml(post);
      const orange =
        category === "stand-up"
          ? `<span class="standup-mark"><img class="sticker standup-orange" src="images/stickers/orange%202.png" alt="" /><span class="standup-label" aria-hidden="true"><span class="typeout-shadow"></span><span class="typeout-shadow-left"></span><span class="typeout-live"></span></span></span>`
          : "";
      return `${heading}<li data-category="${escapeHtml(category)}">
        ${orange}
        ${card}
        ${date}
      </li>`;
    })
    .join("");
  mountRaindrops();
  applyPostFilter();
  watchMonthLines();
  placeStandupStickers();
};

const youtubeIdFrom = (url) => {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return parsed.pathname.split("/").filter(Boolean)[0] || "";
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (parsed.pathname.startsWith("/embed/")) return parsed.pathname.split("/")[2] || "";
      if (parsed.pathname.startsWith("/shorts/")) return parsed.pathname.split("/")[2] || "";
      return parsed.searchParams.get("v") || "";
    }
  } catch {
    return "";
  }
  return "";
};

const spotifyEmbedFrom = (url) => {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("spotify.com")) return "";
    const parts = parsed.pathname.split("/").filter(Boolean);
    const kind = parts.find((part) =>
      ["track", "album", "playlist", "episode"].includes(part)
    );
    if (!kind) return "";
    const id = parts[parts.indexOf(kind) + 1];
    return id ? `https://open.spotify.com/embed/${kind}/${id}` : "";
  } catch {
    return "";
  }
};

const isImageDrop = (item) =>
  item.type === "image" ||
  /\.(png|jpe?g|gif|webp|avif|svg)(\?|$)/i.test(item.url || "");

const raindropCopy = (item) => {
  const note = (item.note || "").trim();
  const tags = Array.isArray(item.tags) ? item.tags.filter(Boolean) : [];
  const noteHtml = note
    ? `<span class="raindrop-note">${escapeHtml(note)}</span>`
    : "";
  const tagsHtml = tags.length
    ? `<span class="raindrop-tags">${tags
        .map((tag) => `<span>#${escapeHtml(String(tag).replace(/^#/, ""))}</span>`)
        .join("")}</span>`
    : "";
  return `<span class="raindrop-copy">
      <strong>${escapeHtml(item.title)}</strong>
      ${noteHtml}
      ${tagsHtml}
    </span>`;
};

const raindropLink = (item) => {
  const image = item.image
    ? `<span class="raindrop-embed is-image"><img src="${escapeHtml(
        item.image
      )}" alt="" /></span>`
    : "";
  return `<a class="raindrop-card" href="${escapeHtml(
    item.url
  )}" target="_blank" rel="noopener noreferrer">
      ${image}
      ${raindropCopy(item)}
    </a>`;
};

const raindropCard = (item) => {
  const youtube = youtubeIdFrom(item.url);
  const spotify = spotifyEmbedFrom(item.url);
  let body = "";
  const copy = raindropCopy(item);
  if (youtube) {
    body = `<a class="raindrop-card" href="${escapeHtml(
      item.url
    )}" target="_blank" rel="noopener noreferrer">
      <span class="raindrop-embed is-video">
        <iframe src="https://www.youtube-nocookie.com/embed/${escapeHtml(
          youtube
        )}" title="${escapeHtml(
      item.title
    )}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy"></iframe>
      </span>
      ${copy}
    </a>`;
  } else if (spotify) {
    const tall = /\/(album|playlist)\//.test(spotify);
    const note = (item.note || "").trim();
    const noteHtml = note
      ? `<span class="raindrop-copy"><span class="raindrop-note">${escapeHtml(
          note
        )}</span></span>`
      : "";
    body = `<a class="raindrop-card" href="${escapeHtml(
      item.url
    )}" target="_blank" rel="noopener noreferrer">
      <span class="raindrop-embed is-spotify${tall ? " is-tall" : ""}">
        <iframe src="${escapeHtml(
          spotify
        )}" title="${escapeHtml(
      item.title
    )}" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>
      </span>
      ${noteHtml}
    </a>`;
  } else if (isImageDrop(item)) {
    body = `<a class="raindrop-card" href="${escapeHtml(
      item.url
    )}" target="_blank" rel="noopener noreferrer">
      <span class="raindrop-embed is-image">
        <img src="${escapeHtml(item.image || item.url)}" alt="" />
      </span>
      ${copy}
    </a>`;
  } else {
    body = raindropLink(item);
  }
  const kicker = spotify
    ? ""
    : `<a class="raindrop-kicker" href="${escapeHtml(
        FAVORITES_BOARD
      )}" target="_blank" rel="noopener noreferrer">From: Luise's favorite things<svg class="raindrop-kicker-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></a>`;
  const board = spotify
    ? ""
    : `<a class="raindrop-board" href="${escapeHtml(
        FAVORITES_BOARD
      )}" target="_blank" rel="noopener noreferrer">raindrop.io</a>`;
  const tags = (Array.isArray(item.tags) ? item.tags : [])
    .filter(Boolean)
    .map((tag) => String(tag).replace(/^#/, ""))
    .filter(Boolean);
  const spineTags = tags.length ? tags : ["things"];
  const spine = !spotify
    ? `<span class="raindrop-spines" aria-hidden="true">${spineTags
        .map(
          (tag) =>
            `<span class="raindrop-spine">${escapeHtml(
              ` #${tag}`.repeat(40)
            )}</span>`
        )
        .join("")}</span>`
    : "";
  const showsCover = !youtube && !spotify && (item.image || isImageDrop(item));
  const teal = item.yellow && showsCover ? " is-teal" : "";
  const spineAttr = !spotify ? ` style="--spine-n: ${spineTags.length}"` : "";
  return `<li class="raindrop-item${teal}"${spineAttr} hidden>${kicker}${body}${spine}${board}</li>`;
};

const mountRaindrops = () => {
  if (!latestPosts || !savedRaindrops.length) return;
  const postCount = latestPosts.querySelectorAll(
    ":scope > li:not(.post-month):not(.raindrop-item)"
  ).length;
  const slots = Math.floor(postCount / 3);
  latestPosts.insertAdjacentHTML(
    "beforeend",
    savedRaindrops.slice(0, slots).map(raindropCard).join("")
  );
};

const fitRaindropSpines = () => {
  if (!latestPosts) return;
  latestPosts
    .querySelectorAll(":scope > li.raindrop-item:not([hidden]) .raindrop-spine")
    .forEach((spine) => {
      const full = spine.dataset.spine || spine.textContent;
      spine.dataset.spine = full;
      const box = spine.getBoundingClientRect();
      if (box.height < 2 || !full) {
        spine.textContent = "";
        return;
      }
      const lastLetterFits = (n) => {
        spine.textContent = full.slice(0, n);
        if (n < 1 || !spine.firstChild) return true;
        const range = document.createRange();
        range.setStart(spine.firstChild, 0);
        range.setEnd(spine.firstChild, n);
        const all = range.getBoundingClientRect();
        return all.bottom <= box.bottom + 0.5;
      };
      let lo = 0;
      let hi = full.length;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        if (lastLetterFits(mid)) lo = mid;
        else hi = mid - 1;
      }
      spine.textContent = full.slice(0, lo).replace(/ +$/, "");
    });
};

const sizeRaindropCards = () => {
  if (!latestPosts) return;
  const maxCard = window.innerHeight * 0.7;
  const post = latestPosts.querySelector(
    ":scope > li:not(.raindrop-item):not(.post-month):not([hidden])"
  );
  const otherWidth = post
    ? post.getBoundingClientRect().width
    : latestPosts.clientWidth;
  const maxOuter = otherWidth * 0.8;

  latestPosts.querySelectorAll(":scope > li.raindrop-item").forEach((item) => {
    const img = item.querySelector(".raindrop-embed.is-image img");
    const video = item.querySelector(".raindrop-embed.is-video");
    if (item.hidden) return;
    if (item.querySelector(".is-spotify")) {
      item.style.width = `${otherWidth}px`;
      item.style.maxWidth = "none";
      return;
    }
    if (!img && !video) {
      item.style.width = "";
      return;
    }
    if (img && !img.complete) return;

    const ratio =
      img && img.naturalWidth ? img.naturalWidth / img.naturalHeight : img ? 1 : 16 / 9;
    const styles = getComputedStyle(item);
    const padX = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
    const padY = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
    const borderX =
      parseFloat(styles.borderLeftWidth) + parseFloat(styles.borderRightWidth);
    const borderY =
      parseFloat(styles.borderTopWidth) + parseFloat(styles.borderBottomWidth);
    const maxInner = Math.max(0, maxOuter - padX - borderX);
    const kicker = item.querySelector(".raindrop-kicker");
    const copy = item.querySelector(".raindrop-copy");
    const card = item.querySelector(".raindrop-card");

    const chromeFor = (innerW) => {
      item.style.width = `${innerW + padX + borderX}px`;
      const kickerMb = kicker
        ? parseFloat(getComputedStyle(kicker).marginBottom) || 0
        : 0;
      const gap = card ? parseFloat(getComputedStyle(card).rowGap) || 0 : 0;
      const kickerH = kicker ? kicker.offsetHeight + kickerMb : 0;
      const copyH = copy ? copy.offsetHeight : 0;
      return padY + borderY + kickerH + (copy ? gap : 0) + copyH;
    };

    let inner = Math.min(maxInner, maxCard * ratio);
    for (let pass = 0; pass < 8; pass += 1) {
      const next = Math.min(maxInner, Math.max(0, maxCard - chromeFor(inner)) * ratio);
      if (Math.abs(next - inner) < 0.5) {
        inner = next;
        break;
      }
      inner = next;
    }

    const height = Math.max(0, maxCard - chromeFor(inner));
    const naturalWidth = height * ratio;
    let width = Math.min(maxInner, naturalWidth);
    let usedHeight = width / ratio;
    let fit = "contain";
    const minOuter = Math.min(window.innerWidth / 3, otherWidth);
    if (img && naturalWidth + padX + borderX < minOuter - 1) {
      width = Math.max(0, minOuter - padX - borderX);
      usedHeight = Math.max(0, maxCard - chromeFor(width));
      fit = "cover";
      item.style.maxWidth = "none";
    } else {
      item.style.maxWidth = "";
    }
    item.style.width = `${width + padX + borderX}px`;
    const embed = img ? img.closest(".raindrop-embed") : video;
    if (!embed) return;
    embed.style.width = `${width}px`;
    embed.style.height = `${usedHeight}px`;
    embed.style.flex = "0 0 auto";
    embed.style.aspectRatio = "auto";
    if (img) {
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.maxWidth = "none";
      img.style.maxHeight = "none";
      img.style.objectFit = fit;
    }
  });
  fitRaindropSpines();
};

const placeRaindrops = () => {
  if (!latestPosts) return;
  const cards = [...latestPosts.querySelectorAll(":scope > li.raindrop-item")];
  const posts = [...latestPosts.children].filter(
    (item) =>
      !item.classList.contains("post-month") &&
      !item.classList.contains("raindrop-item") &&
      !item.hidden
  );
  let slot = 0;
  posts.forEach((post, index) => {
    if ((index + 1) % 3 !== 0) return;
    const card = cards[slot];
    if (!card) return;
    slot += 1;
    card.hidden = false;
    post.after(card);
  });
  cards.slice(slot).forEach((card) => {
    card.hidden = true;
  });
  sizeRaindropCards();
};

const shuffle = (items) => {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
};

let lastScrollY = window.scrollY;
let scrollingDown = true;

const settleVisibleItems = () => {
  if (!latestPosts) return;
  latestPosts.querySelectorAll(":scope > li").forEach((item) => {
    if (item.classList.contains("is-drawn") || item.hidden) return;
    const box = item.getBoundingClientRect();
    if (box.bottom > 0 && box.top < window.innerHeight) {
      item.classList.add("is-settled", "is-drawn");
    }
  });
};

window.addEventListener(
  "scroll",
  () => {
    const y = window.scrollY;
    if (y > lastScrollY + 1) scrollingDown = true;
    else if (y < lastScrollY - 1) scrollingDown = false;
    lastScrollY = y;
    if (!scrollingDown) settleVisibleItems();
  },
  { passive: true }
);

const monthLineObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting || !scrollingDown) return;
      entry.target.classList.add("is-drawn");
    });
  },
  { rootMargin: "0px 0px -32% 0px" }
);

const watchMonthLines = () => {
  if (!latestPosts) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  latestPosts.querySelectorAll(":scope > li").forEach((item) => {
    if (reduce) {
      item.classList.add("is-drawn");
      return;
    }
    monthLineObserver.observe(item);
  });
};

const syncEntranceAfterFilter = () => {
  if (!latestPosts) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const line = window.innerHeight * 0.68;
  latestPosts.querySelectorAll(":scope > li").forEach((item) => {
    if (reduce) {
      item.classList.add("is-drawn");
      return;
    }
    if (item.hidden) {
      item.classList.remove("is-drawn", "is-settled");
      return;
    }
    const box = item.getBoundingClientRect();
    const inView = box.bottom > 0 && box.top < line;
    if (inView) item.classList.add("is-drawn");
    else item.classList.remove("is-drawn", "is-settled");
  });
};

const applyPostFilter = () => {
  if (!postFilter) return;
  const boxes = postFilter.querySelectorAll("input[type=checkbox]");
  const count = postFilter.querySelector(".post-filter-count");
  const selected = [...boxes].filter((b) => b.checked).map((b) => b.value);
  const items = [...latestPosts.querySelectorAll(":scope > li")];
  let visible = 0;
  items.forEach((item) => {
    if (
      item.classList.contains("post-month") ||
      item.classList.contains("raindrop-item")
    ) {
      return;
    }
    const show =
      selected.length === 0 || selected.includes(item.dataset.category);
    item.hidden = !show;
    if (show) visible += 1;
  });
  items.forEach((item, index) => {
    if (!item.classList.contains("post-month")) return;
    const rest = items.slice(index + 1);
    const nextHeading = rest.findIndex((entry) =>
      entry.classList.contains("post-month")
    );
    const group = rest
      .slice(0, nextHeading === -1 ? rest.length : nextHeading)
      .filter((entry) => !entry.classList.contains("raindrop-item"));
    item.hidden = group.length === 0 || group.every((entry) => entry.hidden);
  });
  placeRaindrops();
  if (count) count.textContent = selected.length ? ` (${selected.length})` : "";
  if (emptyMessage) emptyMessage.hidden = visible > 0;
  placeStandupStickers();
};

if (postFilter) {
  postFilter.addEventListener("change", () => {
    applyPostFilter();
    syncEntranceAfterFilter();
  });
  postFilter.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      postFilter.open = false;
      postFilter.querySelector("summary").focus();
    }
  });
}

renderLatestPosts(substackFallback);
fetch(POSTS_URL, { cache: "no-cache" })
  .then((response) => {
    if (!response.ok) throw new Error("Could not load posts");
    return response.json();
  })
  .then((posts) => {
    if (Array.isArray(posts) && posts.length) {
      const normalized = normalizePosts(posts);
      renderLatestPosts(normalized);
      renderBestOf(normalized);
    }
  })
  .catch(() => {});

fetch(RAINDROPS_URL, { cache: "no-cache" })
  .then((response) => {
    if (!response.ok) throw new Error("Could not load raindrops");
    return response.json();
  })
  .then((items) => {
    if (!Array.isArray(items) || !items.length || !latestPosts) return;
    savedRaindrops = shuffle(items.filter((item) => !isHiddenRaindrop(item)));
    latestPosts
      .querySelectorAll(":scope > li.raindrop-item")
      .forEach((item) => item.remove());
    mountRaindrops();
    applyPostFilter();
    watchMonthLines();
  })
  .catch(() => {});

const stickerLayers = document.querySelectorAll(".landing-stickers");
const stickerLayer = stickerLayers[0];
const landingCard = document.querySelector(".landing-card");
const updateStickerRails = () => {
  if (!stickerLayer || !landingCard) return;
  const board = stickerLayer.getBoundingClientRect();
  const box = landingCard.getBoundingClientRect();
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
  const cm = 96 / 2.54;
  const padLeft = 4.5 * cm;
  const padRight = 6 * cm;
  const leftIn = `${(box.left - padLeft - board.left) / rem}rem`;
  const rightIn = `${(board.right - box.right - padRight) / rem}rem`;
  stickerLayers.forEach((layer) => {
    layer.style.setProperty("--sticker-left-in", leftIn);
    layer.style.setProperty("--sticker-right-in", rightIn);
  });
};
updateStickerRails();
placeStandupStickers();
window.addEventListener("resize", () => {
  updateStickerRails();
  sizeRaindropCards();
  placeStandupStickers();
  const hint = piledHint;
  clearStickerRestCenters();
  if (!hint) return;
  backgroundStickers().forEach((el) => {
    el.style.transition = "none";
    el.style.transform = "";
    el.style.translate = "0px 0px 0px";
  });
  pileBackgroundStickers(hint);
});

if (latestPosts) {
  latestPosts.addEventListener(
    "load",
    (event) => {
      const img = event.target;
      if (!(img instanceof HTMLImageElement)) return;
      if (!img.closest(".raindrop-embed.is-image")) return;
      sizeRaindropCards();
    },
    true
  );
  latestPosts.addEventListener(
    "pointerenter",
    (event) => {
      const orange = event.target.closest?.(".standup-orange");
      if (!orange || !latestPosts.contains(orange)) return;
      typeStandupLabel(orange.closest("li").querySelector(".standup-label"), true);
    },
    true
  );
  latestPosts.addEventListener(
    "pointerleave",
    (event) => {
      const orange = event.target.closest?.(".standup-orange");
      if (!orange || !latestPosts.contains(orange)) return;
      typeStandupLabel(orange.closest("li").querySelector(".standup-label"), false);
    },
    true
  );
}

const sectionHeadings = document.querySelectorAll(
  "#best-of > h2, #latest > h2, #about > h2"
);
const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

const typeoutHeading = (heading) => {
  const text = heading.dataset.typeout || "";
  const live = heading.querySelector(".typeout-live");
  const shadows = heading.querySelectorAll(".typeout-shadow, .typeout-shadow-left");
  if (!live || heading.dataset.typed === "1") return;
  heading.dataset.typed = "1";
  let i = 0;
  const step = () => {
    i += 1;
    const slice = text.slice(0, i);
    live.textContent = slice;
    shadows.forEach((shadow) => {
      shadow.textContent = slice;
    });
    if (i < text.length) window.setTimeout(step, 48);
  };
  step();
};

if (sectionHeadings.length) {
  sectionHeadings.forEach((heading) => {
    const text = heading.textContent.trim();
    heading.dataset.typeout = text;
    heading.setAttribute("aria-label", text);
    heading.textContent = "";
    const ghost = document.createElement("span");
    ghost.className = "typeout-ghost";
    ghost.setAttribute("aria-hidden", "true");
    ghost.textContent = text;
    const shadow = document.createElement("span");
    shadow.className = "typeout-shadow";
    shadow.setAttribute("aria-hidden", "true");
    const shadowLeft = document.createElement("span");
    shadowLeft.className = "typeout-shadow-left";
    shadowLeft.setAttribute("aria-hidden", "true");
    const live = document.createElement("span");
    live.className = "typeout-live";
    live.setAttribute("aria-hidden", "true");
    heading.append(ghost, shadow, shadowLeft, live);
    if (prefersReducedMotion) {
      heading.dataset.typed = "1";
      shadow.textContent = text;
      shadowLeft.textContent = text;
      live.textContent = text;
    }
  });

  if (!prefersReducedMotion) {
    const headingTypeoutObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          typeoutHeading(entry.target);
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.35, rootMargin: "0px 0px -8% 0px" }
    );

    sectionHeadings.forEach((heading) => {
      headingTypeoutObserver.observe(heading);
    });
  }
}

const bestOfSection = document.querySelector("#best-of");
if (bestOfSection) {
  if (prefersReducedMotion) {
    bestOfSection.classList.add("is-showing-stickers");
  } else {
    const bestOfStickerObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          bestOfSection.classList.add("is-showing-stickers");
          observer.disconnect();
        });
      },
      { threshold: 0.2, rootMargin: "0px 0px -10% 0px" }
    );
    bestOfStickerObserver.observe(bestOfSection);
  }
}