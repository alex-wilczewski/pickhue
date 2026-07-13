/*
 * Unified icon system: 24×24 grid, 2px strokes, round caps/joins, no fill.
 * Matches the theme/close/back/file icons so every glyph reads at the same
 * optical weight. The logo mark is a bespoke brand asset and lives in the panel
 * template, intentionally outside this system.
 */

/** Plus mark for add actions. */
export const PLUS_ICON_HTML = `<svg class="icon icon--plus" viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>`;

/** Outline gear for palette row actions. */
export const SETTINGS_ICON_HTML = `<svg class="icon icon--settings" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2" fill="none"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;

/** Outline pencil for rename actions. */
export const RENAME_ICON_HTML = `<svg class="icon icon--rename" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497zM15 5l4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;

/** Outline upload/share for export actions. */
export const EXPORT_ICON_HTML = `<svg class="icon icon--export" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;

/** Outline up/down arrows for drag-to-reorder. */
export const MOVE_ICON_HTML = `<svg class="icon icon--move" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M7 20V4M4 7l3-3 3 3M17 4v16M20 17l-3 3-3-3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;

/** Outline trash for delete actions. */
export const DELETE_ICON_HTML = `<svg class="icon icon--delete" viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;

/** Compact X for swatch remove controls. */
export const REMOVE_SWATCH_ICON_HTML = `<svg class="icon icon--remove" viewBox="0 0 24 24" width="10" height="10" aria-hidden="true"><path d="M8 8l8 8M16 8 8 16" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" fill="none"/></svg>`;

/** Delete button label with icon. */
export const DELETE_BUTTON_HTML = `${DELETE_ICON_HTML}<span>Delete</span>`;
