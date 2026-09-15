// Ported from CollectionFilterPicker.swift

import { iconMarkup } from '../icons.js';
import { openSheet, closeSheet } from '../ui.js';

function compactTitle(title, maxCount) {
  if (title.length <= maxCount) return title;
  return title.slice(0, maxCount - 1) + '…';
}

function selectedTitle(store) {
  if (store.selectedTrainingCollectionIDs.size === 0) return 'All Collections';
  const selected = store.collections.filter(c => store.selectedTrainingCollectionIDs.has(c.id));
  if (selected.length === 1) return compactTitle(selected[0].title, 24);
  return `Selected: ${selected.length}`;
}

export function renderCollectionFilter(store) {
  return `
    <div class="collection-filter">
      <span class="cf-label">Collection:</span>
      <button class="cf-pill" data-action="open-collection-filter">
        ${iconMarkup('stackOutline')}
        <span class="title">${selectedTitle(store)}</span>
        <span class="chev-down">${iconMarkup('chevronDown')}</span>
      </button>
    </div>
  `;
}

export function bindCollectionFilter(root, store, onChange) {
  const btn = root.querySelector('[data-action="open-collection-filter"]');
  if (!btn) return;
  btn.onclick = () => openCollectionFilterSheet(store, onChange);
}

function openCollectionFilterSheet(store, onChange) {
  const renderList = () => {
    const allChecked = store.selectedTrainingCollectionIDs.size === 0;
    return `
      <button class="sheet-list-item" data-id="__all__">
        <span class="t">All Collections</span>
        ${allChecked ? `<span class="check">${iconMarkup('check')}</span>` : ''}
      </button>
      ${store.collections.map(c => {
        const checked = store.selectedTrainingCollectionIDs.has(c.id);
        return `
          <button class="sheet-list-item" data-id="${c.id}">
            <span class="t">${compactTitle(c.title, 34)}</span>
            ${checked ? `<span class="check">${iconMarkup('check')}</span>` : ''}
          </button>
        `;
      }).join('')}
    `;
  };

  openSheet({
    title: 'Select Collections',
    bodyHTML: renderList(),
    doneLabel: 'Done',
    onDone: () => onChange && onChange(),
    onOpen: (body) => {
      body.addEventListener('click', (e) => {
        const item = e.target.closest('[data-id]');
        if (!item) return;
        const id = item.dataset.id;
        if (id === '__all__') {
          store.setTrainingCollections(new Set());
        } else {
          store.toggleTrainingCollection(id);
        }
        body.innerHTML = renderList();
      });
    },
  });
}

export { closeSheet };
