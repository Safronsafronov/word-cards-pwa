// Ported 1:1 from WordCardsMVP/VocabStore.swift.
// Persistence: one JSON blob in localStorage (mirrors the single PersistedStateRecord "main").

import { uuid, makeCollection, makeVocabItem, makeReviewEvent, CardFrontSide } from './models.js';
import { startOfDay, addDays, weekStart, dayKey } from './dateutils.js';

const STORAGE_KEY = 'wordcardsmvp.state.v1';
const SAVE_DEBOUNCE_MS = 250;

const BUNDLED_SEEDS = [
  { resource: 'B1-B2_adjectives', title: 'B1-B2 Adjectives' },
  { resource: 'B1-B2_emotions', title: 'B1-B2 Emotions' },
  { resource: 'B1-B2_nouns', title: 'B1-B2 Nouns' },
  { resource: 'B1-B2_verbs', title: 'B1-B2 Verbs' },
  { resource: 'words', title: 'Words' },
];

class Emitter {
  constructor() { this._listeners = new Set(); }
  subscribe(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }
  emit() { for (const fn of this._listeners) fn(); }
}

export class VocabStore extends Emitter {
  constructor() {
    super();
    this.items = [];
    this.reviewEvents = [];
    this.collections = [];
    this.dailyGoal = 100;
    this.selectedTrainingCollectionIDs = new Set();
    this.todayProgressResetAt = null;
    this.dataRevision = 0;
    this.appTimeByDay = {}; // dayKey(number) -> seconds

    this._didSeedBundledCollections = false;
    this._activeSessionStart = null;
    this._pendingSaveTimer = null;
    this._cachedCoreAggregates = null;
    this._cachedCollectionMetrics = null;

    this._ready = this._load();
  }

  async whenReady() { return this._ready; }

  // ---------- App-time tracking ----------

  appDidBecomeActive(now = new Date()) {
    if (this._activeSessionStart != null) return;
    this._activeSessionStart = now;
  }

  appWillResignActive(now = new Date()) {
    if (this._activeSessionStart == null) return;
    const start = this._activeSessionStart;
    this._activeSessionStart = null;
    this._accumulateAppTime(start, now);
  }

  timeSpent(day) {
    return this.appTimeByDay[dayKey(day)] || 0;
  }

  timeSpentToday(now = new Date()) {
    const dStart = startOfDay(now);
    let total = this.timeSpent(dStart);
    if (this._activeSessionStart != null) {
      const from = this._activeSessionStart > dStart ? this._activeSessionStart : dStart;
      total += (now - from) / 1000;
    }
    return total;
  }

  timeSpentThisWeek(now = new Date()) {
    const today = startOfDay(now);
    const wStart = weekStart(now);
    let total = 0;
    let cursor = wStart;
    while (cursor <= today) {
      total += this.timeSpent(cursor);
      cursor = addDays(cursor, 1);
    }
    if (this._activeSessionStart != null) {
      const from = this._activeSessionStart > today ? this._activeSessionStart : today;
      total += (now - from) / 1000;
    }
    return total;
  }

  _accumulateAppTime(start, end) {
    if (!(end > start)) return;
    let cursor = start;
    while (cursor < end) {
      const dStart = startOfDay(cursor);
      const nextDayStart = addDays(dStart, 1);
      const segmentEnd = end < nextDayStart ? end : nextDayStart;
      const key = dayKey(dStart);
      this.appTimeByDay[key] = (this.appTimeByDay[key] || 0) + (segmentEnd - cursor) / 1000;
      cursor = segmentEnd;
    }
    this._scheduleSave();
  }

  activeReviewDays() {
    return this._coreAggregates().activeDays;
  }

  // ---------- Derived data ----------

  learningBucket(item) {
    if (item.cycleStatus == null) return 'newWords';
    if (new Date(item.nextReview) <= new Date()) return 'toStudy';
    return 'studied';
  }

  learningBucketByID(itemID) {
    const item = this.items.find(i => i.id === itemID);
    return item ? this.learningBucket(item) : null;
  }

  statusMetrics(collectionIDs) {
    const scoped = collectionIDs.size === 0
      ? this.items
      : this.items.filter(i => i.collectionID && collectionIDs.has(i.collectionID));

    const metrics = { total: scoped.length, newCount: 0, toStudy: 0, studiedCount: 0, newIDs: new Set(), toStudyIDs: new Set(), studiedIDs: new Set() };
    for (const item of scoped) {
      const bucket = this.learningBucket(item);
      if (bucket === 'newWords') { metrics.newCount++; metrics.newIDs.add(item.id); }
      else if (bucket === 'toStudy') { metrics.toStudy++; metrics.toStudyIDs.add(item.id); }
      else { metrics.studiedCount++; metrics.studiedIDs.add(item.id); }
    }
    return metrics;
  }

  items_in(collectionID) {
    return this.items.filter(i => i.collectionID === collectionID);
  }

  collectionTileMetrics() {
    if (this._cachedCollectionMetrics) return this._cachedCollectionMetrics;
    const metrics = {};
    for (const item of this.items) {
      if (!item.collectionID) continue;
      const m = metrics[item.collectionID] || { total: 0, newCount: 0, toStudy: 0, studiedCount: 0 };
      m.total++;
      const bucket = this.learningBucket(item);
      if (bucket === 'newWords') m.newCount++;
      else if (bucket === 'toStudy') m.toStudy++;
      else m.studiedCount++;
      metrics[item.collectionID] = m;
    }
    this._cachedCollectionMetrics = metrics;
    return metrics;
  }

  reviewEventsIn(collectionID) {
    const core = this._coreAggregates();
    const itemIDs = core.itemIDsByCollection[collectionID];
    if (!itemIDs || itemIDs.length === 0) return [];
    const result = [];
    for (const id of itemIDs) {
      const evs = core.eventsByItemID[id];
      if (evs) result.push(...evs);
    }
    return result;
  }

  _coreAggregates() {
    if (this._cachedCoreAggregates) return this._cachedCoreAggregates;
    const eventsByItemID = {};
    const activeDays = new Set();
    for (const ev of this.reviewEvents) {
      (eventsByItemID[ev.itemID] ||= []).push(ev);
      activeDays.add(dayKey(new Date(ev.date)));
    }
    const itemIDsByCollection = {};
    for (const item of this.items) {
      if (!item.collectionID) continue;
      (itemIDsByCollection[item.collectionID] ||= []).push(item.id);
    }
    this._cachedCoreAggregates = { eventsByItemID, itemIDsByCollection, activeDays };
    return this._cachedCoreAggregates;
  }

  _invalidateDerivedCaches() {
    this._cachedCoreAggregates = null;
    this._cachedCollectionMetrics = null;
    this.dataRevision++;
  }

  // ---------- Training scope ----------

  get selectedTrainingCollectionID() {
    return this.selectedTrainingCollectionIDs.size === 1 ? [...this.selectedTrainingCollectionIDs][0] : null;
  }

  setTrainingCollection(id) {
    if (id && this.collections.some(c => c.id === id)) {
      this.selectedTrainingCollectionIDs = new Set([id]);
    } else {
      this.selectedTrainingCollectionIDs = new Set();
    }
    this._emitAll();
    this._scheduleSave();
  }

  setTrainingCollections(ids) {
    const valid = [...ids].filter(id => this.collections.some(c => c.id === id));
    this.selectedTrainingCollectionIDs = new Set(valid);
    this._emitAll();
    this._scheduleSave();
  }

  toggleTrainingCollection(id) {
    if (!this.collections.some(c => c.id === id)) return;
    if (this.selectedTrainingCollectionIDs.has(id)) this.selectedTrainingCollectionIDs.delete(id);
    else this.selectedTrainingCollectionIDs.add(id);
    this._emitAll();
    this._scheduleSave();
  }

  // ---------- CRUD ----------

  createCollection(title) {
    const clean = title.trim();
    const collection = makeCollection(clean.length ? clean : 'New Collection');
    this.collections.push(collection);
    if (this.selectedTrainingCollectionIDs.size === 0) this.selectedTrainingCollectionIDs = new Set([collection.id]);
    this._invalidateDerivedCaches();
    this._emitAll();
    this._scheduleSave();
    return collection;
  }

  deleteCollection(id) {
    if (!this.collections.some(c => c.id === id)) return;
    const idsInCollection = new Set(this.items.filter(i => i.collectionID === id).map(i => i.id));
    this.items = this.items.filter(i => i.collectionID !== id);
    this.reviewEvents = this.reviewEvents.filter(e => !idsInCollection.has(e.itemID));
    this.collections = this.collections.filter(c => c.id !== id);
    if (this.selectedTrainingCollectionIDs.has(id)) {
      this.selectedTrainingCollectionIDs.delete(id);
      if (this.selectedTrainingCollectionIDs.size === 0 && this.collections[0]) {
        this.selectedTrainingCollectionIDs = new Set([this.collections[0].id]);
      }
    }
    this._invalidateDerivedCaches();
    this._emitAll();
    this._scheduleSave();
  }

  addWord(collectionID, english, translation, frontSide) {
    this.items.push(makeVocabItem({ collectionID, english: english.trim(), translation: translation.trim(), frontSide }));
    this._invalidateDerivedCaches();
    this._emitAll();
    this._scheduleSave();
  }

  updateWord(id, english, translation, frontSide) {
    const item = this.items.find(i => i.id === id);
    if (!item) return;
    item.english = english.trim();
    item.translation = translation.trim();
    item.frontSide = frontSide;
    this._invalidateDerivedCaches();
    this._emitAll();
    this._scheduleSave();
  }

  swapWordAndTranslation(collectionID) {
    if (!this.collections.some(c => c.id === collectionID)) return;
    let changed = false;
    for (const item of this.items) {
      if (item.collectionID !== collectionID) continue;
      const old = item.english;
      item.english = item.translation;
      item.translation = old;
      changed = true;
    }
    if (changed) {
      this._invalidateDerivedCaches();
      this._emitAll();
      this._scheduleSave();
    }
  }

  deleteItems(itemIDs) {
    if (!itemIDs || itemIDs.size === 0) return;
    this.items = this.items.filter(i => !itemIDs.has(i.id));
    this.reviewEvents = this.reviewEvents.filter(e => !itemIDs.has(e.itemID));
    this._invalidateDerivedCaches();
    this._emitAll();
    this._scheduleSave();
  }

  setDailyGoal(value) {
    this.dailyGoal = Math.max(1, Math.min(value, 1000));
    this._scheduleSave();
  }

  // ---------- Review scheduling (formulas ported verbatim) ----------

  applyReview(itemID, result) {
    const item = this.items.find(i => i.id === itemID);
    if (!item) return;
    const now = new Date();
    this._scheduleNextReview(item, result, now);
    this.reviewEvents.push(makeReviewEvent(itemID, result, now));
    this._invalidateDerivedCaches();
    this._emitAll();
    this._scheduleSave();
  }

  sessionRepeatGap(itemID) {
    const item = this.items.find(i => i.id === itemID);
    if (!item || item.cycleStatus == null) return null;
    if (item.cycleStatus === 'dontRemember' || item.cycleStatus === 'hard') {
      return 5 + Math.floor(Math.random() * 4); // Int.random(in: 5...8)
    }
    return null;
  }

  _scheduleNextReview(item, result, now) {
    const addDaysAtStartOfDay = (days) => startOfDay(addDays(now, Math.max(days, 1)));

    this._updateCycle(item, result);

    if (result === 'dontRemember' || result === 'hard') {
      item.learningState = 'learning';
      item.learningStepIndex = 0;
      item.intervalDays = 0;
      item.nextReview = now.toISOString();
      item.easeFactor = Math.max(1.3, item.easeFactor - 0.08);
      item.lapses += 1;
    } else if (result === 'remember') {
      item.learningState = 'review';
      item.learningStepIndex = 0;
      const interval = this._rememberIntervalDays(item.cycleStreak);
      item.intervalDays = interval;
      item.nextReview = addDaysAtStartOfDay(interval).toISOString();
      item.easeFactor = Math.min(3.5, item.easeFactor + 0.02);
    } else if (result === 'easy') {
      item.learningState = 'review';
      item.learningStepIndex = 0;
      const interval = this._easyIntervalDays(item.cycleStreak);
      item.intervalDays = interval;
      item.nextReview = addDaysAtStartOfDay(interval).toISOString();
      item.easeFactor = Math.min(3.5, item.easeFactor + 0.05);
    }
  }

  _updateCycle(item, result) {
    if (item.cycleStatus === result) item.cycleStreak += 1;
    else { item.cycleStatus = result; item.cycleStreak = 1; }
  }

  _rememberIntervalDays(streak) {
    const n = Math.max(streak - 1, 0);
    const value = 1.0 * Math.pow(1.35, n);
    return Math.max(1, Math.ceil(value));
  }

  _easyIntervalDays(streak) {
    const n = Math.max(streak - 1, 0);
    const value = 3.0 * Math.pow(1.55, n);
    return Math.max(3, Math.round(value));
  }

  // ---------- Training snapshot ----------

  makeTrainingSnapshot(selectedCollectionIDs) {
    return VocabStore.buildTrainingSnapshot(this.items, this.reviewEvents, selectedCollectionIDs, new Date());
  }

  static buildTrainingSnapshot(items, reviewEvents, selectedCollectionIDs, now) {
    const dayStart = startOfDay(now);
    const nextDayStart = addDays(dayStart, 1);

    const scopeItems = selectedCollectionIDs.size === 0
      ? items
      : items.filter(i => i.collectionID && selectedCollectionIDs.has(i.collectionID));

    const scopeIDs = new Set(scopeItems.map(i => i.id));
    const scopedEvents = [];
    const todayScopedEvents = [];
    const seenEverIDs = new Set();
    const seenTodayIDs = new Set();
    const allSeenTodayIDs = new Set();

    for (const ev of reviewEvents) {
      const evDate = new Date(ev.date);
      const isInProgressDay = evDate >= dayStart && evDate < nextDayStart;
      if (isInProgressDay) allSeenTodayIDs.add(ev.itemID);
      if (!scopeIDs.has(ev.itemID)) continue;
      scopedEvents.push(ev);
      seenEverIDs.add(ev.itemID);
      if (isInProgressDay) { todayScopedEvents.push(ev); seenTodayIDs.add(ev.itemID); }
    }

    return { scopeItems, scopedEvents, todayScopedEvents, seenEverIDs, seenTodayIDs, allSeenTodayIDs, dayStart, nextDayStart };
  }

  // ---------- CSV import/export (ported verbatim) ----------

  importCSV(text, targetCollectionID = null) {
    const sanitized = text.replace(/﻿/g, '');
    const lines = sanitized.split(/\r\n|\r|\n/).map(l => l.trim()).filter(l => l.length);
    if (!lines.length) return { added: 0, skipped: 0 };

    const destinationID = this._resolveImportCollection(targetCollectionID);
    const delimiter = this._detectDelimiter(lines[0]);
    const parsedRows = lines.map(l => this._parseCSVLine(l, delimiter));
    const hasHeader = this._isHeaderRow(parsedRows[0]);
    const dataRows = hasHeader ? parsedRows.slice(1) : parsedRows;

    let added = 0, skipped = 0;
    const existingPairs = new Set(this.items.map(i => this._normalizedPair(i.english, i.translation)));
    const newPairs = new Set();

    for (const row of dataRows) {
      if (row.length < 2) { skipped++; continue; }
      const english = row[0].trim();
      const translation = row[1].trim();
      if (!english || !translation) { skipped++; continue; }
      const pair = this._normalizedPair(english, translation);
      if (existingPairs.has(pair) || newPairs.has(pair)) { skipped++; continue; }
      const frontSide = row.length >= 3 ? (this._parseFrontSide(row[2]) || CardFrontSide.english) : CardFrontSide.english;
      this.items.push(makeVocabItem({ collectionID: destinationID, english, translation, frontSide }));
      newPairs.add(pair);
      added++;
    }

    if (added > 0) { this._invalidateDerivedCaches(); this._emitAll(); this._scheduleSave(); }
    return { added, skipped };
  }

  exportCSV(collectionID) {
    if (!this.collections.some(c => c.id === collectionID)) return null;
    const scoped = this.items.filter(i => i.collectionID === collectionID);
    const rows = ['word,translation'];
    for (const item of scoped) rows.push(`${this._csvEscape(item.english)},${this._csvEscape(item.translation)}`);
    return rows.join('\n');
  }

  _resolveImportCollection(explicitID) {
    if (explicitID && this.collections.some(c => c.id === explicitID)) return explicitID;
    if (this.selectedTrainingCollectionIDs.size === 1) {
      const id = [...this.selectedTrainingCollectionIDs][0];
      if (this.collections.some(c => c.id === id)) return id;
    }
    if (this.collections[0]) return this.collections[0].id;
    return this.createCollection('Import').id;
  }

  _detectDelimiter(line) {
    const candidates = [',', ';', '\t'];
    let best = ',', bestCount = -1;
    for (const d of candidates) {
      const count = line.split(d).length - 1;
      if (count > bestCount) { bestCount = count; best = d; }
    }
    return best;
  }

  _parseCSVLine(line, delimiter) {
    const result = [];
    let current = '';
    let insideQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (insideQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else insideQuotes = !insideQuotes;
      } else if (ch === delimiter && !insideQuotes) {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current);
    return result;
  }

  _isHeaderRow(row) {
    if (row.length < 2) return false;
    const first = row[0].trim().toLowerCase();
    const second = row[1].trim().toLowerCase();
    const h1 = ['english', 'word', 'term'];
    const h2 = ['translation', 'meaning'];
    return h1.includes(first) && h2.includes(second);
  }

  _parseFrontSide(value) {
    const v = value.trim().toLowerCase();
    if (['english', 'en', 'word', 'term'].includes(v)) return CardFrontSide.english;
    if (['translation', 'ru', 'target'].includes(v)) return CardFrontSide.translation;
    return null;
  }

  _csvEscape(value) {
    const escaped = value.replace(/"/g, '""');
    if (escaped.includes(',') || escaped.includes('\n') || escaped.includes('"')) return `"${escaped}"`;
    return escaped;
  }

  _normalizedPair(english, translation) {
    return `${english.trim().toLowerCase()}|${translation.trim().toLowerCase()}`;
  }

  // ---------- Persistence & seeding ----------

  async _load() {
    const loaded = this._loadFromLocalStorage();
    if (!loaded) {
      await this._importBundledCollectionsIfNeeded();
    } else if (!this._didSeedBundledCollections) {
      await this._importBundledCollectionsIfNeeded();
    }
    this._normalizeCollectionsState();
    this._invalidateDerivedCaches();
    this._emitAll();
    this._scheduleSave();
  }

  _normalizeCollectionsState() {
    this._removeEmptyGeneralCollection();

    if (this.collections[0]) {
      const fallbackID = this.collections[0].id;
      for (const item of this.items) {
        if (item.collectionID == null) item.collectionID = fallbackID;
      }
    }

    this.selectedTrainingCollectionIDs = new Set(
      [...this.selectedTrainingCollectionIDs].filter(id => this.collections.some(c => c.id === id))
    );
    if (this.selectedTrainingCollectionIDs.size === 0 && this.collections[0]) {
      this.selectedTrainingCollectionIDs = new Set([this.collections[0].id]);
    }
  }

  _removeEmptyGeneralCollection() {
    const general = this.collections.find(c => c.title === 'General');
    if (!general) return;
    const hasItems = this.items.some(i => i.collectionID === general.id);
    if (hasItems) return;
    this.collections = this.collections.filter(c => c.id !== general.id);
    this.selectedTrainingCollectionIDs.delete(general.id);
  }

  async _importBundledCollectionsIfNeeded() {
    if (this._didSeedBundledCollections) return;

    const existingPairs = new Set(this.items.map(i => this._normalizedPair(i.english, i.translation)));

    for (const seed of BUNDLED_SEEDS) {
      const csvText = await this._fetchBundledCSV(seed.resource);
      if (csvText == null) continue;
      const collectionID = this._ensureCollectionExists(seed.title);
      this._appendCSVRows(csvText, collectionID, true, existingPairs);
    }

    this._didSeedBundledCollections = true;
    if (this.selectedTrainingCollectionIDs.size === 0 && this.collections[0]) {
      this.selectedTrainingCollectionIDs = new Set([this.collections[0].id]);
    }
  }

  _ensureCollectionExists(title) {
    const existing = this.collections.find(c => c.title === title);
    if (existing) return existing.id;
    const collection = makeCollection(title);
    this.collections.push(collection);
    return collection.id;
  }

  async _fetchBundledCSV(resource) {
    try {
      const res = await fetch(`data/${resource}.csv`);
      if (!res.ok) return null;
      return await res.text();
    } catch {
      return null;
    }
  }

  _appendCSVRows(text, collectionID, skipFirstLine, existingPairs) {
    const sanitized = text.replace(/﻿/g, '');
    let lines = sanitized.split(/\r\n|\r|\n/).map(l => l.trim()).filter(l => l.length);
    if (!lines.length) return 0;
    if (skipFirstLine) lines = lines.slice(1);
    if (!lines.length) return 0;

    const delimiter = this._detectDelimiter(lines[0]);
    const rows = lines.map(l => this._parseCSVLine(l, delimiter));
    let added = 0;
    for (const row of rows) {
      if (row.length < 2) continue;
      const english = row[0].trim();
      const translation = row[1].trim();
      if (!english || !translation) continue;
      const pair = this._normalizedPair(english, translation);
      if (existingPairs.has(pair)) continue;
      const frontSide = row.length >= 3 ? (this._parseFrontSide(row[2]) || CardFrontSide.english) : CardFrontSide.english;
      this.items.push(makeVocabItem({ collectionID, english, translation, frontSide }));
      existingPairs.add(pair);
      added++;
    }
    return added;
  }

  _loadFromLocalStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const persisted = JSON.parse(raw);
      this._applyPersistedData(persisted);
      return true;
    } catch {
      return false;
    }
  }

  _applyPersistedData(persisted) {
    this.items = persisted.items || [];
    this.reviewEvents = persisted.reviewEvents || [];
    this.collections = persisted.collections || [];
    this.dailyGoal = Math.max(1, persisted.dailyGoal || 100);
    this.selectedTrainingCollectionIDs = new Set(persisted.selectedTrainingCollectionIDs || []);
    this.todayProgressResetAt = persisted.todayProgressResetAt || null;
    this._didSeedBundledCollections = persisted.didSeedBundledCollections || false;
    this.appTimeByDay = persisted.appTimeByDay || {};
  }

  _scheduleSave() {
    if (this._pendingSaveTimer) clearTimeout(this._pendingSaveTimer);
    this._pendingSaveTimer = setTimeout(() => this._saveNow(), SAVE_DEBOUNCE_MS);
  }

  _saveNow() {
    const snapshot = {
      items: this.items,
      reviewEvents: this.reviewEvents,
      collections: this.collections,
      dailyGoal: this.dailyGoal,
      selectedTrainingCollectionIDs: [...this.selectedTrainingCollectionIDs],
      todayProgressResetAt: this.todayProgressResetAt,
      didSeedBundledCollections: this._didSeedBundledCollections,
      appTimeByDay: this.appTimeByDay,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch (e) {
      console.error('localStorage save error', e);
    }
  }

  flushSaveNow() {
    if (this._pendingSaveTimer) { clearTimeout(this._pendingSaveTimer); this._pendingSaveTimer = null; }
    this._saveNow();
  }

  _emitAll() { this.emit(); }
}
