(() => {
  'use strict';

  // iOS Safari can still zoom the page with pinch gestures even when the
  // viewport meta tag restricts scaling. Do not cancel normal touch events:
  // the joystick and fire/action buttons rely on simultaneous touch pointers.
  const blockPinchZoom = event => event.preventDefault();
  document.addEventListener('gesturestart', blockPinchZoom, { passive: false });
  document.addEventListener('gesturechange', blockPinchZoom, { passive: false });
})();
