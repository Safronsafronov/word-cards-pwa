// Ported from RootView.swift + WordCardsMVPApp.swift

import { VocabStore } from './store.js';
import { iconMarkup } from './icons.js';
import { TrainingView } from './views/training.js';
import { WordBaseView } from './views/wordbase.js';
import { StatisticsView } from './views/statistics.js';
import { SettingsOverlay } from './views/settings.js';
import { setupSwipeNavigation } from './swipe.js';

const TABS = [
  { key: 'training', title: 'Training', icon: 'graduationCap' },
  { key: 'wordbase', title: 'Word Base', icon: 'stackFill' },
  { key: 'statistics', title: 'Statistics', icon: 'chartBar' },
];
const TAB_ORDER = TABS.map(t => t.key);

async function main() {
  const store = new VocabStore();
  await store.whenReady();

  const screens = {
    training: document.getElementById('screen-training'),
    wordbase: document.getElementById('screen-wordbase'),
    statistics: document.getElementById('screen-statistics'),
  };

  const settingsOverlay = new SettingsOverlay(document.getElementById('settings-overlay'), store);
  const actions = { openSettings: () => settingsOverlay.open() };

  const views = {
    training: new TrainingView(screens.training, store, actions),
    wordbase: new WordBaseView(screens.wordbase, store, actions),
    statistics: new StatisticsView(screens.statistics, store, actions),
  };

  let activeTab = 'training';

  function renderTabBar() {
    const bar = document.getElementById('tabbar-row');
    bar.innerHTML = TABS.map(t => `
      <button class="tab-btn ${activeTab === t.key ? 'active' : ''}" data-tab="${t.key}">
        ${iconMarkup(t.icon)}
        <span>${t.title}</span>
      </button>
    `).join('');
    bar.querySelectorAll('[data-tab]').forEach(btn => {
      btn.onclick = () => switchTab(btn.dataset.tab);
    });
  }

  function switchTab(key) {
    if (key === activeTab && key === 'training') {
      views.training.requestExitToDashboard();
      return;
    }
    activeTab = key;
    for (const k of Object.keys(screens)) {
      const isActive = k === key;
      screens[k].classList.toggle('active', isActive);
      if (isActive) views[k].activate();
      else views[k].deactivate();
    }
    renderTabBar();
  }

  renderTabBar();
  screens[activeTab].classList.add('active');
  views[activeTab].activate();

  // Swipe left/right anywhere in the screen area to move between tabs
  // (mirrors the native app's `.tabViewStyle(.page(...))` swipeable TabView).
  setupSwipeNavigation(document.getElementById('app'), {
    order: TAB_ORDER,
    getActiveKey: () => activeTab,
    onSwitch: switchTab,
    isBlocked: () =>
      document.getElementById('settings-overlay').classList.contains('open') ||
      document.getElementById('sheet-backdrop').classList.contains('open'),
  });

  // Pre-render inactive tabs once so switching feels instant (builds their snapshot too).
  for (const k of Object.keys(views)) {
    if (k === activeTab) continue;
    views[k].activate();
    views[k].deactivate();
  }

  // ---------- App-time tracking (mirrors scenePhase handling in WordCardsMVPApp.swift) ----------

  store.appDidBecomeActive();

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      store.appWillResignActive();
      store.flushSaveNow();
    } else {
      store.appDidBecomeActive();
    }
  });

  window.addEventListener('pagehide', () => {
    store.appWillResignActive();
    store.flushSaveNow();
  });

  window.addEventListener('beforeunload', () => {
    store.appWillResignActive();
    store.flushSaveNow();
  });

  // ---------- Service worker (offline / add-to-home-screen support) ----------

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

main();
