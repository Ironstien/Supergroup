import { renderMediaImage, mediaAssetUrl } from './media.js';
import { SLOT_LABELS } from './genres.js';
import { canRerollBand, getPickForRound, getReelLandingWindow, getWinnerStripIndex } from './game.js';
import { WHEEL_BUILD } from './version.js';
import { playTickClick } from './wheel-sounds.js';

const REEL_ITEM_PITCH = 56;
const VISIBLE_ITEMS = 5;
const SPIN_DURATION_MS = 10000;
const EDGE_SCALE = 0.5;
const CENTER_SCALE = 1.08;
const WINNER_ZOOM_SCALE = 2.45;
const PROXIMITY_RANGE = 2;
const ROUND_COUNT = 5;

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderReelItemContent(spin, { eager = false } = {}) {
  if (spin.logoUrl) {
    return renderMediaImage({
      url: spin.logoUrl,
      alt: `${spin.bandName} logo`,
      className: 'band-reel__logo',
      placeholderClass: 'band-reel__logo band-reel__logo--placeholder',
      loading: eager ? 'eager' : 'lazy',
    });
  }
  return `<span class="band-reel__fallback">${escapeHtml(spin.bandName)}</span>`;
}

function renderBlankItem() {
  return `
    <div class="band-reel__item band-reel__item--blank">
      <div class="band-reel__content">
        <div class="slot-reel__blank" aria-hidden="true"></div>
      </div>
    </div>`;
}

function renderReelItem(spin, index, { spinning = false } = {}) {
  return `
    <div class="band-reel__item${spinning ? ' band-reel__item--spin' : ''}" data-band-key="${spin.bandKey}" data-index="${index}">
      <div class="band-reel__content">${renderReelItemContent(spin, { eager: spinning })}</div>
    </div>`;
}

function preloadStripLogos(strip) {
  const loads = strip.map((spin) => {
    if (!spin.logoUrl) return Promise.resolve();
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.src = mediaAssetUrl(spin.logoUrl);
    });
  });
  return Promise.all(loads);
}

function renderBlankTrack() {
  return Array.from({ length: VISIBLE_ITEMS }, () => renderBlankItem()).join('');
}

function slotOffsetFromCenter(itemCenterY, centerY) {
  return (itemCenterY - centerY) / REEL_ITEM_PITCH;
}

function centerProximity(distance) {
  const t = Math.max(0, 1 - Math.abs(distance) / PROXIMITY_RANGE);
  return t * t;
}

function computeSlotPresentation(distance, { winnerZoom = false, zoomT = 1 } = {}) {
  const proximity = centerProximity(distance);
  const scale = EDGE_SCALE + (CENTER_SCALE - EDGE_SCALE) * proximity;
  const atCenter = Math.abs(distance) < 0.08;
  const finalScale =
    atCenter && winnerZoom
      ? CENTER_SCALE + zoomT * (WINNER_ZOOM_SCALE - CENTER_SCALE)
      : scale;
  const absDistance = Math.abs(distance);
  const opacity =
    atCenter && winnerZoom
      ? 1
      : absDistance >= 1.75
        ? 0.04
        : 0.1;
  const saturation =
    atCenter && winnerZoom
      ? 1
      : absDistance >= 1.75
        ? 0.22
        : 0.28;
  const zIndex = atCenter && winnerZoom ? 200 : Math.round(proximity * 100);

  return { scale: finalScale, opacity, saturation, zIndex };
}

function slotStyle(offset, options = {}) {
  return computeSlotPresentation(offset, options);
}

function renderWindowBand(spin, offset, { winnerZoom = false } = {}) {
  const { scale, opacity, saturation, zIndex } = slotStyle(offset, { winnerZoom });
  return `
    <div class="band-reel__item band-reel__item--window" data-band-key="${spin.bandKey}" data-offset="${offset}" style="z-index:${zIndex}">
      <div class="band-reel__content" style="transform:scale(${scale});opacity:${opacity};filter:saturate(${saturation})">
        ${renderReelItemContent(spin)}
      </div>
    </div>`;
}

function renderWindowBlank(offset) {
  return `
    <div class="band-reel__item band-reel__item--window band-reel__item--blank" data-offset="${offset}">
      <div class="band-reel__content">
        <div class="slot-reel__blank" aria-hidden="true"></div>
      </div>
    </div>`;
}

/** Five-band viewport: offsets -2..2 around the winner in the spin strip. */
export function buildLandingWindow(strip, winnerIndex = getWinnerStripIndex(strip)) {
  return [-2, -1, 0, 1, 2].map((offset) => {
    const idx = winnerIndex + offset;
    if (idx < 0 || idx >= strip.length) return null;
    return { ...strip[idx] };
  });
}

function renderLandingWindow(window) {
  return [-2, -1, 0, 1, 2]
    .map((offset, i) => {
      const spin = window[i];
      if (!spin) return renderWindowBlank(offset);
      return renderWindowBand(spin, offset, { winnerZoom: offset === 0 });
    })
    .join('');
}

function getReelStatus(game, reelIndex) {
  const pick = getPickForRound(game, reelIndex);
  if (pick) return 'done';
  if (reelIndex < game.round) return 'done';
  if (reelIndex > game.round) return 'locked';
  if (game.wheelReady) return 'landed';
  return 'blank';
}

function renderReelTrack(game, reelIndex) {
  const status = getReelStatus(game, reelIndex);
  const landing = getReelLandingWindow(game, reelIndex);

  if (status === 'blank' || status === 'locked') {
    return renderBlankTrack();
  }

  if ((status === 'done' || status === 'landed') && landing) {
    return `
      <div class="band-wheel__reel band-wheel__reel--settled-window">
        ${renderLandingWindow(landing)}
      </div>`;
  }

  return renderBlankTrack();
}

function renderReelLabel(game, reelIndex) {
  const pick = getPickForRound(game, reelIndex);
  if (pick) {
    return `<div class="slot-reel__label slot-reel__label--filled">${escapeHtml(SLOT_LABELS[pick.slot] ?? pick.slot)}</div>`;
  }
  return '<div class="slot-reel__label">—</div>';
}

function renderSpinButton(game, reelIndex) {
  const status = getReelStatus(game, reelIndex);
  const isCurrentRound = reelIndex === game.round;
  const canSpin = isCurrentRound && status === 'blank';
  const canReroll = isCurrentRound && status === 'landed' && canRerollBand(game);
  const isActive = canSpin || canReroll;
  const label = canReroll ? 'REROLL' : 'SPIN';
  const activeClass = canReroll
    ? ' slot-reel__spin--active slot-reel__spin--reroll'
    : canSpin
      ? ' slot-reel__spin--active'
      : '';

  return `
    <button
      type="button"
      class="slot-reel__spin${activeClass}"
      data-reel-spin="${reelIndex}"
      ${isActive ? '' : 'disabled'}
      aria-label="${canReroll ? `Reroll band for reel ${reelIndex + 1}` : isActive ? `Spin reel ${reelIndex + 1}` : `Reel ${reelIndex + 1} ${status}`}"
    >${label}</button>`;
}

function renderReelColumn(game, reelIndex, slotHtml = '') {
  const status = getReelStatus(game, reelIndex);
  return `
    <div class="slot-reel slot-reel--${status}" data-reel="${reelIndex}">
      <div class="slot-reel__viewport" id="slot-reel-viewport-${reelIndex}" style="--winner-zoom:${WINNER_ZOOM_SCALE}">
        <div class="band-wheel__fade band-wheel__fade--top" aria-hidden="true"></div>
        <div class="band-wheel__fade band-wheel__fade--bottom" aria-hidden="true"></div>
        <div class="slot-reel__track" id="slot-reel-track-${reelIndex}">
          ${renderReelTrack(game, reelIndex)}
        </div>
      </div>
      ${renderSpinButton(game, reelIndex)}
      ${renderReelLabel(game, reelIndex)}
      ${slotHtml ? `<div class="slot-reel__slot">${slotHtml}</div>` : ''}
    </div>`;
}

export function renderSlotMachineHTML(game, renderReelSlot) {
  const columns = Array.from({ length: ROUND_COUNT }, (_, i) =>
    renderReelColumn(game, i, renderReelSlot?.(game, i) ?? '')
  ).join('');
  return `
    <div class="slot-machine" data-wheel-build="${WHEEL_BUILD}" aria-live="polite">
      <div class="slot-machine__columns">
        ${columns}
      </div>
    </div>`;
}

function spinProgress(elapsed) {
  const t = Math.min(1, Math.max(0, elapsed / SPIN_DURATION_MS));
  return 1 - (1 - t) ** 4;
}

function getCenteredStripIndex(metrics, scrollY) {
  const { paddingTop, centerY } = metrics;
  return Math.floor(
    (scrollY + centerY - paddingTop - REEL_ITEM_PITCH / 2) / REEL_ITEM_PITCH
  );
}

function playCenterCrossingClicks(metrics, scrollY, lastCenteredIndex) {
  const centeredIndex = getCenteredStripIndex(metrics, scrollY);
  if (centeredIndex <= lastCenteredIndex) {
    return lastCenteredIndex;
  }

  for (let i = lastCenteredIndex + 1; i <= centeredIndex; i += 1) {
    playTickClick();
  }

  return centeredIndex;
}

function getViewportMetrics(viewport) {
  const height = viewport.clientHeight;
  const paddingTop = height / 2 - 2.5 * REEL_ITEM_PITCH;
  return { height, paddingTop, centerY: height / 2, viewportWidth: viewport.clientWidth };
}

function clampScaleToReelWidth(scale, content, viewportWidth) {
  if (!viewportWidth || !content) return scale;
  const baseWidth = content.offsetWidth;
  if (!baseWidth) return scale;
  const maxScale = (viewportWidth * 0.96) / baseWidth;
  return Math.min(scale, maxScale);
}

function applyItemTransforms(reel, metrics, scrollY, { spinning = false } = {}) {
  reel.querySelectorAll('.band-reel__item').forEach((item) => {
    const content = item.querySelector('.band-reel__content');
    if (!content) return;

    const { paddingTop, centerY } = metrics;
    const index = Number(item.dataset.index ?? 0);
    const itemCenterY = paddingTop + index * REEL_ITEM_PITCH + REEL_ITEM_PITCH / 2 - scrollY;
    const distance = slotOffsetFromCenter(itemCenterY, centerY);

    if (Math.abs(distance) <= PROXIMITY_RANGE + 0.35) {
      const { scale, opacity, saturation, zIndex } = computeSlotPresentation(distance);
      const clampedScale = clampScaleToReelWidth(scale, content, metrics.viewportWidth);
      item.style.zIndex = String(zIndex);
      content.style.transform = `scale(${clampedScale})`;
      content.style.opacity = spinning ? '1' : String(opacity);
      content.style.filter = spinning ? 'none' : `saturate(${saturation})`;
    } else {
      item.style.zIndex = '0';
      content.style.transform = 'scale(0.35)';
      content.style.opacity = spinning ? '0.35' : '0.1';
      content.style.filter = spinning ? 'none' : 'saturate(0.55)';
    }
  });
}

function setReelScroll(reel, metrics, scrollY, options = {}) {
  reel.style.paddingTop = `${metrics.paddingTop}px`;
  reel.style.transform = `translateY(-${scrollY}px)`;
  applyItemTransforms(reel, metrics, scrollY, options);
}

export function animateReelSpin(columnEl, strip, targetSpin, onComplete) {
  if (!columnEl) {
    onComplete?.();
    return;
  }

  if (prefersReducedMotion()) {
    onComplete?.();
    return;
  }

  const viewport = columnEl.querySelector('.slot-reel__viewport');
  const track = columnEl.querySelector('.slot-reel__track');
  if (!viewport || !track) {
    onComplete?.();
    return;
  }

  if (columnEl._spinCancel) {
    columnEl._spinCancel();
  }

  let cancelled = false;
  columnEl._spinCancel = () => {
    cancelled = true;
    columnEl.classList.remove('slot-reel--spinning');
  };

  columnEl.classList.add('slot-reel--spinning');

  track.innerHTML = `<div class="band-wheel__reel" id="slot-reel-anim">${strip.map((spin, i) => renderReelItem(spin, i, { spinning: true })).join('')}</div>`;
  const reel = track.querySelector('.band-wheel__reel');
  const metrics = getViewportMetrics(viewport);

  const winnerIndex = getWinnerStripIndex(strip);
  const targetScroll = metrics.paddingTop + winnerIndex * REEL_ITEM_PITCH + REEL_ITEM_PITCH / 2 - metrics.centerY;
  const startScroll = metrics.paddingTop + REEL_ITEM_PITCH / 2 - metrics.centerY;
  const spinTravel = targetScroll - startScroll;

  setReelScroll(reel, metrics, startScroll, { spinning: true });

  let lastCenteredIndex = getCenteredStripIndex(metrics, startScroll);

  function frame(now) {
    if (cancelled) return;

    const elapsed = now - start;
    const eased = spinProgress(elapsed);
    const scrollY = startScroll + spinTravel * eased;

    lastCenteredIndex = playCenterCrossingClicks(metrics, scrollY, lastCenteredIndex);

    setReelScroll(reel, metrics, scrollY, { spinning: true });

    if (elapsed < SPIN_DURATION_MS) {
      requestAnimationFrame(frame);
      return;
    }

    setReelScroll(reel, metrics, targetScroll, { spinning: true });
    columnEl._spinCancel = null;
    columnEl.classList.remove('slot-reel--spinning');

    const landingWindow = buildLandingWindow(strip, winnerIndex);
    track.innerHTML = `<div class="band-wheel__reel band-wheel__reel--settled-window">${renderLandingWindow(landingWindow)}</div>`;
    onComplete?.(landingWindow);
  }

  let start = 0;

  preloadStripLogos(strip).then(() => {
    if (cancelled) return;
    start = performance.now();
    requestAnimationFrame(frame);
  });
}

export const REEL_ITEM_HEIGHT = REEL_ITEM_PITCH;
export { REEL_ITEM_PITCH, VISIBLE_ITEMS };
