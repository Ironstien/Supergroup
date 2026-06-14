import { SLOT_LABELS, INSTRUMENT_SLOTS } from './genres.js';
import { formatMusicianName } from './musician-display.js';
import { renderMediaImage } from './media.js';

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

export function memberRoleLabel(musician) {
  return musician.eligibleSlots
    .filter((s) => INSTRUMENT_SLOTS.includes(s))
    .map((s) => SLOT_LABELS[s])
    .join(' · ');
}

export function renderMemberStats(stats) {
  const keys = ['vox', 'play', 'groove', 'star', 'desk'];
  const labels = ['VOX', 'PLAY', 'GROOVE', 'STAR', 'DESK'];
  return keys
    .map(
      (k, i) => `
    <div class="member-stat">
      <div class="member-stat__label">${labels[i]}</div>
      <div class="member-stat__value">${stats[k]}</div>
    </div>`
    )
    .join('');
}

/**
 * @param {object} musician
 * @param {{ selected?: boolean, pickable?: boolean, uncertain?: boolean, copyLabel?: string | null, copyTitle?: string, roleButtons?: Array<{ slot: string, label: string }>, hideRole?: boolean }} [options]
 */
export function renderMemberCard(
  musician,
  { selected = false, pickable = false, uncertain = false, copyLabel = null, copyTitle = 'Copy search label', roleButtons = null, hideRole = false } = {}
) {
  const photo = renderMediaImage({
    url: musician.imageUrl,
    alt: musician.name,
    className: 'member-card__photo',
    placeholderClass: 'member-card__photo member-card__photo--placeholder',
  });
  const role = memberRoleLabel(musician);
  const roleHtml = hideRole
    ? ''
    : roleButtons !== null
      ? roleButtons.length
        ? `<div class="member-card__roles" role="group" aria-label="Assign ${escapeAttr(formatMusicianName(musician))}">
            ${roleButtons
              .map(
                ({ slot, label }) => `
              <button
                type="button"
                class="member-card__role-btn"
                data-assign-musician="${escapeAttr(musician.id)}"
                data-assign-slot="${escapeAttr(slot)}"
              >${label}</button>`
              )
              .join('')}
          </div>`
        : '<div class="member-card__role">—</div>'
      : `<div class="member-card__role">${role || '—'}</div>`;
  const classes = [
    'member-card',
    pickable ? 'member-card--pickable' : '',
    selected ? 'member-card--selected' : '',
    uncertain ? 'member-card--uncertain' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const tag = pickable ? 'div' : 'article';
  const dataAttr = pickable ? ` data-id="${musician.id}"` : '';
  const nameHtml = copyLabel
    ? `<div class="member-card__name-row">
        <div class="member-card__name">${formatMusicianName(musician)}</div>
        <button type="button" class="media-editor__copy" data-copy="${escapeAttr(copyLabel)}" title="${escapeAttr(copyTitle)}">Copy</button>
      </div>`
    : `<div class="member-card__name">${formatMusicianName(musician)}</div>`;

  return `
    <${tag} class="${classes}"${dataAttr}>
      ${photo}
      <div class="member-card__body">
        ${nameHtml}
        ${roleHtml}
        <div class="member-card__stats">${renderMemberStats(musician.stats)}</div>
      </div>
    </${tag}>`;
}
