import { renderMemberCard } from './member-card.js';
import { formatMusicianName } from './musician-display.js';
import { renderMediaImage, ATTRIBUTION_HTML } from './media.js';
import { INSTRUMENT_SLOTS, SLOT_LABELS } from './genres.js';

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildBandLogoSearchUrl(bandName) {
  const query = `${bandName} LOGO filetype:png`;
  return `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch&tbs=ic:trans`;
}

function buildMusicianPhotoSearchUrl(musician) {
  const query = `${formatMusicianName(musician)} from ${musician.band} pic`;
  return `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch&imgar=s`;
}

const COMPLETED_BANDS_KEY = 'sg-media-editor-completed';

export function readCompletedBands() {
  try {
    return new Set(JSON.parse(localStorage.getItem(COMPLETED_BANDS_KEY) ?? '[]'));
  } catch {
    return new Set();
  }
}

function writeCompletedBands(completed) {
  localStorage.setItem(COMPLETED_BANDS_KEY, JSON.stringify([...completed]));
}

export function setBandCompleted(bandKey, completed) {
  const keys = readCompletedBands();
  if (completed) keys.add(bandKey);
  else keys.delete(bandKey);
  writeCompletedBands(keys);
}

function renderCopyButton(copyText, title = 'Copy search label') {
  return `<button type="button" class="media-editor__copy" data-copy="${escapeAttr(copyText)}" title="${escapeAttr(title)}">Copy</button>`;
}

function mediaStatusLabel(source, status) {
  if (source === 'manual') return 'Manual';
  if (status === 'missing' || !source) return 'Missing';
  if (status === 'uncertain') return 'Uncertain';
  return source ?? 'Auto';
}

function renderUrlField({ id, label, value, hasOverride, dataKind, dataKey }) {
  return `
    <label class="media-editor__field" for="${id}">
      <span class="media-editor__field-label">${label}</span>
      <div class="media-editor__field-row">
        <input
          type="url"
          id="${id}"
          class="media-editor__input media-editor__paste-input"
          placeholder="https://…"
          value="${escapeAttr(value)}"
          data-kind="${dataKind}"
          data-key="${escapeAttr(dataKey)}"
        />
        <button type="button" class="btn-ghost media-editor__paste-btn" data-kind="${dataKind}" data-key="${escapeAttr(dataKey)}">Paste</button>
        <button type="button" class="btn-secondary media-editor__save" data-kind="${dataKind}" data-key="${escapeAttr(dataKey)}">Save</button>
        ${hasOverride ? `<button type="button" class="btn-ghost media-editor__clear" data-kind="${dataKind}" data-key="${escapeAttr(dataKey)}">Clear</button>` : ''}
      </div>
    </label>`;
}

function renderPasteTarget(kind, key, innerHtml, label) {
  return `
    <div class="media-editor__paste-target" data-kind="${kind}" data-key="${escapeAttr(key)}">
      ${innerHtml}
      <button type="button" class="media-editor__paste-hit" data-kind="${kind}" data-key="${escapeAttr(key)}" aria-label="${escapeAttr(label)}">
        Paste from clipboard
      </button>
    </div>`;
}

function renderMemberEditor(m, overrides, bandKey) {
  const hasOverride = Boolean(overrides.musicians?.[m.id]?.imageUrl);
  const inputValue = overrides.musicians?.[m.id]?.imageUrl ?? m.imageUrl ?? '';
  return `
    <div class="media-editor__member" data-musician-id="${escapeAttr(m.id)}" data-band-key="${escapeAttr(bandKey)}">
      ${renderPasteTarget(
        'musician',
        m.id,
        renderMemberCard(m, {
          uncertain: m.imageStatus === 'uncertain' && !hasOverride,
          copyLabel: buildMusicianPhotoSearchUrl(m),
          copyTitle: 'Copy Google Images URL (1:1 square filter) — paste in address bar',
        }),
        `Paste photo for ${formatMusicianName(m)}`
      )}
      <div class="media-editor__member-actions">
        <button
          type="button"
          class="btn-ghost media-editor__remove-member"
          data-band-key="${escapeAttr(bandKey)}"
          data-musician-id="${escapeAttr(m.id)}"
          title="Remove from band"
        >Remove</button>
      </div>
      <div class="media-editor__member-meta">
        <span class="media-editor__badge">${escapeHtml(mediaStatusLabel(m.imageSource, m.imageStatus))}</span>
        ${renderUrlField({
          id: `photo-${m.id}`,
          label: 'Photo URL',
          value: inputValue,
          hasOverride,
          dataKind: 'musician',
          dataKey: m.id,
        })}
      </div>
      <div class="media-editor__paste-feedback" hidden aria-live="polite"></div>
    </div>`;
}

function renderAddMemberForm(bandKey) {
  const slotChecks = INSTRUMENT_SLOTS.map(
    (slot) => `
      <label class="media-editor__slot-check">
        <input type="checkbox" name="slot" value="${escapeAttr(slot)}" />
        ${escapeHtml(SLOT_LABELS[slot] ?? slot)}
      </label>`
  ).join('');

  return `
    <div class="media-editor__add-member" data-band-key="${escapeAttr(bandKey)}">
      <h3 class="media-editor__add-member-title">Add member</h3>
      <div class="media-editor__add-member-row">
        <input
          type="text"
          class="media-editor__input media-editor__add-member-name"
          placeholder="Member name"
          aria-label="New member name"
        />
        <button type="button" class="btn-secondary media-editor__add-member-btn">Add</button>
      </div>
      <div class="media-editor__slot-picks" role="group" aria-label="Instrument slots">
        ${slotChecks}
      </div>
    </div>`;
}

function renderCollapsedBand(band) {
  return `
    <section class="roster-band media-editor__band media-editor__band--completed${band.hidden ? ' media-editor__band--hidden' : ''}" id="band-${escapeAttr(band.key)}" data-band-key="${escapeAttr(band.key)}">
      <div class="media-editor__band-collapsed">
        <h2 class="roster-band__name">${escapeHtml(band.name)}</h2>
        <span class="media-editor__collapsed-meta">${escapeHtml(band.era)}</span>
        ${band.hidden ? '<span class="media-editor__badge media-editor__badge--hidden">Hidden</span>' : ''}
        <button type="button" class="btn-secondary media-editor__uncomplete" data-band-key="${escapeAttr(band.key)}">Uncomplete</button>
      </div>
    </section>`;
}

function renderExpandedBand(band, members, overrides) {
  const hasOverride = Boolean(overrides.bands?.[band.key]?.logoUrl);
  const logo = renderMediaImage({
    url: band.logoUrl,
    alt: `${band.name} logo`,
    className: 'roster-band__logo',
    placeholderClass: 'roster-band__logo roster-band__logo--placeholder',
  });
  const logoInputValue = overrides.bands?.[band.key]?.logoUrl ?? band.logoUrl ?? '';

  return `
    <section class="roster-band media-editor__band${band.hidden ? ' media-editor__band--hidden' : ''}" id="band-${escapeAttr(band.key)}" data-band-key="${escapeAttr(band.key)}">
      <header class="roster-band__header">
        ${renderPasteTarget('band', band.key, logo, `Paste logo for ${band.name}`)}
        <div class="media-editor__band-info">
          <div class="media-editor__title-row">
            <h2 class="roster-band__name">${escapeHtml(band.name)}</h2>
            ${renderCopyButton(buildBandLogoSearchUrl(band.name), 'Copy Google Images URL (transparent filter) — paste in address bar')}
          </div>
          <p class="roster-band__meta">
            ${members.length} members · ${escapeHtml(band.era)} ·
            <span class="media-editor__badge">${escapeHtml(mediaStatusLabel(band.logoSource, band.logoStatus))}</span>
            ${band.hidden ? '<span class="media-editor__badge media-editor__badge--hidden">Hidden from reel</span>' : ''}
          </p>
          <div class="media-editor__band-actions">
            <button type="button" class="btn-secondary media-editor__complete-band" data-band-key="${escapeAttr(band.key)}">Completed</button>
            <button
              type="button"
              class="btn-ghost media-editor__toggle-band"
              data-band-key="${escapeAttr(band.key)}"
              data-hidden="${band.hidden ? '1' : '0'}"
            >${band.hidden ? 'Show on reel' : 'Hide from reel'}</button>
            <button
              type="button"
              class="btn-ghost media-editor__delete-band"
              data-band-key="${escapeAttr(band.key)}"
              data-band-name="${escapeAttr(band.name)}"
            >Delete band</button>
          </div>
          ${renderUrlField({
            id: `logo-${band.key}`,
            label: 'Logo URL',
            value: logoInputValue,
            hasOverride,
            dataKind: 'band',
            dataKey: band.key,
          })}
          <div class="media-editor__paste-feedback" hidden aria-live="polite"></div>
        </div>
      </header>
      <div class="roster-band__members media-editor__members">
        ${members.map((m) => renderMemberEditor(m, overrides, band.key)).join('')}
        ${renderAddMemberForm(band.key)}
      </div>
    </section>`;
}

export function renderMediaEditorPage({ bands, musicianById, overrides, apiAvailable, rosterApiAvailable, completedBands = readCompletedBands() }) {
  const activeCount = bands.filter((band) => !band.hidden).length;
  const completedCount = bands.filter((band) => completedBands.has(band.key)).length;
  const sections = bands
    .map((band) => {
      const members = band.memberIds.map((id) => musicianById.get(id)).filter(Boolean);
      if (completedBands.has(band.key)) {
        return renderCollapsedBand(band);
      }
      return renderExpandedBand(band, members, overrides);
    })
    .join('');

  return `
    <div class="roster-page media-editor-page">
      <div class="game-header">
        <div>
          <h1 class="game-header__title">MEDIA EDITOR</h1>
          <div class="game-header__meta">${activeCount} on reel · ${bands.length} total · ${completedCount} completed</div>
        </div>
        <div class="game-header__actions">
          <button class="btn-secondary" id="media-editor-save-all"${apiAvailable ? '' : ' disabled title="Requires npm run dev:full"'}>Save all</button>
          <button class="btn-secondary" id="media-editor-back">Back</button>
        </div>
      </div>
      ${
        apiAvailable
          ? rosterApiAvailable
            ? `<p class="roster-page__intro">Snipping Tool: capture with Win+Shift+S, then click a band logo or member photo. Add or remove members, hide bands from the reel, and fix URLs.</p><div class="media-editor__status" id="media-editor-status" hidden></div>`
            : `<p class="media-editor__warning">Roster edits need a fresh API — stop and run <code>npm run dev:full</code> again (the server was started before roster routes existed).</p><div class="media-editor__status" id="media-editor-status" hidden></div>`
          : `<p class="media-editor__warning">Saving requires the local API. Run <code>npm run dev:full</code> (or <code>npm run dev:api</code> alongside the app) to enable roster edits and clipboard paste.</p><div class="media-editor__status" id="media-editor-status" hidden></div>`
      }
      <div class="media-editor__toolbar">
        <input type="search" class="media-editor__search" id="media-editor-search" placeholder="Filter bands or members…" />
        <label class="media-editor__filter-hidden">
          <input type="checkbox" id="media-editor-show-hidden" />
          Show hidden bands only
        </label>
      </div>
      <div class="roster-list" id="media-editor-list">${sections}</div>
      ${ATTRIBUTION_HTML}
    </div>`;
}

async function copyLabelToClipboard(text, button) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.left = '-9999px';
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    document.body.removeChild(area);
  }

  const original = button.textContent;
  button.textContent = 'Copied';
  button.disabled = true;
  window.setTimeout(() => {
    button.textContent = original;
    button.disabled = false;
  }, 1200);
}

function readClipboardImageFromEvent(event) {
  const items = event.clipboardData?.items;
  if (!items) return null;
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      return item.getAsFile();
    }
  }
  return null;
}

async function readClipboardMedia() {
  if (navigator.clipboard?.read) {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const imageType = item.types.find((type) => type.startsWith('image/'));
      if (imageType) {
        const blob = await item.getType(imageType);
        return {
          kind: 'image',
          file: new File([blob], 'clipboard', { type: imageType }),
        };
      }
      if (item.types.includes('text/plain')) {
        const text = (await (await item.getType('text/plain')).text()).trim();
        if (/^https?:\/\//i.test(text)) {
          return { kind: 'url', url: text };
        }
      }
    }
  }

  return null;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read pasted image'));
    reader.readAsDataURL(file);
  });
}

export function bindMediaEditorEvents({
  onBack,
  onSave,
  onUpload,
  onPasteFromClipboard,
  onAddMember,
  onRemoveMember,
  onBandVisibility,
  onDeleteBand,
  onCompletedChange,
  apiAvailable,
  rosterApiAvailable,
  flash = null,
}) {
  document.getElementById('media-editor-back')?.addEventListener('click', onBack);

  document.querySelectorAll('.media-editor__complete-band').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const bandKey = button.dataset.bandKey;
      if (!bandKey) return;
      setBandCompleted(bandKey, true);
      onCompletedChange?.();
    });
  });

  document.querySelectorAll('.media-editor__uncomplete').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const bandKey = button.dataset.bandKey;
      if (!bandKey) return;
      setBandCompleted(bandKey, false);
      onCompletedChange?.();
    });
  });

  document.querySelectorAll('.media-editor__copy').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      copyLabelToClipboard(button.dataset.copy ?? '', button);
    });
  });

  const search = document.getElementById('media-editor-search');
  const showHiddenOnly = document.getElementById('media-editor-show-hidden');

  function applyBandFilters() {
    const q = search?.value.trim().toLowerCase() ?? '';
    const hiddenOnly = Boolean(showHiddenOnly?.checked);
    document.querySelectorAll('.media-editor__band').forEach((section) => {
      const text = section.textContent?.toLowerCase() ?? '';
      const isHidden = section.classList.contains('media-editor__band--hidden');
      const matchesSearch = !q || text.includes(q);
      const matchesHidden = hiddenOnly ? isHidden : true;
      section.hidden = !matchesSearch || !matchesHidden;
    });
  }

  search?.addEventListener('input', applyBandFilters);
  showHiddenOnly?.addEventListener('change', applyBandFilters);

  const statusEl = document.getElementById('media-editor-status');

  function setStatus(message, type = 'ok') {
    if (!statusEl) return;
    statusEl.hidden = false;
    statusEl.className = `media-editor__status media-editor__status--${type}`;
    statusEl.textContent = message;
  }

  if (flash?.message) {
    setStatus(flash.message, flash.type ?? 'ok');
  }

  function pasteFeedbackEl(container) {
    if (!container) return null;
    return (
      container.querySelector('.media-editor__paste-feedback') ??
      container.closest('.media-editor__member')?.querySelector('.media-editor__paste-feedback') ??
      container.closest('.media-editor__band-info')?.querySelector('.media-editor__paste-feedback')
    );
  }

  function say(container, message, type = 'ok') {
    setStatus(message, type);
    const feedback = pasteFeedbackEl(container);
    if (!feedback) return;
    feedback.hidden = false;
    feedback.className = `media-editor__paste-feedback media-editor__paste-feedback--${type}`;
    feedback.textContent = message;
    feedback.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  async function applyClipboardToTarget(container, kind, key, trigger) {
    if (!kind || !key) return;
    if (trigger) trigger.disabled = true;

    say(container, 'Reading clipboard…', 'pending');

    try {
      await onPasteFromClipboard({ kind, key });
    } catch (err) {
      say(container, err.message ?? 'Paste failed', 'error');
    } finally {
      if (trigger) trigger.disabled = false;
    }
  }

  async function handleImagePaste(kind, key, file, container) {
    const apiUp = await isMediaApiAvailable();
    if (!apiUp) {
      say(container, 'Local API offline — run npm run dev:full.', 'error');
      return;
    }
    if (!file) {
      say(container, 'Clipboard does not contain an image.', 'error');
      return;
    }

    say(container, 'Saving pasted image…', 'pending');
    try {
      const dataUrl = await fileToDataUrl(file);
      await onUpload({ kind, key, dataUrl });
    } catch (err) {
      say(container, err.message ?? 'Paste failed', 'error');
    }
  }

  function bindPasteControl(el) {
    el.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const kind = el.dataset.kind;
      const key = el.dataset.key;
      const container =
        el.closest('.media-editor__paste-target') ??
        el.closest('.media-editor__member') ??
        el.closest('.media-editor__band-info');
      void applyClipboardToTarget(container, kind, key, el);
    });
  }

  document.querySelectorAll('.media-editor__paste-hit, .media-editor__paste-btn').forEach(bindPasteControl);

  document.querySelectorAll('.media-editor__paste-target').forEach((target) => {
    target.addEventListener('paste', (event) => {
      const file = readClipboardImageFromEvent(event);
      if (!file) return;
      event.preventDefault();
      handleImagePaste(target.dataset.kind, target.dataset.key, file, target);
    });
  });

  function requireRosterApi() {
    if (rosterApiAvailable) return true;
    setStatus('Roster API unavailable — restart with npm run dev:full.', 'error');
    return false;
  }

  document.querySelectorAll('.media-editor__add-member-btn').forEach((button) => {
    button.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!requireRosterApi()) return;
      const form = button.closest('.media-editor__add-member');
      const bandKey = form?.dataset.bandKey;
      const nameInput = form?.querySelector('.media-editor__add-member-name');
      const slots = [...(form?.querySelectorAll('input[name="slot"]:checked') ?? [])].map(
        (input) => input.value
      );
      const name = nameInput?.value.trim() ?? '';
      if (!bandKey || !name) {
        setStatus('Enter a member name.', 'error');
        return;
      }
      if (!slots.length) {
        setStatus('Pick at least one instrument slot.', 'error');
        return;
      }
      button.disabled = true;
      setStatus('Adding member…', 'pending');
      try {
        await onAddMember?.({ bandKey, name, slots });
      } catch (err) {
        setStatus(err.message ?? 'Add member failed', 'error');
      } finally {
        button.disabled = false;
      }
    });
  });

  document.querySelectorAll('.media-editor__remove-member').forEach((button) => {
    button.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!requireRosterApi()) return;
      const bandKey = button.dataset.bandKey;
      const musicianId = button.dataset.musicianId;
      if (!bandKey || !musicianId) return;
      if (!window.confirm('Remove this member from the band?')) return;
      button.disabled = true;
      setStatus('Removing member…', 'pending');
      try {
        await onRemoveMember?.({ bandKey, musicianId });
      } catch (err) {
        setStatus(err.message ?? 'Remove member failed', 'error');
      } finally {
        button.disabled = false;
      }
    });
  });

  document.querySelectorAll('.media-editor__toggle-band').forEach((button) => {
    button.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!requireRosterApi()) return;
      const bandKey = button.dataset.bandKey;
      if (!bandKey) return;
      const hidden = button.dataset.hidden !== '1';
      button.disabled = true;
      setStatus(hidden ? 'Hiding band…' : 'Showing band…', 'pending');
      try {
        await onBandVisibility?.({ bandKey, hidden });
      } catch (err) {
        setStatus(err.message ?? 'Band visibility update failed', 'error');
      } finally {
        button.disabled = false;
      }
    });
  });

  document.querySelectorAll('.media-editor__delete-band').forEach((button) => {
    button.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!requireRosterApi()) return;
      const bandKey = button.dataset.bandKey;
      const bandName = button.dataset.bandName ?? 'this band';
      if (!bandKey) return;
      if (
        !window.confirm(
          `Permanently delete ${bandName} from the roster?\n\nUnlike "Hide from reel", this removes the band from the Media Editor and game until restored in data/raw/band-deletions.json.`
        )
      ) {
        return;
      }
      button.disabled = true;
      setStatus('Deleting band…', 'pending');
      try {
        await onDeleteBand?.({ bandKey });
      } catch (err) {
        setStatus(err.message ?? 'Delete band failed', 'error');
      } finally {
        button.disabled = false;
      }
    });
  });

  if (!apiAvailable) return;

  function collectAllMediaPatches() {
    const patch = { bands: {}, musicians: {} };

    document.querySelectorAll('.media-editor__input[data-kind][data-key]').forEach((input) => {
      const value = input.value.trim();
      if (!value) return;

      const { kind, key } = input.dataset;
      if (!kind || !key) return;

      if (kind === 'band') {
        patch.bands[key] = { logoUrl: value };
      } else if (kind === 'musician') {
        patch.musicians[key] = { imageUrl: value };
      }
    });

    return patch;
  }

  document.getElementById('media-editor-save-all')?.addEventListener('click', async () => {
    const button = document.getElementById('media-editor-save-all');
    const patch = collectAllMediaPatches();
    const bandCount = Object.keys(patch.bands).length;
    const musicianCount = Object.keys(patch.musicians).length;

    if (!bandCount && !musicianCount) {
      setStatus('No URLs to save — enter logo or photo URLs first.', 'error');
      return;
    }

    if (button) button.disabled = true;
    setStatus(`Saving ${bandCount} logos and ${musicianCount} photos…`, 'pending');

    try {
      await onSave(patch, false);
      setStatus(`Saved ${bandCount} logos and ${musicianCount} photos.`, 'ok');
    } catch (err) {
      setStatus(err.message ?? 'Save all failed', 'error');
    } finally {
      if (button) button.disabled = false;
    }
  });

  async function handleSave(kind, key, clear = false) {
    const input = document.querySelector(
      `.media-editor__input[data-kind="${kind}"][data-key="${CSS.escape(key)}"]`
    );
    if (!input) return;

    const patch =
      kind === 'band'
        ? { bands: { [key]: { logoUrl: clear ? null : input.value } } }
        : { musicians: { [key]: { imageUrl: clear ? null : input.value } } };

    const buttons = document.querySelectorAll(
      `.media-editor__save[data-kind="${kind}"][data-key="${CSS.escape(key)}"],
       .media-editor__clear[data-kind="${kind}"][data-key="${CSS.escape(key)}"]`
    );
    buttons.forEach((btn) => {
      btn.disabled = true;
    });
    setStatus(clear ? 'Clearing override…' : 'Saving…', 'pending');

    try {
      await onSave(patch, clear);
      setStatus(clear ? 'Override cleared and roster rebuilt.' : 'Saved and roster rebuilt.', 'ok');
    } catch (err) {
      setStatus(err.message ?? 'Save failed', 'error');
    } finally {
      buttons.forEach((btn) => {
        btn.disabled = false;
      });
    }
  }

  document.querySelectorAll('.media-editor__save').forEach((btn) => {
    btn.addEventListener('click', () => {
      handleSave(btn.dataset.kind, btn.dataset.key, false);
    });
  });

  document.querySelectorAll('.media-editor__clear').forEach((btn) => {
    btn.addEventListener('click', () => {
      handleSave(btn.dataset.kind, btn.dataset.key, true);
    });
  });

  document.querySelectorAll('.media-editor__input').forEach((input) => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSave(input.dataset.kind, input.dataset.key, false);
      }
    });

    input.addEventListener('paste', (event) => {
      const file = readClipboardImageFromEvent(event);
      if (!file) return;
      event.preventDefault();
      handleImagePaste(input.dataset.kind, input.dataset.key, file, input.closest('.media-editor__member'));
    });
  });
}
