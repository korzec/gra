(() => {
  'use strict';

  const MAX_LENGTH = 18;

  // Player names are optional, Unicode-friendly, and always treated as text.
  function normalize(value) {
    if (typeof value !== 'string') return '';
    return Array.from(value.replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
      .replace(/\s+/g, ' ').trim()).slice(0, MAX_LENGTH).join('');
  }

  function label(player) {
    return normalize(player?.name) || 'P' + player.id;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }

  window.NocnyKursPlayerNames = { normalize, label, escapeHtml, MAX_LENGTH };
})();
