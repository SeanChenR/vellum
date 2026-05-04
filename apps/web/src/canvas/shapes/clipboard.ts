/**
 * Tiny clipboard wrapper — gives shape components a single import to
 * mock in tests (happy-dom's `navigator.clipboard` is hard to override
 * via property descriptors on its built-in Clipboard class).
 */

export async function writeToClipboard(text: string): Promise<void> {
  if (!navigator.clipboard?.writeText) return;
  await navigator.clipboard.writeText(text);
}
