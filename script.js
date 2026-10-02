const year = document.getElementById("year");
if (year) {
  year.textContent = String(new Date().getFullYear());
}

const WOLKY_HINT_KEY = "wolky-hint-dismissed";
const wolkyHintDismissed = () => sessionStorage.getItem(WOLKY_HINT_KEY) === "1";
const dismissWolkyHint = (hint) => {
  hint.classList.add("is-dismissed");
  hint.setAttribute("aria-hidden", "true");
  hint.tabIndex = -1;
  sessionStorage.setItem(WOLKY_HINT_KEY, "1");
};

document.querySelectorAll(".wolky-hint").forEach((hint) => {
  if (wolkyHintDismissed()) {
    dismissWolkyHint(hint);
    return;
  }

  let hoverTimer = null;
  let dismissOnLeave = false;

  const clearHoverTimer = () => {
    if (!hoverTimer) return;
    clearTimeout(hoverTimer);
    hoverTimer = null;
  };

  const onEnter = () => {
    if (hint.classList.contains("is-dismissed")) return;
    clearHoverTimer();
    hoverTimer = setTimeout(() => {
      dismissOnLeave = true;
      hoverTimer = null;
    }, 700);
  };

  const onLeave = () => {
    clearHoverTimer();
    if (!dismissOnLeave) return;
    dismissWolkyHint(hint);
  };

  hint.addEventListener("pointerenter", onEnter);
  hint.addEventListener("pointerleave", onLeave);
  hint.addEventListener("focus", onEnter);
  hint.addEventListener("blur", onLeave);
});

const siteHeader = document.querySelector(".site-header");
const peachSticker = document.querySelector(".sticker-peach");
if (peachSticker) {
  peachSticker.style.left = "";
  peachSticker.style.top = "";
  peachSticker.style.width = "";
}
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
    if (headerHidden) {
      const end = siteHeader.querySelector(".header-end");
      const burger = siteHeader.querySelector(".nav-burger");
      end?.classList.remove("is-open");
      burger?.setAttribute("aria-expanded", "false");
    }
    lastScrollY = scrollY;
  };
  const syncHeaderHeight = () => {
    document.documentElement.style.setProperty(
      "--header-h",
      `${siteHeader.offsetHeight}px`
    );
  };
  syncHeaderHeight();
  window.addEventListener("resize", syncHeaderHeight);
  window.addEventListener("scroll", updateHeader, { passive: true });

  const headerEnd = siteHeader.querySelector(".header-end");
  const navBurger = siteHeader.querySelector(".nav-burger");
  if (headerEnd && navBurger) {
    const setNavOpen = (open) => {
      headerEnd.classList.toggle("is-open", open);
      navBurger.setAttribute("aria-expanded", open ? "true" : "false");
    };
    navBurger.addEventListener("click", (event) => {
      event.stopPropagation();
      setNavOpen(!headerEnd.classList.contains("is-open"));
    });
    document.addEventListener("pointerdown", (event) => {
      if (!headerEnd.classList.contains("is-open")) return;
      if (headerEnd.contains(event.target)) return;
      setNavOpen(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") setNavOpen(false);
    });
  }
}

const backgroundStickers = () =>
  document.querySelectorAll(
    ".landing-sticker-back .sticker, .landing-stickers .sticker, .sticker-peach"
  );

let piledHint = null;
const stickerRestCenters = new WeakMap();
const isMobileLayout = () => window.matchMedia("(max-width: 800px)").matches;

const placeBestOfNums = () => {
  const items = document.querySelectorAll("#best-of .best-of-grid > li");
  if (!items.length) return;
  if (!isMobileLayout()) {
    items.forEach((li) => {
      const rule = li.querySelector(":scope > .best-of-rule");
      if (!rule) return;
      rule.style.left = "";
      rule.style.right = "";
      rule.style.top = "";
      rule.style.translate = "";
    });
    return;
  }
  const vv = window.visualViewport;
  const viewLeft = vv?.offsetLeft ?? 0;
  const viewRight = viewLeft + (vv?.width ?? window.innerWidth);
  items.forEach((li, i) => {
    const rule = li.querySelector(":scope > .best-of-rule");
    if (!rule) return;
    const liRect = li.getBoundingClientRect();
    const midX =
      i % 2 === 0
        ? (liRect.right + viewRight) / 2
        : (viewLeft + liRect.left) / 2;
    rule.style.left = `${midX - liRect.left}px`;
    rule.style.right = "auto";
    rule.style.top = "50%";
    rule.style.translate = "-50% -50%";
  });
};

window.addEventListener("resize", placeBestOfNums);
window.visualViewport?.addEventListener("resize", placeBestOfNums);
window.visualViewport?.addEventListener("scroll", placeBestOfNums);

const applyStickerPile = (el, x, y, duration = "0.5s", delay = "0s") => {
  el.style.transform = "";
  el.style.transition = `translate ${duration} cubic-bezier(0.22, 0.8, 0.24, 1) ${delay}`;
  el.style.translate = `${x}px ${y}px 0px`;
};

const cacheStickerRestCenters = (stickers) => {
  stickers.forEach((el) => {
    if (stickerRestCenters.has(el)) return;
    const box = el.getBoundingClientRect();
    const [tx, ty] = (el.style.translate || "0px 0px")
      .split(/\s+/)
      .map((v) => parseFloat(v) || 0);
    stickerRestCenters.set(el, {
      x: box.left + box.width / 2 - tx,
      y: box.top + box.height / 2 - ty,
    });
  });
};

const clearStickerRestCenters = () => {
  backgroundStickers().forEach((el) => stickerRestCenters.delete(el));
};

// Undo a hover gather: every sticker goes back to where it was before.
const cancelBackgroundStickerPile = () => {
  if (!piledHint) return;
  backgroundStickers().forEach((el) => {
    applyStickerPile(el, 0, 0, "0.65s", "0.1s");
  });
  document.body.classList.remove("is-piling-stickers");
  document.querySelectorAll(".scroll-hint.is-gathering").forEach((hint) => {
    hint.classList.remove("is-gathering");
  });
  piledHint = null;
};

// Click: distribute stickers back to rest positions.
const spreadBackgroundStickers = () => {
  if (!piledHint) return;
  backgroundStickers().forEach((el) => {
    applyStickerPile(el, 0, 0, "0.65s", "0.1s");
  });
  document.body.classList.remove("is-piling-stickers");
  document.querySelectorAll(".scroll-hint.is-gathering").forEach((hint) => {
    hint.classList.remove("is-gathering");
  });
  piledHint = null;
};

const pileBackgroundStickers = (hint) => {
  if (!hint || isMobileLayout()) return;
  const stickers = [...backgroundStickers()];
  if (!stickers.length) return;
  cacheStickerRestCenters(stickers);
  const arrow = hint.querySelector("svg") || hint;
  const arrowBox = arrow.getBoundingClientRect();
  const lift = window.innerHeight * 0.1;
  const isLanding = Boolean(hint.closest(".landing"));
  const pileX = arrowBox.left + arrowBox.width / 2 + 10;
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
    const wombatLeft = el.classList.contains("sticker-wombat") ? -14 : 0;
    const orangeLeft = el.classList.contains("sticker-orange-2") ? -30 : 0;
    const orangeDown = el.classList.contains("sticker-orange-2") ? 20 : 0;
    const targetX = pileX + jitterX + sushiShift + wombatLeft + orangeLeft;
    let targetY = pileY + jitterY + orangeDown;
    if (
      el.classList.contains("sticker-crab") ||
      el.classList.contains("sticker-potato-2")
    ) {
      targetY = window.innerHeight - el.offsetHeight * 0.15;
    }
    applyStickerPile(el, targetX - rest.x, targetY - rest.y);
  });
  document.body.classList.add("is-piling-stickers");
  document.querySelectorAll(".scroll-hint.is-gathering").forEach((el) => {
    if (el !== hint) el.classList.remove("is-gathering");
  });
  hint.classList.add("is-gathering");
  piledHint = hint;
};

document.querySelectorAll(".landing .scroll-hint").forEach((hint) => {
  hint.addEventListener("pointerenter", () => {
    if (hint.classList.contains("is-hidden")) return;
    pileBackgroundStickers(hint);
  });
  hint.addEventListener("focusin", () => {
    if (hint.classList.contains("is-hidden")) return;
    pileBackgroundStickers(hint);
  });
  hint.addEventListener("pointerleave", cancelBackgroundStickerPile);
  hint.addEventListener("focusout", (event) => {
    if (!hint.contains(event.relatedTarget)) cancelBackgroundStickerPile();
  });
  hint.addEventListener("click", () => {
    spreadBackgroundStickers();
  });
});

const scrollToBestOfHeadingHash = () => {
  const hash = location.hash;
  if (hash !== "#best-of-heading" && hash !== "#best-of") return;
  const wide = window.matchMedia("(min-width: 1041px)").matches;
  const el = document.getElementById(
    wide || hash === "#best-of" ? "best-of" : "best-of-heading"
  );
  if (!el) return;

  const apply = () => {
    const margin =
      parseFloat(getComputedStyle(el).scrollMarginTop) ||
      window.innerHeight * 0.1;
    const y = el.getBoundingClientRect().top + window.scrollY - margin;
    const root = document.documentElement;
    const prev = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    window.scrollTo(0, Math.max(0, y));
    root.style.scrollBehavior = prev;
  };

  apply();
  requestAnimationFrame(() => {
    apply();
    requestAnimationFrame(apply);
  });
  window.setTimeout(apply, 0);
  window.setTimeout(apply, 50);
  window.setTimeout(apply, 200);
  if (document.fonts?.ready) document.fonts.ready.then(apply);
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", scrollToBestOfHeadingHash);
} else {
  scrollToBestOfHeadingHash();
}
window.addEventListener("load", scrollToBestOfHeadingHash);

const landingScrollHint = document.querySelector(".landing .scroll-hint");
if (landingScrollHint) {
  const updateScrollHint = () => {
    const hide =
      window.scrollY > 8 ||
      document.documentElement.scrollTop > 8 ||
      document.body.scrollTop > 8;
    // Cancel the gather before hiding, since a hidden hint never gets pointerleave.
    if (hide && piledHint === landingScrollHint) {
      cancelBackgroundStickerPile();
    }
    landingScrollHint.classList.toggle("is-hidden", hide);
  };
  updateScrollHint();
  window.addEventListener("scroll", updateScrollHint, { passive: true });
  document.addEventListener("scroll", updateScrollHint, { passive: true });
}

const latestScrollHint = document.querySelector(
  '#best-of > .scroll-hint[href="#latest-heading"]'
);
if (latestScrollHint) {
  const updateLatestScrollHint = () => {
    if (!window.matchMedia("(min-width: 1041px)").matches) {
      latestScrollHint.classList.remove("is-hidden");
      return;
    }
    const rect = latestScrollHint.getBoundingClientRect();
    // Hide once the hint has moved ~20px up from the bottom of the viewport.
    const hide = window.innerHeight - rect.bottom > 20;
    latestScrollHint.classList.toggle("is-hidden", hide);
  };
  updateLatestScrollHint();
  window.addEventListener("scroll", updateLatestScrollHint, { passive: true });
  window.addEventListener("resize", updateLatestScrollHint);
}

const bestOfTopHint = document.querySelector("#best-of > .scroll-hint-top");
if (bestOfTopHint) {
  const updateBestOfTopHint = () => {
    if (!window.matchMedia("(min-width: 1041px)").matches) {
      bestOfTopHint.classList.add("is-hidden");
      return;
    }
    const section = document.getElementById("best-of");
    if (!section) return;
    const rect = section.getBoundingClientRect();
    const show =
      rect.top < window.innerHeight * 0.2 && rect.bottom > window.innerHeight * 0.55;
    bestOfTopHint.classList.toggle("is-hidden", !show);
  };
  updateBestOfTopHint();
  window.addEventListener("scroll", updateBestOfTopHint, { passive: true });
  window.addEventListener("resize", updateBestOfTopHint);
}

const bestOfBackHint = document.querySelector("#latest > .scroll-hint-back");
const latestSection = document.getElementById("latest");
if (bestOfBackHint && latestSection) {
  const updateBestOfBackHint = () => {
    if (!window.matchMedia("(min-width: 801px)").matches) {
      bestOfBackHint.classList.add("is-hidden");
      return;
    }
    const rect = latestSection.getBoundingClientRect();
    // Show once Latest has moved into the upper half of the viewport.
    const show = rect.top < window.innerHeight * 0.45 && rect.bottom > 120;
    bestOfBackHint.classList.toggle("is-hidden", !show);
  };
  updateBestOfBackHint();
  window.addEventListener("scroll", updateBestOfBackHint, { passive: true });
  window.addEventListener("resize", updateBestOfBackHint);
}

const bestOfSideRail = document.querySelector("#best-of > .scroll-hint-rail");
const bestOfSection = document.getElementById("best-of");
if (bestOfSideRail && bestOfSection) {
  const updateBestOfSideRail = () => {
    if (!window.matchMedia("(min-width: 801px) and (max-width: 1040px)").matches) {
      bestOfSideRail.classList.add("is-hidden");
      return;
    }
    const rect = bestOfSection.getBoundingClientRect();
    const show =
      rect.top < window.innerHeight * 0.55 && rect.bottom > window.innerHeight * 0.35;
    bestOfSideRail.classList.toggle("is-hidden", !show);
  };
  updateBestOfSideRail();
  window.addEventListener("scroll", updateBestOfSideRail, { passive: true });
  window.addEventListener("resize", updateBestOfSideRail);
}

document.querySelectorAll(".location").forEach((location) => {
  const trigger = location.querySelector(".location-trigger");
  if (!trigger) return;
  location.addEventListener("pointerleave", () => {
    if (trigger === document.activeElement) trigger.blur();
    location.classList.remove("is-open");
  });
  trigger.addEventListener("click", (event) => {
    // Toggle for touch / click without leaving a stuck focus reveal.
    event.preventDefault();
    location.classList.toggle("is-open");
    if (!location.classList.contains("is-open") && trigger === document.activeElement) {
      trigger.blur();
    }
  });
});

const postFilter = document.querySelector(".post-filter");
const latestPosts = document.querySelector("#latest-posts");
const emptyMessage = document.querySelector(".post-empty");

const POSTS_URL = "posts.json";
const EA_FORUM_LOGO = "images/ea-forum-logo.png";
const LESSWRONG_LOGO = "images/lesswrong-logo.svg";
const RAINDROPS_URL = "raindrops.json";
const PHOTOS_URL = "photos.json";
const BOOKS_URL = "books.json";
let feedPhotos = [];
let feedBooks = [];
let latestSourcePosts = [];
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

const BEST_OF_POSTS = [
  {
    url: "https://luisew.substack.com/p/unreasonably-easy-ways-to-make-people",
    title: "Unreasonably Easy Ways to Make People Laugh That Comedians Use",
    subtitle: "Not all jokes are born equal",
    date: "2026-06-17T23:06:42.009Z",
    image:
      "https://substack-post-media.s3.amazonaws.com/public/images/ca87f98c-a9df-45b9-a064-b6e032b37bc5_2769x1605.jpeg",
    category: "stand-up",
  },
  {
    url: "https://www.lesswrong.com/posts/7Q7DPSk4iGFJd8DRk/an-opinionated-guide-to-using-anki-correctly",
    title: "An Opinionated Guide to Using Anki Correctly",
    subtitle:
      "I can't count how many times I've heard variations on \"I used Anki too for a while, but I got out of the habit.",
    date: "2025-07-08T20:01:16.858Z",
    image:
      "https://res.cloudinary.com/lesswrong-2-0/image/upload/c_fill,ar_1.91,g_auto/SocialPreview/fihplye6jfgsjtyczhs8",
    category: "blog",
  },
  {
    url: "https://luisew.substack.com/p/5-things-i-learned-about-people-from",
    title: "5 Things I Learned About People From Doing Stand-Up Comedy",
    subtitle: "People need to put you in a box",
    date: "2026-06-09T08:39:23.562Z",
    image:
      "https://substack-post-media.s3.amazonaws.com/public/images/f7cfc26b-0a22-4c4e-a483-28888a3970d0_2041x1171.png",
    category: "stand-up",
  },
  {
    url: "https://forum.effectivealtruism.org/posts/yMptv5msFnnfESCqm/how-i-solved-my-problems-with-low-energy-or-burnout",
    title: "How I solved my problems with low energy (or: burnout)",
    subtitle:
      "I had really bad problems with low energy and tiredness for about 2 years.",
    date: "2021-09-01T00:00:00.000Z",
    image: EA_FORUM_LOGO,
    likes: 0,
    comments: 0,
    category: "blog",
  },
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
      }" src="${escapeHtml(imageSrc)}" alt="" loading="lazy" /></span>`
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
            <path d="M7 17 17 7M9 7h8v8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
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
  label.style.top = "";
  label.style.marginTop = "";
  label.style.translate = "";
  if (!label.textContent) return;
  const live = label.querySelector(".typeout-live") || label;
  const mark = label.closest(".standup-mark");
  const card = label.closest("li")?.querySelector(".post-card");
  if (!mark || !card) return;

  const mobile = isMobileLayout();
  /* Natural layout height (no vertical % translate fighting margin). */
  label.style.top = "0";
  label.style.translate = mobile ? "0.45rem 0" : "1.2rem 0.1rem";

  const markBox = mark.getBoundingClientRect();
  const liveBox = live.getBoundingClientRect();
  let targetY = card.getBoundingClientRect().bottom;
  if (mobile) {
    /* Custom font metrics read low on real phones; bias toward the orange’s upper half */
    targetY = markBox.top + markBox.height * 0.34;
  } else {
    /* Slight optical lift on desktop */
    targetY -= 5;
  }
  const topPx = targetY - markBox.top - liveBox.height / 2;
  label.style.top = `${topPx}px`;
};

const placeStandupStickers = () => {
  const mobile = isMobileLayout();
  document
    .querySelectorAll('.work-list > li[data-category="stand-up"] .standup-mark')
    .forEach((mark) => {
      const card = mark.closest("li");
      if (!card || card.hidden) return;
      const label = mark.querySelector(".standup-label");
      if (!label) return;
      if (mobile) {
        const live = label.querySelector(".typeout-live") || label;
        if (live.textContent !== "stand-up") {
          typeStandupLabel(label, true);
        } else {
          alignStandupLabel(label);
        }
      } else {
        alignStandupLabel(label);
      }
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

const renderBestOf = (posts = []) => {
  const grid = document.querySelector("#best-of .best-of-grid");
  if (!grid) return;
  const byUrl = new Map(posts.map((post) => [post.url, post]));
  grid.innerHTML = BEST_OF_POSTS.map((fallback, i) => {
    const live = byUrl.get(fallback.url) || {};
    const post = {
      ...fallback,
      ...live,
      title: live.title || fallback.title,
      subtitle: live.subtitle || fallback.subtitle,
      image: live.image || fallback.image,
      date: live.date || fallback.date,
      category: live.category || fallback.category,
      url: fallback.url,
    };
    const { card, date } = postCardHtml(post);
    return `<li>${card}${date}<span class="best-of-rule" aria-hidden="true"><span class="best-of-rule-num">${i + 1}</span></span></li>`;
  }).join("");
  placeBestOfNums();
};

const POST_BATCH = 5;
let orderedLatestPosts = [];
let latestRenderCursor = 0;
let latestMonthKey = "";
let loadMoreSentinel = null;

const REVIEW_PREVIEW_WORDS = 5;
const REVIEW_HTML_TAGS = /<\/?(?:br|i|b|em|strong)\s*\/?>/i;

const reviewPlainText = (review) =>
  String(review || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

const sanitizeReviewHtml = (raw) => {
  const text = String(raw || "").trim();
  if (!text) return "";
  if (!REVIEW_HTML_TAGS.test(text) && !/<[a-z][\s\S]*>/i.test(text)) {
    return escapeHtml(text).replace(/\n/g, "<br>");
  }
  const template = document.createElement("template");
  template.innerHTML = text.replace(/\n/g, "<br>");
  const allowed = new Set(["BR", "I", "B", "EM", "STRONG"]);
  const walk = (parent) => {
    let node = parent.firstChild;
    while (node) {
      const next = node.nextSibling;
      if (node.nodeType === Node.ELEMENT_NODE) {
        if (!allowed.has(node.tagName)) {
          const first = node.firstChild;
          while (node.firstChild) parent.insertBefore(node.firstChild, node);
          parent.removeChild(node);
          node = first || next;
          continue;
        }
        [...node.attributes].forEach((attr) => node.removeAttribute(attr.name));
        walk(node);
      }
      node = next;
    }
  };
  walk(template.content);
  return template.innerHTML;
};

const formatReview = (review) => {
  const html = sanitizeReviewHtml(review);
  if (!html) return "";
  const root = document.createElement("div");
  root.innerHTML = html;

  const inlineTags = new Set(["I", "B", "EM", "STRONG"]);
  const parts = [""];
  let partIndex = 0;
  let brRun = 0;
  const openTags = [];

  const openTagHtml = () => openTags.map((tag) => `<${tag.toLowerCase()}>`).join("");
  const closeTagHtml = () =>
    [...openTags]
      .reverse()
      .map((tag) => `</${tag.toLowerCase()}>`)
      .join("");

  const startNewPart = () => {
    parts[partIndex] += closeTagHtml();
    partIndex += 1;
    parts[partIndex] = openTagHtml();
    brRun = 0;
  };

  const beforeContent = () => {
    if (brRun >= 2) startNewPart();
    else if (brRun === 1) parts[partIndex] += "<br>";
    brRun = 0;
  };

  const walk = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      beforeContent();
      parts[partIndex] += escapeHtml(node.textContent);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (node.tagName === "BR") {
      brRun += 1;
      return;
    }
    if (inlineTags.has(node.tagName)) {
      beforeContent();
      openTags.push(node.tagName);
      parts[partIndex] += `<${node.tagName.toLowerCase()}>`;
      [...node.childNodes].forEach(walk);
      parts[partIndex] += `</${node.tagName.toLowerCase()}>`;
      openTags.pop();
      return;
    }
    [...node.childNodes].forEach(walk);
  };

  [...root.childNodes].forEach(walk);

  return parts
    .map((part) => part.replace(/^(?:<br\s*\/?>)+|(?:<br\s*\/?>)+$/gi, "").trim())
    .filter(Boolean)
    .map((part, index, list) => {
      let body = part;
      if (index === 0) body = `"${body}`;
      if (index === list.length - 1) body = `${body}"`;
      return `<span class="book-review-part">${body}</span>`;
    })
    .join("");
};

const bookReviewHtml = (review) => {
  const text = String(review || "").trim();
  if (!text) return { html: "", more: false };
  const plain = reviewPlainText(text);
  const words = plain.split(/\s+/).filter(Boolean);
  if (words.length <= REVIEW_PREVIEW_WORDS) {
    return { html: `<span class="book-review">${formatReview(text)}</span>`, more: false };
  }
  const short = `${words
    .slice(0, REVIEW_PREVIEW_WORDS)
    .join(" ")
    .replace(/[,.:;]+$/, "")}…`;
  return {
    html: `<span class="book-review"><span class="book-review-short">"${escapeHtml(
      short
    )}"</span><span class="book-review-full">${formatReview(text)}</span></span>`,
    more: true,
  };
};

const latestPostItemHtml = (post) => {
  const when = formatPostDate(post.date);
  const monthKey = when.datetime.slice(0, 7);
  let heading = "";
  if (monthKey !== latestMonthKey) {
    heading = `<li class="post-month"><span class="month-label">${escapeHtml(
      monthHeading(post.date)
    )}</span></li>`;
    latestMonthKey = monthKey;
  }
  if (post.kind === "photo") {
    const photoImg = (photo, attrs = "") =>
      `<img${attrs} src="${escapeHtml(photo.src)}" alt="${escapeHtml(
        photo.caption || ""
      )}"${
        photo.width && photo.height
          ? ` width="${Number(photo.width)}" height="${Number(photo.height)}"`
          : ""
      } loading="lazy" />`;
    const [top] = post.items;
    const ratio =
      top.width && top.height ? Number(top.width) / Number(top.height) : 0.75;
    const count = post.items.length;
    const countLabel = count === 1 ? "1 image" : `${count} images`;
    const metaHtml = `<p class="photo-meta"><span class="photo-meta-count">${countLabel}</span><span class="photo-meta-dot" aria-hidden="true">•</span><time datetime="${when.datetime}">${when.label}</time></p>`;
    const scale = Number(post.scale) || 1;
    const expandBtn = `<button type="button" class="photo-expand" aria-label="View full size"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19L19 5M13 5h6v6M11 19H5v-6" fill="none" stroke="currentColor" stroke-width="0.9" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`;
    if (count > 1) {
      const step = Math.min(1.3, 3 / (count - 1));
      const imgs = post.items
        .map((photo, pos) =>
          photoImg(
            photo,
            ` class="photo-pile-img${pos === 0 ? " is-front" : ""}" style="--pos: ${pos}; z-index: ${
              count - pos
            }"`
          )
        )
        .reverse()
        .join("");
      return `${heading}<li class="photo-item is-pile" data-category="photo" style="--photo-ratio: ${ratio}; --photo-scale: ${scale}; --pile-step: ${step}rem; --pile-spread: ${
        step * (count - 1)
      }rem">
        <div class="photo-media">
          <button type="button" class="photo-pile" aria-label="Show the next picture">${imgs}</button>
          ${expandBtn}
        </div>
        ${metaHtml}
      </li>`;
    }
    const caption = top.caption
      ? `<figcaption>${escapeHtml(top.caption)}</figcaption>`
      : "";
    return `${heading}<li class="photo-item" data-category="photo" style="--photo-ratio: ${ratio}; --photo-scale: ${scale}">
        <div class="photo-media">
          <figure class="feed-photo">
            ${photoImg(top)}
            ${caption}
          </figure>
          ${expandBtn}
        </div>
        ${metaHtml}
      </li>`;
  }
  if (post.kind === "book") {
    const rating = Math.max(0, Math.min(5, Number(post.rating) || 0));
    const verb = rating ? "rated" : "reviewed";
    const stars = rating
      ? ` <span class="book-stars" aria-label="${rating} out of 5 stars">${"★".repeat(
          rating
        )}</span>`
      : "";
    const author = post.author
      ? `<span class="book-author">&nbsp;by ${escapeHtml(post.author)}</span>`
      : "";
    const review = bookReviewHtml(post.review);
    return `${heading}<li class="book-item" data-category="book" data-month="${monthKey}" data-rating="${rating}"${
      review.more ? ' data-review-more="1"' : ""
    }>
        <a class="book-update" href="${escapeHtml(
          post.url
        )}" target="_blank" rel="noopener noreferrer">
          <span class="book-text">
            <span class="book-line">Luise ${verb} a book${stars}</span>
            <span class="book-line book-title"><cite title="${escapeHtml(
              post.title
            )}">${escapeHtml(post.title)}</cite>${author}</span>
            ${review.html}
          </span>          <span class="book-source"><img src="images/goodreads-logo.svg" alt="Goodreads" /><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
        </a>
      </li>`;
  }
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
};

const fillLatestViewport = () => {
  let guard = 0;
  while (
    loadMoreSentinel &&
    latestRenderCursor < orderedLatestPosts.length &&
    loadMoreSentinel.getBoundingClientRect().top < window.innerHeight + 1200 &&
    guard < 20
  ) {
    appendLatestBatch();
    guard += 1;
  }
};

const appendLatestBatch = (forceAll = false) => {
  if (!latestPosts || !loadMoreSentinel) return;
  if (latestRenderCursor >= orderedLatestPosts.length) {
    loadMoreSentinel.hidden = true;
    return;
  }
  const end = forceAll
    ? orderedLatestPosts.length
    : Math.min(latestRenderCursor + POST_BATCH, orderedLatestPosts.length);
  const html = orderedLatestPosts
    .slice(latestRenderCursor, end)
    .map(latestPostItemHtml)
    .join("");
  loadMoreSentinel.insertAdjacentHTML("beforebegin", html);
  latestRenderCursor = end;
  if (latestRenderCursor >= orderedLatestPosts.length) {
    loadMoreSentinel.hidden = true;
  } else {
    loadMoreSentinel.hidden = false;
  }
  mountRaindrops();
  applyPostFilter();
  watchMonthLines();
  placeStandupStickers();
};

const loadMoreObserver = new IntersectionObserver(
  (entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    appendLatestBatch();
    fillLatestViewport();
    loadMoreObserver.unobserve(loadMoreSentinel);
    loadMoreObserver.observe(loadMoreSentinel);
  },
  { rootMargin: "0px 0px 1200px 0px" }
);

const renderLatestPosts = (posts) => {
  if (!latestPosts) return;
  latestSourcePosts = posts;
  orderedLatestPosts = [...posts, ...feedPhotos, ...feedBooks].sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  );
  latestRenderCursor = 0;
  latestMonthKey = "";
  if (loadMoreSentinel) loadMoreObserver.unobserve(loadMoreSentinel);
  latestPosts.innerHTML =
    '<li class="post-load-sentinel" aria-hidden="true"></li>';
  loadMoreSentinel = latestPosts.querySelector(".post-load-sentinel");
  loadMoreObserver.observe(loadMoreSentinel);
  appendLatestBatch();
  requestAnimationFrame(fillLatestViewport);
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
    body = `<div class="raindrop-card">
      <span class="raindrop-embed is-spotify${tall ? " is-tall" : ""}">
        <iframe src="${escapeHtml(
          spotify
        )}" title="${escapeHtml(
      item.title
    )}" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>
      </span>
      ${noteHtml}
    </div>`;
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
  const showsCover = !youtube && !spotify && (item.image || isImageDrop(item));
  const teal = item.yellow && showsCover ? " is-teal" : "";
  return `<li class="raindrop-item${teal}" hidden>${kicker}${body}${board}</li>`;
};

const visibleFeedPosts = () =>
  [...latestPosts.children].filter(
    (item) =>
      !item.classList.contains("post-month") &&
      !item.classList.contains("raindrop-item") &&
      !item.classList.contains("book-item") &&
      !item.classList.contains("post-load-sentinel") &&
      !item.hidden
  );

const raindropAnchorPosts = (posts) =>
  posts.filter(
    (_, index) => (index + 1) % 3 === 0 && index !== posts.length - 1
  );

const mountRaindrops = () => {
  if (!latestPosts || !savedRaindrops.length) return;
  const slots = raindropAnchorPosts(visibleFeedPosts()).length;
  const existing = [
    ...latestPosts.querySelectorAll(":scope > li.raindrop-item"),
  ];
  if (existing.length > slots) {
    existing.slice(slots).forEach((item) => item.remove());
  } else if (existing.length < slots) {
    const html = savedRaindrops
      .slice(existing.length, slots)
      .map(raindropCard)
      .join("");
    if (html) {
      if (loadMoreSentinel) loadMoreSentinel.insertAdjacentHTML("beforebegin", html);
      else latestPosts.insertAdjacentHTML("beforeend", html);
    }
  }
};

const placeRaindrops = () => {
  if (!latestPosts) return;
  const anchors = raindropAnchorPosts(visibleFeedPosts());
  const cards = [...latestPosts.querySelectorAll(":scope > li.raindrop-item")];
  anchors.forEach((post, slot) => {
    const card = cards[slot];
    if (!card) return;
    card.hidden = false;
    if (post.nextElementSibling !== card) post.after(card);
  });
  const parking = loadMoreSentinel || null;
  cards.slice(anchors.length).forEach((card) => {
    card.hidden = true;
    if (!parking) return;
    let next = card.nextElementSibling;
    while (next && next.classList.contains("raindrop-item")) {
      next = next.nextElementSibling;
    }
    if (next === parking) return;
    parking.before(card);
  });
  sizeRaindropCards();
};

const sizeRaindropCards = () => {
  if (!latestPosts) return;
  const maxCard = window.innerHeight * 0.7;
  const post = latestPosts.querySelector(
    ":scope > li:not(.raindrop-item):not(.post-month):not(.photo-item):not(.book-item):not([hidden])"
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
    const isNarrow = window.matchMedia("(max-width: 640px)").matches;
    const minOuter = Math.min(
      isNarrow ? otherWidth * 0.72 : window.innerWidth / 3,
      otherWidth
    );
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

const updateMonthLineVisibility = () => {
  if (!latestPosts) return;
  const rem =
    parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const dot = 0.42 * rem;
  latestPosts.querySelectorAll(":scope > li.post-month").forEach((month) => {
    const label = month.querySelector(".month-label");
    if (!label) return;
    const style = getComputedStyle(month);
    const gap = parseFloat(style.columnGap || style.gap) || 0;
    const padLeft = parseFloat(style.paddingLeft) || 0;
    const padRight = parseFloat(style.paddingRight) || 0;
    const space =
      month.clientWidth -
      padLeft -
      padRight -
      dot -
      label.offsetWidth -
      gap * 2;
    const afterMax = getComputedStyle(month, "::after").maxWidth;
    const maxLine =
      afterMax && afterMax !== "none" ? parseFloat(afterMax) : Infinity;
    const lineWidth = Math.min(space, maxLine);
    month.classList.toggle("is-line-hidden", !(lineWidth >= 25));
  });
};

const monthLineObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting || !scrollingDown) return;
      entry.target.classList.add("is-drawn");
    });
  },
  { rootMargin: "0px 0px -8% 0px" }
);

const watchMonthLines = () => {
  if (!latestPosts) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  latestPosts.querySelectorAll(":scope > li").forEach((item) => {
    if (item.classList.contains("post-load-sentinel")) return;
    if (reduce) {
      item.classList.add("is-drawn");
      return;
    }
    monthLineObserver.observe(item);
  });
  updateMonthLineVisibility();
};

window.addEventListener("resize", updateMonthLineVisibility);
if (document.fonts?.ready) {
  document.fonts.ready.then(updateMonthLineVisibility);
}

const syncEntranceAfterFilter = () => {
  if (!latestPosts) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const line = window.innerHeight * 0.92;
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

const collapseBookRuns = () => {
  if (!latestPosts) return;
  latestPosts.querySelectorAll(".book-more").forEach((button) => button.remove());
  latestPosts
    .querySelectorAll(":scope > .post-month.is-absorbed")
    .forEach((heading) => heading.classList.remove("is-absorbed"));
  let run = [];
  let pending = [];
  let absorbed = [];
  const moves = [];
  const flush = (next) => {
    const last = absorbed.pop();
    absorbed.forEach((heading) => heading.classList.add("is-absorbed"));
    if (last) {
      if (next && !next.classList.contains("post-month") && !next.classList.contains("post-load-sentinel")) {
        moves.push([last, next]);
      } else {
        last.classList.add("is-absorbed");
      }
    }
    absorbed = [];
    pending = [];
    const lead = run.reduce(
      (best, item) =>
        item.dataset.month === run[0].dataset.month &&
        Number(item.dataset.rating) > Number(best.dataset.rating)
          ? item
          : best,
      run[0]
    );
    if (lead && lead !== run[0]) {
      if (run[0].dataset.expanded) lead.dataset.expanded = run[0].dataset.expanded;
      delete run[0].dataset.expanded;
      run[0].before(lead);
      run = [lead, ...run.filter((item) => item !== lead)];
    }
    const [first, ...rest] = run;
    first?.classList.remove("is-collapsed");
    const open = first?.dataset.expanded === "1";
    const expandable = Boolean(rest.length || first?.dataset.reviewMore === "1");
    run.forEach((item) => item.classList.toggle("is-open-review", Boolean(open)));
    rest.forEach((item) => item.classList.toggle("is-collapsed", !open));
    if (expandable && first) {
      first.insertAdjacentHTML(
        "beforeend",
        `<button type="button" class="book-more${open ? " is-open" : ""}" aria-expanded="${
          open ? "true" : "false"
        }">${
          open ? "less" : "more"
        }<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6.5 6-6.5 6z" fill="currentColor"/></svg></button>`
      );
    }
    run = [];
  };
  [...latestPosts.children].forEach((item) => {
    if (item.hidden) return;
    if (item.classList.contains("book-item")) {
      absorbed.push(...pending);
      pending = [];
      run.push(item);
    } else if (run.length && item.classList.contains("post-month")) {
      pending.push(item);
    } else {
      flush(pending[0] || item);
    }
  });
  flush(pending[0]);
  moves.forEach(([heading, next]) => next.before(heading));
};

const applyPostFilter = () => {
  if (!postFilter) return;
  const boxes = postFilter.querySelectorAll("input[type=checkbox]");
  const count = postFilter.querySelector(".post-filter-count");
  const selected = [...boxes].filter((b) => b.checked).map((b) => b.value);
  const filtering = selected.length < boxes.length;
  if (filtering && latestRenderCursor < orderedLatestPosts.length) {
    appendLatestBatch(true);
  }
  const items = [...latestPosts.querySelectorAll(":scope > li")];
  let visible = 0;
  items.forEach((item) => {
    if (
      item.classList.contains("post-month") ||
      item.classList.contains("raindrop-item") ||
      item.classList.contains("post-load-sentinel")
    ) {
      return;
    }
    const show = !filtering || selected.includes(item.dataset.category);
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
      .filter(
        (entry) =>
          !entry.classList.contains("raindrop-item") &&
          !entry.classList.contains("post-load-sentinel")
      );
    item.hidden = group.length === 0 || group.every((entry) => entry.hidden);
  });
  mountRaindrops();
  placeRaindrops();
  collapseBookRuns();
  if (count) count.textContent = "";
  postFilter.classList.toggle("is-filtered", filtering);
  if (emptyMessage) emptyMessage.hidden = visible > 0;
  placeStandupStickers();
};

if (latestPosts) {
  const photoLightbox = document.createElement("div");
  photoLightbox.className = "photo-lightbox";
  photoLightbox.hidden = true;
  photoLightbox.setAttribute("role", "dialog");
  photoLightbox.setAttribute("aria-modal", "true");
  photoLightbox.setAttribute("aria-label", "Full size photo");
  photoLightbox.innerHTML = `
    <button type="button" class="photo-lightbox-close" aria-label="Close"></button>
    <button type="button" class="photo-lightbox-nav is-prev" aria-label="Previous image" tabindex="-1">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5L8 12l7 7" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
    <img alt="" />
    <button type="button" class="photo-lightbox-nav is-next" aria-label="Next image" tabindex="-1">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
  `;
  document.body.appendChild(photoLightbox);
  const photoLightboxImg = photoLightbox.querySelector("img");
  let lightboxImgs = [];
  let lightboxIndex = 0;

  const showLightboxImage = () => {
    const current = lightboxImgs[lightboxIndex];
    if (!current) return;
    photoLightboxImg.src = current.currentSrc || current.src;
    photoLightboxImg.alt = current.alt || "";
  };

  const syncPileToLightbox = () => {
    const count = lightboxImgs.length;
    if (count < 2) return;
    lightboxImgs.forEach((img, i) => {
      const pos = (i - lightboxIndex + count) % count;
      img.style.setProperty("--pos", pos);
      img.style.zIndex = count - pos;
      img.classList.toggle("is-front", pos === 0);
    });
  };

  const stepLightbox = (delta) => {
    const count = lightboxImgs.length;
    if (count < 2) return;
    lightboxIndex = (lightboxIndex + delta + count) % count;
    showLightboxImage();
    syncPileToLightbox();
  };

  const openPhotoLightbox = (img) => {
    if (!img) return;
    const item = img.closest(".photo-item");
    if (item?.classList.contains("is-pile")) {
      lightboxImgs = [...item.querySelectorAll(".photo-pile-img")].sort(
        (a, b) =>
          Number(a.style.getPropertyValue("--pos")) -
          Number(b.style.getPropertyValue("--pos"))
      );
      lightboxIndex = Math.max(
        0,
        lightboxImgs.findIndex((entry) => entry === img)
      );
      if (lightboxIndex < 0) lightboxIndex = 0;
      photoLightbox.classList.add("is-pile");
    } else {
      lightboxImgs = [img];
      lightboxIndex = 0;
      photoLightbox.classList.remove("is-pile");
    }
    showLightboxImage();
    photoLightbox.hidden = false;
    document.documentElement.classList.add("has-photo-lightbox");
    document.body.classList.add("has-photo-lightbox");
  };

  const closePhotoLightbox = () => {
    if (photoLightbox.hidden) return;
    photoLightbox.hidden = true;
    photoLightbox.classList.remove("is-pile");
    photoLightboxImg.removeAttribute("src");
    photoLightboxImg.alt = "";
    lightboxImgs = [];
    lightboxIndex = 0;
    document.documentElement.classList.remove("has-photo-lightbox");
    document.body.classList.remove("has-photo-lightbox");
  };

  photoLightbox.addEventListener("click", (event) => {
    if (photoLightbox.hidden) return;
    if (event.target.closest(".photo-lightbox-close")) {
      closePhotoLightbox();
      return;
    }
    const rect = photoLightboxImg.getBoundingClientRect();
    const pad = 28;
    const outside =
      !rect.width ||
      event.clientX < rect.left - pad ||
      event.clientX > rect.right + pad ||
      event.clientY < rect.top - pad ||
      event.clientY > rect.bottom + pad;
    if (lightboxImgs.length > 1 && !isMobileLayout()) {
      const mid = window.innerWidth / 2;
      stepLightbox(event.clientX < mid ? -1 : 1);
      return;
    }
    if (outside) {
      closePhotoLightbox();
      return;
    }
    if (lightboxImgs.length > 1) {
      const mid = rect.left + rect.width / 2;
      stepLightbox(event.clientX < mid ? -1 : 1);
    }
  });
  document.addEventListener("keydown", (event) => {
    if (photoLightbox.hidden) return;
    if (event.key === "Escape") {
      closePhotoLightbox();
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      stepLightbox(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      stepLightbox(1);
    }
  });
  const stopLightboxScroll = (event) => {
    if (!document.body.classList.contains("has-photo-lightbox")) return;
    event.preventDefault();
  };
  document.addEventListener("wheel", stopLightboxScroll, { passive: false });
  document.addEventListener("touchmove", stopLightboxScroll, { passive: false });

  latestPosts.addEventListener("pointerout", (event) => {
    const item = event.target.closest(".photo-item");
    if (!item || !latestPosts.contains(item)) return;
    const related = event.relatedTarget;
    if (related instanceof Node && item.contains(related)) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && item.contains(active)) active.blur();
  });

  latestPosts.addEventListener("click", (event) => {
    const more = event.target.closest(".book-more");
    if (more) {
      event.preventDefault();
      event.stopPropagation();
      const item = more.closest("li");
      item.dataset.expanded = item.dataset.expanded === "1" ? "0" : "1";
      collapseBookRuns();
      latestPosts
        .querySelectorAll(":scope > li.book-item:not(.is-collapsed)")
        .forEach((book) => book.classList.add("is-drawn", "is-settled"));
      return;
    }

    const expand = event.target.closest(".photo-expand");
    if (expand) {
      event.preventDefault();
      const item = expand.closest(".photo-item");
      openPhotoLightbox(
        item?.querySelector(".photo-pile-img.is-front, .feed-photo img")
      );
      return;
    }

    const pile = event.target.closest(".photo-pile");
    if (pile) {
      const clickedImg = event.target.closest(".photo-pile-img");
      const finePointer = window.matchMedia(
        "(hover: hover) and (pointer: fine)"
      ).matches;
      // Mobile: tap anywhere on the stack opens the lightbox
      if (!finePointer || isMobileLayout()) {
        openPhotoLightbox(
          pile.querySelector(".photo-pile-img.is-front") || clickedImg
        );
        return;
      }
      if (clickedImg?.classList.contains("is-front")) {
        openPhotoLightbox(clickedImg);
        return;
      }
      const imgs = [...pile.querySelectorAll(".photo-pile-img")];
      const count = imgs.length;
      imgs.forEach((img) => {
        const pos =
          (Number(img.style.getPropertyValue("--pos")) + count - 1) % count;
        img.style.setProperty("--pos", pos);
        img.style.zIndex = count - pos;
        img.classList.toggle("is-front", pos === 0);
      });
      return;
    }

    const singleImg = event.target.closest(
      ".photo-item:not(.is-pile) .feed-photo img"
    );
    if (singleImg) openPhotoLightbox(singleImg);
  });

  document.addEventListener("click", (event) => {
    if (!latestPosts.querySelector(".book-item.is-open-review")) return;
    const path =
      typeof event.composedPath === "function" ? event.composedPath() : [];
    const fromToggleOrOpen = path.some(
      (node) =>
        node instanceof Element &&
        (node.classList.contains("book-more") ||
          node.classList.contains("is-open-review"))
    );
    if (fromToggleOrOpen) return;
    if (event.target instanceof Element && event.target.closest(".book-item.is-open-review")) {
      return;
    }
    latestPosts.querySelectorAll(".book-item[data-expanded='1']").forEach((item) => {
      item.dataset.expanded = "0";
    });
    collapseBookRuns();
  });
}

if (postFilter) {
  let panelInTimer = 0;
  let closeTimer = 0;
  const filterSummary = postFilter.querySelector("summary");
  const isFilterSheet = () => window.matchMedia("(max-width: 640px)").matches;
  const filterBoxes = () =>
    [...postFilter.querySelectorAll("input[type=checkbox]")];
  const selectAllFilters = () => {
    filterBoxes().forEach((box) => {
      box.checked = true;
    });
  };
  selectAllFilters();
  applyPostFilter();
  /* Closed <details> stops rendering its content, so animate out before closing */
  const closeFilter = () => {
    if (!postFilter.open) return;
    if (isFilterSheet()) {
      postFilter.classList.remove("is-sheet-expanded");
      postFilter.open = false;
      return;
    }
    if (postFilter.classList.contains("is-closing")) return;
    clearTimeout(panelInTimer);
    postFilter.classList.add("is-closing");
    postFilter.classList.remove("is-panel-in");
    closeTimer = setTimeout(() => {
      postFilter.classList.remove("is-closing");
      postFilter.open = false;
    }, 520);
  };
  const collapseSheet = () => {
    postFilter.classList.remove("is-sheet-expanded");
  };
  const expandSheet = () => {
    postFilter.classList.add("is-sheet-expanded");
  };
  postFilter.addEventListener("change", () => {
    applyPostFilter();
    syncEntranceAfterFilter();
  });
  /* Clear before open paints so a leftover panel class can't flash visible */
  filterSummary?.addEventListener(
    "pointerdown",
    () => {
      if (isFilterSheet() || postFilter.open) return;
      clearTimeout(panelInTimer);
      postFilter.classList.remove("is-panel-in");
    },
    true
  );
  postFilter.addEventListener("toggle", () => {
    clearTimeout(panelInTimer);
    clearTimeout(closeTimer);
    postFilter.classList.remove("is-panel-in", "is-closing");
    if (!postFilter.open) {
      postFilter.classList.remove("is-sheet-expanded");
      return;
    }
    if (isFilterSheet()) return;
    panelInTimer = setTimeout(() => {
      if (postFilter.open) postFilter.classList.add("is-panel-in");
    }, 560);
  });
  filterSummary?.addEventListener("click", (event) => {
    if (isFilterSheet()) return;
    if (!postFilter.open) return;
    event.preventDefault();
    closeFilter();
  });
  let sheetPointerId = null;
  let sheetStartY = 0;
  let sheetDragging = false;
  postFilter.addEventListener("pointerdown", (event) => {
    if (!isFilterSheet() || !postFilter.open || event.button !== 0) return;
    sheetPointerId = event.pointerId;
    sheetStartY = event.clientY;
    sheetDragging = false;
    try {
      postFilter.setPointerCapture?.(event.pointerId);
    } catch (_) {
      /* ignore */
    }
  });
  postFilter.addEventListener("pointermove", (event) => {
    if (event.pointerId !== sheetPointerId) return;
    if (Math.abs(event.clientY - sheetStartY) > 8) sheetDragging = true;
  });
  postFilter.addEventListener(
    "touchmove",
    (event) => {
      if (!isFilterSheet() || !postFilter.open) return;
      event.preventDefault();
    },
    { passive: false }
  );
  const endSheetGesture = (event) => {
    if (event.pointerId !== sheetPointerId) return;
    const dy = event.clientY - sheetStartY;
    sheetPointerId = null;
    if (!sheetDragging) return;
    if (dy < -36) expandSheet();
    else if (dy > 36) {
      if (postFilter.classList.contains("is-sheet-expanded")) collapseSheet();
      else closeFilter();
    }
  };
  postFilter.addEventListener("pointerup", endSheetGesture);
  postFilter.addEventListener("pointercancel", () => {
    sheetPointerId = null;
    sheetDragging = false;
  });
  postFilter.addEventListener(
    "click",
    (event) => {
      if (!isFilterSheet() || !sheetDragging) return;
      event.preventDefault();
      event.stopPropagation();
      sheetDragging = false;
    },
    true
  );
  postFilter.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (postFilter.classList.contains("is-sheet-expanded")) collapseSheet();
      else {
        closeFilter();
        filterSummary?.focus();
      }
    }
  });
  document.addEventListener("pointerdown", (event) => {
    if (!postFilter.open || postFilter.contains(event.target)) return;
    closeFilter();
  });
  const latestHeading = document.querySelector("#latest-heading");
  const syncFilterIn = () => {
    if (!latestHeading) return;
    const mostBelowHeading =
      latestHeading.getBoundingClientRect().bottom < window.innerHeight * 0.2;
    postFilter.classList.toggle("is-in", mostBelowHeading);
    if (!mostBelowHeading) closeFilter();
  };
  syncFilterIn();
  window.addEventListener("scroll", syncFilterIn, { passive: true });
  window.addEventListener("resize", syncFilterIn);
}

renderLatestPosts(substackFallback);
renderBestOf();
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

fetch(PHOTOS_URL, { cache: "no-cache" })
  .then((response) => {
    if (!response.ok) throw new Error("Could not load photos");
    return response.json();
  })
  .then((photos) => {
    if (!Array.isArray(photos) || !photos.length) return;
    const groups = new Map();
    photos
      .filter((photo) => photo.src && photo.date)
      .forEach((photo) => {
        const key = photo.pile ? `pile:${photo.pile}` : photo.src;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(photo);
      });
    feedPhotos = [...groups.values()].map((items) => {
      items.sort(
        (a, b) =>
          new Date(b.date) - new Date(a.date) ||
          String(b.date).localeCompare(String(a.date))
      );
      const date = items[0].date;
      const rank = new Map(
        items.map((photo, index) => [
          photo,
          photo.front ? -1 : Number.isFinite(photo.order) ? photo.order : index,
        ])
      );
      items.sort((a, b) => rank.get(a) - rank.get(b));
      const scale = Number(items.find((photo) => photo.scale)?.scale) || 1;
      return { kind: "photo", category: "photo", date, items, scale };
    });
    renderLatestPosts(latestSourcePosts);
  })
  .catch(() => {});

fetch(BOOKS_URL, { cache: "no-cache" })
  .then((response) => {
    if (!response.ok) throw new Error("Could not load books");
    return response.json();
  })
  .then((books) => {
    if (!Array.isArray(books) || !books.length) return;
    feedBooks = books
      .filter((book) => book.title && book.date)
      .map((book) => ({ ...book, kind: "book", category: "book" }));
    renderLatestPosts(latestSourcePosts);
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
  if (window.matchMedia("(max-width: 800px)").matches) {
    stickerLayers.forEach((layer) => {
      layer.style.setProperty("--sticker-left-in", "0rem");
      layer.style.setProperty("--sticker-right-in", "0rem");
    });
    return;
  }
  const board = stickerLayer.getBoundingClientRect();
  const box = landingCard.getBoundingClientRect();
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
  const cm = 96 / 2.54;
  const padLeft = 4.5 * cm;
  const padRight = 6 * cm;
  const leftIn = `${Math.max(0, (box.left - padLeft - board.left) / rem)}rem`;
  const rightIn = `${Math.max(0, (board.right - box.right - padRight) / rem)}rem`;
  stickerLayers.forEach((layer) => {
    layer.style.setProperty("--sticker-left-in", leftIn);
    layer.style.setProperty("--sticker-right-in", rightIn);
  });
};
updateStickerRails();
placeStandupStickers();
if (document.fonts?.ready) document.fonts.ready.then(placeStandupStickers);
window.addEventListener("resize", () => {
  updateStickerRails();
  sizeRaindropCards();
  placeStandupStickers();
  const hint = piledHint;
  clearStickerRestCenters();
  backgroundStickers().forEach((el) => {
    el.style.transition = "none";
    el.style.transform = "";
    el.style.translate = "0px 0px 0px";
  });
  if (hint && !isMobileLayout()) {
    pileBackgroundStickers(hint);
  } else if (hint) {
    cancelBackgroundStickerPile();
  }
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
      if (isMobileLayout()) return;
      const item = event.target;
      if (item.parentElement !== latestPosts || item.dataset.category !== "stand-up") return;
      typeStandupLabel(item.querySelector(".standup-label"), true);
    },
    true
  );
  latestPosts.addEventListener(
    "pointerleave",
    (event) => {
      if (isMobileLayout()) return;
      const item = event.target;
      if (item.parentElement !== latestPosts || item.dataset.category !== "stand-up") return;
      typeStandupLabel(item.querySelector(".standup-label"), false);
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

const typeoutHeading = (heading, onDone) => {
  const text = heading.dataset.typeout || "";
  const live = heading.querySelector(".typeout-live");
  const shadows = heading.querySelectorAll(".typeout-shadow, .typeout-shadow-left");
  const done = typeof onDone === "function" ? onDone : null;
  if (!live || heading.dataset.typed === "1") {
    done?.();
    return;
  }
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
    else done?.();
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
          const heading = entry.target;
          typeoutHeading(heading, () => {
            if (heading.matches("#best-of > h2")) {
              document.querySelector("#best-of")?.classList.add("is-showing-stickers");
              placeBestOfNums();
            }
          });
          observer.unobserve(heading);
        });
      },
      { threshold: 0.35, rootMargin: "0px 0px -8% 0px" }
    );

    sectionHeadings.forEach((heading) => {
      headingTypeoutObserver.observe(heading);
    });
  }
}

if (bestOfSection && prefersReducedMotion) {
  bestOfSection.classList.add("is-showing-stickers");
}
placeBestOfNums();
window.addEventListener("load", placeBestOfNums);
if (document.fonts?.ready) document.fonts.ready.then(placeBestOfNums);