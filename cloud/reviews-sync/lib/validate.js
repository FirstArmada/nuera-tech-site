/* Validation gate before any PR is opened. Mirrors the structure the site's
 * renderReviews() expects, and refuses to overwrite a populated wall with an
 * empty one (catches a transient Places API hiccup).
 */
export function validate(data, prev) {
  JSON.parse(JSON.stringify(data)); // round-trips → catches non-serializable values

  if (!data || typeof data !== 'object') throw new Error('not an object');
  if (typeof data.generated !== 'string') throw new Error('missing "generated" date');
  if (typeof data.source !== 'string') throw new Error('missing "source"');
  if (data.rating !== null && typeof data.rating !== 'number') throw new Error('rating must be number|null');
  if (data.rating != null && (data.rating < 0 || data.rating > 5)) throw new Error('rating out of range 0–5');
  if (typeof data.review_count !== 'number' || data.review_count < 0) throw new Error('review_count must be a non-negative number');
  if (!Array.isArray(data.reviews)) throw new Error('reviews[] must be an array');

  data.reviews.forEach((r, i) => {
    const at = `reviews[${i}]`;
    if (typeof r.author !== 'string' || !r.author.trim()) throw new Error(`${at}.author must be a non-empty string`);
    if (typeof r.text !== 'string' || !r.text.trim()) throw new Error(`${at}.text must be a non-empty string`);
    if (typeof r.rating !== 'number' || r.rating < 1 || r.rating > 5) throw new Error(`${at}.rating must be a number 1–5`);
  });

  if (prev && Array.isArray(prev.reviews) && prev.reviews.length && !data.reviews.length) {
    throw new Error('refusing to overwrite existing reviews with an empty set — aborting');
  }
  return true;
}
