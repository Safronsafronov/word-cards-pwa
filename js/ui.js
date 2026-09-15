// Small generic UI helpers: bottom sheet, toast. Kept framework-free on purpose.

let sheetStack = [];

export function openSheet({ title, bodyHTML, doneLabel = 'Done', onDone = null, onOpen = null, showHeader = true }) {
  const backdrop = document.getElementById('sheet-backdrop');
  const sheet = document.getElementById('sheet');
  const header = document.getElementById('sheet-header-title');
  const doneBtn = document.getElementById('sheet-done-btn');
  const body = document.getElementById('sheet-body');
  const headerRow = document.getElementById('sheet-header');

  headerRow.style.display = showHeader ? 'flex' : 'none';
  header.textContent = title || '';
  doneBtn.textContent = doneLabel;
  doneBtn.onclick = () => {
    const result = onDone ? onDone() : true;
    if (result !== false) closeSheet();
  };
  body.innerHTML = bodyHTML;

  backdrop.classList.add('open');
  requestAnimationFrame(() => sheet.classList.add('open'));
  backdrop.onclick = (e) => { if (e.target === backdrop) closeSheet(); };

  if (onOpen) onOpen(body);
}

export function closeSheet() {
  const backdrop = document.getElementById('sheet-backdrop');
  const sheet = document.getElementById('sheet');
  sheet.classList.remove('open');
  setTimeout(() => { backdrop.classList.remove('open'); }, 280);
}

let toastTimer = null;
export function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

export function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
