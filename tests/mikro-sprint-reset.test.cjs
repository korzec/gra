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

test("race progress accepts shortcuts up to five percent of the actual lap", () => {
  const helpers = ["projectTrack", "setTrackDistance", "updateRaceProgress"].map(name =>
    source.match(new RegExp("  function " + name + "\\([^\\n]*\\) \\{[\\s\\S]*?\\n  \\}"))[0]).join("\n");
  const course = {
    roadWidth: 100, totalLength: 4000, distances: [0, 1000, 2000, 3000, 4000],
    path: [{x:0,y:0},{x:1000,y:0},{x:1000,y:1000},{x:0,y:1000}]
  };
  const update = vm.runInNewContext(helpers + "\nupdateRaceProgress", {
    course, clamp: (v,lo,hi) => Math.max(lo,Math.min(hi,v))
  });
  const car = (distance, x, y) => ({trackDistance:distance, roundStartDistance:0, x,y, eliminated:false});
  const valid = car(900,1000,100);
  update(valid);
  assert.equal(valid.trackDistance,1100, "exactly 5% across a bend");
  assert.equal(valid.raceProgress,0.275);
  assert.equal(valid.safeIndex,1);
  const tooFar = car(900,1000,101);
  for (let i=0;i<20;i++) update(tooFar);
  assert.equal(tooFar.trackDistance,900,"oversized cut cannot accumulate progress while stationary");
  tooFar.y=99;
  update(tooFar);
  assert.equal(tooFar.trackDistance,1099,"return to the allowed arc restores progress");
  const offroad = car(900,850,150);
  update(offroad);
  assert.equal(offroad.trackDistance,900);
  const crossing = car(3900,100,0);
  update(crossing);
  assert.equal(crossing.trackDistance,4100);
  assert.equal(crossing.lap,1);
  crossing.x=0;crossing.y=50;
  update(crossing);
  assert.equal(crossing.trackDistance,3950,"reverse across start line subtracts progress");
  const far = car(900,0,700);
  for(let i=0;i<20;i++) update(far);
  assert.equal(far.trackDistance,900,"distant branch must not become a valid projection");
});
