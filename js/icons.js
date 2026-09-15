// Minimal inline SVG icon set, visual stand-ins for the SF Symbols used in the SwiftUI app.
// All icons use currentColor and a 24x24 viewbox unless noted, stroke-based to stay lightweight.

// width/height="1em" is just a safety-net default (so an icon is never invisible if a
// CSS rule fails to match it) — every real usage sizes it explicitly via CSS anyway.
const S = (inner, viewBox = '0 0 24 24') =>
  `<svg viewBox="${viewBox}" width="1em" height="1em" fill="none" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;

export const Icon = {
  graduationCap: S(`<path d="M12 3 2 8l10 5 10-5-10-5Z" fill="currentColor"/><path d="M6 11v5c0 1.4 2.7 3 6 3s6-1.6 6-3v-5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M22 8v6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`),
  stackFill: S(`<path d="M12 3 3 8l9 5 9-5-9-5Z" fill="currentColor"/><path d="M3 12l9 5 9-5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 16l9 5 9-5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`),
  stackOutline: S(`<path d="M12 3 3 8l9 5 9-5-9-5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M3 12l9 5 9-5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`),
  chartBar: S(`<rect x="4" y="12" width="4" height="8" rx="1" fill="currentColor"/><rect x="10" y="7" width="4" height="13" rx="1" fill="currentColor"/><rect x="16" y="3" width="4" height="17" rx="1" fill="currentColor"/>`),
  gear: S(`<circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.7"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`),
  sparkles: S(`<path d="M12 1.5c.5 4.2 1.3 6.9 2.7 8.3 1.4 1.4 4.1 2.2 8.3 2.7-4.2.5-6.9 1.3-8.3 2.7-1.4 1.4-2.2 4.1-2.7 8.3-.5-4.2-1.3-6.9-2.7-8.3C7.9 13.8 5.2 13 1 12.5c4.2-.5 6.9-1.3 8.3-2.7C10.7 8.4 11.5 5.7 12 1.5Z" fill="currentColor"/>`),
  clock: S(`<circle cx="12" cy="12" r="9" fill="currentColor"/><path d="M12 7v5l3.5 2" stroke="var(--bg)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`),
  checkSeal: S(`<path d="M12 2.5l2.4 1.4 2.6-.2 1.1 2.4 2.4 1.1-.2 2.6 1.4 2.2-1.4 2.2.2 2.6-2.4 1.1-1.1 2.4-2.6-.2L12 21.5l-2.4-1.4-2.6.2-1.1-2.4-2.4-1.1.2-2.6L2.3 12l1.4-2.2-.2-2.6 2.4-1.1L7 3.7l2.6.2L12 2.5Z" fill="currentColor"/><path d="M8.5 12.2l2.2 2.2 4.5-4.8" stroke="var(--bg)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`),
  flame: S(`<path d="M12 1.2c1.3 3.6-3.6 4.8-3.6 9.6a5.6 5.6 0 0 0 11.2 0c0-1.8-.7-2.9-1.4-3.8-.4 2.4-1.9 3.1-1.9 3.1.7-3.6-1.2-5.3-1.9-7.7-.6 1.9-1.9 2.4-2.4-1.2Z" fill="currentColor"/>`),
  circleFill: S(`<circle cx="12" cy="12" r="8.5" fill="currentColor"/>`),
  plus: S(`<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>`),
  trash: S(`<path d="M4 7h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M9 7V4.5A1 1 0 0 1 10 3.5h4a1 1 0 0 1 1 1V7" stroke="currentColor" stroke-width="1.8"/><path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" stroke="currentColor" stroke-width="1.8"/><path d="M10 11v6M14 11v6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`),
  arrowLeft: S(`<path d="M19 12H5M11 6l-6 6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`),
  pencil: S(`<path d="M4 20l1-4 11-11 3 3-11 11-4 1Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M14 6l3 3" stroke="currentColor" stroke-width="1.6"/>`),
  play: S(`<path d="M6 4.5v15l14-7.5-14-7.5Z" fill="currentColor"/>`),
  search: S(`<circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" stroke-width="1.8"/><path d="M20 20l-4.5-4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`),
  swap: S(`<path d="M4 8h13M13 4l4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 16H7M11 12l-4 4 4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`),
  chevronRightCircle: S(`<circle cx="12" cy="12" r="9" fill="currentColor"/><path d="M10.5 8.5l3.5 3.5-3.5 3.5" stroke="var(--surface)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`),
  chevronDown: S(`<path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`),
  chevronRight: S(`<path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`),
  check: S(`<path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`),
  circleDashed: S(`<circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.8" stroke-dasharray="4 3"/>`),
  docPlus: S(`<path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M14 3v4h4" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 12v6M9 15h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`),
  exportUp: S(`<path d="M12 3v12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M8 7l4-4 4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 14v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`),
};

export function iconMarkup(name) {
  return Icon[name] || '';
}
