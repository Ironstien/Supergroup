/** Render musician/band images with grey placeholder fallback. */

/** Local /media paths are served from disk (Vite middleware in dev, public/ in build). */
export function mediaAssetUrl(url) {
  if (!url) return url;
  return String(url);
}

export function renderMediaImage({
  url,
  alt,
  className = '',
  placeholderClass = 'media-placeholder',
  loading = 'lazy',
}) {
  const src = mediaAssetUrl(url);
  if (src) {
    return `<img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}" class="${className}" loading="${loading}" decoding="async" />`;
  }
  return `<div class="${placeholderClass}${className ? ` ${className}` : ''}" aria-label="${escapeAttr(alt)} — image pending"><span class="media-placeholder__label">${escapeHtml(shortLabel(alt))}</span></div>`;
}

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function shortLabel(text) {
  const words = String(text).split(/\s+/).slice(0, 2);
  return words.join(' ');
}

export const ATTRIBUTION_HTML = `<p class="media-attribution">Images via <a href="https://commons.wikimedia.org/" target="_blank" rel="noopener noreferrer">Wikimedia Commons</a> and other credited sources.</p>`;
