const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const test = require('node:test')
const { runInNewContext } = require('node:vm')

const source = readFileSync(require('node:path').join(__dirname, '../nocny-kurs/game.js'), 'utf8')

const actualLimit = Number(source.match(/AMBULANCE_LIMIT=(\d+)/)?.[1])

function ambulanceHarness(limit = actualLimit) {
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
    roadsX: [92, 388, 762, 1118], roadsY: [94, 390, 733, 1030],
    hospital: { exitX: 92, exitY: 390 }, cars: [], deathRemains: [],
    nextCarId: 100, carDrivers: [], lastUi: '', world: { w: 2000, h: 2000 },
    DRIVER_MAX_HEALTH: 3, DRIVER_VEHICLE_PURSUIT_CHANCE: 0.5,
    carSidePosition: c => ({ x: c.x, y: c.y + 34 }),
    emitExitDustPuff: () => {}, setGameStatus: () => {}, renderPlayers: () => {}, refreshAmmoHud: () => {},
    clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
    vehicleSpec: () => ({ trafficSpeed: 92, halfLength: 28, halfWidth: 14 }),
    vehicleBlockedAt: () => false, blockedByPlayer: () => false,
    carOverlapsAt: () => false
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
