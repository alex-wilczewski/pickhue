// Synchronous clipboard copy for content-script context. An awaited
// navigator.clipboard.writeText() silently fails in content scripts when the
// document isn't focused, so we use a hidden textarea + execCommand inside the
// user gesture and fall back to the async API as a best effort.
export function copyText(text: string): void {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.cssText =
    "position:fixed;top:-1000px;left:-1000px;opacity:0;pointer-events:none;";
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, text.length);

  try {
    document.execCommand("copy");
  } catch {
    /* execCommand may be unavailable; fall through to the async API */
  }

  textarea.remove();

  try {
    void navigator.clipboard?.writeText(text);
  } catch {
    /* best effort */
  }
}
