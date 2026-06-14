/**
 * Fetch image URLs from Wikimedia, Wikipedia page images, and MusicBrainz Cover Art.
 * Returns URL strings only — nothing is downloaded to disk.
 */

const WIKI_API = 'https://en.wikipedia.org/w/api.php';
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const MB_API = 'https://musicbrainz.org/ws/2';
const USER_AGENT = 'SupergroupGame/3.0 (personal project; media metadata fetch)';

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function wikiFetch(apiBase, params, retries = 3) {
  const url = new URL(apiBase);
  url.searchParams.set('format', 'json');
  url.searchParams.set('origin', '*');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });
    if (res.status === 429 && attempt < retries) {
      await delay(2000 * (attempt + 1));
      continue;
    }
    if (!res.ok) throw new Error(`Wiki HTTP ${res.status}`);
    return res.json();
  }
  throw new Error('Wiki HTTP 429');
}

function wikiImageUrl(page) {
  const thumb = page?.thumbnail?.source;
  const original = page?.original?.source;
  return original ?? thumb ?? null;
}

async function wikipediaPageImage(title) {
  const data = await wikiFetch(WIKI_API, {
    action: 'query',
    titles: title,
    prop: 'pageimages',
    piprop: 'original|thumbnail',
    pithumbsize: 400,
  });
  const pages = data.query?.pages ?? {};
  const page = Object.values(pages)[0];
  if (!page || page.missing !== undefined) return null;
  return wikiImageUrl(page);
}

async function commonsSearchImage(searchTerm) {
  const data = await wikiFetch(COMMONS_API, {
    action: 'query',
    generator: 'search',
    gsrsearch: searchTerm,
    gsrnamespace: '6',
    gsrlimit: '5',
    prop: 'imageinfo',
    iiprop: 'url',
    iiurlwidth: '400',
  });
  const pages = data.query?.pages ?? {};
  for (const page of Object.values(pages)) {
    const info = page.imageinfo?.[0];
    if (info?.url && !/\.svg$/i.test(info.url)) return info.url;
  }
  return null;
}

async function musicbrainzCover(query) {
  const searchUrl = `${MB_API}/artist/?query=${encodeURIComponent(query)}&fmt=json&limit=5`;
  const res = await fetch(searchUrl, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const artist = data.artists?.[0];
  if (!artist?.id) return null;

  await delay(1100);
  const releaseRes = await fetch(
    `${MB_API}/release?artist=${artist.id}&fmt=json&limit=1&inc=release-groups`,
    { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } }
  );
  if (!releaseRes.ok) return null;
  const releaseData = await releaseRes.json();
  const release = releaseData.releases?.[0];
  if (!release?.id) return null;

  const coverRes = await fetch(`https://coverartarchive.org/release/${release.id}/front`, {
    headers: { 'User-Agent': USER_AGENT },
    redirect: 'follow',
  });
  if (!coverRes.ok) return null;
  return coverRes.url;
}

function scoreTitleMatch(title, terms) {
  const t = title.toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (t.includes(term.toLowerCase())) score += 2;
  }
  return score;
}

async function searchWikipediaTitle(query) {
  const data = await wikiFetch(WIKI_API, {
    action: 'query',
    list: 'search',
    srsearch: query,
    srlimit: '5',
  });
  return data.query?.search?.[0]?.title ?? null;
}

async function fetchBandLogo(bandName) {
  const wikiBandTitle = await searchWikipediaTitle(`${bandName} (band)`);
  if (wikiBandTitle) {
    const img = await wikipediaPageImage(wikiBandTitle);
    if (img) return { url: img, source: 'wikipedia', status: 'ok' };
  }

  const wikiAlt = await searchWikipediaTitle(`${bandName} band`);
  if (wikiAlt && wikiAlt !== wikiBandTitle) {
    const img = await wikipediaPageImage(wikiAlt);
    if (img) return { url: img, source: 'wikipedia', status: 'uncertain' };
  }

  const logoQueries = [
    `${bandName} logo`,
    `${bandName} band logo`,
    `filetype:bitmap ${bandName} logo`,
  ];

  for (const q of logoQueries) {
    const commons = await commonsSearchImage(q);
    if (commons) return { url: commons, source: 'wikimedia', status: 'ok' };
    await delay(200);
  }

  await delay(1100);
  const cover = await musicbrainzCover(`artist:"${bandName}"`);
  if (cover) return { url: cover, source: 'musicbrainz', status: 'uncertain' };

  return { url: null, source: null, status: 'missing' };
}

async function fetchMusicianPhoto(name, bandName) {
  const queries = [
    `${name} ${bandName}`,
    `${name} musician`,
    name,
  ];

  for (const q of queries) {
    const wikiTitle = await searchWikipediaTitle(q);
    if (wikiTitle) {
      const terms = [name.split(' ')[0], bandName.split(' ')[0]].filter(Boolean);
      const matchScore = scoreTitleMatch(wikiTitle, terms);
      const img = await wikipediaPageImage(wikiTitle);
      if (img) {
        return {
          url: img,
          source: 'wikipedia',
          status: matchScore >= 2 ? 'ok' : 'uncertain',
        };
      }
    }
    await delay(120);
  }

  const commons = await commonsSearchImage(`${name} ${bandName}`);
  if (commons) return { url: commons, source: 'wikimedia', status: 'uncertain' };

  return { url: null, source: null, status: 'missing' };
}

module.exports = {
  fetchBandLogo,
  fetchMusicianPhoto,
  delay,
};
