import { SLOT_LABELS } from './genres.js';
import { RANK_META, rankLabel } from './ranks.js';

const GOAL_KEYS = ['charts', 'tour', 'reviews'];

export function buildSharePayload(game) {
  const { results, mode } = game;
  return {
    mode: mode === 'daily' ? 'Daily' : 'Practice',
    grade: results.grade,
    gradeLabel: rankLabel(results.grade),
    supergroup: results.supergroup,
    goals: results.goals,
    breakdown: results.breakdown,
    url: `${window.location.origin}${window.location.pathname}`,
  };
}

export function formatShareText(payload) {
  const lines = [
    `Supergroup — ${payload.mode}`,
    `Grade: ${payload.grade} (${payload.gradeLabel})${payload.supergroup ? ' 👑 Triple crown!' : ''}`,
    '',
    ...GOAL_KEYS.map((key) => {
      const goal = payload.goals[key];
      const title = key.charAt(0).toUpperCase() + key.slice(1);
      return `${title.padEnd(8)} ${goal.rank}  ${goal.score}/100  ${goal.status}`;
    }),
    '',
    'Slot ratings',
    ...payload.breakdown.map((row) => {
      const slot = SLOT_LABELS[row.slot] ?? row.slot;
      const band = row.band ? ` (${row.band})` : '';
      return `${slot.padEnd(9)} ${row.name}${band}  ${row.rating ?? '—'}`;
    }),
    '',
    payload.url,
  ];
  return lines.join('\n');
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

export function renderShareCardHTML(payload) {
  return `
    <div class="share-card results-hero--rank-${payload.grade}${payload.supergroup ? ' share-card--super' : ''}">
      <p class="share-card__mode">Supergroup · ${payload.mode}</p>
      <div class="share-card__hero results-hero results-hero--rank-${payload.grade}${payload.supergroup ? ' results-hero--super' : ''}">
        <div class="results-hero__grade">${payload.grade}</div>
        <div class="results-hero__label">${payload.gradeLabel}</div>
        ${payload.supergroup ? '<p class="results-hero__crown">Triple crown achieved!</p>' : ''}
      </div>
      <div class="goals-grid share-card__goals">
        ${GOAL_KEYS.map((key) => renderShareGoalCard(key, payload.goals[key])).join('')}
      </div>
      <div class="breakdown share-card__breakdown">
        <h3>Slot ratings</h3>
        ${payload.breakdown
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

export async function renderShareImage(payload) {
  const width = 640;
  const padding = 28;
  const goalWidth = (width - padding * 2 - 16) / 3;
  const rowHeight = 34;
  const breakdownHeight = 44 + payload.breakdown.length * rowHeight;
  const height = 560 + breakdownHeight;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const meta = RANK_META[payload.grade] ?? RANK_META.F;
  const rankColor = meta.color;

  ctx.fillStyle = '#0c0a0f';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#9a8aa8';
  ctx.font = '500 14px "DM Sans", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`SUPERGROUP · ${payload.mode.toUpperCase()}`, width / 2, 36);

  const heroY = 52;
  const heroH = payload.supergroup ? 148 : 124;
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
    const cardH = 132;

    drawRoundRect(ctx, x, goalsY, goalWidth, cardH, 12);
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

  const breakdownY = goalsY + 152;
  drawRoundRect(ctx, padding, breakdownY, width - padding * 2, breakdownHeight, 12);
  ctx.fillStyle = '#16121c';
  ctx.fill();
  ctx.strokeStyle = '#2e2438';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#f4eef8';
  ctx.font = '400 22px "Bebas Neue", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('SLOT RATINGS', padding + 18, breakdownY + 30);

  payload.breakdown.forEach((row, index) => {
    const y = breakdownY + 54 + index * rowHeight;
    const slot = SLOT_LABELS[row.slot] ?? row.slot;
    ctx.fillStyle = '#f4eef8';
    ctx.font = '500 14px "DM Sans", system-ui, sans-serif';
    ctx.fillText(slot, padding + 18, y);

    ctx.fillText(row.name, padding + 108, y);

    ctx.fillStyle = '#7b5cff';
    ctx.font = '500 13px "DM Sans", system-ui, sans-serif';
    ctx.fillText(row.band ?? '—', padding + 280, y);

    ctx.fillStyle = '#f4eef8';
    ctx.font = '600 14px "DM Sans", system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(String(row.rating ?? '—'), width - padding - 18, y);
    ctx.textAlign = 'left';
  });

  ctx.fillStyle = '#9a8aa8';
  ctx.font = '500 12px "DM Sans", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(payload.url, width / 2, height - 18);

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
        <h2 id="share-modal-title">Share results</h2>
        <button type="button" class="btn-ghost" data-share-close aria-label="Close">Close</button>
      </div>
      <div class="share-modal__preview" id="share-card-preview">
        ${renderShareCardHTML(payload)}
      </div>
      <div class="share-modal__actions">
        <button type="button" class="btn-primary" id="share-copy">Copy text</button>
        <button type="button" class="btn-secondary" id="share-native">Share…</button>
        <button type="button" class="btn-secondary" id="share-image">Save image</button>
      </div>
      <p class="share-modal__status" id="share-status" hidden></p>
    </div>`;

  document.body.appendChild(modal);
  document.body.classList.add('share-modal-open');

  const text = formatShareText(payload);
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

  document.getElementById('share-copy')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Copied to clipboard.');
    } catch {
      setStatus('Could not copy — try Save image instead.', 'error');
    }
  });

  document.getElementById('share-native')?.addEventListener('click', async () => {
    try {
      const blob = await renderShareImage(payload);
      const file = new File([blob], 'supergroup-results.png', { type: 'image/png' });
      if (navigator.share?.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `Supergroup ${payload.grade}`,
          text,
          files: [file],
        });
        close();
        return;
      }
      if (navigator.share) {
        await navigator.share({
          title: `Supergroup ${payload.grade}`,
          text,
        });
        close();
        return;
      }
      await navigator.clipboard.writeText(text);
      setStatus('Sharing not supported here — copied text instead.');
    } catch (err) {
      if (err?.name !== 'AbortError') {
        setStatus('Share cancelled or unavailable.', 'error');
      }
    }
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
      setStatus('Image saved.');
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
