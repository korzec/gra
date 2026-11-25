const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { runInNewContext } = require("node:vm");

const root = resolve(__dirname, "..");
const gameSource = readFileSync(resolve(root, "mikro-sprint/game.js"), "utf8");
const onlineSource = readFileSync(resolve(root, "mikro-sprint/multiplayer.js"), "utf8");
const page = readFileSync(resolve(root, "micro-m/index.html"), "utf8");

function dedicated(botCount = 3) {
  const node = () => ({
    value: "", textContent: "", innerHTML: "", hidden: false,
    classList: { add() {}, remove() {}, toggle() {} },
    style: { setProperty() {}, removeProperty() {} },
    getContext: () => ({}),
    addEventListener() {},
    getBoundingClientRect: () => ({ width: 390, height: 844 }),
    setAttribute() {}
  });
  const window = { __MIKRO_SPRINT_DEDICATED__: true, __MIKRO_SPRINT_BOTS__: botCount, addEventListener() {} };
  const doc = { querySelector: node, querySelectorAll: () => [], addEventListener() {} };
  runInNewContext(gameSource, { window, document: doc,
    navigator: { getGamepads: () => [] }, performance: { now: () => 0 } }, { timeout: 3000 });
  return window.MikroSprintDedicated;
}

test("browser source runs authoritative physics in headless dedicated mode", () => {
  const simulation = dedicated();
  assert.ok(simulation && typeof simulation.tick === "function");
  assert.equal(simulation.join("a", "bath"), 1);
  assert.equal(simulation.join("b", "pool"), 5);
  const initial = simulation.snapshot();
  assert.equal(initial.track, "bath");
  assert.equal(initial.cars.filter(c => c.human).length, 2);
  for (let i = 0; i < 240; i++) simulation.tick(1 / 60);
  assert.equal(simulation.snapshot().phase, "racing");
  const before = simulation.snapshot().cars[0];
  simulation.input("a", { seq: 12, dx: 0, dy: -1, gas: 1, brake: 0, fire: false });
  for (let i = 0; i < 20; i++) simulation.tick(1 / 60);
  const after = simulation.snapshot().cars[0];
  assert.equal(after.lastAppliedInputSeq, 12);
  assert.ok(Math.hypot(after.x - before.x, after.y - before.y) > 1);
  simulation.leave("a");
  assert.equal(simulation.snapshot().cars[0].human, false);
});

test("dedicated player slots are server-owned and online room wire identity is namespaced", () => {
  const simulation = dedicated();
  const slots = new Set();
  for (let n = 0; n < 8; n++) slots.add(simulation.join("peer-" + n));
  assert.equal(slots.size, 8);
  assert.equal(simulation.join("extra"), null);
  assert.equal(simulation.snapshot().cars.length, 8);
  simulation.input("extra", { seq: 1, dx: 1, dy: 0, gas: 1 });
  assert.equal(simulation.playerCount, 8);
  assert.match(onlineSource, /mikro-sprint-room-v1-/);
  assert.match(onlineSource, /mikro-sprint-server/);
  assert.match(onlineSource, /kind: "input"/);
  assert.match(onlineSource, /type: "probe"/);
  assert.match(page, /id="online-create"/);
  assert.match(page, /id="online-join"/);
  assert.match(page, /multiplayer\.js\?v=__BUILD_SHA__/);
});

test("Online bot configuration is independent of arriving players", () => {
  const simulation = dedicated(2);
  assert.equal(simulation.join("first"), 1);
  assert.equal(simulation.snapshot().cars.length, 3);
  assert.equal(simulation.snapshot().cars.filter(car => !car.human).length, 2);
  for (let n = 1; n < 6; n++) simulation.join("next-" + n);
  assert.equal(simulation.snapshot().cars.length, 8);
  assert.equal(simulation.snapshot().cars.filter(car => !car.human).length, 2);
  simulation.join("seventh");
  assert.equal(simulation.snapshot().cars.filter(car => !car.human).length, 1);
  simulation.join("eighth");
  assert.equal(simulation.snapshot().cars.filter(car => !car.human).length, 0);
});

test("server awards round points, preserves them on restart and ends at ten", () => {
  const simulation = dedicated(1);
  simulation.join("stationary-driver", "pool");
  const start = simulation.snapshot();
  assert.equal(start.cars.length, 2);
  simulation.input("stationary-driver", { seq: 1, name: "  Żaneta  " });
  assert.equal(simulation.snapshot().cars[0].name, "Żaneta");
  for (let i = 0; i < 240; i++) simulation.tick(1 / 60);
  assert.equal(simulation.snapshot().phase, "racing");
  let first;
  for (let i = 0; i < 1400 && !(first = simulation.snapshot()).roundResults.length; i++)
    simulation.tick(1 / 60);
  assert.equal(first.phase, "roundEnd");
  assert.equal(first.roundWinnerId, 1);
  assert.equal(first.winnerId, null);
  assert.equal(first.cars[0].eliminated, true);
  assert.equal(first.cars[0].points, 1);
  assert.equal(first.cars[1].points, 2);
  assert.deepEqual(Array.from(first.roundResults, r => r.delta), [2, 1]);
  const winnerPosition = { x: first.cars[1].x, y: first.cars[1].y };
  for (let i = 0; i < 600; i++) simulation.tick(1 / 60);
  assert.equal(simulation.snapshot().phase, "roundEnd", "waits for readiness without a timeout");
  simulation.input("stationary-driver", { seq: 2, readyRound: 1 });
  simulation.tick(1 / 60);
  const restarted = simulation.snapshot();
  assert.equal(restarted.phase, "countdown");
  assert.equal(restarted.matchRound, 2);
  assert.equal(restarted.cars[0].eliminated, false);
  assert.equal(restarted.cars[0].points, 1);
  assert.equal(restarted.cars[1].points, 2);
  assert.ok(restarted.cars[1].raceProgress < restarted.cars[0].raceProgress,
    "the winner starts last on the reversed grid");
  assert.ok(Math.hypot(restarted.cars[1].x - winnerPosition.x,
    restarted.cars[1].y - winnerPosition.y) < 150);

  let finished;
  let seq = 3;
  for (let i = 0; i < 16000 && (finished = simulation.snapshot()).phase !== "finished"; i++) {
    if (finished.phase === "roundEnd") simulation.input("stationary-driver", { seq: seq++, readyRound: finished.matchRound });
    simulation.tick(1 / 60);
  }
  assert.equal(finished.phase, "finished");
  assert.ok(finished.cars.some(c => c.points >= 10));
  assert.ok(Number.isInteger(finished.winnerId));
  for (let i = 0; i < 600; i++) simulation.tick(1 / 60);
  assert.equal(simulation.snapshot().phase, "finished", "match must not restart automatically");
});

test("camera follows exactly the top two active cars within 20 car lengths", () => {
  // Expose the actual camera helpers in the VM without changing production code.
  const probeSource = gameSource.replace(
    '  if (dedicatedMode) {\n    humans = 0;',
    '  window.cameraProbe = { setCars(next) { cars = next; }, ' +
      'setViewport(w, h) { viewW = w; viewH = h; }, ' +
      'cameraTarget, cameraBounds, updateCamera, eliminateOutsideCamera, camera, ' +
      'makeCar, pointAtDistance, updateRaceProgress, raceStandings };\n' +
      '  if (dedicatedMode) {\n    humans = 0;'
  );
  assert.notEqual(probeSource, gameSource);
  const node = () => ({ getContext: () => ({}), addEventListener() {} });
  const window = { __MIKRO_SPRINT_DEDICATED__: true, addEventListener() {} };
  runInNewContext(probeSource, {
    window, document: { querySelector: node, querySelectorAll: () => [], addEventListener() {} },
    navigator: { getGamepads: () => [] }, performance: { now: () => 0 }
  });
  const probe = window.cameraProbe;
  const leaders = [
    { id: 0, x: 700, y: 500, raceProgress: 5, eliminated: false },
    { id: 1, x: 900, y: 550, raceProgress: 4, eliminated: false }
  ];
  probe.setCars([...leaders,
    { id: 2, x: 20, y: 20, raceProgress: 3, eliminated: false },
    { id: 3, x: 1530, y: 920, raceProgress: 2, eliminated: false }
  ]);
  const firstTarget = probe.cameraTarget();
  assert.equal(firstTarget.x, 760);
  assert.ok(firstTarget.y >= 500 && firstTarget.y <= 515);
  assert.ok(firstTarget.scale >= 1 && firstTarget.scale <= 2.2);
  probe.setCars([...leaders,
    { id: 2, x: 1550, y: 900, raceProgress: 3, eliminated: false },
    { id: 3, x: 10, y: 10, raceProgress: 2, eliminated: false }
  ]);
  assert.deepEqual([probe.cameraTarget().x, probe.cameraTarget().y],
    [firstTarget.x, firstTarget.y], "trailing cars cannot alter the view");
  probe.setCars([leaders[0], { ...leaders[1], x: 1100, y: 600 }]);
  assert.equal(probe.cameraTarget().x, 820, "second place influences the leader-biased center");

  for (const [width, height] of [[1200, 700], [390, 844], [667, 375], [320, 640]]) {
    probe.setViewport(width, height);
    for (const scale of [1, 1.5, 2.2]) {
      probe.camera.scale = scale;
      const { halfW, halfH } = probe.cameraBounds();
      assert.ok(Math.max(2 * halfW, 2 * halfH) <= 20 * 47 + 0.00001,
        "the longest visible axis cannot exceed 20 car lengths");
    }
  }
  probe.setViewport(1200, 700);
  probe.setCars([
    { id: 0, x: 1150, y: 500, raceProgress: 8, eliminated: false },
    { id: 1, x: 120, y: 500, raceProgress: 7, eliminated: false }
  ]);
  probe.updateCamera(1 / 60, true);
  const { halfW, halfH } = probe.cameraBounds();
  assert.ok(Math.abs(probe.camera.x - 1150) < halfW - 47 * 2.6 + 1e-8,
    "the leader has two clear car lengths plus body radius");
  assert.ok(Math.abs(probe.camera.y - 500) <= halfH - 47 * 2.6 + 1e-8);
  const winner = probe.eliminateOutsideCamera();
  assert.equal(winner.id, 0, "trailing car is eliminated when entirely outside");

  const grid = Array.from({ length: 8 }, (_, id) => probe.makeCar(id));
  grid[0].human = true;
  probe.setCars(grid);
  function placeAtDistance(car, distance) {
    const { x, y } = probe.pointAtDistance(distance);
    Object.assign(car, { x, y });
    probe.updateRaceProgress(car);
    assert.ok(Math.abs(car.trackDistance - distance) < 0.001);
  }
  const [driver, nearbyBot, , trailingBot] = grid;
  assert.ok(nearbyBot.trackDistance > trailingBot.trackDistance);
  placeAtDistance(driver, driver.trackDistance + 10);
  placeAtDistance(trailingBot, trailingBot.trackDistance + 40);
  assert.equal(probe.raceStandings()[0].id, driver.id,
    "a bot from a later row stays behind even after travelling farther");
  placeAtDistance(driver, -2);
  placeAtDistance(nearbyBot, 2);
  assert.equal(probe.raceStandings()[0].id, nearbyBot.id, "the overtake crosses the start line");
  placeAtDistance(nearbyBot, -4);
  assert.equal(probe.raceStandings()[0].id, driver.id, "reversing across the line gives back first place");
  placeAtDistance(nearbyBot, 5);

  probe.setViewport(390, 844);
  probe.camera.x = 1450;
  probe.camera.y = 900;
  probe.camera.scale = 2.2;
  const packOrder = probe.raceStandings();
  probe.updateCamera(1 / 60, false, packOrder);
  const portrait = probe.cameraBounds();
  assert.ok(Math.abs(nearbyBot.x - probe.camera.x) <= portrait.halfW - 47 * 2.6 + 1e-8);
  assert.ok(Math.abs(nearbyBot.y - probe.camera.y) <= portrait.halfH - 47 * 2.6 + 1e-8);
  probe.eliminateOutsideCamera(packOrder);
  assert.ok(grid.some(car => car.eliminated), "the edge check eliminates trailing cars");
  assert.equal(nearbyBot.eliminated, false, "the leader survives a lagging camera in an eight-car race");
});

test("four-car elimination standings award +2, +1, -1 and -2", () => {
  const probed = gameSource.replace(
    '  if (dedicatedMode) {\n    humans = 0;',
    '  window.scoreProbe = { setCars(v) { cars = v; }, ' +
      'setRacing() { state = "racing"; }, finishRound, getResults() { return roundResults; }, ' +
      'setOrder(v) { eliminationOrder = v; } };\n' +
    '  if (dedicatedMode) {\n    humans = 0;'
  );
  assert.notEqual(probed, gameSource);
  const node = () => ({ getContext: () => ({}), addEventListener() {} });
  const window = { __MIKRO_SPRINT_DEDICATED__: true, addEventListener() {} };
  runInNewContext(probed, {
    window, document: { querySelector: node, querySelectorAll: () => [], addEventListener() {} },
    navigator: { getGamepads: () => [] }, performance: { now: () => 0 }
  });
  const p = window.scoreProbe;
  p.setCars(Array.from({ length: 4 }, (_, id) =>
    ({ id, x: 800, y: 500, raceProgress: 4 - id, points: 0, name: "", human: false })));
  p.setOrder([3, 2, 1]); p.setRacing();
  p.finishRound({ id: 0, x: 800, y: 500 });
  assert.deepEqual(Array.from(p.getResults(), r => r.delta), [2, 1, -1, -2]);
  assert.deepEqual(Array.from(p.getResults(), r => r.points), [2, 1, -1, -2]);
});

test("round waits for every connected human and ignores readiness for another round", () => {
  const engine = dedicated(0); engine.join("a"); engine.join("b");
  for(let i=0;i<250;i++) engine.tick();
  engine.input("a", {seq:1,gas:1,dx:0,dy:-1});
  for(let i=0;i<1500 && engine.snapshot().phase!=="roundEnd";i++) engine.tick();
  const end=engine.snapshot(); assert.equal(end.phase,"roundEnd");
  engine.input("a",{seq:2,readyRound:end.matchRound}); engine.tick();
  assert.equal(engine.snapshot().phase,"roundEnd");
  engine.input("b",{seq:1,readyRound:end.matchRound+1}); engine.tick();
  assert.equal(engine.snapshot().phase,"roundEnd");
  engine.input("b",{seq:2,readyRound:end.matchRound}); engine.tick();
  assert.equal(engine.snapshot().phase,"countdown");
  assert.equal(engine.snapshot().matchRound,end.matchRound+1);
  assert.equal(engine.snapshot().readyIds.length,0);
});
test("compact eight-car grid is ordered and has no overlapping centers", () => {
  for (const track of ["pool","bath"]) {
    const engine=dedicated(7); engine.join("a",track);
    const cars=engine.snapshot().cars;
    for(let i=1;i<cars.length;i++) assert.ok(cars[i].trackDistance<cars[i-1].trackDistance);
    for(let i=0;i<cars.length;i++) for(let j=i+1;j<cars.length;j++)
      assert.ok(Math.hypot(cars[i].x-cars[j].x,cars[i].y-cars[j].y)>40);
  }
});

test("online viewport fits the same reference frame and camera interpolation uses the car timeline", () => {
  const fit = gameSource.match(/  function fitOnlineViewport\(width, height\) \{[\s\S]*?\n  \}/)[0];
  const render = gameSource.match(/  function onlineRenderFrame\(\) \{[\s\S]*?\n  \}/)[0];
  const frame = (tick, x) => ({tick, arrived: 1000, phase:"racing", round:2,
    camera:{x,y:400,scale:1.5}, cars:[{id:0,x:x+100,y:400,angle:0,eliminated:false}]});
  const frames = [frame(100, 300), frame(112, 420)];
  const probe = runInNewContext(fit + "\n" + render + "\n({fitOnlineViewport, onlineRenderFrame})", {
    remoteFrames:frames, performance:{now:()=>1000},
    clamp:(v,a,b)=>Math.max(a,Math.min(b,v)), angleWrap:a=>Math.atan2(Math.sin(a),Math.cos(a)), Math
  });
  for (const [w,h] of [[390,844],[844,390],[1200,700],[1920,1080]]) {
    const f=probe.fitOnlineViewport(w,h);
    assert.ok(f.width<=w+1e-8 && f.height<=h+1e-8);
    assert.ok(Math.abs(f.width/f.height-1200/700)<1e-8);
    const zoom=f.scale*1200/940*1.5;
    assert.ok(Math.abs(f.width/zoom-940/1.5)<1e-8);
    assert.ok(Math.abs(f.height/zoom-(940*700/1200)/1.5)<1e-8);
  }
  const rendered=probe.onlineRenderFrame();
  assert.equal(rendered.camera.x,360);
  assert.equal(rendered.cars[0].x-rendered.camera.x,100);
});
test("each game declares a browser icon, iOS icon and Android home-screen manifest", () => {
  for(const dir of ["micro-m","grand-t","swietliki","lesne-jednorozce"]){
    const html=readFileSync(resolve(root,dir,"index.html"),"utf8");
    assert.match(html,/rel="icon"[^>]+image\/png/);
    assert.match(html,/rel="apple-touch-icon"[^>]+180x180/);
    assert.match(html,/rel="manifest"/);
    const manifest=JSON.parse(readFileSync(resolve(root,dir,"manifest.webmanifest"),"utf8"));
    assert.equal(manifest.start_url,"./");
    for(const n of [180,192,512]){
      const png=readFileSync(resolve(root,"assets",dir+"-icon-"+n+".png"));
      assert.equal(png.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
      assert.equal(png.readUInt32BE(16),n);
      assert.equal(png.readUInt32BE(20),n);
      if(n!==180) assert.ok(manifest.icons.some(icon=>icon.sizes===n+"x"+n));
    }
  }
});

test("readiness can be cancelled before everyone is ready; old packets cannot restore it", () => {
  const engine=dedicated(0); engine.join("a"); engine.join("b");
  for(let i=0;i<250;i++) engine.tick();
  engine.input("a",{seq:1,gas:1,dx:0,dy:-1});
  for(let i=0;i<1500 && engine.snapshot().phase!=="roundEnd";i++) engine.tick();
  const round=engine.snapshot().matchRound;
  assert.equal(engine.snapshot().phase,"roundEnd");
  engine.input("a",{seq:2,readyRound:round,ready:true});
  assert.ok(engine.snapshot().readyIds.includes(0));
  engine.input("a",{seq:3,readyRound:round,ready:false});
  engine.input("a",{seq:2,readyRound:round,ready:true});
  assert.ok(!engine.snapshot().readyIds.includes(0));
  engine.input("b",{seq:1,readyRound:round,ready:true}); engine.tick();
  assert.equal(engine.snapshot().phase,"roundEnd");
  engine.input("a",{seq:4,readyRound:round,ready:true}); engine.tick();
  assert.equal(engine.snapshot().phase,"countdown");
});
test("round pedal selection gives reverse priority and ignores small analog noise", () => {
  const source=gameSource.match(/  function readyPedal\(input\) \{[\s\S]*?\n  \}/)[0];
  const pedal=runInNewContext(source+"\nreadyPedal");
  assert.equal(pedal({gas:1,brake:0}),"confirm");
  assert.equal(pedal({gas:0,brake:1}),"cancel");
  assert.equal(pedal({gas:1,brake:1}),"cancel");
  assert.equal(pedal({gas:0.1,brake:0.1}),null);
});

test("shot prediction and server simulation use the same projectile integrator and stable IDs", () => {
  const source = gameSource;
  const extract = name => source.match(new RegExp("  function " + name + "\\([^\\n]*\\) \\{[\\s\\S]*?\\n  \\}"))[0];
  const weapons = source.slice(source.indexOf("  const WEAPONS = {"),source.indexOf("\n  };",source.indexOf("  const WEAPONS = {"))+5);
  const probe = runInNewContext(weapons + `
    let shots=[],cars=[],matchRound=2,W=5000,H=5000;
    const course={objects:[]};const onlineActive=()=>false;const tone=()=>{};
    const angleWrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
    const raceStandings=()=>cars;const hitCar=()=>{};const burst=()=>{};
  `+extract("fire")+"\n"+extract("updateShots")+ `
    ({fire,updateShots,setCars(v){cars=v},getShots(){return shots}})
  `, {Math});
  const car={id:0,human:true,x:500,y:500,angle:0,vx:0,vy:0,gun:2,weapon:"machinegun",fireCooldown:0,shotSerial:0,eliminated:false};
  probe.setCars([car]);probe.fire(car);
  const shot=probe.getShots()[0];
  assert.equal(shot.shotId,"2:0:1");
  assert.equal(car.gun,1);
  const x=shot.x;
  probe.updateShots(1/60);
  assert.ok(shot.x>x);
  car.weapon="sonic";car.gun=2;car.fireCooldown=0;probe.fire(car);
  const pulse=probe.getShots().find(s=>s.kind==="pulse");
  assert.ok(pulse);
  probe.updateShots(1/60);
  assert.ok(pulse.life<0.22);
});

test("own driver uses predicted position and heading without changing elimination authority", () => {
  const helper=gameSource.match(/  function predictedDriverPose\(car, correction, frameCamera\) \{[\s\S]*?\n  \}/)[0];
  const geometry=gameSource.slice(gameSource.indexOf("  function carEdgeOffsets("),gameSource.indexOf("  function carEdgeContact("));
  const pose=runInNewContext(geometry+"\n"+helper+"\npredictedDriverPose",{
    CAMERA_MAX_SPAN:940,CAR_LENGTH:47,LEADER_CAMERA_MARGIN:47*2.6,clamp:(x,a,b)=>Math.max(a,Math.min(b,x))
  });
  const frame={x:500,y:500,scale:1};
  const car={id:1,x:550,y:510,angle:0.8,eliminated:false};
  assert.equal(pose(car,{x:0,y:0,angle:-0.5},frame).angle,0.8);
  assert.equal(pose(car,{x:0,y:0},frame).x,550);
  const edge=pose({...car,x:1500},{x:0,y:0},frame);
  assert.ok(edge.x<970);assert.equal(edge.eliminated,false);
  const leaderEdge = pose({...car,x:1500,y:1500},{x:0,y:0},{...frame,leaderId:1});
  assert.ok(leaderEdge.x <= 970 - 47 * 2.6 + 1e-8);
  assert.ok(leaderEdge.y <= 500 + 470 * 700 / 1200 - 47 * 2.6 + 1e-8);
  assert.equal(pose({...car,eliminated:true},{x:0,y:0},frame).eliminated,true);
});

test("elimination requires the entire rotated body and wheels to leave the view", () => {
  const code=gameSource.slice(gameSource.indexOf("  function carEdgeOffsets("),gameSource.indexOf("  function eliminateOutsideCamera("));
  const exit=gameSource.slice(gameSource.indexOf("  function edgeExitPose("),gameSource.indexOf("  // Visual-only exit:"));
  const {contact,pose}=runInNewContext(code+exit+"\n({contact:carEdgeContact,pose:edgeExitPose})",{clamp:(x,a,b)=>Math.max(a,Math.min(b,x))});
  const frame={x:500,y:500}, halfW=200,halfH=100;
  for (const [angle,x,y,edge] of [[0,723,500,"right"],[0,276,500,"left"],[0,500,613,"bottom"],[0,500,386,"top"],[Math.PI/2,500,623,"bottom"]]) {
    const car={x,y,angle};
    const dx=edge==="right"?-1:edge==="left"?1:0,dy=edge==="bottom"?-1:edge==="top"?1:0;
    assert.equal(contact({...car,x:x+dx*.5,y:y+dy*.5},frame,halfW,halfH),null,"partially visible");
    assert.equal(contact(car,frame,halfW,halfH),edge,"entire car outside");
  }
  assert.equal(contact({x:710,y:500,angle:0},frame,halfW,halfH),null);
  assert.ok(contact({x:725,y:625,angle:Math.PI/4},frame,halfW,halfH),"rotated car outside diagonal corner");
  assert.equal(contact({x:705,y:605,angle:Math.PI/4},frame,halfW,halfH),null,"corner still visible");
  const p=pose({x:800,y:530,angle:0,edgeExit:"right"},frame,halfW,halfH);
  assert.ok(Math.abs(p.x-723)<1e-8);
  assert.equal(contact(p,frame,halfW,halfH),"right");
});
