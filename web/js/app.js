(function () {
  const PAGE_SIZE = 24;

  const state = {
    gender: 'all',
    line: 'all',
    search: '',
    visibleCount: PAGE_SIZE,
  };

  const grid = document.getElementById('productGrid');
  const resultsCount = document.getElementById('resultsCount');
  const emptyState = document.getElementById('emptyState');
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  const searchInput = document.getElementById('searchInput');

  const lineLabels = { Arabes: 'Árabe', Disenador: 'Diseñador', Nicho: 'Nicho' };

  function formatPrice(value) {
    if (value === null || value === undefined) return null;
    return '$' + value.toLocaleString('es-MX');
  }

  function normalize(s) {
    return s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase();
  }

  function getFiltered() {
    const term = normalize(state.search.trim());
    return PRODUCTS.filter(p => {
      if (state.gender !== 'all' && p.gender !== state.gender) return false;
      if (state.line !== 'all' && p.line !== state.line) return false;
      if (term) {
        const haystack = normalize((p.brand || '') + ' ' + p.name);
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }

  function cardTemplate(p) {
    const price = formatPrice(p.priceConsumidor);
    const priceHtml = price
      ? `<div class="eg-card-price">${price}</div>`
      : `<div class="eg-card-price eg-card-price-na">Consultar precio</div>`;

    return `
      <div class="col-6 col-md-4 col-lg-3">
        <div class="eg-card" data-id="${p.id}">
          <div class="eg-card-img-wrap">
            <span class="eg-badge">${lineLabels[p.line] || p.line}</span>
            <img src="${p.image}" alt="${p.name}" loading="lazy">
          </div>
          <div class="eg-card-body">
            ${p.brand ? `<div class="eg-card-brand">${p.brand}</div>` : ''}
            <div class="eg-card-name">${p.name}</div>
            <div class="eg-card-gender">${p.gender}</div>
            ${priceHtml}
          </div>
        </div>
      </div>
    `;
  }

  function render() {
    const filtered = getFiltered();
    const toShow = filtered.slice(0, state.visibleCount);

    grid.innerHTML = toShow.map(cardTemplate).join('');
    resultsCount.textContent = filtered.length
      ? `Mostrando ${toShow.length} de ${filtered.length} fragancias`
      : '';
    emptyState.style.display = filtered.length ? 'none' : 'block';
    loadMoreBtn.style.display = state.visibleCount < filtered.length ? 'inline-block' : 'none';

    grid.querySelectorAll('.eg-card').forEach(card => {
      card.addEventListener('click', () => openModal(Number(card.dataset.id)));
    });
  }

  function openModal(id) {
    const p = PRODUCTS.find(x => x.id === id);
    if (!p) return;
    document.getElementById('modalImage').src = p.image;
    document.getElementById('modalImage').alt = p.name;
    document.getElementById('modalName').textContent = p.name;

    const parts = [];
    if (p.brand) parts.push(p.brand);
    parts.push(p.gender);
    parts.push(lineLabels[p.line] || p.line);
    let metaHtml = parts.join(' · ');

    if (p.priceConsumidor) {
      metaHtml += `<br><span class="eg-modal-price">${formatPrice(p.priceConsumidor)}</span>`;
    } else {
      metaHtml += '<br>Consultar precio';
    }

    document.getElementById('modalMeta').innerHTML = metaHtml;

    const notesEl = document.getElementById('modalNotes');
    if (p.notes) {
      notesEl.innerHTML = `
        <div class="eg-notes-title">Notas olfativas</div>
        <p class="eg-notes-text">${p.notes}</p>
      `;
      notesEl.style.display = 'block';
    } else {
      notesEl.innerHTML = '';
      notesEl.style.display = 'none';
    }

    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('productModal'));
    modal.show();
  }

  document.getElementById('genderFilter').addEventListener('click', e => {
    const btn = e.target.closest('.eg-filter-btn');
    if (!btn) return;
    document.querySelectorAll('#genderFilter .eg-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.gender = btn.dataset.gender;
    state.visibleCount = PAGE_SIZE;
    render();
  });

  document.getElementById('lineFilter').addEventListener('click', e => {
    const btn = e.target.closest('.eg-filter-btn');
    if (!btn) return;
    document.querySelectorAll('#lineFilter .eg-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.line = btn.dataset.line;
    state.visibleCount = PAGE_SIZE;
    render();
  });

  document.querySelectorAll('[data-nav-gender]').forEach(link => {
    link.addEventListener('click', () => {
      const gender = link.dataset.navGender;
      state.gender = gender;
      state.visibleCount = PAGE_SIZE;
      document.querySelectorAll('#genderFilter .eg-filter-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.gender === gender);
      });
      render();

      const navEl = document.getElementById('egNav');
      if (navEl.classList.contains('show')) {
        bootstrap.Collapse.getOrCreateInstance(navEl).hide();
      }
    });
  });

  let searchTimer;
  searchInput.addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.search = e.target.value;
      state.visibleCount = PAGE_SIZE;
      render();
    }, 150);
  });

  loadMoreBtn.addEventListener('click', () => {
    state.visibleCount += PAGE_SIZE;
    render();
  });

  const searchToggleBtn = document.getElementById('searchToggleBtn');
  const navSearchBar = document.getElementById('navSearchBar');
  const searchCloseBtn = document.getElementById('searchCloseBtn');

  function openNavSearch() {
    navSearchBar.classList.add('show');
    searchToggleBtn.classList.add('active');
    searchToggleBtn.setAttribute('aria-expanded', 'true');
    setTimeout(() => searchInput.focus(), 300);
  }

  function closeNavSearch() {
    navSearchBar.classList.remove('show');
    searchToggleBtn.classList.remove('active');
    searchToggleBtn.setAttribute('aria-expanded', 'false');
  }

  searchToggleBtn.addEventListener('click', () => {
    if (navSearchBar.classList.contains('show')) {
      closeNavSearch();
    } else {
      openNavSearch();
    }
  });

  searchCloseBtn.addEventListener('click', closeNavSearch);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && navSearchBar.classList.contains('show')) {
      closeNavSearch();
    }
  });

  document.getElementById('year').textContent = new Date().getFullYear();

  render();
})();
