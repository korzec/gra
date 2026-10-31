(() => {
  window.createGamePerformanceHud = container => {
    const hud = document.createElement('div');
    hud.className = 'performance-hud';
    hud.setAttribute('aria-label', 'Wydajność gry');
    hud.textContent = 'FPS — · FRAME — ms · RENDER — ms';
    container.appendChild(hud);

    let previousFrame = null;
    let windowStart = null;
    let frames = 0;
    let frameTotal = 0;
    let renderTotal = 0;

    return (timestamp, renderTime) => {
      if (previousFrame !== null) {
        const frameTime = timestamp - previousFrame;
        if (frameTime > 0 && frameTime < 1000) {
          frames++;
          frameTotal += frameTime;
          renderTotal += renderTime;
        }
      }
      previousFrame = timestamp;
      if (windowStart === null) windowStart = timestamp;
      if (timestamp - windowStart < 600 || frames < 2) return;

      const elapsed = timestamp - windowStart;
      const fps = Math.round(frames * 1000 / elapsed);
      const averageFrame = frameTotal / frames;
      const averageRender = renderTotal / frames;
      hud.textContent = `FPS ${fps} · FRAME ${averageFrame.toFixed(1)} ms · RENDER ${averageRender.toFixed(1)} ms`;
      windowStart = timestamp;
      frames = 0;
      frameTotal = 0;
      renderTotal = 0;
    };
  };
})();
