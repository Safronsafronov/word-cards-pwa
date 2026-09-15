// Ported from TrainingView.swift

import { iconMarkup } from '../icons.js';
import { escapeHTML, openSheet, closeSheet } from '../ui.js';
import { renderCollectionFilter, bindCollectionFilter } from './collectionFilter.js';
import { startOfDay, addDays, weekStart, weekdayAbbrev, formatDateAbbrev } from '../dateutils.js';
import { frontText, backText, CardTextRules } from '../models.js';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export class TrainingView {
  constructor(container, store, actions) {
    this.container = container;
    this.store = store;
    this.actions = actions; // { openSettings, openStatistics }

    this.currentItem = null;
    this.isFlipped = false;
    this.sessionStarted = false;
    this.sessionQueue = [];
    this.revisitQueue = []; // [{ item, stepsRemaining }]
    this.seenSessionItemIDs = new Set();
    this.hasPausedSession = false;
    this.sessionCollectionIDs = new Set();
    this.snapshot = null;
    this.isActive = true;

    this._unsub = store.subscribe(() => this.onStoreChange());
  }

  activate() {
    this.isActive = true;
    this.refreshSnapshots();
  }

  deactivate() {
    this.isActive = false;
  }

  onStoreChange() {
    if (!this.isActive) return;
    this.refreshSnapshots();
  }

  // Called when the Training tab is tapped while it's already the active tab.
  requestExitToDashboard() {
    if (this.sessionStarted) this.pauseSession();
    this.render();
  }

  refreshSnapshots() {
    if (!this.isActive) return;
    this.snapshot = this.store.makeTrainingSnapshot(this.store.selectedTrainingCollectionIDs);
    this.synchronizeSessionItemsWithStore();
    this.render();
  }

  // ---------- Derived getters ----------

  get todayScopeItems() { return this.snapshot ? this.snapshot.scopeItems : []; }

  get scopedStatusMetrics() { return this.store.statusMetrics(this.store.selectedTrainingCollectionIDs); }

  get newWordsCount() { return this.scopedStatusMetrics.newCount; }
  get dueTodayCount() { return this.scopedStatusMetrics.toStudy; }
  get studiedTodayCount() { return this.scopedStatusMetrics.studiedCount; }
  get processedTodayCount() { return this.snapshot ? this.snapshot.allSeenTodayIDs.size : 0; }

  get pendingSessionItems() {
    const now = new Date();
    return this.todayScopeItems.filter(i => new Date(i.nextReview) <= now);
  }
  get pendingSessionNewCount() { return this.pendingSessionItems.filter(i => i.cycleStatus == null).length; }
  get pendingSessionReviewCount() { return this.pendingSessionItems.filter(i => i.cycleStatus != null).length; }

  get wordsThisWeekCount() {
    const wStart = weekStart(new Date());
    const ids = new Set(this.store.reviewEvents.filter(e => new Date(e.date) >= wStart).map(e => e.itemID));
    return ids.size;
  }

  formatDuration(seconds) {
    const totalMinutes = Math.max(0, Math.floor(seconds / 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes} min`;
  }

  get weeklyActivity() {
    const wStart = weekStart(new Date());
    const activeDays = this.store.activeReviewDays();
    const out = [];
    for (let i = 0; i < 7; i++) {
      const day = addDays(wStart, i);
      out.push({ label: WEEKDAY_LABELS[i], isActive: activeDays.has(day.getTime()) });
    }
    return out;
  }

  get collectionTitleByID() {
    const map = {};
    for (const c of this.store.collections) map[c.id] = c.title;
    return map;
  }

  // ---------- Rendering ----------

  render() {
    this.container.innerHTML = this.sessionStarted ? this.renderStarted() : this.renderDashboard();
    this.bind();
  }

  renderDashboard() {
    const day = this.weeklyActivity;
    return `
      <div class="screen-pad">
        <div class="page-header">
          <h1 class="page-title">Training</h1>
          <button class="icon-btn" data-action="open-settings">${iconMarkup('gear')}</button>
        </div>

        ${renderCollectionFilter(this.store)}

        <p class="section-label">Today</p>
        <div class="tile-row">
          ${this.metricTile(String(this.processedTodayCount), 'words today')}
          ${this.metricTile(this.formatDuration(this.store.timeSpentToday()), 'time in app today')}
        </div>

        <p class="section-label">This week</p>
        <div class="tile-row">
          ${this.metricTile(String(this.wordsThisWeekCount), 'words this week')}
          ${this.metricTile(this.formatDuration(this.store.timeSpentThisWeek()), 'time in app this week')}
        </div>

        <p class="section-label">Card status</p>
        <div class="tile-row">
          ${this.metricCardButton('sparkles', 'var(--status-new)', String(this.newWordsCount), 'New Words', 'newWords')}
          ${this.metricCardButton('clock', 'var(--accent)', String(this.dueTodayCount), 'To Review', 'toStudy')}
          ${this.metricCardButton('checkSeal', 'var(--status-studied)', String(this.studiedTodayCount), 'Studied', 'studied')}
        </div>

        <p class="section-label">Activity</p>
        <div class="activity-row">
          ${day.map(d => `
            <div class="activity-day ${d.isActive ? 'active' : ''}">
              ${iconMarkup(d.isActive ? 'flame' : 'circleFill')}
              <span class="dlabel">${d.label}</span>
            </div>
          `).join('')}
        </div>

        <button class="start-training" data-action="start-session" style="margin-top: 10px;">
          <div>
            <p class="st-title">Start training</p>
            <div class="st-meta">
              <span class="st-count">${this.pendingSessionItems.length} cards</span>
              ${this.pendingSessionNewCount > 0 ? this.sessionBadge(this.pendingSessionNewCount, 'var(--status-new)', 'new') : ''}
              ${this.pendingSessionReviewCount > 0 ? this.sessionBadge(this.pendingSessionReviewCount, 'var(--accent)', 'review') : ''}
            </div>
          </div>
          <span class="st-play">${iconMarkup('play')}</span>
        </button>
      </div>
    `;
  }

  metricTile(value, label) {
    return `<div class="metric-tile"><div class="value">${escapeHTML(value)}</div><div class="label">${label}</div></div>`;
  }

  sessionBadge(count, color, label) {
    return `<span class="st-badge"><span class="dot" style="background:${color}"></span>${count} ${label}</span>`;
  }

  metricCardButton(icon, color, value, label, metricKey) {
    return `
      <button class="compact-status-card" data-action="open-metric" data-metric="${metricKey}">
        <div class="row1">
          <span class="status-icon" style="color:${color}">${iconMarkup(icon)}</span>
          <span class="value">${escapeHTML(value)}</span>
          <span class="chev">${iconMarkup('chevronRightCircle')}</span>
        </div>
        <span class="label">${label}</span>
      </button>
    `;
  }

  renderStarted() {
    const item = this.currentItem;
    return `
      <div class="session-header">
        <div class="left"><button class="back-btn" data-action="pause-session">${iconMarkup('arrowLeft')}<span>Back</span></button></div>
        <div class="center-count">${this.processedTodayCount}</div>
        <div class="right">
          <button class="icon-btn sm" data-action="edit-current" ${!item ? 'disabled style="opacity:.45"' : ''}>${iconMarkup('pencil')}</button>
          <button class="icon-btn" data-action="open-settings">${iconMarkup('gear')}</button>
        </div>
      </div>
      <div class="session-counts">
        <span class="n new">${this.newWordsCount}</span><span class="sep">/</span>
        <span class="n due">${this.dueTodayCount}</span><span class="sep">/</span>
        <span class="n studied">${this.studiedTodayCount}</span>
      </div>
      <div class="session-body">
        ${this.renderCard(item)}
        ${this.renderActionButtons(item)}
      </div>
    `;
  }

  renderCard(item) {
    if (!item) {
      return `
        <div class="flip-card session-empty">
          <p class="card-text-static">You have reviewed all words for today</p>
          <p class="subtitle">You're done for now. Add new cards or come back later.</p>
        </div>
      `;
    }

    const title = item.collectionID ? this.collectionTitleByID[item.collectionID] : null;
    const badge = this.categoryBadge(item);
    const size = this.cardFontSize(item);
    const front = escapeHTML(frontText(item));
    const back = escapeHTML(backText(item));

    return `
      <button class="flip-card ${this.isFlipped ? 'flipped' : ''}" data-action="flip-card" style="cursor:pointer;">
        ${title ? `<span class="card-collection-title">${escapeHTML(title)}</span>` : ''}
        ${badge ? `<span class="card-badge" style="color:${badge.color}">${iconMarkup(badge.icon)}</span>` : ''}
        <span class="card-text" style="font-size:${size}px;">${this.isFlipped ? back : front}</span>
        <span class="tap-hint">Tap to flip</span>
      </button>
    `;
  }

  renderActionButtons(item) {
    const disabled = item == null ? 'disabled' : '';
    return `
      <div class="action-buttons">
        <button class="action-btn hard" data-action="answer" data-result="hard" ${disabled}>Hard</button>
        <button class="action-btn remember" data-action="answer" data-result="remember" ${disabled}>Good</button>
        <button class="action-btn easy" data-action="answer" data-result="easy" ${disabled}>Easy</button>
      </div>
    `;
  }

  categoryBadge(item) {
    const bucket = this.store.learningBucketByID(item.id) || this.store.learningBucket(item);
    if (bucket === 'studied') return { icon: 'checkSeal', color: 'var(--status-studied)' };
    if (bucket === 'newWords') return { icon: 'sparkles', color: 'var(--status-new)' };
    return { icon: 'clock', color: 'var(--accent)' };
  }

  cardFontSize(item) {
    const maxLength = Math.max(frontText(item).length, backText(item).length);
    if (maxLength <= 20) return 38;
    if (maxLength <= 40) return 32;
    if (maxLength <= 70) return 27;
    if (maxLength <= CardTextRules.maxRecommendedLength) return 23;
    return 20;
  }

  // ---------- Bindings ----------

  bind() {
    bindCollectionFilter(this.container, this.store, () => this.refreshSnapshots());

    this.container.querySelectorAll('[data-action="open-settings"]').forEach(b => b.onclick = () => this.actions.openSettings());
    const startBtn = this.container.querySelector('[data-action="start-session"]');
    if (startBtn) startBtn.onclick = () => this.startSession();

    this.container.querySelectorAll('[data-action="open-metric"]').forEach(b => {
      b.onclick = () => this.openMetricSheet(b.dataset.metric);
    });

    const flipBtn = this.container.querySelector('[data-action="flip-card"]');
    if (flipBtn) flipBtn.onclick = () => { this.isFlipped = !this.isFlipped; this.render(); };

    this.container.querySelectorAll('[data-action="answer"]').forEach(b => {
      b.onclick = () => this.answer(b.dataset.result);
    });

    const backBtn = this.container.querySelector('[data-action="pause-session"]');
    if (backBtn) backBtn.onclick = () => { this.pauseSession(); this.render(); };

    const editBtn = this.container.querySelector('[data-action="edit-current"]');
    if (editBtn && this.currentItem) editBtn.onclick = () => this.openEditor(this.currentItem);
  }

  openMetricSheet(metricKey) {
    const titles = { newWords: 'New Words', toStudy: 'To Review', studied: 'Studied' };
    const metrics = this.scopedStatusMetrics;
    const idSet = metricKey === 'newWords' ? metrics.newIDs : metricKey === 'toStudy' ? metrics.toStudyIDs : metrics.studiedIDs;
    const items = this.todayScopeItems.filter(i => idSet.has(i.id));

    const body = items.length === 0
      ? `<p style="color:var(--text-secondary);padding:16px 0;">No cards in this section.</p>`
      : items.map(i => `
          <div style="padding:10px 0;border-bottom:1px solid var(--border);">
            <div style="font-weight:600;font-size:16px;">${escapeHTML(i.english)}</div>
            <div style="font-size:13px;color:var(--text-secondary);">${escapeHTML(i.translation)}</div>
          </div>
        `).join('');

    openSheet({ title: titles[metricKey], bodyHTML: body, doneLabel: 'Done' });
  }

  openEditor(item) {
    const body = `
      <div class="form-row">
        <label>Word</label>
        <input type="text" id="editor-english" value="${escapeHTML(item.english)}">
      </div>
      <div class="form-row">
        <label>Translation</label>
        <input type="text" id="editor-translation" value="${escapeHTML(item.translation)}">
      </div>
      <div class="form-row">
        <label>Card Front Side</label>
        <div class="segmented" id="editor-front-side">
          <button data-value="english" class="${item.frontSide === 'english' ? 'active' : ''}">Word</button>
          <button data-value="translation" class="${item.frontSide === 'translation' ? 'active' : ''}">Translation</button>
        </div>
      </div>
      <div id="editor-warning"></div>
    `;

    let frontSide = item.frontSide;

    openSheet({
      title: 'Edit Card',
      bodyHTML: body,
      doneLabel: 'Save',
      onDone: () => {
        const english = document.getElementById('editor-english').value;
        const translation = document.getElementById('editor-translation').value;
        if (!english.trim() || !translation.trim()) return false;
        if (english.trim().length > CardTextRules.maxRecommendedLength || translation.trim().length > CardTextRules.maxRecommendedLength) return false;
        this.store.updateWord(item.id, english, translation, frontSide);
        this.refreshCurrentItem(item.id);
      },
      onOpen: (body) => {
        body.querySelectorAll('#editor-front-side button').forEach(btn => {
          btn.onclick = () => {
            frontSide = btn.dataset.value;
            body.querySelectorAll('#editor-front-side button').forEach(b2 => b2.classList.toggle('active', b2 === btn));
          };
        });
      },
    });
  }

  // ---------- Session mechanics (ported from TrainingView.swift) ----------

  answer(result) {
    const item = this.currentItem;
    if (!item) return;
    this.store.applyReview(item.id, result);
    this.isFlipped = false;
    this.processAnswer(item);
    this.render();
  }

  processAnswer(item) {
    this.seenSessionItemIDs.add(item.id);
    this.revisitQueue = this.revisitQueue.filter(r => r.item.id !== item.id);

    const updatedItem = this.store.items.find(i => i.id === item.id);
    const gap = this.store.sessionRepeatGap(item.id);
    if (updatedItem && gap != null) this.scheduleRevisit(updatedItem, gap);

    this.advanceRevisitCountdown();
    this.releaseDueRevisits();
    this.currentItem = this.dequeueNextItem();
    if (this.currentItem == null && this.sessionQueue.length === 0 && this.revisitQueue.length === 0) {
      this.hasPausedSession = false;
    }
  }

  scheduleRevisit(item, gap) {
    if (gap <= 0) return;
    const existing = this.revisitQueue.find(r => r.item.id === item.id);
    if (existing) {
      existing.stepsRemaining = Math.min(existing.stepsRemaining, gap);
      existing.item = item;
      return;
    }
    this.revisitQueue.push({ item, stepsRemaining: gap });
  }

  advanceRevisitCountdown() {
    for (const r of this.revisitQueue) r.stepsRemaining = Math.max(0, r.stepsRemaining - 1);
  }

  releaseDueRevisits() {
    const pending = [];
    const due = [];
    for (const r of this.revisitQueue) (r.stepsRemaining <= 0 ? due : pending).push(r);
    this.revisitQueue = pending;

    for (const r of due) {
      if (this.currentItem && this.currentItem.id === r.item.id) continue;
      const idx = this.sessionQueue.findIndex(i => i.id === r.item.id);
      if (idx >= 0) this.sessionQueue[idx] = r.item;
      else this.sessionQueue.push(r.item);
    }
  }

  dequeueNextItem() {
    this.releaseDueRevisits();

    if (this.sessionQueue.length > 0) return this.sessionQueue.shift();

    if (this.revisitQueue.length > 0) {
      this.advanceRevisitCountdown();
      this.releaseDueRevisits();
      if (this.sessionQueue.length > 0) return this.sessionQueue.shift();
    }

    if (this.revisitQueue.length > 0) {
      let nearestIdx = 0;
      for (let i = 1; i < this.revisitQueue.length; i++) {
        if (this.revisitQueue[i].stepsRemaining < this.revisitQueue[nearestIdx].stepsRemaining) nearestIdx = i;
      }
      const item = this.revisitQueue[nearestIdx].item;
      this.revisitQueue.splice(nearestIdx, 1);
      return item;
    }

    return null;
  }

  startSession() {
    const currentScopeIDs = this.store.selectedTrainingCollectionIDs;

    if (this.hasPausedSession) {
      if (!setsEqual(this.sessionCollectionIDs, currentScopeIDs)) {
        this.resetSession();
      } else {
        this.sessionStarted = true;
        this.isFlipped = false;
        if (this.currentItem == null) this.currentItem = this.dequeueNextItem();
        this.render();
        return;
      }
    }

    const seed = this.buildSessionSeed();
    this.sessionQueue = seed;
    this.revisitQueue = [];
    this.seenSessionItemIDs = new Set();
    this.isFlipped = false;
    this.sessionStarted = true;
    this.hasPausedSession = true;
    this.sessionCollectionIDs = new Set(currentScopeIDs);
    this.currentItem = this.dequeueNextItem();
    if (this.currentItem == null) this.hasPausedSession = false;
    this.render();
  }

  buildSessionSeed() {
    const scope = this.todayScopeItems;
    if (scope.length === 0) return [];
    const now = new Date();
    const due = scope.filter(i => new Date(i.nextReview) <= now);
    if (due.length === 0) return [];
    return shuffle([...due]);
  }

  refreshCurrentItem(id) {
    const updated = this.store.items.find(i => i.id === id);
    if (!updated) return;
    this.currentItem = updated;
    this.sessionQueue = this.sessionQueue.map(i => (i.id === id ? updated : i));
    this.revisitQueue = this.revisitQueue.map(r => (r.item.id === id ? { item: updated, stepsRemaining: r.stepsRemaining } : r));
    this.render();
  }

  resetSession() {
    this.sessionStarted = false;
    this.isFlipped = false;
    this.sessionQueue = [];
    this.revisitQueue = [];
    this.seenSessionItemIDs = new Set();
    this.currentItem = null;
    this.hasPausedSession = false;
    this.sessionCollectionIDs = new Set();
  }

  pauseSession() {
    this.sessionStarted = false;
    this.isFlipped = false;
    this.hasPausedSession = this.currentItem != null || this.sessionQueue.length > 0 || this.revisitQueue.length > 0;
  }

  synchronizeSessionItemsWithStore() {
    if (!(this.hasPausedSession || this.sessionStarted)) return;
    const byID = new Map(this.store.items.map(i => [i.id, i]));

    if (this.currentItem) this.currentItem = byID.get(this.currentItem.id) || null;
    this.sessionQueue = this.sessionQueue.map(i => byID.get(i.id)).filter(Boolean);
    this.revisitQueue = this.revisitQueue
      .map(r => (byID.has(r.item.id) ? { item: byID.get(r.item.id), stepsRemaining: r.stepsRemaining } : null))
      .filter(Boolean);

    if (this.currentItem == null && this.sessionQueue.length > 0) this.currentItem = this.sessionQueue.shift();
  }
}

function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
