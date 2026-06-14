import './styles.css';
import { VERSION_LABEL, WHEEL_BUILD } from './version.js';
import musiciansData from '@data/raw/musicians.json';
import bandsData from '@data/raw/bands.json';
import { SLOTS, SLOT_LABELS } from './genres.js';
import {
  createGame,
  createDailyGame,
  activeBands,
  currentSpin,
  getPool,
  openSlots,
  canRerollBand,
  rerollBand,
  assignPick,
  submitGame,
  resetGame,
  setWheelReady,
  setReelLandingWindow,
  spinReelStrip,
  getSlotForReel,
  getOpenSlots,
  ROUND_COUNT,
} from './game.js';
import { evaluateLineup } from './scoring.js';
import {
  RANK_ORDER,
  goalStatus,
  rankFromScore,
  rankLabel,
} from './ranks.js';
import { getSlotRating } from './slot-ratings.js';
import { fetchAlbumMetadata, fetchAlbumMedia, fetchAlbumAudio, ensureAlbumApiReady, buildAlbumContext, localAlbumFallback, isStaleAlbumApiError, staleAlbumApiMessage, describeBand, formatAlbumError } from './album-api.js';
import { formatMusicianName } from './musician-display.js';
import { renderMemberCard } from './member-card.js';
import { renderSlotMachineHTML, animateReelSpin, buildLandingWindow } from './band-wheel.js';
import { renderRosterPage, bindRosterEvents } from './roster.js';
import { renderHelpPage, bindHelpEvents } from './help.js';
import { openShareModal } from './share-results.js';
import { renderMediaEditorPage, bindMediaEditorEvents, readCompletedBands } from './media-editor.js';
import {
  isMediaEditorUnlocked,
  renderMediaEditorGateHTML,
  bindMediaEditorGateEvents,
} from './media-editor-auth.js';
import {
  fetchMediaOverrides,
  patchMediaOverrides,
  uploadMediaImage,
  pasteFromSystemClipboard,
  isMediaApiAvailable,
  isRosterApiAvailable,
} from './media-overrides-api.js';
import { addRosterMember, removeRosterMember, setBandHidden, deleteBand } from './roster-api.js';
import { fetchDailyPuzzle } from './daily-api.js';

const app = document.getElementById('app');
let game = null;
let view = 'landing';
let resultsRevealId = 0;
let isAssigning = false;
let wheelAnimating = false;
let pendingRespin = false;
let mediaOverrides = { bands: {}, musicians: {} };
let mediaApiAvailable = false;
let rosterApiAvailable = false;
let mediaEditorReady = false;
let mediaEditorSearchQuery = '';
let mediaEditorShowHiddenOnly = false;
let mediaEditorFlash = null;
const MEDIA_EDITOR_VIEW_KEY = 'sg-media-editor';

const musicianById = new Map(musiciansData.musicians.map((m) => [m.id, m]));
const musicians = musiciansData.musicians;
const bands = bandsData.bands;

const RESULTS_CARD_GAP_MS = 800;
const RESULTS_SCORE_COUNT_MS = 2400;
const RESULTS_ROW_STAGGER_MS = 110;

document.title = `Supergroup ${VERSION_LABEL}`;

const versionBadge = document.createElement('div');
versionBadge.className = 'version-badge';
versionBadge.textContent = `${VERSION_LABEL} · ${WHEEL_BUILD}`;
versionBadge.setAttribute('aria-label', `Supergroup ${VERSION_LABEL} wheel ${WHEEL_BUILD}`);
document.body.appendChild(versionBadge);

function renderMusicianCard(m) {
  const roleButtons = openSlots(game, m).map((slot) => ({
    slot,
    label: SLOT_LABELS[slot],
  }));
  return renderMemberCard(m, { roleButtons });
}

function renderLanding() {
  app.innerHTML = `
    <div class="landing">
      <h1 class="landing__title">SUPERGROUP</h1>
      <p class="landing__tagline">
        Five band spins. Five slots. One dream supergroup. Hit #1, sell out every show, and earn three five-star reviews.
      </p>
      <div class="landing__modes">
        <div class="mode-card" data-mode="daily">
          <h3>Daily</h3>
          <p>Same five band spins for everyone today. Compare your lineup.</p>
        </div>
        <div class="mode-card" data-mode="practice">
          <h3>Practice</h3>
          <p>Random band spins anytime. Learn the roster and test lineups.</p>
        </div>
      </div>
      <button class="btn-ghost landing__roster" id="browse-roster">Browse roster (${activeBands(bands).length} bands)</button>
      <button class="btn-ghost landing__roster" id="help-btn">How scoring works</button>
      <button class="btn-ghost landing__roster" id="edit-media">Edit media URLs</button>
    </div>
  `;

  app.querySelectorAll('.mode-card').forEach((el) => {
    el.addEventListener('click', async () => {
      view = 'game';
      pendingRespin = false;
      wheelAnimating = false;

      if (el.dataset.mode === 'daily') {
        try {
          const daily = await fetchDailyPuzzle();
          game = createDailyGame(musicians, bands, daily);
        } catch {
          game = createGame(musicians, bands, 'daily');
        }
      } else {
        game = createGame(musicians, bands, el.dataset.mode);
      }

      render();
    });
  });

  document.getElementById('browse-roster')?.addEventListener('click', () => {
    view = 'roster';
    render();
  });

  document.getElementById('help-btn')?.addEventListener('click', () => {
    view = 'help';
    render();
  });

  document.getElementById('edit-media')?.addEventListener('click', () => {
    tryOpenMediaEditor();
  });
}

function tryOpenMediaEditor() {
  if (!isMediaEditorUnlocked()) {
    view = 'media-editor-gate';
    render();
    return;
  }
  openMediaEditor();
}

function renderMediaEditorGate() {
  app.innerHTML = renderMediaEditorGateHTML();
  bindMediaEditorGateEvents({
    onUnlock: openMediaEditor,
    onBack: () => {
      view = 'landing';
      render();
    },
  });
}

async function openMediaEditor() {
  view = 'media-editor';
  sessionStorage.setItem(MEDIA_EDITOR_VIEW_KEY, '1');
  mediaEditorReady = false;
  render();
  mediaApiAvailable = await isMediaApiAvailable();
  rosterApiAvailable = await isRosterApiAvailable();
  try {
    mediaOverrides = await fetchMediaOverrides();
  } catch {
    mediaOverrides = { bands: {}, musicians: {} };
  }
  mediaEditorReady = true;
  renderMediaEditorView();
}

function leaveMediaEditor() {
  sessionStorage.removeItem(MEDIA_EDITOR_VIEW_KEY);
  view = 'landing';
  render();
}

async function handleMediaPatch(patch) {
  applyMediaResult(await patchMediaOverrides(patch));
}

async function handleMediaUpload(payload) {
  applyMediaResult(await uploadMediaImage(payload));
}

async function handleMediaPasteFromClipboard({ kind, key }) {
  applyMediaResult(await pasteFromSystemClipboard({ kind, key }), {
    message: 'Image pasted and saved.',
    type: 'ok',
  });
}

function applyRosterResult(result, flash = null) {
  bands.length = 0;
  bands.push(...(result.bands ?? []));
  musicians.length = 0;
  musicians.push(...(result.musicians ?? []));
  musicianById.clear();
  for (const musician of musicians) {
    musicianById.set(musician.id, musician);
  }
  if (flash) mediaEditorFlash = flash;
  if (view === 'media-editor') {
    renderMediaEditorView();
    return;
  }
  render();
}

async function handleRosterAddMember(payload) {
  applyRosterResult(await addRosterMember(payload), {
    message: 'Member added and roster rebuilt.',
    type: 'ok',
  });
}

async function handleRosterRemoveMember(payload) {
  applyRosterResult(await removeRosterMember(payload), {
    message: 'Member removed and roster rebuilt.',
    type: 'ok',
  });
}

async function handleBandVisibility(payload) {
  applyRosterResult(await setBandHidden(payload), {
    message: payload.hidden ? 'Band hidden from reel.' : 'Band visible on reel again.',
    type: 'ok',
  });
}

async function handleBandDelete(payload) {
  applyRosterResult(await deleteBand(payload), {
    message: 'Band deleted from roster.',
    type: 'ok',
  });
}

function applyMediaResult(result, flash = null) {
  mediaOverrides = result.overrides;
  for (const band of result.bands ?? []) {
    const index = bands.findIndex((b) => b.key === band.key);
    if (index >= 0) Object.assign(bands[index], band);
  }
  for (const musician of result.musicians ?? []) {
    musicianById.set(musician.id, musician);
  }
  if (flash) mediaEditorFlash = flash;
  if (view === 'media-editor') {
    renderMediaEditorView();
    return;
  }
  render();
}

function renderMediaEditorView() {
  const scrollY = window.scrollY;
  const searchInput = document.getElementById('media-editor-search');
  const showHiddenInput = document.getElementById('media-editor-show-hidden');
  if (searchInput) mediaEditorSearchQuery = searchInput.value;
  if (showHiddenInput) mediaEditorShowHiddenOnly = showHiddenInput.checked;

  app.innerHTML = renderMediaEditorPage({
    bands,
    musicianById,
    overrides: mediaOverrides,
    apiAvailable: mediaApiAvailable,
    rosterApiAvailable,
    completedBands: readCompletedBands(),
  });
  bindMediaEditorEvents({
    onBack: leaveMediaEditor,
    onSave: handleMediaPatch,
    onUpload: handleMediaUpload,
    onPasteFromClipboard: handleMediaPasteFromClipboard,
    onAddMember: handleRosterAddMember,
    onRemoveMember: handleRosterRemoveMember,
    onBandVisibility: handleBandVisibility,
    onDeleteBand: handleBandDelete,
    onCompletedChange: renderMediaEditorView,
    apiAvailable: mediaApiAvailable,
    rosterApiAvailable,
    flash: mediaEditorFlash,
  });
  mediaEditorFlash = null;

  const search = document.getElementById('media-editor-search');
  const showHidden = document.getElementById('media-editor-show-hidden');
  if (search) {
    search.value = mediaEditorSearchQuery;
    if (mediaEditorSearchQuery || mediaEditorShowHiddenOnly) {
      search.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
  if (showHidden) {
    showHidden.checked = mediaEditorShowHiddenOnly;
    if (mediaEditorShowHiddenOnly) {
      showHidden.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
  window.scrollTo(0, scrollY);
}

function renderSlotForReel(game, reelIndex) {
  const slotInfo = getSlotForReel(game, reelIndex);

  if (slotInfo?.kind === 'filled') {
    return `<div class="slot-reel__pick">${renderMemberCard(slotInfo.musician, { hideRole: true })}</div>`;
  }

  return '<div class="band-slot band-slot--blank"></div>';
}

function renderUnfilledRoles() {
  const openSlots = getOpenSlots(game);
  if (openSlots.length === 0) return '';

  return `
    <div class="open-roles" role="status" aria-label="Unfilled roles">
      ${openSlots
        .map(
          (slot) => `
        <span class="open-role">${SLOT_LABELS[slot]}</span>`
        )
        .join('')}
    </div>`;
}

function renderRoundProgress() {
  return Array.from({ length: ROUND_COUNT }, (_, i) => {
    let cls = 'round-dot';
    if (i < game.round) cls += ' round-dot--done';
    else if (i === game.round && game.phase === 'playing') cls += ' round-dot--current';
    else if (i < game.round || game.phase !== 'playing') cls += ' round-dot--done';
    return `<div class="${cls}"></div>`;
  }).join('');
}

function renderPlaying() {
  const spin = currentSpin(game);
  if (!spin) {
    game.phase = 'review';
    renderReview();
    return;
  }

  const poolReady = game.wheelReady && !wheelAnimating;
  const pool = poolReady ? getPool(game) : [];
  const count = pool.length;
  const wheelHtml = renderSlotMachineHTML(game, renderSlotForReel);

  let poolSection = '';
  if (!poolReady) {
    poolSection = `
      <div class="empty-pool">
        <p>${wheelAnimating ? 'Spinning…' : 'Spin the active reel to reveal your band.'}</p>
      </div>`;
  } else if (count === 0) {
    poolSection = `
      <div class="empty-pool">
        <p>No musicians left in ${spin.bandName}. Try another band or use a reroll.</p>
      </div>`;
  } else {
    poolSection = `
      <div class="pool-header">
        <h2>Pick from ${spin.bandName}</h2>
      </div>
      ${renderUnfilledRoles()}
      <div class="pool-grid">
        ${pool.map(renderMusicianCard).join('')}
      </div>`;
  }

  app.innerHTML = `
    <div class="game-header">
      <div>
        <h1 class="game-header__title">SUPERGROUP</h1>
        <div class="game-header__meta">${game.mode === 'daily' ? `Daily challenge${game.puzzleDate ? ` · ${game.puzzleDate} UTC` : ''}` : 'Practice'} · Round ${Math.min(game.round + 1, 5)} of 5</div>
      </div>
      <button class="btn-secondary" id="quit-btn">Quit</button>
    </div>

    <div class="round-progress">${renderRoundProgress()}</div>

    ${wheelHtml}
    ${poolSection}
  `;

  bindPlayingEvents();

  if (pendingRespin && !wheelAnimating && !game.wheelReady) {
    pendingRespin = false;
    startActiveReelSpin();
  }
}

function startActiveReelSpin() {
  const reelIndex = game.round;
  const column = document.querySelector(`.slot-reel[data-reel="${reelIndex}"]`);
  if (!column) return;

  wheelAnimating = true;
  const strip = spinReelStrip(game, reelIndex);
  const targetSpin = game.spins[reelIndex];

  animateReelSpin(column, strip, targetSpin, (landingWindow) => {
    setReelLandingWindow(game, reelIndex, landingWindow ?? buildLandingWindow(strip));
    wheelAnimating = false;
    setWheelReady(game, true);
    render();
  });
}

function bindPlayingEvents() {
  document.getElementById('quit-btn')?.addEventListener('click', () => {
    game = null;
    pendingRespin = false;
    wheelAnimating = false;
    view = 'landing';
    renderLanding();
  });

  app.querySelectorAll('[data-reel-spin]').forEach((el) => {
    el.addEventListener('click', () => {
      const reelIndex = Number(el.dataset.reelSpin);
      if (reelIndex !== game.round || wheelAnimating) return;

      if (canRerollBand(game)) {
        rerollBand(game);
        pendingRespin = true;
        render();
        return;
      }

      if (game.wheelReady) return;
      startActiveReelSpin();
    });
  });

  app.querySelectorAll('[data-assign-musician]').forEach((el) => {
    el.addEventListener('click', (event) => {
      event.stopPropagation();
      if (isAssigning) return;
      const m = musicianById.get(el.dataset.assignMusician);
      const slot = el.dataset.assignSlot;
      if (!m || !slot) return;
      isAssigning = true;
      try {
        assignPick(game, m, slot);
        if (game.phase === 'playing') {
          pendingRespin = true;
        }
        render();
      } finally {
        isAssigning = false;
      }
    });
  });
}

function renderReview() {
  window.scrollTo(0, 0);
  app.innerHTML = `
    <div class="game-header">
      <div>
        <h1 class="game-header__title">SUPERGROUP</h1>
        <div class="game-header__meta">Review your lineup</div>
      </div>
    </div>

    <div class="review-panel">
      <h2>Your dream band</h2>
      <div class="review-lineup">
        ${SLOTS.map((slot) => {
          const m = game.lineup[slot];
          const rating = m ? getSlotRating(m, slot) : null;
          return `
            <div class="review-row">
              <span>${SLOT_LABELS[slot]}</span>
              <span>${m ? formatMusicianName(m) : '—'}</span>
              <span>${rating ?? '—'}</span>
            </div>`;
        }).join('')}
      </div>
      <div class="actions-row">
        <button class="btn-primary" id="submit-btn">Submit & simulate</button>
        <button class="btn-secondary" id="quit-btn">Quit</button>
      </div>
    </div>
  `;

  document.getElementById('submit-btn').addEventListener('click', () => {
    submitGame(game, evaluateLineup);
    render();
  });

  document.getElementById('quit-btn').addEventListener('click', () => {
    game = null;
    renderLanding();
  });
}

function renderGoalCard(goalKey, goal, revealClass) {
  return `
      <div class="goal-card goal-card--rank-F results-reveal ${revealClass}" data-goal="${goalKey}" data-score="${goal.score}">
        <div class="goal-card__rank" aria-hidden="true">F</div>
        <div class="goal-card__title">${goalKey.charAt(0).toUpperCase() + goalKey.slice(1)}</div>
        <div class="goal-card__score">0<span class="goal-card__score-denom">/100</span></div>
        <div class="goal-card__status goal-card__status--hidden">${goal.status}</div>
      </div>`;
}

function goalRankForScore(score) {
  return rankFromScore(score);
}

function applyGoalCardRank(card, rank) {
  RANK_ORDER.forEach((r) => card.classList.remove(`goal-card--rank-${r}`));
  card.classList.add(`goal-card--rank-${rank}`);
  const badge = card.querySelector('.goal-card__rank');
  if (badge) badge.textContent = rank;
}

function finalizeGoalCard(card) {
  const goalKey = card.dataset.goal;
  const target = Number(card.dataset.score);
  const scoreEl = card.querySelector('.goal-card__score');
  const statusEl = card.querySelector('.goal-card__status');
  const finalRank = goalRankForScore(target);

  if (scoreEl?.firstChild) scoreEl.firstChild.textContent = String(target);
  applyGoalCardRank(card, finalRank);
  if (statusEl) {
    statusEl.textContent = goalStatus(goalKey, finalRank);
    statusEl.classList.remove('goal-card__status--hidden');
  }
}

function renderResults() {
  const r = game.results;
  const bandDescription = describeBand(
    game.picks.map((pick) => ({
      sourceBand: pick.spin.bandName,
    }))
  );
  const localAlbum = localAlbumFallback(game);

  app.innerHTML = `
    <div class="results-layout">
    <div class="results-hero results-reveal results-reveal--hero results-hero--rank-${r.grade}${r.supergroup ? ' results-hero--super' : ''}">
      <div class="results-hero__grade">${r.grade}</div>
      <div class="results-hero__label">${rankLabel(r.grade)}</div>
      ${r.supergroup ? '<p class="results-hero__crown">Triple crown achieved!</p>' : ''}
    </div>

    <div class="goals-grid">
      ${renderGoalCard('charts', r.goals.charts, 'results-reveal--charts')}
      ${renderGoalCard('tour', r.goals.tour, 'results-reveal--tour')}
      ${renderGoalCard('reviews', r.goals.reviews, 'results-reveal--reviews')}
    </div>

    <div class="breakdown results-reveal results-reveal--breakdown">
      <h3>Slot ratings</h3>
      ${r.breakdown
        .map(
          (row) => `
        <div class="breakdown-row">
          <span>${SLOT_LABELS[row.slot]}</span>
          <span>${row.name}</span>
          <span class="breakdown-row__band">${row.band ?? '—'}</span>
          <span>${row.rating ?? '—'}</span>
        </div>`
        )
        .join('')}
    </div>

    <div class="album-card" id="album-card">
      <div class="album-art" id="album-art">
        <span class="album-art__label">SG</span>
      </div>
      <div class="album-card__body">
        <p class="album-card__meta">${bandDescription}</p>
        <p class="album-card__band" id="album-band">${localAlbum.bandName}</p>
        <h3 id="album-title">${localAlbum.albumTitle}</h3>
        <ol class="album-tracks" id="album-tracks">
          ${localAlbum.tracks.map((track) => `<li>${track}</li>`).join('')}
        </ol>
        <div class="album-preview" id="album-preview">
          <p class="album-preview__hint">Generate AI album art, titles, and a 30s preview. Uses the Gemini API.</p>
          <button class="btn-primary album-preview__generate" id="album-generate" type="button">
            Generate album
          </button>
        </div>
      </div>
    </div>

    <div class="actions-row results-reveal results-reveal--actions">
      <button class="btn-primary" id="play-again">${game.mode === 'daily' ? 'Play again' : 'New game'}</button>
      <button class="btn-secondary" id="share-results">Download</button>
      <button class="btn-secondary" id="home-btn">Home</button>
    </div>
    </div>
  `;

  document.getElementById('play-again').addEventListener('click', () => {
    game = resetGame(game);
    render();
  });

  document.getElementById('home-btn')?.addEventListener('click', () => {
    game = null;
    renderLanding();
  });

  document.getElementById('share-results')?.addEventListener('click', () => {
    if (game?.results) openShareModal(game);
  });

  document.getElementById('album-generate')?.addEventListener('click', () => {
    const btn = document.getElementById('album-generate');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Generating…';
    }
    beginAlbumLoading(game);
  });

  runResultsReveal(game);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function animateGoalCardCountUp(card, target, duration = RESULTS_SCORE_COUNT_MS) {
  const scoreEl = card.querySelector('.goal-card__score');
  const statusEl = card.querySelector('.goal-card__status');

  statusEl?.classList.add('goal-card__status--hidden');

  return new Promise((resolve) => {
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - progress) ** 3;
      const value = Math.round(target * eased);

      if (scoreEl?.firstChild) scoreEl.firstChild.textContent = String(value);
      applyGoalCardRank(card, goalRankForScore(value));

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        finalizeGoalCard(card);
        resolve();
      }
    };
    requestAnimationFrame(tick);
  });
}

function revealElement(el) {
  if (!el) return;
  el.classList.add('results-reveal--visible');
}

function isResultsActive(activeGame, revealId) {
  return game === activeGame && game?.phase === 'results' && resultsRevealId === revealId;
}

async function revealGoalCard(card, revealId, activeGame) {
  if (!isResultsActive(activeGame, revealId)) return;

  revealElement(card);
  await delay(500);
  if (!isResultsActive(activeGame, revealId)) return;

  const scoreEl = card.querySelector('.goal-card__score');
  const target = Number(card.dataset.score);
  if (scoreEl?.firstChild) scoreEl.firstChild.textContent = '0';
  applyGoalCardRank(card, 'F');
  await animateGoalCardCountUp(card, target);
  if (!isResultsActive(activeGame, revealId)) return;

  await delay(RESULTS_CARD_GAP_MS);
}

async function revealBreakdownRows(breakdown, revealId, activeGame) {
  if (!breakdown || !isResultsActive(activeGame, revealId)) return;

  revealElement(breakdown);
  await delay(350);
  if (!isResultsActive(activeGame, revealId)) return;

  breakdown.classList.add('breakdown--revealed');
  const rows = breakdown.querySelectorAll('.breakdown-row');
  rows.forEach((row, index) => {
    row.style.transitionDelay = `${index * RESULTS_ROW_STAGGER_MS}ms`;
  });
  await delay(rows.length * RESULTS_ROW_STAGGER_MS + 450);
}

async function runResultsReveal(activeGame) {
  const revealId = ++resultsRevealId;
  const reducedMotion = prefersReducedMotion();

  const hero = document.querySelector('.results-reveal--hero');
  const goalCards = [
    document.querySelector('.results-reveal--charts'),
    document.querySelector('.results-reveal--tour'),
    document.querySelector('.results-reveal--reviews'),
  ];
  const breakdown = document.querySelector('.results-reveal--breakdown');
  const actions = document.querySelector('.results-reveal--actions');

  if (reducedMotion) {
    goalCards.forEach((card) => {
      if (!card) return;
      revealElement(card);
      finalizeGoalCard(card);
    });
    revealElement(hero);
    revealElement(breakdown);
    breakdown?.classList.add('breakdown--revealed');
    revealElement(actions);
    return;
  }

  for (const card of goalCards) {
    if (!card) continue;
    await revealGoalCard(card, revealId, activeGame);
  }

  if (!isResultsActive(activeGame, revealId)) return;

  revealElement(hero);
  await delay(900);
  if (!isResultsActive(activeGame, revealId)) return;

  await revealBreakdownRows(breakdown, revealId, activeGame);
  if (!isResultsActive(activeGame, revealId)) return;

  revealElement(actions);
}

function updateAlbumCard({ bandName, albumTitle, tracks }) {
  const bandEl = document.getElementById('album-band');
  const titleEl = document.getElementById('album-title');
  const tracksEl = document.getElementById('album-tracks');

  if (bandEl) bandEl.textContent = bandName;
  if (titleEl) titleEl.textContent = albumTitle;
  if (tracksEl) {
    tracksEl.innerHTML = tracks.map((track) => `<li>${track}</li>`).join('');
  }
}

function setAlbumArt(coverUrl) {
  const art = document.getElementById('album-art');
  if (!art) return;
  art.classList.remove('album-art--loading');
  art.innerHTML = `<img src="${coverUrl}" alt="Generated album cover" class="album-art__image" />`;
}

function setAlbumPreview({ audioUrl, message, isError = false, showRetry = false, onRetry = null }) {
  const preview = document.getElementById('album-preview');
  if (!preview) return;

  if (audioUrl) {
    preview.innerHTML = `
      <p class="album-preview__label">Album preview</p>
      <div class="album-preview__player-shell">
        <audio class="album-preview__player" controls preload="none" src="${audioUrl}">
          Your browser does not support audio playback.
        </audio>
      </div>`;
    return;
  }

  const retryButton = showRetry
    ? '<button class="btn-ghost album-preview__retry" id="album-retry" type="button">Retry generation</button>'
    : '';

  preview.innerHTML = `
    <p class="album-preview__status${isError ? ' album-preview__status--error' : ''}">${message}</p>
    ${retryButton}`;

  if (showRetry && onRetry) {
    document.getElementById('album-retry')?.addEventListener('click', onRetry);
  }
}

function beginAlbumLoading(activeGame) {
  const hasCover = Boolean(document.querySelector('.album-art__image'));
  const metadata = activeGame.results?.aiAlbum;
  if (hasCover && metadata) {
    return loadAlbumAudioOnly(activeGame, metadata);
  }

  const art = document.getElementById('album-art');
  if (art) {
    art.classList.add('album-art--loading');
    art.innerHTML = `
      <span class="album-art__spinner" aria-hidden="true"></span>
      <span class="album-art__label">SG</span>`;
  }

  updateAlbumCard({
    bandName: 'Naming your supergroup…',
    albumTitle: '…',
    tracks: ['Generating tracklist…'],
  });

  setAlbumPreview({
    message: 'Naming your supergroup…',
  });

  return loadAlbumAssets(activeGame);
}

function albumErrorMessage(err, assets = null) {
  if (err?.rateLimited) {
    return 'Gemini rate limit reached — wait about a minute, then retry.';
  }

  if (assets?.errors) {
    const parts = Object.values(assets.errors).filter(Boolean);
    if (parts.some((msg) => /429|too many requests|rate limit/i.test(msg))) {
      return 'Gemini rate limit reached — wait about a minute, then retry.';
    }
  }

  if (err?.configured === false) {
    return 'Set GEMINI_API_KEY in .env and run the API server to generate album art and preview audio.';
  }

  if (isStaleAlbumApiError(err)) {
    return staleAlbumApiMessage();
  }

  return err?.message || 'Could not generate album assets.';
}

async function loadAlbumAudioOnly(activeGame, metadata) {
  setAlbumPreview({ message: 'Generating 30s preview… This can take up to a minute.' });

  try {
    await ensureAlbumApiReady();
    const assets = await fetchAlbumAudio(buildAlbumContext(activeGame), metadata);
    if (game !== activeGame || game?.phase !== 'results') return;

    if (assets.audio?.dataUrl) {
      setAlbumPreview({ audioUrl: assets.audio.dataUrl });
    } else {
      setAlbumPreview({
        message: 'Preview unavailable. Try again in a minute.',
        isError: true,
        showRetry: true,
        onRetry: () => beginAlbumLoading(activeGame),
      });
    }
  } catch (err) {
    if (game !== activeGame || game?.phase !== 'results') return;

    setAlbumPreview({
      message: albumErrorMessage(err),
      isError: true,
      showRetry: err.rateLimited || err.configured !== false,
      onRetry: () => beginAlbumLoading(activeGame),
    });
  }
}

async function loadAlbumAssets(activeGame) {
  const context = buildAlbumContext(activeGame);

  try {
    await ensureAlbumApiReady();
    let metadata;

    try {
      metadata = await fetchAlbumMetadata(context);
      if (game !== activeGame || game?.phase !== 'results') return;

      updateAlbumCard({
        bandName: metadata.bandName,
        albumTitle: metadata.albumTitle,
        tracks: metadata.tracks,
      });

      activeGame.results.aiAlbum = metadata;

      setAlbumPreview({
        message: 'Generating cover art and 30s preview… This can take up to a minute.',
      });
    } catch (metaErr) {
      if (game !== activeGame || game?.phase !== 'results') return;

      if (metaErr.configured === false) {
        const fallback = localAlbumFallback(activeGame);
        updateAlbumCard(fallback);
        setAlbumPreview({
          message: albumErrorMessage(metaErr),
          isError: true,
        });
        const art = document.getElementById('album-art');
        if (art) art.classList.remove('album-art--loading');
        return;
      }

      if (isStaleAlbumApiError(metaErr)) {
        setAlbumPreview({
          message: metaErr.message ?? staleAlbumApiMessage(),
          isError: true,
          showRetry: true,
          onRetry: () => beginAlbumLoading(activeGame),
        });
        const art = document.getElementById('album-art');
        if (art) art.classList.remove('album-art--loading');
        return;
      }

      metadata = localAlbumFallback(activeGame);
      updateAlbumCard(metadata);
      setAlbumPreview({
        message: `Using fallback titles (${metaErr.message}). Generating cover and preview…`,
      });
    }

    const assets = await fetchAlbumMedia(context, metadata);
    if (game !== activeGame || game?.phase !== 'results') return;

    if (assets.cover?.dataUrl) {
      setAlbumArt(assets.cover.dataUrl);
    } else {
      const art = document.getElementById('album-art');
      if (art) {
        art.classList.remove('album-art--loading');
      }
    }

    if (assets.audio?.dataUrl) {
      setAlbumPreview({ audioUrl: assets.audio.dataUrl });
    } else if (assets.cover?.dataUrl) {
      const rateLimited = assets.rateLimited || /429|too many requests|rate limit/i.test(assets.errors?.audio ?? '');
      setAlbumPreview({
        message: rateLimited
          ? 'Cover ready. Preview hit the rate limit — wait a minute and retry.'
          : assets.errors?.audio
            ? `Cover ready. Preview unavailable: ${assets.errors.audio}`
            : 'Cover ready. Preview unavailable.',
        isError: true,
        showRetry: rateLimited,
        onRetry: () => beginAlbumLoading(activeGame),
      });
    } else {
      const rateLimited = assets.rateLimited || Object.values(assets.errors ?? {}).some((msg) =>
        /429|too many requests|rate limit/i.test(msg)
      );
      setAlbumPreview({
        message: albumErrorMessage({ rateLimited, message: formatAlbumError(assets, rateLimited ? 429 : 502) }, assets),
        isError: true,
        showRetry: true,
        onRetry: () => beginAlbumLoading(activeGame),
      });
    }
  } catch (err) {
    if (game !== activeGame || game?.phase !== 'results') return;

    const art = document.getElementById('album-art');
    if (art) art.classList.remove('album-art--loading');

    setAlbumPreview({
      message: albumErrorMessage(err, { errors: err.errors }),
      isError: true,
      showRetry: err.rateLimited || err.configured !== false,
      onRetry: () => beginAlbumLoading(activeGame),
    });
  }
}

function render() {
  if (view === 'roster') {
    app.innerHTML = renderRosterPage({ bands: activeBands(bands), musicianById });
    bindRosterEvents(
      () => {
        view = 'landing';
        render();
      },
      () => tryOpenMediaEditor()
    );
    return;
  }

  if (view === 'help') {
    app.innerHTML = renderHelpPage();
    bindHelpEvents(() => {
      view = 'landing';
      render();
    });
    return;
  }

  if (view === 'media-editor-gate') {
    renderMediaEditorGate();
    return;
  }

  if (view === 'media-editor') {
    if (!mediaEditorReady) {
      app.innerHTML =
        '<div class="roster-page"><p class="roster-page__intro">Loading media editor…</p></div>';
      return;
    }
    renderMediaEditorView();
    return;
  }

  if (!game) {
    renderLanding();
    return;
  }

  if (game.phase === 'playing' && game.round >= 5 && Object.keys(game.lineup).length >= 5) {
    game.phase = 'review';
  }

  if (game.phase === 'playing') renderPlaying();
  else if (game.phase === 'review') renderReview();
  else if (game.phase === 'results') renderResults();
}

if (sessionStorage.getItem(MEDIA_EDITOR_VIEW_KEY) === '1') {
  if (isMediaEditorUnlocked()) {
    openMediaEditor();
  } else {
    view = 'media-editor-gate';
    render();
  }
} else {
  render();
}
