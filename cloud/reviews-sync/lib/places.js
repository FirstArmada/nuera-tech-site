/* Google reviews → reviews.json shape.
 *
 * Uses the classic Place Details endpoint, which returns the aggregate rating, the
 * total review count, and up to ~5 reviews (author, rating, text, relative time).
 * Requires the "Places API" enabled on the GCP project and an API key (restrict it
 * to the Places API). The key is read from env/Secret Manager by job.js.
 */
const ENDPOINT = 'https://maps.googleapis.com/maps/api/place/details/json';

const initialsOf = (name) =>
  String(name || '').trim().split(/\s+/).map((w) => w[0] || '').join('').slice(0, 2).toUpperCase() || 'G';

// "Sarah Mortimer" → "Sarah M." — Google returns full names; keep the wall friendly and
// a little more private. Single-word names pass through unchanged.
function shortName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Google reviewer';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

export async function fetchReviews(placeId, apiKey, { minRating = 0, max = 6 } = {}) {
  const url = `${ENDPOINT}?place_id=${encodeURIComponent(placeId)}`
    + `&fields=${encodeURIComponent('name,rating,user_ratings_total,reviews,url')}`
    + `&reviews_sort=newest&language=en&key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Places HTTP ${res.status}`);
  const body = await res.json();
  if (body.status !== 'OK') throw new Error(`Places status ${body.status}: ${body.error_message || 'no detail'}`);

  const r = body.result || {};
  const reviews = (r.reviews || [])
    .filter((rv) => (Number(rv.rating) || 0) >= minRating && rv.text && rv.text.trim())
    .sort((a, b) => (b.time || 0) - (a.time || 0))
    .slice(0, max)
    .map((rv) => ({
      author: shortName(rv.author_name),
      initials: initialsOf(rv.author_name),
      rating: Number(rv.rating),
      text: rv.text.trim(),
      time: rv.relative_time_description || '',
    }));

  return {
    generated: new Date().toISOString().slice(0, 10),
    source: 'Google Places — Place Details API',
    place_id: placeId,
    place_url: r.url || '',
    rating: typeof r.rating === 'number' ? r.rating : null,
    review_count: typeof r.user_ratings_total === 'number' ? r.user_ratings_total : 0,
    reviews,
  };
}
