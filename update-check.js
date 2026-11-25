(() => {
  const script = document.currentScript;
  if (!script) return;

  const scriptUrl = new URL(script.src, window.location.href);
  const currentBuildSHA = scriptUrl.searchParams.get('v');
  const currentVersion = scriptUrl.searchParams.get('release');
  if (!currentBuildSHA || currentBuildSHA.includes('__BUILD_SHA__') || !currentVersion || !/^v\d+$/.test(currentVersion)) return;

  const versionUrl = new URL('./version.json', scriptUrl);
  const brand = document.querySelector('header .brand');
  if (!brand || !brand.parentNode || document.querySelector('.release-control')) return;
  let latestVersion = '';
  let latestBuildSHA = '';

  // Shared top-bar component. The refresh button is outside the brand link.
  const group = document.createElement('div');
  group.className = 'release-header-group';
  brand.parentNode.insertBefore(group, brand);
  group.append(brand);
  const control = document.createElement('div');
  control.className = 'release-control';
  const badge = document.createElement('span');
  badge.className = 'release-version';
  badge.textContent = currentVersion;
  const notice = document.createElement('span');
  notice.className = 'release-next';
  notice.hidden = true;
  notice.setAttribute('role', 'status');
  notice.setAttribute('aria-live', 'polite');
  const arrow = document.createElement('span');
  arrow.textContent = '→';
  arrow.setAttribute('aria-hidden', 'true');
  const next = document.createElement('span');
  next.className = 'release-latest';
  notice.append(arrow, next);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'release-refresh';
  button.hidden = true;
  button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20 11a8 8 0 1 0-2 6M20 4v7h-7"/></svg>';
  control.append(badge, notice, button);
  group.append(control);

  function localize() {
    const swedish = document.documentElement.lang.toLowerCase().startsWith('sv');
    badge.title = swedish ? 'Nuvarande version' : 'Aktualna wersja';
    button.title = swedish ? 'Uppdatera till ny version' : 'Odśwież do nowej wersji';
    button.setAttribute('aria-label', button.title);
    if (latestVersion) next.setAttribute('aria-label', (swedish ? 'Ny version ' : 'Nowa wersja ') + latestVersion);
  }
  localize();
  if (typeof MutationObserver !== 'undefined') new MutationObserver(localize)
    .observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

  button.addEventListener('click', () => {
    if (!latestVersion) return;
    const url = new URL(window.location.href);
    url.searchParams.set('version', latestVersion);
    if (latestBuildSHA) url.searchParams.set('build', latestBuildSHA);
    else url.searchParams.delete('build');
    url.searchParams.set('reload', String(Date.now()));
    window.location.assign(url.href);
  });

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

      if (latestVersion && detectedNumber < Number(latestVersion.slice(1))) return;
      latestVersion = detectedVersion;
      latestBuildSHA = typeof detectedBuildSHA === 'string' ? detectedBuildSHA : '';
      next.textContent = latestVersion;
      localize();
      notice.hidden = button.hidden = false;
      group.classList.add('has-release-update');
    } catch {
      // A failed check must not interrupt play or navigation.
    }
  }

  checkVersion();
  window.setInterval(checkVersion, 30_000);
})();
