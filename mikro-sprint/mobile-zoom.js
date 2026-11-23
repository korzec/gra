(() => {
  "use strict";
  // iOS Safari uses proprietary gesture events for pinch zoom.
  // Do not cancel ordinary touchstart/touchend: multiple fingers must be
  // able to steer, accelerate and shoot simultaneously.
  const blockPinch = event => event.preventDefault();
  document.addEventListener("gesturestart", blockPinch, { passive: false });
  document.addEventListener("gesturechange", blockPinch, { passive: false });
})();
