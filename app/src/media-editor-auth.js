const MEDIA_EDITOR_AUTH_KEY = 'sg-media-editor-auth';
const MEDIA_EDITOR_PASSWORD = 'qwe123';

export function isMediaEditorUnlocked() {
  return sessionStorage.getItem(MEDIA_EDITOR_AUTH_KEY) === '1';
}

export function unlockMediaEditor(password) {
  if (password !== MEDIA_EDITOR_PASSWORD) return false;
  sessionStorage.setItem(MEDIA_EDITOR_AUTH_KEY, '1');
  return true;
}

export function lockMediaEditor() {
  sessionStorage.removeItem(MEDIA_EDITOR_AUTH_KEY);
}

export function renderMediaEditorGateHTML() {
  return `
    <div class="media-editor-gate roster-page">
      <h2>Media editor</h2>
      <p class="roster-page__intro">Enter the password to edit band logos and musician photos.</p>
      <form id="media-editor-gate-form" class="media-editor-gate__form">
        <input
          type="password"
          id="media-editor-password"
          class="media-editor__input"
          placeholder="Password"
          autocomplete="current-password"
          required
        />
        <button type="submit" class="btn-primary">Unlock</button>
      </form>
      <p class="media-editor-gate__error" id="media-editor-gate-error" hidden>Wrong password.</p>
      <button type="button" class="btn-ghost media-editor-gate__back" id="media-editor-gate-back">← Back</button>
    </div>`;
}

export function bindMediaEditorGateEvents({ onUnlock, onBack }) {
  document.getElementById('media-editor-gate-back')?.addEventListener('click', onBack);

  document.getElementById('media-editor-gate-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const input = document.getElementById('media-editor-password');
    const error = document.getElementById('media-editor-gate-error');
    const password = input?.value ?? '';

    if (unlockMediaEditor(password)) {
      error.hidden = true;
      onUnlock();
      return;
    }

    error.hidden = false;
    if (input) input.value = '';
    input?.focus();
  });
}
