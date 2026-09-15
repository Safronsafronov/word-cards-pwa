// Ported from WordListView.swift

import { iconMarkup } from '../icons.js';
import { escapeHTML, openSheet, closeSheet, showToast } from '../ui.js';
import { CardTextRules, CardFrontSide } from '../models.js';
import { formatDateAbbrev } from '../dateutils.js';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'newWords', label: 'New Words' },
  { key: 'toStudy', label: 'To Review' },
  { key: 'studied', label: 'Studied' },
];

const LONG_PRESS_MS = 500;

export class WordBaseView {
  constructor(container, store, actions) {
    this.container = container;
    this.store = store;
    this.actions = actions;

    this.mode = 'grid'; // 'grid' | 'detail'
    this.currentCollection = null;
    this.searchText = '';
    this.selectedFilter = 'all';
    this.selectionMode = false;
    this.selectedIDs = new Set();
    this.isActive = true;

    this._unsub = store.subscribe(() => this.onStoreChange());
  }

  activate() { this.isActive = true; this.render(); }
  deactivate() { this.isActive = false; }

  onStoreChange() {
    if (!this.isActive) return;
    if (this.mode === 'detail' && this.currentCollection && !this.store.collections.some(c => c.id === this.currentCollection.id)) {
      this.mode = 'grid';
      this.currentCollection = null;
    }
    this.render();
  }

  render() {
    this.container.innerHTML = this.mode === 'grid' ? this.renderGrid() : this.renderDetail();
    this.bind();
  }

  // ---------- Collections grid ----------

  renderGrid() {
    const metrics = this.store.collectionTileMetrics();
    return `
      <div class="wl-header" style="padding-top:12px;padding-bottom:6px;">
        <h1 class="page-title">Collections</h1>
        <div style="flex:1"></div>
        <button class="icon-btn" data-action="open-settings">${iconMarkup('gear')}</button>
      </div>
      <div class="collections-grid">
        ${this.store.collections.map(c => this.renderTile(c, metrics[c.id])).join('')}
      </div>
      <button class="fab" data-action="create-collection">${iconMarkup('plus')}</button>
    `;
  }

  renderTile(collection, m) {
    const metrics = m || { total: 0, newCount: 0, toStudy: 0, studiedCount: 0 };
    return `
      <div class="collection-tile" data-action="open-collection" data-id="${collection.id}">
        <div class="ct-title-row">${iconMarkup('stackFill')}<span class="ct-title">${escapeHTML(collection.title)}</span></div>
        <div class="ct-bottom">
          <div>
            <div class="ct-count">${metrics.total}</div>
            <div class="ct-count-label">cards</div>
          </div>
          <div class="ct-status-lines">
            <div class="ct-status-line"><span style="color:var(--status-new)">${iconMarkup('sparkles')}</span><span class="n">${metrics.newCount}</span></div>
            <div class="ct-status-line"><span style="color:var(--accent)">${iconMarkup('clock')}</span><span class="n">${metrics.toStudy}</span></div>
            <div class="ct-status-line"><span style="color:var(--status-studied)">${iconMarkup('checkSeal')}</span><span class="n">${metrics.studiedCount}</span></div>
          </div>
        </div>
        <button class="collection-tile-delete" data-action="delete-collection" data-id="${collection.id}">${iconMarkup('trash')}</button>
      </div>
    `;
  }

  // ---------- Collection detail ----------

  get filteredItems() {
    const query = this.searchText.trim().toLowerCase();
    const items = this.store.items_in(this.currentCollection.id);
    return items.filter(item => {
      const matchesSearch = !query || item.english.toLowerCase().includes(query) || item.translation.toLowerCase().includes(query);
      let matchesFilter = true;
      if (this.selectedFilter !== 'all') matchesFilter = this.store.learningBucket(item) === this.selectedFilter;
      return matchesSearch && matchesFilter;
    });
  }

  renderDetail() {
    const items = this.filteredItems;
    const hasQuery = this.searchText.trim().length > 0;
    return `
      <div class="wl-header">
        <button class="icon-btn sm" data-action="back-to-grid">${iconMarkup('arrowLeft')}</button>
        <span class="wl-title">${escapeHTML(this.currentCollection.title)}</span>
        <button class="icon-btn sm" data-action="swap-collection">${iconMarkup('swap')}</button>
        <button class="wl-select-btn" data-action="toggle-selection">${this.selectionMode ? 'Done' : 'Select'}</button>
      </div>
      <div class="search-bar">
        ${iconMarkup('search')}
        <input type="text" id="search-input" placeholder="Search Word or Translation" value="${escapeHTML(this.searchText)}">
      </div>
      <div class="filter-chips">
        ${FILTERS.map(f => `<button class="chip ${this.selectedFilter === f.key ? 'active' : ''}" data-filter="${f.key}">${f.label}</button>`).join('')}
      </div>
      <div class="word-list" id="word-list">
        ${this.renderWordListInner(items, hasQuery)}
      </div>
      <button class="fab ${this.selectionMode ? 'danger' : ''}" data-action="fab-action" ${this.selectionMode && this.selectedIDs.size === 0 ? 'disabled' : ''}>
        ${iconMarkup(this.selectionMode ? 'trash' : 'plus')}
      </button>
    `;
  }

  renderWordListInner(items, hasQuery) {
    return items.length === 0 ? this.renderEmpty(hasQuery) : items.map(i => this.renderWordRow(i)).join('');
  }

  renderEmpty(hasQuery) {
    return `
      <div class="empty-state">
        ${iconMarkup('circleDashed')}
        <div class="es-title">${hasQuery ? 'No cards match your search.' : 'No cards in this collection yet.'}</div>
        ${!hasQuery ? '<div class="es-sub">Tap + to add your first card.</div>' : ''}
      </div>
    `;
  }

  renderWordRow(item) {
    const isSelected = this.selectedIDs.has(item.id);
    const front = item.frontSide === CardFrontSide.english ? item.english : item.translation;
    const back = item.frontSide === CardFrontSide.english ? item.translation : item.english;
    return `
      <div class="word-row ${isSelected ? 'selected' : ''}" data-action="word-row" data-id="${item.id}">
        ${this.selectionMode ? `<span class="sel-circle ${isSelected ? 'checked' : ''}">${isSelected ? iconMarkup('check') : ''}</span>` : ''}
        <div class="wr-main">
          <div class="wr-front">${escapeHTML(front)}</div>
          <div class="wr-back">${escapeHTML(back)}</div>
        </div>
        <div class="wr-meta">
          <div class="wr-meta-label">Next review</div>
          <div class="wr-meta-value">${formatDateAbbrev(item.nextReview)}</div>
        </div>
      </div>
    `;
  }

  // ---------- Bindings ----------

  bind() {
    this.container.querySelectorAll('[data-action="open-settings"]').forEach(b => b.onclick = () => this.actions.openSettings());

    if (this.mode === 'grid') {
      this.container.querySelectorAll('[data-action="open-collection"]').forEach(tile => {
        this.bindLongPress(tile, () => this.confirmDeleteCollection(tile.dataset.id));
        tile.addEventListener('click', (e) => {
          if (e.target.closest('[data-action="delete-collection"]')) return;
          this.openCollection(tile.dataset.id);
        });
      });
      this.container.querySelectorAll('[data-action="delete-collection"]').forEach(b => {
        b.onclick = (e) => { e.stopPropagation(); this.confirmDeleteCollection(b.dataset.id); };
      });
      const createBtn = this.container.querySelector('[data-action="create-collection"]');
      if (createBtn) createBtn.onclick = () => this.openCreateCollection();
      return;
    }

    // detail mode
    this.container.querySelector('[data-action="back-to-grid"]').onclick = () => { this.mode = 'grid'; this.currentCollection = null; this.render(); };
    this.container.querySelector('[data-action="swap-collection"]').onclick = () => this.store.swapWordAndTranslation(this.currentCollection.id);
    this.container.querySelector('[data-action="toggle-selection"]').onclick = () => {
      this.selectionMode = !this.selectionMode;
      if (!this.selectionMode) this.selectedIDs.clear();
      this.render();
    };

    const search = this.container.querySelector('#search-input');
    search.oninput = () => { this.searchText = search.value; this.refreshWordList(); };

    this.container.querySelectorAll('.chip').forEach(chip => {
      chip.onclick = () => {
        this.selectedFilter = chip.dataset.filter;
        this.container.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c === chip));
        this.refreshWordList();
      };
    });

    this.bindWordRows();

    const fab = this.container.querySelector('[data-action="fab-action"]');
    if (fab) fab.onclick = () => {
      if (this.selectionMode) {
        this.store.deleteItems(this.selectedIDs);
        this.selectedIDs.clear();
        this.selectionMode = false;
        this.render();
      } else {
        this.openAddActions();
      }
    };
  }

  // Re-renders only the word list (keeps the search input focused/caret position intact).
  refreshWordList() {
    const items = this.filteredItems;
    const hasQuery = this.searchText.trim().length > 0;
    const list = this.container.querySelector('#word-list');
    list.innerHTML = this.renderWordListInner(items, hasQuery);
    this.bindWordRows();

    const fab = this.container.querySelector('[data-action="fab-action"]');
    if (fab) fab.disabled = this.selectionMode && this.selectedIDs.size === 0;
  }

  bindWordRows() {
    this.container.querySelectorAll('[data-action="word-row"]').forEach(row => {
      const id = row.dataset.id;
      this.bindLongPress(row, () => this.confirmDeleteWord(id));
      row.addEventListener('click', () => {
        if (this.selectionMode) {
          if (this.selectedIDs.has(id)) this.selectedIDs.delete(id); else this.selectedIDs.add(id);
          this.refreshWordList();
        } else {
          const item = this.store.items.find(i => i.id === id);
          if (item) this.openWordEditor({ mode: 'edit', item });
        }
      });
    });
  }

  bindLongPress(el, onLongPress) {
    let timer = null;
    const start = () => { timer = setTimeout(onLongPress, LONG_PRESS_MS); };
    const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };
    el.addEventListener('pointerdown', start);
    el.addEventListener('pointerup', cancel);
    el.addEventListener('pointerleave', cancel);
    el.addEventListener('pointercancel', cancel);
    el.addEventListener('contextmenu', (e) => { e.preventDefault(); onLongPress(); });
  }

  openCollection(id) {
    const collection = this.store.collections.find(c => c.id === id);
    if (!collection) return;
    this.currentCollection = collection;
    this.mode = 'detail';
    this.searchText = '';
    this.selectedFilter = 'all';
    this.selectionMode = false;
    this.selectedIDs.clear();
    this.render();
  }

  confirmDeleteCollection(id) {
    const collection = this.store.collections.find(c => c.id === id);
    if (!collection) return;
    openSheet({
      title: 'Delete Collection',
      bodyHTML: `
        <p style="font-size:14px;color:var(--text-secondary);margin:8px 0 16px;">Delete "${escapeHTML(collection.title)}" and all its cards? This cannot be undone.</p>
        <button class="secondary-list-btn destructive" data-action="confirm-delete">Delete Collection</button>
        <button class="secondary-list-btn" data-action="cancel">Cancel</button>
      `,
      showHeader: false,
      onOpen: (body) => {
        body.querySelector('[data-action="confirm-delete"]').onclick = () => { this.store.deleteCollection(id); closeSheet(); };
        body.querySelector('[data-action="cancel"]').onclick = () => closeSheet();
      },
    });
  }

  confirmDeleteWord(id) {
    openSheet({
      title: 'Delete Card',
      bodyHTML: `
        <button class="secondary-list-btn destructive" data-action="confirm-delete">Delete</button>
        <button class="secondary-list-btn" data-action="cancel">Cancel</button>
      `,
      showHeader: false,
      onOpen: (body) => {
        body.querySelector('[data-action="confirm-delete"]').onclick = () => { this.store.deleteItems(new Set([id])); closeSheet(); };
        body.querySelector('[data-action="cancel"]').onclick = () => closeSheet();
      },
    });
  }

  openCreateCollection() {
    openSheet({
      title: 'Create Collection',
      bodyHTML: `
        <div class="form-row">
          <label>Collection Name</label>
          <input type="text" id="new-collection-title" placeholder="Title">
        </div>
      `,
      doneLabel: 'Create',
      onDone: () => {
        const title = document.getElementById('new-collection-title').value;
        if (!title.trim()) return false;
        this.store.createCollection(title);
      },
      onOpen: (body) => body.querySelector('#new-collection-title').focus(),
    });
  }

  openAddActions() {
    openSheet({
      title: 'Add to Collection',
      bodyHTML: `
        <button class="secondary-list-btn" data-action="add-card">Add Card</button>
        <button class="secondary-list-btn" data-action="import-csv">Import CSV</button>
        <button class="secondary-list-btn" data-action="cancel">Cancel</button>
      `,
      showHeader: false,
      onOpen: (body) => {
        body.querySelector('[data-action="add-card"]').onclick = () => { closeSheet(); this.openWordEditor({ mode: 'add' }); };
        body.querySelector('[data-action="import-csv"]').onclick = () => { closeSheet(); this.triggerCSVImport(); };
        body.querySelector('[data-action="cancel"]').onclick = () => closeSheet();
      },
    });
  }

  triggerCSVImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,text/csv,text/plain';
    input.onchange = () => {
      const file = input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const summary = this.store.importCSV(String(reader.result), this.currentCollection.id);
        showToast(`Import completed. Added ${summary.added}, skipped ${summary.skipped}.`);
      };
      reader.onerror = () => showToast('Could not read CSV file.');
      reader.readAsText(file, 'utf-8');
    };
    input.click();
  }

  openWordEditor({ mode, item = null }) {
    const english = item ? item.english : '';
    const translation = item ? item.translation : '';
    const frontSideInit = item ? item.frontSide : CardFrontSide.english;

    const body = `
      <div class="form-row">
        <label>Word</label>
        <input type="text" id="we-english" value="${escapeHTML(english)}">
      </div>
      <div class="form-row">
        <label>Translation</label>
        <input type="text" id="we-translation" value="${escapeHTML(translation)}">
      </div>
      <div class="form-row">
        <label>Front Side</label>
        <div class="segmented" id="we-front-side">
          <button data-value="english" class="${frontSideInit === 'english' ? 'active' : ''}">Word</button>
          <button data-value="translation" class="${frontSideInit === 'translation' ? 'active' : ''}">Translation</button>
        </div>
      </div>
    `;

    let frontSide = frontSideInit;

    openSheet({
      title: mode === 'add' ? 'Add Card' : 'Edit Card',
      bodyHTML: body,
      doneLabel: 'Save',
      onDone: () => {
        const eng = document.getElementById('we-english').value;
        const tr = document.getElementById('we-translation').value;
        if (!eng.trim() || !tr.trim()) return false;
        if (eng.trim().length > CardTextRules.maxRecommendedLength || tr.trim().length > CardTextRules.maxRecommendedLength) {
          showToast(`Card is too long. Max ${CardTextRules.maxRecommendedLength} characters.`);
          return false;
        }
        if (mode === 'add') this.store.addWord(this.currentCollection.id, eng, tr, frontSide);
        else this.store.updateWord(item.id, eng, tr, frontSide);
      },
      onOpen: (body) => {
        body.querySelectorAll('#we-front-side button').forEach(btn => {
          btn.onclick = () => {
            frontSide = btn.dataset.value;
            body.querySelectorAll('#we-front-side button').forEach(b2 => b2.classList.toggle('active', b2 === btn));
          };
        });
      },
    });
  }
}
