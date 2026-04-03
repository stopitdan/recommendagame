/**
 * Shared parsing and normalization utilities.
 *
 * Extracted from adapters so they can be unit tested independently
 * and reused across data sources.
 */

/**
 * Decodes common HTML entities found in XML/HTML data.
 * Used for cleaning names, tags, and other short strings from BGG, RAWG, etc.
 */
export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&lsquo;|&rsquo;/g, "'")
    .replace(/&ndash;/g, '\u2013')
    .replace(/&mdash;/g, '\u2014')
    .replace(/&nbsp;/g, ' ');
}

/**
 * Strips HTML tags and decodes common HTML entities.
 * Used for cleaning descriptions from BGG, RAWG, etc.
 */
export function stripHtml(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, '')
  )
    .replace(/&#10;/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Ensures a value is always an array. Many APIs (especially XML-based ones)
 * return a single item or an array depending on result count.
 */
export function ensureArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Parses a string to an integer, returning undefined if invalid.
 */
export function parseOptionalInt(value: string | undefined | null): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? undefined : parsed;
}

/**
 * Parses a string to a float, returning undefined if invalid.
 */
export function parseOptionalFloat(value: string | undefined | null): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? undefined : parsed;
}

/**
 * Normalizes a rating from one scale to another.
 * Returns undefined if the input is 0 or invalid.
 */
export function normalizeRating(
  value: number,
  fromMax: number,
  toMax: number,
): number | undefined {
  if (value <= 0) return undefined;
  return Math.round((value / fromMax) * toMax * 10) / 10;
}

/**
 * Clamps a number to a min/max range.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
