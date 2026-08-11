/**
 * Essence Gallery — lógica del catálogo (vanilla JS).
 * Depende del arreglo global `perfumes` definido en data/perfumes.js
 */
(function () {
  "use strict";

  // Categorías disponibles según género, en el orden que queremos mostrar.
  const CATEGORIES_BY_GENDER = {
    Hombre: ["Disenador", "Arabes", "Nicho"],
    Mujer: ["Disenador", "Celebridad", "Arabes"],
  };

  // Etiquetas legibles para categorías (los datos internos no llevan tildes).
  const CATEGORY_LABELS = {
    Disenador: "Diseñador",
    Arabes: "Árabes",
    Nicho: "Nicho",
    Celebridad: "Celebridad",
  };

  const PAGE_SIZE = 12;

  const state = {
    gender: "Hombre",
    category: "Todas",
    search: "",
    page: 1,
  };

  const grid = document.getElementById("perfumeGrid");
  const pagination = document.getElementById("pagination");
  const emptyState = document.getElementById("emptyState");
  const resultsCount = document.getElementById("resultsCount");
  const searchInput = document.getElementById("searchInput");
  const genderFilters = document.getElementById("genderFilters");
  const categoryFilters = document.getElementById("categoryFilters");
  const clearFiltersBtn = document.getElementById("clearFiltersBtn");
  const emptyStateClearBtn = document.getElementById("emptyStateClearBtn");
  const catalogSection = document.getElementById("catalogo");

  const modalEl = document.getElementById("perfumeModal");
  const modal = new bootstrap.Modal(modalEl);
  const modalImage = document.getElementById("modalImage");
  const modalName = document.getElementById("modalName");
  const modalBrand = document.getElementById("modalBrand");
  const modalGender = document.getElementById("modalGender");
  const modalCategory = document.getElementById("modalCategory");
  const modalDescription = document.getElementById("modalDescription");

  function categoryLabel(cat) {
    return CATEGORY_LABELS[cat] || cat;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));
  }

  /** Reconstruye los botones de categoría según el género seleccionado. */
  function renderCategoryFilters() {
    const categorySet = new Set(CATEGORIES_BY_GENDER[state.gender] || []);

    if (!categorySet.has(state.category)) {
      state.category = "Todas";
    }

    const buttons = [
      `<button class="pill${state.category === "Todas" ? " active" : ""}" data-value="Todas">Todas las categorías</button>`,
    ];
    categorySet.forEach((cat) => {
      buttons.push(
        `<button class="pill${state.category === cat ? " active" : ""}" data-value="${cat}">${categoryLabel(cat)}</button>`
      );
    });
    categoryFilters.innerHTML = buttons.join("");
  }

  function matchesFilters(p) {
    if (p.gender !== state.gender) return false;
    if (state.category !== "Todas" && p.category !== state.category) return false;

    if (state.search) {
      const haystack = [p.name, p.brand, categoryLabel(p.category), p.gender]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(state.search)) return false;
    }
    return true;
  }

  function cardTemplate(p) {
    const brandHtml = p.brand
      ? `<p class="perfume-card-brand">${escapeHtml(p.brand)}</p>`
      : "";
    return `
      <article class="perfume-card" role="listitem" tabindex="0" data-id="${p.id}" aria-label="Ver detalles de ${escapeHtml(p.name)}">
        <div class="perfume-card-img-wrap">
          <img src="${p.image}" alt="${escapeHtml(p.name)}" loading="lazy" onerror="this.onerror=null;this.src='assets/logo.png';">
        </div>
        <div class="perfume-card-body">
          <div class="perfume-card-badges">
            <span class="badge pill-badge">${p.gender}</span>
            <span class="badge pill-badge pill-badge-outline">${categoryLabel(p.category)}</span>
          </div>
          <h3 class="perfume-card-name">${escapeHtml(p.name)}</h3>
          ${brandHtml}
          <button type="button" class="perfume-card-cta">Ver detalles</button>
        </div>
      </article>`;
  }

  function renderPagination(totalPages) {
    if (totalPages <= 1) {
      pagination.innerHTML = "";
      return;
    }

    const current = state.page;
    const items = [];

    items.push(
      `<button class="page-btn" data-page="${current - 1}" ${current === 1 ? "disabled" : ""} aria-label="Página anterior"><i class="bi bi-chevron-left"></i></button>`
    );

    const pagesToShow = new Set([1, totalPages, current, current - 1, current + 1]);
    let lastRendered = 0;
    [...pagesToShow]
      .filter((n) => n >= 1 && n <= totalPages)
      .sort((a, b) => a - b)
      .forEach((n) => {
        if (lastRendered && n - lastRendered > 1) {
          items.push(`<span class="page-ellipsis">…</span>`);
        }
        items.push(
          `<button class="page-btn${n === current ? " active" : ""}" data-page="${n}">${n}</button>`
        );
        lastRendered = n;
      });

    items.push(
      `<button class="page-btn" data-page="${current + 1}" ${current === totalPages ? "disabled" : ""} aria-label="Página siguiente"><i class="bi bi-chevron-right"></i></button>`
    );

    pagination.innerHTML = items.join("");
  }

  function render({ scrollToTop = false } = {}) {
    const filtered = perfumes.filter(matchesFilters);
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    state.page = Math.min(Math.max(1, state.page), totalPages);

    resultsCount.textContent = `${filtered.length} ${filtered.length === 1 ? "perfume encontrado" : "perfumes encontrados"}`;

    if (filtered.length === 0) {
      grid.innerHTML = "";
      pagination.innerHTML = "";
      emptyState.classList.remove("d-none");
    } else {
      emptyState.classList.add("d-none");
      const start = (state.page - 1) * PAGE_SIZE;
      const pageItems = filtered.slice(start, start + PAGE_SIZE);
      grid.innerHTML = pageItems.map(cardTemplate).join("");
      renderPagination(totalPages);
    }

    if (scrollToTop) {
      catalogSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function openModal(id) {
    const p = perfumes.find((item) => item.id === id);
    if (!p) return;

    modalImage.src = p.image;
    modalImage.alt = p.name;
    modalName.textContent = p.name;
    modalBrand.textContent = p.brand || "";
    modalBrand.classList.toggle("d-none", !p.brand);
    modalGender.textContent = p.gender;
    modalCategory.textContent = categoryLabel(p.category);
    modalDescription.textContent = p.description || "Información detallada próximamente disponible.";

    modal.show();
  }

  // ---- Eventos: filtros de género y categoría (delegación de eventos) ----
  genderFilters.addEventListener("click", (e) => {
    const btn = e.target.closest(".pill");
    if (!btn) return;
    state.gender = btn.dataset.value;
    state.page = 1;
    [...genderFilters.children].forEach((b) => b.classList.toggle("active", b === btn));
    renderCategoryFilters();
    render();
  });

  categoryFilters.addEventListener("click", (e) => {
    const btn = e.target.closest(".pill");
    if (!btn) return;
    state.category = btn.dataset.value;
    state.page = 1;
    [...categoryFilters.children].forEach((b) => b.classList.toggle("active", b === btn));
    render();
  });

  // ---- Paginación ----
  pagination.addEventListener("click", (e) => {
    const btn = e.target.closest(".page-btn");
    if (!btn || btn.disabled) return;
    state.page = Number(btn.dataset.page);
    render({ scrollToTop: true });
  });

  // ---- Buscador instantáneo ----
  searchInput.addEventListener("input", (e) => {
    state.search = e.target.value.trim().toLowerCase();
    state.page = 1;
    render();
  });

  // ---- Limpiar filtros ----
  function clearFilters() {
    state.gender = "Hombre";
    state.category = "Todas";
    state.search = "";
    state.page = 1;
    searchInput.value = "";
    [...genderFilters.children].forEach((b) => b.classList.toggle("active", b.dataset.value === "Hombre"));
    renderCategoryFilters();
    render();
  }
  clearFiltersBtn.addEventListener("click", clearFilters);
  emptyStateClearBtn.addEventListener("click", clearFilters);

  // ---- Accesos rápidos del navbar (Hombre / Mujer) ----
  document.querySelectorAll("[data-quick-gender]").forEach((link) => {
    link.addEventListener("click", () => {
      const value = link.dataset.quickGender;
      state.gender = value;
      state.category = "Todas";
      state.page = 1;
      [...genderFilters.children].forEach((b) => b.classList.toggle("active", b.dataset.value === value));
      renderCategoryFilters();
      render();
    });
  });

  // ---- Click / teclado en cards -> abrir modal ----
  grid.addEventListener("click", (e) => {
    const card = e.target.closest(".perfume-card");
    if (!card) return;
    openModal(Number(card.dataset.id));
  });

  grid.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const card = e.target.closest(".perfume-card");
    if (!card) return;
    e.preventDefault();
    openModal(Number(card.dataset.id));
  });

  // ---- Header sticky con sombra al hacer scroll ----
  const header = document.getElementById("mainHeader");
  const scrollTopBtn = document.getElementById("scrollTopBtn");

  window.addEventListener("scroll", () => {
    const scrolled = window.scrollY > 12;
    header.classList.toggle("scrolled", scrolled);
    scrollTopBtn.classList.toggle("visible", window.scrollY > 480);
  });

  scrollTopBtn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // ---- Año dinámico en footer ----
  document.getElementById("year").textContent = new Date().getFullYear();

  // ---- Inicialización ----
  renderCategoryFilters();
  render();
})();
