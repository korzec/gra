(() => {
  "use strict";
  const dedicatedMode = window.__MIKRO_SPRINT_DEDICATED__ === true;
  const t = (key, values = {}) => window.MikroSprintLocale?.t(key, values) ??
    key.replace(/\{(\w+)\}/g, (token, name) => Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : token);
  function writeUI(element, key, values = {}, property = "textContent") {
    if (window.MikroSprintLocale) window.MikroSprintLocale.write(element, key, values, property);
    else element[property] = t(key, typeof values === "function" ? values() : values);
  }
  let settingsOpen = false;
  const BASE_W = 1600, BASE_H = 980, WORLD_SCALE = 2;
  const W = BASE_W * WORLD_SCALE, H = BASE_H * WORLD_SCALE;
  const TOTAL_CARS = 8, WINNING_SCORE = 10, ROUND_BREAK = 4;
  // Car body is 47 world units long (see drawCar); the longer camera axis
  // must never show more than 20 cars, including on portrait screens.
  const CAR_LENGTH = 47, CAMERA_MAX_SPAN = CAR_LENGTH * 20;
  const CAMERA_MAX_SCALE = 2.2;
  const canvas = document.querySelector("#race");
  const ctx = canvas.getContext("2d", { alpha: false });
  const stage = document.querySelector("#game-stage");
  const overlay = document.querySelector("#overlay");
  const startButton = document.querySelector("#start");
  const scoreboardEl = document.querySelector("#scoreboard");
  const scoreboardBodyEl = document.querySelector("#scoreboard-body");
  const scoreboardToggleEl = document.querySelector("#scoreboard-toggle");
  const scoreboardDetailsEl = document.querySelector("#scoreboard-details");
  const scoreboardColorsEl = document.querySelector("#scoreboard-colors");
  const roundSummaryEl = document.querySelector("#round-summary");
  const roundTitleEl = document.querySelector("#round-title");
  const roundResultsEl = document.querySelector("#round-results");
  const finalScoresEl = document.querySelector("#final-scores");
  const driverFieldsEl = document.querySelector("#driver-name-fields");
  const pauseButton = document.querySelector("#pause");
  const joystick = document.querySelector("#steering-stick");
  const menuTitle = document.querySelector("#menu-title");
  const menuDescription = document.querySelector("#menu-description");
  const playerSelect = document.querySelector("#players");
  const botSelect = document.querySelector("#bots");
  const countdownEl = document.querySelector("#countdown");
  const toastEl = document.querySelector("#toast");
  const roundReadyEl = document.querySelector("#round-ready");
  let readyKey = "", pendingReady = null;
  const readyPedalStates = new Map();
  const weaponEl = document.querySelector("#weapon");
  const trackTag = document.querySelector("#track-tag");
  const trackChoices = document.querySelector("#track-choices");
  const colors = ["#d9fc67", "#ff665b", "#51d5fa", "#c19aff", "#ffa740", "#71e0b0", "#ff78c2", "#a9bbff"];
  const WEAPONS = {
    machinegun: { label: "KARABIN", ammo: 12, speed: 820, life: 1.0, cooldown: 0.12, color: "#fff2a1" },
    missile: { label: "RAKIETA", ammo: 3, speed: 520, life: 2.2, cooldown: 0.65, color: "#ff8c51" },
    homing: { label: "RAKIETA NAM." , ammo: 2, speed: 440, life: 3.1, cooldown: 0.8, color: "#ff496a" },
    cluster: { label: "BOMBY KAS." , ammo: 2, speed: 480, life: 1.7, cooldown: 0.8, color: "#ffb45c" },
    plasma: { label: "PLAZMA", ammo: 3, speed: 610, life: 1.25, cooldown: 0.7, color: "#9efffd" },
    cannon: { label: "DZIAŁKO", ammo: 4, speed: 650, life: 1.1, cooldown: 0.5, color: "#d0b4ff" },
    mines: { label: "MINY", ammo: 3, cooldown: 0.55, color: "#d6e1e8" },
    bombs: { label: "BOMBY", ammo: 2, cooldown: 0.7, color: "#ff725d" },
    hammer: { label: "MŁOT", ammo: 3, cooldown: 0.6, color: "#ffd86b" },
    shocker: { label: "RAŻENIE", ammo: 3, cooldown: 0.65, color: "#7ef9ff" },
    sonic: { label: "SONIC BOOM", ammo: 2, cooldown: 0.85, color: "#a8e1ff" },
    flame: { label: "MIOTACZ", ammo: 5, speed: 350, life: 0.42, cooldown: 0.36, color: "#ff9a38" }
  };
  const PICKUP_ROTATION = ["machinegun", "missile", "homing", "cluster", "plasma", "cannon",
    "mines", "bombs", "hammer", "shocker", "sonic", "flame"];
  const playerKeys = [
    { left: "a", right: "d", up: "w", down: "s", brake: " ", fire: "e" },
    { left: "arrowleft", right: "arrowright", up: "arrowup", down: "arrowdown", brake: "control", fire: "shift" },
    { left: "j", right: "l", up: "i", down: "k", brake: "u", fire: "o" },
    { left: "f", right: "h", up: "t", down: "g", brake: "r", fire: "y" }
  ];
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const angleWrap = a => Math.atan2(Math.sin(a), Math.cos(a));

  // Left/right steering rotates the chassis, regardless of world heading.
  // Speed and lateral momentum remain governed by the existing physics.
  function steerCarRelative(car, steer, dt, turnRate) {
    car.angle += clamp(steer, -1, 1) * dt * turnRate;
  }
  const rand = n => (Math.sin(n * 127.1 + 31.73) * 43758.5453) % 1;
  const courses = {
    pool: {
      name: "STÓŁ BILARDOWY",
      roadWidth: 142,
      checkpoints: [[332, 690], [560, 690], [1050, 705], [1350, 645], [1270, 470], [1090, 337], [1354, 252], [1060, 179], [794, 277], [530, 220], [270, 270], [260, 465]],
      objects: [
        { x: 710, y: 552, r: 33, type: "ball", number: 8, color: "#1c2430" },
        { x: 880, y: 493, r: 30, type: "ball", number: 3, color: "#d54146" },
        { x: 1040, y: 565, r: 30, type: "ball", number: 2, color: "#2966bd" },
        { x: 595, y: 488, r: 28, type: "ball", number: 1, color: "#e5ba37" }
      ],
      pits: [[138, 137], [800, 130], [1462, 137], [138, 835], [800, 842], [1462, 835]]
    },
    bath: {
      name: "WANNA",
      roadWidth: 143,
      checkpoints: [[318, 697], [628, 771], [1045, 740], [1328, 584], [1245, 390], [1010, 250], [772, 410], [530, 258], [281, 309], [218, 518]],
      objects: [
        { x: 796, y: 563, r: 49, type: "duck" },
        { x: 1120, y: 537, r: 37, type: "soap" },
        { x: 457, y: 514, r: 35, type: "sponge" }
      ],
      pits: []
    }
  };
  function interpolatePath(points) {
    const result = [], n = points.length, steps = 25;
    for (let i = 0; i < n; i++) {
      const a = points[(i - 1 + n) % n], b = points[i];
      const c = points[(i + 1) % n], d = points[(i + 2) % n];
      for (let j = 0; j < steps; j++) {
        const t = j / steps, t2 = t * t, t3 = t2 * t;
        const smooth = (v0, v1, v2, v3) => 0.5 * ((2 * v1) + (-v0 + v2) * t +
          (2 * v0 - 5 * v1 + 4 * v2 - v3) * t2 + (-v0 + 3 * v1 - 3 * v2 + v3) * t3);
        result.push({ x: smooth(a[0], b[0], c[0], d[0]), y: smooth(a[1], b[1], c[1], d[1]) });
      }
    }
    return result;
  }
  Object.values(courses).forEach(course => {
    course.checkpoints = course.checkpoints.map(([x, y]) => [x * WORLD_SCALE, y * WORLD_SCALE]);
    course.objects = course.objects.map(object => ({ ...object,
      x: object.x * WORLD_SCALE, y: object.y * WORLD_SCALE }));
    course.pits = course.pits.map(([x, y]) => [x * WORLD_SCALE, y * WORLD_SCALE]);
    course.path = interpolatePath(course.checkpoints);
    course.distances = [0];
    for (let i = 0; i < course.path.length; i++) {
      const a = course.path[i], b = course.path[(i + 1) % course.path.length];
      course.distances.push(course.distances[i] + Math.hypot(a.x - b.x, a.y - b.y));
    }
    course.totalLength = course.distances[course.path.length];
  });
  let selectedTrack = "pool", course = courses.pool;
  // The dedicated engine executes this exact source with browser UI disabled.
  // Inputs belong to peer-assigned slots, never to a client-provided car ID.
  const dedicatedSlots = new Map(), dedicatedInputs = new Map();
  let dedicatedTick = 0, dedicatedWinnerId = null, dedicatedFinishDelay = 0;
  let online = null, onlinePlayerSlot = -1, onlineConnected = false;
  let onlineSequence = 0, lastOnlineTick = -1, onlineAccumulator = 0;
  let pendingInputs = [], remoteFrames = [], onlineStandings = [], reconciling = false;
  const visualCorrection = { x: 0, y: 0, angle: 0 };
  const onlineActive = () => online?.active === true;
  let scene, cars = [], pickups = [], shots = [], state = "menu", humans = 1, botCount = 3;
  let countdown = 3.5, raceTime = 0, toastUntil = 0, uiTime = 0;
  let matchRound = 1, roundDelay = 0, eliminationOrder = [], roundResults = [];
  let roundElapsed = 0;
  const roundReady = new Set();
  let matchWinnerId = null, roundWinnerId = null, roundAnchor = null;
  const savedDriverNames = Array(TOTAL_CARS).fill("");
  let scoreboardKey = "";
  const keys = new Set(), touch = { x: 0, y: 0, gas: false, brake: false, fire: false };
  const stick = { pointerId: null };
  // Each control tracks its own active pointers. Releasing an unrelated touch
  // must not cancel a held pedal or shot.
  const buttonPointers = new Map();
  let viewW = 1200, viewH = 700, pixelRatio = 1;
  const camera = { x: 800, y: 490, scale: 1, zoom: 1 };
  let onlineCameraTarget = null;
  let audio;
  function normalizeDriverName(value) {
    if (typeof value !== "string") return "";
    return Array.from(value.replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
      .replace(/\s+/g, " ").trim()).slice(0, 18).join("");
  }
  function driverLabel(car) {
    return normalizeDriverName(car.name) || (car.human ? "P" : "BOT ") + (car.id + 1);
  }
  function pointDelta(place) { return place === 1 ? 2 : place === 2 ? 1 : 2 - place; }
  function tone(hz, duration = 0.08, shape = "square") {
    if (reconciling || dedicatedMode) return;
    try {
      if (!audio) return;
      const osc = audio.createOscillator(), gain = audio.createGain();
      osc.type = shape;
      osc.frequency.value = hz;
      gain.gain.setValueAtTime(0.045, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
      osc.connect(gain); gain.connect(audio.destination);
      osc.start(); osc.stop(audio.currentTime + duration);
    } catch (_) { /* Web Audio can be disabled by the browser. */ }
  }
  function announce(text, values = {}) {
    if (dedicatedMode || reconciling) return;
    writeUI(toastEl, text, values);
    toastUntil = performance.now() + 3000;
  }
  function expireToast(now) {
    if (toastUntil && now >= toastUntil) {
      writeUI(toastEl, "");
      toastUntil = 0;
    }
  }
  function point(index) {
    const path = course.path, n = path.length;
    return path[((Math.round(index) % n) + n) % n];
  }
  function orientation(index) {
    const a = point(index - 2), b = point(index + 2);
    return Math.atan2(b.y - a.y, b.x - a.x);
  }
  function pointAtDistance(distance) {
    const n = course.path.length;
    const d = ((distance % course.totalLength) + course.totalLength) % course.totalLength;
    let lo = 0, hi = n - 1;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (course.distances[mid + 1] < d) lo = mid + 1;
      else hi = mid;
    }
    const a = point(lo), b = point(lo + 1);
    const fraction = clamp((d - course.distances[lo]) / (course.distances[lo + 1] - course.distances[lo] || 1), 0, 1);
    return { x: a.x + (b.x - a.x) * fraction, y: a.y + (b.y - a.y) * fraction,
      index: lo, distance: d, angle: Math.atan2(b.y - a.y, b.x - a.x) };
  }
  function projectTrack(x, y, reference) {
    // Follow the nearby arc of the circuit to avoid jumping across tight bends.
    const { path, distances, roadWidth } = course;
    const startDistance = reference - roadWidth;
    const start = pointAtDistance(startDistance);
    let index = start.index;
    let segmentStart = startDistance - (start.distance - distances[index]);
    let best = { index, trackDistance: reference, distanceSquared: Infinity };
    while (segmentStart <= reference + roadWidth) {
      const nextIndex = (index + 1) % path.length;
      const a = path[index], b = path[nextIndex];
      const dx = b.x - a.x, dy = b.y - a.y;
      const length = distances[index + 1] - distances[index];
      const fraction = clamp(((x - a.x) * dx + (y - a.y) * dy) / (length * length), 0, 1);
      const distanceSquared = (x - a.x - dx * fraction) ** 2 + (y - a.y - dy * fraction) ** 2;
      if (distanceSquared < best.distanceSquared) {
        best = { index, trackDistance: segmentStart + length * fraction, distanceSquared };
      }
      index = nextIndex;
      segmentStart += length;
    }
    return best;
  }
  // The visible road can be far from the last validated race-progress sample.
  function isOnRoad(x, y, reference) {
    const radius = course.roadWidth * 0.5, radiusSquared = radius * radius;
    if (projectTrack(x, y, reference).distanceSquared < radiusSquared) return true;
    const { path } = course;
    for (let i = 0; i < path.length; i++) {
      const a = path[i], b = path[(i + 1) % path.length];
      if (x < Math.min(a.x, b.x) - radius || x > Math.max(a.x, b.x) + radius ||
          y < Math.min(a.y, b.y) - radius || y > Math.max(a.y, b.y) + radius) continue;
      const dx = b.x - a.x, dy = b.y - a.y, lengthSquared = dx * dx + dy * dy;
      const fraction = lengthSquared ? clamp(((x - a.x) * dx + (y - a.y) * dy) / lengthSquared, 0, 1) : 0;
      if ((x - a.x - dx * fraction) ** 2 + (y - a.y - dy * fraction) ** 2 < radiusSquared) return true;
    }
    return false;
  }
  function setTrackDistance(car, distance) {
    car.trackDistance = distance;
    car.raceProgress = (distance - car.roundStartDistance) / course.totalLength;
    const lapProgress = Math.max(0, car.raceProgress);
    car.lap = Math.floor(lapProgress);
    car.gate = 1 + Math.floor((lapProgress % 1) * 4);
  }
  function updateRaceProgress(car) {
    if (car.eliminated) return;
    const projection = projectTrack(car.x, car.y, car.trackDistance);
    if (projection.distanceSquared < (course.roadWidth * 0.52) ** 2) {
      car.index = car.safeIndex = car.lastIndex = projection.index;
      setTrackDistance(car, projection.trackDistance);
    }
  }
  // Compact two-lane grid measured in world units, independent of path sampling density.
  function gridPose(order, anchorDistance) {
    const distance = anchorDistance - Math.floor(order / 2) * 64 - (order % 2) * 8;
    const pos = pointAtDistance(distance), side = order % 2 === 0 ? -27 : 27;
    return { x: pos.x - Math.sin(pos.angle) * side, y: pos.y + Math.cos(pos.angle) * side,
      angle: pos.angle, index: pos.index, distance };
  }
  function makeCar(i) {
    const { x, y, angle, index, distance } = gridPose(i, -70);
    const car = {
      id: i, human: i < humans, x, y, angle,
      vx: 0, vy: 0, speed: 0, steer: 0, index, safeIndex: index, lastIndex: index,
      botDistance: distance, botSpeed: 0, botPushX: 0, botPushY: 0, roundStartDistance: 0,
      offroad: 0, invuln: 1.2, turbo: 0, gun: 0, weapon: "", hit: 0, actionHeld: false, fireCooldown: 0,
      botCooldown: 1.8 + i * 0.4, finishAt: null, eliminated: false, smoke: 0,
      points: 0, name: "", lastAppliedInputSeq: 0, shotSerial: 0
    };
    setTrackDistance(car, distance);
    return car;
  }
  function makeCars() {
    // Reserve a human slot in dedicated rooms, even before the first peer joins.
    // Keep slot IDs stable across automatic online restarts.
    const assignedSize = dedicatedMode && dedicatedSlots.size
      ? Math.max(...dedicatedSlots.values()) + 1 : 0;
    const count = Math.min(TOTAL_CARS, Math.max(humans + botCount + Number(dedicatedMode), assignedSize));
    cars = Array.from({ length: count }, (_, i) => makeCar(i));
  }
  function makePickups() {
    const types = Array.from({ length: 16 }, (_, i) => i % 4 === 0 ? "turbo" : "weapon");
    let weaponIndex = 0;
    pickups = types.map((type, i) => {
      const at = Math.round(course.path.length * (i + 0.65) / types.length);
      const p = point(at), angle = orientation(at);
      const offset = i % 2 === 0 ? -22 : 22;
      const weaponType = type === "weapon" ? PICKUP_ROTATION[weaponIndex++ % PICKUP_ROTATION.length] : "";
      return { type, weaponType,
        x: p.x - Math.sin(angle) * offset, y: p.y + Math.cos(angle) * offset,
        cooldown: 0, phase: i * 1.7, cycle: weaponIndex - 1 };
    });
  }
  function startRace() {
    if (onlineActive()) return;
    resetTouchControls();
    if (state === "paused") {
      state = "racing";
      document.body.classList.add("race-active");
      overlay.classList.add("hidden");
      return;
    }
    humans = clamp(Number(playerSelect.value) || 1, 1, TOTAL_CARS);
    botCount = clamp(Number(botSelect.value) || 0, 0, TOTAL_CARS - humans);
    selectedTrack = document.querySelector('input[name="track"]:checked').value;
    course = courses[selectedTrack];
    buildScene();
    makeCars();
    for (const car of cars) if (car.human) car.name = savedDriverNames[car.id];
    roundSummaryEl.hidden = true;
    finalScoresEl.hidden = true;
    makePickups();
    shots = [];
    matchRound = 1; roundDelay = 0; eliminationOrder = []; roundResults = []; roundReady.clear(); roundElapsed = 0;
    matchWinnerId = roundWinnerId = roundAnchor = null; scoreboardKey = "";
    raceTime = 0; countdown = 3.5; toastUntil = 0; uiTime = 0;
    writeUI(toastEl, "");
    writeUI(trackTag, course.name);
    overlay.classList.add("hidden");
    state = "countdown";
    document.body.classList.add("race-active");
    pauseButton.hidden = false;
    updateCamera(0, true);
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (Audio) { audio = audio || new Audio(); audio.resume().catch(() => {}); }
    } catch (_) {}
    updateHud();
  }
  function showMenu(title, copy, buttonLabel, allowChoice, values = {}) {
    writeUI(menuTitle, title, {}, "innerHTML");
    writeUI(menuDescription, copy, values);
    // Preserve the arrow as markup, not as part of the translatable label.
    let label = startButton.querySelector(".start-label");
    if (!label) {
      label = document.createElement("span"); label.className = "start-label"; label.style.marginLeft = "0";
      const arrow = document.createElement("span"); arrow.textContent = "↗";
      startButton.replaceChildren(label, arrow);
    }
    writeUI(label, buttonLabel);
    trackChoices.style.display = allowChoice ? "" : "none";
    playerSelect.closest(".count-settings").style.display = allowChoice ? "" : "none";
    overlay.classList.remove("hidden");
  }
  function pause() {
    if (onlineActive()) return; // Server-owned races cannot pause locally.
    if (state === "racing") {
      resetTouchControls();
      state = "paused";
      document.body.classList.remove("race-active");
      showMenu("WYŚCIG <em>WSTRZYMANY.</em>", "Wznów i wróć na tor. Sterowanie pozostaje przypisane do tych samych kierowców.", "WZNÓW WYŚCIG", false);
    } else if (state === "paused") startRace();
  }
  function beginNextRound() {
    if (!roundAnchor) return;
    const anchor = roundAnchor;
    const finishOrder = [...roundResults].reverse().map(result => cars.find(car => car.id === result.id)).filter(Boolean);
    finishOrder.push(...cars.filter(car => !finishOrder.includes(car)));
    for (const [order, car] of finishOrder.entries()) {
      const pos = gridPose(order, anchor.distance);
      const distance = pos.distance;
      const oldName = car.name, oldPoints = car.points, oldHuman = car.human;
      const oldSeq = car.lastAppliedInputSeq;
      Object.assign(car, makeCar(car.id), {
        x: pos.x, y: pos.y,
        angle: pos.angle, index: pos.index, safeIndex: pos.index, lastIndex: pos.index,
        botDistance: distance,
        roundStartDistance: anchor.distance,
        name: oldName, points: oldPoints, human: oldHuman, lastAppliedInputSeq: oldSeq
      });
      setTrackDistance(car, distance);
    }
    matchRound++;
    roundDelay = 0; eliminationOrder = []; roundResults = []; roundReady.clear(); roundElapsed = 0;
    if (dedicatedMode) for (const [slot, input] of dedicatedInputs) dedicatedInputs.set(slot, { dx: 0, dy: 0, gas: 0, brake: 0, fire: false, seq: input.seq });
    roundWinnerId = null; shots = []; makePickups(); countdown = 3.5;
    state = "countdown"; updateCamera(0, true); scoreboardKey = "";
    if (!dedicatedMode && !onlineActive()) {
      roundSummaryEl.hidden = true;
      countdownEl.textContent = "";
      updateHud();
    }
  }
  function finishRound(winner) {
    if (state !== "racing") return;
    const finishIds = [winner.id, ...eliminationOrder.slice().reverse()];
    roundResults = finishIds.map((id, index) => {
      const car = cars.find(c => c.id === id);
      const delta = pointDelta(index + 1);
      car.points += delta;
      return { id, place: index + 1, delta, points: car.points, name: car.name };
    });
    roundWinnerId = winner.id;
    roundAnchor = { x: winner.x, y: winner.y, distance: winner.trackDistance };
    const champion = [...cars].sort((a, b) => b.points - a.points ||
      finishIds.indexOf(a.id) - finishIds.indexOf(b.id))[0];
    if (champion.points >= WINNING_SCORE) {
      matchWinnerId = champion.id; state = "finished";
    } else {
      state = "roundEnd"; roundDelay = 0; roundReady.clear();
    }
    scoreboardKey = "";
    if (dedicatedMode) return;
    resetTouchControls();
    if (state === "roundEnd") resetReadyPedals();
    if (onlineActive()) return;
    updateHud(); renderRoundSummary();
    if (state === "finished") {
      document.body.classList.remove("race-active");
      pauseButton.hidden = true;
      showMenu("KONIEC <em>MECZU.</em>",
        "{name} zdobywa {points} punktów. Koniec po {round} rundach.", "NOWY MECZ", true,
        { name: driverLabel(champion), points: champion.points, round: matchRound });
      renderFinalScores();
      roundSummaryEl.hidden = true;
      tone(champion.human ? 880 : 280, 0.35, "sine");
    }
  }
  function allRoundReady() {
    return cars.filter(car => car.human).every(car => roundReady.has(car.id));
  }
  function raceStandings() {
    return cars.filter(car => !car.eliminated)
      .sort((a, b) => (b.raceProgress ?? 0) - (a.raceProgress ?? 0) || a.id - b.id);
  }
  function cameraTarget(standings = raceStandings()) {
    const focus = standings.slice(0, 2);
    if (!focus.length) return { x: W / 2, y: H / 2, scale: 1 };
    const minX = Math.min(...focus.map(car => car.x));
    const maxX = Math.max(...focus.map(car => car.x));
    const minY = Math.min(...focus.map(car => car.y));
    const maxY = Math.max(...focus.map(car => car.y));
    const baseZoom = Math.max(viewW, viewH) / CAMERA_MAX_SPAN;
    const fitZoom = Math.min(viewW / (maxX - minX + 220),
      viewH / (maxY - minY + 170));
    // If the leaders separate too far, hold the 20-car maximum instead
    // of revealing the entire track to fit them both.
    const scale = clamp(fitZoom / baseZoom, 1, CAMERA_MAX_SCALE);
    // Keep the leader safely inside the frame even if both cars cannot fit.
    // Inertia otherwise makes the leading (moving) driver fall off first.
    const visibleW = viewW / (baseZoom * scale);
    const visibleH = viewH / (baseZoom * scale);
    const safeX = Math.max(0, visibleW / 2 - CAR_LENGTH * 2);
    const safeY = Math.max(0, visibleH / 2 - CAR_LENGTH * 2);
    const leader = focus[0];
    return {
      x: clamp((minX + maxX) / 2, leader.x - safeX, leader.x + safeX),
      y: clamp((minY + maxY) / 2, leader.y - safeY, leader.y + safeY),
      scale
    };
  }
  function cameraBounds() {
    const zoom = Math.max(viewW, viewH) / CAMERA_MAX_SPAN * camera.scale;
    return { halfW: viewW / (2 * zoom), halfH: viewH / (2 * zoom), zoom };
  }
  function keepLeaderInFrame(leader, { halfW, halfH } = cameraBounds()) {
    if (!leader) return;
    const safeX = Math.max(0, halfW - CAR_LENGTH * 0.8);
    const safeY = Math.max(0, halfH - CAR_LENGTH * 0.8);
    camera.x = clamp(camera.x, leader.x - safeX, leader.x + safeX);
    camera.y = clamp(camera.y, leader.y - safeY, leader.y + safeY);
  }
  function updateCamera(dt, instant = false, standings = raceStandings()) {
    // Show the whole compact starting grid during countdown; race camera then follows the leaders.
    const target = state === "countdown" && standings.length ? {
      x: (Math.min(...standings.map(c => c.x)) + Math.max(...standings.map(c => c.x))) / 2,
      y: (Math.min(...standings.map(c => c.y)) + Math.max(...standings.map(c => c.y))) / 2, scale: 1
    } : cameraTarget(standings);
    const positionBlend = instant ? 1 : 1 - Math.exp(-4.8 * dt);
    const zoomBlend = instant ? 1 : 1 - Math.exp(-3.2 * dt);
    camera.scale += (target.scale - camera.scale) * zoomBlend;
    camera.x += (target.x - camera.x) * positionBlend;
    camera.y += (target.y - camera.y) * positionBlend;
    const { halfW, halfH } = cameraBounds();
    camera.x = halfW >= W / 2 ? W / 2 : clamp(camera.x, halfW, W - halfW);
    camera.y = halfH >= H / 2 ? H / 2 : clamp(camera.y, halfH, H - halfH);
    keepLeaderInFrame(standings[0], { halfW, halfH });
  }
  function eliminateOutsideCamera(standings = raceStandings()) {
    if (standings.length < 2) return null;
    const { halfW, halfH } = cameraBounds();
    // Process simultaneous edge touches from last place up to second place.
    let survivors = standings.length;
    for (let i = standings.length - 1; i > 0; i--) {
      const car = standings[i];
      if (Math.abs(car.x - camera.x) < halfW - CAR_LENGTH * 0.53 &&
          Math.abs(car.y - camera.y) < halfH - CAR_LENGTH * 0.53) continue;
      car.eliminated = true;
      eliminationOrder.push(car.id);
      survivors--;
      if (!dedicatedMode && !onlineActive() && car.human)
        announce("P{number} ODPADA!", { number: car.id + 1 });
    }
    return survivors === 1 ? standings[0] : null;
  }
  function updateHud() {
    const p1 = cars[onlineActive() && onlinePlayerSlot >= 0 ? onlinePlayerSlot : 0];
    if (!p1) return;
    const survivors = onlineActive() ? onlineStandings : raceStandings();
    const leader = survivors[0];
    if (!dedicatedMode) renderScoreboard(leader?.id);
    weaponEl.textContent = p1.gun ? t(WEAPONS[p1.weapon]?.label || "BROŃ") + " × " + p1.gun : p1.turbo > 0 ? "TURBO!" : "—";
  }
  function setDriverName(id, value) {
    const name = normalizeDriverName(value);
    savedDriverNames[id] = name;
    const car = cars[id];
    if (car && car.human) car.name = name;
    if (id === 0 || (onlineActive() && id === onlinePlayerSlot)) {
      savedDriverNames[0] = name;
      try { localStorage.setItem("mikro-sprint-player-name", name); } catch {}
    }
    if (onlineActive() && onlineConnected && id === onlinePlayerSlot) {
      online.sendInput({ kind: "input", seq: ++onlineSequence, dx: 0, dy: 0, gas: 0, brake: 0, fire: false, name });
    }
    const menuInput = document.querySelector("#driver-name-" + (id + 1));
    if (menuInput && menuInput !== document.activeElement) menuInput.value = name;
    scoreboardKey = "";
    if (car?.human) updateHud();
  }
  function renderNameFields() {
    if (!driverFieldsEl) return;
    const isOnline = onlineActive() || state === "waiting";
    const count = state === "menu" ? Math.max(1, Number(playerSelect.value) || 1) : humans;
    const ids = isOnline ? [Math.max(0, onlinePlayerSlot)] : Array.from({ length: count }, (_, i) => i);
    driverFieldsEl.replaceChildren();
    for (const id of ids) {
      const label = document.createElement("label");
      label.textContent = "P" + (id + 1);
      const input = document.createElement("input");
      input.id = "driver-name-" + (id + 1);
      input.type = "text"; input.maxLength = 18;
      input.autocomplete = id === 0 ? "nickname" : "off";
      input.placeholder = "P" + (id + 1);
      input.value = savedDriverNames[id];
      input.addEventListener("input", () => setDriverName(id, input.value));
      label.appendChild(input);
      driverFieldsEl.appendChild(label);
    }
  }
  function rankedScores() {
    return [...cars].sort((a, b) => (b.points || 0) - (a.points || 0) ||
      (roundResults.find(r => r.id === a.id)?.place ?? 999) -
      (roundResults.find(r => r.id === b.id)?.place ?? 999) || a.id - b.id);
  }
  function scoreMarker(car, leaderId) {
    const marker = document.createElement("span");
    marker.className = "score-marker";
    if (car.eliminated || car.id === leaderId) {
      marker.textContent = car.eliminated ? "✕" : "♛";
      marker.classList.add(car.eliminated ? "score-out" : "score-leader");
      marker.title = t(car.eliminated ? "Odpadł" : "LIDER") + ": " + driverLabel(car);
      marker.setAttribute("aria-label", marker.title);
    }
    return marker;
  }
  function makeScoreRow(car, allowEdit = false, leaderId) {
    const row = document.createElement("tr");
    row.dataset.carId = String(car.id);
    if (car.eliminated) row.classList.add("score-eliminated");
    if (car.id === matchWinnerId) row.classList.add("score-champion");
    const place = document.createElement("td");
    place.textContent = String(rankedScores().findIndex(c => c.id === car.id) + 1);
    place.appendChild(scoreMarker(car, leaderId));
    place.style.borderLeft = "4px solid " + colors[car.id];
    const nameCell = document.createElement("td");
    if (allowEdit && car.human && (!onlineActive() || car.id === onlinePlayerSlot)) {
      const input = document.createElement("input");
      input.type = "text"; input.maxLength = 18;
      input.className = "score-name-input"; input.id = "score-name-" + car.id;
      input.autocomplete = "nickname";
      input.setAttribute("aria-label", t("Imię kierowcy {number}", { number: car.id + 1 }));
      input.value = savedDriverNames[car.id] || "";
      input.placeholder = car.human ? "P" + (car.id + 1) : "BOT " + (car.id + 1);
      input.addEventListener("input", () => setDriverName(car.id, input.value));
      nameCell.appendChild(input);
    } else nameCell.textContent = driverLabel(car);
    const points = document.createElement("td");
    points.textContent = String(car.points ?? 0);
    points.className = "score-value";
    row.append(place, nameCell, points);
    return row;
  }
  function toggleScoreboard() {
    const expanded = scoreboardToggleEl.getAttribute("aria-expanded") !== "true";
    scoreboardToggleEl.setAttribute("aria-expanded", String(expanded));
    scoreboardEl.classList.toggle("is-collapsed", !expanded);
    scoreboardDetailsEl.hidden = !expanded;
    scoreboardKey = "";
    renderScoreboard();
  }
  function renderScoreboard(leaderId = (onlineActive() ? onlineStandings : raceStandings())[0]?.id) {
    if (dedicatedMode || !scoreboardEl) return;
    scoreboardEl.hidden = !["racing", "countdown", "roundEnd", "finished"].includes(state);
    if (scoreboardEl.hidden) return;
    const editing = document.activeElement?.classList?.contains("score-name-input");
    const sorted = rankedScores();
    const key = state + ":" + matchRound + ":" + leaderId + ":" + sorted.map(car =>
      car.id + "/" + car.points + "/" + car.name + "/" + car.eliminated + "/" + car.human).join("|");
    if (key === scoreboardKey) return;
    scoreboardKey = key;
    const expanded = scoreboardToggleEl.getAttribute("aria-expanded") === "true";
    scoreboardToggleEl.setAttribute("aria-label", expanded ? t("Zwiń tabelę wyników") :
      t("Rozwiń tabelę wyników. Klasyfikacja: {names}", { names: sorted.map(driverLabel).join(", ") }));
    scoreboardColorsEl.replaceChildren(...sorted.map(car => {
      const color = document.createElement("span");
      color.className = "score-color";
      color.style.backgroundColor = colors[car.id];
      color.title = driverLabel(car);
      color.dataset.carId = String(car.id);
      const item = document.createElement("span");
      item.className = "score-color-row";
      item.append(scoreMarker(car, leaderId), color);
      return item;
    }));
    scoreboardEl.querySelector(".score-round").textContent = t("RUNDA {round} · DO 10 PKT", { round: matchRound });
    if (expanded && !editing) scoreboardBodyEl.replaceChildren(...sorted.map(car => makeScoreRow(car, true, leaderId)));
    else if (expanded) { scoreboardKey = ""; for (const row of scoreboardBodyEl.rows) { const id = Number(row.dataset.carId); const car = cars[id]; if (car) row.cells[0].querySelector(".score-marker")?.replaceWith(scoreMarker(car, leaderId)); } }
  }
  function renderRoundSummary() {
    if (dedicatedMode || !roundSummaryEl) return;
    roundSummaryEl.hidden = !(state === "roundEnd" || state === "finished");
    if (roundSummaryEl.hidden) return;
    const champion = cars.find(car => car.id === matchWinnerId);
    roundTitleEl.textContent = champion
      ? t("MECZ WYGRYWA {name}", { name: driverLabel(champion) })
      : t("RUNDA {round} — WYNIKI", { round: matchRound });
    roundSummaryEl.querySelector("p").textContent = champion
      ? t("Pierwsze 10 punktów zdobyte — koniec meczu.")
      : t("Kolejna runda po potwierdzeniu wszystkich graczy.");
    const table = document.createElement("table");
    table.className = "round-score-table";
    for (const result of [...roundResults].sort((a, b) => a.place - b.place)) {
      const row = document.createElement("tr");
      const car = cars.find(c => c.id === result.id);
      for (const value of [result.place + ".", car ? driverLabel(car) : "P" + (result.id + 1),
        (result.delta > 0 ? "+" : "") + result.delta,
        t("{points} pkt", { points: result.points })]) {
        const td = document.createElement("td");
        td.textContent = String(value);
        row.appendChild(td);
      }
      table.appendChild(row);
    }
    roundResultsEl.replaceChildren(table);
    renderRoundReady();
  }
  function readyDrivers() {
    return cars.filter(car => car.human && (!onlineActive() || car.id === onlinePlayerSlot));
  }
  function readyPedal(input) {
    return input.brake > 0.2 ? "cancel" : input.gas > 0.2 ? "confirm" : null;
  }
  function resetReadyPedals() {
    readyPedalStates.clear();
    for (const car of readyDrivers()) readyPedalStates.set(car.id, readyPedal(readInput(car)));
  }
  function setRoundReady(id, ready) {
    if (state !== "roundEnd" || settingsOpen || !cars[id]?.human) return;
    if (onlineActive()) {
      if (!onlineConnected || id !== onlinePlayerSlot) return;
      const current = pendingReady?.round === matchRound ? pendingReady.ready : roundReady.has(id);
      if (current === ready) return;
      const seq = ++onlineSequence;
      pendingReady = { round: matchRound, ready, seq };
      online.sendInput({ kind: "input", seq, readyRound: matchRound, ready });
    } else {
      if (ready) roundReady.add(id);
      else roundReady.delete(id);
    }
    renderRoundReady();
  }
  function pollRoundReady() {
    if (settingsOpen) return;
    for (const car of readyDrivers()) {
      const pedal = readyPedal(readInput(car));
      const previous = readyPedalStates.get(car.id);
      readyPedalStates.set(car.id, pedal);
      if (previous !== undefined && pedal && pedal !== previous) setRoundReady(car.id, pedal === "confirm");
    }
  }
  function renderRoundReady() {
    if (!roundReadyEl) return;
    roundReadyEl.hidden = state !== "roundEnd";
    if (roundReadyEl.hidden) { readyKey = ""; return; }
    const humans = cars.filter(car => car.human);
    const isReady = car => onlineActive() && car.id === onlinePlayerSlot && pendingReady?.round === matchRound
      ? pendingReady.ready : roundReady.has(car.id);
    const key = [matchRound, ...humans.map(car => car.id + ":" + isReady(car) + ":" + car.name)].join("|");
    if (key === readyKey) return;
    readyKey = key;
    const status = document.createElement("p");
    status.textContent = t("Gotowi: {ready}/{total}", { ready: humans.filter(isReady).length, total: humans.length });
    const labels = humans.map(car => {
      const label = document.createElement("span");
      label.className = "round-ready-status" + (isReady(car) ? " is-ready" : "");
      label.textContent = driverLabel(car) + " · " + t(isReady(car) ? "GOTOWY" : "NIEGOTOWY");
      return label;
    });
    const hint = document.createElement("p");
    hint.textContent = t("Gaz — gotowy · Wsteczny — anuluj");
    roundReadyEl.replaceChildren(status, ...labels, hint);
  }
  function renderFinalScores() {
    if (dedicatedMode || !finalScoresEl) return;
    finalScoresEl.hidden = false;
    const heading = document.createElement("h3");
    heading.textContent = t("KOŃCOWA TABELA WYNIKÓW");
    const table = document.createElement("table");
    table.className = "round-score-table";
    const header = document.createElement("tr");
    for (const label of ["MIEJSCE", "KIEROWCA", "PKT"]) {
      const cell = document.createElement("td"); cell.textContent = t(label); cell.className = "score-value";
      header.appendChild(cell);
    }
    table.appendChild(header);
    rankedScores().forEach(car => {
      const row = makeScoreRow(car);
      row.firstElementChild.textContent += ".";
      table.appendChild(row);
    });
    finalScoresEl.replaceChildren(heading, table);
  }
  function readInput(car) {
    if (!car.human) return botInput(car);
    if (dedicatedMode) {
      const input = dedicatedInputs.get(car.id);
      if (!input) return { dx: 0, dy: 0, gas: 0, brake: 0, fire: false };
      car.lastAppliedInputSeq = input.seq;
      return input;
    }
    if (settingsOpen) return { dx: 0, dy: 0, gas: 0, brake: 0, fire: false };
    // Drivers P5–P8 use their own gamepads instead of a shared keyboard.
    const binding = playerKeys[onlineActive() ? 0 : car.id] || {};
    // Horizontal input turns relative to the chassis; vertical input
    // accelerates forward or brakes/reverses along its current heading.
    let dx = Number(keys.has(binding.right)) - Number(keys.has(binding.left));
    let dy = Number(keys.has(binding.down)) - Number(keys.has(binding.up));
    let brake = Number(keys.has(binding.brake));
    let fire = keys.has(binding.fire);
    let pedalGas = 0;
    if (car.id === (onlineActive() ? onlinePlayerSlot : 0)) {
      dx += touch.x;
      // While a touch pedal is held, the joystick only steers the car.
      // Its vertical displacement must not weaken gas or brake input.
      if (!touch.gas && !touch.brake) dy += touch.y;
      pedalGas = Number(touch.gas);
      brake = Math.max(brake, Number(touch.brake));
      fire ||= touch.fire;
    }
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pads[onlineActive() ? 0 : car.id];
    if (pad && pad.connected) {
      const padX = pad.axes?.[0] || 0;
      const padY = pad.axes?.[1] || 0;
      if (Math.hypot(padX, padY) > 0.16) {
        dx = padX;
        dy = padY;
      }
      if (pad.buttons[7]) pedalGas = Math.max(pedalGas, pad.buttons[7].value);
      if (pad.buttons[0]?.pressed) pedalGas = 1;
      if (pad.buttons[6]) brake = Math.max(brake, pad.buttons[6].value);
      if (pad.buttons[1]?.pressed) brake = 1;
      fire ||= Boolean(pad.buttons[2]?.pressed || pad.buttons[5]?.pressed);
    }
    // Keep independent axis strength when keyboard keys are pressed diagonally.
    dx = clamp(dx, -1, 1);
    dy = clamp(dy, -1, 1);
    brake = Math.max(brake, dy);
    const gas = brake > 0 ? 0 : Math.max(-dy, pedalGas);
    return { dx, dy, gas, brake, fire };
  }
  function botInput(car) {
    const upcoming = point(car.index + clamp(12 + car.speed * 0.05, 12, 30));
    const target = Math.atan2(upcoming.y - car.y, upcoming.x - car.x);
    const diff = angleWrap(target - car.angle);
    const steer = clamp(diff * 2.2, -1, 1);
    const gas = Math.abs(diff) > 0.85 ? 0.55 : 1;
    const brake = Math.abs(diff) > 1.5 ? 0.65 : 0;
    car.botCooldown -= 1 / 60;
    const targetCar = cars.find(other => other !== car &&
      other.invuln <= 0 && Math.hypot(other.x - car.x, other.y - car.y) < 230 &&
      Math.abs(angleWrap(Math.atan2(other.y - car.y, other.x - car.x) - car.angle)) < 0.34);
    let fire = false;
    if (car.gun && targetCar && car.botCooldown <= 0) {
      fire = true;
      car.botCooldown = 1.3 + Math.abs(rand(raceTime + car.id)) * 1.4;
    }
    return { steer, gas, brake, fire };
  }
  function fire(car) {
    if (car.eliminated || car.gun <= 0 || car.fireCooldown > 0) return;
    const weapon = WEAPONS[car.weapon] || WEAPONS.machinegun;
    car.gun--;
    car.fireCooldown = weapon.cooldown;
    car.shotSerial = (car.shotSerial || 0) + 1;
    const shotId = matchRound + ":" + car.id + ":" + car.shotSerial;
    const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
    const emit = (kind, x, y, angle, speed, life, extra = {}) => shots.push({
      kind, shotId, owner: car.id, x, y, vx: Math.cos(angle) * speed + car.vx * 0.3,
      vy: Math.sin(angle) * speed + car.vy * 0.3, life, ...extra
    });
    // Instant-impact weapons also emit a replicated, non-colliding visual effect.
    if (["hammer", "shocker", "sonic"].includes(car.weapon)) {
      shots.push({ kind: "pulse", weapon: car.weapon, shotId, owner: car.id, x: car.x, y: car.y,
        angle: car.angle, vx: 0, vy: 0, life: 0.22 });
    }
    switch (car.weapon) {
      case "mines": case "bombs":
        shots.push({ kind: car.weapon, shotId, owner: car.id, x: car.x - fx * 29, y: car.y - fy * 29,
          vx: -fx * 25 + car.vx * 0.12, vy: -fy * 25 + car.vy * 0.12, life: 8 });
        break;
      case "hammer": {
        const target = cars.find(other => other !== car && !other.eliminated && other.invuln <= 0 &&
          Math.hypot(other.x - car.x, other.y - car.y) < 83 &&
          Math.cos(angleWrap(Math.atan2(other.y - car.y, other.x - car.x) - car.angle)) > 0.55);
        if (target) hitCar(car.id, target, fx * 370, fy * 370, 0.9);
        break;
      }
      case "shocker": {
        const target = cars.filter(other => other !== car && !other.eliminated && other.invuln <= 0)
          .sort((a, b) => Math.hypot(a.x - car.x, a.y - car.y) - Math.hypot(b.x - car.x, b.y - car.y))[0];
        if (target && Math.hypot(target.x - car.x, target.y - car.y) < 290)
          hitCar(car.id, target, (target.x - car.x) * 1.6, (target.y - car.y) * 1.6, 0.75);
        break;
      }
      case "sonic":
        cars.filter(other => other !== car && !other.eliminated && other.invuln <= 0 &&
          Math.hypot(other.x - car.x, other.y - car.y) < 330).forEach(target => {
          const dx = target.x - car.x, dy = target.y - car.y, distance = Math.hypot(dx, dy) || 1;
          hitCar(car.id, target, dx / distance * 460, dy / distance * 460, 0.7);
        });
        break;
      case "cannon":
        emit("cannon", car.x - fx * 31, car.y - fy * 31, car.angle + Math.PI,
          weapon.speed, weapon.life, { color: weapon.color, force: 1.35 });
        break;
      default: {
        const target = car.weapon === "homing"
          ? raceStandings().find(other => other !== car)
          : null;
        emit(car.weapon || "machinegun", car.x + fx * 31, car.y + fy * 31,
          target ? Math.atan2(target.y - car.y, target.x - car.x) : car.angle,
          weapon.speed, weapon.life,
          { color: weapon.color, targetId: target?.id ?? null, force: car.weapon === "plasma" ? 1.9 : 1,
            cluster: car.weapon === "cluster" });
      }
    }
    if (car.gun <= 0) car.weapon = "";
    if (car.human && car.id === (onlineActive() ? onlinePlayerSlot : 0)) tone(330, 0.07);
  }
  function hitCar(ownerId, target, impulseX, impulseY, duration = 0.65) {
    if (!target || target.eliminated || target.invuln > 0) return;
    // A predicted impact may move our own car, but never mutate a remote car.
    // Remote hits, points and eliminations are committed by server snapshots.
    if (!dedicatedMode && onlineActive() && target.id !== onlinePlayerSlot) return;
    target.vx += impulseX; target.vy += impulseY;
    target.hit = duration; target.invuln = Math.max(target.invuln, 0.45);
    if (target.human && target.id === 0) { announce("TRAFIENIE!"); tone(110, 0.2); }
  }
  function burst(shot) {
    const radius = shot.cluster ? 165 : 110;
    for (const car of cars) {
      if (car.id === shot.owner || car.eliminated || car.invuln > 0) continue;
      const dx = car.x - shot.x, dy = car.y - shot.y, distance = Math.hypot(dx, dy);
      if (distance > radius) continue;
      const scale = (1 - distance / radius) * (shot.cluster ? 390 : 300) / (distance || 1);
      hitCar(shot.owner, car, dx * scale, dy * scale, 0.8);
    }
    if (shot.cluster) for (let i = 0; i < 5; i++) {
      const angle = i * Math.PI * 2 / 5;
      shots.push({ kind: "fragment", shotId: shot.shotId ? shot.shotId + ":" + i : undefined, owner: shot.owner, x: shot.x, y: shot.y,
        vx: Math.cos(angle) * 510, vy: Math.sin(angle) * 510, life: 0.42,
        color: WEAPONS.cluster.color, force: 0.65 });
    }
  }
  function resetCar(car) {
    const pos = pointAtDistance(car.trackDistance);
    car.x = pos.x; car.y = pos.y; car.angle = pos.angle; car.index = pos.index;
    car.vx = 0; car.vy = 0; car.speed = 0;
    car.offroad = 0; car.invuln = 1.7; car.hit = 0;
    if (car.human && car.id === 0) announce("POWRÓT NA TOR");
  }
  function collectPickup(car) {
    if (car.eliminated) return;
    for (const item of pickups) {
      if (item.cooldown > 0 || Math.hypot(item.x - car.x, item.y - car.y) > 37) continue;
      item.cooldown = 9;
      if (item.type === "turbo") {
        car.turbo = 1.85;
        if (car.id === 0) announce("TURBO! PRZYSPIESZENIE");
      } else {
        car.weapon = item.weaponType;
        car.gun = WEAPONS[item.weaponType]?.ammo || 3;
        car.fireCooldown = 0;
        if (car.id === 0) announce("{weapon} × {count}", { weapon: t(WEAPONS[item.weaponType].label), count: car.gun });
      }
      item.cycle++;
      item.weaponType = PICKUP_ROTATION[item.cycle % PICKUP_ROTATION.length];
      if (car.human) tone(item.type === "turbo" ? 770 : 410, 0.17, "sine");
    }
  }
  function updateBot(car, dt) {
    const previousX = car.x, previousY = car.y;
    const current = pointAtDistance(car.botDistance);
    const previousLane = (car.id % 2 ? 21 : -21) + 5 * Math.sin(car.botDistance / 160 + car.id);
    const offsetX = car.x - (current.x - Math.sin(current.angle) * previousLane);
    const offsetY = car.y - (current.y + Math.cos(current.angle) * previousLane);
    const next = pointAtDistance(car.botDistance + 100);
    const bend = Math.abs(angleWrap(next.angle - current.angle));
    const top = (270 + car.id * 12) / (1 + bend * 0.45);
    const targetSpeed = top * (car.hit > 0 ? 0.48 : car.turbo > 0 ? 1.36 : 1);
    car.botSpeed += clamp(targetSpeed - car.botSpeed, -420 * dt, 480 * dt);
    car.botDistance += car.botSpeed * dt;
    const p = pointAtDistance(car.botDistance);
    const lane = (car.id % 2 ? 21 : -21) + 5 * Math.sin(car.botDistance / 160 + car.id);
    // Recover gradually towards the racing line instead of teleporting back.
    const recovery = Math.exp(-3 * dt);
    car.x = p.x - Math.sin(p.angle) * lane + (offsetX + car.botPushX * dt) * recovery;
    car.y = p.y + Math.cos(p.angle) * lane + (offsetY + car.botPushY * dt) * recovery;
    car.botPushX *= Math.exp(-5 * dt);
    car.botPushY *= Math.exp(-5 * dt);
    car.angle = p.angle;
    car.vx = (car.x - previousX) / Math.max(dt, 0.001);
    car.vy = (car.y - previousY) / Math.max(dt, 0.001);
    car.speed = car.botSpeed;
    car.index = p.index;
    collectPickup(car);
    car.botCooldown -= dt;
    if (car.gun && car.botCooldown <= 0) {
      const target = cars.find(other => other !== car && !other.eliminated && other.invuln <= 0 &&
        Math.hypot(other.x - car.x, other.y - car.y) < 260 &&
        Math.abs(angleWrap(Math.atan2(other.y - car.y, other.x - car.x) - car.angle)) < 0.45);
      if (target) { fire(car); car.botCooldown = 1.3 + car.id * 0.2; }
    }
  }
  function updateCar(car, dt, inputOverride = null) {
    car.invuln = Math.max(0, car.invuln - dt);
    car.hit = Math.max(0, car.hit - dt);
    car.turbo = Math.max(0, car.turbo - dt);
    car.fireCooldown = Math.max(0, car.fireCooldown - dt);
    if (car.eliminated || car.finishAt !== null) return;
    if (!car.human) { updateBot(car, dt); return; }
    const onRoad = isOnRoad(car.x, car.y, car.trackDistance);
    if (onRoad) car.offroad = 0;
    else car.offroad += dt;
    // Recovery must not interrupt a moving car, including reverse or lateral drift.
    const stationary = Math.hypot(car.vx, car.vy) <= 5;
    if (stationary && (car.offroad > 0.9 || car.x < 80 || car.x > W - 80 ||
        car.y < 70 || car.y > H - 70 ||
        course.pits.some(p => Math.hypot(car.x - p[0], car.y - p[1]) < 56))) {
      resetCar(car); return;
    }
    const input = inputOverride || readInput(car);
    if (input.fire) fire(car);
    car.actionHeld = input.fire;
    const moving = Math.hypot(car.vx, car.vy);
    const traction = selectedTrack === "bath" ? 3.45 : 5.2;
    const steering = (2.65 + (car.turbo > 0 ? 0.26 : 0)) * clamp(moving / 85, 0.25, 1);
    steerCarRelative(car, input.dx, dt, steering);
    const acceleration = (car.turbo > 0 ? 580 : 410) * (onRoad ? 1 : 0.42);
    const ax = Math.cos(car.angle), ay = Math.sin(car.angle);
    const drag = 0.63 + (input.gas ? 0.1 : 1.35) + (onRoad ? 0 : 2.6);
    car.vx += ax * (input.gas * acceleration - input.brake * 340) * dt;
    car.vy += ay * (input.gas * acceleration - input.brake * 340) * dt;
    const forward = car.vx * ax + car.vy * ay, sidewaysX = car.vx - forward * ax, sidewaysY = car.vy - forward * ay;
    const grip = clamp(traction * dt, 0, 1);
    car.vx -= sidewaysX * grip; car.vy -= sidewaysY * grip;
    car.vx *= Math.exp(-drag * dt); car.vy *= Math.exp(-drag * dt);
    const topSpeed = (car.turbo > 0 ? 565 : 392) * (onRoad ? 1 : 0.55);
    car.speed = Math.hypot(car.vx, car.vy);
    if (car.speed > topSpeed) {
      const scale = topSpeed / car.speed;
      car.vx *= scale; car.vy *= scale; car.speed = topSpeed;
    }
    car.x += car.vx * dt; car.y += car.vy * dt;
    collectPickup(car);
    for (const obstacle of course.objects) {
      const dx = car.x - obstacle.x, dy = car.y - obstacle.y;
      const d = Math.hypot(dx, dy), minDist = obstacle.r + 20;
      if (d >= minDist || d < 0.001) continue;
      const nx = dx / d, ny = dy / d, impact = car.vx * nx + car.vy * ny;
      car.x += nx * (minDist - d); car.y += ny * (minDist - d);
      if (impact < 0) {
        car.vx -= nx * impact * 1.75; car.vy -= ny * impact * 1.75;
        car.vx *= 0.62; car.vy *= 0.62;
        if (car.human && car.id === 0 && car.hit <= 0) tone(130, 0.09);
        car.hit = 0.16;
      }
    }
    // Keep the car inside the world while allowing it to drive back onto the track.
    if (car.x < 0 || car.x > W) { car.x = clamp(car.x, 0, W); car.vx = 0; }
    if (car.y < 0 || car.y > H) { car.y = clamp(car.y, 0, H); car.vy = 0; }
    car.speed = Math.hypot(car.vx, car.vy);
  }
  function resolveCarContact(a,b) {
    if (a.eliminated || b.eliminated) return false;
    const dx = b.x-a.x, dy = b.y-a.y;
    // Broad phase: the diagonal of two 47 x 26 bodies.
    if (dx*dx+dy*dy >= 54*54) return false;
    const ax = Math.cos(a.angle), ay = Math.sin(a.angle);
    const bx = Math.cos(b.angle), by = Math.sin(b.angle);
    const axes = [[ax,ay],[-ay,ax],[bx,by],[-by,bx]];
    let depth = Infinity, nx = 0, ny = 0;
    for (const [x,y] of axes) {
      const ra = 23.5*Math.abs(x*ax+y*ay)+13*Math.abs(-x*ay+y*ax);
      const rb = 23.5*Math.abs(x*bx+y*by)+13*Math.abs(-x*by+y*bx);
      const along = dx*x+dy*y;
      const overlap = ra+rb-Math.abs(along);
      if (overlap <= 0) return false;
      if (overlap < depth) {
        depth = overlap;
        const sign = along < 0 ? -1 : 1;
        nx = x*sign; ny = y*sign;
      }
    }
    // Equal mass, positional slop to avoid chatter at resting contacts.
    const correction = Math.max(0,depth-0.05)*0.5;
    a.x -= nx*correction; a.y -= ny*correction;
    b.x += nx*correction; b.y += ny*correction;
    const rvx = b.vx-a.vx, rvy = b.vy-a.vy;
    const normalSpeed = rvx*nx+rvy*ny;
    if (normalSpeed >= 0) return true;
    // Low-speed contacts do not bounce; faster impacts retain some elasticity.
    const impulse = -normalSpeed*(1+(normalSpeed < -35 ? 0.25 : 0))*0.5;
    const tx = -ny, ty = nx;
    const tangent = Math.max(-0.2*impulse,Math.min(0.2*impulse,-(rvx*tx+rvy*ty)*0.5));
    const ix = nx*impulse+tx*tangent, iy = ny*impulse+ty*tangent;
    for (const [car,s] of [[a,-1],[b,1]]) {
      const dvx = s*ix, dvy = s*iy;
      car.vx += dvx; car.vy += dvy;
      car.speed = Math.hypot(car.vx,car.vy);
      if (!car.human) {
        const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
        const forward = dvx*fx+dvy*fy;
        car.botSpeed = Math.max(0,car.botSpeed+forward);
        car.botPushX = (car.botPushX || 0)+dvx-forward*fx;
        car.botPushY = (car.botPushY || 0)+dvy-forward*fy;
      }
    }
    return true;
  }
  function updateCollisions() {
    // Multiple passes settle clusters without depending on one pair order.
    for (let pass = 0; pass < 4; pass++) {
      for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) {
        resolveCarContact(cars[i], cars[j]);
      }
    }
  }
  function updateShots(dt) {
    for (const shot of shots) {
      shot.life -= dt;
      if (shot.kind === "pulse") continue; // Visual only; damage is resolved by fire().
      if (shot.kind === "mines" || shot.kind === "bombs") {
        shot.x += shot.vx * dt; shot.y += shot.vy * dt;
        shot.vx *= Math.exp(-2.2 * dt); shot.vy *= Math.exp(-2.2 * dt);
        const target = cars.find(car => car.id !== shot.owner && !car.eliminated &&
          Math.hypot(car.x - shot.x, car.y - shot.y) < (shot.kind === "bombs" ? 68 : 45));
        if (target || shot.life <= 0) { burst(shot); shot.life = 0; }
        continue;
      }
      if (shot.kind === "homing" && shot.targetId !== null) {
        const target = cars.find(car => car.id === shot.targetId && !car.eliminated);
        if (target) {
          const angle = Math.atan2(target.y - shot.y, target.x - shot.x);
          const speed = Math.hypot(shot.vx, shot.vy) || WEAPONS.homing.speed;
          const turn = Math.min(1, dt * 3.5), current = Math.atan2(shot.vy, shot.vx);
          const next = current + angleWrap(angle - current) * turn;
          shot.vx = Math.cos(next) * speed; shot.vy = Math.sin(next) * speed;
        }
      }
      shot.x += shot.vx * dt; shot.y += shot.vy * dt;
      if (shot.x < 0 || shot.y < 0 || shot.x > W || shot.y > H) shot.life = 0;
      if (course.objects.some(o => Math.hypot(o.x - shot.x, o.y - shot.y) < o.r)) shot.life = 0;
      let collided = false;
      for (const car of cars) {
        if (car.eliminated || car.id === shot.owner || car.invuln > 0 ||
            Math.hypot(car.x - shot.x, car.y - shot.y) > 25) continue;
        if (shot.cluster) burst(shot);
        else hitCar(shot.owner, car, shot.vx * 0.52 * (shot.force || 1),
          shot.vy * 0.52 * (shot.force || 1), shot.kind === "flame" ? 0.8 : 0.6);
        shot.life = 0; collided = true; break;
      }
      if (shot.life <= 0 && shot.cluster && !collided) burst(shot);
    }
    shots = shots.filter(shot => shot.life > 0);
  }
  function predictOnlineStep(car, dt, input) {
    for (const item of pickups) item.cooldown = Math.max(0, item.cooldown - dt);
    updateCar(car, dt, input);
    updateRaceProgress(car);
    // Same projectile integrator as the server. Reconciliation replaces this
    // speculative world with authority before replaying pending inputs.
    updateShots(dt);
  }
  function step(dt) {
    if (onlineActive()) {
      if (!onlineConnected || onlinePlayerSlot < 0 || !cars[onlinePlayerSlot]) return;
      if (state === "countdown") {
        countdown = Math.max(0, countdown - dt);
        countdownEl.textContent = countdown > 0 ? Math.ceil(countdown) : t("GO!");
        return;
      }
      if (state === "roundEnd") { pollRoundReady(); return; }
      if (state !== "racing") return;
      const car = cars[onlinePlayerSlot];
      const input = readInput(car);
      const packet = { kind: "input", seq: ++onlineSequence, round: matchRound,
        dx: input.dx, dy: input.dy, gas: input.gas,
        brake: input.brake, fire: input.fire,
        name: savedDriverNames[onlinePlayerSlot] || "" };
      if (!car.eliminated) pendingInputs.push({ ...packet, dt });
      if (pendingInputs.length > 180) pendingInputs.shift();
      online.sendInput(packet);
      if (onlineSequence % 120 === 0) online.sendPing(performance.now());
      raceTime += dt;
      predictOnlineStep(car, dt, input);
      uiTime -= dt;
      if (uiTime <= 0) { uiTime = 0.1; updateHud(); }
      return;
    }
    if (settingsOpen) return; // The local match pauses without changing its phase.
    if (state === "countdown") {
      updateCamera(dt);
      countdown -= dt;
      const number = Math.ceil(countdown);
      countdownEl.textContent = number > 0 ? number : t("GO!");
      if (countdown <= -0.48) {
        countdownEl.textContent = "";
        state = "racing";
        tone(920, 0.23);
      }
      return;
    }
    if (state === "roundEnd") {
      if (!dedicatedMode) pollRoundReady();
      if (allRoundReady()) beginNextRound();
      return;
    }
    if (state !== "racing") return;
    raceTime += dt; roundElapsed += dt;
    for (const item of pickups) item.cooldown = Math.max(0, item.cooldown - dt);
    cars.forEach(car => updateCar(car, dt));
    updateCollisions();
    updateShots(dt);
    cars.forEach(updateRaceProgress);
    const standings = raceStandings();
    updateCamera(dt, false, standings);
    const winner = roundElapsed > 0.8 ? eliminateOutsideCamera(standings) : null;
    if (winner) { finishRound(winner); return; }
    uiTime -= dt;
    if (uiTime <= 0) { uiTime = 0.1; updateHud(); }
  }
  function pathLine(g) {
    const points = course.path;
    g.beginPath();
    g.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y);
    g.closePath();
  }
  function ellipse(g, x, y, rx, ry, fill) {
    g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    if (fill) { g.fillStyle = fill; g.fill(); }
  }
  function rounded(g, x, y, w, h, r, fill) {
    g.beginPath(); g.roundRect(x, y, w, h, r);
    g.fillStyle = fill; g.fill();
  }
  function drawPool(g) {
    const wood = g.createLinearGradient(0, 0, BASE_W, BASE_H);
    wood.addColorStop(0, "#683b29"); wood.addColorStop(0.5, "#b08152"); wood.addColorStop(1, "#4b2b24");
    g.fillStyle = "#131b24"; g.fillRect(0, 0, BASE_W, BASE_H);
    rounded(g, 56, 58, 1488, 864, 70, "#1b1716");
    rounded(g, 69, 63, 1462, 852, 61, wood);
    rounded(g, 119, 115, 1362, 746, 36, "#102e27");
    const felt = g.createRadialGradient(785, 450, 80, 800, 490, 790);
    felt.addColorStop(0, "#297a55"); felt.addColorStop(1, "#155035");
    rounded(g, 145, 135, 1310, 710, 25, felt);
    g.strokeStyle = "#e9ce92"; g.lineWidth = 2;
    g.strokeRect(175, 165, 1250, 650);
    for (let x = 234; x < 1400; x += 118) {
      ellipse(g, x, 97, 4, 4, "#e7cb99");
      ellipse(g, x, 879, 4, 4, "#e7cb99");
    }
    for (let i = 0; i < 130; i++) {
      const x = 145 + (i * 479) % 1310, y = 135 + (i * 307) % 710;
      ellipse(g, x, y, 1.3, 1.3, "#ffffff0a");
    }
    g.strokeStyle = "#ffffff17"; g.lineWidth = 3;
    g.beginPath(); g.moveTo(800, 165); g.lineTo(800, 815); g.stroke();
  }
  function drawBath(g) {
    const tile = g.createLinearGradient(0, 0, BASE_W, BASE_H);
    tile.addColorStop(0, "#b3ccd4"); tile.addColorStop(1, "#728f9b");
    g.fillStyle = tile; g.fillRect(0, 0, BASE_W, BASE_H);
    g.strokeStyle = "#ffffff35"; g.lineWidth = 4;
    for (let x = 0; x < BASE_W; x += 155) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, BASE_H); g.stroke(); }
    for (let y = 0; y < BASE_H; y += 155) { g.beginPath(); g.moveTo(0, y); g.lineTo(BASE_W, y); g.stroke(); }
    g.save(); g.shadowColor = "#263c5075"; g.shadowBlur = 32; g.shadowOffsetY = 20;
    ellipse(g, 800, 487, 760, 431, "#f4f5ed"); g.restore();
    ellipse(g, 800, 487, 727, 396, "#dce8e7");
    const water = g.createRadialGradient(640, 300, 70, 850, 500, 760);
    water.addColorStop(0, "#9adae3"); water.addColorStop(0.62, "#6ebfcf"); water.addColorStop(1, "#3e96b6");
    ellipse(g, 800, 487, 690, 359, water);
    g.strokeStyle = "#ddf7f48a"; g.lineWidth = 4;
    for (let i = 0; i < 31; i++) {
      const x = 195 + ((i * 269) % 1220), y = 192 + ((i * 173) % 570);
      g.beginPath(); g.ellipse(x, y, 24 + i % 4 * 13, 8 + i % 3 * 4, i * 0.65, 0, 4.6); g.stroke();
    }
    for (let i = 0; i < 52; i++) {
      const x = 180 + ((i * 391) % 1210), y = 165 + ((i * 211) % 615);
      if (Math.pow((x - 800) / 700, 2) + Math.pow((y - 490) / 364, 2) > 1) continue;
      ellipse(g, x, y, 4 + i % 5, 4 + i % 5, "#e4ffff6b");
    }
    rounded(g, 1348, 770, 100, 62, 22, "#e6efef");
    ellipse(g, 1398, 803, 23, 23, "#657c7d");
    g.strokeStyle = "#cdd6d7"; g.lineWidth = 15; g.lineCap = "round";
    g.beginPath(); g.moveTo(1398, 792); g.lineTo(1398, 726); g.quadraticCurveTo(1389, 686, 1340, 695); g.stroke();
    g.lineCap = "butt";
  }
  function drawObject(g, o) {
    g.save(); g.translate(o.x, o.y);
    g.shadowColor = "#09161d80"; g.shadowBlur = 12; g.shadowOffsetY = 8;
    if (o.type === "ball") {
      ellipse(g, 0, 0, o.r, o.r, o.color);
      g.shadowColor = "transparent";
      ellipse(g, -7, -11, o.r * 0.35, o.r * 0.26, "#ffffff55");
      ellipse(g, 6, 6, 12, 12, "#f5f3e5");
      g.fillStyle = "#21242c"; g.font = "bold 15px Arial"; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(o.number, 6, 7);
    } else if (o.type === "duck") {
      ellipse(g, -2, 12, 45, 32, "#f5bb3a");
      ellipse(g, 22, -13, 26, 27, "#ffd955");
      ellipse(g, 30, -20, 4, 4, "#172b33");
      rounded(g, 37, -4, 25, 11, 5, "#ec8034");
      g.shadowColor = "transparent";
      ellipse(g, -12, 9, 17, 12, "#e9a229");
    } else if (o.type === "soap") {
      g.rotate(-0.23); rounded(g, -38, -24, 76, 48, 18, "#f9d8e1");
      g.shadowColor = "transparent"; rounded(g, -28, -16, 53, 27, 11, "#ffdce8");
      g.fillStyle = "#bb859f"; g.font = "bold 12px sans-serif"; g.textAlign = "center"; g.fillText("SOAP", 0, 5);
    } else {
      g.rotate(0.35); rounded(g, -38, -28, 76, 56, 10, "#f2d18b");
      g.shadowColor = "transparent"; g.strokeStyle = "#b9984b"; g.lineWidth = 2;
      for (let i = -25; i <= 25; i += 13) {
        g.beginPath(); g.moveTo(i, -19); g.lineTo(i + 14, 18); g.stroke();
      }
    }
    g.restore();
  }
  function drawRoad(g) {
    const width = course.roadWidth;
    g.save(); g.lineJoin = "round"; g.lineCap = "round";
    pathLine(g); g.strokeStyle = "#0d1a1e80"; g.lineWidth = width + 26; g.stroke();
    pathLine(g); g.strokeStyle = selectedTrack === "pool" ? "#c4ad67" : "#eaf6ee"; g.lineWidth = width + 11; g.stroke();
    pathLine(g); g.strokeStyle = selectedTrack === "pool" ? "#365c49" : "#89d0d5"; g.lineWidth = width - 5; g.stroke();
    pathLine(g); g.strokeStyle = selectedTrack === "pool" ? "#3c7051" : "#d3e9df"; g.lineWidth = width - 29; g.stroke();
    pathLine(g); g.setLineDash([17, 24]); g.strokeStyle = selectedTrack === "pool" ? "#f6f0c45f" : "#64abc16e"; g.lineWidth = 3; g.stroke();
    g.setLineDash([]);
    const origin = point(0), a = orientation(0);
    g.save(); g.translate(origin.x, origin.y); g.rotate(a);
    for (let col = 0; col < 2; col++) for (let row = 0; row < 10; row++) {
      g.fillStyle = (col + row) % 2 ? "#fffdfa" : "#17252c";
      g.fillRect(-12 + col * 12, -width / 2 + row * width / 10, 12, width / 10);
    }
    g.restore(); g.restore();
  }
  function buildScene() {
    scene = document.createElement("canvas"); scene.width = W; scene.height = H;
    const g = scene.getContext("2d");
    g.save(); g.scale(WORLD_SCALE, WORLD_SCALE);
    if (selectedTrack === "pool") drawPool(g); else drawBath(g);
    g.restore();
    drawRoad(g);
    if (selectedTrack === "pool") for (const pit of course.pits) {
      ellipse(g, pit[0] + 4, pit[1] + 5, 53, 51, "#0a1413");
      ellipse(g, pit[0], pit[1], 45, 44, "#101b1b");
    }
    course.objects.forEach(o => drawObject(g, o));
  }
  function drawPickup(g, item, t) {
    if (item.cooldown > 0) return;
    g.save(); g.translate(item.x, item.y + Math.sin(t * 3 + item.phase) * 5);
    g.rotate(t * 0.7 + item.phase);
    const color = item.type === "turbo" ? "#dbf75d" : (WEAPONS[item.weaponType]?.color || "#f49e76");
    g.shadowColor = color; g.shadowBlur = 18;
    rounded(g, -20, -20, 40, 40, 8, item.type === "turbo" ? "#d5f66f" : color);
    g.shadowBlur = 0; g.fillStyle = "#1b2932";
    g.textAlign = "center"; g.textBaseline = "middle"; g.font = "bold 26px sans-serif";
    g.rotate(-t * 0.7 - item.phase);
    const icons = { machinegun: "✦", missile: "➤", homing: "◎", cluster: "⁕", plasma: "ϟ",
      cannon: "◂", mines: "✹", bombs: "●", hammer: "⌁", shocker: "ϟ", sonic: "◉", flame: "♨" };
    g.fillText(item.type === "turbo" ? "⚡" : (icons[item.weaponType] || "✦"), 0, 1);
    g.restore();
  }
  function drawCar(g, car, now) {
    if (car.invuln > 0 && Math.floor(now * 12) % 2 && car.offroad === 0) g.globalAlpha = 0.65;
    g.save(); g.translate(car.x, car.y); g.rotate(car.angle);
    g.shadowColor = "#06131b9c"; g.shadowBlur = 12; g.shadowOffsetY = 8;
    rounded(g, -23, -13, 47, 26, 8, "#090f14");
    g.shadowColor = "transparent"; g.shadowOffsetY = 0;
    for (const s of [-1, 1]) {
      rounded(g, -16, s * 12 - 3, 11, 8, 2, "#12161a");
      rounded(g, 11, s * 12 - 3, 11, 8, 2, "#12161a");
    }
    rounded(g, -21, -11, 43, 22, 7, colors[car.id]);
    rounded(g, -6, -10, 16, 20, 5, "#263944");
    rounded(g, -2, -8, 8, 16, 3, "#87adbd");
    rounded(g, -17, -2, 11, 4, 1, "#fbffefb8");
    rounded(g, 13, -9, 6, 4, 2, "#fffbd2");
    rounded(g, 13, 5, 6, 4, 2, "#fffbd2");
    if (car.turbo > 0) {
      g.fillStyle = "#fbab4a"; g.beginPath();
      g.moveTo(-23, -6); g.lineTo(-35 - Math.random() * 14, 0); g.lineTo(-23, 6); g.fill();
    }
    if (car.hit > 0) {
      g.strokeStyle = "#fff"; g.lineWidth = 3; g.strokeRect(-26, -15, 52, 30);
    }
    g.restore(); g.globalAlpha = 1;
    g.save(); g.textAlign = "center"; g.font = "bold 13px 'DM Mono',monospace";
    const name = driverLabel(car);
    const labelWidth = Math.min(180, Math.max(36, g.measureText(name).width + 12));
    g.fillStyle = "#081014d9"; g.fillRect(car.x - labelWidth / 2, car.y - 42, labelWidth, 19);
    g.fillStyle = colors[car.id]; g.fillText(name, car.x, car.y - 28, labelWidth - 8);
    g.restore();
  }
  function predictedDriverPose(car, correction, frameCamera) {
    const result = { ...car, x: car.x + correction.x, y: car.y + correction.y };
    // The server alone eliminates cars. Keep a still-active predicted car
    // visible at the reference edge until the authoritative decision arrives.
    if (frameCamera && !car.eliminated) {
      const halfW = CAMERA_MAX_SPAN / (2 * frameCamera.scale);
      const halfH = halfW * 700 / 1200;
      const margin = CAR_LENGTH * 0.53;
      result.x = clamp(result.x, frameCamera.x - halfW + margin, frameCamera.x + halfW - margin);
      result.y = clamp(result.y, frameCamera.y - halfH + margin, frameCamera.y + halfH - margin);
    }
    return result;
  }
  function render(now) {
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.fillStyle = "#111b22"; ctx.fillRect(0, 0, viewW, viewH);
    if (!scene) return;
    // Keep the authoritative reference frame and interpolated opponents unchanged.
    const frame = onlineActive() && onlineConnected ? onlineRenderFrame() : null;
    const fitted = frame ? fitOnlineViewport(viewW, viewH) : null;
    if (frame) Object.assign(camera, frame.camera);
    camera.zoom = fitted ? fitted.scale * 1200 / CAMERA_MAX_SPAN * camera.scale : cameraBounds().zoom;
    ctx.save();
    if (fitted) {
      ctx.beginPath(); ctx.rect((viewW - fitted.width) / 2, (viewH - fitted.height) / 2, fitted.width, fitted.height); ctx.clip();
    }
    ctx.translate(viewW / 2, viewH / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);
    ctx.drawImage(scene, 0, 0);
    pickups.forEach(item => drawPickup(ctx, item, now));
    for (const shot of shots) {
      if (shot.kind === "pulse") {
        ctx.save();
        ctx.globalAlpha = clamp(shot.life / 0.22, 0, 1);
        ctx.strokeStyle = shot.weapon === "shocker" ? "#a6eaff" : "#fff0a8";
        ctx.lineWidth = 5;
        ctx.beginPath();
        if (shot.weapon === "hammer") {
          ctx.arc(shot.x, shot.y, 65, shot.angle - 0.75, shot.angle + 0.75);
        } else ctx.arc(shot.x, shot.y, 25 + (1 - shot.life / 0.22) * (shot.weapon === "sonic" ? 305 : 220), 0, Math.PI * 2);
        ctx.stroke(); ctx.restore(); continue;
      }
      if (shot.kind === "mines" || shot.kind === "bombs") {
        ctx.fillStyle = shot.kind === "bombs" ? "#ff725d" : "#d6e1e8";
        ctx.beginPath(); ctx.arc(shot.x, shot.y, shot.kind === "bombs" ? 10 : 8, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
        continue;
      }
      ctx.strokeStyle = shot.color || "#f6e9a2"; ctx.lineWidth = shot.kind === "plasma" ? 9 : 6; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(shot.x, shot.y);
      ctx.lineTo(shot.x - shot.vx * 0.033, shot.y - shot.vy * 0.033); ctx.stroke();
      ellipse(ctx, shot.x, shot.y, 5, 5, "#fff");
    }
    (frame?.cars || cars).forEach(car => {
      const own = onlineActive() && onlineConnected && state === "racing" && car.id === onlinePlayerSlot;
      const display = own && cars[car.id]
        ? predictedDriverPose(cars[car.id], visualCorrection, frame?.camera) : car;
      if (!display.eliminated) drawCar(ctx, display, now);
    });
    ctx.restore();
    visualCorrection.x *= 0.65;
    visualCorrection.y *= 0.65;
    visualCorrection.angle = 0;
  }
  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    viewW = rect.width; viewH = rect.height;
    pixelRatio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(viewW * pixelRatio));
    canvas.height = Math.max(1, Math.round(viewH * pixelRatio));
  }
  if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
  window.addEventListener("resize", resize);
  function resetJoystick() {
    stick.pointerId = null;
    touch.x = 0; touch.y = 0;
    joystick.style.setProperty("--stick-x", "0px");
    joystick.style.setProperty("--stick-y", "0px");
    joystick.classList.remove("is-active");
  }
  function resetTouchControls() {
    resetJoystick();
    for (const [button, pointers] of buttonPointers) {
      pointers.clear();
      touch[button.dataset.control] = false;
      button.classList.remove("pressed");
    }
  }
  function onInputInterrupted() {
    keys.clear();
    resetTouchControls();
    if (state === "racing") pause();
  }
  window.addEventListener("blur", onInputInterrupted);
  window.addEventListener("pagehide", onInputInterrupted);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) onInputInterrupted();
  });
  window.addEventListener("keydown", event => {
    const key = event.key.toLowerCase();
    if (settingsOpen || event.target.matches("select,input")) return;
    if (key === "p" || key === "escape") { if (!event.repeat) pause(); event.preventDefault(); return; }
    if (state !== "racing" && state !== "countdown" && state !== "roundEnd") return;
    if (playerKeys.some(p => Object.values(p).includes(key)) || key === " ") event.preventDefault();
    if (state === "roundEnd" && !event.repeat) {
      for (const car of readyDrivers()) {
        const binding = playerKeys[onlineActive() ? 0 : car.id];
        if (!binding) continue;
        if (key === binding.down || key === binding.brake) setRoundReady(car.id, false);
        else if (key === binding.up) setRoundReady(car.id, true);
      }
    }
    keys.add(key);
  });
  window.addEventListener("keyup", event => { keys.delete(event.key.toLowerCase()); });
  function moveJoystick(event) {
    if (event.pointerId !== stick.pointerId) return;
    const rect = joystick.getBoundingClientRect();
    const radius = Math.max(1, Math.min(rect.width, rect.height) * 0.34);
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    const distance = Math.hypot(dx, dy);
    const limited = Math.min(distance, radius);
    // Match Nocny Kurs: a radial dead zone and normalized analog intensity.
    const deadzone = 0.12;
    const raw = limited / radius;
    const intensity = raw <= deadzone ? 0 : (raw - deadzone) / (1 - deadzone);
    const unitX = distance ? dx / distance : 0;
    const unitY = distance ? dy / distance : 0;
    touch.x = unitX * intensity;
    touch.y = unitY * intensity;
    joystick.style.setProperty("--stick-x", unitX * limited + "px");
    joystick.style.setProperty("--stick-y", unitY * limited + "px");
    joystick.classList.toggle("is-active", intensity > 0);
  }
  joystick.addEventListener("pointerdown", event => {
    if (stick.pointerId !== null || (state !== "racing" && state !== "countdown")) return;
    event.preventDefault();
    stick.pointerId = event.pointerId;
    try { joystick.setPointerCapture(event.pointerId); } catch (_) {}
    moveJoystick(event);
  });
  joystick.addEventListener("pointermove", event => {
    if (event.pointerId !== stick.pointerId) return;
    event.preventDefault();
    moveJoystick(event);
  });
  const joystickRelease = event => {
    if (event.pointerId !== stick.pointerId) return;
    event.preventDefault();
    resetJoystick();
  };
  joystick.addEventListener("pointerup", joystickRelease);
  joystick.addEventListener("pointercancel", joystickRelease);
  joystick.addEventListener("lostpointercapture", event => {
    if (event.pointerId === stick.pointerId) resetJoystick();
  });
  for (const button of document.querySelectorAll("[data-control]")) {
    const control = button.dataset.control;
    const pointers = new Set();
    buttonPointers.set(button, pointers);
    button.addEventListener("pointerdown", event => {
      if (state !== "racing" && state !== "countdown" && state !== "roundEnd") return;
      if (state === "roundEnd" && control !== "gas" && control !== "brake") return;
      event.preventDefault();
      if (state === "roundEnd") setRoundReady(onlineActive() ? onlinePlayerSlot : 0, control === "gas");
      pointers.add(event.pointerId);
      touch[control] = true;
      button.classList.add("pressed");
      try { button.setPointerCapture(event.pointerId); } catch (_) {}
    });
    const release = event => {
      if (!pointers.delete(event.pointerId)) return;
      event.preventDefault();
      touch[control] = pointers.size > 0;
      button.classList.toggle("pressed", pointers.size > 0);
    };
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
  }
  function limitDriverCounts(changed) {
    let players = clamp(Number(playerSelect.value) || 1, 1, TOTAL_CARS);
    let bots = clamp(Number(botSelect.value) || 0, 0, TOTAL_CARS - 1);
    if (players + bots > TOTAL_CARS) {
      if (changed === "bots") players = TOTAL_CARS - bots;
      else bots = TOTAL_CARS - players;
    }
    playerSelect.value = String(players);
    botSelect.value = String(bots);
    // All choices stay enabled: changing one count reduces the other if needed.
  }
  playerSelect.addEventListener("change", () => { limitDriverCounts("players"); renderNameFields(); });
  botSelect.addEventListener("change", () => limitDriverCounts("bots"));
  if (!dedicatedMode) {
    limitDriverCounts("players");
    try { savedDriverNames[0] = normalizeDriverName(localStorage.getItem("mikro-sprint-player-name")); } catch {}
    renderNameFields();
  }
  startButton.addEventListener("click", startRace);
  pauseButton.addEventListener("click", pause);

  // Safari (including embedded iOS browsers) can rubber-band the root page
  // during a long hold or slight finger drift even with touch-action:none.
  // Cancel only the browser default gesture, never the pointer/touch event
  // itself. Pointer capture and simultaneous fingers continue to work.
  const touchControls = document.querySelector("#touch-controls");
  const playing = () => state === "racing" || state === "countdown" || state === "roundEnd";
  touchControls.addEventListener("touchstart", event => {
    if (playing() && event.cancelable) event.preventDefault();
  }, { passive: false });
  document.addEventListener("touchmove", event => {
    if (playing() && !settingsOpen && event.cancelable) event.preventDefault();
  }, { capture: true, passive: false });
  touchControls.addEventListener("contextmenu", event => event.preventDefault());

  // The setup/pause overlay is still allowed to scroll when it is visible.
  for (const radio of document.querySelectorAll('input[name="track"]')) {
    radio.addEventListener("change", () => {
      if (state === "racing" || state === "countdown") return;
      selectedTrack = radio.value; course = courses[selectedTrack];
      writeUI(trackTag, course.name); buildScene();
    });
  }

  function fitOnlineViewport(width, height) {
    const scale = Math.min(width / 1200, height / 700);
    return { scale, width: 1200 * scale, height: 700 * scale };
  }
  function onlineRenderFrame() {
    const newest = remoteFrames[remoteFrames.length - 1];
    if (!newest?.camera) return null;
    if (remoteFrames.length < 2) return newest;
    const targetTick = newest.tick - 6 +
      clamp((performance.now() - newest.arrived) / (1000 / 60), 0, 3);
    let a = remoteFrames[0], b = newest;
    for (let i = 1; i < remoteFrames.length; i++) {
      if (remoteFrames[i].tick >= targetTick) { a = remoteFrames[i - 1]; b = remoteFrames[i]; break; }
    }
    if (!a.camera || !b.camera || a.round !== b.round || a.phase !== b.phase) return newest;
    const progress = a.tick === b.tick ? 1 : clamp((targetTick - a.tick) / (b.tick - a.tick), 0, 1);
    const lerp = (x, y) => x + (y - x) * progress;
    return { camera: { x: lerp(a.camera.x, b.camera.x), y: lerp(a.camera.y, b.camera.y),
      scale: lerp(a.camera.scale, b.camera.scale) }, cars: b.cars.map((to, i) => {
      const from = a.cars[i];
      if (!from || from.eliminated !== to.eliminated) return progress < 1 && from ? from : to;
      return { ...to, x: lerp(from.x, to.x), y: lerp(from.y, to.y),
        angle: from.angle + angleWrap(to.angle - from.angle) * progress };
    }) };
  }

  function onlineConnecting() {
    resetTouchControls();
    onlineConnected = false;
    onlinePlayerSlot = -1;
    onlineSequence = 0;
    pendingInputs = [];
    remoteFrames = [];
    onlineStandings = [];
    pendingReady = null; roundReady.clear();
    lastOnlineTick = -1;
    onlineCameraTarget = null;
    visualCorrection.x = visualCorrection.y = visualCorrection.angle = 0;
    state = "waiting";
    roundSummaryEl.hidden = true;
    document.body.classList.remove("race-active");
    overlay.classList.remove("hidden");
    pauseButton.hidden = true;
    startButton.hidden = true;
    writeUI(menuTitle, "POŁĄCZENIE <em>ONLINE.</em>", {}, "innerHTML");
    writeUI(menuDescription, "Serwer dedykowany przygotowuje wyścig. Kod pokoju jest w panelu zaproszenia.");
    if (settingsOpen) renderNameFields();
    countdownEl.textContent = "";
  }
  function onlineWelcome(playerId) {
    onlinePlayerSlot = playerId - 1;
    onlineConnected = true;
    pendingInputs = [];
    onlineSequence = 0;
    lastOnlineTick = -1;
    remoteFrames = [];
    state = "countdown";
    overlay.classList.add("hidden");
    document.body.classList.add("race-active");
    pauseButton.hidden = true;
    resetTouchControls();
    camera.x = cars[onlinePlayerSlot]?.x ?? W / 2;
    camera.y = cars[onlinePlayerSlot]?.y ?? H / 2;
    savedDriverNames[onlinePlayerSlot] = savedDriverNames[0];
    if (settingsOpen) renderNameFields();
    online?.sendInput({ kind: "input", seq: ++onlineSequence,
      name: savedDriverNames[onlinePlayerSlot] });
    onlineCameraTarget = null;
  }
  function onlineLost(message) {
    onlineConnecting();
    writeUI(menuDescription, "{reason}. Próba wznowienia połączenia…", () => ({ reason: t(message) }));
  }
  function onlinePeerJoined() {
    if (onlineConnected && state !== "finished") announce("NOWY GRACZ DOŁĄCZYŁ DO POKOJU");
  }
  function onlineSnapshot(snapshot) {
    if (!onlineConnected || !snapshot || typeof snapshot !== "object") return;
    if (!Number.isSafeInteger(snapshot.tick) || snapshot.tick <= lastOnlineTick) return;
    if (!Array.isArray(snapshot.cars) || snapshot.cars.length < 1 ||
        snapshot.cars.length > TOTAL_CARS ||
        !snapshot.cars.every((car, i) => car && car.id === i && Number.isFinite(car.x) &&
          Number.isFinite(car.y) && Number.isFinite(car.angle) &&
          Number.isFinite(car.vx) && Number.isFinite(car.vy))) return;
    const nextTrack = snapshot.track === "bath" ? "bath" : "pool";
    if (selectedTrack !== nextTrack) {
      selectedTrack = nextTrack;
      course = courses[selectedTrack];
      document.querySelector('input[name="track"][value="' + selectedTrack + '"]').checked = true;
      writeUI(trackTag, course.name);
      buildScene();
      remoteFrames = [];
      pendingInputs = [];
      visualCorrection.x = visualCorrection.y = visualCorrection.angle = 0;
    }
    const firstSnapshot = lastOnlineTick < 0;
    const roundChanged = Number.isInteger(snapshot.matchRound) && snapshot.matchRound !== matchRound;
    const phaseChanged = snapshot.phase !== state;
    if (roundChanged || phaseChanged) { pendingInputs = []; remoteFrames = []; visualCorrection.x = visualCorrection.y = visualCorrection.angle = 0; }
    if (roundChanged) pendingReady = null;
    lastOnlineTick = snapshot.tick;
    if (snapshot.camera && Number.isFinite(snapshot.camera.x) &&
        Number.isFinite(snapshot.camera.y) && Number.isFinite(snapshot.camera.scale)) {
      onlineCameraTarget = {
        x: snapshot.camera.x, y: snapshot.camera.y,
        scale: clamp(snapshot.camera.scale, 1, CAMERA_MAX_SCALE)
      };
      if (firstSnapshot) Object.assign(camera, onlineCameraTarget);
    }
    const previous = cars[onlinePlayerSlot] && { ...cars[onlinePlayerSlot] };
    const serverCars = snapshot.cars.map(car => ({
      ...car, name: normalizeDriverName(car.name),
      // Older servers still send the last path sample instead of an arc distance.
      trackDistance: Number.isFinite(car.trackDistance) ? car.trackDistance :
        course.distances[car.lastIndex ?? car.index] ?? 0,
      roundStartDistance: Number.isFinite(car.roundStartDistance) ? car.roundStartDistance : 0,
      points: Number.isInteger(car.points) ? car.points : 0
    }));
    cars = serverCars;
    onlineStandings = raceStandings();
    // Store immutable authority before local prediction/reconciliation.
    remoteFrames.push({ tick: snapshot.tick, arrived: performance.now(), round: snapshot.matchRound,
      phase: snapshot.phase, camera: onlineCameraTarget && { ...onlineCameraTarget },
      cars: serverCars.map(car => ({ ...car })) });
    if (remoteFrames.length > 15) remoteFrames.shift();
    pickups = Array.isArray(snapshot.pickups) ? snapshot.pickups.map(item => ({ ...item })) : [];
    shots = Array.isArray(snapshot.shots) ? snapshot.shots.map(shot => ({ ...shot })) : [];
    const ownCar = cars[onlinePlayerSlot];
    if (!ownCar) return;
    const ack = Number.isSafeInteger(ownCar.lastAppliedInputSeq)
      ? ownCar.lastAppliedInputSeq : 0;
    pendingInputs = snapshot.phase === "racing" && !ownCar.eliminated ? pendingInputs.filter(packet => packet.seq > ack && packet.round === matchRound) : [];
    reconciling = true;
    try {
      for (const packet of pendingInputs) {
        predictOnlineStep(ownCar, packet.dt, packet);
      }
    } finally { reconciling = false; }
    // Display-only correction; physics immediately uses replayed state.
    // Large server resets/teleports snap instead of trailing a ghost.
    if (previous && !firstSnapshot && !roundChanged && !phaseChanged && !ownCar.eliminated) {
      const dx = previous.x - ownCar.x, dy = previous.y - ownCar.y;
      if (Math.hypot(dx, dy) < 150) {
        // Correct positional error only, never delay the locally steered heading.
        visualCorrection.x = clamp(visualCorrection.x + dx, -35, 35);
        visualCorrection.y = clamp(visualCorrection.y + dy, -35, 35);
      } else visualCorrection.x = visualCorrection.y = 0;
    } else visualCorrection.x = visualCorrection.y = 0;
    visualCorrection.angle = 0;
    if (Number.isFinite(snapshot.raceTime)) raceTime = snapshot.raceTime;
    if (Number.isInteger(snapshot.matchRound)) matchRound = snapshot.matchRound;
    matchWinnerId = Number.isInteger(snapshot.winnerId) ? snapshot.winnerId : null;
    roundWinnerId = Number.isInteger(snapshot.roundWinnerId) ? snapshot.roundWinnerId : null;
    roundDelay = Number.isFinite(snapshot.roundDelay) ? snapshot.roundDelay : 0;
    roundReady.clear();
    if (Array.isArray(snapshot.readyIds)) for (const id of snapshot.readyIds) if (Number.isInteger(id)) roundReady.add(id);
    if (pendingReady && (pendingReady.round !== matchRound || ack >= pendingReady.seq)) pendingReady = null;
    roundResults = Array.isArray(snapshot.roundResults) ? snapshot.roundResults
      .filter(row => row && Number.isInteger(row.id) && Number.isInteger(row.place) &&
        Number.isInteger(row.delta) && Number.isInteger(row.points))
      .map(row => ({ ...row, name: normalizeDriverName(row.name) })) : [];
    if (Number.isFinite(snapshot.countdown)) countdown = snapshot.countdown;
    if (snapshot.phase === "racing" || snapshot.phase === "countdown" ||
        snapshot.phase === "roundEnd" || snapshot.phase === "finished") state = snapshot.phase;
    if (state === "finished") {
      countdownEl.textContent = "";
      pendingInputs = [];
    } else if (state === "roundEnd") {
      countdownEl.textContent = "";
      pendingInputs = [];
    } else if (state === "countdown") {
      countdownEl.textContent = countdown > 0 ? Math.ceil(countdown) : t("GO!");
    } else countdownEl.textContent = "";
    document.body.classList.toggle("race-active", state !== "finished");
    if (phaseChanged && (state === "finished" || state === "roundEnd")) resetTouchControls();
    if (state === "roundEnd" && (phaseChanged || roundChanged || firstSnapshot)) resetReadyPedals();
    if (state !== "roundEnd" && state !== "finished") roundSummaryEl.hidden = true;
    renderRoundSummary();
    updateHud();
  }

  if (dedicatedMode) {
    humans = 0;
    botCount = Number.isInteger(window.__MIKRO_SPRINT_BOTS__) &&
      window.__MIKRO_SPRINT_BOTS__ >= 0 && window.__MIKRO_SPRINT_BOTS__ < TOTAL_CARS
      ? window.__MIKRO_SPRINT_BOTS__ : 3;
    makeCars();
    makePickups();
    function restartDedicated() {
      humans = 0;
      makeCars();
      makePickups();
      shots = [];
      raceTime = 0;
      countdown = 3.5;
      dedicatedWinnerId = null;
      dedicatedFinishDelay = 0;
      matchRound = 1; roundDelay = 0; eliminationOrder = []; roundResults = []; roundReady.clear(); roundElapsed = 0;
      matchWinnerId = roundWinnerId = roundAnchor = null;
      state = "countdown";
      for (const slot of dedicatedSlots.values()) cars[slot].human = true;
      updateCamera(0, true);
      for (const slot of dedicatedInputs.keys()) dedicatedInputs.set(slot, {
        dx: 0, dy: 0, gas: 0, brake: 0, fire: false, seq: 0
      });
    }
    window.MikroSprintDedicated = {
      join(peerId, track = "pool") {
        if (dedicatedSlots.has(peerId)) return dedicatedSlots.get(peerId) + 1;
        if (dedicatedSlots.size >= TOTAL_CARS) return null;
        if (!dedicatedSlots.size) {
          selectedTrack = track === "bath" ? "bath" : "pool";
          course = courses[selectedTrack];
          restartDedicated();
        }
        // Keep existing human IDs stable. Grow the field, then replace bots
        // when the eighth car has already joined the starting grid.
        const slot = !dedicatedSlots.size ? 0
          : cars.length < TOTAL_CARS ? cars.length
          : cars.findIndex(car => !car.human);
        if (slot < 0) return null;
        if (slot === cars.length) {
          const car = makeCar(slot);
          car.roundStartDistance = cars[0].roundStartDistance;
          if (state === "countdown" && matchRound > 1 && roundAnchor) {
            const pos = gridPose(slot, roundAnchor.distance);
            Object.assign(car, { x: pos.x, y: pos.y, angle: pos.angle, index: pos.index,
              safeIndex: pos.index, lastIndex: pos.index, botDistance: pos.distance });
            setTrackDistance(car, pos.distance);
          } else if (state === "racing" || state === "roundEnd") {
            // A late arrival waits for the next starting grid rather than spawning off-screen.
            car.eliminated = true;
            if (state === "racing") eliminationOrder.unshift(slot);
          } else setTrackDistance(car, car.trackDistance);
          cars.push(car);
        }
        dedicatedSlots.set(peerId, slot);
        dedicatedInputs.set(slot, { dx: 0, dy: 0, gas: 0, brake: 0, fire: false, seq: 0 });
        cars[slot].human = true;
        roundReady.delete(slot);
        cars[slot].lastAppliedInputSeq = 0;
        if (state === "countdown") updateCamera(0, true);
        return slot + 1;
      },
      leave(peerId) {
        const slot = dedicatedSlots.get(peerId);
        if (slot === undefined) return;
        dedicatedSlots.delete(peerId);
        dedicatedInputs.delete(slot); roundReady.delete(slot);
        const car = cars[slot];
        car.human = false;
        car.name = "";
        car.actionHeld = false;
        car.botDistance = car.trackDistance;
        car.botSpeed = car.speed;
        car.botPushX = car.botPushY = 0;
      },
      input(peerId, value) {
        const slot = dedicatedSlots.get(peerId);
        if (slot === undefined || !value || typeof value !== "object") return;
        if (typeof value.name === "string") cars[slot].name = normalizeDriverName(value.name);
        if (!Number.isSafeInteger(value.seq) || value.seq < 1) return;
        const prev = dedicatedInputs.get(slot);
        if (prev && value.seq <= prev.seq) return;
        if (value.readyRound !== undefined) {
          if (state === "roundEnd" && value.readyRound === matchRound &&
              (value.ready === undefined || typeof value.ready === "boolean")) {
            // Omitted ready retains compatibility with the previous client.
            if (value.ready === false) roundReady.delete(slot);
            else roundReady.add(slot);
            dedicatedInputs.set(slot, { dx: 0, dy: 0, gas: 0, brake: 0, fire: false, seq: value.seq });
            cars[slot].lastAppliedInputSeq = value.seq;
          }
          return;
        }
        if (value.round !== undefined && value.round !== matchRound) return;
        const safe = axis => Number.isFinite(axis) ? clamp(axis, -1, 1) : 0;
        // The server must not normalize steering against the throttle axis.
        const dx = safe(value.dx), dy = safe(value.dy);
        dedicatedInputs.set(slot, {
          dx, dy, gas: safe(value.gas) < 0 ? 0 : safe(value.gas),
          brake: safe(value.brake) < 0 ? 0 : safe(value.brake),
          // Preserve a short press received between two simulation ticks.
          fire: value.fire === true || Boolean(prev?.fire && prev.seq > cars[slot].lastAppliedInputSeq), seq: value.seq
        });
      },
      tick(dt = 1 / 60) {
        if (!dedicatedSlots.size) return;
        dedicatedTick++;
        const stepDt = clamp(dt, 0, 0.05);
        if (state !== "finished") step(stepDt);
      },
      snapshot() {
        return {
          tick: dedicatedTick, track: selectedTrack, phase: state,
          countdown, raceTime, winnerId: matchWinnerId,
          matchRound, roundDelay, roundWinnerId, roundResults, readyIds: [...roundReady],
          camera: { x: camera.x, y: camera.y, scale: camera.scale, width: 1200, height: 700 },
          cars: cars.map(car => ({ ...car })), pickups: pickups.map(item => ({ ...item })),
          shots: shots.map(shot => ({ ...shot }))
        };
      },
      get playerCount() { return dedicatedSlots.size; }
    };
    return;
  }
  const settingsDialog = document.querySelector("#settings-dialog");
  const settingsButton = document.querySelector("#settings-open");
  settingsButton.addEventListener("click", () => {
    keys.clear();
    resetTouchControls();
    renderNameFields();
    settingsOpen = true;
    settingsDialog.showModal();
  });
  document.querySelector("#settings-close").addEventListener("click", () => settingsDialog.close());
  settingsDialog.addEventListener("close", () => {
    settingsOpen = false;
    keys.clear();
    resetTouchControls();
    settingsButton.focus();
  });
  document.addEventListener("mikro-sprint-language", () => {
    scoreboardKey = "";
    updateHud();
    renderRoundSummary();
  });
  scoreboardToggleEl.addEventListener("click", toggleScoreboard);
  resize(); buildScene(); makeCars(); makePickups(); updateHud();
  online = window.MikroSprintMultiplayer?.create({
    onConnecting: onlineConnecting,
    onWelcome: onlineWelcome,
    onLost: onlineLost,
    onPeerJoined: onlinePeerJoined,
    onSnapshot: onlineSnapshot
  }) ?? null;
  let previous = performance.now();
  function loop(timestamp) {
    // Queue the next frame before updating so a thrown frame cannot stop the loop forever.
    requestAnimationFrame(loop);
    const dt = clamp((timestamp - previous) / 1000, 0, 0.045); previous = timestamp;
    if (onlineActive() && onlineConnected) {
      onlineAccumulator = Math.min(onlineAccumulator + dt, 4 / 60);
      let iterations = 0;
      while (onlineAccumulator >= 1 / 60 && iterations++ < 4) {
        step(1 / 60);
        onlineAccumulator -= 1 / 60;
      }
    } else step(dt);
    expireToast(timestamp);
    render(timestamp / 1000);
  }
  requestAnimationFrame(loop);
  window.__mikroSprint = {
    get state() { return state; },
    get track() { return selectedTrack; },
    get cars() { return cars.map(car => ({ id: car.id, x: car.x, y: car.y, angle: car.angle, vx: car.vx, vy: car.vy, lap: car.lap, gun: car.gun, human: car.human, eliminated: car.eliminated })); },
    get camera() { return { ...camera }; },
    get predictedShots() { return shots.map(shot => ({ ...shot })); },
    get displayedDriver() { const car = cars[onlinePlayerSlot]; return car ? predictedDriverPose(car, visualCorrection, onlineRenderFrame()?.camera) : null; },
    get scores() { return cars.map(car => ({ id: car.id, name: car.name, points: car.points, eliminated: car.eliminated })); },
    get matchRound() { return matchRound; },
    get roundResults() { return roundResults.map(r => ({ ...r })); },
    get winnerId() { return matchWinnerId; },
    get pickups() { return pickups.length; },
    get touch() { return { ...touch, stickPointerId: stick.pointerId }; },
    get multiplayer() { return { active: onlineActive(), connected: onlineConnected,
      playerId: onlinePlayerSlot + 1, lastTick: lastOnlineTick,
      pending: pendingInputs.length,
      correction: { ...visualCorrection } }; }
  };
})();
