// ===== Data prep =====
const ALL_PERFUMES = [
  ...PERFUMES.Hombre.map(p => ({ ...p, genero: 'Hombre' })),
  ...PERFUMES.Mujer.map(p => ({ ...p, genero: 'Mujer' })),
];

const TIPOS = ['Árabe', 'Diseñador', 'Nicho', 'Celebridad'];

const PRICE_BOUNDS = ALL_PERFUMES.reduce(
  (acc, p) => ({
    min: Math.min(acc.min, p.precio_consumidor),
    max: Math.max(acc.max, p.precio_consumidor),
  }),
  { min: Infinity, max: -Infinity }
);

const MARCAS = Array.from(new Set(ALL_PERFUMES.map(p => p.marca))).sort((a, b) =>
  a.localeCompare(b)
);

const DESTACADO = ALL_PERFUMES.find(p => p.marca === 'Dior' && p.nombre === 'Sauvage 100ml edp') || ALL_PERFUMES[0];

const PLACEHOLDER_SVG = 'data:image/svg+xml;utf8,' + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <g fill="#b99765" opacity="0.55">
    <rect x="40" y="10" width="20" height="10" rx="2"/>
    <rect x="35" y="20" width="30" height="12" rx="3"/>
    <rect x="28" y="32" width="44" height="55" rx="6"/>
  </g>
</svg>`);

// ===== State =====
const state = {
  view: 'inicio',
  genero: 'Todos',
  tipo: 'Todos',
  marca: null,
  query: '',
  priceMin: PRICE_BOUNDS.min,
  priceMax: PRICE_BOUNDS.max,
};

// Draft filters edited inside the sheet, applied on "Ver"
const draft = {
  tipo: 'Todos',
  priceMin: PRICE_BOUNDS.min,
  priceMax: PRICE_BOUNDS.max,
};

function formatMoney(n) {
  if (n === null || n === undefined || n === '') return '';
  return '$' + Number(n).toLocaleString('es-MX');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

// ===== Views =====
function setView(view) {
  state.view = view;
  document.querySelectorAll('.eg-view').forEach(v => v.classList.add('eg-hidden'));
  document.getElementById('view-' + view).classList.remove('eg-hidden');
  document.querySelectorAll('.eg-navbtn').forEach(b => {
    b.classList.toggle('active', b.dataset.view === view);
  });
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

document.querySelectorAll('.eg-navbtn').forEach(btn => {
  btn.addEventListener('click', () => setView(btn.dataset.view));
});

document.getElementById('btnVerCatalogo').addEventListener('click', () => setView('catalogo'));
document.getElementById('btnVerCatalogo2').addEventListener('click', () => setView('catalogo'));

// ===== Inicio: bento =====
function renderInicio() {
  document.getElementById('countHombre').textContent = PERFUMES.Hombre.length;
  document.getElementById('countMujer').textContent = PERFUMES.Mujer.length;

  document.getElementById('destacadoImg').src = DESTACADO.imagen || PLACEHOLDER_SVG;
  document.getElementById('destacadoImg').onerror = function () { this.src = PLACEHOLDER_SVG; };
  document.getElementById('destacadoNombre').textContent = DESTACADO.nombre;
  document.getElementById('destacadoSub').textContent = `${DESTACADO.marca} · ${DESTACADO.tipo}`;
  document.getElementById('destacadoPrecio').textContent = formatMoney(DESTACADO.precio_consumidor);

  const marquee = document.getElementById('marqueeTrack');
  const items = [
    `${ALL_PERFUMES.length} FRAGANCIAS`,
    `${MARCAS.length} MARCAS`,
    'DESCRIPCIONES COMPLETAS',
    'PRECIOS AL DÍA',
  ];
  const doubled = [...items, ...items];
  marquee.innerHTML = doubled.map(t => `<span>${t}</span><span>·</span>`).join('');

  const tiposWrap = document.getElementById('tiposPills');
  tiposWrap.innerHTML = TIPOS.map(
    t => `<button class="eg-tipo-chip" data-tipo="${escapeHtml(t)}">${escapeHtml(t)}</button>`
  ).join('');
  tiposWrap.querySelectorAll('.eg-tipo-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      state.genero = 'Todos';
      state.tipo = btn.dataset.tipo;
      state.marca = null;
      state.query = '';
      state.priceMin = PRICE_BOUNDS.min;
      state.priceMax = PRICE_BOUNDS.max;
      draft.tipo = btn.dataset.tipo;
      document.getElementById('searchInput').value = '';
      syncGeneroPills();
      setView('catalogo');
      renderCatalogo();
    });
  });
}

document.querySelectorAll('.eg-bento-genero').forEach(btn => {
  btn.addEventListener('click', () => {
    state.genero = btn.dataset.genero;
    state.tipo = 'Todos';
    state.marca = null;
    state.query = '';
    state.priceMin = PRICE_BOUNDS.min;
    state.priceMax = PRICE_BOUNDS.max;
    draft.tipo = 'Todos';
    document.getElementById('searchInput').value = '';
    syncGeneroPills();
    setView('catalogo');
    renderCatalogo();
  });
});

document.getElementById('btnDestacado').addEventListener('click', () => openModal(DESTACADO));

// ===== Catálogo =====
function matchesFilters(item) {
  if (state.genero !== 'Todos' && item.genero !== state.genero) return false;
  if (state.tipo !== 'Todos' && item.tipo !== state.tipo) return false;
  if (item.precio_consumidor < state.priceMin || item.precio_consumidor > state.priceMax) return false;
  if (state.marca && item.marca !== state.marca) return false;
  if (state.query) {
    const q = state.query.toLowerCase();
    return (
      item.nombre.toLowerCase().includes(q) ||
      item.marca.toLowerCase().includes(q) ||
      item.tipo.toLowerCase().includes(q)
    );
  }
  return true;
}

function syncGeneroPills() {
  document.querySelectorAll('#generoPills .eg-pill[data-genero]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.genero === state.genero);
  });
}

function updateFiltrosBadge() {
  const badge = document.getElementById('filtrosBadge');
  let count = 0;
  if (state.tipo !== 'Todos') count++;
  if (state.priceMin !== PRICE_BOUNDS.min || state.priceMax !== PRICE_BOUNDS.max) count++;
  if (count > 0) {
    badge.textContent = count;
    badge.classList.remove('eg-hidden');
  } else {
    badge.classList.add('eg-hidden');
  }
}

function renderCatalogo() {
  const grid = document.getElementById('perfumeGrid');
  const emptyMsg = document.getElementById('emptyMsg');
  const items = ALL_PERFUMES.filter(matchesFilters);

  document.getElementById('catCount').textContent = items.length;
  updateFiltrosBadge();

  grid.innerHTML = '';
  emptyMsg.classList.toggle('eg-hidden', items.length !== 0);

  items.forEach(item => {
    const card = document.createElement('button');
    card.className = 'eg-card';
    const imgSrc = item.imagen || PLACEHOLDER_SVG;
    card.innerHTML = `
      <div class="eg-card-img">
        <img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(item.nombre)}" loading="lazy"
             onerror="this.src='${PLACEHOLDER_SVG}'">
      </div>
      <div class="eg-card-tag">${escapeHtml(item.marca)}</div>
      <div class="eg-card-name">${escapeHtml(item.nombre)}</div>
      <div class="eg-card-sub">${escapeHtml(item.genero)} · ${escapeHtml(item.tipo)}</div>
      <div class="eg-card-prices">
        ${item.precio_original ? `<span class="eg-price-original">${formatMoney(item.precio_original)}</span>` : ''}
        <span class="eg-price-consumidor">${formatMoney(item.precio_consumidor)}</span>
      </div>
    `;
    card.addEventListener('click', () => openModal(item));
    grid.appendChild(card);
  });
}

document.querySelectorAll('#generoPills .eg-pill[data-genero]').forEach(btn => {
  btn.addEventListener('click', () => {
    state.genero = btn.dataset.genero;
    state.marca = null;
    syncGeneroPills();
    renderCatalogo();
  });
});

document.getElementById('searchInput').addEventListener('input', e => {
  state.query = e.target.value.trim();
  renderCatalogo();
});

// ===== Marcas =====
function renderMarcas() {
  document.getElementById('marcasCount').textContent = MARCAS.length;
  const grid = document.getElementById('marcasGrid');
  grid.innerHTML = MARCAS.map(marca => {
    const count = ALL_PERFUMES.filter(p => p.marca === marca).length;
    return `<button class="eg-marca-card" data-marca="${escapeHtml(marca)}">
      <div class="eg-marca-name">${escapeHtml(marca)}</div>
      <div class="eg-marca-count">${count} fragancia${count === 1 ? '' : 's'}</div>
    </button>`;
  }).join('');
  grid.querySelectorAll('.eg-marca-card').forEach(btn => {
    btn.addEventListener('click', () => {
      state.marca = btn.dataset.marca;
      state.genero = 'Todos';
      state.tipo = 'Todos';
      state.query = '';
      draft.tipo = 'Todos';
      document.getElementById('searchInput').value = '';
      syncGeneroPills();
      setView('catalogo');
      renderCatalogo();
    });
  });
}

// ===== Filter sheet =====
const sheetOverlay = document.getElementById('sheetOverlay');
const rangeMinInput = document.getElementById('rangeMin');
const rangeMaxInput = document.getElementById('rangeMax');

function renderTipoFilterPills() {
  const wrap = document.getElementById('tipoFilterPills');
  const options = ['Todos', ...TIPOS];
  wrap.innerHTML = options
    .map(t => `<button class="eg-pill${draft.tipo === t ? ' active' : ''}" data-tipo="${escapeHtml(t)}">${escapeHtml(t)}</button>`)
    .join('');
  wrap.querySelectorAll('.eg-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      draft.tipo = btn.dataset.tipo;
      renderTipoFilterPills();
      updateSheetCount();
    });
  });
}

function updateRangeUI() {
  const { min, max } = PRICE_BOUNDS;
  const span = max - min || 1;
  const leftPct = ((draft.priceMin - min) / span) * 100;
  const rightPct = 100 - ((draft.priceMax - min) / span) * 100;
  document.getElementById('rangeFill').style.left = leftPct + '%';
  document.getElementById('rangeFill').style.right = rightPct + '%';
  document.getElementById('rangeValue').textContent =
    `${formatMoney(draft.priceMin)} – ${formatMoney(draft.priceMax)}`;
}

function countWithDraft() {
  return ALL_PERFUMES.filter(item => {
    if (state.genero !== 'Todos' && item.genero !== state.genero) return false;
    if (draft.tipo !== 'Todos' && item.tipo !== draft.tipo) return false;
    if (item.precio_consumidor < draft.priceMin || item.precio_consumidor > draft.priceMax) return false;
    if (state.marca && item.marca !== state.marca) return false;
    if (state.query) {
      const q = state.query.toLowerCase();
      if (
        !item.nombre.toLowerCase().includes(q) &&
        !item.marca.toLowerCase().includes(q) &&
        !item.tipo.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  }).length;
}

function updateSheetCount() {
  const n = countWithDraft();
  document.getElementById('btnAplicarFiltros').textContent = `Ver ${n} fragancia${n === 1 ? '' : 's'}`;
}

function openSheet() {
  draft.tipo = state.tipo;
  draft.priceMin = state.priceMin;
  draft.priceMax = state.priceMax;
  rangeMinInput.min = PRICE_BOUNDS.min;
  rangeMinInput.max = PRICE_BOUNDS.max;
  rangeMaxInput.min = PRICE_BOUNDS.min;
  rangeMaxInput.max = PRICE_BOUNDS.max;
  rangeMinInput.value = draft.priceMin;
  rangeMaxInput.value = draft.priceMax;
  renderTipoFilterPills();
  updateRangeUI();
  updateSheetCount();
  sheetOverlay.classList.remove('eg-hidden');
}

function closeSheet() {
  sheetOverlay.classList.add('eg-hidden');
}

document.getElementById('btnOpenFiltros').addEventListener('click', openSheet);
sheetOverlay.addEventListener('click', e => {
  if (e.target === sheetOverlay) closeSheet();
});

rangeMinInput.addEventListener('input', () => {
  draft.priceMin = Math.min(Number(rangeMinInput.value), draft.priceMax);
  rangeMinInput.value = draft.priceMin;
  updateRangeUI();
  updateSheetCount();
});

rangeMaxInput.addEventListener('input', () => {
  draft.priceMax = Math.max(Number(rangeMaxInput.value), draft.priceMin);
  rangeMaxInput.value = draft.priceMax;
  updateRangeUI();
  updateSheetCount();
});

document.getElementById('btnLimpiarFiltros').addEventListener('click', () => {
  draft.tipo = 'Todos';
  draft.priceMin = PRICE_BOUNDS.min;
  draft.priceMax = PRICE_BOUNDS.max;
  rangeMinInput.value = draft.priceMin;
  rangeMaxInput.value = draft.priceMax;
  renderTipoFilterPills();
  updateRangeUI();
  updateSheetCount();
});

document.getElementById('btnAplicarFiltros').addEventListener('click', () => {
  state.tipo = draft.tipo;
  state.priceMin = draft.priceMin;
  state.priceMax = draft.priceMax;
  closeSheet();
  renderCatalogo();
});

// ===== Detail modal =====
const modalOverlay = document.getElementById('modalOverlay');

function openModal(item) {
  document.getElementById('modalImg').src = item.imagen || PLACEHOLDER_SVG;
  document.getElementById('modalImg').onerror = function () { this.src = PLACEHOLDER_SVG; };
  document.getElementById('modalTipo').textContent = `${item.genero} · ${item.tipo}`;
  document.getElementById('modalMarca').textContent = item.marca;
  document.getElementById('modalNombre').textContent = item.nombre;
  const origEl = document.getElementById('modalPrecioOriginal');
  if (item.precio_original) {
    origEl.textContent = formatMoney(item.precio_original);
    origEl.style.display = 'inline';
  } else {
    origEl.style.display = 'none';
  }
  document.getElementById('modalPrecioConsumidor').textContent = formatMoney(item.precio_consumidor);
  document.getElementById('modalDescripcion').textContent = item.descripcion || '';
  modalOverlay.classList.remove('eg-hidden');
}

document.getElementById('modalClose').addEventListener('click', () => {
  modalOverlay.classList.add('eg-hidden');
});
modalOverlay.addEventListener('click', e => {
  if (e.target === modalOverlay) modalOverlay.classList.add('eg-hidden');
});

// ===== Init =====
renderInicio();
renderCatalogo();
renderMarcas();
