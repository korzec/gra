const test=require('node:test')
const assert=require('node:assert/strict')
const {readFileSync}=require('node:fs')
const {resolve}=require('node:path')
const {runInNewContext}=require('node:vm')
const source=readFileSync(resolve(__dirname,'../nocny-kurs/game.js'),'utf8')

function harness() {
  const between=(a,b)=>{
    const start=source.indexOf(a), end=source.indexOf(b,start+a.length)
    assert.ok(start>=0 && end>start)
    return source.slice(start,end)
  }
  const context={Math, bazookaDrops:[], lastUi:'', pos:p=>p.car||p,
    addDeathRemain(){}, setGameStatus(){}, renderPlayers(){}, refreshAmmoHud(){}}
  runInNewContext(between('  function killPlayer(', '  function damagePlayer(')+
    between('  function collectBazookaDrops(', '  function collectCashPacks(')+
    '\nthis.api={killPlayer,collectBazookaDrops}',context)
  return {...context.api,drops:context.bazookaDrops}
}
const player=(ammo=0,x=0,y=0)=>({id:2,x,y,alive:true,bazookaAmmo:ammo,car:null})
test('death drops remaining rockets exactly once; a nearby living pedestrian can recover them',()=>{
  const h=harness(), owner=player(37), dead=player(), driver=player(), armed=player(8), far=player(0,100), taker=player(), other=player()
  dead.alive=false; driver.car={x:0,y:0}
  h.killPlayer(owner); h.killPlayer(owner)
  assert.equal(owner.bazookaAmmo,0)
  assert.equal(h.drops.length,1)
  assert.equal(h.drops[0].ammo,37)
  h.collectBazookaDrops([owner,dead,driver,armed,far])
  assert.equal(h.drops.length,1)
  h.collectBazookaDrops([taker,other])
  assert.equal(taker.bazookaAmmo,37)
  assert.equal(other.bazookaAmmo,0)
  assert.equal(h.drops.length,0)
})
test('unarmed death creates no item; death in vehicle uses the vehicle position',()=>{
  const h=harness()
  h.killPlayer(player())
  assert.equal(h.drops.length,0)
  const owner=player(12);owner.car={x:42,y:66,driver:owner}
  h.killPlayer(owner)
  assert.equal(h.drops[0].x,42)
  assert.equal(h.drops[0].y,66)
})
test('items reset each round and are carried in authoritative snapshots',()=>{
  assert.match(source,/cashPacks=\[\];bazookaDrops=\[\];pistolDrops=\[\];medkits=\[\]/)
  assert.match(source,/parcels,cashPacks,bazookaDrops,pistolDrops,medkits/)
  assert.match(source,/bazookaDrops=Array\.isArray\(state\.bazookaDrops\)\?state\.bazookaDrops:\[\]/)
  assert.match(source,/collectBazookaDrops\(active\);/)
})
