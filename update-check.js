(() => {
  const script = document.currentScript;
  if (!script) return;

  const scriptUrl = new URL(script.src, window.location.href);
  const currentBuildSHA = scriptUrl.searchParams.get('v');
  const currentVersion = scriptUrl.searchParams.get('release');
  if (!currentBuildSHA || currentBuildSHA.includes('__BUILD_SHA__') || !currentVersion || !/^v\d+$/.test(currentVersion)) return;

  const versionUrl = new URL('./version.json', scriptUrl);
  let latestVersion = '';
  let latestBuildSHA = '';
  let promptShown = false;

  const badge = document.createElement('span');
  badge.className = 'release-version';
  badge.textContent = currentVersion;
  const brand = document.querySelector('.brand');
  if (brand) brand.append(badge);

  function reloadToLatest() {
    if (!latestVersion) return;
    const url = new URL(window.location.href);
    url.searchParams.set('version', latestVersion);
    if (latestBuildSHA) url.searchParams.set('build', latestBuildSHA);
    url.searchParams.set('reload', `${Date.now()}`);
    window.location.assign(url.href);
  }

  function showUpdatePrompt() {
    if (promptShown) return;
    promptShown = true;

    const notice = document.createElement('aside');
    notice.id = 'update-notice';
    notice.className = 'update-notice';
    notice.setAttribute('role', 'status');
    notice.setAttribute('aria-live', 'polite');

    const message = document.createElement('span');
    message.className = 'update-notice__message';
    message.textContent = `Aktualna ${currentVersion} → dostępna ${latestVersion}`;

    const hint = document.createElement('span');
    hint.className = 'update-notice__hint';
    hint.textContent = 'Nowa wersja gotowa · Spacja lub';

    const button = document.createElement('button');
    button.className = 'update-notice__button';
    button.type = 'button';
    button.textContent = 'Odśwież teraz';
    button.addEventListener('click', reloadToLatest);

    notice.append(message, hint, button);
    document.body.append(notice);
  }

  async function checkVersion() {
    try {
      const url = new URL(versionUrl);
      url.searchParams.set('t', `${Date.now()}-${Math.random().toString(36).slice(2)}`);
      const response = await fetch(url, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (!response.ok) return;

      const version = await response.json();
      const detectedVersion = version && version.version;
      const detectedBuildSHA = version && version.build_sha;
      if (typeof detectedVersion !== 'string' || !/^v\d+$/.test(detectedVersion)) return;
      const currentNumber = Number(currentVersion.slice(1));
      const detectedNumber = Number(detectedVersion.slice(1));
      if (detectedNumber <= currentNumber) return;

      latestVersion = detectedVersion;
      latestBuildSHA = typeof detectedBuildSHA === 'string' ? detectedBuildSHA : '';
      showUpdatePrompt();
    } catch {
      // A failed check must not interrupt play or navigation.
    }
  }

  window.addEventListener('keydown', event => {
    if (!promptShown || event.code !== 'Space') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!event.repeat) reloadToLatest();
  }, { capture: true });

  checkVersion();
  window.setInterval(checkVersion, 60_000);
})();
