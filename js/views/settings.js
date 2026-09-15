// Ported from SettingsView.swift

import { iconMarkup } from '../icons.js';
import { escapeHTML, openSheet, closeSheet, showToast } from '../ui.js';

export class SettingsOverlay {
  constructor(root, store) {
    this.root = root; // #settings-overlay
    this.store = store;
  }

  open() {
    this.root.innerHTML = `
      <div class="back-header">
        <button class="back-btn" data-action="close" style="width:58px;">${iconMarkup('arrowLeft')}<span>Back</span></button>
        <span class="title">Settings</span>
        <span class="spacer"></span>
      </div>
      <div class="screen-pad" style="padding-top:0;">
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px;">
          <button class="settings-btn" data-action="import">
            ${iconMarkup('docPlus').replace('<svg', '<svg class="leading"')}
            <span class="label">Import from CSV</span>
            ${iconMarkup('chevronRight').replace('<svg', '<svg class="trailing"')}
          </button>
          <button class="settings-btn" data-action="export">
            ${iconMarkup('exportUp').replace('<svg', '<svg class="leading"')}
            <span class="label">Export Collection</span>
            ${iconMarkup('chevronRight').replace('<svg', '<svg class="trailing"')}
          </button>
        </div>
        <p class="settings-hint" style="margin-top:14px;">Format: CSV with columns word,translation</p>
      </div>
    `;
    this.root.classList.add('open');
    this.bind();
  }

  close() {
    this.root.classList.remove('open');
  }

  bind() {
    this.root.querySelector('[data-action="close"]').onclick = () => this.close();
    this.root.querySelector('[data-action="import"]').onclick = () => this.openImportTargetPicker();
    this.root.querySelector('[data-action="export"]').onclick = () => this.openExportTargetPicker();
  }

  openImportTargetPicker() {
    if (this.store.collections.length === 0) { showToast('Create a collection first.'); return; }
    openSheet({
      title: 'Where to import?',
      bodyHTML: this.store.collections.map(c => `<button class="secondary-list-btn" data-id="${c.id}">${escapeHTML(c.title)}</button>`).join('')
        + `<button class="secondary-list-btn" data-action="cancel">Cancel</button>`,
      showHeader: false,
      onOpen: (body) => {
        body.querySelectorAll('[data-id]').forEach(btn => {
          btn.onclick = () => { closeSheet(); this.triggerCSVImport(btn.dataset.id); };
        });
        const cancel = body.querySelector('[data-action="cancel"]');
        if (cancel) cancel.onclick = () => closeSheet();
      },
    });
  }

  triggerCSVImport(collectionID) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,text/csv,text/plain';
    input.onchange = () => {
      const file = input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const summary = this.store.importCSV(String(reader.result), collectionID);
        showToast(`Import completed. Added: ${summary.added}, skipped: ${summary.skipped}.`);
      };
      reader.onerror = () => showToast('Could not read file. Use UTF-8 CSV.');
      reader.readAsText(file, 'utf-8');
    };
    input.click();
  }

  openExportTargetPicker() {
    if (this.store.collections.length === 0) { showToast('No collections to export.'); return; }
    openSheet({
      title: 'Which collection to export?',
      bodyHTML: this.store.collections.map(c => `<button class="secondary-list-btn" data-id="${c.id}">${escapeHTML(c.title)}</button>`).join('')
        + `<button class="secondary-list-btn" data-action="cancel">Cancel</button>`,
      showHeader: false,
      onOpen: (body) => {
        body.querySelectorAll('[data-id]').forEach(btn => {
          btn.onclick = () => { closeSheet(); this.startExport(btn.dataset.id); };
        });
        const cancel = body.querySelector('[data-action="cancel"]');
        if (cancel) cancel.onclick = () => closeSheet();
      },
    });
  }

  startExport(collectionID) {
    const collection = this.store.collections.find(c => c.id === collectionID);
    const csvText = this.store.exportCSV(collectionID);
    if (!csvText) { showToast('Could not generate CSV.'); return; }

    const filename = `${sanitizeFilename(collection.title)}.csv`;
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('Collection exported successfully.');
  }
}

function sanitizeFilename(value) {
  const clean = value.replace(/[^A-Za-z0-9 _-]/g, '_').trim().replace(/ {2,}/g, ' ');
  return clean.length ? clean : 'collection';
}
