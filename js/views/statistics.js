// Ported from StatisticsView.swift

import { iconMarkup } from '../icons.js';
import { escapeHTML, openSheet, closeSheet } from '../ui.js';
import { renderCollectionFilter, bindCollectionFilter } from './collectionFilter.js';
import { startOfDay, addDays, isSameDay, dayKey, formatDateAbbrev, weekdayAbbrev, monthAbbrev, dayMonthAbbrev } from '../dateutils.js';

const RANGES = [
  { key: 'd7', label: '7 d', days: 7 },
  { key: 'd14', label: '14 d', days: 14 },
  { key: 'm1', label: '1 m', days: 30 },
  { key: 'm3', label: '3 m', days: 90 },
  { key: 'm6', label: '6 m', days: 180 },
  { key: 'y1', label: '1 y', days: 365 },
];

export class StatisticsView {
  constructor(container, store, actions) {
    this.container = container;
    this.store = store;
    this.actions = actions;
    this.selectedRange = 'd7';
    this.snapshot = null;
    this.selectedHeatDay = null;
    this.selectedWorkloadDate = null;
    this.selectedTimeInAppDate = null;
    this.isActive = true;

    this._unsub = store.subscribe(() => this.onStoreChange());
  }

  activate() { this.isActive = true; this.recompute(); }
  deactivate() { this.isActive = false; }
  onStoreChange() { if (this.isActive) this.recompute(); }

  recompute() {
    this.snapshot = StatisticsView.buildSnapshot(
      this.store.items,
      this.store.reviewEvents,
      this.store.selectedTrainingCollectionIDs,
      RANGES.find(r => r.key === this.selectedRange).days,
      this.store.appTimeByDay
    );
    this.render();
  }

  render() {
    const s = this.snapshot;
    this.container.innerHTML = `
      <div class="page-header screen-pad">
        <h1 class="page-title">Statistics</h1>
        <button class="icon-btn" data-action="open-settings">${iconMarkup('gear')}</button>
      </div>
      <div class="screen-pad">${renderCollectionFilter(this.store)}</div>
      <div style="height:14px;"></div>

      ${this.renderWorkloadCard(s)}
      <div style="height:14px;"></div>
      ${this.renderProblemWordsCard(s)}
      <div style="height:14px;"></div>
      ${this.renderPeriodSelector()}
      <div style="height:14px;"></div>
      ${this.renderTimeInAppCard(s)}
      <div style="height:14px;"></div>
      ${this.renderHeatmapCard(s.heatmap)}
      <div style="height:20px;"></div>
    `;
    this.bind();
  }

  // ---------- Upcoming Workload ----------

  renderWorkloadCard(s) {
    const maxCount = Math.max(1, ...s.upcomingWorkload.map(d => d.count));
    return `
      <div class="stat-card">
        <p class="stat-title">Upcoming Workload</p>
        <p class="stat-sub">Cards becoming due in the next 7 days</p>
        <div class="bar-chart" id="workload-chart">
          ${s.upcomingWorkload.map(d => {
            const heightPct = Math.max(2, (d.count / maxCount) * 100);
            const dim = this.selectedWorkloadDate != null && !isSameDay(d.date, this.selectedWorkloadDate);
            return `
              <div class="bar-col" data-date="${dayKey(d.date)}" data-scope="workload">
                <div class="bar ${d.isPeak ? 'peak' : ''} ${dim ? 'dim' : ''}" style="height:${heightPct}%"></div>
                <span class="xlabel">${weekdayAbbrev(d.date)}</span>
              </div>
            `;
          }).join('')}
        </div>
        ${this.renderWorkloadDetail(s)}
      </div>
    `;
  }

  renderWorkloadDetail(s) {
    if (this.selectedWorkloadDate == null) return '';
    const day = s.upcomingWorkload.find(d => isSameDay(d.date, this.selectedWorkloadDate));
    if (!day) return '';
    const color = day.isPeak ? 'var(--destructive)' : 'var(--accent)';
    return `
      <div class="chart-detail">
        <span class="dot" style="background:${color}"></span>
        <span class="title">${formatDateAbbrev(day.date)}</span>
        <span class="value">${day.count} card${day.count === 1 ? '' : 's'} due</span>
      </div>
    `;
  }

  // ---------- Problem Words ----------

  renderProblemWordsCard(s) {
    const top5 = s.problemWords.slice(0, 5);
    return `
      <div class="stat-card">
        <div style="display:flex;align-items:center;">
          <p class="stat-title" style="margin:0;">Problem Words</p>
          ${s.problemWords.length > 5 ? `<button class="show-all-btn" data-action="show-all-problem">Show all</button>` : ''}
        </div>
        ${top5.length === 0
          ? `<p style="font-size:13px;color:var(--text-secondary);margin:0;">No problem words yet.</p>`
          : top5.map(item => `
              <div class="problem-row">
                <div>
                  <div class="pw-front">${escapeHTML(item.english)}</div>
                  <div class="pw-back">${escapeHTML(item.translation)}</div>
                </div>
                <div class="pw-lapses">${item.lapses}</div>
              </div>
            `).join('')}
      </div>
    `;
  }

  // ---------- Period selector ----------

  renderPeriodSelector() {
    return `
      <div class="period-selector">
        <span class="ps-label">Time in App period</span>
        <div class="period-tabs">
          ${RANGES.map(r => `<button data-range="${r.key}" class="${this.selectedRange === r.key ? 'active' : ''}">${r.label}</button>`).join('')}
        </div>
      </div>
    `;
  }

  // ---------- Time in App ----------

  renderTimeInAppCard(s) {
    const maxMinutes = Math.max(1, ...s.timeInAppRows.map(r => r.minutes));
    const showEveryNth = Math.max(Math.floor(s.timeInAppRows.length / 7), 1);
    return `
      <div class="stat-card">
        <p class="stat-title">Time in App</p>
        <div class="bar-chart tall" id="timeinapp-chart">
          ${s.timeInAppRows.map((r, idx) => {
            const heightPct = Math.max(2, (r.minutes / maxMinutes) * 100);
            const dim = this.selectedTimeInAppDate != null && !isSameDay(r.date, this.selectedTimeInAppDate);
            const showLabel = idx % showEveryNth === 0;
            return `
              <div class="bar-col" data-date="${dayKey(r.date)}" data-scope="timeinapp">
                <div class="bar ${dim ? 'dim' : ''}" style="height:${heightPct}%;background:var(--accent2);"></div>
                <span class="xlabel">${showLabel ? dayMonthAbbrev(r.date) : ''}</span>
              </div>
            `;
          }).join('')}
        </div>
        ${this.renderTimeInAppDetail(s)}
      </div>
    `;
  }

  renderTimeInAppDetail(s) {
    if (this.selectedTimeInAppDate == null) return '';
    const row = s.timeInAppRows.find(r => isSameDay(r.date, this.selectedTimeInAppDate));
    if (!row) return '';
    return `
      <div class="chart-detail">
        <span class="dot" style="background:var(--accent2)"></span>
        <span class="title">${formatDateAbbrev(row.date)}</span>
        <span class="value">${row.minutes} min in app</span>
      </div>
    `;
  }

  // ---------- Activity heatmap ----------

  renderHeatmapCard(h) {
    const dayLabels = ['Mon', '', 'Wed', '', 'Fri', '', ''];
    return `
      <div class="stat-card">
        <p class="stat-title">Activity</p>
        <div class="heatmap-wrap">
          <div class="heatmap-daylabels">${dayLabels.map(l => `<span>${l}</span>`).join('')}</div>
          <div>
            <div class="heatmap-months" style="width:${h.weeks.length * 16}px;">
              ${h.monthMarkers.map(m => `<span style="left:${m.weekIndex * 16}px;">${m.title}</span>`).join('')}
            </div>
            <div class="heatmap-weeks">
              ${h.weeks.map(week => `
                <div class="heatmap-week">
                  ${week.map(day => {
                    if (!day) return `<div class="heat-cell placeholder"></div>`;
                    const selected = this.selectedHeatDay && isSameDay(day.date, this.selectedHeatDay.date);
                    return `<div class="heat-cell ${selected ? 'selected' : ''}" style="background:${this.heatColor(day.minutes, h.maxValue)}" data-heat-date="${dayKey(day.date)}"></div>`;
                  }).join('')}
                </div>
              `).join('')}
            </div>
          </div>
        </div>
        <div class="heat-legend" style="padding:0 16px 4px;">
          <span class="lbl">Less</span>
          ${[0, 1, 2, 3, 4].map(step => `<span class="sw" style="background:color-mix(in srgb, var(--accent2) ${15 + step * 20}%, transparent);"></span>`).join('')}
          <span class="lbl">More</span>
        </div>
        ${this.renderHeatDetail()}
      </div>
    `;
  }

  heatColor(minutes, maxValue) {
    if (minutes === 0) return 'var(--surface2)';
    const normalized = minutes / Math.max(maxValue, 1);
    const pct = 25 + normalized * 75;
    return `color-mix(in srgb, var(--accent2) ${pct}%, transparent)`;
  }

  renderHeatDetail() {
    if (!this.selectedHeatDay) return '';
    const d = this.selectedHeatDay;
    return `
      <div class="chart-detail" style="margin:0 16px 14px;">
        <span class="dot" style="background:var(--accent2)"></span>
        <span class="title">${formatDateAbbrev(d.date)}</span>
        <span class="value">${d.minutes} min in app · ${d.answeredCount} cards answered</span>
      </div>
    `;
  }

  // ---------- Bindings ----------

  bind() {
    bindCollectionFilter(this.container, this.store, () => this.recompute());
    this.container.querySelector('[data-action="open-settings"]').onclick = () => this.actions.openSettings();

    const showAllBtn = this.container.querySelector('[data-action="show-all-problem"]');
    if (showAllBtn) showAllBtn.onclick = () => this.openProblemWordsSheet();

    this.container.querySelectorAll('[data-range]').forEach(btn => {
      btn.onclick = () => { this.selectedRange = btn.dataset.range; this.recompute(); };
    });

    this.container.querySelectorAll('[data-scope="workload"]').forEach(col => {
      col.onclick = () => {
        const date = new Date(Number(col.dataset.date));
        this.selectedWorkloadDate = (this.selectedWorkloadDate && isSameDay(this.selectedWorkloadDate, date)) ? null : date;
        this.render();
      };
    });

    this.container.querySelectorAll('[data-scope="timeinapp"]').forEach(col => {
      col.onclick = () => {
        const date = new Date(Number(col.dataset.date));
        this.selectedTimeInAppDate = (this.selectedTimeInAppDate && isSameDay(this.selectedTimeInAppDate, date)) ? null : date;
        this.render();
      };
    });

    this.container.querySelectorAll('[data-heat-date]').forEach(cell => {
      cell.onclick = () => {
        const date = new Date(Number(cell.dataset.heatDate));
        const day = this.snapshot.heatmap.days.find(d => isSameDay(d.date, date));
        this.selectedHeatDay = (this.selectedHeatDay && isSameDay(this.selectedHeatDay.date, date)) ? null : day;
        this.render();
      };
    });
  }

  openProblemWordsSheet() {
    const items = this.snapshot.problemWords;
    const body = items.map(item => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);">
        <div>
          <div style="font-weight:600;font-size:15px;">${escapeHTML(item.english)}</div>
          <div style="font-size:12px;color:var(--text-secondary);">${escapeHTML(item.translation)}</div>
        </div>
        <div style="font-size:12px;font-weight:600;color:var(--destructive);">${item.lapses} lapses</div>
      </div>
    `).join('');
    openSheet({ title: 'Problem Words', bodyHTML: body, doneLabel: 'Done' });
  }

  // ---------- Snapshot building (ported from StatisticsView.buildSnapshot) ----------

  static buildSnapshot(items, reviewEvents, selectedCollectionIDs, rangeDays, appTimeByDay) {
    const today = startOfDay(new Date());

    const scopedItems = selectedCollectionIDs.size === 0
      ? items
      : items.filter(i => i.collectionID && selectedCollectionIDs.has(i.collectionID));

    // Upcoming Workload
    const workloadCounts = {};
    const workloadEnd = addDays(today, 6);
    for (const item of scopedItems) {
      if (item.cycleStatus == null) continue;
      const dueDay = startOfDay(new Date(item.nextReview));
      if (dueDay < today || dueDay > workloadEnd) continue;
      const k = dayKey(dueDay);
      workloadCounts[k] = (workloadCounts[k] || 0) + 1;
    }
    const maxWorkload = Math.max(0, ...Object.values(workloadCounts));
    const upcomingWorkload = [];
    for (let offset = 0; offset < 7; offset++) {
      const day = addDays(today, offset);
      const count = workloadCounts[dayKey(day)] || 0;
      const isPeak = maxWorkload > 0 && count >= maxWorkload * 0.75;
      upcomingWorkload.push({ date: day, count, isPeak });
    }

    // Problem Words
    const problemWords = scopedItems.filter(i => i.lapses > 0).sort((a, b) => b.lapses - a.lapses);

    // Time in App
    const rangeStart = addDays(today, -(rangeDays - 1));
    const timeInAppRows = [];
    let cursor = rangeStart;
    while (cursor <= today) {
      const minutes = Math.floor((appTimeByDay[dayKey(cursor)] || 0) / 60);
      timeInAppRows.push({ date: cursor, minutes });
      cursor = addDays(cursor, 1);
    }

    // Activity heatmap: 90 days
    const heatEnd = today;
    const heatStart = addDays(heatEnd, -89);
    const answeredCountByDay = {};
    for (const ev of reviewEvents) {
      const day = startOfDay(new Date(ev.date));
      if (day < heatStart || day > heatEnd) continue;
      const k = dayKey(day);
      answeredCountByDay[k] = (answeredCountByDay[k] || 0) + 1;
    }

    const heatDays = [];
    for (let offset = 0; offset < 90; offset++) {
      const day = addDays(heatStart, offset);
      const minutes = Math.floor((appTimeByDay[dayKey(day)] || 0) / 60);
      heatDays.push({ date: day, minutes, answeredCount: answeredCountByDay[dayKey(day)] || 0 });
    }

    let heatWeeks = [];
    const heatMonthMarkers = [];
    if (heatDays.length > 0) {
      const firstDay = heatDays[0].date;
      const lastDay = heatDays[heatDays.length - 1].date;
      const wkStart = weekOfYearStart(firstDay);
      const byDay = new Map(heatDays.map(d => [dayKey(d.date), d]));

      const totalDays = Math.round((lastDay - wkStart) / 86400000) + 1;
      const weeks = Math.ceil(totalDays / 7);

      for (let weekIndex = 0; weekIndex < weeks; weekIndex++) {
        const week = [];
        for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
          const offset = weekIndex * 7 + dayIndex;
          const date = addDays(wkStart, offset);
          if (date < firstDay || date > lastDay) { week.push(null); continue; }
          week.push(byDay.get(dayKey(date)) || null);
        }
        heatWeeks.push(week);
      }

      const seenMonths = new Set();
      for (const d of heatDays) {
        const key = `${d.date.getFullYear()}-${d.date.getMonth()}`;
        if (seenMonths.has(key)) continue;
        seenMonths.add(key);
        const dayOffset = Math.round((d.date - wkStart) / 86400000);
        const weekIndex = Math.max(0, Math.floor(dayOffset / 7));
        heatMonthMarkers.push({ weekIndex, title: monthAbbrev(d.date) });
      }
    }

    const maxHeatValue = Math.max(1, ...heatDays.map(d => d.minutes));

    return {
      upcomingWorkload,
      problemWords,
      timeInAppRows,
      heatmap: { days: heatDays, weeks: heatWeeks, monthMarkers: heatMonthMarkers, maxValue: maxHeatValue },
    };
  }
}

// Mirrors Swift's `calendar.dateInterval(of: .weekOfYear, for:)?.start` (locale-default first weekday).
function weekOfYearStart(date) {
  const d = startOfDay(date);
  const jsWeekday = d.getDay();
  return addDays(d, -jsWeekday);
}
