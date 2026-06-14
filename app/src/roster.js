import { renderMemberCard } from './member-card.js';
import { renderMediaImage, ATTRIBUTION_HTML } from './media.js';

export function renderRosterPage({ bands, musicianById }) {
  const sections = bands
    .map((band) => {
      const members = band.memberIds.map((id) => musicianById.get(id)).filter(Boolean);
      const logo = renderMediaImage({
        url: band.logoUrl,
        alt: `${band.name} logo`,
        className: 'roster-band__logo',
        placeholderClass: 'roster-band__logo roster-band__logo--placeholder',
      });

      return `
        <section class="roster-band" id="band-${band.key}">
          <header class="roster-band__header">
            ${logo}
            <div>
              <h2 class="roster-band__name">${band.name}</h2>
              <p class="roster-band__meta">${members.length} members</p>
            </div>
          </header>
          <div class="roster-band__members">
            ${members
              .map((m) =>
                renderMemberCard(m, { uncertain: m.imageStatus === 'uncertain' })
              )
              .join('')}
          </div>
        </section>`;
    })
    .join('');

  return `
    <div class="roster-page">
      <div class="game-header">
        <div>
          <h1 class="game-header__title">ROSTER</h1>
          <div class="game-header__meta">${bands.length} bands · alphabetical</div>
        </div>
        <div class="game-header__actions">
          <button class="btn-ghost" id="roster-edit-media">Edit URLs</button>
          <button class="btn-secondary" id="roster-back">Back</button>
        </div>
      </div>
      <p class="roster-page__intro">Every band and musician available in Band Spin. Grey tiles are pending images — use <strong>Edit media URLs</strong> on the home screen to fix them.</p>
      <div class="roster-list">${sections}</div>
      ${ATTRIBUTION_HTML}
    </div>`;
}

export function bindRosterEvents(onBack, onEditMedia) {
  document.getElementById('roster-back')?.addEventListener('click', onBack);
  document.getElementById('roster-edit-media')?.addEventListener('click', onEditMedia);
}
