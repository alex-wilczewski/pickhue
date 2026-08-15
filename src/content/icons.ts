/*
 * Unified icon system: 24×24 grid, 2px strokes, round caps/joins, no fill.
 * Matches the theme/close/back/file icons so every glyph reads at the same
 * optical weight. The logo mark is a bespoke brand asset and lives in the panel
 * template, intentionally outside this system.
 */

/** Two stacked squares for duplicate actions. */
export const DUPLICATE_ICON_HTML = `<svg class="icon icon--duplicate" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>`;

/** Bulleted list for hex-list export. */
export const EXPORT_LIST_ICON_HTML = `<svg class="icon icon--list" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M8.5 6h12M8.5 12h12M8.5 18h12" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/><path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" fill="none"/></svg>`;

/** Code chevrons for CSS-variables export. */
export const EXPORT_CODE_ICON_HTML = `<svg class="icon icon--code" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="m8 8-4 4 4 4M16 8l4 4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;

/** Document for file exports (.ase). */
export const EXPORT_FILE_ICON_HTML = `<svg class="icon icon--file" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M14 3v5h5M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;

/** Archive box for JSON backup export. */
export const EXPORT_BACKUP_ICON_HTML = `<svg class="icon icon--backup" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M4 8h16M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M3.5 4h17v4h-17zM10 12h4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;

/** Curly braces for the Tailwind config export. */
export const EXPORT_TAILWIND_ICON_HTML = `<svg class="icon icon--tailwind" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M8.5 3.5c-1.7 0-2.5 1-2.5 2.5v3c0 1.2-.6 2.3-2.2 3 1.6.7 2.2 1.8 2.2 3v3c0 1.5.8 2.5 2.5 2.5M15.5 3.5c1.7 0 2.5 1 2.5 2.5v3c0 1.2.6 2.3 2.2 3-1.6.7-2.2 1.8-2.2 3v3c0 1.5-.8 2.5-2.5 2.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>`;

/** Stacked bars fading in weight — shades & tints ramp affordance. */
export const RAMP_ICON_HTML = `<svg class="icon icon--ramp" viewBox="0 0 24 24" width="10" height="10" aria-hidden="true"><rect x="4" y="3.5" width="16" height="4.4" rx="2.2" fill="currentColor" opacity="0.35"/><rect x="4" y="9.8" width="16" height="4.4" rx="2.2" fill="currentColor" opacity="0.65"/><rect x="4" y="16.1" width="16" height="4.4" rx="2.2" fill="currentColor"/></svg>`;

/** Plus mark for add actions. */
export const PLUS_ICON_HTML = `<svg class="icon icon--plus" viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>`;

/** Compact X for the save-to-palette toggle's cancel state. */
export const CANCEL_ACTION_ICON_HTML = `<svg class="icon icon--cancel" viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>`;

/** Filled ellipsis (Heroicons solid style) for palette row actions — no
    strokes, reads cleanly at row size. */
export const ELLIPSIS_ICON_HTML = `<svg class="icon icon--ellipsis" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><circle cx="5" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="19" cy="12" r="2" fill="currentColor"/></svg>`;

/** Outline gear for palette row actions. */
export const SETTINGS_ICON_HTML = `<svg class="icon icon--settings" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2" fill="none"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;

/** Outline pencil for rename actions. */
export const RENAME_ICON_HTML = `<svg class="icon icon--rename" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497zM15 5l4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;

/** Outline arrow-up-tray (Heroicons) for export actions. */
export const EXPORT_ICON_HTML = `<svg class="icon icon--export" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;

/** Outline arrow-down-tray (Heroicons) for import actions. */
export const IMPORT_ICON_HTML = `<svg class="icon icon--import" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M12 3v12.75m0 0 4.5-4.5M12 15.75l-4.5-4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;

/** Outline up/down arrows for drag-to-reorder. */
export const MOVE_ICON_HTML = `<svg class="icon icon--move" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M7 20V4M4 7l3-3 3 3M17 4v16M20 17l-3 3-3-3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;

/** Outline trash for delete actions. */
export const DELETE_ICON_HTML = `<svg class="icon icon--delete" viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;

/** Compact check for swatches already added to the open palette. */
export const CHECK_SWATCH_ICON_HTML = `<svg class="icon icon--check" viewBox="0 0 24 24" width="10" height="10" aria-hidden="true"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;

/** Compact X for swatch remove controls. */
export const REMOVE_SWATCH_ICON_HTML = `<svg class="icon icon--remove" viewBox="0 0 24 24" width="10" height="10" aria-hidden="true"><path d="M8 8l8 8M16 8 8 16" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" fill="none"/></svg>`;

/** Delete button label with icon. */
export const DELETE_BUTTON_HTML = `${DELETE_ICON_HTML}<span>Delete</span>`;
