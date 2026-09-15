// Swipeable tab carousel, mirroring `.tabViewStyle(.page(indexDisplayMode: .never))`
// from RootView.swift (the native app already lets you swipe between Training/Word
// Base/Statistics with the screen sliding under your finger).
//
// `track` must be a flex row 100*order.length% wide, with each screen at
// 100/order.length% (see #tab-track / .screen in styles.css). We drag it with
// translateX(calc(<base%> + <dxPx>px)) while tracking the finger, then either
// animate to the next/previous tab or spring back, using a real CSS transition.

const SWIPE_THRESHOLD_PX = 60;
const HORIZONTAL_INTENT_RATIO = 1.5; // dx must dominate dy by this much before we commit to a swipe
const EDGE_RESISTANCE = 0.35; // drag damping past the first/last tab
const TRANSITION = 'transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)';

export function setupSwipeCarousel(track, { order, getActiveKey, onSwitch, isBlocked }) {
  let startX = 0;
  let startY = 0;
  let dragging = false;
  let horizontal = false;
  let undecided = false;
  let currentDx = 0;

  function basePercent(index) {
    return (-index * 100) / order.length;
  }

  function setTransform(index, dxPx, animate) {
    track.style.transition = animate ? TRANSITION : 'none';
    track.style.transform = dxPx
      ? `translateX(calc(${basePercent(index)}% + ${dxPx}px))`
      : `translateX(${basePercent(index)}%)`;
  }

  // Snaps the track to whatever tab is currently active — call after any
  // programmatic tab change (tab-bar tap) so the carousel stays in sync.
  function syncToActive(animate) {
    setTransform(order.indexOf(getActiveKey()), 0, animate);
  }

  track.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1 || (isBlocked && isBlocked(e))) { dragging = false; return; }
    if (e.target.closest('input, textarea, .heatmap-wrap, .filter-chips, .bar-chart, .period-tabs')) {
      dragging = false;
      return;
    }
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    dragging = true;
    horizontal = false;
    undecided = true;
    currentDx = 0;
  }, { passive: true });

  track.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;

    if (undecided) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * HORIZONTAL_INTENT_RATIO) {
        horizontal = true;
        undecided = false;
      } else if (Math.abs(dy) > 10) {
        // A vertical scroll won a moving gesture — stop tracking, let the page scroll.
        dragging = false;
        return;
      } else {
        return;
      }
    }
    if (!horizontal) return;

    const idx = order.indexOf(getActiveKey());
    let clamped = dx;
    if (idx === 0 && dx > 0) clamped = dx * EDGE_RESISTANCE;
    if (idx === order.length - 1 && dx < 0) clamped = dx * EDGE_RESISTANCE;

    currentDx = clamped;
    setTransform(idx, clamped, false);
  }, { passive: true });

  track.addEventListener('touchend', () => {
    if (!dragging) return;
    dragging = false;
    const idx = order.indexOf(getActiveKey());

    if (!horizontal) { setTransform(idx, 0, true); return; }

    if (currentDx <= -SWIPE_THRESHOLD_PX && idx < order.length - 1) {
      const nextIdx = idx + 1;
      onSwitch(order[nextIdx]);
      setTransform(nextIdx, 0, true); // finish the slide into the new tab's resting position
    } else if (currentDx >= SWIPE_THRESHOLD_PX && idx > 0) {
      const nextIdx = idx - 1;
      onSwitch(order[nextIdx]);
      setTransform(nextIdx, 0, true);
    } else {
      setTransform(idx, 0, true); // didn't clear the threshold — spring back
    }
    currentDx = 0;
  }, { passive: true });

  track.addEventListener('touchcancel', () => {
    if (!dragging) return;
    dragging = false;
    setTransform(order.indexOf(getActiveKey()), 0, true);
  }, { passive: true });

  syncToActive(false);

  return { syncToActive };
}
