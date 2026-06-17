var CATEGORY_OPTIONS = ["進行中", "企画", "レビュー待ち", "完了", "メモ", "その他"];
var THEME_STORAGE_KEY = "vdd-creative-catalog.theme";
var DATA_URL = "posts.json";

var state = {
  posts: [],
  filters: { search: "", type: "all", category: "all" },
  modalPostId: null,
  focusedPostId: ""
};
var ui = {};
var searchTimer = 0;

document.addEventListener("DOMContentLoaded", function () {
  bindUI();
  attachEvents();
  applyTheme(getInitialTheme());
  loadPosts();
});

function bindUI() {
  ui.globalStatus = document.getElementById("global-status");
  ui.searchInput = document.getElementById("search-input");
  ui.typeFilter = document.getElementById("type-filter");
  ui.categoryFilter = document.getElementById("category-filter");
  ui.themeToggleButton = document.getElementById("theme-toggle-button");
  ui.activeChips = document.getElementById("active-chips");
  ui.feed = document.getElementById("feed");
  ui.statPosts = document.getElementById("stat-posts");
  ui.statPhotos = document.getElementById("stat-photos");
  ui.statAuthors = document.getElementById("stat-authors");
  ui.modal = document.getElementById("modal");
  ui.modalContent = document.getElementById("modal-content");
  ui.modalCloseButton = document.getElementById("modal-close-button");
}

function attachEvents() {
  ui.themeToggleButton.addEventListener("click", toggleTheme);
  ui.searchInput.addEventListener("input", function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(applyFilters, 180);
  });
  ui.typeFilter.addEventListener("change", applyFilters);
  ui.categoryFilter.addEventListener("change", applyFilters);
  ui.feed.addEventListener("click", handleFeedClick);
  ui.feed.addEventListener("keydown", handleFeedKeyDown);
  ui.modalContent.addEventListener("click", handleFeedClick);
  ui.modal.addEventListener("click", function (event) {
    if (event.target.closest("[data-close-modal]")) {
      closeModal();
    }
  });
  ui.modalCloseButton.addEventListener("click", closeModal);
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !ui.modal.hidden) {
      closeModal();
    }
  });
}

function loadPosts() {
  var startedAt = Date.now();
  setStatus("Loading gallery...", "info");

  fetch(DATA_URL, { cache: "no-cache" })
    .then(function (response) {
      if (!response.ok) {
        throw new Error("HTTP " + response.status);
      }

      return response.json();
    })
    .then(function (data) {
      var rawPosts = data && Array.isArray(data.posts) ? data.posts : [];
      state.posts = rawPosts.map(normalizePost).filter(Boolean);
      renderApp();
      setStatus(state.posts.length + " works loaded in " + (Date.now() - startedAt) + "ms.", "success");
    })
    .catch(function (error) {
      ui.feed.classList.remove("is-loading");
      ui.feed.textContent = "";
      renderApp();
      setStatus("Load failed: " + getErrorMessage(error), "danger");
    });
}

function normalizePost(post) {
  if (!post || typeof post !== "object") {
    return null;
  }

  var imageUrl = String(post.imageUrl || "").trim();
  var videoUrl = String(post.videoUrl || "").trim();
  var drivePreviewUrl = String(post.drivePreviewUrl || "").trim();
  var mediaType = String(post.mediaType || "").trim();
  var type = String(post.type || "").trim();
  var youtubeId = extractYouTubeId(post.youtubeId || post.youtubeUrl || "");
  var source = String(post.source || "").trim().toLowerCase();

  if (!source) {
    source = youtubeId ? "youtube" : (drivePreviewUrl || videoUrl ? "drive" : "");
  }

  if (!type) {
    type = youtubeId || videoUrl || drivePreviewUrl || mediaType.indexOf("video/") === 0
      ? "video"
      : imageUrl
        ? "photo"
        : "text";
  }

  if (type === "video" && source === "youtube" && !imageUrl && youtubeId) {
    imageUrl = youtubeThumbnail(youtubeId);
  }

  return {
    id: String(post.id || ""),
    title: String(post.title || "").trim(),
    body: String(post.body || "").trim(),
    author: String(post.author || "").trim(),
    category: CATEGORY_OPTIONS.indexOf(post.category) >= 0 ? post.category : "その他",
    type: type,
    source: source,
    youtubeId: youtubeId,
    mediaType: mediaType,
    imageUrl: imageUrl,
    videoUrl: videoUrl,
    drivePreviewUrl: drivePreviewUrl,
    hasMedia: Boolean(imageUrl || videoUrl || drivePreviewUrl || youtubeId),
    createdAt: post.createdAt || new Date().toISOString()
  };
}

function applyFilters() {
  state.filters.search = ui.searchInput.value.trim();
  state.filters.type = ui.typeFilter.value;
  state.filters.category = ui.categoryFilter.value;
  renderApp();
}

function renderApp() {
  renderCategoryFilter();
  renderStats();
  renderActiveChips();
  renderFeed();
}

function renderCategoryFilter() {
  var current = ui.categoryFilter ? ui.categoryFilter.value : "all";
  var categories = CATEGORY_OPTIONS.slice();

  state.posts.forEach(function (post) {
    if (categories.indexOf(post.category) === -1) {
      categories.push(post.category);
    }
  });

  var signature = categories.join("");

  if (ui.categoryFilter.dataset.signature === signature) {
    ui.categoryFilter.value = current === "all" || categories.indexOf(current) >= 0 ? current : "all";
    return;
  }

  ui.categoryFilter.textContent = "";
  appendOption(ui.categoryFilter, "all", "All");

  categories.forEach(function (category) {
    appendOption(ui.categoryFilter, category, category);
  });

  ui.categoryFilter.value = current === "all" || categories.indexOf(current) >= 0 ? current : "all";
  ui.categoryFilter.dataset.signature = signature;
}

function appendOption(select, value, label) {
  var option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  select.appendChild(option);
}

function renderStats() {
  ui.statPosts.textContent = String(state.posts.length);
  ui.statPhotos.textContent = String(
    state.posts.filter(function (post) {
      return post.type === "photo" || post.type === "video";
    }).length
  );
  ui.statAuthors.textContent = String(
    new Set(
      state.posts
        .map(function (post) {
          return post.author;
        })
        .filter(Boolean)
    ).size
  );
}

function renderActiveChips() {
  var filtered = getFilteredPosts();
  var chips = [filtered.length + " / " + state.posts.length + " shown"];

  if (state.filters.search) {
    chips.push("Search: " + state.filters.search);
  }

  if (state.filters.type !== "all") {
    chips.push(getTypeLabel(state.filters.type));
  }

  if (state.filters.category !== "all") {
    chips.push(state.filters.category);
  }

  ui.activeChips.textContent = "";

  chips.forEach(function (text) {
    var chip = createElement("span", "active-chip");
    chip.textContent = text;
    ui.activeChips.appendChild(chip);
  });
}

function renderFeed() {
  var posts = getFilteredPosts();
  var hasFocusedPost = posts.some(function (post) {
    return post.id === state.focusedPostId;
  });

  if (state.focusedPostId && !hasFocusedPost) {
    state.focusedPostId = "";
  }

  ui.feed.textContent = "";
  ui.feed.classList.remove("is-loading");
  ui.feed.classList.toggle("has-focused-card", Boolean(state.focusedPostId));

  if (!posts.length) {
    state.focusedPostId = "";
    ui.feed.classList.remove("has-focused-card");
    var empty = createElement("section", "empty-state");
    empty.innerHTML =
      "<h3>No works yet</h3><p>まだ公開された作例がありません。社内ツールからアップロードすると、ここに並びます。</p>";
    ui.feed.appendChild(empty);
    return;
  }

  var fragment = document.createDocumentFragment();
  posts.forEach(function (post) {
    fragment.appendChild(buildGalleryCard(post));
  });
  ui.feed.appendChild(fragment);
}

function buildGalleryCard(post) {
  var article = createElement("article", "post-card");
  article.dataset.postId = post.id;
  article.tabIndex = 0;
  article.setAttribute("aria-label", getPostTitle(post) + " preview");

  if (state.focusedPostId === post.id) {
    article.classList.add("is-focused");
  }

  var media = createElement("div", "post-media");
  appendMediaElement(media, post, false);
  media.appendChild(buildCardCaption(post));
  media.appendChild(buildCardOverlay(post));
  article.appendChild(media);
  return article;
}

function buildCardCaption(post) {
  var caption = createElement("div", "post-caption");
  var title = createElement("strong", "");
  var meta = createElement("span", "");

  title.textContent = getPostTitle(post);
  meta.textContent = buildMetaLine(post);
  caption.appendChild(title);
  caption.appendChild(meta);
  return caption;
}

function buildCardOverlay(post) {
  var overlay = createElement("div", "post-overlay");
  var copy = createElement("div", "post-overlay-copy");
  var title = document.createElement("h3");
  title.textContent = getPostTitle(post);
  copy.appendChild(title);

  var meta = createElement("p", "post-overlay-meta");
  meta.textContent = buildMetaLine(post) + " / " + formatDate(post.createdAt);
  copy.appendChild(meta);

  if (post.body) {
    var body = createElement("p", "post-body");
    body.textContent = post.body;
    copy.appendChild(body);
  }

  overlay.appendChild(copy);

  var actions = createElement("div", "post-actions");
  var openButton = createElement("button", "text-button");
  openButton.type = "button";
  openButton.dataset.action = "open";
  openButton.dataset.postId = post.id;
  openButton.textContent = "Open";
  actions.appendChild(openButton);
  overlay.appendChild(actions);
  return overlay;
}

function appendMediaElement(container, post, inModal) {
  if (inModal && post.type === "video") {
    renderModalVideo(container, post);
    return;
  }

  if (post.type === "video") {
    if (post.imageUrl) {
      appendPreviewImage(container, post);
    } else {
      var videoPlaceholder = createElement("div", "post-placeholder");
      videoPlaceholder.textContent = "▶";
      container.appendChild(videoPlaceholder);
    }

    appendPlayAffordance(container);
    appendVideoBadge(container, post);
    return;
  }

  if (post.imageUrl) {
    appendPreviewImage(container, post);
    return;
  }

  var placeholder = createElement("div", "post-placeholder");
  placeholder.textContent = getPostTitle(post).charAt(0).toUpperCase() || "A";
  container.appendChild(placeholder);
}

function appendPreviewImage(container, post) {
  var image = document.createElement("img");
  image.alt = getPostTitle(post);
  image.loading = "lazy";
  image.decoding = "async";
  image.width = 960;
  image.height = 540;
  image.addEventListener("error", function () {
    renderMediaError(container, "Preview unavailable", post);
  }, { once: true });
  image.src = post.imageUrl;
  container.appendChild(image);
}

function appendVideoBadge(container, post) {
  var isYouTube = post.source === "youtube";
  var badge = createElement("span", "media-type " + (isYouTube ? "media-type--youtube" : "media-type--internal"));
  badge.textContent = isYouTube ? "YouTube" : "社内 Drive";
  container.appendChild(badge);
}

function appendPlayAffordance(container) {
  var wrap = createElement("div", "play-affordance");
  var dot = document.createElement("span");
  dot.textContent = "▶";
  dot.setAttribute("aria-hidden", "true");
  wrap.appendChild(dot);
  container.appendChild(wrap);
}

function renderModalVideo(container, post) {
  if (post.source === "youtube" && post.youtubeId) {
    var youtube = document.createElement("iframe");
    youtube.title = getPostTitle(post);
    youtube.loading = "lazy";
    youtube.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen";
    youtube.setAttribute("allowfullscreen", "");
    youtube.src = "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(post.youtubeId) + "?rel=0";
    container.appendChild(youtube);
    appendVideoBadge(container, post);
    return;
  }

  if (post.videoUrl) {
    var video = document.createElement("video");
    video.src = post.videoUrl;
    video.controls = true;
    video.playsInline = true;
    video.preload = "metadata";

    if (post.imageUrl) {
      video.poster = post.imageUrl;
    }

    video.addEventListener("error", function () {
      renderMediaError(container, "Video unavailable", post);
    }, { once: true });

    container.appendChild(video);
    appendVideoBadge(container, post);
    return;
  }

  if (post.drivePreviewUrl) {
    var frame = document.createElement("iframe");
    frame.title = getPostTitle(post);
    frame.loading = "lazy";
    frame.allow = "autoplay; encrypted-media; fullscreen";
    frame.setAttribute("allowfullscreen", "");
    frame.src = post.drivePreviewUrl;
    container.appendChild(frame);
    appendVideoBadge(container, post);
    return;
  }

  if (post.imageUrl) {
    appendPreviewImage(container, post);
    appendVideoBadge(container, post);
    return;
  }

  var placeholder = createElement("div", "post-placeholder");
  placeholder.textContent = "Video";
  container.appendChild(placeholder);
}

function appendMediaBadge(container, label) {
  var badge = createElement("span", "media-type");
  badge.textContent = label;
  container.appendChild(badge);
}

function renderMediaError(container, message, post) {
  container.textContent = "";

  if (post && post.drivePreviewUrl && container.classList.contains("modal-image")) {
    var frame = document.createElement("iframe");
    frame.title = getPostTitle(post);
    frame.loading = "lazy";
    frame.allow = "autoplay; encrypted-media; fullscreen";
    frame.setAttribute("allowfullscreen", "");
    frame.src = post.drivePreviewUrl;
    container.appendChild(frame);
    return;
  }

  var placeholder = createElement("div", "post-placeholder");
  placeholder.textContent = "No preview";
  container.appendChild(placeholder);
}

function handleFeedClick(event) {
  var button = event.target.closest("button[data-action]");

  if (button) {
    var actionPostId = button.dataset.postId;

    if (actionPostId && button.dataset.action === "open") {
      openModal(actionPostId);
    }

    return;
  }

  var card = event.target.closest(".post-card");

  if (card && card.dataset.postId) {
    focusPostCard(card.dataset.postId, true);
  }
}

function handleFeedKeyDown(event) {
  if (event.target.closest("button")) {
    return;
  }

  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  var card = event.target.closest(".post-card");

  if (!card || !card.dataset.postId) {
    return;
  }

  event.preventDefault();
  focusPostCard(card.dataset.postId, true);
}

function focusPostCard(postId, shouldScroll) {
  if (state.focusedPostId === postId) {
    openModal(postId);
    return;
  }

  var previousPostId = state.focusedPostId;
  state.focusedPostId = postId;
  ui.feed.classList.toggle("has-focused-card", Boolean(state.focusedPostId));

  if (previousPostId) {
    var previousCard = ui.feed.querySelector('[data-post-id="' + cssEscape(previousPostId) + '"]');

    if (previousCard) {
      previousCard.classList.remove("is-focused");
    }
  }

  var activeCard = ui.feed.querySelector('[data-post-id="' + cssEscape(postId) + '"]');

  if (activeCard) {
    activeCard.classList.add("is-focused");
  }

  if (!shouldScroll || !activeCard) {
    return;
  }

  setTimeout(function () {
    if (activeCard.scrollIntoView) {
      activeCard.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      activeCard.focus({ preventScroll: true });
    }
  }, 0);
}

function getFilteredPosts() {
  var search = state.filters.search.toLowerCase();

  return state.posts
    .slice()
    .sort(function (a, b) {
      return Date.parse(b.createdAt) - Date.parse(a.createdAt);
    })
    .filter(function (post) {
      if (state.filters.type !== "all" && post.type !== state.filters.type) {
        return false;
      }

      if (state.filters.category !== "all" && post.category !== state.filters.category) {
        return false;
      }

      if (!search) {
        return true;
      }

      return [post.title, post.body, post.author, post.category]
        .join(" ")
        .toLowerCase()
        .indexOf(search) >= 0;
    });
}

function openModal(postId) {
  state.modalPostId = postId;
  ui.modal.hidden = false;
  renderModal();
}

function closeModal() {
  state.modalPostId = null;
  ui.modal.hidden = true;
  ui.modalContent.textContent = "";
}

function renderModal() {
  var post = findPost(state.modalPostId);

  if (!post) {
    closeModal();
    return;
  }

  ui.modalContent.textContent = "";

  var mediaWrap = createElement("div", "modal-image");
  appendMediaElement(mediaWrap, post, true);
  ui.modalContent.appendChild(mediaWrap);

  var title = createElement("h3", "modal-title");
  title.id = "modal-title";
  title.textContent = getPostTitle(post);
  ui.modalContent.appendChild(title);

  var details = createElement("dl", "modal-details");

  if (post.author) {
    appendModalDetail(details, "Author", post.author);
  }

  appendModalDetail(details, "Category", post.category);
  appendModalDetail(details, "Date", formatDate(post.createdAt));
  appendModalDetail(details, "Type", getTypeLabel(post.type));

  if (post.type === "video") {
    appendModalDetail(details, "Source", post.source === "youtube" ? "YouTube" : "社内 Drive");
  }

  ui.modalContent.appendChild(details);

  var body = createElement("p", "modal-body");
  body.textContent = post.body || "No description.";
  ui.modalContent.appendChild(body);
}

function appendModalDetail(list, label, value) {
  var item = createElement("div", "modal-detail");
  var term = document.createElement("dt");
  var description = document.createElement("dd");
  term.textContent = label;
  description.textContent = value || "-";
  item.appendChild(term);
  item.appendChild(description);
  list.appendChild(item);
}

function buildMetaLine(post) {
  return post.author ? post.author + " / " + post.category : post.category;
}

function findPost(postId) {
  return state.posts.find(function (post) {
    return post.id === postId;
  });
}

function getPostTitle(post) {
  if (post.title) {
    return post.title;
  }

  if (post.type === "video") {
    return "Untitled video";
  }

  return post.imageUrl ? "Untitled image" : "Untitled note";
}

function getTypeLabel(type) {
  if (type === "photo") {
    return "Images";
  }

  if (type === "video") {
    return "Videos";
  }

  if (type === "text") {
    return "Text only";
  }

  return "All";
}

function formatDate(value) {
  var date = new Date(value);

  if (isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(date);
}

function getInitialTheme() {
  var theme = document.documentElement.dataset.theme || "";

  try {
    theme = localStorage.getItem(THEME_STORAGE_KEY) || theme;
  } catch (error) {
    theme = theme || "light";
  }

  return theme === "dark" ? "dark" : "light";
}

function applyTheme(theme) {
  var normalized = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = normalized;

  if (!ui.themeToggleButton) {
    return;
  }

  ui.themeToggleButton.textContent = normalized === "dark" ? "Light" : "Dark";
  ui.themeToggleButton.setAttribute("aria-pressed", normalized === "dark" ? "true" : "false");
  ui.themeToggleButton.setAttribute(
    "aria-label",
    normalized === "dark" ? "Switch to light mode" : "Switch to dark mode"
  );
}

function toggleTheme() {
  var currentTheme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  var nextTheme = currentTheme === "dark" ? "light" : "dark";

  applyTheme(nextTheme);

  try {
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  } catch (error) {
    // Persisting the theme is best-effort only.
  }
}

function setStatus(message, tone) {
  if (!ui.globalStatus) {
    return;
  }

  ui.globalStatus.textContent = message;
  ui.globalStatus.dataset.tone = tone || "info";
}

function createElement(tagName, className) {
  var element = document.createElement(tagName);

  if (className) {
    element.className = className;
  }

  return element;
}

function cssEscape(value) {
  if (window.CSS && typeof window.CSS.escape === "function") {
    return window.CSS.escape(value);
  }

  return String(value).replace(/["\\]/g, "\\$&");
}

function extractYouTubeId(value) {
  var text = String(value || "").trim();

  if (!text) {
    return "";
  }

  if (text.indexOf("/") === -1 && text.indexOf(".") === -1 && /^[a-zA-Z0-9_-]{6,15}$/.test(text)) {
    return text;
  }

  var patterns = [
    /[?&]v=([a-zA-Z0-9_-]+)/,
    /youtu\.be\/([a-zA-Z0-9_-]+)/,
    /\/embed\/([a-zA-Z0-9_-]+)/,
    /\/shorts\/([a-zA-Z0-9_-]+)/
  ];

  for (var index = 0; index < patterns.length; index += 1) {
    var match = text.match(patterns[index]);

    if (match && match[1]) {
      return match[1];
    }
  }

  return "";
}

function youtubeThumbnail(youtubeId) {
  return "https://img.youtube.com/vi/" + encodeURIComponent(youtubeId) + "/hqdefault.jpg";
}

function getErrorMessage(error) {
  if (!error) {
    return "Unknown error";
  }

  if (typeof error === "string") {
    return error;
  }

  return error.message || String(error);
}
