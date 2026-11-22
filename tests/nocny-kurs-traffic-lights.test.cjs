const { test } = require('node:test');
const assert = require('node:assert/strict');
const lights = require('../nocny-kurs/traffic-lights.js');

const roadsX = [92,388,762,1118,1520,1876,2296,2708];
const roadsY = [94,390,733,1030,1416,1786,2108];
const base = {roadsX,roadsY,roadWidth:72,laneOffset:18,halfLength:22};

test('every intersection has nonconflicting red, amber and green phases', () => {
  for (let xi=0;xi<roadsX.length;xi++)for(let yi=0;yi<roadsY.length;yi++){
    const seen = new Set();
    for (let tick=0;tick<lights.CYCLE_SECONDS*10;tick++){
      const t=tick/10;
      const h=lights.signal(xi,yi,t,'horizontal');
      const v=lights.signal(xi,yi,t,'vertical');
      assert.ok(!(h==='green'&&v==='green'), 'conflicting green movements');
      seen.add(h);seen.add(v);
    }
    assert.deepEqual([...seen].sort(), ['amber','green','red']);
  }
});

test('signal phases alternate directions and include all-red clearance', () => {
  assert.equal(lights.signal(1,1,0,'horizontal'),'green');
  assert.equal(lights.signal(1,1,0,'vertical'),'red');
  assert.equal(lights.signal(1,1,10.5,'horizontal'),'amber');
  assert.equal(lights.signal(1,1,12.5,'horizontal'),'red');
  assert.equal(lights.signal(1,1,12.5,'vertical'),'red');
  assert.equal(lights.signal(1,1,14,'vertical'),'green');
  assert.equal(lights.signal(1,1,23.5,'vertical'),'amber');
  assert.equal(lights.signal(1,1,25.5,'vertical'),'red');
  assert.equal(lights.signal(1,1,26,'horizontal'),'green');
});

test('red and amber stop cars before the junction; green and passed stop lines do not', () => {
  const eastbound={...base,x:306,y:roadsY[1]-18,angle:0,time:14};
  const stop=lights.upcomingStop(eastbound);
  assert.equal(stop.color,'red');
  assert.equal(stop.xi,1);
  assert.equal(stop.yi,1);
  assert.equal(stop.distance,20);
  assert.equal(lights.upcomingStop({...eastbound,time:10.5})?.color,'amber');
  assert.equal(lights.upcomingStop({...eastbound,time:0}),null);
  assert.equal(lights.upcomingStop({...eastbound,x:328,time:14,lookahead:50}),null);
  assert.equal(lights.upcomingStop({...eastbound,y:roadsY[1]+45,time:14}),null);
  assert.equal(lights.upcomingStop({...eastbound,x:470,angle:Math.PI,time:14})?.distance,20);
});

test('northbound vehicles stop for vertical red then clear on vertical green', () => {
  const northbound={...base,x:roadsX[1]+18,y:472,angle:-Math.PI/2,time:0};
  const red=lights.upcomingStop(northbound);
  assert.equal(red.color,'red');
  assert.equal(red.distance,20);
  assert.equal(lights.upcomingStop({...northbound,time:14}),null);
});

test('trucks stop earlier to keep their longer noses behind the stop line', () => {
  const car=lights.upcomingStop({...base,x:280,y:372,angle:0,time:14});
  const truck=lights.upcomingStop({...base,x:280,y:372,angle:0,halfLength:38,time:14});
  assert.equal(car.distance,46);
  assert.equal(truck.distance,30);
  assert.equal(roadsX[1]-(280+truck.distance),78); // the longer truck nose stays behind the line
});

test('permitted travel decelerates to a standstill without crossing the red stop position', () => {
  let x=280,speed=92;
  for(let tick=0;tick<360;tick++){
    const stop=lights.upcomingStop({...base,x,y:372,angle:0,time:14});
    const step=Math.min(lights.permittedStep(stop,speed,1/60),stop?.distance??Infinity);
    x+=step;
    assert.ok(x<326, 'vehicle crossed the stop line while red');
  }
  assert.ok(x>325&&x<326, 'vehicle did not approach its stop line');
  const green=lights.upcomingStop({...base,x,y:372,angle:0,time:0});
  assert.equal(green,null);
  assert.ok(lights.permittedStep(green,speed,1/60)>0);
});
