const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "../mikro-sprint/game.js"), "utf8");

const updateSource = source.match(/  function updateCar\(car, dt, inputOverride = null\) \{[\s\S]*?\n  \}/);
assert.ok(updateSource, "updateCar must exist");
function fixture(onRoad = false, pits = []) {
  const context = {
    Math, W: 1000, H: 1000, selectedTrack: "pool",
    course: { roadWidth: 100, pits, objects: [] },
    isOnRoad: () => onRoad,
    clamp: (v, low, high) => Math.max(low, Math.min(high, v)),
    steerCarRelative: () => {}, collectPickup: () => {}, fire: () => {},
    resetCar: car => { car.reset = true; }
  };
  const update = vm.runInNewContext(updateSource[0] + "\nupdateCar", context);
  const car = { x: 500, y: 500, vx: 0, vy: 0, angle: 0, speed: 0,
    human: true, finishAt: null, eliminated: false, trackDistance: 0,
    offroad: 1, invuln: 0, hit: 0, turbo: 0, fireCooldown: 0 };
  const input = { dx: 0, gas: 0, brake: 0, fire: false };
  return { car, step: () => update(car, 1 / 60, input), setOnRoad: value => { onRoad = value; }, input };
}
test("moving cars never reset off the road, in pits or beyond the recovery boundary", () => {
  for (const [vx, vy] of [[100, 0], [-100, 0], [0, 100]]) {
    for (const hazard of ["offroad", "pit", "edge"]) {
      const { car, step } = fixture(hazard !== "offroad", hazard === "pit" ? [[500, 500]] : []);
      Object.assign(car, { vx, vy, x: hazard === "edge" ? 60 : 500 });
      step();
      assert.equal(car.reset, undefined, hazard);
    }
  }
});
test("stationary cars recover only when a recovery condition is met", () => {
  for (const [onRoad, pits, x, offroad, expected] of [
    [false, [], 500, 1, true], [false, [], 500, 0, undefined],
    [true, [[500, 500]], 500, 0, true], [true, [], 60, 0, true],
    [true, [], 500, 0, undefined]
  ]) {
    const { car, step } = fixture(onRoad, pits);
    Object.assign(car, { x, offroad, vx: 3, vy: 3, speed: 100 });
    step();
    assert.equal(car.reset, expected);
  }
});
test("world edge stops outward movement without teleporting a moving car", () => {
  const { car, step } = fixture();
  Object.assign(car, { x: 999.5, vx: 100, vy: 0 });
  step();
  assert.equal(car.reset, undefined);
  assert.equal(car.x, 1000);
  assert.equal(car.vx, 0);
  step();
  assert.equal(car.reset, true);
});

test("off-road slows the car, reentry restores normal physics immediately", () => {
  const on = fixture(true), off = fixture(false);
  Object.assign(on.car, {vx:350,vy:0,angle:0});
  Object.assign(off.car, {vx:350,vy:0,angle:0});
  on.input.gas = off.input.gas = 1;
  on.step(); off.step();
  assert.ok(off.car.speed < on.car.speed, "offroad must slow the car");
  assert.ok(off.car.speed <= 392 * 0.55 + 1e-8, "offroad speed cap");
  assert.equal(off.car.reset,undefined);
  Object.assign(on.car,off.car);
  off.setOnRoad(true);
  on.step(); off.step();
  assert.equal(off.car.vx,on.car.vx);
  assert.equal(off.car.speed,on.car.speed);
  assert.equal(off.car.offroad,0);
  assert.equal(off.car.reset,undefined);
  assert.ok(off.car.speed > 392 * 0.55, "reentry removes speed cap");
});
test("distant track segments restore surface physics even when progress is stale", () => {
  const helper = source.match(/  function isOnRoad\(x, y, reference\) \{[\s\S]*?\n  \}/)[0];
  const course = {roadWidth:100,path:[{x:0,y:0},{x:1000,y:0},{x:1000,y:1000},{x:0,y:1000}]};
  const classify = vm.runInNewContext(helper + "\nisOnRoad", {
    course, projectTrack: () => ({distanceSquared:1000000}),
    clamp: (v,lo,hi) => Math.max(lo,Math.min(hi,v))
  });
  assert.equal(classify(1000,500,0),true);
  assert.equal(classify(1030,500,0),true);
  assert.equal(classify(500,1000,0),true);
  assert.equal(classify(500,500,0),false);
  assert.equal(classify(1060,500,0),false);
});

test("off-road progress interpolates continuously and reorders the race", () => {
  const helpers = ["projectTrack", "setTrackDistance", "updateRaceProgress", "raceStandings"].map(name =>
    source.match(new RegExp("  function " + name + "\\([^\\n]*\\) \\{[\\s\\S]*?\\n  \\}"))[0]).join("\n");
  const course = {
    roadWidth: 100, totalLength: 4000, distances: [0, 1000, 2000, 3000, 4000],
    path: [{x:0,y:0},{x:1000,y:0},{x:1000,y:1000},{x:0,y:1000}]
  };
  const car = (id, distance, x, y) => ({id, trackDistance:distance, roundStartDistance:0,
    raceProgress:distance/4000, x,y, eliminated:false});
  const shortcut = car(0,900,900,300), leader = car(1,1200,1000,200);
  const cars = [shortcut, leader];
  const { update, standings } = vm.runInNewContext(helpers +
    "\n({update:updateRaceProgress, standings:raceStandings})", {
    course, cars, clamp: (v,lo,hi) => Math.max(lo,Math.min(hi,v))
  });
  update(shortcut, 1/60);
  assert.ok(shortcut.trackDistance > 900 && shortcut.trackDistance < 1300);
  assert.equal(shortcut.safeTrackDistance,900,"last on-road position remains the recovery point");
  assert.equal(standings()[0].id,1);
  for(let i=0;i<60;i++) update(shortcut,1/60);
  assert.ok(shortcut.trackDistance > 1200 && shortcut.trackDistance < 1300);
  assert.equal(standings()[0].id,0,"overtaking while still off-road");
  const fast = car(2,900,900,300), slow = car(3,900,900,300);
  for(let i=0;i<60;i++) update(fast,1/60);
  for(let i=0;i<30;i++) update(slow,1/30);
  assert.ok(Math.abs(fast.trackDistance-slow.trackDistance)<1e-8,"tick-rate independent interpolation");
  Object.assign(shortcut,{x:1000,y:600});
  update(shortcut,1/60);
  assert.equal(shortcut.trackDistance,1600,"reentry uses exact progress");
  assert.equal(shortcut.safeTrackDistance,1600);
  assert.equal(shortcut.safeIndex,1);
  Object.assign(shortcut,{x:1000,y:100});
  update(shortcut,1/60);
  assert.equal(shortcut.trackDistance,1100,"rejoining behind also updates order");
  assert.equal(standings()[0].id,1);
  const crossing = car(4,3900,300,-100);
  update(crossing,0.18);
  assert.ok(crossing.trackDistance>4000 && crossing.trackDistance<4300,"interpolation across start line");
  Object.assign(crossing,{x:300,y:0});
  update(crossing,1/60);
  assert.equal(crossing.trackDistance,4300);
  assert.equal(crossing.lap,1);
  crossing.x=0;crossing.y=100;
  update(crossing,1/60);
  assert.equal(crossing.trackDistance,3900,"reverse across start line");
  crossing.eliminated=true;
  crossing.x=500;crossing.y=0;
  update(crossing,1/60);
  assert.equal(crossing.trackDistance,3900,"eliminated cars do not advance");
});
