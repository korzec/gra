(() => {
  "use strict";
  const W = 1600, H = 980, LAPS = 3, TOTAL_CARS = 4;
  const canvas = document.querySelector("#race");
  const ctx = canvas.getContext("2d", { alpha: false });
  const stage = document.querySelector("#game-stage");
  const overlay = document.querySelector("#overlay");
  const startButton = document.querySelector("#start");
  const pauseButton = document.querySelector("#pause");
  const joystick = document.querySelector("#steering-stick");
  const menuTitle = document.querySelector("#menu-title");
  const menuDescription = document.querySelector("#menu-description");
  const playerSelect = document.querySelector("#players");
  const countdownEl = document.querySelector("#countdown");
  const toastEl = document.querySelector("#toast");
  const positionEl = document.querySelector("#position");
  const lapEl = document.querySelector("#lap");
  const timeEl = document.querySelector("#time");
  const weaponEl = document.querySelector("#weapon");
  const trackTag = document.querySelector("#track-tag");
  const trackChoices = document.querySelector("#track-choices");
  const colors = ["#d9fc67", "#ff665b", "#51d5fa", "#c19aff"];
  const playerKeys = [
    { left: "a", right: "d", up: "w", down: "s", brake: " ", fire: "e" },
    { left: "arrowleft", right: "arrowright", up: "arrowup", down: "arrowdown", brake: "control", fire: "shift" },
    { left: "j", right: "l", up: "i", down: "k", brake: "u", fire: "o" },
    { left: "f", right: "h", up: "t", down: "g", brake: "r", fire: "y" }
  ];
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const angleWrap = a => Math.atan2(Math.sin(a), Math.cos(a));

  // Nocny Kurs-style steering: inputs indicate absolute map direction,
  // while the body can only rotate at the car's current turning rate.
  function steerCarToward(car, dx, dy, dt, turnRate) {
    if (Math.hypot(dx, dy) < 0.01) return;
    const targetAngle = Math.atan2(dy, dx);
    const delta = angleWrap(targetAngle - car.angle);
    const maxTurn = dt * turnRate;
    car.angle += clamp(delta, -maxTurn, maxTurn);
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
    course.path = interpolatePath(course.checkpoints);
    course.distances = [0];
    for (let i = 0; i < course.path.length; i++) {
      const a = course.path[i], b = course.path[(i + 1) % course.path.length];
      course.distances.push(course.distances[i] + Math.hypot(a.x - b.x, a.y - b.y));
    }
    course.totalLength = course.distances[course.path.length];
  });
  let selectedTrack = "pool", course = courses.pool;
  let scene, cars = [], pickups = [], shots = [], state = "menu", humans = 1;
  let countdown = 3.5, raceTime = 0, toastTime = 0, uiTime = 0;
  const keys = new Set(), touch = { x: 0, y: 0, gas: false, brake: false, fire: false };
  const stick = { pointerId: null };
  // Each control tracks its own active pointers. Releasing an unrelated touch
  // must not cancel a held pedal or shot.
  const buttonPointers = new Map();
  let viewW = 1200, viewH = 700, pixelRatio = 1;
  const camera = { x: 800, y: 490, zoom: 1 };
  let audio;
  function tone(hz, duration = 0.08, shape = "square") {
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
  function announce(text, duration = 1.4) { toastEl.textContent = text; toastTime = duration; }
  function point(index) {
    const path = course.path, n = path.length;
    return path[((Math.round(index) % n) + n) % n];
  }
  function nearest(x, y) {
    let best = Infinity, index = 0;
    const path = course.path;
    for (let i = 0; i < path.length; i++) {
      const dx = path[i].x - x, dy = path[i].y - y, d = dx * dx + dy * dy;
      if (d < best) { best = d; index = i; }
    }
    return { index, distance: Math.sqrt(best) };
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
      index: lo, angle: Math.atan2(b.y - a.y, b.x - a.x) };
  }
  function makeCars() {
    cars = [];
    for (let i = 0; i < TOTAL_CARS; i++) {
      const startIndex = -5 - Math.floor(i / 2) * 13;
      const pos = point(startIndex), direction = orientation(startIndex);
      const normalizedIndex = (startIndex + course.path.length) % course.path.length;
      const side = i % 2 === 0 ? -26 : 26;
      cars.push({
        id: i, human: i < humans, x: pos.x - Math.sin(direction) * side,
        y: pos.y + Math.cos(direction) * side, angle: direction,
        vx: 0, vy: 0, speed: 0, steer: 0, index: normalizedIndex, safeIndex: normalizedIndex,
        lastIndex: normalizedIndex, raceProgress: 0, botDistance: course.distances[normalizedIndex] - course.totalLength,
        botSpeed: 0, gate: 1, lap: 0,
        offroad: 0, invuln: 1.2, turbo: 0, gun: 0, hit: 0, actionHeld: false,
        botCooldown: 1.8 + i * 0.4, finishAt: null, smoke: 0
      });
    }
  }
  function makePickups() {
    const types = ["turbo", "bolt", "turbo", "bolt", "turbo", "bolt"];
    pickups = types.map((type, i) => {
      const at = Math.round(course.path.length * (i + 0.65) / types.length);
      const p = point(at), angle = orientation(at);
      const offset = i % 2 === 0 ? -22 : 22;
      return { type, x: p.x - Math.sin(angle) * offset,
        y: p.y + Math.cos(angle) * offset, cooldown: 0, phase: i * 1.7 };
    });
  }
  function startRace() {
    resetTouchControls();
    if (state === "paused") {
      state = "racing";
      document.body.classList.add("race-active");
      overlay.classList.add("hidden");
      return;
    }
    humans = clamp(Number(playerSelect.value) || 1, 1, 4);
    selectedTrack = document.querySelector('input[name="track"]:checked').value;
    course = courses[selectedTrack];
    buildScene();
    makeCars();
    makePickups();
    shots = [];
    raceTime = 0; countdown = 3.5; toastTime = 0; uiTime = 0;
    toastEl.textContent = "";
    trackTag.textContent = course.name;
    overlay.classList.add("hidden");
    state = "countdown";
    document.body.classList.add("race-active");
    pauseButton.hidden = false;
    camera.x = cars[0].x; camera.y = cars[0].y;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (Audio) { audio = audio || new Audio(); audio.resume().catch(() => {}); }
    } catch (_) {}
    updateHud();
  }
  function showMenu(title, copy, buttonLabel, allowChoice) {
    menuTitle.innerHTML = title;
    menuDescription.textContent = copy;
    startButton.innerHTML = buttonLabel + " <span>↗</span>";
    trackChoices.style.display = allowChoice ? "" : "none";
    playerSelect.closest(".start-line").querySelector("label").style.display = allowChoice ? "" : "none";
    playerSelect.style.display = allowChoice ? "" : "none";
    overlay.classList.remove("hidden");
  }
  function pause() {
    if (state === "racing") {
      resetTouchControls();
      state = "paused";
      document.body.classList.remove("race-active");
      showMenu("WYŚCIG <em>WSTRZYMANY.</em>", "Wznów i wróć na tor. Sterowanie pozostaje przypisane do tych samych kierowców.", "WZNÓW WYŚCIG", false);
    } else if (state === "paused") startRace();
  }
  function finishRace(winner) {
    resetTouchControls();
    state = "finished";
    document.body.classList.remove("race-active");
    pauseButton.hidden = true;
    const placing = ranking().findIndex(car => car.id === 0) + 1;
    const time = formatTime(raceTime);
    const humanWin = winner.human;
    showMenu(humanWin ? "META. <em>BRAWO!</em>" : "KONIEC <em>WYŚCIGU.</em>",
      (humanWin ? "Wygrywa gracz P" + (winner.id + 1) + ". " : "Wygrywa bot " + (winner.id + 1) + ". ") +
      "Pozycja P1: " + placing + "/4. Czas: " + time + ". Możesz zmienić trasę i ruszyć ponownie.",
      "JEDZIEMY JESZCZE RAZ", true);
    tone(humanWin ? 880 : 280, 0.35, "sine");
  }
  function formatTime(t) {
    return String(Math.floor(t / 60)).padStart(2, "0") + ":" +
      String(Math.floor(t % 60)).padStart(2, "0") + "." + Math.floor((t * 10) % 10);
  }
  function ranking() {
    return [...cars].sort((a, b) => b.raceProgress - a.raceProgress);
  }
  function updateHud() {
    if (!cars.length) return;
    const p1 = cars[0];
    positionEl.textContent = (ranking().findIndex(c => c.id === 0) + 1) + " / 4";
    lapEl.textContent = Math.min(p1.lap + 1, LAPS) + " / " + LAPS;
    timeEl.textContent = formatTime(raceTime);
    weaponEl.textContent = p1.gun ? "POCISK × " + p1.gun : p1.turbo > 0 ? "TURBO!" : "—";
  }
  function readInput(car) {
    if (!car.human) return botInput(car);
    const binding = playerKeys[car.id];
    // WASD / arrows / IJKL / TFGH point to a direction on the fixed map,
    // not left/right steering relative to the car's current heading.
    let dx = Number(keys.has(binding.right)) - Number(keys.has(binding.left));
    let dy = Number(keys.has(binding.down)) - Number(keys.has(binding.up));
    let brake = Number(keys.has(binding.brake));
    let fire = keys.has(binding.fire);
    let pedalGas = 0;
    if (car.id === 0) {
      dx += touch.x;
      dy += touch.y;
      pedalGas = Number(touch.gas);
      brake = Math.max(brake, Number(touch.brake));
      fire ||= touch.fire;
    }
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pads[car.id];
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
    const length = Math.hypot(dx, dy);
    if (length > 1) { dx /= length; dy /= length; }
    // As in Nocny Kurs, holding a direction also applies throttle.
    // Gas is still available independently on the touch pedal/RT.
    const gas = brake > 0 ? 0 : Math.max(Math.min(1, length), pedalGas);
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
    if (car.gun <= 0) return;
    car.gun--;
    shots.push({
      owner: car.id, x: car.x + Math.cos(car.angle) * 31, y: car.y + Math.sin(car.angle) * 31,
      vx: Math.cos(car.angle) * 720 + car.vx * 0.4,
      vy: Math.sin(car.angle) * 720 + car.vy * 0.4, life: 1.1
    });
    if (car.id === 0) tone(330, 0.07);
  }
  function resetCar(car) {
    const i = car.safeIndex;
    const pos = point(i);
    car.x = pos.x; car.y = pos.y; car.angle = orientation(i);
    car.vx = 0; car.vy = 0; car.speed = 0;
    car.offroad = 0; car.invuln = 1.7; car.hit = 0; car.lastIndex = i;
    if (car.human && car.id === 0) announce("POWRÓT NA TOR", 1);
  }
  function collectPickup(car) {
    for (const item of pickups) {
      if (item.cooldown > 0 || Math.hypot(item.x - car.x, item.y - car.y) > 37) continue;
      item.cooldown = 9;
      if (item.type === "turbo") {
        car.turbo = 1.85;
        if (car.id === 0) announce("TURBO! PRZYSPIESZENIE", 1.25);
      } else {
        car.gun = Math.min(car.gun + 3, 6);
        if (car.id === 0) announce("3 POCISKI — NACIŚNIJ E", 1.7);
      }
      if (car.human) tone(item.type === "turbo" ? 770 : 410, 0.17, "sine");
    }
  }
  function updateBot(car, dt) {
    const previousX = car.x, previousY = car.y;
    const current = pointAtDistance(car.botDistance);
    const next = pointAtDistance(car.botDistance + 100);
    const bend = Math.abs(angleWrap(next.angle - current.angle));
    const top = (270 + car.id * 12) / (1 + bend * 0.45);
    const targetSpeed = top * (car.hit > 0 ? 0.48 : car.turbo > 0 ? 1.36 : 1);
    car.botSpeed += clamp(targetSpeed - car.botSpeed, -420 * dt, 480 * dt);
    car.botDistance += car.botSpeed * dt;
    const p = pointAtDistance(car.botDistance);
    const lane = (car.id % 2 ? 21 : -21) + 5 * Math.sin(car.botDistance / 160 + car.id);
    car.x = p.x - Math.sin(p.angle) * lane;
    car.y = p.y + Math.cos(p.angle) * lane;
    car.angle = p.angle;
    car.vx = (car.x - previousX) / Math.max(dt, 0.001);
    car.vy = (car.y - previousY) / Math.max(dt, 0.001);
    car.speed = car.botSpeed;
    car.index = p.index;
    car.safeIndex = p.index;
    car.raceProgress = Math.max(0, car.botDistance / course.totalLength);
    car.lap = Math.min(LAPS, Math.floor(car.raceProgress));
    car.gate = 1 + Math.floor((car.raceProgress % 1) * 4);
    collectPickup(car);
    car.botCooldown -= dt;
    if (car.gun && car.botCooldown <= 0) {
      const target = cars.find(other => other !== car && other.invuln <= 0 &&
        Math.hypot(other.x - car.x, other.y - car.y) < 260 &&
        Math.abs(angleWrap(Math.atan2(other.y - car.y, other.x - car.x) - car.angle)) < 0.45);
      if (target) { fire(car); car.botCooldown = 1.3 + car.id * 0.2; }
    }
    if (car.lap >= LAPS) car.finishAt = raceTime;
  }
  function updateCar(car, dt) {
    car.invuln = Math.max(0, car.invuln - dt);
    car.hit = Math.max(0, car.hit - dt);
    car.turbo = Math.max(0, car.turbo - dt);
    if (car.finishAt !== null) return;
    if (!car.human) { updateBot(car, dt); return; }
    const closest = nearest(car.x, car.y);
    car.index = closest.index;
    const onRoad = closest.distance < course.roadWidth * 0.50;
    if (onRoad) { car.safeIndex = closest.index; car.offroad = 0; }
    else car.offroad += dt;
    if (car.offroad > 0.9 || car.x < 80 || car.x > W - 80 || car.y < 70 || car.y > H - 70) {
      resetCar(car); return;
    }
    if (course.pits.some(p => Math.hypot(car.x - p[0], car.y - p[1]) < 56)) {
      resetCar(car); return;
    }
    const input = readInput(car);
    if (input.fire && !car.actionHeld) fire(car);
    car.actionHeld = input.fire;
    const moving = Math.hypot(car.vx, car.vy);
    const traction = selectedTrack === "bath" ? 3.45 : 5.2;
    const steering = (2.65 + (car.turbo > 0 ? 0.26 : 0)) * clamp(moving / 85, 0.25, 1);
    steerCarToward(car, input.dx, input.dy, dt, steering);
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
    const advanced = nearest(car.x, car.y);
    car.index = advanced.index;
    if (advanced.distance < course.roadWidth * 0.52) {
      const n = course.path.length;
      let delta = advanced.index - car.lastIndex;
      if (delta > n / 2) delta -= n;
      else if (delta < -n / 2) delta += n;
      if (Math.abs(delta) < n * 0.09) {
        car.raceProgress = Math.max(0, car.raceProgress + delta / n);
      }
      car.lastIndex = advanced.index;
      const completed = Math.min(LAPS, Math.floor(car.raceProgress + 0.0001));
      if (completed > car.lap) {
        car.lap = completed;
        if (car.id === 0 && car.lap < LAPS) { announce("OKRĄŻENIE " + (car.lap + 1) + " / " + LAPS); tone(550, 0.15); }
        if (car.lap >= LAPS) car.finishAt = raceTime;
      }
      car.gate = 1 + Math.floor((car.raceProgress % 1) * 4);
    }
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
  }
  function updateCollisions() {
    for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i], b = cars[j], dx = b.x - a.x, dy = b.y - a.y;
      const distance = Math.hypot(dx, dy), radius = 35;
      if (distance >= radius || distance < 0.01) continue;
      const nx = dx / distance, ny = dy / distance, overlap = (radius - distance) / 2;
      a.x -= nx * overlap; a.y -= ny * overlap;
      b.x += nx * overlap; b.y += ny * overlap;
      const relative = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (relative >= 0) continue;
      const impulse = -relative * 0.95;
      a.vx -= impulse * nx; a.vy -= impulse * ny;
      b.vx += impulse * nx; b.vy += impulse * ny;
    }
  }
  function updateShots(dt) {
    for (const shot of shots) {
      shot.x += shot.vx * dt; shot.y += shot.vy * dt; shot.life -= dt;
      if (shot.x < 0 || shot.y < 0 || shot.x > W || shot.y > H) shot.life = 0;
      if (course.objects.some(o => Math.hypot(o.x - shot.x, o.y - shot.y) < o.r)) shot.life = 0;
      if (shot.life <= 0) continue;
      for (const car of cars) {
        if (car.id === shot.owner || car.invuln > 0 || Math.hypot(car.x - shot.x, car.y - shot.y) > 24) continue;
        car.vx += shot.vx * 0.52; car.vy += shot.vy * 0.52;
        car.hit = 0.6; car.invuln = 0.8; shot.life = 0;
        if (car.id === 0) { announce("TRAFIENIE!"); tone(110, 0.2); }
        break;
      }
    }
    shots = shots.filter(shot => shot.life > 0);
  }
  function step(dt) {
    if (state === "countdown") {
      countdown -= dt;
      const number = Math.ceil(countdown);
      countdownEl.textContent = number > 0 ? number : "GO!";
      if (countdown <= -0.48) {
        countdownEl.textContent = "";
        state = "racing";
        tone(920, 0.23);
      }
      return;
    }
    if (state !== "racing") return;
    raceTime += dt;
    for (const item of pickups) item.cooldown = Math.max(0, item.cooldown - dt);
    cars.forEach(car => updateCar(car, dt));
    updateCollisions();
    updateShots(dt);
    const winner = cars.find(car => car.finishAt !== null);
    if (winner) { finishRace(winner); return; }
    if (toastTime > 0) {
      toastTime -= dt;
      if (toastTime <= 0) toastEl.textContent = "";
    }
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
    const wood = g.createLinearGradient(0, 0, W, H);
    wood.addColorStop(0, "#683b29"); wood.addColorStop(0.5, "#b08152"); wood.addColorStop(1, "#4b2b24");
    g.fillStyle = "#131b24"; g.fillRect(0, 0, W, H);
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
    for (const pit of course.pits) {
      ellipse(g, pit[0] + 4, pit[1] + 5, 53, 51, "#0a1413");
      ellipse(g, pit[0], pit[1], 45, 44, "#101b1b");
    }
    for (let i = 0; i < 130; i++) {
      const x = 145 + (i * 479) % 1310, y = 135 + (i * 307) % 710;
      ellipse(g, x, y, 1.3, 1.3, "#ffffff0a");
    }
    g.strokeStyle = "#ffffff17"; g.lineWidth = 3;
    g.beginPath(); g.moveTo(800, 165); g.lineTo(800, 815); g.stroke();
  }
  function drawBath(g) {
    const tile = g.createLinearGradient(0, 0, W, H);
    tile.addColorStop(0, "#b3ccd4"); tile.addColorStop(1, "#728f9b");
    g.fillStyle = tile; g.fillRect(0, 0, W, H);
    g.strokeStyle = "#ffffff35"; g.lineWidth = 4;
    for (let x = 0; x < W; x += 155) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    for (let y = 0; y < H; y += 155) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
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
    if (selectedTrack === "pool") drawPool(g); else drawBath(g);
    drawRoad(g);
    course.objects.forEach(o => drawObject(g, o));
  }
  function drawPickup(g, item, t) {
    if (item.cooldown > 0) return;
    g.save(); g.translate(item.x, item.y + Math.sin(t * 3 + item.phase) * 5);
    g.rotate(t * 0.7 + item.phase);
    g.shadowColor = item.type === "turbo" ? "#dbf75d" : "#f49e76"; g.shadowBlur = 18;
    rounded(g, -20, -20, 40, 40, 8, item.type === "turbo" ? "#d5f66f" : "#f4a16d");
    g.shadowBlur = 0; g.fillStyle = "#1b2932";
    g.textAlign = "center"; g.textBaseline = "middle"; g.font = "bold 26px sans-serif";
    g.rotate(-t * 0.7 - item.phase);
    g.fillText(item.type === "turbo" ? "⚡" : "✦", 0, 1);
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
    g.fillStyle = "#081014d9"; g.fillRect(car.x - 18, car.y - 42, 36, 19);
    g.fillStyle = colors[car.id]; g.fillText(car.human ? "P" + (car.id + 1) : "AI" + (car.id + 1), car.x, car.y - 28);
    g.restore();
  }
  function minimapBounds() {
    const compact = viewW < 760;
    const w = compact ? 102 : 122, h = compact ? 65 : 78;
    return { x: viewW - w - 12, y: compact ? 64 : 70, w, h };
  }
  function drawMinimap(g) {
    const { x, y, w, h } = minimapBounds();
    if (x < 8 || y < 8) return;
    g.save(); g.fillStyle = "#0c141dcf"; g.fillRect(x, y, w, h);
    g.strokeStyle = "#ffffff40"; g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    g.translate(x + 5, y + 5); g.scale((w - 10) / W, (h - 10) / H);
    pathLine(g); g.strokeStyle = "#d5e8ca9c"; g.lineWidth = 35; g.stroke();
    for (const car of cars) {
      g.beginPath(); g.arc(car.x, car.y, 46, 0, Math.PI * 2);
      g.fillStyle = colors[car.id]; g.fill();
    }
    g.restore();
  }
  function render(now) {
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.fillStyle = "#111b22"; ctx.fillRect(0, 0, viewW, viewH);
    if (!scene) return;
    const subjects = cars.filter(c => c.human);
    const avgX = subjects.length ? subjects.reduce((sum, c) => sum + c.x, 0) / subjects.length : 800;
    const avgY = subjects.length ? subjects.reduce((sum, c) => sum + c.y, 0) / subjects.length : 490;
    const spread = subjects.reduce((max, c) => Math.max(max, Math.hypot(c.x - avgX, c.y - avgY)), 0);
    const baseZoom = clamp(Math.min(viewW / 990, viewH / 630), 0.36, 1.35);
    const desiredZoom = clamp(baseZoom * (1 - spread / 1250), baseZoom * 0.61, baseZoom);
    const smoothing = state === "menu" || state === "finished" ? 0.04 : 0.095;
    camera.zoom += (desiredZoom - camera.zoom) * smoothing;
    camera.x += (avgX - camera.x) * smoothing;
    camera.y += (avgY - camera.y) * smoothing;
    const hw = viewW / (2 * camera.zoom), hh = viewH / (2 * camera.zoom);
    camera.x = hw >= W / 2 ? W / 2 : clamp(camera.x, hw, W - hw);
    camera.y = hh >= H / 2 ? H / 2 : clamp(camera.y, hh, H - hh);
    ctx.save();
    ctx.translate(viewW / 2, viewH / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);
    ctx.drawImage(scene, 0, 0);
    pickups.forEach(item => drawPickup(ctx, item, now));
    for (const shot of shots) {
      ctx.strokeStyle = "#f6e9a2"; ctx.lineWidth = 6; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(shot.x, shot.y);
      ctx.lineTo(shot.x - shot.vx * 0.033, shot.y - shot.vy * 0.033); ctx.stroke();
      ellipse(ctx, shot.x, shot.y, 5, 5, "#fff");
    }
    cars.forEach(car => drawCar(ctx, car, now));
    ctx.restore();
    drawMinimap(ctx);
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
    if (event.target.matches("select,input")) return;
    if (key === "p" || key === "escape") { if (!event.repeat) pause(); event.preventDefault(); return; }
    if (state !== "racing" && state !== "countdown") return;
    if (playerKeys.some(p => Object.values(p).includes(key)) || key === " ") event.preventDefault();
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
      if (state !== "racing" && state !== "countdown") return;
      event.preventDefault();
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
  startButton.addEventListener("click", startRace);
  pauseButton.addEventListener("click", pause);

  // Safari (including embedded iOS browsers) can rubber-band the root page
  // during a long hold or slight finger drift even with touch-action:none.
  // Cancel only the browser default gesture, never the pointer/touch event
  // itself. Pointer capture and simultaneous fingers continue to work.
  const touchControls = document.querySelector("#touch-controls");
  const playing = () => state === "racing" || state === "countdown";
  touchControls.addEventListener("touchstart", event => {
    if (playing() && event.cancelable) event.preventDefault();
  }, { passive: false });
  document.addEventListener("touchmove", event => {
    if (playing() && event.cancelable) event.preventDefault();
  }, { capture: true, passive: false });
  touchControls.addEventListener("contextmenu", event => event.preventDefault());

  // The setup/pause overlay is still allowed to scroll when it is visible.
  for (const radio of document.querySelectorAll('input[name="track"]')) {
    radio.addEventListener("change", () => {
      if (state === "racing" || state === "countdown") return;
      selectedTrack = radio.value; course = courses[selectedTrack];
      trackTag.textContent = course.name; buildScene();
    });
  }
  resize(); buildScene(); makeCars(); makePickups(); updateHud();
  let previous = performance.now();
  function loop(timestamp) {
    const dt = clamp((timestamp - previous) / 1000, 0, 0.045); previous = timestamp;
    step(dt); render(timestamp / 1000);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  window.__mikroSprint = {
    get state() { return state; },
    get track() { return selectedTrack; },
    get cars() { return cars.map(car => ({ id: car.id, x: car.x, y: car.y, angle: car.angle, vx: car.vx, vy: car.vy, lap: car.lap, gun: car.gun, human: car.human })); },
    get pickups() { return pickups.length; },
    get touch() { return { ...touch, stickPointerId: stick.pointerId }; },
    get minimap() { const { x, y, w, h } = minimapBounds(); return { x, y, width: w, height: h }; }
  };
})();
