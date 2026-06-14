import { SLOTS, SLOT_LABELS } from './genres.js';
import { formatMusicianName } from './musician-display.js';
import { mediaAssetUrl } from './media.js';
import { RANK_META, rankLabel } from './ranks.js';

const GOAL_KEYS = ['charts', 'tour', 'reviews'];

export function buildSharePayload(game) {
  const { results, mode } = game;
  const musicians = SLOTS.map((slot) => {
    const pick = game.picks.find((entry) => entry.slot === slot);
    if (!pick) return null;
    return {
      slot,
      slotLabel: (SLOT_LABELS[slot] ?? slot).toUpperCase(),
      name: formatMusicianName(pick.musician),
      imageUrl: pick.musician.imageUrl ?? null,
      bandLogoUrl: pick.spin.logoUrl ?? null,
      bandName: pick.spin.bandName ?? pick.musician.band ?? null,
    };
  }).filter(Boolean);

  return {
    mode: mode === 'daily' ? 'Daily' : 'Practice',
    grade: results.grade,
    gradeLabel: rankLabel(results.grade),
    supergroup: results.supergroup,
    goals: results.goals,
    breakdown: results.breakdown,
    musicians,
    url: `${window.location.origin}${window.location.pathname}`,
  };
}

function renderShareGoalCard(key, goal) {
  const title = key.charAt(0).toUpperCase() + key.slice(1);
  return `
    <div class="goal-card goal-card--rank-${goal.rank} share-card__goal">
      <div class="goal-card__rank">${goal.rank}</div>
      <div class="goal-card__title">${title}</div>
      <div class="goal-card__score">${goal.score}<span class="goal-card__score-denom">/100</span></div>
      <div class="goal-card__status">${goal.status}</div>
    </div>`;
}

function renderShareMusicianCard(member) {
  const logo = member.bandLogoUrl
    ? `<img src="${member.bandLogoUrl}" alt="" class="share-card__member-logo" loading="lazy" decoding="async" />`
    : `<span class="share-card__member-logo share-card__member-logo--fallback">${member.bandName ?? '—'}</span>`;
  const photo = member.imageUrl
    ? `<img src="${member.imageUrl}" alt="" class="share-card__member-photo" loading="lazy" decoding="async" />`
    : `<div class="share-card__member-photo share-card__member-photo--placeholder" aria-hidden="true"></div>`;

  return `
    <div class="share-card__member">
      <div class="share-card__member-role">${member.slotLabel}</div>
      <div class="share-card__member-card">
        ${logo}
        ${photo}
        <div class="share-card__member-name">${member.name}</div>
      </div>
    </div>`;
}

export function renderShareCardHTML(payload) {
  return `
    <div class="share-card results-hero--rank-${payload.grade}${payload.supergroup ? ' share-card--super' : ''}">
      <p class="share-card__mode">Supergroup · ${payload.mode}</p>
      <div class="share-card__lineup">
        ${payload.musicians.map((member) => renderShareMusicianCard(member)).join('')}
      </div>
      <div class="share-card__hero results-hero results-hero--rank-${payload.grade}${payload.supergroup ? ' results-hero--super' : ''}">
        <div class="results-hero__grade">${payload.grade}</div>
        <div class="results-hero__label">${payload.gradeLabel}</div>
        ${payload.supergroup ? '<p class="results-hero__crown">Triple crown achieved!</p>' : ''}
      </div>
      <div class="goals-grid share-card__goals">
        ${GOAL_KEYS.map((key) => renderShareGoalCard(key, payload.goals[key])).join('')}
      </div>
      <p class="share-card__url">${payload.url}</p>
    </div>`;
}

function wrapLines(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawRoundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function loadImage(url) {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = mediaAssetUrl(url);
  });
}

function drawImageCover(ctx, img, x, y, w, h, radius) {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (img.width - sw) / 2;
  const sy = (img.height - sh) / 2;

  ctx.save();
  drawRoundRect(ctx, x, y, w, h, radius);
  ctx.clip();
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  ctx.restore();
}

function drawImageContain(ctx, img, x, y, w, h) {
  const scale = Math.min(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function drawWrappedCenterText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  const lines = wrapLines(ctx, text, maxWidth).slice(0, maxLines);
  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight);
  });
  return lines.length;
}

async function preloadShareImages(musicians) {
  const entries = await Promise.all(
    musicians.map(async (member) => ({
      member,
      photo: await loadImage(member.imageUrl),
      logo: await loadImage(member.bandLogoUrl),
    }))
  );
  return entries;
}

function drawMusicianCards(ctx, payload, images, layout) {
  const { padding, cardGap, cardWidth, cardPad, logoHeight, photoSize, lineupY } = layout;
  const cardHeight = cardPad * 2 + logoHeight + 8 + photoSize + 8 + 44;

  images.forEach(({ member, photo, logo }, index) => {
    const cardX = padding + index * (cardWidth + cardGap);
    const roleY = lineupY + 14;

    ctx.fillStyle = '#ff4d8d';
    ctx.font = '400 11px "Bebas Neue", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(member.slotLabel, cardX + cardWidth / 2, roleY);

    const cardY = roleY + 10;
    drawRoundRect(ctx, cardX, cardY, cardWidth, cardHeight, 10);
    ctx.fillStyle = '#16121c';
    ctx.fill();

    const innerX = cardX + cardPad;
    const innerW = cardWidth - cardPad * 2;
    let cursorY = cardY + cardPad;

    if (logo) {
      drawImageContain(ctx, logo, innerX, cursorY, innerW, logoHeight);
    } else if (member.bandName) {
      ctx.fillStyle = '#9a8aa8';
      ctx.font = '500 9px "DM Sans", system-ui, sans-serif';
      drawWrappedCenterText(ctx, member.bandName, cardX + cardWidth / 2, cursorY + 12, innerW, 11, 2);
    }

    cursorY += logoHeight + 8;
    if (photo) {
      drawImageCover(ctx, photo, innerX, cursorY, innerW, photoSize, 8);
    } else {
      drawRoundRect(ctx, innerX, cursorY, innerW, photoSize, 8);
      ctx.fillStyle = '#2a2433';
      ctx.fill();
    }

    cursorY += photoSize + 10;
    ctx.fillStyle = '#f4eef8';
    ctx.font = '700 11px "DM Sans", system-ui, sans-serif';
    drawWrappedCenterText(ctx, member.name, cardX + cardWidth / 2, cursorY, innerW - 4, 13, 3);
  });

  return cardHeight + 24;
}

export async function renderShareImage(payload) {
  const width = 720;
  const height = 1280;
  const padding = 24;
  const cardGap = 6;
  const cardWidth = (width - padding * 2 - cardGap * 4) / 5;
  const cardPad = 8;
  const logoHeight = 22;
  const photoSize = cardWidth - cardPad * 2;
  const goalWidth = (width - padding * 2 - 16) / 3;
  const heroH = payload.supergroup ? 148 : 124;
  const goalsH = 132;
  const cardHeight = cardPad * 2 + logoHeight + 8 + photoSize + 8 + 44;
  const lineupHeight = cardHeight + 24;
  const contentHeight = lineupHeight + 8 + heroH + 20 + goalsH;
  const contentStartY = Math.max(58, Math.floor((height - contentHeight - 48) / 2));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const meta = RANK_META[payload.grade] ?? RANK_META.F;
  const rankColor = meta.color;
  const images = await preloadShareImages(payload.musicians ?? []);

  ctx.fillStyle = '#0c0a0f';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#9a8aa8';
  ctx.font = '500 13px "DM Sans", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`SUPERGROUP · ${payload.mode.toUpperCase()}`, width / 2, contentStartY - 16);

  const lineupY = contentStartY;
  drawMusicianCards(ctx, payload, images, {
    padding,
    cardGap,
    cardWidth,
    cardPad,
    logoHeight,
    photoSize,
    lineupY,
  });

  const heroY = lineupY + lineupHeight + 8;
  drawRoundRect(ctx, padding, heroY, width - padding * 2, heroH, 12);
  ctx.fillStyle = '#16121c';
  ctx.fill();
  ctx.strokeStyle = rankColor;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = rankColor;
  ctx.font = '400 72px "Bebas Neue", sans-serif';
  ctx.fillText(payload.grade, width / 2, heroY + 72);

  ctx.fillStyle = '#f4eef8';
  ctx.font = '600 20px "DM Sans", system-ui, sans-serif';
  ctx.fillText(payload.gradeLabel, width / 2, heroY + 102);

  if (payload.supergroup) {
    ctx.fillStyle = rankColor;
    ctx.font = '500 14px "DM Sans", system-ui, sans-serif';
    ctx.fillText('Triple crown achieved!', width / 2, heroY + 128);
  }

  const goalsY = heroY + heroH + 20;
  GOAL_KEYS.forEach((key, index) => {
    const goal = payload.goals[key];
    const goalMeta = RANK_META[goal.rank] ?? RANK_META.F;
    const x = padding + index * (goalWidth + 8);

    drawRoundRect(ctx, x, goalsY, goalWidth, goalsH, 12);
    ctx.fillStyle = '#16121c';
    ctx.fill();
    ctx.strokeStyle = goalMeta.color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x + goalWidth / 2, goalsY + 24, 14, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fill();
    ctx.fillStyle = goalMeta.color;
    ctx.font = '400 18px "Bebas Neue", sans-serif';
    ctx.fillText(goal.rank, x + goalWidth / 2, goalsY + 30);

    ctx.fillStyle = '#f4eef8';
    ctx.font = '400 16px "Bebas Neue", sans-serif';
    ctx.fillText(key.toUpperCase(), x + goalWidth / 2, goalsY + 58);

    ctx.font = '700 28px "DM Sans", system-ui, sans-serif';
    ctx.fillText(`${goal.score}/100`, x + goalWidth / 2, goalsY + 90);

    ctx.fillStyle = goalMeta.color;
    ctx.font = '500 11px "DM Sans", system-ui, sans-serif';
    const statusLines = wrapLines(ctx, goal.status, goalWidth - 16);
    statusLines.forEach((line, lineIndex) => {
      ctx.fillText(line, x + goalWidth / 2, goalsY + 112 + lineIndex * 14);
    });
  });

  ctx.fillStyle = '#9a8aa8';
  ctx.font = '500 12px "DM Sans", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(payload.url, width / 2, height - 28);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

export function openShareModal(game) {
  const payload = buildSharePayload(game);
  const existing = document.getElementById('share-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'share-modal';
  modal.className = 'share-modal';
  modal.innerHTML = `
    <div class="share-modal__backdrop" data-share-close></div>
    <div class="share-modal__panel" role="dialog" aria-labelledby="share-modal-title" aria-modal="true">
      <div class="share-modal__header">
        <h2 id="share-modal-title">Download results</h2>
        <button type="button" class="btn-ghost" data-share-close aria-label="Close">Close</button>
      </div>
      <div class="share-modal__preview" id="share-card-preview">
        ${renderShareCardHTML(payload)}
      </div>
      <div class="share-modal__actions">
        <button type="button" class="btn-primary" id="share-image">Download image</button>
      </div>
      <p class="share-modal__status" id="share-status" hidden></p>
    </div>`;

  document.body.appendChild(modal);
  document.body.classList.add('share-modal-open');

  const close = () => {
    modal.remove();
    document.body.classList.remove('share-modal-open');
  };

  const setStatus = (message, type = 'ok') => {
    const el = document.getElementById('share-status');
    if (!el) return;
    el.hidden = false;
    el.textContent = message;
    el.dataset.type = type;
  };

  modal.querySelectorAll('[data-share-close]').forEach((el) => {
    el.addEventListener('click', close);
  });

  document.getElementById('share-image')?.addEventListener('click', async () => {
    try {
      const blob = await renderShareImage(payload);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `supergroup-${payload.grade.toLowerCase()}.png`;
      link.click();
      URL.revokeObjectURL(url);
      setStatus('Image downloaded.');
    } catch {
      setStatus('Could not save image.', 'error');
    }
  });

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      close();
      document.removeEventListener('keydown', onKeyDown);
    }
  };
  document.addEventListener('keydown', onKeyDown);
}
