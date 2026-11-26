const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const assert=require('node:assert/strict');
const test=require('node:test');
const source=readFileSync(join(__dirname,'../nocny-kurs/game.js'),'utf8');

function makeFixture(source, points){
  const section=(start,end)=>{
    const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
    if(a<0||b<0)throw new Error('Missing engine section: '+start);
    return source.slice(a,b);
  };
  const code=section('  const GUARD_MAX_HP=', '  // A crash damages')+
    section('  function carBlocksCircle(', '  function blockedByCar(')+
    section('  function hitPedestrians(', '  function resolvePlayerCollisions(');
  const build=new Function('points', `
    const TRUCK_TYPE='truck',AMBULANCE_TYPE='ambulance',clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
    let running=true,guards=points.map(([x,y])=>({x,y,hp:5,stun:0,walk:1})),carDrivers=[],wanted=0;
    const remains=[],statuses=[],livingPlayers=()=>[];
    const raiseWantedLevel=()=>wanted++;
    const addDeathRemain=(g,x,y,npc)=>remains.push({g,x,y,npc});
    const setGameStatus=status=>statuses.push(status);
    ${code}
    return {hit:hitPedestrians,guards,remains,statuses,get wanted(){return wanted}};
  `);
  return build(points);
}
function scenarios(source, check){
  const car=(speed,driver={},type='car')=>({x:100,y:100,angle:0,speed,driver,type});
  let f=makeFixture(source,[[100,100],[400,400]]);
  f.hit(car(100));check(f.guards.length===2&&f.guards[0].hp===5&&f.wanted===0,'slow impact');
  f.hit(car(160));check(f.guards[0].hp===2.5&&f.guards[0].stun>0&&f.guards[0].walk===0&&f.wanted===1,'medium impact');
  f.hit(car(160));check(f.guards[0].hp===2.5&&f.wanted===1,'continuous contact cooldown');
  f.hit(car(230));check(f.guards.length===1&&f.guards[0].x===400&&f.remains.length===1&&f.statuses.at(-1)==='guardDown'&&f.wanted===2,'lethal impact during cooldown');
  f=makeFixture(source,[[100,100],[105,105]]);
  f.hit(car(250,null));check(f.guards.length===0&&f.remains.length===2&&f.wanted===0,'NPC impact and multiple guards');
  f=makeFixture(source,[[100,100]]);
  f.hit(car(140,{},'truck'));check(f.guards.length===0&&f.remains.length===1,'truck half-speed threshold');
  f=makeFixture(source,[[100,100]]);
  f.hit(car(-160));check(f.guards[0].hp===2.5,'reverse collision');
  f.guards[0].carHitCooldown=0;
  f.hit(car(-160));check(f.guards.length===0,'second separate medium collision');
}

test('vehicle impacts damage and remove guards',()=>scenarios(source,(condition,label)=>assert.ok(condition,label)));
