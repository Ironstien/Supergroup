const { slugify } = require('./musician-id');

function bandKey(bandName, era) {
  return `${slugify(bandName)}|${era}`;
}

module.exports = { bandKey };
