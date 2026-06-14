/**
 * Returns true if name is a band/group/duo (not an individual musician).
 */

const ALLOWLIST = new Set([
  'the edge',
  'the weeknd',
  'the notorious b.i.g.',
  'the blessed madonna',
  'the game',
  'the lonesome river band', // country group — block
].map((s) => s.toLowerCase()));

ALLOWLIST.delete('the lonesome river band');

/** Known groups — lowercase exact match */
const BLOCKLIST = new Set(
  [
    'run-dmc', 'run dmc', 'daft punk', 'sleep token', 'wet leg', 'n.w.a', 'wu-tang clan',
    'a tribe called quest', 'outkast', 'fugees', 'migos', 'bone thugs-n-harmony', 'gang starr',
    'the roots', 'mobb deep', 'de la soul', 'beastie boys', 'backstreet boys', 'spice girls',
    '*nsync', 'nsync', 'boyz ii men', 'tlc', 'en vogue', 'new edition', 'the pointer sisters',
    'the isley brothers', 'the judds', 'alabama', 'brooks & dunn', 'sugarland', 'old dominion',
    'the lumineers', 'mumford & sons', 'arcade fire', 'vampire weekend', 'the national',
    'foo fighters', 'radiohead', 'blur', 'oasis', 'the smashing pumpkins', 'stone temple pilots',
    'soundgarden', 'alice in chains', 'rage against the machine', 'nine inch nails',
    'the cranberries', 'the cure', 'the smiths', 'cocteau twins', 'sonic youth', 'pixies',
    'the replacements', 'talking heads', 'r.e.m.', 'faith no more', 'collective soul',
    'third eye blind', 'matchbox twenty', 'live', 'bush', 'weezer', 'the killers', 'the strokes',
    'the white stripes', 'interpol', 'the black keys', 'linkin park', 'imagine dragons',
    'twenty one pilots', 'the 1975', 'arctic monkeys', 'tame impala', 'big thief', 'boygenius',
    'idles', 'spiritbox', 'lorna shore', 'knocked loose', 'bad omens', 'turnstile', 'jinjer',
    'vulfpeck', 'parcels', 'chromeo', 'bicep', 'overmono', 'silk sonic', 'the chemical brothers',
    'the prodigy', 'massive attack', 'portishead', 'pet shop boys', 'depeche mode', 'new order',
    'eurythmics', 'wham!', 'earth, wind & fire', 'kool & the gang', 'parliament-funkadelic',
    'the gap band', 'the time', 'ohio players', 'war', 'soda stereo', 'mana', 'molotov',
    'cafe tacvba', 'aterciopelados', 'los lobos', 'aventura', 'wisin & yandel', 'calle 13',
    'soja', 'morgan heritage', 'steel pulse', 'black uhuru', 'third world',
    'toots and the maytals', 'the b-52s', 'the police', 'dire straits', 'inxs', 'heart',
    'foreigner', 'asia', 'survivor', 'reo speedwagon', 'judas priest', 'motorhead', 'megadeth',
    'anthrax', 'slayer', 'pantera', 'korn', 'deftones', 'tool', 'slipknot', 'mastodon',
    'avenged sevenfold', 'gojira', 'opeth', 'meshuggah', 'dream theater', 'the offspring',
    'blink-182', 'sum 41', 'good charlotte', 'simple plan', 'alkaline trio', 'rise against',
    'rancid', 'nofx', 'refused', 'the used', 'my chemical romance', 'paramore', 'evanescence',
    'shinedown', 'muse', 'placebo', 'suede', 'the verve', 'manic street preachers', 'garbage',
    'hole', 'pavement', 'modest mouse', 'built to spill', 'neutral milk hotel',
    'belle and sebastian', 'sleater-kinney', 'yo la tengo', 'the shins', 'the xx', 'grizzly bear',
    'broken social scene', 'franz ferdinand', 'mgmt', 'phoenix', 'yeah yeah yeahs', 'tv on the radio',
    'fleet foxes', 'bon iver', 'iron & wine', 'the tallest man on earth', 'the head and the heart',
    'the indigo girls', 'the wallflowers', 'the menzingers', 'the wonder years', 'against me!',
    'the story so far', 'neck deep', 'the chats', 'amyl and the sniffers', 'destroy boys',
    'drug church', 'viagra boys', 'fontaines d.c.', 'the last dinner party', 'maneskin', 'måneskin',
    'pale waves', 'the warning', 'nova twins', 'mammoth wvh', 'the linda lindas', 'the beths',
    'black country, new road', 'the smile', 'slow pulp', 'horsegirl', 'porridge radio',
    'soccer mommy', 'hollow coves', 'bonny light horseman', 'the teskey brothers',
    'yahritza y su esencia', 'the fearless flyers', 'butcher brown',
    'sharon jones & the dap-kings', 'medeski martin & wood', 'tower of power', 'daptone horns',
    'the neptunes', 'hall & oates', 'chaka demus & pliers', 'angus & julia stone', 'the staves',
    'first aid kit', 'band of skulls', 'nothing but thieves', 'catfish and the bottlemen',
    'wolf alice', 'foals', 'royal blood', 'greta van fleet', 'highly suspect', 'the pretty reckless',
    'the war on drugs', 'alt-j', 'of monsters and men', 'glass animals', 'chvrches', 'biffy clyro',
    'young the giant', 'bastille', 'the neighbourhood', 'the raconteurs', 'silversun pickups',
    'the kooks', 'kasabian', '30 seconds to mars', 'the fray', 'snow patrol', 'keane', 'daughtry',
    'wolfmother', 'jet', 'the ataris', 'the bouncing souls', 'new found glory', 'billy talent',
    'the distillers', 'anti-flag', 'the mighty mighty bosstones', 'goldfinger', 'operation ivy',
    'jawbreaker', 'propagandhi', 'the flatliners', 'polar bear club', 'direct hit!',
    'masked intruder', 'tigers jaw', 'trash boat', 'pup', 'the feelies', 'galaxie 500',
    'dinosaur jr.', 'throwing muses', 'violent femmes', 'echo & the bunnymen',
    'the jesus and mary chain', 'siouxsie and the banshees', 'xtc', 'the psychedelic furs',
    'the church', 'midnight oil', 'the chameleons', "jane's addiction", 'the damned',
    'the buzzcocks', 'social distortion', 'bad brains', 'circle jerks', 'the exploited',
    'dead kennedys', 'bad religion', 'black flag', 'minor threat', 'misfits', 'descendents',
    'the brand new heavies', 'digable planets', 'incognito', 'lettuce', 'breakestra',
    'the new mastersounds', 'fishbone', 'jam bandits', 'above & beyond', 'hot chip',
    'basement jaxx', 'mstrkrft', 'justice', 'the orb', 'faithless', 'autechre', 'orbital',
    'underworld', 'art of noise', 'cabaret voltaire', 'tangerine dream', 'yazoo', 'omd',
    'moby', 'fatboy slim', 'tricky', 'aphex twin', 'burial', 'deadmau5', 'illenium',
    'marshmello', 'kygo', 'martin garrix', 'kaskade', 'odesza', 'disclosure', 'flume',
    'madeon', 'porter robinson', 'four tet', 'anyma', 'peggy gou', 'mochakk', 'kokoroko',
    'bring me the horizon', 'architects', 'periphery', 'tesseract', 'baroness', 'power trip',
    'code orange', 'deafheaven', 'behemoth', 'orbit culture', 'avatar', 'men i trust', 'wallows',
    'girl in red', 'english teacher', 'wednesday', 'alvvays', 'yard act', 'teen mortgage',
    'pinkshift', 'sprints', 'scowl', 'bob vylan', 'militarie gun', 'eric b. & rakim',
    'salt-n-pepa', 'grandmaster flash', 'afrika bambaataa', 'n.w.a', 'public enemy',
    'simon & garfunkel', 'gentleman', 'stick figure', 'rebelution', 'the internet',
  ].map((s) => s.toLowerCase())
);

function normalizeName(name) {
  return String(name).trim().toLowerCase();
}

function isBandOrGroup(name) {
  const n = normalizeName(name);
  if (ALLOWLIST.has(n)) return false;
  if (BLOCKLIST.has(n)) return true;

  // "The …" — treat as group unless allowlisted
  if (/^the /i.test(name) && !ALLOWLIST.has(n)) return true;

  // Duos / collaborations
  if (/\s&\s|\s\+\s/.test(name)) return true;
  if (/\s and the \s/i.test(name)) return true;
  if (/\s y su \s/i.test(name)) return true;

  // Explicit group words
  if (/\b(orchest|ensemble|quartet|collective)\b/i.test(name)) return true;

  return false;
}

module.exports = { isBandOrGroup, BLOCKLIST, ALLOWLIST };
