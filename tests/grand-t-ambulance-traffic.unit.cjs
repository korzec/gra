const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const test = require('node:test')
const { runInNewContext } = require('node:vm')

const source = readFileSync(require('node:path').join(__dirname, '../nocny-kurs/game.js'), 'utf8')

const actualLimit = Number(source.match(/AMBULANCE_LIMIT=(\d+)/)?.[1])

function ambulanceHarness(limit = actualLimit, physicalBays = false) {
  const start = source.indexOf('  function nearestStreet(')
  const end = source.indexOf('  function drawAmbulance(', start)
  assert.ok(start >= 0 && end > start, 'ambulance traffic helpers exist')
  const helper = (name, next) => {
    const start = source.indexOf('  function ' + name + '(')
    const end = source.indexOf('  function ' + next + '(', start)
    assert.ok(start >= 0 && end > start, name + ' exists')
    return source.slice(start, end)
  }
  const context = {
    Math, AMBULANCE_TYPE: 'ambulance', AMBULANCE_LIMIT: limit,
    AMBULANCE_LOADING_TIME: 2, NPC_REMAIN_LIFETIME: 60, CAR_MAX_HEALTH: 10, laneOffset: 18,
    roadsX: [92, 388, 762, 1118, 1520, 1876, 2296, 2708], roadsY: [94, 390, 733, 1030, 1416, 1786, 2108],
    hospital: { exitX: 643, exitY: 1695 }, cars: [], deathRemains: [],
    nextCarId: 100, carDrivers: [], lastUi: '', world: { w: 2000, h: 2000 },
    DRIVER_MAX_HEALTH: 3, DRIVER_VEHICLE_PURSUIT_CHANCE: 0.5,
    carSidePosition: c => ({ x: c.x, y: c.y + 34 }),
    emitExitDustPuff: () => {}, setGameStatus: () => {}, renderPlayers: () => {}, refreshAmmoHud: () => {},
    clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
    vehicleSpec: () => ({ trafficSpeed: 92, halfLength: 28, halfWidth: 14 }),
    vehicleBlockedAt: () => false, blockedByPlayer: () => false,
    carOverlapsAt: (car,x,y,angle,other) => physicalBays && Math.hypot(x-other.x,y-other.y)<56
  }
  runInNewContext(source.slice(start, end) + helper('hijackCar', 'refreshAmmoHud') + helper('boardCar', 'chaseCarInput') + `
    this.api = {
      update: updateAmbulances,
      cars: () => cars,
      board: boardCar,
      drivers: () => carDrivers,
      setRemains: remains => { deathRemains = remains }
    }
  `, context)
  return context.api
}

test('ambulances join traffic, stolen units count toward the cap, and completed jobs return', () => {
  const h = ambulanceHarness(2)
  const firstRemain = { x: 700, y: 700, age: 0, awaitingPickup: true }
  h.setRemains([firstRemain])
  h.update(0)
  const [stolen] = h.cars()
  assert.equal(stolen.type, 'ambulance')
  assert.equal(stolen.traffic, true)
  assert.equal(stolen.npcInside, true)
  assert.ok(stolen.trafficRoute.length > 1)
  assert.equal(stolen.ambulanceJob.remain, firstRemain)

  // Use the real boarding and NPC displacement functions, not manual state edits.
  const player = { id: 1, car: null }
  assert.equal(h.board(player, stolen), true)
  assert.equal(stolen.driver, player)
  assert.equal(player.car, stolen)
  assert.equal(stolen.npcInside, false)
  assert.ok(h.drivers().some(driver => driver.carId === stolen.id))
  assert.equal(h.board({ id: 2, car: null }, stolen), false)
  const secondRemain = { x: 900, y: 900, age: 0, awaitingPickup: true }
  const thirdRemain = { x: 1100, y: 800, age: 0, awaitingPickup: true }
  h.setRemains([secondRemain, thirdRemain])
  h.update(0)
  assert.equal(stolen.traffic, false)
  assert.equal(stolen.ambulanceJob, null)
  const active = h.cars().filter(car => car.type === 'ambulance')
  assert.equal(active.length, 2)
  const returning = active.find(car => car !== stolen)
  assert.equal(returning.ambulanceJob.remain, secondRemain)
  h.update(0)
  assert.equal(h.cars().filter(car => car.type === 'ambulance').length, 2)

  let target = returning.trafficRoute.at(-1)
  returning.x = target[0]; returning.y = target[1]
  h.update(2)
  assert.equal(secondRemain.awaitingPickup, false)
  assert.equal(secondRemain.collected, true)
  assert.equal(returning.ambulanceJob.remain, null)

  target = returning.trafficRoute.at(-1)
  returning.x = target[0]; returning.y = target[1]
  h.update(0)
  const afterReturn = h.cars().filter(car => car.type === 'ambulance')
  assert.equal(afterReturn.length, 2)
  assert.ok(afterReturn.includes(stolen))
  assert.ok(!afterReturn.includes(returning))
  assert.equal(afterReturn.find(car => car !== stolen).ambulanceJob.remain, thirdRemain)
})

test('dedicated snapshots carry ambulances as cars', () => {
  assert.ok(source.includes('cars:cars.map(c=>({'))
  assert.equal(source.includes('ambulances:ambulances.map('), false)
})

test('production fleet cap permits twenty ambulances, including a stolen one', () => {
  assert.equal(actualLimit, 20)
  const h = ambulanceHarness()
  const remains = Array.from({length: 22}, (_, i) => ({x: 700+i*10,y: 700,age: 0,awaitingPickup: true}))
  h.setRemains(remains)
  h.update(0)
  const stolen = h.cars()[0]
  assert.equal(h.board({id: 1, car: null}, stolen), true)
  for (let i = 0; i < 30; i++) h.update(0)
  assert.equal(h.cars().length, 20)
  assert.equal(h.cars().filter(c => c.npcInside).length, 19)
  assert.ok(h.cars().includes(stolen))
  assert.equal(new Set(h.cars().filter(c => c.ambulanceJob?.remain).map(c => c.ambulanceJob.remain)).size, 19)
})

test('service ambulance bypasses red lights and stationary cars without overlapping them', () => {
  const start=source.indexOf('  function ambulanceClear('),end=source.indexOf('  function advanceTraffic(',start);
  const overlapStart=source.indexOf('  function carOverlapsAt('),overlapEnd=source.indexOf('  }  function updateBrakeLight(',overlapStart);
  assert.ok(start>=0&&end>start&&overlapEnd>overlapStart);
  const make=new Function(`
    let cars=[],lightCalls=0;
    const AMBULANCE_TYPE='ambulance',vehicleSpec=c=>c.type==='ambulance'?{halfLength:28,halfWidth:14}:{halfLength:22,halfWidth:13};
    const vehicleAtBoundary=()=>false;
    const vehicleBlockedAt=(c,x,y,angle)=>{
      const s=vehicleSpec(c),extent=Math.abs(Math.sin(angle))*s.halfLength+Math.abs(Math.cos(angle))*s.halfWidth;
      return Math.abs(y-100)+extent>45;
    };
    const upcomingTrafficTurn=()=>null,updateBrakeLight=()=>{},emitTireMarks=()=>{},hitPedestrians=()=>{};
    const upcomingTrafficStop=()=>{lightCalls++;return {}},trafficLights={permittedStep:()=>0};
    ${source.slice(start,end)}
    ${source.slice(overlapStart,overlapEnd)}  }
    ${source.slice(end,source.indexOf('  function ',end+15))}
    return {
      init(blockers){const c={type:'ambulance',x:30,y:118,angle:0,speed:0,trafficSpeed:92,traffic:true,npcInside:true,trafficIndex:1,trafficRoute:[[30,118],[350,118]],trafficWait:0,ambulanceJob:{remain:null}};cars=[c,...blockers];return c},
      step:advanceTraffic,clear:ambulanceClear,lightCalls:()=>lightCalls
    };
  `);
  for(const blockers of [[],[{x:140,y:118,angle:0,type:'car'}],[{x:140,y:118,angle:0,type:'car'},{x:250,y:82,angle:0,type:'car'}]]){
    const h=make(),c=h.init(blockers.map(b=>({...b,driver:{}})));
    let minY=c.y;
    for(let i=0;i<900;i++){
      h.step(1/60);minY=Math.min(minY,c.y);
      assert.ok(h.clear(c,c.x,c.y,c.angle),'ambulance must not overlap an obstacle');
      if(Math.hypot(c.x-350,c.y-118)<.05)break;
    }
    assert.ok(Math.hypot(c.x-350,c.y-118)<.1,'ambulance should reach destination');
    assert.equal(h.lightCalls(),0);
    if(blockers.length)assert.ok(minY<100,'ambulance should use the other lane');
    h.step(1/60);
    assert.equal(c.x,350,'ambulance waits at the end of the service leg');
  }
});

test('hospital dispatch uses other bays when the first one is blocked and can fill the fleet', () => {
  const h = ambulanceHarness(actualLimit, true)
  const remains = Array.from({length: 23}, (_, i) => ({x: 700+i*10,y: 700,age: 0,awaitingPickup: true}))
  h.setRemains(remains)
  h.update(0)
  const stolen = h.cars()[0]
  assert.equal(h.board({id: 1, car: null}, stolen), true)
  const dockX = stolen.x, dockY = stolen.y
  // Leave the stolen ambulance at the original exit. The other three bays
  // can still dispatch, without spawning on top of a vehicle.
  for (let i=0;i<5;i++) h.update(0)
  assert.equal(h.cars().length, 4)
  assert.equal(new Set(h.cars().map(c=>c.x)).size,4)
  assert.ok(h.cars().every(c=>c.y===dockY))
  for (let wave=0;wave<10;wave++) {
    for (const c of h.cars()) {
      if (c!==stolen && c.y===dockY) {
        c.x=400+((c.id-100)%10)*80
        c.y=700+Math.floor((c.id-100)/10)*80
      }
    }
    for(let i=0;i<4;i++) h.update(0)
  }
  assert.equal(h.cars().length,20)
  assert.equal(stolen.x,dockX)
  assert.equal(new Set(h.cars().filter(c=>c.ambulanceJob?.remain).map(c=>c.ambulanceJob.remain)).size,19)
})
