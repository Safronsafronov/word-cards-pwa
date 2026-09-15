// Horizontal swipe-to-switch-tab, mirroring `.tabViewStyle(.page(indexDisplayMode: .never))`
// from RootView.swift (the native app already lets you swipe between Training/Word Base/Statistics).

const SWIPE_THRESHOLD_PX = 60;
const HORIZONTAL_INTENT_RATIO = 1.5; // dx must dominate dy by this much before we commit to a swipe

export function setupSwipeNavigation(root, { order, getActiveKey, onSwitch, isBlocked }) {
  let startX = 0;
  let startY = 0;
  let tracking = false;
  let horizontal = false;

  root.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1 || (isBlocked && isBlocked(e))) { tracking = false; return; }
    const target = e.target;
    if (target.closest('input, textarea, .heatmap-wrap, .filter-chips, .bar-chart, .period-tabs')) {
      tracking = false;
      return;
    }
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    tracking = true;
    horizontal = false;
  }, { passive: true });

  root.addEventListener('touchmove', (e) => {
    if (!tracking) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if (!horizontal && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * HORIZONTAL_INTENT_RATIO) {
      horizontal = true;
    }
  }, { passive: true });

  root.addEventListener('touchend', (e) => {
    if (!tracking) return;
    tracking = false;
    if (!horizontal) return;

    const touch = e.changedTouches[0];
    const dx = (touch ? touch.clientX : startX) - startX;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;

    const idx = order.indexOf(getActiveKey());
    if (idx === -1) return;

    if (dx < 0 && idx < order.length - 1) onSwitch(order[idx + 1]);
    else if (dx > 0 && idx > 0) onSwitch(order[idx - 1]);
  }, { passive: true });
}
