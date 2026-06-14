/** Stable slug from display name + era (handles same artist in multiple eras). */
function slugify(name) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function musicianId(name, era) {
  const base = slugify(name);
  return era ? `${base}-${era}` : base;
}

module.exports = { slugify, musicianId };
