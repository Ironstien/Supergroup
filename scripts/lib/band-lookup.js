const AFFILIATIONS = require('../data/band-affiliations');

function normalizeName(name) { return String(name).trim().toLowerCase(); }

function lookupBand(name) { return AFFILIATIONS[normalizeName(name)] ?? 'Solo'; }

module.exports = { lookupBand, normalizeName };
