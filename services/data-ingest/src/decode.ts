/**
 * Decodes the raw bytes of the ANTT toll-plaza CSV.
 *
 * The file is published as ISO-8859-1 (Windows-1252), NOT UTF-8 — confirmed
 * by downloading and inspecting the real September-2026 CSV (`file(1)`
 * reports "ISO-8859 text"; the byte for "ã" is `0xE3`, for "ç" is `0xE7`,
 * which is `iso-8859-1`/`latin1`, not the two-byte UTF-8 sequences those
 * letters would take). Decoding it as UTF-8 instead corrupts every
 * accented name (e.g. "São Gonçalo" becomes mojibake) without throwing —
 * silent corruption, not a crash, which is why this is a single named
 * function with its own test rather than an inline `.toString()` at the
 * call site.
 *
 * `Buffer#toString('latin1')` is Node's built-in ISO-8859-1 decoder: it maps
 * each byte directly to the Unicode code point of the same value (0-255),
 * which is by definition what ISO-8859-1 is. Deliberately NOT
 * `TextDecoder('iso-8859-1')` — that path depends on ICU data that may not
 * be present in every Node build, where `Buffer`'s latin1 support is
 * unconditional.
 */
export function decodeAnttCsvBytes(bytes: Buffer): string {
  return bytes.toString('latin1');
}
