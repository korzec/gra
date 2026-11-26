(() => {
  const dedicatedMode=window.__NOCNY_KURS_DEDICATED__===true;
  const canvas=document.querySelector('#city'),overlay=document.querySelector('#overlay'),wantedIndicator=document.querySelector('#wanted-indicator');let ctx=canvas.getContext('2d');
  const translate=(key, vars)=>window.NocnyKursLocale.t(key, vars);
  let currentStatus={key:'cityWait',vars:{}};
  function setGameStatus(key,vars={}){currentStatus={key,vars};document.querySelector('#status').textContent=translate(key,{...vars,reason:vars.reasonCode?' · '+translate(vars.reasonCode):''})}
  const colors=['#d6f36a','#ff806a','#72d9d0','#c99aff','#ffcb66','#74a9ff','#ff8fc2','#a4e887'];
  const keysets=[['w','a','s','d'],['arrowup','arrowleft','arrowdown','arrowright']];
  const controls=[{enter:'e',fire:' ',jump:'controlleft',weapon:'q'},{enter:'controlright',fire:'shiftright',jump:'end'}];
  const keyboardKey=e=>e.code==='ShiftRight'?'shiftright':e.code==='ShiftLeft'?'shiftleft':e.code==='ControlRight'?'controlright':e.code==='ControlLeft'?'controlleft':e.key.toLowerCase();
  const keyboardPlayerLimit=2,controllerFireButton=7;
  const world={w:2800,h:2200},roadsX=[92,388,762,1118,1520,1876,2296,2708],roadsY=[94,390,733,1030,1416,1786,2108],roadWidth=72,laneOffset=18;
  const crosswalks=[];for(let xi=0;xi<roadsX.length;xi++)for(let yi=0;yi<roadsY.length;yi++){if((xi*7+yi*11)%3!==1||(xi===3&&yi===2)||(xi===1&&yi===4))continue;crosswalks.push({x:roadsX[xi],y:roadsY[yi],vertical:(xi+yi)%2===0})}
  const held=new Set(),padALatch=new Set(),padXLatch=new Set(),touchStick={pointerId:null,x:0,y:0,intensity:0,element:null},touchState={fire:false,interact:false,forward:false,brake:false,jump:false,weapon:false};
  const touchAvailable=()=>Boolean(navigator.maxTouchPoints>0||matchMedia('(pointer:coarse)').matches);
  let players=[],buildings=[],alleys=[],courtyards=[],fences=[],plazas=[],cars=[],carRespawns=[],carDrivers=[],guards=[],parcels=[],cashPacks=[],bazookaDrops=[],pistolDrops=[],medkits=[],medkitFlashes=[],streetSigns=[],cashPickupFlashes=[],exitDustPuffs=[],deathRemains=[],muzzleFlashes=[],guardHitFlashes=[],carHitSparks=[],bullets=[],explosions=[],skidMarks=[],impactSparks=[],running=false,teamScore=0,bonusScore=0,winnerId=null,finalResults=[],nextCarId=0,cashConvoyClock=0,hospital=null,weaponShop=null,streetGlowSprite=null,streetLampDetailSprite=null;
  const MAX_SKID_MARKS=220,SKID_MARK_LIFETIME=2.25,MAX_IMPACT_SPARKS=96,IMPACT_SPARK_LIFETIME=.3,MAX_CASH_PICKUP_FLASHES=24,CASH_PICKUP_FLASH_LIFETIME=.28,MAX_MEDKIT_FLASHES=16,MEDKIT_FLASH_LIFETIME=.38,MEDKIT_COUNT=4,MEDKIT_RESPAWN_DELAY=12,MEDKIT_PICKUP_RADIUS=28,MAX_EXIT_DUST_PUFFS=16,EXIT_DUST_LIFETIME=.24,MAX_DEATH_REMAINS=64,DEATH_BODY_LIFETIME=10,DEATH_CHALK_LIFETIME=600,NPC_REMAIN_LIFETIME=60,MAX_MUZZLE_FLASHES=24,MUZZLE_FLASH_LIFETIME=.08,MAX_GUARD_HIT_FLASHES=24,GUARD_HIT_FLASH_LIFETIME=.12,MAX_CAR_HIT_SPARKS=24,CAR_HIT_SPARK_LIFETIME=.12,WANTED_MAX_LEVEL=3,WANTED_DECAY_SECONDS=3.2;
  const AMBULANCE_TYPE='ambulance',AMBULANCE_LIMIT=20,AMBULANCE_LOADING_TIME=2;
  let legacyAmbulances=[];
  const CASH_PACK_COUNT=5,CASH_PACK_VALUE=100,CAR_MAX_HEALTH=10,TRUCK_TYPE='volvo-truck';
  const CASH_CONVOY_INTERVAL=60,CASH_CONVOY_LIFETIME=115,CASH_CONVOY_VALUE=500,PLAYER_RUN_SPEED=77.5;
  // Two world units equal one metre in the distance HUD.
  const CAR_SELECT_RADIUS=20,CAR_BOARD_GAP=12,CAR_CHASE_MAX_DISTANCE=240;
  const WIN_SCORE=20;
  const PISTOL_PICKUP_AMMO=20,PISTOL_MAX_AMMO=100,MAX_PISTOL_DROPS=64,KNIFE_RANGE=32,KNIFE_COOLDOWN=.48,KNIFE_DAMAGE=1.5;
  const BAZOOKA_PRICE=500,BAZOOKA_ROCKETS=100,ROCKET_BLAST_RADIUS=88;
  const GUARD_MAX_HP=5,GUARD_CAR_HIT_COOLDOWN=.45;
  const CAR_SPEC={halfLength:22,halfWidth:13,acceleration:465,drag:.975,forwardSpeed:427.5,reverseSpeed:172.5,turnRate:1.5,impactDamage:.5,trafficSpeed:92};
  const VEHICLE_SPECS={
    car:CAR_SPEC,
    [AMBULANCE_TYPE]:{...CAR_SPEC,halfLength:28,halfWidth:14},
    [TRUCK_TYPE]:{halfLength:38,halfWidth:17,acceleration:260,drag:.965,forwardSpeed:260,reverseSpeed:105,turnRate:.85,impactDamage:1,trafficSpeed:68},
    tank:{halfLength:29,halfWidth:18,acceleration:210,drag:.96,forwardSpeed:175,reverseSpeed:75,turnRate:1.05,impactDamage:1.5,trafficSpeed:0}
  };
  function vehicleSpec(c){return VEHICLE_SPECS[c.type]||VEHICLE_SPECS.car}
  // Over half of this vehicle type's top speed, impacts are lethal at full health.
  function highSpeedImpact(c,speed){return Math.abs(speed)>vehicleSpec(c).forwardSpeed*.5}
  function vehicleImpactDamage(c,speed){return highSpeedImpact(c,speed)?1:vehicleSpec(c).impactDamage}
  // A crash damages the vehicle, but cannot destroy a healthy 10-HP car in one impact.
  // Cooldown prevents a wall contact lasting several simulation ticks from counting as multiple crashes.
  const CRASH_MIN_SPEED=110,CRASH_DAMAGE_COOLDOWN=.75;
  function damageCarFromCrash(c,speed,attacker=null){
    if(!running||c.destroyed||Math.abs(speed)<CRASH_MIN_SPEED||(c.crashCooldown||0)>0)return;
    c.crashCooldown=CRASH_DAMAGE_COOLDOWN;
    c.health=Math.max(0,c.health-(highSpeedImpact(c,speed)?3:1));
    if(c.health<=0)explodeCar(c,attacker);
  }
  function vehicleBlockedAt(c,x,y,angle){
    if(c.type!==TRUCK_TYPE&&c.type!=='tank'&&c.type!==AMBULANCE_TYPE)return blocked(x,y,16);
    const spec=vehicleSpec(c),cos=Math.cos(angle),sin=Math.sin(angle);
    if(blocked(x,y,spec.halfWidth,c.type==='tank'))return true;
    for(const forward of [-1,1])for(const side of [-1,1]){
      const xx=x+forward*cos*spec.halfLength-side*sin*spec.halfWidth;
      const yy=y+forward*sin*spec.halfLength+side*cos*spec.halfWidth;
      if(blocked(xx,yy,3,c.type==='tank'))return true;
    }
    return false;
  }
  function vehicleAtBoundary(c,x,y,angle){
    const spec=vehicleSpec(c),cos=Math.cos(angle),sin=Math.sin(angle);
    const extentX=Math.abs(cos)*spec.halfLength+Math.abs(sin)*spec.halfWidth;
    const extentY=Math.abs(sin)*spec.halfLength+Math.abs(cos)*spec.halfWidth;
    return x<=extentX||x>=world.w-extentX||y<=extentY||y>=world.h-extentY;
  }
  const DRIVER_CHASE_SPEED=132,DRIVER_RECLAIM_DISTANCE=31,DRIVER_RECLAIM_MAX_SPEED=32,DRIVER_MAX_HEALTH=3;
  const DRIVER_VEHICLE_PURSUIT_CHANCE=.5,DRIVER_PURSUIT_CAR_RANGE=800,DRIVER_PURSUIT_DISMOUNT_RANGE=95;
  const playerNames=window.NocnyKursPlayerNames;
  const PLAYER_NAME_STORAGE_KEY='nocny-kurs-player-name';
  const startNameInput=document.querySelector('#player-name-start');
  let localPlayerName='',localNamedPlayer=null;
  try { localPlayerName=playerNames.normalize(localStorage.getItem(PLAYER_NAME_STORAGE_KEY)); } catch {}
  startNameInput.value=localPlayerName;
  function ownedPlayer(){
    if(multiplayer.role==='guest')return players.find(p=>p.id===multiplayer.playerId)||null;
    if(localNamedPlayer&&players.includes(localNamedPlayer))return localNamedPlayer;
    return players.find(p=>p.id===1)||players.find(p=>p.source!=='remote')||null;
  }
  function setLocalName(value){
    const name=playerNames.normalize(value);
    if(localPlayerName!==name){
      localPlayerName=name;
      try { localStorage.setItem(PLAYER_NAME_STORAGE_KEY,name); } catch {}
    }
    if(startNameInput&&startNameInput!==document.activeElement&&startNameInput.value!==value)startNameInput.value=value;
    const p=ownedPlayer();
    if(p&&p.name!==name){p.name=name;renderPlayers()}
  }
  startNameInput.addEventListener('input',()=>setLocalName(startNameInput.value));
  startNameInput.addEventListener('focus',()=>held.clear());
  const playerList=document.querySelector('#player-list');
  playerList.addEventListener('focusin',event=>{
    if(event.target.id!=='player-name-live')return;
    held.clear();
    if(!localPlayerName)event.target.select();
  });
  playerList.addEventListener('input',event=>{
    if(event.target.id==='player-name-live')setLocalName(event.target.value);
  });
  playerList.addEventListener('keydown',event=>{
    if(event.target.id==='player-name-live'&&event.key==='Enter'){event.preventDefault();event.target.blur()}
  });
  playerList.addEventListener('focusout',event=>{
    if(event.target.id==='player-name-live')renderPlayers(true);
  });
  const GUARD_SIGHT_RANGE=370,GUARD_HEARING_RANGE=600,GUARD_FIRE_RANGE=325,GUARD_GUNFIRE_MEMORY=3,GUARD_WITNESSED_SHOT_SECONDS=5;
  let cam={x:1400,y:1100},zoom=1,last=performance.now(),delta=0,lastUi='',shotId=0,wantedLevel=0,wantedDecay=0;
  const w=()=>canvas.clientWidth,h=()=>canvas.clientHeight,rnd=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const reportPerformance=window.createGamePerformanceHud(document.querySelector('.night-frame'));
  const trafficRows=[1,2,4,5],trafficMinX=roadsX[0],trafficMaxX=roadsX[roadsX.length-1];
  const trafficLights=window.NocnyKursTrafficLights;
  let trafficLightTime=0;
  function upcomingTrafficStop(c,angle){
    return trafficLights.upcomingStop({
      x:c.x,y:c.y,angle,halfLength:vehicleSpec(c).halfLength,time:trafficLightTime,
      roadsX,roadsY,roadWidth,laneOffset
    });
  }
  function trafficLoop(y,east){return east?[[trafficMaxX,y-laneOffset],[trafficMaxX,y+laneOffset],[trafficMinX,y+laneOffset],[trafficMinX,y-laneOffset]]:[[trafficMinX,y+laneOffset],[trafficMinX,y-laneOffset],[trafficMaxX,y-laneOffset],[trafficMaxX,y+laneOffset]]}
  function verticalTrafficLoop(x,south){const north=roadsY[0],southEdge=roadsY[roadsY.length-1];return south?[[x+laneOffset,southEdge],[x-laneOffset,southEdge],[x-laneOffset,north],[x+laneOffset,north]]:[[x-laneOffset,north],[x+laneOffset,north],[x+laneOffset,southEdge],[x-laneOffset,southEdge]]}

  function resize(){const r=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.max(1,Math.round(r.width*dpr));canvas.height=Math.max(1,Math.round(r.height*dpr));ctx.setTransform(dpr,0,0,dpr,0,0)}
  new ResizeObserver(resize).observe(canvas);resize();
  function makeCity(){
    buildings=[];alleys=[];courtyards=[];fences=[];plazas=[];weaponShop=null;
    let seed=32452843;const roll=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296},between=(a,b)=>a+(b-a)*roll();
    const roofs=['#65403a','#70483d','#4c5351','#674b3e','#495356','#765044','#58564a'];
    const addHouse=(x,y,w,h,front)=>buildings.push({x,y,w,h,front,roof:roofs[Math.floor(roll()*roofs.length)],tone:Math.floor(roll()*4),kind:roll()<.19?'shop':'house',chimney:roll()<.44,awning:roll()<.22});
    const row=(start,end,axis,edge,front,edgeCoord,min=43,max=69,depthMin=47,depthMax=73)=>{
      let cursor=start,guard=0;
      while(cursor+min<end&&guard++<12){
        const span=Math.min(between(min,max),end-cursor),depth=between(depthMin,depthMax),offset=between(-3,3);
        if(axis==='x'){const y=edge==='top'?edgeCoord+offset:edgeCoord-depth+offset;addHouse(cursor,y,span,depth,front)}
        else{const x=edge==='left'?edgeCoord+offset:edgeCoord-depth+offset;addHouse(x,cursor,depth,span,front)}
        cursor+=span+between(5,12);
      }
    };
    for(let yi=0;yi<roadsY.length-1;yi++)for(let xi=0;xi<roadsX.length-1;xi++){
      const left=roadsX[xi]+roadWidth/2+9,right=roadsX[xi+1]-roadWidth/2-9,top=roadsY[yi]+roadWidth/2+9,bottom=roadsY[yi+1]-roadWidth/2-9;
      const width=right-left,height=bottom-top;if(width<150||height<150)continue;
      const market=xi===3&&yi===2,smallSquare=!market&&((xi*7+yi*11)%13===2),hospitalBlock=xi===1&&yi===4,centerX=(left+right)/2,centerY=(top+bottom)/2;
      if(hospitalBlock){
        const width=112,height=82;
        hospital={x:centerX-width/2,y:centerY-height/2,w:width,h:height,exitX:centerX+68,exitY:centerY+94,yard:{x:centerX-106,y:centerY-90,w:212,h:180}};
        buildings.push({...hospital,x:hospital.x,y:hospital.y,w:hospital.w,h:hospital.h,front:'south',roof:'#56666a',tone:2,kind:'hospital',chimney:false,awning:false});
        continue;
      }
      const hasSideRows=!smallSquare&&(xi*3+yi*5)%3!==1;
      if(market){row(left+10,right-10,'x','top','north',top+8,46,68,28,34);row(left+10,right-10,'x','bottom','south',bottom-8,46,68,28,34)}
      else if(smallSquare){row(left+12,right-12,'x','top','north',top+8,43,69,28,38);row(left+12,right-12,'x','bottom','south',bottom-8,43,69,28,38)}
      else{
        row(left+12,right-12,'x','top','north',top+8);row(left+12,right-12,'x','bottom','south',bottom-8);
        if(hasSideRows){row(top+88,bottom-88,'y','left','west',left+8,42,63,48,68);row(top+88,bottom-88,'y','right','east',right-8,42,63,48,68)}
      }
      if(market){const w=Math.min(196,width-66),h=Math.min(128,height-96);plazas.push({x:centerX-w/2,y:centerY-h/2,w,h,kind:'market',name:'RYNEK'});continue}
      if(smallSquare){const w=between(86,108),h=between(66,80);plazas.push({x:centerX-w/2,y:centerY-h/2,w,h,kind:'square'});continue}
      const courtW=Math.min(between(90,138),width*.4),courtH=Math.min(between(72,112),height*.38),court={x:centerX-courtW/2,y:centerY-courtH/2,w:courtW,h:courtH,kind:roll()<.38?'garden':'cobble'};courtyards.push(court);fences.push(...gardenFences(court));
      if((xi+yi)%2===0){
        const horizontal=roll()<.54;
        const points=horizontal&&!hasSideRows?[[left+8,centerY-between(12,26)],[centerX-27,centerY+between(5,26)],[centerX+34,centerY-between(8,24)],[right-8,centerY+between(6,22)]]:horizontal?[[left+84,centerY-between(12,26)],[centerX-27,centerY+between(5,26)],[centerX+34,centerY-between(8,24)],[right-84,centerY+between(6,22)]]:[[centerX-between(16,29),top+96],[centerX+between(8,25),centerY-24],[centerX-between(12,27),centerY+26],[centerX+between(7,25),bottom-96]];
        const xs=points.map(point=>point[0]),ys=points.map(point=>point[1]);
        alleys.push({points,width:between(25,33),minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys)});
      }
    }
    // Pick one deterministic, accessible existing storefront for every client and server.
    const entrances=buildings.filter(b=>b.kind==='shop').map(b=>{
      const cx=b.x+b.w/2,cy=b.y+b.h/2;
      const x=b.front==='west'?b.x-18:b.front==='east'?b.x+b.w+18:cx;
      const y=b.front==='north'?b.y-18:b.front==='south'?b.y+b.h+18:cy;
      return {b,x,y,distance:Math.hypot(x-roadsX[3],y-roadsY[3])};
    }).filter(shop=>!blocked(shop.x,shop.y,9));
    entrances.sort((a,b)=>a.distance-b.distance);
    if(entrances.length){
      const {b,x,y}=entrances[0];
      b.weaponShop=true;
      weaponShop={b,x,y};
    }
  }
  function makeStreetSigns(){streetSigns=[];const names=['streetNight','streetMarket','streetPark','streetOld'];for(let i=0;i<crosswalks.length;i+=2){const crossing=crosswalks[i],sideX=i%4<2?1:-1,sideY=i%3===0?1:-1,x=crossing.x+sideX*(roadWidth/2+14),y=crossing.y+sideY*(roadWidth/2+14);if(x<38||x>world.w-38||y<38||y>world.h-38||blocked(x,y,4))continue;if(hospital&&Math.hypot(x-hospital.exitX,y-hospital.exitY)<180)continue;streetSigns.push({x,y,nameKey:names[streetSigns.length%names.length]})}}
  function tankSpawn(){
    for(const yard of courtyards.filter(c=>c.kind==='garden').sort((a,b)=>b.w*b.h-a.w*a.h)){
      const x=yard.x+yard.w/2,y=yard.y+yard.h/2,angle=0,c={type:'tank',x,y,angle};
      if(!vehicleBlockedAt(c,x,y,angle)&&!vehicleAtBoundary(c,x,y,angle)&&!cars.some(other=>!other.destroyed&&carOverlapsAt(c,x,y,angle,other))&&!blockedByPlayer(x,y,30))
        return {type:'tank',x,y,angle,speed:0,brakeLight:0,skidMarkTimer:0,driver:null,color:'#718052',health:20,destroyed:false,traffic:false,npcInside:false};
    }
    return null;
  }
  function makeCars(){
    carDrivers=[];
    const palette=['#b84e42','#4f7791','#c29a50','#638261','#7b6797','#cf7048'];
    const parkingRow=roadsY[3];
    // The central street stays parked; every one of its blocks has a car.
    const parkedSpots=roadsX.slice(0,-1).map((x,i)=>[(x+roadsX[i+1])/2,parkingRow+(i%2?1:-1)*(roadWidth/2-14),0]);
    parkedSpots.push([roadsX[3]+85,parkingRow+roadWidth/2-14,0]);
    let id=0;
    cars=parkedSpots.map(([x,y,angle],i)=>({id:id++,type:i===2||i===6?TRUCK_TYPE:'car',x,y,angle,speed:0,brakeLight:0,skidMarkTimer:0,driver:null,color:palette[id%palette.length],health:CAR_MAX_HEALTH,destroyed:false,traffic:false,npcInside:true}));
    const addTrafficCar=(x,y,angle,trafficRoute,type='car',trafficVertical=false)=>{
      const trafficSpeed=vehicleSpec({type}).trafficSpeed;
      cars.push({id:id++,type,x,y,angle,speed:trafficSpeed,brakeLight:0,skidMarkTimer:0,turnSignal:null,driver:null,color:palette[id%palette.length],health:CAR_MAX_HEALTH,destroyed:false,traffic:true,trafficRoute,trafficIndex:0,trafficSpeed,trafficWait:0,trafficVertical,npcInside:true});
    };
    // One car per block between adjoining junctions, on both road axes.
    for(let yi=0;yi<roadsY.length;yi++){
      if(yi===3)continue; // Covered by parked cars, without blocking the moving lane.
      const y=roadsY[yi],east=yi%2===0;
      for(let xi=0;xi<roadsX.length-1;xi++){
        const x=(roadsX[xi]+roadsX[xi+1])/2;
        const type=xi===2&&(yi===2||yi===5)?TRUCK_TYPE:'car';
        addTrafficCar(x,y+(east?-laneOffset:laneOffset),east?0:Math.PI,trafficLoop(y,east),type);
      }
    }
    for(let xi=0;xi<roadsX.length;xi++){
      const x=roadsX[xi],south=xi%2===0;
      for(let yi=0;yi<roadsY.length-1;yi++){
        const y=(roadsY[yi]+roadsY[yi+1])/2;
        addTrafficCar(x+(south?laneOffset:-laneOffset),y,south?Math.PI/2:-Math.PI/2,verticalTrafficLoop(x,south),'car',true);
      }
    }
    const tank=tankSpawn();if(tank)cars.push({id:id++,...tank});
    nextCarId=id;
  }  function restoreStaticWorld(){
    // The server sends dynamic state only. Keep a complete local city in every
    // browser, including after joining or reconnecting to a dedicated room.
    makeCity();
    makeStreetSigns();
    if(!dedicatedMode){
      try{cacheStaticSprites()}
      catch(error){console.warn('Nocny Kurs: using uncached city rendering',error)}
    }
  }
  restoreStaticWorld();makeCars();
  function addParcel(){if(parcels.length>=13)return;const vertical=Math.random()<.5,x=vertical?roadsX[Math.floor(Math.random()*roadsX.length)]+rnd(-32,32):rnd(90,world.w-90),y=vertical?rnd(90,world.h-90):roadsY[Math.floor(Math.random()*roadsY.length)]+rnd(-32,32);parcels.push({x,y,phase:rnd(0,6.28)})}
  function addCashPacks(){cashPacks=[];for(let i=0;i<CASH_PACK_COUNT;i++){let spot=null;for(let attempt=0;attempt<160&&!spot;attempt++){const vertical=Math.random()<.5,x=vertical?roadsX[Math.floor(Math.random()*roadsX.length)]+rnd(-26,26):rnd(100,world.w-100),y=vertical?rnd(100,world.h-100):roadsY[Math.floor(Math.random()*roadsY.length)]+rnd(-26,26);if(blocked(x,y,12)||blockedByCar(x,y,26)||parcels.some(p=>Math.hypot(p.x-x,p.y-y)<125)||cashPacks.some(c=>Math.hypot(c.x-x,c.y-y)<190))continue;spot={x,y,phase:rnd(0,6.28),value:CASH_PACK_VALUE}}if(spot)cashPacks.push(spot)}}
  function addMedkits(){
    medkits=[];medkitFlashes=[];
    for(let i=0;i<MEDKIT_COUNT;i++){
      let spot=null;
      for(let attempt=0;attempt<180&&!spot;attempt++){
        const vertical=Math.random()<.5,x=vertical?roadsX[1+Math.floor(Math.random()*(roadsX.length-2))]+rnd(-18,18):rnd(180,world.w-180),y=vertical?rnd(180,world.h-180):roadsY[1+Math.floor(Math.random()*(roadsY.length-2))]+rnd(-18,18);
        if(blocked(x,y,12)||blockedByCar(x,y,24)||hospital&&Math.hypot(x-hospital.exitX,y-hospital.exitY)<155||players.some(p=>p.alive!==false&&Math.hypot(pos(p).x-x,pos(p).y-y)<100)||parcels.some(p=>Math.hypot(p.x-x,p.y-y)<85)||cashPacks.some(p=>Math.hypot(p.x-x,p.y-y)<80)||medkits.some(p=>Math.hypot(p.x-x,p.y-y)<240))continue;
        spot={x,y,phase:rnd(0,6.28),active:true,respawn:0};
      }
      if(spot)medkits.push(spot);
    }
  }
  function pos(p){return p.car?{x:p.car.x,y:p.car.y}:p}
  function keyLabel(key){return({arrowup:'↑',arrowleft:'←',arrowdown:'↓',arrowright:'→',controlleft:'L CTRL',controlright:'R CTRL',shiftright:'R SHIFT',enter:'ENTER',' ':translate('space')})[key]||key.toUpperCase()}
  function playerButtons(p){
    const tags=[];
    if(multiplayer.role==='guest'&&p.id===multiplayer.playerId)return ['controlsMove','controlsShoot','controlsAct','controlsJump','controlsPadTouch'].map(key=>'<kbd>'+translate(key)+'</kbd>').join('');
    if(p.source==='remote')return '<kbd>ONLINE</kbd>';
    if(p.source==='key'){
      keysets[p.sourceId].forEach(k=>tags.push(keyLabel(k)));
      tags.push(keyLabel(controls[p.sourceId].fire),keyLabel(controls[p.sourceId].enter),keyLabel(controls[p.sourceId].jump),'ENTER');
    }else if(p.source==='pad'){
      tags.push(translate('leftStick'),translate('dpad'),translate('padA'));
      if(p.padSourceGame==='night')tags.push(translate('padB'),translate('padX'),translate('padY'),translate('padRT'));
    }
    if(p.id===1&&touchAvailable())tags.push(translate('touchStick'),...(p.padSourceGame==='night'?[translate('fire').toUpperCase(),translate('action').toUpperCase()]:[]));
    return [...new Set(tags)].map(tag=>`<kbd>${tag}</kbd>`).join('');
  }
  function validatePlayerBindings(){
    const ids=new Set(),bindings=new Map(),keyboardOwners=new Map(),padOwners=new Map();
    if(players.length>8)throw new Error('More than eight active players');
    for(const p of players){
      if(!Number.isInteger(p.id)||p.id<1||p.id>8||ids.has(p.id))throw new Error('Duplicate or unstable player id');
      ids.add(p.id);
      if(p.source==='key'){
        if(!Number.isInteger(p.sourceId)||p.sourceId<0||p.sourceId>=keysets.length||keyboardOwners.has(p.sourceId))throw new Error('Keyboard set has more than one player owner');
        keyboardOwners.set(p.sourceId,p.id);
      }else if(p.source==='pad'){
        if(!Number.isInteger(p.sourceId)||p.sourceId<0||p.sourceId>=8||p.id!==p.sourceId+1||padOwners.has(p.sourceId))throw new Error('Gamepad index must have one stable player owner');
        padOwners.set(p.sourceId,p.id);
      }else if(p.source==='touch'){
        if(p.id!==1||p.sourceId!==0)throw new Error('Touch is an additional P1 input');
      }else if(p.source==='remote'){
        if(p.sourceId!==p.id)throw new Error('Remote player source must match player id');
      }else throw new Error('Unknown player control source');
      const binding=`${p.source}:${p.sourceId}`;
      if(bindings.has(binding))throw new Error('Control binding has more than one player owner');
      bindings.set(binding,p.id);
    }
  }
  function healthPipState(health,index){return health>=index+1?'is-full':health>index?'is-half':''}
  function rankedPlayers(){
    return players.slice().sort((a,b)=>(b.score||0)-(a.score||0)||a.id-b.id);
  }
  function setScoreboardExpanded(board,toggle,expanded){
    toggle.setAttribute('aria-expanded',String(expanded));
    board.classList.toggle('is-collapsed',!expanded);
    board.querySelector('#gt-scoreboard-details').hidden=!expanded;
  }
  function renderPlayers(force=false){
    validatePlayerBindings();
    document.querySelector('#player-count').textContent=players.length;
    if(dedicatedMode)return;
    const board=document.querySelector('#gt-scoreboard'),toggle=document.querySelector('#gt-scoreboard-toggle');
    if(!board||!toggle)return;
    const finished=!running&&winnerId!==null;
    board.hidden=!running&&!finished;
    if(board.hidden)return;
    const anchor=document.querySelector(finished?'#overlay-copy':'.night-game-column');
    if(board.previousElementSibling!==anchor){
      anchor.after(board);
      setScoreboardExpanded(board,toggle,true);
    }
    const ranked=finished&&finalResults.length?finalResults:rankedPlayers();
    const expanded=toggle.getAttribute('aria-expanded')==='true';
    const key=finished+'|'+expanded+'|'+ranked.map(p=>[p.id,p.source,p.sourceId,p.score,p.cash||0,p.hits,p.health,p.alive,p.car?1:0,p.name||''].join(',')).join('|');
    if(!force&&key===lastUi)return;
    const esc=playerNames.escapeHtml,leader=finished?winnerId:ranked[0]?.id;
    const colorsEl=document.querySelector('#gt-scoreboard-colors');
    colorsEl.replaceChildren(...ranked.map(p=>{
      const item=document.createElement('span');item.className='score-color-row';item.dataset.playerId=String(p.id);
      const marker=document.createElement('span');marker.className='score-marker';
      marker.textContent=p.alive===false?'✕':p.id===leader?'♛':'';if(p.alive===false){marker.classList.add('score-out','player-wasted');marker.setAttribute('aria-label',translate('wasted'))}
      const color=document.createElement('span');color.className='score-color';color.style.backgroundColor=p.color;color.title=playerNames.label(p);
      item.append(marker,color);return item;
    }));
    toggle.setAttribute('aria-label',translate(expanded?'scoreboardCollapse':'scoreboardExpand')+(expanded?'':': '+ranked.map(playerNames.label).join(', ')));
    const el=document.querySelector('#player-list'),editing=!finished&&!force&&document.activeElement?.id==='player-name-live';
    // While the name is being edited, retain the input node and update live cells.
    if(editing){
      for(const row of el.querySelectorAll('.player-entry')){
        const p=ranked.find(p=>p.id===Number(row.dataset.playerId));if(!p)continue;
        row.querySelector('.score-place').textContent=String(ranked.indexOf(p)+1);
        row.querySelector('.score-value').textContent=String(p.score||0);
        const cash=row.querySelector('.score-cash');if(cash)cash.textContent='$'+(p.cash||0);
        row.classList.toggle('is-wasted',p.alive===false);
        const health=row.querySelector('.player-health');health.setAttribute('aria-label',translate('healthLabel',{id:p.id,health:p.health??3,max:p.maxHealth||3}));
        health.querySelectorAll('.health-pip').forEach((pip,n)=>{const state=healthPipState(p.health??3,n);pip.classList.toggle('is-full',state==='is-full');pip.classList.toggle('is-half',state==='is-half')});
      }
      lastUi='';return;
    }
    lastUi=key;
    const editable=!finished&&ranked.length?ownedPlayer():null;
    el.innerHTML=ranked.map((p,i)=>{
      const health=Array.from({length:p.maxHealth||3},(_,n)=>'<i class="health-pip '+healthPipState(p.health??3,n)+'"></i>').join('');
      const label=playerNames.escapeHtml(playerNames.label(p));
      const name=p===editable?'<input class="player-name player-name-input score-name-input" id="player-name-live" type="text" maxlength="18" autocomplete="nickname" spellcheck="false" value="'+label+'" aria-label="'+esc(translate('nameLiveAria'))+'">':'<b class="player-name">'+label+'</b>';
      const mark=p.alive===false?'✕':p.id===leader?'♛':'';
      const healthIndicator=finished?'':'<span class="player-health" role="img" aria-label="'+esc(translate('healthLabel',{id:p.id,health:p.health??3,max:p.maxHealth||3}))+'">'+health+'</span>';
      return '<tr class="player-entry'+(p.alive===false?' is-wasted':'')+'" data-player-id="'+p.id+'"><td style="border-left:4px solid '+esc(p.color)+'"><span class="score-place">'+(i+1)+'</span><span class="score-marker'+(p.alive===false?' score-out player-wasted':'')+'">'+mark+'</span></td><td>'+name+healthIndicator+(Number.isFinite(p.cash)?'<small class="score-cash">$'+p.cash+'</small>':'')+'</td><td class="score-value">'+(p.score||0)+'</td></tr>';
    }).join('');
  }

  function keyboardPlayerCount(){return players.filter(p=>p.source==='key').length}
  function connectedPadSlots(){const slots=new Set(players.filter(p=>p.source==='pad').map(p=>p.sourceId+1));if(navigator.getGamepads)for(let i=0;i<navigator.getGamepads().length&&i<8;i++){const pad=navigator.getGamepads()[i];if(pad&&pad.connected!==false)slots.add(i+1)}return slots}
  function freeSlot(reserved=new Set(),except=null,preferred=null){const occupied=id=>players.some(p=>p!==except&&p.id===id);if(preferred&&!reserved.has(preferred)&&!occupied(preferred))return preferred;for(let id=1;id<=8;id++)if(!reserved.has(id)&&!occupied(id))return id;return null}
  function setPlayerId(p,id){const old=p.id;if(old===id)return;p.id=id;p.color=colors[(id-1)%colors.length];for(const b of bullets)if(b.owner===old)b.owner=id;lastUi='';}
  function moveKeyboardPlayers(reserved){const movers=players.filter(p=>p.source==='key'&&reserved.has(p.id)).sort((a,b)=>a.sourceId-b.sourceId),occupied=new Set(players.filter(p=>!movers.includes(p)).map(p=>p.id)),moves=[];for(const p of movers){let next=null;for(let id=1;id<=8;id++)if(!reserved.has(id)&&!occupied.has(id)){next=id;break}if(!next)return false;occupied.add(next);moves.push([p,next])}for(const[p,id]of moves)setPlayerId(p,id);return true}
  function createPlayer(source,sourceId,id){if(players.length>=8)return null;const base=players.length?pos(players[0]):{x:roadsX[3],y:roadsY[3]},spread=players.length?75:0;let spawn={x:base.x,y:base.y};for(let i=0;i<24&&spread;i++){const angle=rnd(0,Math.PI*2),distance=Math.sqrt(Math.random())*spread,candidate={x:clamp(base.x+Math.cos(angle)*distance,30,world.w-30),y:clamp(base.y+Math.sin(angle)*distance,30,world.h-30)};if(!blocked(candidate.x,candidate.y,10)&&!blockedByCar(candidate.x,candidate.y,10)&&!blockedByPlayer(candidate.x,candidate.y,10)){spawn=candidate;break}}const p={id,source,sourceId,name:source!=='remote'&&!localNamedPlayer?localPlayerName:'',x:spawn.x,y:spawn.y,score:0,cash:0,deliveries:0,convoys:0,kills:0,collectedBodies:0,hits:0,color:colors[(id-1)%colors.length],stun:0,moveTime:0,padX:0,padY:0,invuln:0,damageCooldown:0,maxHealth:3,health:3,alive:true,deathTimer:0,wastedTimer:0,fireCooldown:0,pistolAmmo:0,knifeSwing:0,bazookaAmmo:0,recentGunfire:0,fireHeld:false,padFireHeld:false,padTriggerHeld:false,facing:0,bodyFacing:0,walk:0,car:null,enterTargetId:null,gear:'F',vape:true,padSourceGame:'night'};players.push(p);if(source!=='remote'&&!localNamedPlayer)localNamedPlayer=p;lastUi='';renderPlayers();if(!running){cam.x=p.x;cam.y=p.y}return p}
  function joinKeyboard(sourceId){
    const prior=players.find(p=>p.source==='key'&&p.sourceId===sourceId);if(prior)return prior;if(sourceId<0||sourceId>=keyboardPlayerLimit||keyboardPlayerCount()>=keyboardPlayerLimit)return null;
    const touched=players.find(p=>p.id===1&&p.source==='touch'&&sourceId===0);if(touched){touched.source='key';touched.sourceId=0;lastUi='';renderPlayers();return touched}
    if(players.length>=8)return null;const reserved=connectedPadSlots(),id=freeSlot(reserved,null,sourceId+1);if(!id)return null;return createPlayer('key',sourceId,id)
  }
  function ensureTouchP1(){if(multiplayer.role==='guest')return players.find(p=>p.id===multiplayer.playerId)||null;let p=players.find(p=>p.id===1);if(p)return p;if(players.length>=8)return null;return createPlayer('touch',0,1)}
  function joinPad(index){
    if(index<0||index>=8)return null;const prior=players.find(p=>p.source==='pad'&&p.sourceId===index);if(prior)return prior;const target=index+1,occupant=players.find(p=>p.id===target);
    if(occupant&&occupant.source==='touch'&&target===1){occupant.source='pad';occupant.sourceId=index;occupant.padFireHeld=false;occupant.padTriggerHeld=false;lastUi='';renderPlayers();return occupant}
    if(players.length>=8)return null;const reserved=connectedPadSlots();reserved.add(target);if(occupant&&occupant.source==='key'&&!moveKeyboardPlayers(reserved))return null;if(players.some(p=>p.id===target))return null;return createPlayer('pad',index,target)
  }
  function touchAxes(){return{x:touchStick.x,y:touchStick.y}}
  function resetTouchStick(){touchStick.pointerId=null;touchStick.x=touchStick.y=touchStick.intensity=0;if(touchStick.element){touchStick.element.classList.remove('is-active');touchStick.element.style.setProperty('--stick-x','0px');touchStick.element.style.setProperty('--stick-y','0px')}}
  function updateTouchStick(event){if(!touchStick.element)return;const rect=touchStick.element.getBoundingClientRect(),maxTravel=Math.max(1,Math.min(rect.width,rect.height)*.34),dx=event.clientX-(rect.left+rect.width/2),dy=event.clientY-(rect.top+rect.height/2),distance=Math.hypot(dx,dy),limited=Math.min(distance,maxTravel),raw=limited/maxTravel,deadzone=.12;touchStick.intensity=raw<=deadzone?0:(raw-deadzone)/(1-deadzone);touchStick.x=distance?dx/distance*touchStick.intensity:0;touchStick.y=distance?dy/distance*touchStick.intensity:0;const knobX=distance?dx/distance*limited:0,knobY=distance?dy/distance*limited:0;touchStick.element.style.setProperty('--stick-x',`${knobX}px`);touchStick.element.style.setProperty('--stick-y',`${knobY}px`);touchStick.element.classList.toggle('is-active',touchStick.intensity>0)}
  function updateTouchDriveButtons(){
    const player=players.find(p=>p.id===(multiplayer.role==='guest'?multiplayer.playerId:1));
    const alive=Boolean(running&&player&&player.alive!==false),inCar=Boolean(player?.car);
    for(const action of ['forward','brake','jump','weapon']){
      const button=document.querySelector(`[data-touch-action="${action}"]`);
      const onFoot=action==='jump'||action==='weapon';
      const visible=onFoot?!inCar:inCar;
      const enabled=alive&&visible;
      if(!enabled)touchState[action]=false;
      if(!button)continue;
      button.hidden=!visible;
      button.disabled=!enabled;
      if(!enabled)button.classList.remove('is-pressed');
      button.title=translate(action==='weapon'?'switchWeapon':action==='jump'?'jump':action==='forward'?'driveForward':'driveBrake');
    }
  }
  function bindTouchControls(){
    const root=document.querySelector('#touch-controls'),stick=root?.querySelector('[data-touch-joystick]');
    if(!root||!stick)return;
    touchStick.element=stick;
    stick.addEventListener('pointerdown',event=>{
      if(touchStick.pointerId!==null)return;
      event.preventDefault();
      if(!ensureTouchP1())return;
      touchStick.pointerId=event.pointerId;
      stick.setPointerCapture(event.pointerId);
      updateTouchStick(event);
    });
    stick.addEventListener('pointermove',event=>{if(event.pointerId===touchStick.pointerId){event.preventDefault();updateTouchStick(event)}});
    const releaseStick=event=>{if(event.pointerId!==touchStick.pointerId)return;event.preventDefault();resetTouchStick()};
    stick.addEventListener('pointerup',releaseStick);
    stick.addEventListener('pointercancel',releaseStick);
    stick.addEventListener('lostpointercapture',releaseStick);
    root.querySelectorAll('[data-touch-action]').forEach(button=>{
      const action=button.dataset.touchAction;
      button.addEventListener('pointerdown',e=>{
        e.preventDefault();
        const p=ensureTouchP1();
        if(!p||button.disabled||button.hidden)return;
        button.setPointerCapture(e.pointerId);
        button.classList.add('is-pressed');
        if(action==='fire')touchState.fire=true;
        else if(action==='weapon'&&running&&!p.car&&p.alive!==false){
          if(!touchState.weapon){if(multiplayer.role==='guest')guestWeaponSwitch++;else cycleWeapon(p);}
          touchState.weapon=true;
        }
        else if(action==='jump'&&running&&!p.car&&p.alive!==false)touchState.jump=true;
        else if((action==='forward'||action==='brake')&&running&&p.car)touchState[action]=true;
        else if(action==='interact'&&running){
          touchState.interact=true;
          if(multiplayer.role==='guest')multiplayer.sendAction();else enterOrExit(p);
        }
      });
      const release=e=>{
        e.preventDefault();button.classList.remove('is-pressed');
        if(action==='fire')touchState.fire=false;
        if(action==='jump')touchState.jump=false;
        if(action==='weapon')touchState.weapon=false;
        if(action==='interact')touchState.interact=false;
        if(action==='forward'||action==='brake')touchState[action]=false;
      };
      button.addEventListener('pointerup',release);
      button.addEventListener('pointercancel',release);
      button.addEventListener('lostpointercapture',release);
    });
  }
  function start(){if(multiplayer.role==='guest'||running)return;if(!players.length){if(touchAvailable())ensureTouchP1();else joinKeyboard(0)}players.forEach(p=>{p.score=0;p.cash=0;p.deliveries=0;p.convoys=0;p.kills=0;p.collectedBodies=0;p.hits=0;p.jumpTime=0;p.jumpHeld=false;p.jumpSafeX=p.jumpSafeY=null;p.stun=0;p.invuln=0;p.damageCooldown=0;p.maxHealth=3;p.health=3;p.alive=true;p.deathTimer=0;p.wastedTimer=0;p.fireCooldown=0;p.recentGunfire=0;p.fireHeld=false;p.padFireHeld=false;p.padTriggerHeld=false;p.moveTime=0;p.padX=p.padY=0;p.bodyFacing=Number.isFinite(p.facing)?p.facing:0;p.car=null;p.enterTargetId=null;p.gear='F';p.weapon=null;p.bazookaAmmo=0;p.pistolAmmo=0;p.knifeSwing=0});
    touchState.forward=touchState.brake=touchState.weapon=false;running=true;teamScore=0;bonusScore=0;winnerId=null;finalResults=[];wantedLevel=0;wantedDecay=0;refreshWantedHud();bullets=[];guardHitFlashes=[];carHitSparks=[];parcels=[];cashPacks=[];bazookaDrops=[];pistolDrops=[];medkits=[];medkitFlashes=[];cashPickupFlashes=[];exitDustPuffs=[];explosions=[];skidMarks=[];deathRemains=[];impactSparks=[];carRespawns=[];trafficLightTime=0;cashConvoyClock=0;makeCars();zoom=1;groupCameraReady=false;const guardSpots=[[roadsX[0],roadsY[1]],[roadsX[2],roadsY[3]],[roadsX[4],roadsY[4]],[roadsX[6],roadsY[2]],[roadsX[1],roadsY[5]],[roadsX[5],roadsY[3]],[roadsX[3],roadsY[0]],[roadsX[7],roadsY[4]],[roadsX[0],roadsY[6]],[roadsX[4],roadsY[1]],[roadsX[6],roadsY[5]],[roadsX[2],roadsY[6]]];guards=guardSpots.map(([x,y],i)=>({id:100+i,x,y,color:['#f18161','#e8a14e','#db7258','#e5bf64'][i%4],facing:0,walk:0,stun:0,hp:GUARD_MAX_HP,invuln:0,fireCooldown:(i%5)*.2}));const q=pos(players[0]);cam.x=q.x;cam.y=q.y;for(let i=0;i<11;i++)addParcel();addCashPacks();addMedkits();
    refreshCompetitionHud();setGameStatus('enRoute');document.querySelector('#round-label').textContent=translate('round');document.querySelector('#zoom-indicator').textContent=translate('camera')+' 100%';lastUi='';renderPlayers();overlay.classList.add('hidden');refreshAmmoHud();multiplayer.setGameRunning(true)
  }
  function scoreStandings(){
    return players.map(p=>({id:p.id,name:playerNames.normalize(p.name),color:p.color,score:p.score||0,deliveries:p.deliveries||0,convoys:p.convoys||0,kills:p.kills||0,collectedBodies:p.collectedBodies||0}))
      .sort((a,b)=>b.score-a.score||Number(b.id===winnerId)-Number(a.id===winnerId)||a.id-b.id);
  }
  function awardScore(p,amount,category){
    if(!running||winnerId!==null||!players.includes(p))return false;
    p.score=(p.score||0)+amount;p[category]=(p[category]||0)+1;
    teamScore=Math.max(teamScore,p.score);
    if(p.score>=WIN_SCORE)winnerId=p.id;
    refreshCompetitionHud();lastUi='';renderPlayers();return true;
  }
  function refreshCompetitionHud(){
    const own=multiplayer.role==='guest'?players.find(p=>p.id===multiplayer.playerId):players[0];
    document.querySelector('#cash-score').textContent=String(own?.cash||0);
  }
  function showFinishText(){
    document.querySelector('#overlay-title').textContent=translate('roundDone');
    const rows=finalResults.length?finalResults:scoreStandings(),winner=rows.find(p=>p.id===winnerId);
    document.querySelector('#overlay-copy').textContent=translate('winner',{name:winner?.name||'P'+winnerId});
    renderPlayers();
  }
  function finish(){if(winnerId===null)return;running=false;finalResults=scoreStandings();document.querySelector('#round-label').textContent=translate('roundDone');setGameStatus('deliveryDone');showFinishText();overlay.classList.remove('hidden');multiplayer.setGameRunning(false)}
  function refreshWantedHud(){wantedIndicator.hidden=wantedLevel===0;wantedIndicator.textContent=`${translate('alarm')} ${'★'.repeat(wantedLevel)}${'☆'.repeat(WANTED_MAX_LEVEL-wantedLevel)}`;wantedIndicator.setAttribute('aria-label',translate('alarmLevel',{level:wantedLevel,max:WANTED_MAX_LEVEL}))}
  function raiseWantedLevel(){wantedLevel=Math.min(WANTED_MAX_LEVEL,wantedLevel+1);wantedDecay=0;refreshWantedHud()}
  function updateWantedLevel(dt){if(wantedLevel===0)return;wantedDecay+=dt;if(wantedDecay<WANTED_DECAY_SECONDS)return;wantedLevel--;wantedDecay=0;refreshWantedHud()}
  // Low garden fences, with a 30-unit opening centered on the south side.
  function gardenFences(c){
    if(c.kind!=='garden')return [];
    const x=c.x+2,y=c.y+2,w=c.w-4,h=c.h-4,gap=30,side=(w-gap)/2;
    return [{x,y,w,h:4},{x,y,w:4,h},{x:x+w-4,y,w:4,h},
      {x,y:y+h-4,w:side,h:4},{x:x+side+gap,y:y+h-4,w:side,h:4}];
  }
  function blocked(x,y,r=10,ignoreFences=false){
    for(const b of buildings)if(x+r>b.x&&x-r<b.x+b.w&&y+r>b.y&&y-r<b.y+b.h)return true;
    if(!ignoreFences)for(const f of fences)if(x+r>f.x&&x-r<f.x+f.w&&y+r>f.y&&y-r<f.y+f.h)return true;
    return false;
  }
  // Segment/rectangle intersection: guards cannot see or shoot through buildings.
  function clearGuardSight(x1,y1,x2,y2){
    const dx=x2-x1,dy=y2-y1;
    for(const b of buildings){
      if(Math.max(x1,x2)<=b.x||Math.min(x1,x2)>=b.x+b.w||Math.max(y1,y2)<=b.y||Math.min(y1,y2)>=b.y+b.h)continue;
      let enter=0,exit=1;
      if(Math.abs(dx)<.000001){if(x1<b.x||x1>b.x+b.w)continue}
      else{let a=(b.x-x1)/dx,c=(b.x+b.w-x1)/dx;if(a>c)[a,c]=[c,a];enter=Math.max(enter,a);exit=Math.min(exit,c)}
      if(Math.abs(dy)<.000001){if(y1<b.y||y1>b.y+b.h)continue}
      else{let a=(b.y-y1)/dy,c=(b.y+b.h-y1)/dy;if(a>c)[a,c]=[c,a];enter=Math.max(enter,a);exit=Math.min(exit,c)}
      if(enter<=exit&&enter<1&&exit>0)return false;
    }
    return true;
  }
  function carBlocksCircle(c,x,y,r){const spec=vehicleSpec(c),dx=x-c.x,dy=y-c.y,cos=Math.cos(c.angle),sin=Math.sin(c.angle),localX=dx*cos+dy*sin,localY=-dx*sin+dy*cos,nearX=clamp(localX,-spec.halfLength,spec.halfLength),nearY=clamp(localY,-spec.halfWidth,spec.halfWidth);return(localX-nearX)**2+(localY-nearY)**2<r*r}
  function blockedByCar(x,y,r=10,ignore=null){for(const c of cars)if(!c.destroyed&&c.id!==ignore&&carBlocksCircle(c,x,y,r))return true;return false}
  function carOverlapsAt(a,ax,ay,angle,b){
    const deltaX=b.x-ax,deltaY=b.y-ay,specA=vehicleSpec(a),specB=vehicleSpec(b);
    // Fast conservative broad phase: almost all pairs are several blocks apart.
    const reach=specA.halfLength+specA.halfWidth+specB.halfLength+specB.halfWidth;
    if(deltaX*deltaX+deltaY*deltaY>=reach*reach)return false;
    const ca=Math.cos(angle),sa=Math.sin(angle),cb=Math.cos(b.angle),sb=Math.sin(b.angle);
    const axes=[[ca,sa],[-sa,ca],[cb,sb],[-sb,cb]];
    for(const [ux,uy] of axes){
      const aForward=Math.abs(ux*ca+uy*sa),aSide=Math.abs(-ux*sa+uy*ca);
      const bForward=Math.abs(ux*cb+uy*sb),bSide=Math.abs(-ux*sb+uy*cb);
      const reachA=specA.halfLength*aForward+specA.halfWidth*aSide;
      const reachB=specB.halfLength*bForward+specB.halfWidth*bSide;
      if(Math.abs(deltaX*ux+deltaY*uy)>=reachA+reachB)return false;
    }
    return true;
  }  function updateBrakeLight(c,previousSpeed,dt,braking=false){
    const decelerating=Math.abs(c.speed)<Math.abs(previousSpeed)-Math.max(.75,Math.abs(previousSpeed)*.008),target=braking||decelerating?1:0,current=clamp(c.brakeLight||0,0,1),rate=target?12:5;
    c.brakeLight=current+(target-current)*(1-Math.exp(-rate*Math.max(0,dt)));
  }
  function updateTireMarks(dt){for(const mark of skidMarks)mark.age+=dt;skidMarks=skidMarks.filter(mark=>mark.age<mark.lifetime)}
  function emitTireMarks(c,dt,hardBraking){
    if(!running||!hardBraking){c.skidMarkTimer=0;return}c.skidMarkTimer=Math.max(0,(c.skidMarkTimer||0)-dt);if(c.skidMarkTimer>0)return;c.skidMarkTimer=.075;
    const spec=vehicleSpec(c),cos=Math.cos(c.angle),sin=Math.sin(c.angle),rear=-spec.halfLength-4;for(const side of [-spec.halfWidth+3.5,spec.halfWidth-3.5]){if(skidMarks.length>=MAX_SKID_MARKS)skidMarks.shift();skidMarks.push({x:c.x+cos*rear-sin*side,y:c.y+sin*rear+cos*side,angle:c.angle,age:0,lifetime:SKID_MARK_LIFETIME})}
  }
  function emitImpactSparks(x,y,normalAngle){
    for(let i=0;i<6;i++){if(impactSparks.length>=MAX_IMPACT_SPARKS)impactSparks.shift();const angle=normalAngle+rnd(-1.05,1.05),speed=rnd(90,175),vx=Math.cos(angle)*speed,vy=Math.sin(angle)*speed;impactSparks.push({x,y,vx,vy,age:0,lifetime:rnd(.18,IMPACT_SPARK_LIFETIME),color:i%3===0?'#fff3a1':i%3===1?'#ffc34e':'#ff8a38'})}
  }
  function updateImpactSparks(dt){for(const spark of impactSparks){spark.age+=dt;spark.x+=spark.vx*dt;spark.y+=spark.vy*dt;const drag=Math.exp(-5*dt);spark.vx*=drag;spark.vy*=drag}impactSparks=impactSparks.filter(spark=>spark.age<spark.lifetime)}
  function carImpactPoint(c,nx,ny,hitCar){
    if(hitCar){const dx=hitCar.x-nx,dy=hitCar.y-ny,distance=Math.hypot(dx,dy)||1,nxDir=dx/distance,nyDir=dy/distance,forward=Math.abs(nxDir*Math.cos(c.angle)+nyDir*Math.sin(c.angle)),side=Math.abs(-nxDir*Math.sin(c.angle)+nyDir*Math.cos(c.angle)),spec=vehicleSpec(c),reach=spec.halfLength*forward+spec.halfWidth*side;return{x:nx+nxDir*reach,y:ny+nyDir*reach,angle:Math.atan2(nyDir,nxDir)}}
    const building=buildings.find(b=>nx+16>b.x&&nx-16<b.x+b.w&&ny+16>b.y&&ny-16<b.y+b.h);
    if(building){let x=clamp(nx,building.x,building.x+building.w),y=clamp(ny,building.y,building.y+building.h);if(nx>=building.x&&nx<=building.x+building.w&&ny>=building.y&&ny<=building.y+building.h){const sides=[[Math.abs(nx-building.x),building.x,ny,Math.PI],[Math.abs(building.x+building.w-nx),building.x+building.w,ny,0],[Math.abs(ny-building.y),nx,building.y,-Math.PI/2],[Math.abs(building.y+building.h-ny),nx,building.y+building.h,Math.PI/2]].sort((a,b)=>a[0]-b[0]);[,x,y]=sides[0];return{x,y,angle:sides[0][3]}}
      return{x,y,angle:Math.atan2(ny-y,nx-x)}
    }
    const x=clamp(nx,0,world.w),y=clamp(ny,0,world.h);return{x,y,angle:Math.atan2(y-c.y,x-c.x)}
  }
  function upcomingTrafficTurn(c){
    if(!c.traffic||c.driver||c.trafficWait>0||!Array.isArray(c.trafficRoute)||c.trafficRoute.length<3)return null;
    const route=c.trafficRoute,index=((c.trafficIndex%route.length)+route.length)%route.length,[targetX,targetY]=route[index],[previousX,previousY]=route[(index+route.length-1)%route.length],[nextX,nextY]=route[(index+1)%route.length],distance=Math.hypot(targetX-c.x,targetY-c.y);
    if(distance>145)return null;
    const inX=targetX-previousX,inY=targetY-previousY,outX=nextX-targetX,outY=nextY-targetY,inLength=Math.hypot(inX,inY),outLength=Math.hypot(outX,outY);
    if(inLength<1||outLength<1)return null;
    const turn=(inX*outY-inY*outX)/(inLength*outLength);
    return turn>.5?'right':turn<-.5?'left':null;
  }
  // NPC cars that are shot abandon their normal route and choose junctions
  // that increase distance from the player who fired. Roads form a connected grid.
  function escapeThreat(c){
    const shooter=players.find(p=>p.id===c.escapeFromPlayerId&&p.alive!==false);
    if(shooter){const q=pos(shooter);c.escapeSourceX=q.x;c.escapeSourceY=q.y}
    return{x:c.escapeSourceX,y:c.escapeSourceY};
  }
  function chooseEscapeJunction(c,node,threat){
    let best=null,bestScore=-Infinity;
    for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const xi=node.xi+di,yi=node.yi+dj;
      if(xi<0||xi>=roadsX.length||yi<0||yi>=roadsY.length)continue;
      const x=roadsX[xi],y=roadsY[yi],distance=Math.hypot(x-threat.x,y-threat.y);
      const backtrack=c.escapePreviousNode?.xi===xi&&c.escapePreviousNode?.yi===yi;
      const prev=c.escapePreviousNode;
      const straight=prev&&xi-node.xi===node.xi-prev.xi&&yi-node.yi===node.yi-prev.yi;
      const score=distance-(backtrack?10000:0)+(straight?45:0);
      if(score>bestScore){best={xi,yi};bestScore=score}
    }
    if(best){c.escapePreviousNode=node;c.escapeNode=best}
  }
  function startCarEscape(c,shooter){
    if(c.destroyed||c.driver||!c.npcInside||!shooter)return;
    const q=pos(shooter),yi=roadsY.reduce((best,y,i)=>Math.abs(y-c.y)<Math.abs(roadsY[best]-c.y)?i:best,0);
    c.escapeFromPlayerId=shooter.id;c.escapeSourceX=q.x;c.escapeSourceY=q.y;
    c.escapePreviousNode=null;c.trafficWait=0;c.turnSignal=null;
    // Approach an intersection along the street, never cut across buildings.
    const nearest=roadsX.reduce((best,x,i)=>Math.abs(x-c.x)<Math.abs(roadsX[best]-c.x)?i:best,0);
    if(Math.abs(roadsX[nearest]-c.x)<roadWidth/2)c.escapeNode={xi:nearest,yi};
    else{
      const options=[nearest+(roadsX[nearest]<c.x?0:-1),nearest+(roadsX[nearest]<c.x?1:0)].filter(i=>i>=0&&i<roadsX.length);
      let best=options[0],bestScore=-Infinity;
      for(const xi of [...new Set(options)]){
        const dx=roadsX[xi]-c.x;
        const score=Math.hypot(roadsX[xi]-q.x,roadsY[yi]-q.y)+Math.cos(c.angle)*dx*.15;
        if(score>bestScore){best=xi;bestScore=score}
      }
      c.escapeNode={xi:best,yi};
    }
    c.speed=vehicleSpec(c).forwardSpeed;
  }
  function advanceEscapingCar(c,dt){
    const threat=escapeThreat(c),spec=vehicleSpec(c),previousSpeed=c.speed;
    if(!c.escapeNode)return;
    let x=roadsX[c.escapeNode.xi],y=roadsY[c.escapeNode.yi];
    let dx=x-c.x,dy=y-c.y,distance=Math.hypot(dx,dy);
    if(distance<2){
      const reached=c.escapeNode;chooseEscapeJunction(c,reached,threat);
      x=roadsX[c.escapeNode.xi];y=roadsY[c.escapeNode.yi];
      dx=x-c.x;dy=y-c.y;distance=Math.hypot(dx,dy);
    }
    const angle=Math.atan2(dy,dx),stop=upcomingTrafficStop(c,angle);
    const step=Math.min(trafficLights.permittedStep(stop,spec.forwardSpeed,dt),distance);
    const waitingForLight=Boolean(stop&&step<spec.forwardSpeed*dt-.001);
    const nx=c.x+Math.cos(angle)*step,ny=c.y+Math.sin(angle)*step;
    const collision=vehicleBlockedAt(c,nx,ny,angle)||vehicleAtBoundary(c,nx,ny,angle)||
      cars.some(other=>other!==c&&!other.destroyed&&carOverlapsAt(c,nx,ny,angle,other));
    if(!collision){
      c.x=nx;c.y=ny;c.angle=angle;c.speed=dt>0?step/dt:0;
      if(step>0)hitPedestrians(c);
      if(step>=distance-.01)chooseEscapeJunction(c,c.escapeNode,threat);
    }else{c.speed=0;if(step>0)damageCarFromCrash(c,previousSpeed)}
    c.turnSignal=null;
    updateBrakeLight(c,previousSpeed,dt,collision||waitingForLight);
    emitTireMarks(c,dt,collision&&previousSpeed>70);
  }
  function coastCar(c,dt){
    const previousSpeed=c.speed||0;
    if(Math.abs(previousSpeed)<1){c.speed=0;return}
    const spec=vehicleSpec(c);
    const nx=c.x+Math.cos(c.angle)*previousSpeed*dt,ny=c.y+Math.sin(c.angle)*previousSpeed*dt;
    const hitCar=cars.find(other=>other!==c&&!other.destroyed&&carOverlapsAt(c,nx,ny,c.angle,other));
    if(vehicleBlockedAt(c,nx,ny,c.angle)||vehicleAtBoundary(c,nx,ny,c.angle)||hitCar){
      c.speed=0;damageCarFromCrash(c,previousSpeed);
      if(hitCar&&!hitCar.destroyed)damageCarFromCrash(hitCar,previousSpeed);
    }else{
      c.x=nx;c.y=ny;c.speed=previousSpeed*Math.pow(spec.drag,dt*60);
      if(Math.abs(c.speed)<1)c.speed=0;
      hitPedestrians(c);
    }
  }
  // Emergency vehicles keep their physical footprint but can use either lane.
  function ambulanceClear(c,x,y,angle,nearby=cars){
    return !vehicleAtBoundary(c,x,y,angle)&&!vehicleBlockedAt(c,x,y,angle)&&
      !nearby.some(other=>other!==c&&!other.destroyed&&carOverlapsAt(c,x,y,angle,other));
  }
  function ambulanceSegmentClear(c,x,y,tx,ty,nearby=cars){
    const dx=tx-x,dy=ty-y,d=Math.hypot(dx,dy),angle=d>.001?Math.atan2(dy,dx):c.angle;
    const samples=Math.max(1,Math.ceil(d/8));
    for(let i=1;i<=samples;i++)if(!ambulanceClear(c,x+dx*i/samples,y+dy*i/samples,angle,nearby))return false;
    return true;
  }
  function ambulanceDetour(c,tx,ty){
    const dx=tx-c.x,dy=ty-c.y,d=Math.hypot(dx,dy);
    if(d<1)return null;
    const reach=Math.min(d,170),gx=c.x+dx/d*reach,gy=c.y+dy/d*reach;
    const nearby=cars.filter(other=>other!==c&&!other.destroyed&&Math.hypot(other.x-c.x,other.y-c.y)<280);
    // A bounded local A* search finds a passable route around stopped cars or corners.
    const stride=8,originX=c.x,originY=c.y;
    const start={x:originX,y:originY,i:0,j:0,g:0,f:reach,parent:null};
    const open=[start],best=new Map([['0,0',0]]);
    const directions=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
    for(let visited=0;open.length&&visited<500;visited++){
      let k=0;for(let n=1;n<open.length;n++)if(open[n].f<open[k].f)k=n;
      const node=open.splice(k,1)[0],remaining=Math.hypot(gx-node.x,gy-node.y);
      if(node.g>best.get(node.i+','+node.j))continue;
      if(remaining<=26&&ambulanceSegmentClear(c,node.x,node.y,gx,gy,nearby)){
        const path=[[gx,gy]];
        for(let p=node;p.parent;p=p.parent)path.unshift([p.x,p.y]);
        return path;
      }
      for(const [di,dj] of directions){
        const i=node.i+di,j=node.j+dj,x=originX+i*stride,y=originY+j*stride;
        if(Math.abs(i)>24||Math.abs(j)>24)continue;
        const key=i+','+j,g=node.g+Math.hypot(di,dj)*stride;
        if(g>=(best.get(key)??Infinity))continue;
        if(!ambulanceSegmentClear(c,node.x,node.y,x,y,nearby))continue;
        best.set(key,g);
        open.push({x,y,i,j,g,f:g+Math.hypot(gx-x,gy-y)*1.15,parent:node});
      }
    }
    return null;
  }
  function advanceEmergencyAmbulance(c,dt){
    const previousSpeed=c.speed,route=c.trafficRoute;
    if(!route?.length||dt<=0)return;
    c.ambulanceRetry=Math.max(0,(c.ambulanceRetry||0)-dt);
    // Never wrap to the start of a service leg before pickup/return is processed.
    while(c.trafficIndex<route.length-1&&Math.hypot(route[c.trafficIndex][0]-c.x,route[c.trafficIndex][1]-c.y)<1)c.trafficIndex++;
    let [tx,ty]=route[c.trafficIndex];
    if(c.trafficIndex===route.length-1&&c.ambulanceJob?.remain&&Math.hypot(tx-c.x,ty-c.y)<65){
      const angle=Math.atan2(ty-c.y,tx-c.x);
      if(!ambulanceClear(c,tx,ty,angle)&&ambulanceClear(c,c.x,c.y,c.angle)){
        // The body may be beside a parked vehicle. Load from a clear nearby position.
        route[c.trafficIndex]=[c.x,c.y];c.ambulanceDetour=null;tx=c.x;ty=c.y;
      }
    }
    if(c.ambulanceDetour?.length&&Math.hypot(c.ambulanceDetour[0][0]-c.x,c.ambulanceDetour[0][1]-c.y)<1)c.ambulanceDetour.shift();
    let target=c.ambulanceDetour?.[0]||[tx,ty];
    let dx=target[0]-c.x,dy=target[1]-c.y,d=Math.hypot(dx,dy);
    const look=Math.min(d,c.ambulanceDetour?.length?c.trafficSpeed*dt:45);
    if(d>.001&&!ambulanceSegmentClear(c,c.x,c.y,c.x+dx/d*look,c.y+dy/d*look)){
      c.ambulanceDetour=null;
      if(c.ambulanceRetry<=0){
        c.ambulanceDetour=ambulanceDetour(c,tx,ty);
        c.ambulanceRetry=.35;
      }
      target=c.ambulanceDetour?.[0]||[tx,ty];
      dx=target[0]-c.x;dy=target[1]-c.y;d=Math.hypot(dx,dy);
    }
    const angle=d>.001?Math.atan2(dy,dx):c.angle,step=Math.min(d,c.trafficSpeed*dt);
    const nx=c.x+Math.cos(angle)*step,ny=c.y+Math.sin(angle)*step;
    if(step>.001&&ambulanceSegmentClear(c,c.x,c.y,nx,ny)){
      c.x=nx;c.y=ny;c.angle=angle;c.speed=step/dt;
      hitPedestrians(c);
      if(step>=d-.01){
        if(c.ambulanceDetour?.length)c.ambulanceDetour.shift();
        else if(c.trafficIndex<route.length-1)c.trafficIndex++;
      }
    }else{c.speed=0}
    c.turnSignal=upcomingTrafficTurn(c);
    updateBrakeLight(c,previousSpeed,dt,c.speed===0);
    emitTireMarks(c,dt,previousSpeed>70&&c.speed===0);
  }
  function advanceTraffic(dt){
    for(const c of cars){
      if(c.destroyed)continue;
      if(c.pursuitOwnerId!=null){advancePursuitCar(c,dt);continue}
      if(c.escapeFromPlayerId!=null&&!c.driver&&c.npcInside){advanceEscapingCar(c,dt);continue}
      if(!c.traffic||c.driver||!c.npcInside){c.turnSignal=null;if(!c.driver){const previousSpeed=c.speed;if(!c.npcInside)coastCar(c,dt);if(!c.destroyed){updateBrakeLight(c,previousSpeed,dt);emitTireMarks(c,dt,false)}}continue}
      if(c.type===AMBULANCE_TYPE&&c.ambulanceJob){advanceEmergencyAmbulance(c,dt);continue}
      const wasWaiting=c.trafficWait>0,previousSpeed=c.speed;c.trafficWait=Math.max(0,c.trafficWait-dt);if(c.trafficWait>0){c.turnSignal=null;updateBrakeLight(c,previousSpeed,dt,true);emitTireMarks(c,dt,false);continue}
      let [targetX,targetY]=c.trafficRoute[c.trafficIndex],dx=targetX-c.x,dy=targetY-c.y,distance=Math.hypot(dx,dy);
      if(distance<1){c.trafficIndex=(c.trafficIndex+1)%c.trafficRoute.length;[targetX,targetY]=c.trafficRoute[c.trafficIndex];dx=targetX-c.x;dy=targetY-c.y;distance=Math.hypot(dx,dy)}
      const angle=Math.atan2(dy,dx),stop=upcomingTrafficStop(c,angle);
      const step=Math.min(trafficLights.permittedStep(stop,c.trafficSpeed,dt),distance);
      const waitingForLight=Boolean(stop&&step<c.trafficSpeed*dt-.001);
      const nx=c.x+Math.cos(angle)*step,ny=c.y+Math.sin(angle)*step;
      const hitCar=cars.find(other=>other!==c&&!other.destroyed&&carOverlapsAt(c,nx,ny,angle,other));
      const hitBuilding=vehicleBlockedAt(c,nx,ny,angle);
      if(!hitBuilding&&!hitCar&&!vehicleAtBoundary(c,nx,ny,angle)){
        c.x=nx;c.y=ny;c.angle=angle;c.speed=dt>0?step/dt:0;
        if(step>0)hitPedestrians(c);
        if(step>=distance-.01)c.trafficIndex=(c.trafficIndex+1)%c.trafficRoute.length;
      }else{
        if(previousSpeed>=220){const contact=carImpactPoint(c,nx,ny,hitCar);emitImpactSparks(contact.x,contact.y,contact.angle)}
        c.speed=0;c.trafficWait=.12;
        if(step>0)damageCarFromCrash(c,previousSpeed);
      }
      if(c.destroyed)continue;
      c.turnSignal=upcomingTrafficTurn(c);
      updateBrakeLight(c,previousSpeed,dt,c.trafficWait>0||waitingForLight);
      const hardStop=!wasWaiting&&!waitingForLight&&previousSpeed>70&&Math.abs(c.speed)<previousSpeed*.55;
      emitTireMarks(c,dt,hardStop);
    }
  }
  function spawnRespawnCar(record){
    if(record.type==='tank'){const tank=tankSpawn();return tank?{id:nextCarId++,respawnOf:record.id,...tank}:null}
    const traffic=record.traffic,type=record.type||'car',trafficSpeed=vehicleSpec({type}).trafficSpeed,minDistance=Math.min(world.w,world.h)*.33;
    for(let attempt=0;attempt<120;attempt++){
      let x,y,angle,east=false,route=null;
      if(traffic){
        if(record.vertical){const column=Math.floor(Math.random()*roadsX.length),south=Math.random()<.5,edge=south?roadsY[0]:roadsY[roadsY.length-1];x=roadsX[column]+(south?laneOffset:-laneOffset);y=edge+(south?1:-1)*rnd(42,68);angle=south?Math.PI/2:-Math.PI/2;route=verticalTrafficLoop(roadsX[column],south)}
        else{const row=trafficRows[Math.floor(Math.random()*trafficRows.length)];east=Math.random()<.5;y=roadsY[row]+(east?-laneOffset:laneOffset);x=east?trafficMinX+rnd(42,68):trafficMaxX-rnd(42,68);angle=east?0:Math.PI;route=trafficLoop(roadsY[row],east)}
      }else{
        const north=Math.random()<.5,row=north?roadsY[0]:roadsY[roadsY.length-1],side=Math.random()<.5?-1:1;x=rnd(trafficMinX+120,trafficMaxX-120);y=row+side*(roadWidth/2-14);angle=0;
      }
      const candidate={id:record.id,type,x,y,angle};
      if(Math.hypot(x-record.originX,y-record.originY)<minDistance||vehicleBlockedAt(candidate,x,y,angle)||vehicleAtBoundary(candidate,x,y,angle)||blockedByPlayer(x,y,28)||cars.some(other=>!other.destroyed&&carOverlapsAt(candidate,x,y,angle,other)))continue;
      return {id:nextCarId++,respawnOf:record.id,type,x,y,angle,speed:traffic?trafficSpeed:0,brakeLight:0,skidMarkTimer:0,turnSignal:null,driver:null,color:record.color,health:CAR_MAX_HEALTH,destroyed:false,traffic,trafficRoute:route,trafficIndex:0,trafficSpeed,trafficWait:0,trafficVertical:Boolean(record.vertical),respawned:true,npcInside:true};
    }
    return null;
  }
  function advanceCarRespawns(dt){
    for(let i=carRespawns.length-1;i>=0;i--){const record=carRespawns[i];record.delay-=dt;if(record.delay>0)continue;const car=spawnRespawnCar(record);if(car){cars.push(car);carRespawns.splice(i,1)}else record.delay=.25}
  }
  // Only the local or dedicated-server simulation creates money convoys.
  function spawnCashConvoy(){
    for(let attempt=0;attempt<80;attempt++){
      const row=trafficRows[Math.floor(Math.random()*trafficRows.length)],east=Math.random()<.5;
      const y=roadsY[row]+(east?-laneOffset:laneOffset),x=east?trafficMinX+95:trafficMaxX-95,angle=east?0:Math.PI;
      const candidate={id:nextCarId,type:TRUCK_TYPE,x,y,angle};
      if(vehicleBlockedAt(candidate,x,y,angle)||vehicleAtBoundary(candidate,x,y,angle)||blockedByPlayer(x,y,42)||
        cars.some(other=>!other.destroyed&&carOverlapsAt(candidate,x,y,angle,other)))continue;
      const trafficSpeed=vehicleSpec(candidate).trafficSpeed;
      cars.push({id:nextCarId++,type:TRUCK_TYPE,x,y,angle,speed:trafficSpeed,brakeLight:0,skidMarkTimer:0,
        turnSignal:null,driver:null,color:'#257557',health:CAR_MAX_HEALTH,destroyed:false,traffic:true,
        trafficRoute:trafficLoop(roadsY[row],east),trafficIndex:0,trafficSpeed,trafficWait:0,npcInside:true,
        cashConvoy:true,convoyAge:0});
      setGameStatus('cashConvoyArrived');
      return true;
    }
    return false;
  }
  function updateCashConvoys(dt){
    cashConvoyClock+=dt;
    for(let i=cars.length-1;i>=0;i--){
      const c=cars[i];
      if(!c.cashConvoy||!c.npcInside||c.driver)continue;
      c.convoyAge=(c.convoyAge||0)+dt;
      if(c.convoyAge>=CASH_CONVOY_LIFETIME)cars.splice(i,1);
    }
    while(cashConvoyClock>=CASH_CONVOY_INTERVAL){
      cashConvoyClock-=CASH_CONVOY_INTERVAL;
      spawnCashConvoy();
    }
  }
  function dropCashFromConvoy(c){cashPacks.push({x:c.x,y:c.y,phase:rnd(0,6.28),value:CASH_CONVOY_VALUE,convoy:true})}
  function livingPlayers(){return players.filter(p=>p.alive!==false&&!p.ghost)}
  function blockedByPlayer(x,y,r=10,ignore=null){for(const p of players)if(p!==ignore&&p.alive!==false&&!p.ghost&&!p.car&&Math.hypot(x-p.x,y-p.y)<r+10)return true;return false}
  function hospitalSpawn(p){const offsets=[[0,0],[24,0],[-24,0],[0,24],[0,-24],[38,22],[-38,22],[38,-22],[-38,-22],[0,48],[0,-48]];for(const [dx,dy] of offsets){const x=hospital.exitX+dx,y=hospital.exitY+dy;if(!blocked(x,y,10)&&!blockedByCar(x,y,12)&&!blockedByPlayer(x,y,12,p))return{x,y}}return{x:hospital.exitX,y:hospital.exitY}}
  function respawnPlayer(p){const spawn=hospitalSpawn(p);p.x=spawn.x;p.y=spawn.y;p.car=null;p.enterTargetId=null;p.health=p.maxHealth;p.alive=true;p.jumpTime=0;p.jumpHeld=false;p.jumpSafeX=p.jumpSafeY=null;p.deathTimer=0;p.wastedTimer=0;p.stun=0;p.invuln=3;p.damageCooldown=3;p.fireCooldown=0;p.recentGunfire=0;p.fireHeld=false;p.padFireHeld=false;p.padTriggerHeld=false;p.walk=0;p.moveTime=0;p.facing=-Math.PI/2;p.bodyFacing=p.facing;setGameStatus('respawn',{id:p.id});lastUi='';renderPlayers()}
  function killPlayer(p,reason='',attacker=null){
    if(!p||p.alive===false)return;
    const q=pos(p),vehicle=p.car;p.weapon=null;if(p.pistolAmmo>0)dropPistol(q.x,q.y,p.pistolAmmo);p.pistolAmmo=0;p.knifeSwing=0;refreshAmmoHud();if(p.bazookaAmmo>0){bazookaDrops.push({x:q.x,y:q.y,ammo:p.bazookaAmmo,facing:p.facing||0});p.bazookaAmmo=0;refreshAmmoHud()}addDeathRemain(p,q.x,q.y);p.x=q.x;p.y=q.y;p.car=null;p.enterTargetId=null;p.alive=false;p.jumpTime=0;p.health=0;p.deathTimer=2.4;p.wastedTimer=2.4;p.stun=0;p.walk=0;p.invuln=0;p.damageCooldown=Infinity;p.fireHeld=false;p.padFireHeld=false;p.padTriggerHeld=false;if(p.id===1){touchState.fire=false;touchState.forward=touchState.brake=touchState.weapon=false;resetTouchStick()}
    // A dead driver does not destroy a still-drivable vehicle.
    if(vehicle){if(vehicle.driver===p)vehicle.driver=null;vehicle.speed=0}
    if(attacker&&attacker!==p)awardScore(attacker,1,'kills');
    setGameStatus('dead',{id:p.id,reasonCode:reason});lastUi='';renderPlayers()
  }
  function damagePlayer(p,amount,reason='',attacker=null){
    // A player inside a car is protected until that specific car explodes.
    if(!p||p.alive===false||amount<=0||(p.car&&reason!=='carExplosion')||(p.damageCooldown>0&&reason!=='carExplosion'))return false;
    p.health=Math.max(0,p.health-amount);p.hits++;p.damageCooldown=.82;p.invuln=.82;p.stun=Math.max(p.stun,.4);if(p.car)p.car.speed*=.55;
    if(p.health<=0)killPlayer(p,reason,attacker);else{setGameStatus('damaged',{id:p.id,health:p.health,max:p.maxHealth});lastUi='';renderPlayers()}
    return true
  }
  function eject(p,c){const angle=Math.atan2(p.y-c.y,p.x-c.x);const distance=c.type===TRUCK_TYPE?vehicleSpec(c).halfLength+18:36;p.x=clamp(c.x+Math.cos(angle)*distance,14,world.w-14);p.y=clamp(c.y+Math.sin(angle)*distance,14,world.h-14);p.facing=angle;p.bodyFacing=angle;if(p.car?.driver===p)p.car.driver=null;p.car=null;p.enterTargetId=null;p.stun=.9}
  function carSidePosition(c){
    // Try both doors and nearby clear spots before placing an ejected occupant.
    const first=Math.max(35,vehicleSpec(c).halfLength+14);for(const radius of [first,first+10,first+20])for(const side of [Math.PI/2,-Math.PI/2,Math.PI*.75,-Math.PI*.75,0,Math.PI]){
      const angle=c.angle+side,x=clamp(c.x+Math.cos(angle)*radius,14,world.w-14),y=clamp(c.y+Math.sin(angle)*radius,14,world.h-14);
      if(!blocked(x,y,10)&&!blockedByCar(x,y,10,c.id)&&!blockedByPlayer(x,y,10))return{x,y};
    }
    return null;
  }
  function releasePursuitCar(owner){
    const vehicle=cars.find(c=>c.id===owner.pursuitCarId&&!c.destroyed);
    if(vehicle&&vehicle.pursuitOwnerId===owner.id){
      vehicle.pursuitOwnerId=null;vehicle.pursuitNode=null;vehicle.pursuitPreviousNode=null;
      vehicle.npcInside=false;vehicle.traffic=false;vehicle.speed=0;vehicle.trafficWait=0;
      const exit=carSidePosition(vehicle);
      owner.x=exit?.x??vehicle.x;owner.y=exit?.y??vehicle.y;
    }
    owner.pursuitCarId=null;owner.vehicleTargetId=null;
  }
  function pursuitCandidate(owner){
    const eligible=c=>c.id!==owner.carId&&!c.destroyed&&!c.driver&&c.pursuitOwnerId==null&&
      !c.escapeFromPlayerId&&Math.abs(c.speed||0)<DRIVER_RECLAIM_MAX_SPEED+8&&
      Math.hypot(c.x-owner.x,c.y-owner.y)<DRIVER_PURSUIT_CAR_RANGE&&
      !carDrivers.some(other=>other!==owner&&other.vehicleTargetId===c.id&&other.pursuitCarId==null);
    const prior=cars.find(c=>c.id===owner.vehicleTargetId);
    if(prior&&eligible(prior))return prior;
    owner.vehicleTargetId=null;
    const candidates=cars.filter(eligible);
    // Prefer parked cars: catching a moving traffic car on foot is unreliable.
    candidates.sort((a,b)=>Number(a.traffic)-Number(b.traffic)||
      Math.hypot(a.x-owner.x,a.y-owner.y)-Math.hypot(b.x-owner.x,b.y-owner.y));
    const chosen=candidates[0]||null;
    owner.vehicleTargetId=chosen?.id??null;
    return chosen;
  }
  function takePursuitCar(owner,c){
    if(!c||c.destroyed||c.driver||c.pursuitOwnerId!=null)return false;
    if(c.npcInside)hijackCar(c,true);
    c.npcInside=true;c.pursuitOwnerId=owner.id;
    c.escapeFromPlayerId=null;c.escapeNode=null;c.trafficWait=0;
    c.speed=0;c.pursuitNode=null;c.pursuitPreviousNode=null;
    owner.pursuitCarId=c.id;owner.vehicleTargetId=null;
    owner.x=c.x;owner.y=c.y;owner.facing=c.angle;owner.walk=0;owner.stun=0;
    return true;
  }
  function chaseRoadNode(c,goal){
    const xi=roadsX.reduce((best,x,i)=>Math.abs(x-c.x)<Math.abs(roadsX[best]-c.x)?i:best,0);
    const yi=roadsY.reduce((best,y,i)=>Math.abs(y-c.y)<Math.abs(roadsY[best]-c.y)?i:best,0);
    if(!c.pursuitNode)c.pursuitNode={xi,yi};
    if(Math.hypot(roadsX[c.pursuitNode.xi]-c.x,roadsY[c.pursuitNode.yi]-c.y)>12)return c.pursuitNode;
    const node=c.pursuitNode,options=[[node.xi+1,node.yi],[node.xi-1,node.yi],
      [node.xi,node.yi+1],[node.xi,node.yi-1]].filter(([x,y])=>
      x>=0&&x<roadsX.length&&y>=0&&y<roadsY.length);
    options.sort(([ax,ay],[bx,by])=>{
      const score=(x,y)=>Math.abs(roadsX[x]-goal.x)+Math.abs(roadsY[y]-goal.y)+
        (c.pursuitPreviousNode?.xi===x&&c.pursuitPreviousNode?.yi===y?170:0);
      return score(ax,ay)-score(bx,by);
    });
    c.pursuitPreviousNode=node;
    c.pursuitNode={xi:options[0][0],yi:options[0][1]};
    return c.pursuitNode;
  }
  function advancePursuitCar(c,dt){
    const owner=carDrivers.find(d=>d.id===c.pursuitOwnerId&&d.pursuitCarId===c.id);
    const target=owner&&cars.find(other=>other.id===owner.carId&&!other.destroyed);
    if(!owner||!target){c.pursuitOwnerId=null;c.speed=0;c.pursuitNode=null;return}
    if(c.driver){releasePursuitCar(owner);return}
    const spec=vehicleSpec(c),previousSpeed=c.speed;
    const node=chaseRoadNode(c,target),dx=roadsX[node.xi]-c.x,dy=roadsY[node.yi]-c.y;
    const distance=Math.hypot(dx,dy),angle=distance>.001?Math.atan2(dy,dx):c.angle;
    const chaseSpeed=Math.min(280,spec.forwardSpeed*.78);
    const light=upcomingTrafficStop(c,angle);
    const step=Math.min(distance,trafficLights.permittedStep(light,chaseSpeed,dt));
    const nx=c.x+Math.cos(angle)*step,ny=c.y+Math.sin(angle)*step;
    const blockedAhead=vehicleBlockedAt(c,nx,ny,angle)||vehicleAtBoundary(c,nx,ny,angle)||
      cars.some(other=>other!==c&&!other.destroyed&&carOverlapsAt(c,nx,ny,angle,other));
    if(!blockedAhead&&step>.001){
      c.x=nx;c.y=ny;c.angle=angle;c.speed=step/dt;
      hitPedestrians(c);
    }else{c.speed=0;if(blockedAhead&&step>0)damageCarFromCrash(c,previousSpeed)}
    updateBrakeLight(c,previousSpeed,dt,blockedAhead||Boolean(light&&step<chaseSpeed*dt-.001));
    emitTireMarks(c,dt,blockedAhead&&previousSpeed>70);
  }
  function hijackCar(c,byNpc=false){
    if(!c.npcInside)return;
    const exit=carSidePosition(c);
    // A surrounding obstacle must not strand the driver inside a stolen car.
    const distance=vehicleSpec(c).halfWidth+20;
    const x=exit?.x??clamp(c.x-Math.sin(c.angle)*distance,14,world.w-14);
    const y=exit?.y??clamp(c.y+Math.cos(c.angle)*distance,14,world.h-14);
    const facing=Math.atan2(c.y-y,c.x-x);
    if(c.pursuitOwnerId!=null){
      const pursuer=carDrivers.find(d=>d.id===c.pursuitOwnerId);
      if(pursuer)releasePursuitCar(pursuer);
      else c.pursuitOwnerId=null;
    }else carDrivers.push({id:c.id,carId:c.id,x,y,color:['#b4a8e3','#e8b47e','#8fd0a1','#de9c8c'][c.id%4],
      facing,bodyFacing:facing,walk:0,stun:.65,hp:DRIVER_MAX_HEALTH,maxHp:DRIVER_MAX_HEALTH,
      seekVehicle:!byNpc&&Math.random()<DRIVER_VEHICLE_PURSUIT_CHANCE,
      vehicleTargetId:null,pursuitCarId:null});
    c.npcInside=false;c.escapeFromPlayerId=null;c.escapeNode=null;
    emitExitDustPuff(x,y);
    if(!byNpc)setGameStatus('carHijacked');
  }

  function refreshAmmoHud(){
    if(dedicatedMode)return;
    const hud=document.querySelector('.ammo-indicator');
    if(!hud)return;
    const local=multiplayer.role==='guest'
      ?players.filter(p=>p.id===multiplayer.playerId)
      :players.filter(p=>p.source!=='remote');
    const equipped=local.map(p=>{
      const weapon=equippedWeapon(p);
      if(p.car?.type==='tank')return 'P'+p.id+' '+translate('tankName')+' ∞';
      const ammo=weapon==='pistol'?p.pistolAmmo+'/'+PISTOL_MAX_AMMO:weapon==='bazooka'?p.bazookaAmmo:'';
      return ['P'+p.id,translate(weapon+'Name'),ammo].filter(value=>value!=='').join(' ');
    });
    hud.textContent=[translate('ammo'),...equipped].join(' · ');
  }
  function buyBazooka(p){
    if(!running||p.alive===false||p.car||!weaponShop||Math.hypot(p.x-weaponShop.x,p.y-weaponShop.y)>55)return false;
    if((p.bazookaAmmo||0)>0){setGameStatus('bazookaAlreadyOwned',{id:p.id});return true}
    if((p.cash||0)<BAZOOKA_PRICE){setGameStatus('bazookaTooExpensive',{price:BAZOOKA_PRICE});return true}
    p.cash-=BAZOOKA_PRICE;bonusScore=Math.max(0,bonusScore-BAZOOKA_PRICE);
    p.bazookaAmmo=BAZOOKA_ROCKETS;
    refreshCompetitionHud();lastUi='';renderPlayers();
    setGameStatus('bazookaBought',{id:p.id});
    refreshAmmoHud();
    return true;
  }
  function carEdgePoint(c,x,y){
    const spec=vehicleSpec(c),cos=Math.cos(c.angle),sin=Math.sin(c.angle),dx=x-c.x,dy=y-c.y;
    const forward=clamp(dx*cos+dy*sin,-spec.halfLength,spec.halfLength);
    const side=clamp(dy*cos-dx*sin,-spec.halfWidth,spec.halfWidth);
    return{x:c.x+forward*cos-side*sin,y:c.y+forward*sin+side*cos};
  }
  function carBodyGap(c,x,y){const point=carEdgePoint(c,x,y);return Math.hypot(point.x-x,point.y-y)}
  function carVisibleFrom(p,c){
    const point=carEdgePoint(c,p.x,p.y),distance=Math.hypot(point.x-p.x,point.y-p.y);
    const steps=Math.ceil(distance/5);
    for(let i=1;i<steps;i++)if(blocked(p.x+(point.x-p.x)*i/steps,p.y+(point.y-p.y)*i/steps,2))return false;
    return true;
  }
  function boardCar(p,c){
    if(!c||c.destroyed||c.driver||p.car)return false;
    p.enterTargetId=null;hijackCar(c);
    p.car=c;c.driver=p;c.speed=0;p.jumpTime=0;p.jumpSafeX=p.jumpSafeY=null;p.x=c.x;p.y=c.y;
    p.facing=c.angle;p.bodyFacing=c.angle;p.moveTime=0;lastUi='';renderPlayers();refreshAmmoHud();
    return true;
  }
  // A single action selects a vehicle; subsequent ticks chase its current location.
  // Manual movement, another action or an unavailable car cancels the chase.
  function chaseCarInput(p,dx,dy,isGuest=false,availableCars=cars){
    if(p.enterTargetId==null)return{dx,dy};
    if(Math.hypot(dx,dy)>.16){p.enterTargetId=null;return{dx,dy}}
    const c=availableCars.find(car=>car.id===p.enterTargetId&&!car.destroyed&&!car.driver&&car.driverId==null);
    if(!c||Math.hypot(c.x-p.x,c.y-p.y)>CAR_CHASE_MAX_DISTANCE){p.enterTargetId=null;return{dx:0,dy:0}}
    const point=carEdgePoint(c,p.x,p.y),gap=Math.hypot(point.x-p.x,point.y-p.y);
    if(gap<=CAR_BOARD_GAP){if(!isGuest)boardCar(p,c);return{dx:0,dy:0}}
    return{dx:(point.x-p.x)/gap,dy:(point.y-p.y)/gap};
  }
  function enterOrExit(p){
    if(p.alive===false)return;
    if(p.car){
      const c=p.car,exit=carSidePosition(c);
      if(!exit)return;
      p.x=exit.x;p.y=exit.y;p.facing=c.angle;p.bodyFacing=c.angle;
      c.driver=null;p.car=null;p.enterTargetId=null;p.moveTime=0;emitExitDustPuff(p.x,p.y);lastUi='';renderPlayers();refreshAmmoHud();return;
    }
    if(p.enterTargetId!=null){p.enterTargetId=null;return}
    let closest=null,gap=Infinity;
    for(const c of cars)if(!c.destroyed&&!c.driver&&c.pursuitOwnerId==null){
      const distance=carBodyGap(c,p.x,p.y);
      if(distance<=CAR_SELECT_RADIUS&&distance<gap&&carVisibleFrom(p,c)){gap=distance;closest=c}
    }
    if(!closest){buyBazooka(p);return}
    if(gap<=CAR_BOARD_GAP)boardCar(p,closest);
    else p.enterTargetId=closest.id;
  }
  function damageCarDriver(owner,amount){
    if(!owner||!carDrivers.includes(owner)||amount<=0)return false;
    owner.hp=Math.max(0,owner.hp-amount);
    owner.stun=Math.max(owner.stun||0,.45);
    owner.walk=0;
    if(owner.hp<=0){
      addDeathRemain(owner,owner.x,owner.y,true);
      if(owner.pursuitCarId!=null)releasePursuitCar(owner);
      carDrivers.splice(carDrivers.indexOf(owner),1);
      setGameStatus('driverDown');
    }else setGameStatus('driverDamaged',{health:owner.hp,max:owner.maxHp});
    return true;
  }
  function updateCarDrivers(dt){
    for(let i=carDrivers.length-1;i>=0;i--){
      const owner=carDrivers[i],c=cars.find(car=>car.id===owner.carId&&!car.destroyed);
      if(owner.hp<=0||!c){
        if(owner.hp>0&&!c)addDeathRemain(owner,owner.x,owner.y,true);
        if(owner.pursuitCarId!=null)releasePursuitCar(owner);
        carDrivers.splice(i,1);continue;
      }
      owner.walk=0;owner.stun=Math.max(0,owner.stun-dt);
      const pursuit=owner.pursuitCarId==null?null:cars.find(car=>
        car.id===owner.pursuitCarId&&!car.destroyed&&car.pursuitOwnerId===owner.id);
      if(owner.pursuitCarId!=null&&!pursuit)owner.pursuitCarId=null;
      if(pursuit){
        owner.x=pursuit.x;owner.y=pursuit.y;owner.facing=pursuit.angle;owner.bodyFacing=pursuit.angle;
        if(Math.hypot(c.x-pursuit.x,c.y-pursuit.y)<=DRIVER_PURSUIT_DISMOUNT_RANGE&&
            Math.abs(c.speed)<DRIVER_RECLAIM_MAX_SPEED){
          releasePursuitCar(owner);
          owner.seekVehicle=false; // Finish the reclaim attempt on foot.
          owner.stun=.15;
        }else continue;
      }
      if(owner.stun>0)continue;
      const dx=c.x-owner.x,dy=c.y-owner.y,distance=Math.hypot(dx,dy)||1;
      if(distance<=DRIVER_RECLAIM_DISTANCE&&Math.abs(c.speed)<DRIVER_RECLAIM_MAX_SPEED){
        if(c.driver){
          const exit=carSidePosition(c);
          if(!exit)continue;
          const thief=c.driver;
          thief.x=exit.x;thief.y=exit.y;thief.facing=c.angle;thief.bodyFacing=c.angle;
          thief.car=null;thief.stun=Math.max(thief.stun||0,.5);thief.moveTime=0;
          c.driver=null;emitExitDustPuff(exit.x,exit.y);lastUi='';renderPlayers();
        }
        c.npcInside=true;c.escapeFromPlayerId=null;c.escapeNode=null;c.speed=0;c.trafficWait=.4;
        carDrivers.splice(i,1);setGameStatus('carReclaimed');continue;
      }
      let goal=c;
      if(owner.seekVehicle){
        const candidate=pursuitCandidate(owner);
        if(candidate){
          goal=candidate;
          const reach=vehicleSpec(candidate).halfLength+24;
          if(Math.hypot(candidate.x-owner.x,candidate.y-owner.y)<=reach&&
              Math.abs(candidate.speed)<DRIVER_RECLAIM_MAX_SPEED+8){
            if(takePursuitCar(owner,candidate))continue;
          }
        }
      }
      const gx=goal.x-owner.x,gy=goal.y-owner.y,remaining=Math.hypot(gx,gy)||1;
      if(remaining<=24)continue;
      const step=Math.min(DRIVER_CHASE_SPEED*dt,remaining-23),ux=gx/remaining,uy=gy/remaining;
      owner.facing=Math.atan2(gy,gx);
      // Try axis-aligned and wall-following steps if the direct path is blocked.
      const directions=[[ux,uy],[ux,0],[0,uy],[-uy,ux],[uy,-ux]];
      let best=null,bestDistance=Infinity;
      for(const [vx,vy] of directions){
        const norm=Math.hypot(vx,vy);if(norm<.001)continue;
        const x=clamp(owner.x+vx/norm*step,14,world.w-14);
        const y=clamp(owner.y+vy/norm*step,14,world.h-14);
        if(blocked(x,y,9)||blockedByCar(x,y,9,goal.id)||blockedByPlayer(x,y,9))continue;
        const after=Math.hypot(goal.x-x,goal.y-y);
        if(after<bestDistance){best={x,y};bestDistance=after}
      }
      if(best){
        owner.walk=Math.hypot(best.x-owner.x,best.y-owner.y)>.01?1:0;
        owner.x=best.x;owner.y=best.y;
        if(owner.walk)owner.bodyFacing=owner.facing;
      }
    }
  }
  function jumpHeight(p){
    const t=Math.max(0,Math.min(1,(p.jumpTime||0)/1.5));
    return 4*24*t*(1-t);
  }
  // One hop per press, including remote players; no automatic repeat.
  function stepJump(p,pressed,dt){
    const rising=pressed&&!p.jumpHeld;
    p.jumpHeld=Boolean(pressed);
    if(p.car||p.carId!=null||p.alive===false){p.jumpTime=0;return}
    p.jumpTime=Math.max(0,(p.jumpTime||0)-dt);
    if(rising&&!p.jumpTime&&!(p.stun>0)){p.jumpTime=1.5;p.jumpSafeX=p.x;p.jumpSafeY=p.y;p.enterTargetId=null}
  }
  function walkObstacle(p,x,y,availableCars=cars,ground=false){
    const airborne=!ground&&p.jumpTime>0&&(jumpHeight(p)>=8||blocked(p.x,p.y,9)||availableCars.some(c=>!c.destroyed&&c.type!==TRUCK_TYPE&&c.type!=='tank'&&carBlocksCircle(c,p.x,p.y,10)));
    if(blocked(x,y,9,airborne))return true;
    return availableCars.some(c=>!c.destroyed&&(!airborne||c.type===TRUCK_TYPE||c.type==='tank')&&carBlocksCircle(c,x,y,10));
  }
  function jumpGroundClear(p,x,y,availableCars,availablePlayers){
    return x>=14&&x<=world.w-14&&y>=14&&y<=world.h-14&&
      !walkObstacle(p,x,y,availableCars,true)&&
      !availablePlayers.some(q=>q!==p&&q.id!==p.id&&q.alive!==false&&!q.car&&q.carId==null&&Math.hypot(x-q.x,y-q.y)<20);
  }
  function nearestJumpLanding(p,clear){
    const startBlocked=blocked(p.x,p.y,9);
    // Search from the landing point and refine the first clear edge on each ray.
    for(let radius=2;radius<=120;radius+=2){
      let nearest=null,bestDistance=Infinity;
      for(let direction=0;direction<32;direction++){
        const angle=direction*Math.PI/16,dx=Math.cos(angle),dy=Math.sin(angle);
        if(!clear(p.x+dx*radius,p.y+dy*radius))continue;
        let near=radius-2,far=radius;
        for(let i=0;i<5;i++){
          const middle=(near+far)/2;
          if(clear(p.x+dx*middle,p.y+dy*middle))far=middle;
          else near=middle;
        }
        if(far>=bestDistance)continue;
        // A car or player can block a landing next to a wall. Keep the slide on this side.
        let crossesWall=false;
        for(let distance=2;!startBlocked&&distance<far;distance+=2){
          if(blocked(p.x+dx*distance,p.y+dy*distance,9)){crossesWall=true;break}
        }
        if(crossesWall)continue;
        nearest={x:p.x+dx*far,y:p.y+dy*far};
        bestDistance=far;
      }
      if(nearest)return nearest;
    }
    return null;
  }
  function prepareJumpLanding(p,availableCars=cars,availablePlayers=players){
    if(p.jumpTime>0)return;
    if(!Number.isFinite(p.jumpSafeX))return;
    const clear=(x,y)=>jumpGroundClear(p,x,y,availableCars,availablePlayers);
    if(!clear(p.x,p.y)){
      const safe=clear(p.jumpSafeX,p.jumpSafeY)?{x:p.jumpSafeX,y:p.jumpSafeY}:null;
      const landing=nearestJumpLanding(p,clear)||safe;
      if(landing){
        p.landingSlide={x:p.x-landing.x,y:p.y-landing.y,start:performance.now()/1000};
        p.x=landing.x;p.y=landing.y;
      }
    }
    p.jumpSafeX=p.jumpSafeY=null;
  }
  function rememberJumpGround(p,availableCars=cars,availablePlayers=players){
    if(p.jumpTime>0&&jumpGroundClear(p,p.x,p.y,availableCars,availablePlayers)){p.jumpSafeX=p.x;p.jumpSafeY=p.y}
  }
  function walk(p,dx,dy,dt){prepareJumpLanding(p);if(p.stun>0){p.stun=Math.max(0,p.stun-dt);p.moveTime=0;p.walk=0;return}const len=Math.hypot(dx,dy);p.walk=0;if(len<.01){p.moveTime=0;return}p.facing=Math.atan2(dy,dx);const acceleration=Math.min(.5,p.moveTime||0)/.5,speed=PLAYER_RUN_SPEED*(.5+.5*acceleration),intensity=Math.min(1,len),startX=p.x,startY=p.y,nx=clamp(p.x+dx/len*speed*dt*intensity,14,world.w-14),ny=clamp(p.y+dy/len*speed*dt*intensity,14,world.h-14);if(!walkObstacle(p,nx,p.y)&&!blockedByPlayer(nx,p.y,10,p))p.x=nx;if(!walkObstacle(p,p.x,ny)&&!blockedByPlayer(p.x,ny,10,p))p.y=ny;rememberJumpGround(p);p.moveTime=Math.min(.5,(p.moveTime||0)+dt);p.walk=dt>0?Math.min(1,Math.hypot(p.x-startX,p.y-startY)/(PLAYER_RUN_SPEED*dt)):0;if(p.walk>0)p.bodyFacing=p.facing}
  // Steering is relative to the car's own heading; speed is not changed here.
  function steerCarRelative(c,steering,dt,spec){
    if(Math.abs(steering)<.01)return;
    const maxTurn=dt*spec.turnRate*(1.05+Math.min(Math.abs(c.speed)/150,1.4));
    c.angle+=clamp(steering,-1,1)*maxTurn;
  }
  function drive(p,dx,dy,dt){
    const c=p.car;if(!c||c.destroyed)return;
    const spec=vehicleSpec(c),previousSpeed=c.speed,throttle=clamp(-dy,0,1),brake=clamp(dy,0,1);
    if(p.stun>0){p.stun=Math.max(0,p.stun-dt);c.speed*=.92;updateBrakeLight(c,previousSpeed,dt,true);emitTireMarks(c,dt,false);return}
    if(brake>0){
      // The brake first stops forward travel, then reverses while held.
      c.speed=c.speed>0?Math.max(0,c.speed-brake*spec.acceleration*1.7*dt)
        :c.speed-brake*spec.acceleration*.7*dt;
    }else if(throttle>0){
      // Forward throttle also stops reverse travel before accelerating.
      c.speed=c.speed<0?Math.min(0,c.speed+throttle*spec.acceleration*1.7*dt)
        :c.speed+throttle*spec.acceleration*dt;
    }
    c.speed*=Math.pow(spec.drag,dt*60);
    c.speed=clamp(c.speed,-spec.reverseSpeed,spec.forwardSpeed);
    const previousAngle=c.angle;
    steerCarRelative(c,dx,dt,spec);
    const nx=c.x+Math.cos(c.angle)*c.speed*dt,ny=c.y+Math.sin(c.angle)*c.speed*dt;
    const hitCar=cars.find(other=>other!==c&&!other.destroyed&&carOverlapsAt(c,nx,ny,c.angle,other));
    const hitBuilding=vehicleBlockedAt(c,nx,ny,c.angle),atBoundary=vehicleAtBoundary(c,nx,ny,c.angle),collision=hitBuilding||hitCar||atBoundary;
    if(!collision){c.x=nx;c.y=ny;hitPedestrians(c)}
    else{
      const impact=Math.abs(c.speed);
      if(impact>=220){const contact=carImpactPoint(c,nx,ny,hitCar);emitImpactSparks(contact.x,contact.y,contact.angle)}
      c.angle=previousAngle;c.speed*=c.type===TRUCK_TYPE?-.12:-.22;
      damageCarFromCrash(c,impact);if(hitCar&&!hitCar.destroyed)damageCarFromCrash(hitCar,impact,c.driver);
    }
    updateBrakeLight(c,previousSpeed,dt,brake>0||collision);
    const hardBraking=(brake>0&&Math.abs(previousSpeed)>110)||(collision&&Math.abs(previousSpeed)>110&&Math.abs(c.speed)<Math.abs(previousSpeed)*.55);
    emitTireMarks(c,dt,hardBraking);
    p.x=c.x;p.y=c.y;p.facing=c.angle;p.bodyFacing=c.angle;p.walk=Math.abs(c.speed)>.5?1:0;
  }
  function updateMedkitTimers(dt){for(const medkit of medkits)if(!medkit.active){medkit.respawn=Math.max(0,medkit.respawn-dt);if(medkit.respawn===0)medkit.active=true}for(const flash of medkitFlashes)flash.age+=dt;medkitFlashes=medkitFlashes.filter(flash=>flash.age<MEDKIT_FLASH_LIFETIME)}
  function collectMedkits(active){for(const medkit of medkits){if(!medkit.active)continue;for(const p of active){if(p.alive===false||p.health>=p.maxHealth)continue;const q=pos(p);if(Math.hypot(q.x-medkit.x,q.y-medkit.y)>=MEDKIT_PICKUP_RADIUS)continue;p.health=Math.min(p.maxHealth,p.health+1);medkit.active=false;medkit.respawn=MEDKIT_RESPAWN_DELAY;if(medkitFlashes.length>=MAX_MEDKIT_FLASHES)medkitFlashes.shift();medkitFlashes.push({x:medkit.x,y:medkit.y,age:0});setGameStatus('heart',{id:p.id});lastUi='';renderPlayers();break}}}
  // Compact ground pickups are included in authoritative snapshots.
  function dropPistol(x,y,ammo=PISTOL_PICKUP_AMMO){
    if(!Number.isFinite(ammo)||ammo<=0)return;
    if(pistolDrops.length>=MAX_PISTOL_DROPS)pistolDrops.shift();
    pistolDrops.push([Math.round(x),Math.round(y),ammo]);
  }
  function collectPistolDrops(active){
    for(let i=pistolDrops.length-1;i>=0;i--){
      const drop=pistolDrops[i];
      for(const p of active){
        if(p.alive===false||p.car||Math.hypot(p.x-drop[0],p.y-drop[1])>=27)continue;
        const ammo=p.pistolAmmo||0,amount=Math.min(drop[2],PISTOL_MAX_AMMO-ammo);
        if(amount<=0)continue;
        p.pistolAmmo=ammo+amount;drop[2]-=amount;refreshAmmoHud();
        if(drop[2]===0){pistolDrops.splice(i,1);break}
      }
    }
  }
  function collectBazookaDrops(active){
    for(let i=bazookaDrops.length-1;i>=0;i--){
      const drop=bazookaDrops[i];
      for(const p of active){
        if(p.alive===false||p.car||(p.bazookaAmmo||0)>0)continue;
        const q=pos(p);
        if(Math.hypot(q.x-drop.x,q.y-drop.y)>=27)continue;
        p.bazookaAmmo=drop.ammo;bazookaDrops.splice(i,1);refreshAmmoHud();break;
      }
    }
  }
  function collectCashPacks(active){for(let i=cashPacks.length-1;i>=0;i--)for(const p of active){const q=pos(p),pack=cashPacks[i];if(Math.hypot(q.x-pack.x,q.y-pack.y)<27){if(cashPickupFlashes.length>=MAX_CASH_PICKUP_FLASHES)cashPickupFlashes.shift();cashPickupFlashes.push({x:pack.x,y:pack.y,age:0,lifetime:CASH_PICKUP_FLASH_LIFETIME});cashPacks.splice(i,1);p.cash=(p.cash||0)+pack.value;bonusScore+=pack.value;if(pack.convoy)awardScore(p,2,'convoys');refreshCompetitionHud();lastUi='';renderPlayers();break}}}
  function hitPedestrians(c){
    if(!running)return;
    const speed=Math.abs(c.speed);
    for(const p of livingPlayers()){
      if(p.car||(c.type!==TRUCK_TYPE&&c.type!=='tank'&&p.jumpTime>0&&jumpHeight(p)>=8)||!carBlocksCircle(c,p.x,p.y,10))continue;
      if(speed>=145||highSpeedImpact(c,speed))damagePlayer(p,p.maxHealth*vehicleImpactDamage(c,speed),'hitByCar',c.driver);
      if(p.alive)eject(p,c);
      lastUi='';renderPlayers();
    }
    const lethal=highSpeedImpact(c,speed);
    if(speed>=145||lethal){
      for(let i=guards.length-1;i>=0;i--){
        const g=guards[i];
        if(!carBlocksCircle(c,g.x,g.y,10)||(!lethal&&(g.carHitCooldown||0)>0))continue;
        g.hp=Math.max(0,g.hp-GUARD_MAX_HP*vehicleImpactDamage(c,speed));
        g.carHitCooldown=GUARD_CAR_HIT_COOLDOWN;
        g.stun=Math.max(g.stun||0,GUARD_CAR_HIT_COOLDOWN);
        g.walk=0;
        if(c.driver)raiseWantedLevel();
        if(g.hp<=0){
          addDeathRemain(g,g.x,g.y,true);
          guards.splice(i,1);
          setGameStatus('guardDown');
        }else setGameStatus('guardStunned');
      }
    }
    if(speed>=145||lethal)for(const owner of [...carDrivers]){
      if(owner.pursuitCarId!=null)continue;
      if(carBlocksCircle(c,owner.x,owner.y,10))damageCarDriver(owner,owner.maxHp*vehicleImpactDamage(c,speed));
    }
  }
  function resolvePlayerCollisions(){
    const active=livingPlayers();for(let pass=0;pass<4;pass++)for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++){
      const a=active[i],b=active[j];if(a.car||b.car)continue;let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);if(d>=20)continue;if(d<.001){const angle=((a.id*17+b.id*31)%360)*Math.PI/180;dx=Math.cos(angle);dy=Math.sin(angle);d=1}const push=(20-d)/2,ax=a.x-dx/d*push,ay=a.y-dy/d*push,bx=b.x+dx/d*push,by=b.y+dy/d*push,clear=(p,x,y,other)=>x>=14&&x<=world.w-14&&y>=14&&y<=world.h-14&&!blocked(x,y,10)&&!blockedByCar(x,y,10)&&!active.some(q=>q!==p&&q!==other&&!q.car&&Math.hypot(x-q.x,y-q.y)<20);const canA=clear(a,ax,ay,b),canB=clear(b,bx,by,a);if(canA&&canB){a.x=ax;a.y=ay;b.x=bx;b.y=by}else if(clear(a,a.x-dx/d*(20-d),a.y-dy/d*(20-d),b)){a.x-=dx/d*(20-d);a.y-=dy/d*(20-d)}else if(clear(b,b.x+dx/d*(20-d),b.y+dy/d*(20-d),a)){b.x+=dx/d*(20-d);b.y+=dy/d*(20-d)}
    }
  }
  function setFireHeld(p,isHeld){p.fireHeld=Boolean(isHeld)}
  function equippedWeapon(p){
    if(p.weapon==='pistol'&&p.pistolAmmo>0)return 'pistol';
    if(p.weapon==='knife'&&!p.car)return 'knife';
    if(p.bazookaAmmo>0)return 'bazooka';
    if(p.pistolAmmo>0)return 'pistol';
    return 'knife';
  }
  function cycleWeapon(p,steps=1){
    if(!running||!p||p.alive===false||p.car?.type==='tank')return;
    const choices=[];
    if(!p.car)choices.push('knife');
    if(p.pistolAmmo>0)choices.push('pistol');
    if(p.bazookaAmmo>0)choices.push('bazooka');
    if(choices.length<2)return;
    const current=choices.indexOf(equippedWeapon(p));
    p.weapon=choices[(current+steps%choices.length)%choices.length];
    refreshAmmoHud();
  }
  function swingKnife(p){
    if(p.car)return;
    p.fireCooldown=KNIFE_COOLDOWN;p.knifeSwing=.2;
    const angle=p.facing||0;
    let target=null,best=KNIFE_RANGE;
    function consider(actor,kind){
      const dx=actor.x-p.x,dy=actor.y-p.y,d=Math.hypot(dx,dy);
      if(d>=best||(d>0&&(dx*Math.cos(angle)+dy*Math.sin(angle))/d<.25)||!clearGuardSight(p.x,p.y,actor.x,actor.y))return;
      target={actor,kind};best=d;
    }
    for(const g of guards)consider(g,'guard');
    for(const owner of carDrivers)if(owner.pursuitCarId==null)consider(owner,'pedestrian');
    for(const other of players)if(other!==p&&other.alive!==false&&!other.car&&!(other.invuln>0))consider(other,'player');
    if(!target)return;
    const {actor,kind}=target;
    if(kind==='guard'){
      raiseWantedLevel();actor.hp-=KNIFE_DAMAGE;actor.stun=.8;
      if(actor.hp<=0){addDeathRemain(actor,actor.x,actor.y,true);guards=guards.filter(g=>g!==actor);setGameStatus('guardDown')}
      else setGameStatus('guardStunned');
    }else if(kind==='pedestrian'){damageCarDriver(actor,KNIFE_DAMAGE);raiseWantedLevel()}
    else damagePlayer(actor,KNIFE_DAMAGE,'knife',p);
  }
  function shoot(p){
    if(p.alive===false||!p.fireHeld||p.fireCooldown>0||p.stun>0)return;
    if(p.car?.type==='tank'){shootTank(p);return}
    const weapon=equippedWeapon(p);
    if(weapon==='knife'){swingKnife(p);return}
    const q=pos(p),angle=p.car?p.car.angle:p.facing,offset=p.car?vehicleSpec(p.car).halfLength+8:21;
    const x=q.x+Math.cos(angle)*offset,y=q.y+Math.sin(angle)*offset,rocket=weapon==='bazooka',speed=rocket?355:510;
    p.fireCooldown=rocket?.75:.24;p.recentGunfire=GUARD_GUNFIRE_MEMORY;p.shotThisTick=true;
    bullets.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,angle,rocket,owner:p.id,carOwnerId:p.car?p.car.id:null,life:rocket?1.8:1.15});
    if(rocket){p.bazookaAmmo--;if(p.bazookaAmmo===0)setGameStatus('bazookaEmpty',{id:p.id})}
    else p.pistolAmmo--;
    refreshAmmoHud();
    if(muzzleFlashes.length>=MAX_MUZZLE_FLASHES)muzzleFlashes.shift();muzzleFlashes.push({x,y,angle,age:0});
  }
  function shootTank(p){
    const c=p.car,angle=c.angle,x=c.x+Math.cos(angle)*36,y=c.y+Math.sin(angle)*36,speed=355;
    p.fireCooldown=1.2;p.recentGunfire=GUARD_GUNFIRE_MEMORY;p.shotThisTick=true;
    bullets.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,angle,rocket:true,owner:p.id,carOwnerId:c.id,life:1.8});
    if(muzzleFlashes.length>=MAX_MUZZLE_FLASHES)muzzleFlashes.shift();muzzleFlashes.push({x,y,angle,age:0});
  }
  function shootGuard(g,target){
    const angle=Math.atan2(target.y-g.y,target.x-g.x),x=g.x+Math.cos(angle)*18,y=g.y+Math.sin(angle)*18;
    g.fireCooldown=.85+rnd(0,.3);
    bullets.push({x,y,vx:Math.cos(angle)*480,vy:Math.sin(angle)*480,angle,owner:null,guardOwner:g.id,team:'guard',carOwnerId:null,life:1});
    if(muzzleFlashes.length>=MAX_MUZZLE_FLASHES)muzzleFlashes.shift();
    muzzleFlashes.push({x,y,angle,age:0});
  }
  function updateMuzzleFlashes(dt){for(const flash of muzzleFlashes)flash.age+=dt;muzzleFlashes=muzzleFlashes.filter(flash=>flash.age<MUZZLE_FLASH_LIFETIME)}
  function drawMuzzleFlashes(visible){for(const flash of muzzleFlashes){if(!visible(flash.x,flash.y,12))continue;const fade=Math.max(0,1-flash.age/MUZZLE_FLASH_LIFETIME);ctx.save();ctx.translate(flash.x,flash.y);ctx.rotate(flash.angle);ctx.globalAlpha=fade;ctx.fillStyle='#ff9d45';ctx.shadowColor='#ffd477';ctx.shadowBlur=10;ctx.beginPath();ctx.moveTo(-2,-4);ctx.lineTo(8,0);ctx.lineTo(-2,4);ctx.closePath();ctx.fill();ctx.fillStyle='#fff4c5';ctx.shadowBlur=5;ctx.beginPath();ctx.ellipse(0,0,2.6,1.7,0,0,Math.PI*2);ctx.fill();ctx.restore()}}
  function explodeCar(c,attacker=null){if(c.destroyed)return;const respawn={id:c.id,type:c.type||'car',traffic:Boolean(c.traffic),vertical:Boolean(c.trafficVertical),color:c.color,originX:c.x,originY:c.y,delay:.9};c.destroyed=true;
    // Occupied NPC vehicles contain real people too: leave a body on explosion.
    if(c.npcInside)addDeathRemain({id:-1000-c.id,color:'#c59b6e',facing:c.angle,bodyFacing:c.angle},c.x,c.y,true);
    for(const owner of [...carDrivers]){
      if(owner.pursuitCarId===c.id){
        owner.pursuitCarId=null;owner.vehicleTargetId=null;owner.x=c.x;owner.y=c.y;owner.stun=1;
      }
      if(owner.carId===c.id){
        addDeathRemain(owner,owner.x,owner.y,true);
        if(owner.pursuitCarId!=null)releasePursuitCar(owner);
      }
    }
    carDrivers=carDrivers.filter(owner=>owner.carId!==c.id);
    c.speed=0;c.driver=null;explosions.push({x:c.x,y:c.y,age:0,duration:.9,radius:112});
    cars=cars.filter(car=>car!==c);if(c.cashConvoy)dropCashFromConvoy(c);else if(c.type!==AMBULANCE_TYPE)carRespawns.push(respawn);
    for(const p of players){if(p.alive===false)continue;const wasInCar=p.car===c,q=wasInCar?{x:c.x,y:c.y}:pos(p),distance=Math.hypot(q.x-c.x,q.y-c.y);if(distance>112)continue;if(wasInCar){p.car=null;p.x=c.x;p.y=c.y}const damage=distance<48?3:distance<82?2:1;damagePlayer(p,damage,wasInCar?'carExplosion':'explosion',attacker);if(p.alive&&!p.car)eject(p,c)}
    setGameStatus(c.cashConvoy?'cashConvoyRobbed':'carExploded');lastUi='';renderPlayers()}

  function explodeRocket(rocket){
    const radius=ROCKET_BLAST_RADIUS,shooter=players.find(p=>p.id===rocket.owner);
    explosions.push({x:rocket.x,y:rocket.y,age:0,duration:.6,radius});
    for(const p of [...players]){
      if(p.alive===false)continue;
      const q=pos(p),distance=Math.hypot(q.x-rocket.x,q.y-rocket.y);
      if(distance<radius)damagePlayer(p,distance<radius*.4?2:1,'explosion',shooter);
    }
    for(const g of [...guards]){
      if(Math.hypot(g.x-rocket.x,g.y-rocket.y)>=radius)continue;
      raiseWantedLevel();g.hp-=2;g.stun=1;
      if(g.hp<=0){addDeathRemain(g,g.x,g.y,true);guards=guards.filter(other=>other!==g);setGameStatus('guardDown')}
    }
    for(const owner of [...carDrivers]){
      if(owner.pursuitCarId==null&&Math.hypot(owner.x-rocket.x,owner.y-rocket.y)<radius)
        damageCarDriver(owner,2);
    }
    for(const c of [...cars]){
      if(c.destroyed||c.id===rocket.carOwnerId||Math.hypot(c.x-rocket.x,c.y-rocket.y)>=radius)continue;
      c.health-=5;
      if(c.health<=0)explodeCar(c,shooter);
      else if(shooter)startCarEscape(c,shooter);
    }
  }
  // Standard Gamepad API: A=0, B=1, X=2, Y=3. Brake wins if both pedals are held.
  function samplePadInput(pad,inCar,triggerHeld=false,isPlayerOne=false){
    const pressed=i=>Boolean(pad?.buttons?.[i]?.pressed);
    let dx=pad?.axes?.[0]||0,dy=pad?.axes?.[1]||0;
    if(Math.abs(dx)<.17)dx=0;if(Math.abs(dy)<.17)dy=0;
    const a=pressed(0),b=pressed(1),x=pressed(2),y=pressed(3);
    const trigger=pad?.buttons?.[controllerFireButton],value=Math.max(trigger?.value||0,trigger?.pressed?1:0);
    const rt=triggerHeld?value>.2:value>=.35;
    if(inCar){if(b)dy=1;else if(a)dy=-1}
    return {dx,dy,a,b,x,y,rt,jump:!inCar&&a,fire:rt||y&&!isPlayerOne,action:x,switchWeapon:y&&isPlayerOne};
  }
  function pollPads(){
    const pads=navigator.getGamepads?navigator.getGamepads():[],seen=new Set();
    for(const index of new Set([...padALatch,...padXLatch]))if(!pads[index]||pads[index].connected===false){padALatch.delete(index);padXLatch.delete(index)}
    for(let i=0;i<pads.length;i++){
      const pad=pads[i];if(!pad||pad.connected===false)continue;
      const a=!!pad.buttons[0]?.pressed,x=!!pad.buttons[2]?.pressed;
      if(a&&!padALatch.has(i)){padALatch.add(i);if(!players.some(p=>p.source==='pad'&&p.sourceId===i))joinPad(i);}if(!a)padALatch.delete(i);
      if(x&&!padXLatch.has(i)){padXLatch.add(i);const p=players.find(q=>q.source==='pad'&&q.sourceId===i);if(p&&running)enterOrExit(p)}if(!x)padXLatch.delete(i);
      const p=players.find(q=>q.source==='pad'&&q.sourceId===i);if(!p)continue;
      seen.add(p.id);
      const input=samplePadInput(pad,Boolean(p.car),p.padTriggerHeld,p.id===1);
      if(input.switchWeapon&&!p.padWeaponSwitchHeld)cycleWeapon(p);
      p.padWeaponSwitchHeld=input.switchWeapon;
      p.padTriggerHeld=input.rt;p.padFireHeld=p.alive!==false&&input.fire;p.padJumpHeld=input.jump;
      p.padX=input.dx;p.padY=input.dy;
    }
    for(const p of players)if(p.source==='pad'&&!seen.has(p.id)){p.padFireHeld=false;p.padTriggerHeld=false;p.padJumpHeld=false;p.padWeaponSwitchHeld=false;p.padX=0;p.padY=0}
  }
  function update(dt){trafficLightTime+=dt;for(const c of cars)c.crashCooldown=Math.max(0,(c.crashCooldown||0)-dt);pollPads();for(const ex of explosions)ex.age+=dt;explosions=explosions.filter(ex=>ex.age<ex.duration);updateTireMarks(dt);updateImpactSparks(dt);updateCashPickupFlashes(dt);updateExitDustPuffs(dt);updateDeathRemains(dt);updateMuzzleFlashes(dt);updateGuardHitFlashes(dt);updateCarHitSparks(dt);advanceTraffic(dt);advanceCarRespawns(dt);updateWantedLevel(dt);updateMedkitTimers(dt);if(!running)return;updateCashConvoys(dt);
    updateAmbulances(dt);
    for(const p of players){p.invuln=Math.max(0,p.invuln-dt);p.damageCooldown=Math.max(0,p.damageCooldown-dt);p.fireCooldown=Math.max(0,p.fireCooldown-dt);p.knifeSwing=Math.max(0,(p.knifeSwing||0)-dt);p.recentGunfire=Math.max(0,(p.recentGunfire||0)-dt);if(p.alive===false){p.deathTimer=Math.max(0,p.deathTimer-dt);p.wastedTimer=Math.max(0,p.wastedTimer-dt);if(p.deathTimer<=0)respawnPlayer(p);continue}let dx=0,dy=0;if(p.source==='key'){const s=keysets[p.sourceId];dx=(held.has(s[3])?1:0)-(held.has(s[1])?1:0);dy=(held.has(s[2])?1:0)-(held.has(s[0])?1:0)}else if(p.source==='pad'){dx=p.padX||0;dy=p.padY||0}else if(p.source==='remote'){const fresh=performance.now()-(p.netInputAt||0)<350;dx=fresh?(p.netX||0):0;dy=fresh?(p.netY||0):0}if(p.id===1){const a=touchAxes();dx+=a.x;dy+=p.car?(Number(touchState.brake)-Number(touchState.forward)):a.y}stepJump(p,Boolean(p.source==='key'&&held.has(controls[p.sourceId].jump)||p.source==='pad'&&p.padJumpHeld||p.id===1&&touchState.jump||p.source==='remote'&&performance.now()-(p.netInputAt||0)<350&&p.netJump),dt);if(p.source==='remote')p.lastAppliedInputSeq=p.netInputSeq||0;if(p.id===1&&!dedicatedMode)p.gear='F';if(p.car){if(p.source==='key'||p.source==='pad'||p.source==='touch'||p.source==='remote'||p.id===1)drive(p,dx,dy,dt)}else{const chase=chaseCarInput(p,dx,dy);if(p.car)drive(p,0,0,dt);else walk(p,chase.dx,chase.dy,dt)};const keyFire=p.source==='key'&&held.has(controls[p.sourceId].fire);setFireHeld(p,keyFire||p.padFireHeld||Boolean(p.id===1&&touchState.fire)||(p.source==='remote'&&performance.now()-(p.netInputAt||0)<350&&p.netFire));if(p.fireHeld&&p.fireCooldown<=0)shoot(p)}
    updateCarDrivers(dt);
    const active=livingPlayers();resolvePlayerCollisions();
    for(const g of guards){
      g.stun=Math.max(0,g.stun-dt);g.carHitCooldown=Math.max(0,(g.carHitCooldown||0)-dt);g.fireCooldown=Math.max(0,(g.fireCooldown||0)-dt);g.walk=0;
      // Witnessing is guard-specific: hearing gunfire or seeing someone later
      // must not grant permission to shoot. Remember only observed shooters.
      if(!g.witnessedShots)g.witnessedShots=new Map();
      for(const [id,seconds] of g.witnessedShots){
        if(seconds<=dt)g.witnessedShots.delete(id);
        else g.witnessedShots.set(id,seconds-dt);
      }
      if(g.stun>0)continue;
      let seen=null,seenScore=Infinity,heard=null,heardDistance=GUARD_HEARING_RANGE;
      let witnessedTarget=null,witnessedDistance=GUARD_FIRE_RANGE;
      for(const p of active){
        const q=pos(p),distance=Math.hypot(q.x-g.x,q.y-g.y),recent=(p.recentGunfire||0)>0;
        if(recent&&distance<heardDistance){heard=p;heardDistance=distance}
        if(distance<=GUARD_SIGHT_RANGE&&clearGuardSight(g.x,g.y,q.x,q.y)){
          if(p.shotThisTick)g.witnessedShots.set(p.id,GUARD_WITNESSED_SHOT_SECONDS);
          const score=distance-(recent?130:0);
          if(score<seenScore){seen=p;seenScore=score}
          if((g.witnessedShots.get(p.id)||0)>0&&distance<witnessedDistance){
            witnessedTarget=p;witnessedDistance=distance;
          }
        }
      }
      const target=seen||heard;
      if(!target)continue;
      const q=pos(target),dx=q.x-g.x,dy=q.y-g.y,distance=Math.hypot(dx,dy)||1;
      g.facing=Math.atan2(dy,dx);
      if(witnessedTarget&&g.fireCooldown<=0)shootGuard(g,pos(witnessedTarget));
      const speed=distance<80?-35:distance>160?62:0;
      if(speed){const previousX=g.x,previousY=g.y,nx=g.x+dx/distance*speed*dt,ny=g.y+dy/distance*speed*dt;if(!blocked(nx,g.y,9))g.x=nx;if(!blocked(g.x,ny,9))g.y=ny;g.walk=Math.hypot(g.x-previousX,g.y-previousY)>.01?1:0}
    }
    // A gunshot can only be witnessed in the step when it was fired.
    for(const p of players)p.shotThisTick=false;
    for(let i=parcels.length-1;i>=0;i--)for(const p of active){const q=pos(p);if(Math.hypot(q.x-parcels[i].x,q.y-parcels[i].y)<24){parcels.splice(i,1);awardScore(p,1,'deliveries');addParcel();break}}collectCashPacks(active);collectMedkits(active);collectBazookaDrops(active);collectPistolDrops(active);collectAmbulanceRemains(active);
    for(let i=bullets.length-1;i>=0;i--){const b=bullets[i];b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;if(b.rocket){const impact=b.life<=0||blocked(b.x,b.y,5)||active.some(p=>p.alive!==false&&p.id!==b.owner&&Math.hypot(pos(p).x-b.x,pos(p).y-b.y)<16)||guards.some(g=>Math.hypot(g.x-b.x,g.y-b.y)<17)||cars.some(c=>!c.destroyed&&c.id!==b.carOwnerId&&carBlocksCircle(c,b.x,b.y,5));if(impact&&b.x>=0&&b.x<=world.w&&b.y>=0&&b.y<=world.h)explodeRocket(b);if(impact||b.x<0||b.x>world.w||b.y<0||b.y>world.h)bullets.splice(i,1);continue}if(b.life<=0||b.x<0||b.x>world.w||b.y<0||b.y>world.h||blocked(b.x,b.y,3)){bullets.splice(i,1);continue}let hit=false;for(const p of active){if(p.alive===false||(b.team!=='guard'&&p.id===b.owner)||p.invuln>0)continue;const q=pos(p),distance=Math.hypot(q.x-b.x,q.y-b.y);if(p.car&&distance<23)continue;if(distance<16){damagePlayer(p,1,'shot',b.team==='guard'?null:players.find(owner=>owner.id===b.owner));bullets.splice(i,1);hit=true;break}}if(hit)continue;for(let j=guards.length-1;b.team!=='guard'&&j>=0;j--){const g=guards[j];if(Math.hypot(g.x-b.x,g.y-b.y)<16){raiseWantedLevel();g.hp--;g.stun=.8;if(guardHitFlashes.length>=MAX_GUARD_HIT_FLASHES)guardHitFlashes.shift();guardHitFlashes.push({x:b.x,y:b.y,angle:Math.atan2(b.vy,b.vx),age:0});bullets.splice(i,1);if(g.hp<=0){addDeathRemain(g,g.x,g.y,true);guards.splice(j,1);setGameStatus('guardDown')}else setGameStatus('guardStunned');hit=true;break}}if(hit)continue;for(const owner of [...carDrivers]){if(b.team==='guard')break;if(owner.pursuitCarId!=null)continue;if(Math.hypot(owner.x-b.x,owner.y-b.y)<16){damageCarDriver(owner,1);if(guardHitFlashes.length>=MAX_GUARD_HIT_FLASHES)guardHitFlashes.shift();guardHitFlashes.push({x:b.x,y:b.y,angle:Math.atan2(b.vy,b.vx),age:0});bullets.splice(i,1);hit=true;break}}if(hit)continue;for(const c of cars){if(c.destroyed||c.id===b.carOwnerId)continue;if(Math.hypot(c.x-b.x,c.y-b.y)<23){const healthBefore=c.health;c.health--;if(c.health<healthBefore){if(carHitSparks.length>=MAX_CAR_HIT_SPARKS)carHitSparks.shift();carHitSparks.push({x:b.x,y:b.y,angle:Math.atan2(b.vy,b.vx),age:0})}bullets.splice(i,1);if(c.health<=0)explodeCar(c,b.team==='guard'?null:players.find(owner=>owner.id===b.owner));else{if(b.team!=='guard')startCarEscape(c,players.find(p=>p.id===b.owner));setGameStatus('carDamaged',{health:c.health,max:CAR_MAX_HEALTH})}hit=true;break}}if(hit)continue}
    if(winnerId!==null){finish();return}
  }
  function screen(x,y){return{x:(x-cam.x)*zoom+w()/2,y:(y-cam.y)*zoom+h()/2}}
  function trouserColor(color){return parseInt(String(color||'').slice(-2),16)%2===0?'#535a5d':'#74614d'}
  function drawPerson(p,t){
    const q=pos(p),moving=p.walk>.06,step=moving?Math.sin(t*15+p.id):0,player=p.vape===true,smoking=player&&!moving&&!p.fireHeld;
    const angle=Number.isFinite(p.facing)?p.facing:0,bodyFacing=Number.isFinite(p.bodyFacing)?p.bodyFacing:angle,dx=Math.cos(angle),dy=Math.sin(angle);
    const facing=Math.abs(dx)>Math.abs(dy)?(dx>0?'east':'west'):(dy>0?'south':'north');
    const face={
      north:{eyes:[[-1.7,-11.1],[1.7,-11.1]],nose:[0,-13.2],mouth:[0,-14],hair:[0,-6.4,4.1,2.1]},
      south:{eyes:[[-1.7,-7.2],[1.7,-7.2]],nose:[0,-5.2],mouth:[0,-4.1],hair:[0,-11.6,4.1,2.1]},
      east:{eyes:[[2.5,-10.6],[2.5,-7.4]],nose:[4.2,-9],mouth:[5,-9],hair:[-1.8,-9,2.3,4.1]},
      west:{eyes:[[-2.5,-10.6],[-2.5,-7.4]],nose:[-4.2,-9],mouth:[-5,-9],hair:[1.8,-9,2.3,4.1]}
    }[facing];
    ctx.save();ctx.translate(q.x,q.y);if(p.invuln>0&&Math.floor(t*14)%2===0)ctx.globalAlpha=.5;
    ctx.lineCap='round';ctx.lineJoin='round';

    // Body and limbs keep their own heading. The head, face details and aim below
    // use `p.facing`, so idle aiming cannot twist the torso or limbs.
    ctx.save();if(player)ctx.rotate(bodyFacing+Math.PI/2);
    const armSwing=moving?step*2.6:0;
    const arms=[
      {start:[-6.8,-5.5],end:[-6.8,3.2+armSwing]},
      {start:[6.8,-5.5],end:[6.8,3.2-armSwing]}
    ];
    // Straight arms stay along the torso sides and swing forward/back in opposite phases.
    for(const arm of arms){
      const [sx,sy]=arm.start,[ex,ey]=arm.end;
      // Sleeves use the exact same fill colour as the torso, with only a fine outline.
      ctx.strokeStyle='#101719';ctx.lineWidth=5.6;
      ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(ex,ey);ctx.stroke();
      ctx.strokeStyle=p.color;ctx.lineWidth=4.5;
      ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(ex,ey);ctx.stroke();
      ctx.fillStyle='#e7bd98';ctx.beginPath();ctx.arc(ex,ey,1.7,0,Math.PI*2);ctx.fill();
    }
    // Legs only extend beyond the torso while walking; at rest they tuck underneath it.
    const legSwing=moving?step*3.5:0;
    const legs=[
      // Keep the legs separated left/right, and swing each foot along the
      // character's forward/back axis. Opposite phases create an alternating gait.
      [[-3,1],[-4,5+legSwing*.45],[-4,10+legSwing]],
      [[3,1],[4,5-legSwing*.45],[4,10-legSwing]]
    ];
    for(const leg of legs){
      const [[sx,sy],[kx,ky],[ex,ey]]=leg;
      ctx.strokeStyle='#101719';ctx.lineWidth=5.2;
      ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(kx,ky);ctx.lineTo(ex,ey);ctx.stroke();
      ctx.strokeStyle=trouserColor(p.color);ctx.lineWidth=3.9;
      ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(kx,ky);ctx.lineTo(ex,ey);ctx.stroke();
      ctx.fillStyle='#2b3333';ctx.beginPath();ctx.ellipse(ex,ey,2.8,1.7,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#d2c1a4';ctx.beginPath();ctx.ellipse(ex+Math.sign(ex)*.6,ey,1.3,1,0,0,Math.PI*2);ctx.fill();
    }

    // Rotate the capsule crosswise to the body heading while keeping its center under the head.
    ctx.save();ctx.rotate(Math.PI/2);
    const capsulePath=(halfWidth,halfLength)=>{ctx.beginPath();ctx.moveTo(-halfWidth,-halfLength+halfWidth);ctx.lineTo(-halfWidth,halfLength-halfWidth);ctx.quadraticCurveTo(-halfWidth,halfLength,0,halfLength);ctx.quadraticCurveTo(halfWidth,halfLength,halfWidth,halfLength-halfWidth);ctx.lineTo(halfWidth,-halfLength+halfWidth);ctx.quadraticCurveTo(halfWidth,-halfLength,0,-halfLength);ctx.quadraticCurveTo(-halfWidth,-halfLength,-halfWidth,-halfLength+halfWidth);ctx.closePath()};
    ctx.fillStyle='#0c1112';ctx.strokeStyle='#070b0c';ctx.lineWidth=1.5;capsulePath(5.5,10.5);ctx.fill();ctx.stroke();
    ctx.fillStyle=p.color;capsulePath(4.55,9.4);ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.3)';ctx.beginPath();ctx.ellipse(-2.1,-5.1,1.25,3.1,-.18,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#182121';ctx.fillRect(-2.8,2.2,5.6,1);ctx.fillStyle='rgba(7,13,14,.58)';ctx.fillRect(-1.8,4.2,3.6,1.2);
    ctx.restore();
    ctx.restore();

    // Place the head over the torso center; face cues still distinguish four directions.
    ctx.save();ctx.translate(0,8);
    ctx.fillStyle='#111718';ctx.strokeStyle='#070b0c';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(0,-9,5.2,5.5,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.fillStyle='#d6ad88';ctx.beginPath();ctx.ellipse(0,-9,4.35,4.65,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#272b29';ctx.beginPath();ctx.ellipse(...face.hair,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#d6ad88';ctx.beginPath();
    if(facing==='north')ctx.ellipse(0,-10.9,3.5,2.45,0,0,Math.PI*2);
    else if(facing==='south')ctx.ellipse(0,-7.1,3.5,2.45,0,0,Math.PI*2);
    else if(facing==='east')ctx.ellipse(1.8,-9,2.7,3.8,0,0,Math.PI*2);
    else ctx.ellipse(-1.8,-9,2.7,3.8,0,0,Math.PI*2);
    ctx.fill();
    ctx.fillStyle='#202322';for(const [ex,ey]of face.eyes){ctx.beginPath();ctx.arc(ex,ey,.62,0,Math.PI*2);ctx.fill()}
    ctx.fillStyle='#f0c69e';ctx.beginPath();ctx.arc(face.nose[0],face.nose[1],.85,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#765448';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(face.mouth[0]-.8,face.mouth[1]);ctx.lineTo(face.mouth[0]+.8,face.mouth[1]);ctx.stroke();
    ctx.restore();

    if(!player||p.fireHeld){
      ctx.save();ctx.rotate(angle);ctx.fillStyle='#192120';ctx.fillRect(7,-1.25,8,2.5);ctx.fillStyle='#b9c2c0';ctx.fillRect(9,-.55,5,1.1);ctx.fillStyle='#252c2b';ctx.fillRect(7.5,1,2.2,3);ctx.restore();
    }
    if(smoking){
      ctx.save();ctx.translate(0,8);
      const mouth=face.mouth;ctx.save();ctx.translate(mouth[0],mouth[1]);ctx.rotate(angle);
      ctx.fillStyle='#202727';ctx.fillRect(0,-1,5,2);ctx.fillStyle='#c7d0c9';ctx.fillRect(3.6,-.8,1.2,1.6);ctx.fillStyle='#f1bd67';ctx.beginPath();ctx.arc(5,.1,.75,0,Math.PI*2);ctx.fill();ctx.restore();
      const smokeX=mouth[0]+dx*5.5,smokeY=mouth[1]+dy*5.5,baseAlpha=ctx.globalAlpha;
      for(let i=0;i<3;i++){const rise=(t*1.5+i*1.24+p.id*.37)%3.3,alpha=.2*(1-rise/3.6);ctx.globalAlpha=baseAlpha*alpha;ctx.fillStyle='#d4ddd8';ctx.beginPath();ctx.ellipse(smokeX+Math.sin(t*1.3+i)*1.1,smokeY-rise*1.6,1+rise*.22,1.25+rise*.22,.18,0,Math.PI*2);ctx.fill()}
      ctx.globalAlpha=baseAlpha;
      ctx.restore();
    }
    ctx.restore();
  }
  function cacheStaticSprites(){
    const mainContext=ctx,scale=Math.min(devicePixelRatio||1,2),pad=12;
    try{
      for(const b of buildings){const sprite=document.createElement('canvas');sprite.width=Math.ceil((b.w+pad*2)*scale);sprite.height=Math.ceil((b.h+pad*2)*scale);ctx=sprite.getContext('2d');ctx.setTransform(scale,0,0,scale,0,0);ctx.translate(-b.x+pad,-b.y+pad);drawHouse(b,0);b.sprite=sprite;b.spriteX=b.x-pad;b.spriteY=b.y-pad}
      for(const c of courtyards)cacheSprite(c,c.x,c.y,c.x+c.w,c.y+c.h,2,()=>drawCourtyard(c,0));
      for(const a of alleys)cacheSprite(a,a.minX,a.minY,a.maxX,a.maxY,a.width/2+3,()=>drawAlley(a));
      const glowCanvas=document.createElement('canvas');glowCanvas.width=glowCanvas.height=256;const glowContext=glowCanvas.getContext('2d'),glow=glowContext.createRadialGradient(128,128,2,128,128,128);glow.addColorStop(0,'rgba(255,213,137,.23)');glow.addColorStop(.26,'rgba(255,183,105,.11)');glow.addColorStop(1,'rgba(255,158,87,0)');glowContext.fillStyle=glow;glowContext.beginPath();glowContext.arc(128,128,128,0,Math.PI*2);glowContext.fill();streetGlowSprite=glowCanvas;
      const lampScale=Math.min(devicePixelRatio||1,2),lampCanvas=document.createElement('canvas');lampCanvas.width=76*lampScale;lampCanvas.height=64*lampScale;ctx=lampCanvas.getContext('2d');ctx.setTransform(lampScale,0,0,lampScale,0,0);ctx.translate(38,32);drawStreetLampDetails(0,0);streetLampDetailSprite=lampCanvas;
    }finally{ctx=mainContext}
  }
  function cacheSprite(object,minX,minY,maxX,maxY,padding,draw){const scale=Math.min(devicePixelRatio||1,2),width=maxX-minX+padding*2,height=maxY-minY+padding*2,sprite=document.createElement('canvas');sprite.width=Math.ceil(width*scale);sprite.height=Math.ceil(height*scale);const mainContext=ctx;try{ctx=sprite.getContext('2d');ctx.setTransform(scale,0,0,scale,0,0);ctx.translate(-minX+padding,-minY+padding);draw()}finally{ctx=mainContext}object.sprite=sprite;object.spriteX=minX-padding;object.spriteY=minY-padding;object.spriteW=sprite.width/scale;object.spriteH=sprite.height/scale}
  function drawCachedSprite(object){ctx.drawImage(object.sprite,object.spriteX,object.spriteY,object.spriteW,object.spriteH)}
  function drawStreetLampDetails(x,y){
      const reflection=ctx.createLinearGradient(x-38,y+18,x+38,y+18);reflection.addColorStop(0,'rgba(119,205,215,0)');reflection.addColorStop(.5,'rgba(152,221,219,.14)');reflection.addColorStop(1,'rgba(119,205,215,0)');ctx.fillStyle=reflection;ctx.fillRect(x-38,y+16,76,4);
      ctx.strokeStyle='#59615b';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y+4);ctx.lineTo(x,y-15);ctx.stroke();ctx.fillStyle='#e9d495';ctx.shadowColor='#ffd78e';ctx.shadowBlur=13;ctx.beginPath();ctx.arc(x,y-16,3.2,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
  }
  function drawStreetLamps(left,top,viewW,viewH,t){
    for(let xi=0;xi<roadsX.length;xi++)for(let yi=0;yi<roadsY.length;yi++){
      const x=roadsX[xi]+(xi%2?-43:43),y=roadsY[yi]+(yi%2?-43:43);if(x<left-130||x>left+viewW+130||y<top-130||y>top+viewH+130)continue;
      const pulse=.92+Math.sin(t*1.5+xi*1.9+yi)*.08,size=256*pulse;
      if(streetGlowSprite)ctx.drawImage(streetGlowSprite,x-size/2,y-size/2,size,size);
      if(streetLampDetailSprite)ctx.drawImage(streetLampDetailSprite,x-38,y-32,76,64);
      else{ctx.save();drawStreetLampDetails(x,y);ctx.restore()}
    }
  }
  function drawStreetNetwork(){
    ctx.fillStyle='#182326';ctx.fillRect(0,0,world.w,world.h);
    for(let i=0;i<roadsX.length;i++){
      const x=roadsX[i];ctx.fillStyle='#424947';ctx.fillRect(x-roadWidth/2-8,0,roadWidth+16,world.h);ctx.fillStyle='#263034';ctx.fillRect(x-roadWidth/2,0,roadWidth,world.h);
      ctx.strokeStyle='rgba(188,177,143,.28)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x-roadWidth/2+4,0);ctx.lineTo(x-roadWidth/2+4,world.h);ctx.moveTo(x+roadWidth/2-4,0);ctx.lineTo(x+roadWidth/2-4,world.h);ctx.stroke();
      if(i%2===0){ctx.strokeStyle='rgba(211,200,167,.32)';ctx.lineWidth=1.5;ctx.setLineDash([19,29]);ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,world.h);ctx.stroke();ctx.setLineDash([])}
    }
    for(let i=0;i<roadsY.length;i++){
      const y=roadsY[i];ctx.fillStyle='#424947';ctx.fillRect(0,y-roadWidth/2-8,world.w,roadWidth+16);ctx.fillStyle='#263034';ctx.fillRect(0,y-roadWidth/2,world.w,roadWidth);
      ctx.strokeStyle='rgba(188,177,143,.28)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,y-roadWidth/2+4);ctx.lineTo(world.w,y-roadWidth/2+4);ctx.moveTo(0,y+roadWidth/2-4);ctx.lineTo(world.w,y+roadWidth/2-4);ctx.stroke();
      if(i===2||i===4){ctx.strokeStyle='rgba(211,200,167,.32)';ctx.lineWidth=1.5;ctx.setLineDash([19,29]);ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(world.w,y);ctx.stroke();ctx.setLineDash([])}
    }
    drawCrosswalks();
    drawTrafficStopLines();
  }
  function drawTrafficStopLines(){
    ctx.save();ctx.strokeStyle='rgba(230,229,205,.42)';ctx.lineWidth=3;
    for(const x of roadsX)for(const y of roadsY){
      const edge=roadWidth/2+4;
      for(const side of [-1,1]){
        ctx.beginPath();ctx.moveTo(x+side*edge,y-roadWidth/2+4);
        ctx.lineTo(x+side*edge,y+roadWidth/2-4);ctx.stroke();
        ctx.beginPath();ctx.moveTo(x-roadWidth/2+4,y+side*edge);
        ctx.lineTo(x+roadWidth/2-4,y+side*edge);ctx.stroke();
      }
    }
    ctx.restore();
  }
  function drawTrafficLights(visible){
    const distance=roadWidth/2+12;
    const heads=[[-1,-1,'horizontal'],[1,1,'horizontal'],[1,-1,'vertical'],[-1,1,'vertical']];
    for(let xi=0;xi<roadsX.length;xi++)for(let yi=0;yi<roadsY.length;yi++){
      const x=roadsX[xi],y=roadsY[yi];if(!visible(x,y,85))continue;
      for(const [sideX,sideY,axis] of heads){
        const px=x+sideX*distance,py=y+sideY*distance;
        const active=trafficLights.signal(xi,yi,trafficLightTime,axis);
        ctx.save();ctx.translate(px,py);
        ctx.strokeStyle='#879288';ctx.lineWidth=2;
        ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-18);ctx.stroke();
        ctx.fillStyle='#111818';ctx.fillRect(-5,-31,10,18);
        for(const [i,color,glow] of [[0,'#ff5447','#ff4d3f'],[1,'#f3bc46','#ffbf43'],[2,'#60dd8b','#52f2a0']]){
          const isOn=active===['red','amber','green'][i];
          ctx.fillStyle=isOn?color:'#303936';
          ctx.shadowColor=isOn?glow:'transparent';ctx.shadowBlur=isOn?9:0;
          ctx.beginPath();ctx.arc(0,-28+i*6,2.3,0,Math.PI*2);ctx.fill();
        }
        ctx.restore();
      }
    }
  }
  function drawCrosswalks(){ctx.save();ctx.fillStyle='rgba(204,198,174,.21)';for(const crossing of crosswalks)for(const side of [-1,1])for(let stripe=0;stripe<4;stripe++){const offset=side*(34+stripe*7);if(crossing.vertical)ctx.fillRect(crossing.x-roadWidth/2+9,crossing.y+offset,roadWidth-18,4);else ctx.fillRect(crossing.x+offset,crossing.y-roadWidth/2+9,4,roadWidth-18)}ctx.restore()}
  function drawAlley(alley){
    const path=()=>{ctx.beginPath();ctx.moveTo(...alley.points[0]);for(let i=1;i<alley.points.length;i++)ctx.lineTo(...alley.points[i])};
    ctx.lineCap='round';ctx.lineJoin='round';path();ctx.strokeStyle='#414a46';ctx.lineWidth=alley.width+8;ctx.stroke();path();ctx.strokeStyle='#222d31';ctx.lineWidth=alley.width;ctx.stroke();
    path();ctx.strokeStyle='rgba(177,167,136,.2)';ctx.lineWidth=1.4;ctx.setLineDash([5,11]);ctx.stroke();ctx.setLineDash([]);ctx.lineCap='butt';ctx.lineJoin='miter';
  }
  function drawCourtyard(c,t){
    ctx.fillStyle=c.kind==='garden'?'#172b26':'#202a2d';ctx.fillRect(c.x,c.y,c.w,c.h);ctx.strokeStyle='rgba(189,174,137,.3)';ctx.lineWidth=2;ctx.strokeRect(c.x+2,c.y+2,c.w-4,c.h-4);
    if(c.kind==='garden'){
      for(let i=0;i<3;i++){const x=c.x+c.w*(.23+i*.27),y=c.y+c.h*(i%2?.34:.68);ctx.fillStyle='#111b19';ctx.beginPath();ctx.arc(x+2,y+3,9,0,Math.PI*2);ctx.fill();const glow=ctx.createRadialGradient(x,y,1,x,y,19);glow.addColorStop(0,'rgba(91,173,113,.34)');glow.addColorStop(1,'rgba(91,173,113,0)');ctx.fillStyle=glow;ctx.beginPath();ctx.arc(x,y,19,0,Math.PI*2);ctx.fill();ctx.fillStyle='#315a43';ctx.beginPath();ctx.arc(x,y,7,0,Math.PI*2);ctx.fill();ctx.fillStyle='#8da66a';ctx.beginPath();ctx.arc(x-2,y-2,2,0,Math.PI*2);ctx.fill()}
    }else{
      ctx.strokeStyle='rgba(174,166,145,.13)';ctx.lineWidth=1;for(let x=c.x+10;x<c.x+c.w;x+=15){ctx.beginPath();ctx.moveTo(x,c.y+4);ctx.lineTo(x,c.y+c.h-4);ctx.stroke()}for(let y=c.y+10;y<c.y+c.h;y+=15){ctx.beginPath();ctx.moveTo(c.x+4,y);ctx.lineTo(c.x+c.w-4,y);ctx.stroke()}
    }
    for(const f of gardenFences(c)){ctx.fillStyle='#283630';ctx.fillRect(f.x,f.y,f.w,f.h);ctx.fillStyle='#a4b49b';ctx.fillRect(f.x,f.y,f.w>f.h?f.w:2,f.w>f.h?2:f.h);}
    const benchX=c.x+c.w*.72,benchY=c.y+c.h*.48;ctx.fillStyle='#493b30';ctx.fillRect(benchX-10,benchY-2,20,5);ctx.fillStyle='#b7a07c';ctx.fillRect(benchX-10,benchY-4,20,2);
  }
  // Paving and furniture do not depend on time; rasterize on first visibility.
  function cachePlaza(p){
    const margin=6,scale=Math.min(devicePixelRatio||1,2),surface=document.createElement('canvas');
    surface.width=Math.ceil((p.w+margin*2)*scale);surface.height=Math.ceil((p.h+margin*2)*scale);
    const previous=ctx;ctx=surface.getContext('2d');
    if(!ctx){ctx=previous;return false}
    try{
      ctx.scale(scale,scale);ctx.translate(-p.x+margin,-p.y+margin);
    ctx.fillStyle='#515451';ctx.fillRect(p.x-5,p.y-5,p.w+10,p.h+10);ctx.fillStyle=p.kind==='market'?'#303a3c':'#35403d';ctx.fillRect(p.x,p.y,p.w,p.h);ctx.strokeStyle='rgba(220,199,150,.42)';ctx.lineWidth=2;ctx.strokeRect(p.x+2,p.y+2,p.w-4,p.h-4);
    ctx.strokeStyle='rgba(206,194,164,.23)';ctx.lineWidth=1;for(let x=p.x+12;x<p.x+p.w;x+=16){ctx.beginPath();ctx.moveTo(x,p.y+4);ctx.lineTo(x,p.y+p.h-4);ctx.stroke()}for(let y=p.y+12;y<p.y+p.h;y+=16){ctx.beginPath();ctx.moveTo(p.x+4,y);ctx.lineTo(p.x+p.w-4,y);ctx.stroke()}
      if(p.kind!=='market'){
      for(const [x,y] of [[p.x+17,p.y+17],[p.x+p.w-17,p.y+p.h-18]]){ctx.fillStyle='#111b18';ctx.beginPath();ctx.arc(x+1,y+2,8,0,Math.PI*2);ctx.fill();ctx.fillStyle='#315944';ctx.beginPath();ctx.arc(x,y,7,0,Math.PI*2);ctx.fill();ctx.fillStyle='#96b577';ctx.beginPath();ctx.arc(x-2,y-2,2,0,Math.PI*2);ctx.fill()}
      ctx.fillStyle='#574536';ctx.fillRect(p.x+p.w*.48,p.y+p.h*.68,24,4);ctx.fillStyle='#d2b278';ctx.fillRect(p.x+p.w*.48,p.y+p.h*.64,24,3);
      }
    }finally{ctx=previous}
    p.staticSprite=surface;p.staticSpriteScale=scale;
    return true;
  }
  function drawPlaza(p,t){
    const cached=p.staticSprite||cachePlaza(p);
    if(p.staticSprite)ctx.drawImage(p.staticSprite,p.x-6,p.y-6,p.staticSprite.width/p.staticSpriteScale,p.staticSprite.height/p.staticSpriteScale);
    else {
    ctx.fillStyle='#515451';ctx.fillRect(p.x-5,p.y-5,p.w+10,p.h+10);ctx.fillStyle=p.kind==='market'?'#303a3c':'#35403d';ctx.fillRect(p.x,p.y,p.w,p.h);ctx.strokeStyle='rgba(220,199,150,.42)';ctx.lineWidth=2;ctx.strokeRect(p.x+2,p.y+2,p.w-4,p.h-4);
    ctx.strokeStyle='rgba(206,194,164,.23)';ctx.lineWidth=1;for(let x=p.x+12;x<p.x+p.w;x+=16){ctx.beginPath();ctx.moveTo(x,p.y+4);ctx.lineTo(x,p.y+p.h-4);ctx.stroke()}for(let y=p.y+12;y<p.y+p.h;y+=16){ctx.beginPath();ctx.moveTo(p.x+4,y);ctx.lineTo(p.x+p.w-4,y);ctx.stroke()}
    }
    if(p.kind==='market'){
      const fx=p.x+p.w/2,fy=p.y+p.h/2+3,r=Math.min(p.w,p.h)*.22,water=ctx.createRadialGradient(fx-4,fy-5,2,fx,fy,r+8);water.addColorStop(0,'#84d8ce');water.addColorStop(.55,'#397f84');water.addColorStop(1,'#1b444b');ctx.fillStyle='#85806b';ctx.beginPath();ctx.arc(fx,fy,r+7,0,Math.PI*2);ctx.fill();ctx.fillStyle=water;ctx.shadowColor='#6bd7d0';ctx.shadowBlur=12;ctx.beginPath();ctx.arc(fx,fy,r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle='#c7cfaa';ctx.lineWidth=2;ctx.beginPath();ctx.arc(fx,fy,r+3,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#e7d89d';ctx.beginPath();ctx.arc(fx,fy,3+Math.sin(t*2)*.8,0,Math.PI*2);ctx.fill();
      for(let i=0;i<3;i++){const x=p.x+p.w*(.22+i*.28),y=p.y+p.h*.2;ctx.fillStyle='#634039';ctx.fillRect(x-10,y-7,20,14);ctx.fillStyle=i%2?'#b85849':'#d19b55';ctx.fillRect(x-11,y-9,22,4);ctx.fillStyle='#f5c971';ctx.shadowColor='#ffc85e';ctx.shadowBlur=7;ctx.fillRect(x-7,y-4,14,2);ctx.shadowBlur=0}
      ctx.fillStyle='#f1d799';ctx.shadowColor='#ffc864';ctx.shadowBlur=8;ctx.font='bold 8px "DM Mono",monospace';ctx.textAlign='center';ctx.fillText(translate('market'),p.x+p.w/2,p.y+p.h-8);ctx.shadowBlur=0;
    }else if(!cached){
      for(const [x,y] of [[p.x+17,p.y+17],[p.x+p.w-17,p.y+p.h-18]]){ctx.fillStyle='#111b18';ctx.beginPath();ctx.arc(x+1,y+2,8,0,Math.PI*2);ctx.fill();ctx.fillStyle='#315944';ctx.beginPath();ctx.arc(x,y,7,0,Math.PI*2);ctx.fill();ctx.fillStyle='#96b577';ctx.beginPath();ctx.arc(x-2,y-2,2,0,Math.PI*2);ctx.fill()}
      ctx.fillStyle='#574536';ctx.fillRect(p.x+p.w*.48,p.y+p.h*.68,24,4);ctx.fillStyle='#d2b278';ctx.fillRect(p.x+p.w*.48,p.y+p.h*.64,24,3);
    }
  }
  function drawHouse(b,t){
    ctx.fillStyle='#0b1113';ctx.fillRect(b.x+4,b.y+5,b.w,b.h);ctx.fillStyle=['#66594b','#6b5b4d','#53595a','#75624e'][b.tone];ctx.fillRect(b.x,b.y,b.w,b.h);
    const x=b.x+3,y=b.y+3,w=b.w-6,h=b.h-6,horizontal=w>=h;ctx.fillStyle=b.roof;ctx.fillRect(x,y,w,h);
    if(horizontal){
      ctx.fillStyle='rgba(10,14,17,.25)';ctx.fillRect(x,y,w,h/2);ctx.fillStyle='rgba(197,145,111,.1)';ctx.fillRect(x,y+h/2,w,h/2);
      ctx.strokeStyle='rgba(207,175,142,.22)';ctx.lineWidth=1;for(let yy=y+8;yy<y+h;yy+=9){ctx.beginPath();ctx.moveTo(x+2,yy);ctx.lineTo(x+w-2,yy);ctx.stroke()}for(let xx=x+10;xx<x+w;xx+=14){ctx.beginPath();ctx.moveTo(xx,y+2);ctx.lineTo(xx,y+h/2-2);ctx.moveTo(xx-5,y+h/2+2);ctx.lineTo(xx-5,y+h-2);ctx.stroke()}
      ctx.strokeStyle='#9a7660';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x+2,y+h/2);ctx.lineTo(x+w-2,y+h/2);ctx.stroke();
    }else{
      ctx.fillStyle='rgba(10,14,17,.25)';ctx.fillRect(x,y,w/2,h);ctx.fillStyle='rgba(197,145,111,.1)';ctx.fillRect(x+w/2,y,w/2,h);
      ctx.strokeStyle='rgba(207,175,142,.22)';ctx.lineWidth=1;for(let xx=x+8;xx<x+w;xx+=9){ctx.beginPath();ctx.moveTo(xx,y+2);ctx.lineTo(xx,y+h-2);ctx.stroke()}for(let yy=y+10;yy<y+h;yy+=14){ctx.beginPath();ctx.moveTo(x+2,yy);ctx.lineTo(x+w/2-2,yy);ctx.moveTo(x+w/2+2,yy-5);ctx.lineTo(x+w-2,yy-5);ctx.stroke()}
      ctx.strokeStyle='#9a7660';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x+w/2,y+2);ctx.lineTo(x+w/2,y+h-2);ctx.stroke();
    }
    if(b.chimney){ctx.fillStyle='#291f1d';ctx.fillRect(x+w*.68-2,y+h*.28-3,10,12);ctx.fillStyle='#a27661';ctx.fillRect(x+w*.68-3,y+h*.28-4,12,3);ctx.fillStyle='#b3a28b';ctx.fillRect(x+w*.68,y+h*.28-2,5,5)}
    const glow=()=>{ctx.shadowColor='#ffc96c';ctx.shadowBlur=8;ctx.fillStyle='#f6d18a'};
    if(b.front==='north'||b.front==='south'){
      const wy=b.front==='north'?b.y+3:b.y+b.h-7;glow();ctx.fillRect(b.x+b.w*.23,wy,7,4);ctx.fillRect(b.x+b.w*.67,wy,7,4);ctx.shadowBlur=0;ctx.fillStyle='#422f27';ctx.fillRect(b.x+b.w*.46,wy-1,7,7);
      if(b.awning){ctx.fillStyle='#a95548';ctx.fillRect(b.x+b.w*.38,b.front==='north'?b.y-5:b.y+b.h+1,b.w*.24,5);ctx.fillStyle='#e7c17c';ctx.fillRect(b.x+b.w*.38,b.front==='north'?b.y-5:b.y+b.h+1,b.w*.08,5)}
    }else{
      const wx=b.front==='west'?b.x+3:b.x+b.w-7;glow();ctx.fillRect(wx,b.y+b.h*.23,4,7);ctx.fillRect(wx,b.y+b.h*.67,4,7);ctx.shadowBlur=0;ctx.fillStyle='#422f27';ctx.fillRect(wx-1,b.y+b.h*.46,7,7);
      if(b.awning){ctx.fillStyle='#a95548';ctx.fillRect(b.front==='west'?b.x-5:b.x+b.w+1,b.y+b.h*.38,5,b.h*.24);ctx.fillStyle='#e7c17c';ctx.fillRect(b.front==='west'?b.x-5:b.x+b.w+1,b.y+b.h*.38,5,b.h*.08)}
    }
    if(b.kind==='shop'){ctx.fillStyle=b.tone%2?'#50d2d0':'#ef8e71';ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=9;ctx.fillRect(b.x+b.w*.3,b.y+b.h*.3,Math.min(17,b.w*.4),3);ctx.shadowBlur=0}
  }
  function shopNeonFlicker(shop,t){
    const seed=Math.abs(Math.sin(shop.x*12.9898+shop.y*78.233)*43758.5453),offset=(seed-Math.floor(seed))*16.8,phase=(t+offset)%18;
    if(phase<.08)return .18;if(phase<.15)return .72;if(phase<.22)return .12;if(phase<.31)return .48;if(phase<.38)return .08;return 0;
  }
  function drawShopNeonOverlays(shops,t){
    for(const shop of shops){const alpha=shopNeonFlicker(shop,t);if(alpha<=0)continue;const color=shop.tone%2?'#50d2d0':'#ef8e71',x=shop.x+shop.w*.3,y=shop.y+shop.h*.3,width=Math.min(17,shop.w*.4);ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle=color;ctx.shadowColor=color;ctx.shadowBlur=8+alpha*13;ctx.fillRect(x-1,y-1,width+2,5);ctx.restore()}
  }
  function drawHospitalYard(){if(!hospital)return;const y=hospital.yard;ctx.fillStyle='#59605a';ctx.fillRect(y.x,y.y,y.w,y.h);ctx.fillStyle='#303a3b';ctx.fillRect(y.x+5,y.y+5,y.w-10,y.h-10);ctx.strokeStyle='rgba(228,214,170,.34)';ctx.lineWidth=2;ctx.strokeRect(y.x+7,y.y+7,y.w-14,y.h-14);ctx.strokeStyle='rgba(205,203,182,.18)';ctx.lineWidth=1;for(let x=y.x+14;x<y.x+y.w;x+=17){ctx.beginPath();ctx.moveTo(x,y.y+8);ctx.lineTo(x,y.y+y.h-8);ctx.stroke()}for(let yy=y.y+14;yy<y.y+y.h;yy+=17){ctx.beginPath();ctx.moveTo(y.x+8,yy);ctx.lineTo(y.x+y.w-8,yy);ctx.stroke()}}
  function drawHospitalSigns(t){if(!hospital)return;const cx=hospital.x+hospital.w/2,roofY=hospital.y+10;ctx.save();ctx.shadowColor='#ff574c';ctx.shadowBlur=15;ctx.fillStyle='#eee6d0';ctx.fillRect(cx-13,roofY-10,26,26);ctx.shadowBlur=0;ctx.fillStyle='#d94a43';ctx.fillRect(cx-3,roofY-6,6,18);ctx.fillRect(cx-9,roofY,18,6);ctx.font=`bold ${9/zoom}px "DM Mono",monospace`;ctx.textAlign='center';ctx.textBaseline='bottom';ctx.lineWidth=3/zoom;ctx.strokeStyle='#10201f';ctx.strokeText(translate('hospital'),cx,hospital.y-5);ctx.fillStyle='#fff1ca';ctx.shadowColor='#ffcf72';ctx.shadowBlur=8;ctx.fillText(translate('hospital'),cx,hospital.y-5);ctx.shadowBlur=0;
    const pulse=1+Math.sin(t*3)*.12;ctx.fillStyle='#10211c';ctx.beginPath();ctx.arc(hospital.exitX,hospital.exitY,15*pulse,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#9bea8a';ctx.lineWidth=3;ctx.shadowColor='#83ff82';ctx.shadowBlur=14;ctx.beginPath();ctx.arc(hospital.exitX,hospital.exitY,10*pulse,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;ctx.fillStyle='#b6f49d';ctx.fillRect(hospital.exitX-1.5,hospital.exitY-6,3,12);ctx.fillRect(hospital.exitX-6,hospital.exitY-1.5,12,3);ctx.font=`bold ${8/zoom}px "DM Mono",monospace`;ctx.textBaseline='top';ctx.lineWidth=3/zoom;ctx.strokeStyle='#101816';ctx.strokeText(translate('exit'),hospital.exitX,hospital.exitY+17);ctx.fillStyle='#d8f3c5';ctx.fillText(translate('exit'),hospital.exitX,hospital.exitY+17);ctx.restore()}
  function drawWasted(p){if(p.alive!==false||p.wastedTimer<=0)return;const q=pos(p),alpha=Math.min(1,p.wastedTimer/.35);ctx.save();ctx.globalAlpha=alpha;ctx.font=`bold ${23/zoom}px "DM Mono",monospace`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineWidth=4/zoom;ctx.strokeStyle='#120d0df2';ctx.shadowColor='#ff302c';ctx.shadowBlur=15;ctx.strokeText(translate('wasted'),q.x,q.y-29);ctx.fillStyle='#ff4844';ctx.fillText(translate('wasted'),q.x,q.y-29);ctx.restore()}
  function drawPlayerTag(p){
    if(p.alive===false)return;
    const q=pos(p),text=playerNames.label(p),tagY=q.y-(p.car?(p.car.type===TRUCK_TYPE?47:35):28);
    ctx.save();
    ctx.font='bold 8px "DM Mono",monospace';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.lineWidth=3/zoom;ctx.lineJoin='round';ctx.strokeStyle='#101914';
    ctx.strokeText(text,q.x,tagY,140);
    ctx.fillStyle=p.color||'#f0efdf';
    ctx.fillText(text,q.x,tagY,140);
    ctx.restore();
  }

  function drawWeaponShop(visible,t){
    if(!weaponShop||!visible(weaponShop.x,weaponShop.y,105))return;
    const {b,x,y}=weaponShop,cx=b.x+b.w/2,cy=b.y+b.h/2;
    ctx.save();
    ctx.font='bold 10px "DM Mono",monospace';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.lineWidth=3/zoom;ctx.strokeStyle='#101419';
    ctx.shadowColor='#ffb657';ctx.shadowBlur=12+Math.sin(t*3)*3;
    ctx.strokeText(translate('weaponShop'),cx,cy,125);
    ctx.fillStyle='#ffcf74';ctx.fillText(translate('weaponShop'),cx,cy,125);
    ctx.shadowBlur=6;ctx.fillStyle='#f3b653';
    ctx.beginPath();ctx.arc(x,y,7+Math.sin(t*4)*1.5,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=0;ctx.fillStyle='#172022';ctx.fillRect(x-7,y-2,14,4);
    ctx.fillStyle='#fcdfac';ctx.font='bold 8px "DM Mono",monospace';
    ctx.strokeText(translate('weaponShopPrice',{price:BAZOOKA_PRICE}),x,y+19,170);
    ctx.fillText(translate('weaponShopPrice',{price:BAZOOKA_PRICE}),x,y+19,170);
    ctx.restore();
  }
  function drawHandWeapon(p,weapon){
    const q=pos(p),knife=weapon==='knife';
    ctx.save();ctx.translate(q.x,q.y);ctx.rotate(p.facing||0);
    ctx.fillStyle=knife?'#cdd9df':'#343c40';ctx.fillRect(10,-5,knife?14:12,4);
    ctx.fillStyle='#a58b71';ctx.fillRect(8,-6,5,6);
    if(knife&&p.knifeSwing>0){ctx.strokeStyle='rgba(230,240,250,.75)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,25,-.85,.85);ctx.stroke()}
    ctx.restore();
  }
  function drawBazookaOnPlayer(p){
    const q=pos(p);ctx.save();ctx.translate(q.x,q.y);ctx.rotate(p.facing||0);
    ctx.fillStyle='#232a26';ctx.fillRect(0,-11,29,9);
    ctx.fillStyle='#788f6b';ctx.fillRect(2,-10,21,7);
    ctx.fillStyle='#18221f';ctx.fillRect(23,-12,6,11);
    ctx.fillStyle='#ceb487';ctx.fillRect(10,-3,4,7);ctx.restore();
  }
  function drawWorld(t){const cw=w(),ch=h();ctx.clearRect(0,0,cw,ch);ctx.fillStyle='#091115';ctx.fillRect(0,0,cw,ch);const left=cam.x-cw/(2*zoom),top=cam.y-ch/(2*zoom),right=left+cw/zoom,bottom=top+ch/zoom,visible=(x,y,r=0)=>x+r>=left&&x-r<=right&&y+r>=top&&y-r<=bottom;ctx.save();ctx.translate(cw/2,ch/2);ctx.scale(zoom,zoom);ctx.translate(-cam.x,-cam.y);
    drawStreetNetwork();for(const a of alleys){const margin=a.width/2+8;if(a.maxX>=left-margin&&a.minX<=right+margin&&a.maxY>=top-margin&&a.minY<=bottom+margin){if(a.sprite)drawCachedSprite(a);else drawAlley(a)}}for(const c of courtyards)if(visible(c.x+c.w/2,c.y+c.h/2,Math.max(c.w,c.h)/2)){if(c.sprite)drawCachedSprite(c);else drawCourtyard(c,t)}for(const p of plazas)if(visible(p.x+p.w/2,p.y+p.h/2,Math.max(p.w,p.h)/2+6))drawPlaza(p,t);if(hospital&&visible(hospital.x+hospital.w/2,hospital.y+hospital.h/2,130))drawHospitalYard();
    // Ground-level remains: above paved surfaces, beneath buildings, cars and people.
    drawDeathRemains(visible);
    for(const [x,y] of pistolDrops){if(!visible(x,y,20))continue;ctx.save();ctx.translate(x,y);ctx.strokeStyle='#e8d598';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,13,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#c5cdd0';ctx.fillRect(-7,-5,15,5);ctx.fillRect(-6,0,5,8);ctx.restore()}
    for(const drop of bazookaDrops){
      if(!visible(drop.x,drop.y,25))continue;
      ctx.save();ctx.translate(drop.x,drop.y);
      ctx.strokeStyle='#e8d598';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,19,0,Math.PI*2);ctx.stroke();
      ctx.rotate(drop.facing||0);
      ctx.fillStyle='#232a26';ctx.fillRect(-15,-5,30,10);
      ctx.fillStyle='#788f6b';ctx.fillRect(-13,-4,23,8);
      ctx.fillStyle='#18221f';ctx.fillRect(9,-6,6,12);
      ctx.fillStyle='#ceb487';ctx.fillRect(-4,4,4,7);ctx.restore();
    }
    drawStreetLamps(left,top,cw/zoom,ch/zoom,t);
    const visibleShops=[];for(const b of buildings){if(b.x+b.w<left-30||b.x>right+30||b.y+b.h<top-30||b.y>bottom+30)continue;if(b.kind==='shop')visibleShops.push(b);if(b.sprite)ctx.drawImage(b.sprite,b.spriteX,b.spriteY,b.sprite.width/(Math.min(devicePixelRatio||1,2)),b.sprite.height/(Math.min(devicePixelRatio||1,2)));else drawHouse(b,t)}
    drawShopNeonOverlays(visibleShops,t);drawHospitalSigns(t);drawWeaponShop(visible,t);drawStreetSigns(visible);drawTrafficLights(visible);drawSkidMarks(visible);
    for(const c of cars)if(visible(c.x,c.y,c.destroyed?30:220))drawCar(c,t);drawImpactSparks(visible);drawCarHitSparks(visible);
    if(running)for(const c of legacyAmbulances)if(visible(c.x,c.y,40))drawAmbulance(c,t);
    drawExplosions(visible);
    for(const owner of carDrivers)if(owner.pursuitCarId==null&&visible(owner.x,owner.y,38)){
      drawPerson(owner,t);
      const barX=owner.x-15,barY=owner.y-28,ratio=clamp(owner.hp/owner.maxHp,0,1);
      ctx.fillStyle='#211a17';ctx.fillRect(barX,barY,30,7);
      ctx.fillStyle=ratio>.66?'#86d99a':ratio>.33?'#e6c86d':'#ea6546';
      ctx.fillRect(barX+2,barY+2,26*ratio,3);
      ctx.font='7px "DM Mono",monospace';ctx.textAlign='center';ctx.textBaseline='bottom';
      ctx.fillStyle='#f1d8ae';ctx.fillText(`${owner.hp}/${owner.maxHp}`,owner.x,barY-2);
    }
    for(const g of guards){if(!visible(g.x,g.y,45))continue;drawPerson(g,t);const qx=g.x,qy=g.y-20;ctx.fillStyle='#211a17';ctx.fillRect(qx-15,qy-4,30,8);ctx.fillStyle=g.hp>=GUARD_MAX_HP?'#f08a64':'#e6c86d';ctx.fillRect(qx-13,qy-2,26*clamp(g.hp/GUARD_MAX_HP,0,1),4);ctx.font='7px "DM Mono",monospace';ctx.textAlign='center';ctx.fillStyle='#f1d8ae';ctx.fillText(translate('guard'),qx,qy-8)}drawGuardHitFlashes(visible);
    const nearest=running?nearestParcel()?.parcel:null;for(const f of parcels){if(!visible(f.x,f.y,18))continue;const pulse=1+Math.sin(t*5+f.phase)*.16;if(f===nearest){ctx.save();ctx.strokeStyle='#ffd36a';ctx.lineWidth=1.5/zoom;ctx.shadowColor='#ffc857';ctx.shadowBlur=10/zoom;ctx.beginPath();ctx.arc(f.x,f.y,12*pulse,0,Math.PI*2);ctx.stroke();ctx.restore()}ctx.save();ctx.translate(f.x,f.y);ctx.rotate(Math.PI/4);ctx.shadowColor='#f4cb67';ctx.shadowBlur=14;ctx.fillStyle='#e6b94e';ctx.fillRect(-7*pulse,-7*pulse,14*pulse,14*pulse);ctx.shadowBlur=0;ctx.fillStyle='#fff0bd';ctx.fillRect(-2,-2,4,4);ctx.restore()}
    for(const pack of cashPacks){if(!visible(pack.x,pack.y,18))continue;const pulse=1+Math.sin(t*5+pack.phase)*.08;ctx.save();ctx.translate(pack.x,pack.y);ctx.scale(pulse,pulse);ctx.shadowColor='#82e4aa';ctx.shadowBlur=10;ctx.fillStyle='#b7e58f';ctx.fillRect(-9,-6,18,12);ctx.shadowBlur=0;ctx.fillStyle='#255a43';ctx.fillRect(-7,-4,14,8);ctx.strokeStyle='#d4f2aa';ctx.lineWidth=1;ctx.strokeRect(-5,-3,10,6);ctx.font='bold 9px "DM Mono",monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#d4f2aa';ctx.fillText('$',0,.5);ctx.restore()}for(const medkit of medkits)if(medkit.active&&visible(medkit.x,medkit.y,18))drawMedkit(medkit,t);drawCashPickupFlashes(visible);drawMedkitFlashes(visible);drawExitDustPuffs(visible);
    for(const b of bullets){if(!visible(b.x,b.y,15))continue;if(b.rocket){ctx.strokeStyle='#ffd86c';ctx.lineWidth=6;ctx.shadowColor='#ff662b';ctx.shadowBlur=16;ctx.beginPath();ctx.moveTo(b.x-b.vx*.045,b.y-b.vy*.045);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.shadowBlur=0;ctx.fillStyle='#ffefba';ctx.beginPath();ctx.arc(b.x,b.y,4,0,Math.PI*2);ctx.fill();continue}ctx.strokeStyle=b.team==='guard'?'#ff8775':'#fff0a8';ctx.lineWidth=3.5;ctx.shadowColor=b.team==='guard'?'#ff5538':'#ffad36';ctx.shadowBlur=8;ctx.beginPath();ctx.moveTo(b.x-b.vx*.0125,b.y-b.vy*.0125);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.shadowBlur=0}
    for(const p of players){
      const q=pos(p);if(!visible(q.x,q.y,60))continue;
      if(p.alive!==false&&!p.car){
        const z=jumpHeight(p);
        if(z>0){ctx.save();ctx.globalAlpha=.25;ctx.fillStyle='#000';ctx.beginPath();ctx.ellipse(q.x,q.y,10,5,0,0,Math.PI*2);ctx.fill();ctx.restore()}
        const slide=p.landingSlide;
        const blend=slide?1-clamp((t-slide.start)/.16,0,1):0;
        ctx.save();ctx.translate((slide?.x||0)*blend,(slide?.y||0)*blend-z);
        const weapon=equippedWeapon(p);
        if(p.ghost)ctx.globalAlpha=.35;
        drawPerson(p,t);if(!p.ghost){if(weapon==='bazooka')drawBazookaOnPlayer(p);else drawHandWeapon(p,weapon);}
        drawPlayerTag(p);ctx.restore();
      }else drawPlayerTag(p);
      drawWasted(p);
    }
    drawMuzzleFlashes(visible);ctx.restore();drawParcelArrow();drawArrows();
  }
  function drawExplosions(visible){for(const ex of explosions){const progress=ex.age/ex.duration,r=ex.radius*(.35+progress*.85);if(!visible(ex.x,ex.y,r))continue;ctx.save();ctx.globalAlpha=1-progress;const gradient=ctx.createRadialGradient(ex.x,ex.y,2,ex.x,ex.y,r);gradient.addColorStop(0,'#fff6b2');gradient.addColorStop(.22,'#ffd35b');gradient.addColorStop(.58,'#f27635');gradient.addColorStop(1,'#b93020');ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(ex.x,ex.y,r,0,Math.PI*2);ctx.fill();ctx.globalAlpha=(1-progress)*.9;ctx.strokeStyle='#ffe594';ctx.lineWidth=4;ctx.beginPath();ctx.arc(ex.x,ex.y,r*.72,0,Math.PI*2);ctx.stroke();for(let i=0;i<8;i++){const a=i*Math.PI/4+progress*.4,d=r*(.55+progress*.35);ctx.fillStyle=i%2?'#ffe7a0':'#ff713b';ctx.fillRect(ex.x+Math.cos(a)*d-3,ex.y+Math.sin(a)*d-3,6,6)}ctx.restore()}}
  function updateGuardHitFlashes(dt){for(const flash of guardHitFlashes)flash.age+=dt;guardHitFlashes=guardHitFlashes.filter(flash=>flash.age<GUARD_HIT_FLASH_LIFETIME)}
  function drawGuardHitFlashes(visible){for(const flash of guardHitFlashes){if(!visible(flash.x,flash.y,12))continue;const progress=flash.age/GUARD_HIT_FLASH_LIFETIME,radius=2+progress*4,alpha=1-progress;ctx.save();ctx.translate(flash.x,flash.y);ctx.rotate(flash.angle);ctx.globalAlpha=alpha;ctx.strokeStyle='#ffe7a3';ctx.fillStyle='#fff4cf';ctx.shadowColor='#ffc04f';ctx.shadowBlur=6/zoom;ctx.lineWidth=2/zoom;ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.stroke();for(let i=0;i<4;i++){const angle=i*Math.PI/2,inner=radius+1,outer=radius+3;ctx.beginPath();ctx.moveTo(Math.cos(angle)*inner,Math.sin(angle)*inner);ctx.lineTo(Math.cos(angle)*outer,Math.sin(angle)*outer);ctx.stroke()}ctx.beginPath();ctx.arc(0,0,1.5,0,Math.PI*2);ctx.fill();ctx.restore()}}
  function updateCarHitSparks(dt){for(const spark of carHitSparks)spark.age+=dt;carHitSparks=carHitSparks.filter(spark=>spark.age<CAR_HIT_SPARK_LIFETIME)}
  function drawCarHitSparks(visible){for(const spark of carHitSparks){if(!visible(spark.x,spark.y,11))continue;const progress=spark.age/CAR_HIT_SPARK_LIFETIME,radius=3+progress*4,alpha=1-progress;ctx.save();ctx.translate(spark.x,spark.y);ctx.rotate(spark.angle);ctx.globalAlpha=alpha;ctx.strokeStyle='#ffd978';ctx.fillStyle='#fff1bd';ctx.shadowColor='#ffad38';ctx.shadowBlur=6/zoom;ctx.lineWidth=2/zoom;ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.stroke();for(let i=0;i<4;i++){const a=i*Math.PI/2,inner=radius+1,outer=radius+7;ctx.beginPath();ctx.moveTo(Math.cos(a)*inner,Math.sin(a)*inner);ctx.lineTo(Math.cos(a)*outer,Math.sin(a)*outer);ctx.stroke()}ctx.beginPath();ctx.arc(0,0,2,0,Math.PI*2);ctx.fill();ctx.restore()}}
  function drawImpactSparks(visible){for(const spark of impactSparks){if(!visible(spark.x,spark.y,12))continue;const fade=Math.max(0,1-spark.age/spark.lifetime);ctx.save();ctx.globalAlpha=fade;ctx.strokeStyle=spark.color;ctx.shadowColor='#ffb943';ctx.shadowBlur=5/zoom;ctx.lineWidth=1.5/zoom;ctx.beginPath();ctx.moveTo(spark.x-spark.vx*.04,spark.y-spark.vy*.04);ctx.lineTo(spark.x,spark.y);ctx.stroke();ctx.restore()}}
  function updateCashPickupFlashes(dt){for(const flash of cashPickupFlashes)flash.age+=dt;cashPickupFlashes=cashPickupFlashes.filter(flash=>flash.age<flash.lifetime)}
  function drawCashPickupFlashes(visible){for(const flash of cashPickupFlashes){if(!visible(flash.x,flash.y,30))continue;const progress=clamp(flash.age/flash.lifetime,0,1),fade=1-progress,radius=8+progress*20;ctx.save();ctx.globalAlpha=fade;ctx.strokeStyle='#baff7c';ctx.shadowColor='#ffe88a';ctx.shadowBlur=12/zoom;ctx.lineWidth=3/zoom;ctx.beginPath();ctx.arc(flash.x,flash.y,radius,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=fade*.45;ctx.fillStyle='#e6f9a5';ctx.beginPath();ctx.arc(flash.x,flash.y,Math.max(0,10*(1-progress)),0,Math.PI*2);ctx.fill();ctx.restore()}}
  function drawMedkit(medkit,t){const pulse=1+Math.sin(t*4+medkit.phase)*.06;ctx.save();ctx.translate(medkit.x,medkit.y);ctx.scale(pulse,pulse);ctx.shadowColor='#ff7467';ctx.shadowBlur=11;ctx.fillStyle='#b9413c';ctx.fillRect(-10,-8,20,16);ctx.shadowBlur=0;ctx.fillStyle='#f5e9d0';ctx.fillRect(-2.5,-6,5,12);ctx.fillRect(-6,-2.5,12,5);ctx.strokeStyle='#f6b7a1';ctx.lineWidth=1;ctx.strokeRect(-9.5,-7.5,19,15);ctx.restore()}
  function drawMedkitFlashes(visible){for(const flash of medkitFlashes){if(!visible(flash.x,flash.y,30))continue;const progress=clamp(flash.age/MEDKIT_FLASH_LIFETIME,0,1),fade=1-progress;ctx.save();ctx.globalAlpha=fade;ctx.strokeStyle='#ffe6c8';ctx.shadowColor='#ff7566';ctx.shadowBlur=12/zoom;ctx.lineWidth=2.5/zoom;ctx.beginPath();ctx.arc(flash.x,flash.y,7+progress*19,0,Math.PI*2);ctx.stroke();ctx.restore()}}
  function emitExitDustPuff(x,y){if(exitDustPuffs.length>=MAX_EXIT_DUST_PUFFS)exitDustPuffs.shift();exitDustPuffs.push({x,y,age:0,lifetime:EXIT_DUST_LIFETIME})}
  function updateExitDustPuffs(dt){for(const puff of exitDustPuffs)puff.age+=dt;exitDustPuffs=exitDustPuffs.filter(puff=>puff.age<puff.lifetime)}
  function drawExitDustPuffs(visible){for(const puff of exitDustPuffs){if(!visible(puff.x,puff.y,28))continue;const progress=clamp(puff.age/puff.lifetime,0,1),fade=1-progress,spread=5+progress*15;ctx.save();ctx.globalAlpha=fade*.22;ctx.fillStyle='#d7c5a0';ctx.shadowColor='#c9b99a';ctx.shadowBlur=8/zoom;for(let i=0;i<5;i++){const angle=i*Math.PI*2/5+puff.age*5,dist=spread*(.55+(i%2)*.2),radius=(4+(i%3))*fade;ctx.beginPath();ctx.arc(puff.x+Math.cos(angle)*dist,puff.y+Math.sin(angle)*dist,radius,0,Math.PI*2);ctx.fill()}ctx.restore()}}
  function streetSignClear(sign){if(hospital&&Math.hypot(sign.x-hospital.exitX,sign.y-hospital.exitY)<180)return false;const clearance=34/zoom;for(const pack of parcels)if(Math.hypot(pack.x-sign.x,pack.y-sign.y)<clearance)return false;for(const pack of cashPacks)if(Math.hypot(pack.x-sign.x,pack.y-sign.y)<clearance)return false;for(const p of players)if(p.alive!==false){const q=pos(p);if(Math.hypot(q.x-sign.x,q.y-sign.y)<clearance+12)return false}for(const car of cars)if(!car.destroyed&&Math.hypot(car.x-sign.x,car.y-sign.y)<clearance+24)return false;return true}
  function drawStreetSigns(visible){for(const sign of streetSigns){if(!visible(sign.x,sign.y,30/zoom)||!streetSignClear(sign))continue;const width=42/zoom,height=12/zoom;ctx.save();ctx.translate(sign.x,sign.y);ctx.fillStyle='#11191a';ctx.fillRect(-1/zoom,height*.28,2/zoom,7/zoom);ctx.shadowColor='#d9c284';ctx.shadowBlur=5/zoom;ctx.fillStyle='#183033';ctx.fillRect(-width/2,-height/2,width,height);ctx.shadowBlur=0;ctx.strokeStyle='#aa9d74';ctx.lineWidth=1/zoom;ctx.strokeRect(-width/2,-height/2,width,height);ctx.font=`bold ${5.8/zoom}px "DM Mono",monospace`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#e2d9bb';ctx.fillText(translate(sign.nameKey),0,.4/zoom,width-4/zoom);ctx.restore()}}
  function addDeathRemain(p,x,y,npc=false){
    if(npc&&(guards.includes(p)||(carDrivers.includes(p)&&p.pursuitCarId==null)))dropPistol(x,y);
    if(deathRemains.length>=MAX_DEATH_REMAINS)deathRemains.shift();
    deathRemains.push({x,y,facing:Number.isFinite(p.facing)?p.facing:0,
      bodyFacing:Number.isFinite(p.bodyFacing)?p.bodyFacing:(Number.isFinite(p.facing)?p.facing:0),
      color:p.color||'#8d9690',playerId:p.id,npc,age:0,awaitingPickup:true});
  }
  function remainLifetime(remain){return remain.npc?NPC_REMAIN_LIFETIME:DEATH_BODY_LIFETIME+DEATH_CHALK_LIFETIME}
  function updateDeathRemains(dt){
    for(const remain of deathRemains)remain.age+=dt;
    deathRemains=deathRemains.filter(remain=>remain.age<remainLifetime(remain));
  }
  function deathRemainVisualAge(remain){
    if(remain.collected)return Math.max(remain.age,DEATH_BODY_LIFETIME);
    if(remain.awaitingPickup&&remain.age<NPC_REMAIN_LIFETIME)return Math.min(remain.age,DEATH_BODY_LIFETIME-.25);
    return remain.age;
  }
  function collectAmbulanceRemains(active){
    for(const p of active){
      const car=p.car;
      if(p.alive===false||!car||car.type!==AMBULANCE_TYPE||car.destroyed||car.driver!==p)continue;
      for(const remain of deathRemains){
        if(!remain.awaitingPickup||remain.collected||remain.age>=NPC_REMAIN_LIFETIME||
          Math.hypot(car.x-remain.x,car.y-remain.y)>48)continue;
        if(!awardScore(p,1,'collectedBodies'))return;
        remain.awaitingPickup=false;
        remain.collected=true;
      }
    }
  }
  function nearestStreet(coordinate,streets){
    return streets.reduce((nearest,street)=>Math.abs(street-coordinate)<Math.abs(nearest-coordinate)?street:nearest);
  }
  function ambulanceRoute(dock,remain){
    const exitY=roadsY.find(y=>y>dock.y);
    const roadX=nearestStreet(remain.x,roadsX),roadY=nearestStreet(remain.y,roadsY);
    const streetStop={x:clamp(remain.x,roadsX[0],roadsX.at(-1)),y:roadY};
    const avenueStop={x:roadX,y:clamp(remain.y,roadsY[0],roadsY.at(-1))};
    const alongAvenue=Math.hypot(avenueStop.x-remain.x,avenueStop.y-remain.y)<
      Math.hypot(streetStop.x-remain.x,streetStop.y-remain.y);
    const turnX=alongAvenue?roadX:nearestStreet(dock.x,roadsX);
    const stop=alongAvenue?avenueStop:streetStop;
    if(stop.y===exitY)return [dock,{x:dock.x,y:exitY},stop];
    return [dock,{x:dock.x,y:exitY},{x:turnX,y:exitY},{x:turnX,y:stop.y},stop];
  }
  function startAmbulanceLeg(car,route,dock){
    const points=route.filter((point,i)=>i===0||point.x!==route[i-1].x||point.y!==route[i-1].y);
    car.trafficRoute=points.map((point,i)=>{
      if(point===dock)return [point.x,point.y];
      const previous=points[i-1]||point,next=points[i+1]||point;
      // Follow the same lanes as traffic and join the two lane centers at turns.
      const dx=point.x-previous.x||next.x-point.x,dy=point.y-previous.y||next.y-point.y;
      return [point.x+Math.sign(dy)*laneOffset,point.y-Math.sign(dx)*laneOffset];
    });
    car.traffic=true;car.trafficIndex=0;car.trafficWait=0;car.ambulanceDetour=null;car.ambulanceRetry=0;
  }
  function updateAmbulances(dt){
    if(!hospital)return;
    const dock={x:hospital.exitX+28,y:hospital.exitY};
    const fleet=cars.filter(car=>car.type===AMBULANCE_TYPE&&!car.destroyed);
    let count=fleet.length;
    for(const car of fleet){
      const job=car.ambulanceJob;
      if(car.driver||!car.npcInside||car.escapeFromPlayerId!=null||car.pursuitOwnerId!=null){
        if(job){car.ambulanceJob=null;car.traffic=false}
        continue;
      }
      if(!job){
        // A driver who reclaims a stolen ambulance can bring it back into service.
        car.ambulanceJob={remain:null};
        startAmbulanceLeg(car,ambulanceRoute(dock,car).reverse(),dock);
        continue;
      }
      // A player may have picked up a body while this unit was en route.
      if(job.remain&&(!job.remain.awaitingPickup||job.remain.age>=NPC_REMAIN_LIFETIME||!deathRemains.includes(job.remain))){
        const home=job.route[0];
        job.remain=null;
        startAmbulanceLeg(car,ambulanceRoute(home,car).reverse(),home);
        continue;
      }
      const [targetX,targetY]=car.trafficRoute.at(-1);
      if(Math.hypot(car.x-targetX,car.y-targetY)>1)continue;
      if(!job.remain){cars=cars.filter(other=>other!==car);count--;continue}
      car.traffic=false;car.speed=0;
      job.loadTime-=dt;
      if(job.loadTime>0)continue;
      job.remain.awaitingPickup=false;
      job.remain.collected=true;
      job.remain=null;
      startAmbulanceLeg(car,job.route.toReversed(),job.route[0]);
    }
    if(count>=AMBULANCE_LIMIT)return;
    const remain=deathRemains.find(r=>r.awaitingPickup&&r.age<NPC_REMAIN_LIFETIME&&fleet.every(car=>car.ambulanceJob?.remain!==r));
    if(!remain)return;
    const type=AMBULANCE_TYPE,angle=Math.PI/2;
    const car={type,...dock,angle,speed:0,brakeLight:0,skidMarkTimer:0,turnSignal:null,driver:null,npcInside:true,
      health:CAR_MAX_HEALTH,destroyed:false,color:'#f4f1df',trafficSpeed:vehicleSpec({type}).trafficSpeed};
    if(vehicleBlockedAt(car,dock.x,dock.y,angle)||blockedByPlayer(dock.x,dock.y,24)||
      cars.some(other=>!other.destroyed&&carOverlapsAt(car,dock.x,dock.y,angle,other)))return;
    const route=ambulanceRoute(dock,remain);
    car.id=nextCarId++;
    car.ambulanceJob={remain,route,loadTime:AMBULANCE_LOADING_TIME};
    startAmbulanceLeg(car,route,dock);
    cars.push(car);
  }
  function drawAmbulance(ambulance,t){
    ctx.save();
    ctx.translate(ambulance.x,ambulance.y);ctx.rotate(ambulance.angle);
    ctx.fillStyle='#131b21';ctx.fillRect(-28,-14,56,28);
    ctx.fillStyle='#f4f1df';ctx.fillRect(-26,-12,47,24);
    ctx.fillStyle='#ccd8d7';ctx.fillRect(21,-10,7,20);
    ctx.fillStyle='#39535c';ctx.fillRect(15,-10,5,20);
    ctx.fillStyle='#d43d38';ctx.fillRect(-25,-12,38,3);ctx.fillRect(-25,9,38,3);
    ctx.fillRect(-14,-2,14,4);ctx.fillRect(-9,-7,4,14);
    const flash=Math.floor(t*8)%2===0,signal=Boolean(ambulance.driver||ambulance.npcInside);
    ctx.fillStyle=flash&&signal?'#d5faff':'#337bbf';ctx.fillRect(8,-10,4,8);
    ctx.fillStyle=!flash&&signal?'#d5faff':'#337bbf';ctx.fillRect(8,2,4,8);
    if(ambulance.driver||ambulance.npcInside){
      ctx.fillStyle='#e9c89e';ctx.beginPath();ctx.arc(17,-4,2.5,0,Math.PI*2);ctx.fill();
    }
    if(ambulance.health===1)drawCriticalCarSmoke(t);
    ctx.restore();
  }
  // One shared, human-shaped outline for the fallen sprite AND its chalk trace.
  // Local coordinates: head at the top, two arms spread wide and legs apart.
  // Inspired by the walking pedestrian on Polish S-5 signals:
  // asymmetrical bent arms and forward-striding legs rather than a starfish pose.
  // Both the body and its chalk outline use this exact silhouette.
  function traceFallenSilhouette(){
    ctx.beginPath();
    ctx.moveTo(-4.8,-8);
    ctx.lineTo(5.2,-8);
    ctx.quadraticCurveTo(7.1,-8,7.5,-5.8);
    // Right arm bends at the elbow; hand returns toward the hip.
    ctx.lineTo(19,-2.4);
    ctx.quadraticCurveTo(22,-1.5,21,1);
    ctx.lineTo(13,9);
    ctx.quadraticCurveTo(11,10,9,8);
    ctx.lineTo(15.6,1);
    ctx.lineTo(6,-1.6);
    ctx.lineTo(5.1,5.3);
    // Right leg steps outward.
    ctx.lineTo(15.2,18.7);
    ctx.quadraticCurveTo(17.3,21.8,14.2,22.9);
    ctx.quadraticCurveTo(11.8,23.4,10.4,21.3);
    ctx.lineTo(1.3,9.5);
    ctx.lineTo(-.3,9.5);
    // Left leg extends farther back to form a walking stance.
    ctx.lineTo(-10.3,21.9);
    ctx.quadraticCurveTo(-13.1,24,-15.2,21.7);
    ctx.quadraticCurveTo(-17.3,20,-14.7,17.5);
    ctx.lineTo(-5.1,5.5);
    ctx.lineTo(-6.1,-.2);
    // Left arm reaches diagonally down, opposite to the right elbow.
    ctx.lineTo(-17,7);
    ctx.quadraticCurveTo(-19.9,9.4,-21.5,6.2);
    ctx.quadraticCurveTo(-22.4,3.8,-19.8,2.3);
    ctx.lineTo(-7,-6);
    ctx.quadraticCurveTo(-6,-8,-4.8,-8);
    ctx.closePath();
  }
  function traceFallenHead(){
    ctx.beginPath();
    ctx.ellipse(0,-14.5,5.3,5.5,0,0,Math.PI*2);
  }
  function drawDeathRemains(visible){
    for(const remain of deathRemains){
      if(!visible(remain.x,remain.y,32))continue;
      ctx.save();
      ctx.translate(remain.x,remain.y);
      // bodyFacing is the person's world-facing angle: align the head with it.
      ctx.rotate(remain.bodyFacing+Math.PI/2);
      if(deathRemainVisualAge(remain)>=DEATH_BODY_LIFETIME){
        ctx.strokeStyle='#d5cfb6';
        ctx.shadowColor='#f4eecf';
        ctx.shadowBlur=3/zoom;
        ctx.globalAlpha=.74;
        ctx.lineWidth=Math.max(1,1.5/zoom);
        ctx.lineCap='round';
        ctx.lineJoin='round';
        traceFallenSilhouette();
        ctx.stroke();
        traceFallenHead();
        ctx.stroke();
      }else{
        ctx.lineCap='round';
        ctx.lineJoin='round';
        ctx.fillStyle=remain.color;
        ctx.strokeStyle='#111719';
        ctx.lineWidth=1.8;
        traceFallenSilhouette();
        ctx.fill();
        ctx.stroke();
        // Contrasting grey/brown trousers are clearly separate from the shirt.
        ctx.fillStyle=trouserColor(remain.color);
        ctx.beginPath();ctx.moveTo(-5,4.7);ctx.lineTo(-.8,6.5);
        ctx.lineTo(-12.3,20.8);ctx.lineTo(-14.8,19.4);ctx.closePath();ctx.fill();
        ctx.beginPath();ctx.moveTo(.8,5.7);ctx.lineTo(5.1,4.6);
        ctx.lineTo(14.6,18.6);ctx.lineTo(11.5,20.1);ctx.closePath();ctx.fill();
        // Small hands and shoes make the limbs readable at game zoom.
        ctx.fillStyle='#dbb08e';
        for(const [handX,handY] of [[-19,5],[12,8]]){
          ctx.beginPath();ctx.arc(handX,handY,1.7,0,Math.PI*2);ctx.fill();
        }
        ctx.fillStyle='#253034';
        for(const [footX,footY] of [[-13,21],[14,21]]){
          ctx.beginPath();ctx.ellipse(footX,footY,2,1.8,0,0,Math.PI*2);ctx.fill();
        }
        ctx.fillStyle='#c9a487';
        ctx.strokeStyle='#111719';
        ctx.lineWidth=1.4;
        traceFallenHead();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle='#29302c';
        ctx.beginPath();
        ctx.ellipse(0,-17.2,3.8,1.4,0,0,Math.PI*2);
        ctx.fill();
      }
      ctx.restore();
    }
  }
  function drawSkidMarks(visible){for(const mark of skidMarks){if(!visible(mark.x,mark.y,8))continue;const fade=Math.max(0,1-mark.age/mark.lifetime);ctx.save();ctx.translate(mark.x,mark.y);ctx.rotate(mark.angle);ctx.globalAlpha=.62*fade;ctx.fillStyle='#111719';ctx.fillRect(-11,-1.7,22,3.4);ctx.restore()}}
  function drawArrows(){const cw=w(),ch=h(),cx=cw/2,cy=ch/2,margin=34;for(const p of livingPlayers()){const q=pos(p),sp=screen(q.x,q.y);if(sp.x>=18&&sp.x<=cw-18&&sp.y>=18&&sp.y<=ch-18)continue;const dx=sp.x-cx,dy=sp.y-cy,scale=Math.min((cw/2-margin)/Math.max(Math.abs(dx),.001),(ch/2-margin)/Math.max(Math.abs(dy),.001)),ax=cx+dx*scale,ay=cy+dy*scale,angle=Math.atan2(dy,dx),meters=Math.round(Math.hypot(dx,dy)/zoom/2);ctx.save();ctx.translate(ax,ay);ctx.rotate(angle);ctx.fillStyle=p.color;ctx.shadowColor=p.color;ctx.shadowBlur=12;ctx.beginPath();ctx.moveTo(13,0);ctx.lineTo(-9,-8);ctx.lineTo(-6,0);ctx.lineTo(-9,8);ctx.closePath();ctx.fill();ctx.restore();const tx=clamp(ax+Math.cos(angle)*23,48,cw-48),ty=clamp(ay+Math.sin(angle)*23,16,ch-16);ctx.font='9px "DM Mono",monospace';ctx.textAlign='center';ctx.textBaseline='middle';const label=`P${p.id} · ${meters} m`,lw=ctx.measureText(label).width+12;ctx.fillStyle='#101510e8';ctx.fillRect(tx-lw/2,ty-9,lw,18);ctx.fillStyle=p.color;ctx.fillText(label,tx,ty+.5)}}
  function parcelArrowLabel(point,cw,ch,labelWidth){
    const distances=[['top',point.y],['right',cw-point.x],['bottom',ch-point.y],['left',point.x]],edge=distances.reduce((best,item)=>item[1]<best[1]?item:best)[0],label={width:labelWidth,height:18};
    if(edge==='top'){label.x=clamp(point.x,leftBound(cw,labelWidth),cw-leftBound(cw,labelWidth));label.y=point.y+19}
    else if(edge==='bottom'){label.x=clamp(point.x,leftBound(cw,labelWidth),cw-leftBound(cw,labelWidth));label.y=point.y-19}
    else if(edge==='left'){label.x=point.x+labelWidth/2+9;label.y=clamp(point.y,27,ch-27)}
    else{label.x=point.x-labelWidth/2-9;label.y=clamp(point.y,27,ch-27)}
    label.left=label.x-label.width/2;label.right=label.x+label.width/2;label.top=label.y-label.height/2;label.bottom=label.y+label.height/2;return label;
  }
  function leftBound(cw,labelWidth){return Math.min(cw/2,Math.max(10,labelWidth/2+5))}
  function parcelArrowPoint(targetX,targetY,cw,ch,labelWidth){
    const margin=Math.min(42,Math.max(18,Math.min(cw,ch)*.07)),left=margin,right=cw-margin,top=margin,bottom=ch-margin,cx=cw/2,cy=ch/2,dx=targetX-cx,dy=targetY-cy,length=Math.hypot(dx,dy)||1;
    const canvasRect=canvas.getBoundingClientRect(),protectedRects=[...document.querySelectorAll('.night-hud,.night-sidebar,.touch-controls,.under-game,.performance-hud,.gt-input-hud,.topbar,.intro')].map(el=>el.getBoundingClientRect()).filter(r=>r.width>0&&r.height>0).map(r=>({left:r.left-canvasRect.left-17,right:r.right-canvasRect.left+17,top:r.top-canvasRect.top-17,bottom:r.bottom-canvasRect.top+17}));
    let best=null,bestAlignment=-Infinity;const consider=(x,y)=>{if(x<left||x>right||y<top||y>bottom||protectedRects.some(r=>x>=r.left-13&&x<=r.right+13&&y>=r.top-13&&y<=r.bottom+13))return;const label=parcelArrowLabel({x,y},cw,ch,labelWidth);if(label.left<4||label.right>cw-4||label.top<4||label.bottom>ch-4||protectedRects.some(r=>label.right>=r.left&&label.left<=r.right&&label.bottom>=r.top&&label.top<=r.bottom))return;const fromX=x-cx,fromY=y-cy,alignment=(fromX*dx+fromY*dy)/(Math.hypot(fromX,fromY)*length||1);if(alignment>bestAlignment){best={x,y,label};bestAlignment=alignment}};
    const step=20;for(let x=left;x<=right;x+=step){consider(x,top);consider(x,bottom)}for(let y=top;y<=bottom;y+=step){consider(left,y);consider(right,y)}
    consider(left,top);consider(right,top);consider(left,bottom);consider(right,bottom);return best;
  }
  function nearestParcel(){let parcel=null,distanceSq=Infinity;for(const candidate of parcels){const distance=(candidate.x-cam.x)**2+(candidate.y-cam.y)**2;if(distance<distanceSq){parcel=candidate;distanceSq=distance}}return parcel?{parcel,distanceSq}:null}
  function parcelArrowState(){
    if(!running)return null;const nearest=nearestParcel();if(!nearest)return null;const target=nearest.parcel,cw=w(),ch=h(),sp=screen(target.x,target.y);if(sp.x>=18&&sp.x<=cw-18&&sp.y>=18&&sp.y<=ch-18)return null;
    const distance=Math.round(Math.sqrt(nearest.distanceSq)/2),label=`${distance} m`;ctx.font='10px "DM Mono",monospace';const labelWidth=ctx.measureText(label).width+12,point=parcelArrowPoint(sp.x,sp.y,cw,ch,labelWidth);return point?{point,target:sp,angle:Math.atan2(sp.y-point.y,sp.x-point.x),distance,label}:null;
  }
  function drawParcelArrow(){
    const state=parcelArrowState();if(!state)return;const{point,angle,label}=state;ctx.save();ctx.translate(point.x,point.y);ctx.rotate(angle);ctx.fillStyle='#ffd36a';ctx.strokeStyle='#241b0c';ctx.lineWidth=2;ctx.shadowColor='#ffd36a';ctx.shadowBlur=9;ctx.beginPath();ctx.moveTo(13,0);ctx.lineTo(-8,-7);ctx.lineTo(-5,0);ctx.lineTo(-8,7);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();ctx.font='10px "DM Mono",monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#101510df';ctx.strokeStyle='#e3bb5d88';ctx.lineWidth=1;ctx.fillRect(point.label.left,point.label.top,point.label.width,point.label.height);ctx.strokeRect(point.label.left,point.label.top,point.label.width,point.label.height);ctx.fillStyle='#f3d783';ctx.fillText(label,point.label.x,point.label.y+.5);
  }
  function drawCriticalCarSmoke(t){ctx.save();for(let i=0;i<3;i++){const phase=(t*.58+i/3)%1,radius=2.2+phase*3.2,x=-22-phase*13,y=Math.sin(t*2.1+i*1.9)*1.8+(i-1)*2;ctx.globalAlpha=(1-phase)*.34;ctx.fillStyle='#b8c3c0';ctx.beginPath();ctx.ellipse(x,y,radius,radius*.72,0,0,Math.PI*2);ctx.fill()}ctx.restore()}
  function drawVolvoTruck(c,t){
    const paint=c.driver?c.driver.color:c.color,brake=clamp(c.brakeLight||0,0,1);
    ctx.save();ctx.translate(c.x,c.y);ctx.rotate(c.angle);
    const beam=ctx.createLinearGradient(28,0,215,0);beam.addColorStop(0,'rgba(255,243,188,.2)');beam.addColorStop(1,'rgba(255,208,133,0)');ctx.fillStyle=beam;
    ctx.beginPath();ctx.moveTo(32,-10);ctx.lineTo(215,-46);ctx.lineTo(215,46);ctx.lineTo(32,10);ctx.closePath();ctx.fill();
    // Separate cargo body and cab identify this as a Volvo box truck.
    ctx.fillStyle='#131b21';ctx.fillRect(-40,-18,52,36);
    ctx.fillStyle='#91a1a6';ctx.fillRect(-37,-15,47,30);ctx.fillStyle='#b5c0c0';ctx.fillRect(-34,-12,40,24);
    ctx.fillStyle='#6c7e83';ctx.fillRect(-32,-11,3,22);ctx.fillRect(-7,-11,3,22);
    if(c.cashConvoy){
      ctx.fillStyle='#254a38';ctx.fillRect(-34,-12,38,24);
      ctx.strokeStyle='#f3d26b';ctx.lineWidth=2;ctx.strokeRect(-34,-12,38,24);
      ctx.fillStyle='#f5dc85';ctx.font='bold 15px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText('$',-15,0);
    }
    ctx.fillStyle='#11191e';for(const axle of [-29,-14,27]){ctx.fillRect(axle-6,-20,11,5);ctx.fillRect(axle-6,15,11,5)}
    ctx.fillStyle='#152a36';ctx.fillRect(9,-17,30,34);ctx.fillStyle=paint;ctx.fillRect(12,-15,25,30);
    ctx.fillStyle='#a5beca';ctx.fillRect(22,-12,10,24);ctx.fillStyle='#1b3746';ctx.fillRect(33,-12,4,24);
    ctx.fillStyle='#263e49';ctx.fillRect(13,-12,4,24);
    ctx.fillStyle='#ecf2f0';ctx.font='bold 6px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('VOLVO',21,0);
    ctx.fillStyle='#ff5141';ctx.shadowColor=brake>.02?'#ff7868':'#ff362d';ctx.shadowBlur=11+14*brake;ctx.fillRect(-40,-13,4,7);ctx.fillRect(-40,6,4,7);
    ctx.shadowBlur=0;ctx.fillStyle='#fff2b3';ctx.shadowColor='#fff0a0';ctx.shadowBlur=15;ctx.fillRect(35,-12,4,7);ctx.fillRect(35,5,4,7);ctx.shadowBlur=0;
    if(c.turnSignal&&(t%.72)<.4){const y=c.turnSignal==='left'?-14:14;ctx.fillStyle='#ffc447';ctx.shadowColor='#ffb52e';ctx.shadowBlur=8;ctx.fillRect(34,y-2,5,4);ctx.fillRect(-40,y-2,5,4);ctx.shadowBlur=0}
    if(c.health===1)drawCriticalCarSmoke(t);
    if(c.driver||c.npcInside){ctx.fillStyle='#f0d0a4';ctx.beginPath();ctx.arc(26,0,3,0,Math.PI*2);ctx.fill()}
    ctx.restore();
    if(c.health<CAR_MAX_HEALTH){ctx.fillStyle='#17140f';ctx.fillRect(c.x-19,c.y-28,38,5);ctx.fillStyle=c.health>CAR_MAX_HEALTH*.7?'#9cde81':c.health>CAR_MAX_HEALTH*.3?'#f0b94f':'#ea6546';ctx.fillRect(c.x-17,c.y-27,34*Math.max(0,c.health)/CAR_MAX_HEALTH,3)}
  }
  function drawTank(c,t){
    ctx.save();ctx.translate(c.x,c.y);ctx.rotate(c.angle);
    ctx.fillStyle='#202620';ctx.fillRect(-29,-18,58,10);ctx.fillRect(-29,8,58,10);
    ctx.fillStyle='#50574a';for(let x=-26;x<28;x+=7){ctx.fillRect(x,-17,2,8);ctx.fillRect(x,9,2,8)}
    ctx.fillStyle=c.destroyed?'#34362e':'#536346';ctx.fillRect(-26,-12,52,24);
    ctx.fillStyle=c.destroyed?'#252820':'#89946b';ctx.fillRect(-22,-9,44,18);
    ctx.fillStyle='#333c2a';ctx.fillRect(3,-3,30,6);
    ctx.fillStyle='#667651';ctx.fillRect(5,-2,28,3);
    ctx.fillStyle='#414b35';ctx.beginPath();ctx.arc(-3,0,11,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=c.driver?c.driver.color:'#829165';ctx.beginPath();ctx.arc(-3,0,7,0,Math.PI*2);ctx.fill();
    if(c.health<=2)drawCriticalCarSmoke(t);ctx.restore();
    if(c.health<20){ctx.fillStyle='#17140f';ctx.fillRect(c.x-19,c.y-29,38,5);ctx.fillStyle='#a2d17d';ctx.fillRect(c.x-17,c.y-28,34*Math.max(0,c.health)/20,3)}
  }
  function drawCar(c,t){if(c.type==='tank'){drawTank(c,t);return}if(c.type===TRUCK_TYPE){drawVolvoTruck(c,t);return}if(c.type===AMBULANCE_TYPE){drawAmbulance(c,t);return}ctx.save();ctx.translate(c.x,c.y);ctx.rotate(c.angle);if(c.destroyed){ctx.fillStyle='#080a09';ctx.fillRect(-21,-12,44,26);ctx.fillStyle='#282421';ctx.fillRect(-17,-8,34,18);ctx.fillStyle='#111718';ctx.fillRect(-8,-7,16,14);ctx.fillStyle='#e65b39';ctx.shadowColor='#ff5638';ctx.shadowBlur=8;ctx.fillRect(-20,-7,3,4);ctx.fillRect(-20,3,3,4);ctx.restore();return}
    const beam=ctx.createLinearGradient(14,0,205,0);beam.addColorStop(0,'rgba(255,243,188,.22)');beam.addColorStop(.34,'rgba(255,223,157,.11)');beam.addColorStop(1,'rgba(255,208,133,0)');ctx.fillStyle=beam;ctx.beginPath();ctx.moveTo(14,-6);ctx.lineTo(205,-39);ctx.lineTo(205,39);ctx.lineTo(14,6);ctx.closePath();ctx.fill();
    window.SharedCarArt.draw(ctx,{paint:c.driver?c.driver.color:c.color,brakeLight:c.brakeLight,turnSignal:c.turnSignal,occupied:Boolean(c.driver||c.npcInside),time:t});if(c.health===1)drawCriticalCarSmoke(t);ctx.restore();if(c.health<CAR_MAX_HEALTH){ctx.fillStyle='#17140f';ctx.fillRect(c.x-15,c.y-21,30,5);ctx.fillStyle=c.health>CAR_MAX_HEALTH*.7?'#9cde81':c.health>CAR_MAX_HEALTH*.3?'#f0b94f':'#ea6546';ctx.fillRect(c.x-13,c.y-20,26*Math.max(0,c.health)/CAR_MAX_HEALTH,3)}}

  // Browser-hosted rooms and the dedicated Node server use the same game rules.
  const remotePeers = new Map();
  const guestPrediction = dedicatedMode?null:window.NocnyKursGuestPrediction.create();
  let simulationTick = 0;
  let lastGuestSnapshotTick = -1;
  let guestPadActionHeld=false,guestPadWeaponSwitchHeld=false,guestWeaponSwitch=0;

  function gameSnapshot(){
    return {
      running,teamScore,bonusScore,winnerId,finalResults,wantedLevel,tick:simulationTick,trafficLightTime,
      status:document.querySelector('#status').textContent.slice(0,90),
       statusKey:currentStatus?.key||null,statusParams:currentStatus?.vars||{},
      players:players.map(p=>({
        id:p.id,source:p.source,sourceId:p.sourceId,name:playerNames.normalize(p.name),x:p.x,y:p.y,score:p.score,cash:p.cash||0,deliveries:p.deliveries||0,convoys:p.convoys||0,kills:p.kills||0,collectedBodies:p.collectedBodies||0,
        hits:p.hits,color:p.color,maxHealth:p.maxHealth,health:p.health,alive:p.alive,ghost:Boolean(p.ghost),
        facing:p.facing,bodyFacing:p.bodyFacing,walk:p.walk,fireHeld:p.fireHeld,jumpTime:p.jumpTime||0,jumpHeld:Boolean(p.jumpHeld),jumpSafeX:p.jumpSafeX??null,jumpSafeY:p.jumpSafeY??null,bazookaAmmo:p.bazookaAmmo||0,pistolAmmo:p.pistolAmmo||0,knifeSwing:p.knifeSwing||0,
        weapon:p.weapon??null,invuln:p.invuln,wastedTimer:p.wastedTimer,stun:p.stun,moveTime:p.moveTime,lastAppliedInputSeq:p.lastAppliedInputSeq||0,carId:p.car?.id??null,enterTargetId:p.enterTargetId??null,gear:p.gear==='R'?'R':'F',vape:true
      })),
      cars:cars.map(c=>({
        id:c.id,type:c.type||'car',x:c.x,y:c.y,angle:c.angle,speed:c.speed,color:c.color,
        health:c.health,destroyed:c.destroyed,cashConvoy:Boolean(c.cashConvoy),brakeLight:c.brakeLight,
        turnSignal:c.turnSignal,driverId:c.driver?.id??null,npcInside:Boolean(c.npcInside),
        pursuitOwnerId:c.pursuitOwnerId??null
      })),
      carDrivers:carDrivers.map(owner=>({id:owner.id,carId:owner.carId,x:owner.x,y:owner.y,
        color:owner.color,facing:owner.facing,bodyFacing:owner.bodyFacing,walk:owner.walk,
        stun:owner.stun,hp:owner.hp,maxHp:owner.maxHp,pursuitCarId:owner.pursuitCarId??null})),
      guards:guards.map(g=>({
        id:g.id,x:g.x,y:g.y,color:g.color,facing:g.facing,bodyFacing:g.bodyFacing,
        walk:g.walk,stun:g.stun,hp:g.hp,invuln:g.invuln
      })),
      parcels,cashPacks,bazookaDrops,pistolDrops,medkits,
      bullets:bullets.slice(-36).map(b=>({x:b.x,y:b.y,vx:b.vx,vy:b.vy,team:b.team,rocket:Boolean(b.rocket)})),
      explosions:explosions.slice(-12),
      muzzleFlashes:muzzleFlashes.slice(-12)
    };
  }

  // Persistent visual traces travel separately from 60 Hz physics snapshots.
  // Compact, quantized tuples keep the entire history well below the relay's
  // 16 KiB message limit, even with 220 skid marks and 64 death remains.
  function makeTraces(){
    return {
      skidMarks:skidMarks.map(m=>[Math.round(m.x),Math.round(m.y),Math.round(m.angle*1000),Math.round(m.age*1000)]),
      deathRemains:deathRemains.map(r=>[Math.round(r.x),Math.round(r.y),Math.round(r.bodyFacing*1000),r.color,Math.round(deathRemainVisualAge(r)*1000),r.npc?1:0])
    };
  }
  function applyTraces(data){
    if(!data||!Array.isArray(data.skidMarks)||!Array.isArray(data.deathRemains)||
      data.skidMarks.length>MAX_SKID_MARKS||data.deathRemains.length>MAX_DEATH_REMAINS)return;
    const validXY=(x,y)=>Number.isFinite(x)&&Number.isFinite(y)&&x>=0&&x<=world.w&&y>=0&&y<=world.h;
    const marks=[];
    for(const m of data.skidMarks){
      if(!Array.isArray(m)||m.length!==4||!validXY(m[0],m[1])||!Number.isFinite(m[2])||!Number.isFinite(m[3]))return;
      marks.push({x:m[0],y:m[1],angle:m[2]/1000,age:clamp(m[3]/1000,0,SKID_MARK_LIFETIME),lifetime:SKID_MARK_LIFETIME});
    }
    const remains=[];
    for(const r of data.deathRemains){
      // Five-field tuples from older clients are player remains; six fields
      // distinguish short-lived NPC remains from long-lived player outlines.
      if(!Array.isArray(r)||(r.length!==5&&r.length!==6)||!validXY(r[0],r[1])||!Number.isFinite(r[2])||
        typeof r[3]!=='string'||!/^#[0-9a-f]{6}$/i.test(r[3])||!Number.isFinite(r[4])||
        (r.length===6&&r[5]!==0&&r[5]!==1))return;
      const npc=r[5]===1,age=r[4]/1000;
      if(age<0||age>=remainLifetime({npc}))continue;
      remains.push({x:r[0],y:r[1],bodyFacing:r[2]/1000,color:r[3],age,npc});
    }
    skidMarks=marks;
    deathRemains=remains;
  }

  // Client-side physics only: never collect parcels, hit pedestrians or apply
  // damage here. The host remains authoritative for every gameplay event.
  function predictGuestWalk(p,dx,dy,dt,availableCars=cars,availablePlayers=players){
    prepareJumpLanding(p,availableCars,availablePlayers);
    if(p.stun>0){p.stun=Math.max(0,p.stun-dt);p.moveTime=0;p.walk=0;return}
    const length=Math.hypot(dx,dy);
    p.walk=0;
    if(length<.01){p.moveTime=0;return}
    p.facing=Math.atan2(dy,dx);
    const speed=PLAYER_RUN_SPEED*(.5+.5*Math.min(.5,p.moveTime||0)/.5);
    const intensity=Math.min(1,length),startX=p.x,startY=p.y;
    const nx=clamp(p.x+dx/length*speed*dt*intensity,14,world.w-14);
    const ny=clamp(p.y+dy/length*speed*dt*intensity,14,world.h-14);
    const otherPlayer=(x,y)=>availablePlayers.some(q=>q.id!==p.id&&q.alive!==false&&!q.car&&q.carId==null&&Math.hypot(x-q.x,y-q.y)<20);
    if(!walkObstacle(p,nx,p.y,availableCars)&&!otherPlayer(nx,p.y))p.x=nx;
    if(!walkObstacle(p,p.x,ny,availableCars)&&!otherPlayer(p.x,ny))p.y=ny;
    rememberJumpGround(p,availableCars,availablePlayers);
    p.moveTime=Math.min(.5,(p.moveTime||0)+dt);
    p.walk=dt>0?Math.min(1,Math.hypot(p.x-startX,p.y-startY)/(PLAYER_RUN_SPEED*dt)):0;
    if(p.walk>0)p.bodyFacing=p.facing;
  }

  function predictGuestDrive(p,c,dx,dy,dt){
    if(!c||c.destroyed)return;
    const previousSpeed=c.speed||0;
    if(p.stun>0){p.stun=Math.max(0,p.stun-dt);c.speed*=.92;return}
    const spec=vehicleSpec(c),throttle=clamp(-dy,0,1),brake=clamp(dy,0,1);
    if(brake>0){
      // The brake first stops forward travel, then reverses while held.
      c.speed=c.speed>0?Math.max(0,c.speed-brake*spec.acceleration*1.7*dt)
        :c.speed-brake*spec.acceleration*.7*dt;
    }else if(throttle>0){
      // Forward throttle also stops reverse travel before accelerating.
      c.speed=c.speed<0?Math.min(0,c.speed+throttle*spec.acceleration*1.7*dt)
        :c.speed+throttle*spec.acceleration*dt;
    }
    c.speed*=Math.pow(spec.drag,dt*60);
    c.speed=clamp(c.speed,-spec.reverseSpeed,spec.forwardSpeed);
    const previousAngle=c.angle;
    steerCarRelative(c,dx,dt,spec);
    const nx=c.x+Math.cos(c.angle)*c.speed*dt,ny=c.y+Math.sin(c.angle)*c.speed*dt;
    const collision=vehicleBlockedAt(c,nx,ny,c.angle)||vehicleAtBoundary(c,nx,ny,c.angle)||
      cars.some(other=>other.id!==c.id&&!other.destroyed&&carOverlapsAt(c,nx,ny,c.angle,other));
    if(!collision){c.x=nx;c.y=ny}
    else{c.angle=previousAngle;c.speed*=c.type===TRUCK_TYPE?-.12:-.22}
    updateBrakeLight(c,previousSpeed,dt,brake>0||collision);
    p.x=c.x;p.y=c.y;p.facing=c.angle;p.bodyFacing=c.angle;
    p.walk=Math.abs(c.speed)>.5?1:0;
  }

  // Replay inputs that the host has not yet simulated to estimate the present
  // authoritative pose instead of pulling the local player backwards by RTT.
  function guestReplayTargets(state){
    const playerTargets=new Map(),carTargets=new Map();
    const authoritative=state.players.find(p=>p.id===multiplayer.playerId);
    if(!authoritative)return{playerTargets,carTargets};
    const pending=guestPrediction.acknowledge(authoritative.lastAppliedInputSeq);
    if(!state.running||authoritative.alive===false||!pending.length)return{playerTargets,carTargets};
    const p={...authoritative};
    const c=state.cars.find(car=>car.id===p.carId);
    const car=c?{...c}:null;
    for(const input of pending){
      p.gear=input.gear==='R'?'R':'F';
      stepJump(p,Boolean(input.jump),1/60);
      if(car)predictGuestDrive(p,car,input.dx||0,input.dy||0,1/60);
      else{const chase=chaseCarInput(p,input.dx||0,input.dy||0,true,state.cars);predictGuestWalk(p,chase.dx,chase.dy,1/60,state.cars,state.players)};
    }
    playerTargets.set(p.id,{x:p.x,y:p.y,jumpTime:p.jumpTime||0,jumpHeld:Boolean(p.jumpHeld),jumpSafeX:p.jumpSafeX??null,jumpSafeY:p.jumpSafeY??null});
    if(car)carTargets.set(car.id,{x:car.x,y:car.y,angle:car.angle});
    return{playerTargets,carTargets};
  }

  function predictGuest(dt){
    trafficLightTime+=dt;
    updateTireMarks(dt);
    updateDeathRemains(dt);
    if(!running)return;
    const p=players.find(player=>player.id===multiplayer.playerId);
    const localCar=p?.car;
    // Advance other objects while waiting for network packets. Their recent
    // server-measured velocities are bounded and stop after a short outage.
    guestPrediction.advance('car',cars,dt,new Set(localCar?[localCar.id]:[]));
    guestPrediction.advance('player',players,dt,new Set(p?[p.id]:[]));
    guestPrediction.advance('guard',guards,dt);
    guestPrediction.advance('carDriver',carDrivers,dt);
    for(const other of players)if(other!==p)other.jumpTime=Math.max(0,(other.jumpTime||0)-dt);
    if(p&&p.alive!==false&&!p.ghost){
      const input=guestInput();stepJump(p,Boolean(input.jump),dt);
      p.gear=input.gear==='R'?'R':'F';
      if(localCar)predictGuestDrive(p,localCar,input.dx,input.dy,dt);
      else{const chase=chaseCarInput(p,input.dx,input.dy,true);predictGuestWalk(p,chase.dx,chase.dy,dt)};
      p.fireHeld=input.fire;
    }
    // Bullets are visual on guests; collisions and damage still belong to host.
    for(const bullet of bullets){
      bullet.x+=(bullet.vx||0)*dt;
      bullet.y+=(bullet.vy||0)*dt;
    }
  }

  function applySnapshot(state){
    if(!state||!Array.isArray(state.players)||!Array.isArray(state.cars)||state.players.length>8||state.cars.length>160)return;
    // Never rewind to a delayed frame from an earlier authoritative tick.
    if(Number.isFinite(state.tick)&&state.tick<=lastGuestSnapshotTick)return;
    if(Number.isFinite(state.tick))lastGuestSnapshotTick=state.tick;
    const previousRunning=running;
    if(!previousRunning&&state.running){
      // A new round may reuse IDs at completely different coordinates.
      guestPrediction.resetMotion();
      if(!buildings.length||!hospital)restoreStaticWorld();
      players=[];cars=[];guards=[];carDrivers=[];skidMarks=[];deathRemains=[];
    }
    const targets=guestReplayTargets(state);
    // Measure actual pre-reconciliation drift, not the visually smoothed offset.
    const currentSelf=players.find(p=>p.id===multiplayer.playerId);
    const serverSelf=state.players.find(p=>p.id===multiplayer.playerId);
    if(previousRunning&&state.running&&currentSelf&&serverSelf&&
       currentSelf.carId===serverSelf.carId&&currentSelf.alive===serverSelf.alive){
      const localPose=currentSelf.car||currentSelf;
      const serverCar=state.cars.find(c=>c.id===serverSelf.carId);
      const target=(serverCar&&targets.carTargets.get(serverCar.id))||
        (!serverCar&&targets.playerTargets.get(serverSelf.id))||serverCar||serverSelf;
      window.NocnyKursTelemetry?.correction(Math.hypot(localPose.x-target.x,localPose.y-target.y));
    }
    if(Number.isFinite(state.trafficLightTime)&&state.trafficLightTime>=0)trafficLightTime=state.trafficLightTime;
    const ownServer=state.players.find(p=>p.id===multiplayer.playerId);
    const ownedCars=new Set(ownServer?.carId!==null&&ownServer?.carId!==undefined?[ownServer.carId]:[]);
    const ownedPlayers=new Set(multiplayer.playerId!==null?[multiplayer.playerId]:[]);
    cars=guestPrediction.reconcile('car',cars,state.cars,state.tick,targets.carTargets,ownedCars);
    players=guestPrediction.reconcile('player',players,state.players.map(p=>({...p,name:playerNames.normalize(p.name)})),state.tick,targets.playerTargets,ownedPlayers);
    guards=guestPrediction.reconcile('guard',guards,Array.isArray(state.guards)?state.guards:[],state.tick);
    carDrivers=guestPrediction.reconcile('carDriver',carDrivers,Array.isArray(state.carDrivers)?state.carDrivers:[],state.tick);
    const byPlayer=new Map(players.map(p=>[p.id,p]));
    const byCar=new Map(cars.map(c=>[c.id,c]));
    for(const p of players)p.car=byCar.get(p.carId)||null;
    const ownGuest=players.find(p=>p.id===multiplayer.playerId);
    if(ownGuest){
      ownGuest.name=localPlayerName;
      if(currentSelf?.alive!==false&&ownGuest.alive!==false&&!ownGuest.car)ownGuest.landingSlide=currentSelf?.landingSlide;
    }
    for(const c of cars)c.driver=byPlayer.get(c.driverId)||null;
    parcels=Array.isArray(state.parcels)?state.parcels:[];
    cashPacks=Array.isArray(state.cashPacks)?state.cashPacks:[];
    bazookaDrops=Array.isArray(state.bazookaDrops)?state.bazookaDrops:[];
    pistolDrops=Array.isArray(state.pistolDrops)?state.pistolDrops:[];
    medkits=Array.isArray(state.medkits)?state.medkits:[];
    // Older dedicated servers send ambulance poses outside the car array.
    legacyAmbulances=Array.isArray(state.ambulances)?state.ambulances.slice(0,AMBULANCE_LIMIT).filter(car=>
      car&&Number.isFinite(car.x)&&Number.isFinite(car.y)&&Number.isFinite(car.angle)).map(car=>({...car,npcInside:true})):[];
    bullets=Array.isArray(state.bullets)?state.bullets:[];
    explosions=Array.isArray(state.explosions)?state.explosions:[];
    muzzleFlashes=Array.isArray(state.muzzleFlashes)?state.muzzleFlashes:[];
    teamScore=state.teamScore||0;winnerId=Number.isInteger(state.winnerId)?state.winnerId:null;finalResults=Array.isArray(state.finalResults)?state.finalResults:[];
    bonusScore=state.bonusScore||0;
    if(wantedLevel!==state.wantedLevel){wantedLevel=state.wantedLevel||0;refreshWantedHud()}
    if(!running)groupCameraReady=false;
    running=Boolean(state.running);
    multiplayer.setGameRunning(running);
    refreshCompetitionHud();
    if(typeof state.statusKey==='string'&&state.statusKey.length<50){setGameStatus(state.statusKey,state.statusParams&&typeof state.statusParams==='object'?state.statusParams:{})}else{currentStatus=null;document.querySelector('#status').textContent=String(state.status||translate('enRoute'))}
    if(running){
      overlay.classList.add('hidden');
      document.querySelector('#round-label').textContent=translate('round');
    }else if(winnerId!==null){
      document.querySelector('#round-label').textContent=translate('roundDone');
      showFinishText();
      
      overlay.classList.remove('hidden');
    }else if(previousRunning){
      overlay.classList.remove('hidden');
    }
    renderPlayers();refreshAmmoHud();
  }

  function guestInput(){
    const pads=navigator.getGamepads?navigator.getGamepads():[];
    const pad=Array.from(pads||[]).find(p=>p&&p.connected!==false);
    const own=players.find(p=>p.id===multiplayer.playerId);
    const isPlayerOne=multiplayer.playerId===1;
    const padInput=samplePadInput(pad,Boolean(own?.car),undefined,isPlayerOne);
    const {dx:padX,dy:padY,action}=padInput;
    if(action&&!guestPadActionHeld)multiplayer.sendAction();
    guestPadActionHeld=action;
    if(running&&padInput.switchWeapon&&!guestPadWeaponSwitchHeld)guestWeaponSwitch++;
    guestPadWeaponSwitchHeld=padInput.switchWeapon;
    const touchY=own?.car?Number(touchState.brake)-Number(touchState.forward):touchStick.y;
    return {
      dx:clamp((held.has('d')||held.has('arrowright')?1:0)-(held.has('a')||held.has('arrowleft')?1:0)+touchStick.x+padX,-1,1),
      dy:clamp((held.has('s')||held.has('arrowdown')?1:0)-(held.has('w')||held.has('arrowup')?1:0)+touchY+padY,-1,1),
      jump:Boolean(held.has('controlleft')||held.has('end')||touchState.jump||padInput.jump),
      fire:Boolean(held.has(' ')||held.has('shiftright')||touchState.fire||padInput.fire),
      weaponSwitch:guestWeaponSwitch,
      gear:'F',
      name:localPlayerName
    };
  }

  // Fit the bounding rectangle of every living player in CSS pixels.
  // Ease the center and zoom-in; zoom-out and edge protection stay immediate.
  function groupCameraFrame(points,viewport,previous,dt){
    const width=viewport.width,height=viewport.height;
    const marginX=Math.min(55,width/4),marginY=Math.min(55,height/4);
    const minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x));
    const minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y));
    const targetZoom=clamp(Math.min(
      (width-2*marginX)/Math.max(1,maxX-minX),
      (height-2*marginY)/Math.max(1,maxY-minY)),.5,1);
    const blend=1-Math.exp(-6*Math.max(0,dt));
    const scale=clamp(Math.min(targetZoom,previous.zoom+(targetZoom-previous.zoom)*blend),.5,1);
    function follow(min,max,old,halfView){
      const target=(min+max)/2;
      const eased=Number.isFinite(old)?old+(target-old)*blend:target;
      // Keep the group visible whenever it fits on this axis. At the zoom
      // floor a wider group cannot fit; still ease toward its neutral center.
      const lower=max-halfView,upper=min+halfView;
      return lower<=upper?clamp(eased,lower,upper):eased;
    }
    return {zoom:scale,x:follow(minX,maxX,previous.x,width/(2*scale)),y:follow(minY,maxY,previous.y,height/(2*scale))};
  }
  let groupCameraReady=false;
  function updateGroupCamera(dt){
    if(!running){groupCameraReady=false;return}
    if(w()<=0||h()<=0)return;
    const active=livingPlayers();
    const points=active.length?active.map(pos):[{x:hospital?.exitX??world.w/2,y:hospital?.exitY??world.h/2}];
    const frame=groupCameraFrame(points,{width:w(),height:h()},groupCameraReady?{x:cam.x,y:cam.y,zoom}:{zoom},dt);
    cam.x=frame.x;cam.y=frame.y;zoom=frame.zoom;groupCameraReady=true;
    document.querySelector('#zoom-indicator').textContent=translate('camera')+' '+Math.round(zoom*100)+'%';
  }

  const multiplayerCallbacks={
    onGuest(){
      restoreStaticWorld();
      groupCameraReady=false;
      guestPadWeaponSwitchHeld=false;guestWeaponSwitch=0;
      legacyAmbulances=[];
      guestPrediction.reset();lastGuestSnapshotTick=-1;localNamedPlayer=null;players=[];skidMarks=[];deathRemains=[];running=false;held.clear();touchState.forward=touchState.brake=touchState.weapon=false;lastUi='';renderPlayers();
    },
    onPeerJoin(peerId){
      if(remotePeers.has(peerId))return remotePeers.get(peerId).id;
      const id=freeSlot(connectedPadSlots());
      if(id===null)return null;
      const player=createPlayer('remote',id,id);
      if(!player)return null;
      remotePeers.set(peerId,player);
      return player.id;
    },
    onPeerLeft(peerId){
      const p=remotePeers.get(peerId);
      if(!p)return;
      if(p.car&&p.car.driver===p){p.car.driver=null;p.car.speed=0}
      players=players.filter(player=>player!==p);bullets=bullets.filter(b=>b.owner!==p.id);
      remotePeers.delete(peerId);
      lastUi='';renderPlayers();
    },
    onInput(peerId,input){
      const p=remotePeers.get(peerId);
      if(!p)return;
      p.netX=Number.isFinite(input.dx)?clamp(input.dx,-1,1):0;
      p.netY=Number.isFinite(input.dy)?clamp(input.dy,-1,1):0;
      p.gear=input.gear==='R'?'R':'F';
      p.netFire=input.fire===true;p.netJump=input.jump===true;
      const previousWeaponSwitch=p.netWeaponSwitch||0;
      if(Number.isSafeInteger(input.weaponSwitch)&&input.weaponSwitch>previousWeaponSwitch){
        p.netWeaponSwitch=input.weaponSwitch;
        cycleWeapon(p,input.weaponSwitch-previousWeaponSwitch);
      }
      if(typeof input.name==='string'){const name=playerNames.normalize(input.name);if(p.name!==name){p.name=name;renderPlayers()}}
      if(Number.isSafeInteger(input.seq)&&input.seq>=0)p.netInputSeq=input.seq;
      p.netInputAt=performance.now();
    },
    onInteract(peerId){
      const p=remotePeers.get(peerId);
      if(!p||!running||performance.now()-(p.netActionAt||-1000)<200)return;
      p.netActionAt=performance.now();
      enterOrExit(p);
    },
    onConnectionLost(){if(multiplayer.role==='guest'){guestPrediction.reset();lastGuestSnapshotTick=-1;}},
    onWelcome(){lastUi='';},
    onLatency(ms){guestPrediction.observeLatency(ms);},
    onSnapshot:applySnapshot,
    onTraces:applyTraces,
    getInput:()=>guestPrediction.recordInput(guestInput())
  };
  const multiplayer=dedicatedMode
    ? {role:'host',setGameRunning(){}}
    : window.NocnyKursMultiplayer.create(multiplayerCallbacks);

  if(dedicatedMode){
    let restartAfterFinish=0;
    window.NocnyKursDedicated={
      join(peerId){
        const id=multiplayerCallbacks.onPeerJoin(peerId);
        if(id!==null&&!running&&winnerId===null)start();
        return id;
      },
      leave(peerId){multiplayerCallbacks.onPeerLeft(peerId)},
      input(peerId,input){multiplayerCallbacks.onInput(peerId,input)},
      interact(peerId){multiplayerCallbacks.onInteract(peerId)},
      tick(dt=1/60){
        const step=Math.min(Math.max(dt,0),.05);
        if(!running&&winnerId!==null&&remotePeers.size){
          restartAfterFinish+=step;
          if(restartAfterFinish>=12){restartAfterFinish=0;start()}
        }else restartAfterFinish=0;
        simulationTick++;
        update(step);
      },
      snapshot:gameSnapshot,
      traces:makeTraces,
      get playerCount(){return remotePeers.size}
    };
    return;
  }

  // Local gameplay is simulated here; in online mode the server owns physics,
  // and this timer only predicts between authoritative snapshots.
  window.NocnyKursSimulationClock.create(dt => {
    if(multiplayer.role==='guest')predictGuest(dt);else{simulationTick++;update(dt)}
  });

  // A display-only monitor: never send input or trigger an action from rendering.
  let inputHudLast=-Infinity,inputHudSignature='';
  function keyboardHud(index,isPlayerOne=false){
    const keys=keysets[index],binding=controls[index];
    const inputs=[['left',keys[1]],['up',keys[0]],['down',keys[2]],['right',keys[3]],['fire',binding.fire],['action',binding.enter],['jump',binding.jump]];
    if(isPlayerOne)inputs.push(['weapon',controls[0].weapon]);
    return inputs.map(([input,key])=>({input,label:keyLabel(key),active:held.has(key)}));
  }
  function stickHud(x,y,label){
    return {input:'stick',label,active:Math.abs(x)>0||Math.abs(y)>0,
      axes:[Math.round(x*100),Math.round(y*100)]};
  }
  function padHud(pad,triggerHeld,inCar=false,isPlayerOne=false){
    const input=samplePadInput(pad,false,triggerHeld);
    return [stickHud(input.dx,input.dy,'LS'),
      {input:inCar?'up':'jump',label:'A',active:input.a},
      {input:'down',label:'B',active:input.b},
      {input:'action',label:'X',active:input.x},
      {input:isPlayerOne?'weapon':'fire',label:'Y',active:input.y},
      {input:'fire',label:'RT',active:input.rt}];
  }
  function touchHud(p){
    const icon=(input,action,active)=>({input,icon:action,active:Boolean(active)});
    const items=[stickHud(touchStick.x,touchStick.y,'◎'),icon('fire','fire',touchState.fire),icon('action','interact',touchState.interact),icon('jump','jump',touchState.jump)];
    if(p.car)items.push(icon('down','brake',touchState.brake),icon('up','forward',touchState.forward));
    else items.push(icon('weapon','weapon',touchState.weapon));
    return items;
  }
  function inputGroupsForHud(p,guest,pads){
    const groups=[];
    const add=(device,items,primary=false)=>groups.push({device,items,primary});
    if(guest){
      add('keyboard',keyboardHud(0,p.id===1),!touchAvailable()&&!pads.some(Boolean));
      add('keyboard',keyboardHud(1));
      const pad=pads.find(pad=>pad&&pad.connected!==false);
      if(pad)add('pad',padHud(pad,undefined,Boolean(p.car),p.id===1),true);
      if(touchAvailable())add('touch',touchHud(p),!pad);
    }else{
      if(p.source==='key')add('keyboard',keyboardHud(p.sourceId,p.id===1),true);
      if(p.source==='pad')add('pad',padHud(pads[p.sourceId],p.padTriggerHeld,Boolean(p.car),p.id===1),true);
      if(p.id===1&&(p.source==='touch'||touchAvailable()))add('touch',touchHud(p),p.source==='touch');
    }
    // Always retain the main device; other devices are shown when actually used.
    return groups.filter(g=>g.primary||g.items.some(item=>item.active));
  }
  function renderInputKey(item){
    const icon=item.icon?document.querySelector('[data-touch-action="'+item.icon+'"] svg')?.outerHTML:'';
    const stick=item.axes?'<span class="gt-input-stick" aria-hidden="true"><i style="--axis-x:'+item.axes[0]/5+'%;--axis-y:'+item.axes[1]/5+'%"></i></span><span class="gt-input-axes">'+item.axes.join(',')+'</span>':'';
    return '<span class="gt-input-key'+(item.active?' is-active':'')+'" data-input="'+item.input+'">'+(icon||playerNames.escapeHtml(item.label||''))+stick+'</span>';
  }
  function updateInputHud(now){
    if(now-inputHudLast<40)return;
    inputHudLast=now;
    const hud=document.querySelector('#gt-input-hud');
    if(!hud)return;
    const guest=multiplayer.role==='guest';
    const settings=document.querySelector('#gt-settings-dialog');
    const roster=guest?players.filter(p=>p.id===multiplayer.playerId):players.filter(p=>p.source!=='remote');
    hud.hidden=!running||!roster.length||Boolean(settings?.open);
    if(hud.hidden){inputHudSignature='';return}
    const pads=Array.from(navigator.getGamepads?navigator.getGamepads():[]).map(p=>p&&p.connected!==false?p:null);
    const rows=roster.slice().sort((a,b)=>a.id-b.id).map(p=>({
      id:p.id,color:colors[(p.id-1)%colors.length],groups:inputGroupsForHud(p,guest,pads)
    }));
    const signature=JSON.stringify(rows);
    if(signature===inputHudSignature)return;
    inputHudSignature=signature;
    hud.innerHTML=rows.map(({id,color,groups})=>'<div class="gt-input-player" data-player="'+id+'" style="--input-color:'+color+'"><b>P'+id+'</b>'+groups.map(g=>'<span class="gt-input-device" data-device="'+g.device+'">'+g.items.map(renderInputKey).join('')+'</span>').join('')+'</div>').join('');
  }
  function loop(now){
    delta=Math.min((now-last)/1000,.05);last=now;
    updateGroupCamera(delta);
    const renderStart=performance.now();
    drawWorld(now/1000);
    updateTouchDriveButtons();
    updateInputHud(now);
    const scoreboard=document.querySelector('#gt-scoreboard');if(scoreboard&&scoreboard.hidden===(running||winnerId!==null))renderPlayers(true);
    const renderMs=performance.now()-renderStart;
    reportPerformance(now,renderMs);
    window.NocnyKursTelemetry?.frame(now,renderMs);
    requestAnimationFrame(loop);
  }
  window.addEventListener('keydown',e=>{const k=keyboardKey(e);if(e.target instanceof HTMLInputElement||e.target instanceof HTMLButtonElement)return;if(['arrowup','arrowdown','arrowleft','arrowright',' ','controlleft','end'].includes(k))e.preventDefault();held.add(k);
    if(k===controls[0].weapon){
      if(e.repeat||!running)return;
      if(multiplayer.role==='guest'){
        if(multiplayer.playerId===1)guestWeaponSwitch++;
      }else cycleWeapon(players.find(p=>p.id===1));
      return;
    }
    if(multiplayer.role==='guest'){if((k==='e'||k==='controlright')&&!e.repeat)multiplayer.sendAction();return}if(k==='enter'){if(running&&!e.repeat&&keyboardPlayerCount()<keyboardPlayerLimit){const i=keysets.findIndex((_,n)=>!players.some(p=>p.source==='key'&&p.sourceId===n));if(i>=0)joinKeyboard(i)}return}if(k==='enter')return;
    const existing=players.find(p=>p.source==='key'&&controls[p.sourceId].enter===k);if(existing&&running&&!e.repeat){enterOrExit(existing);return}
    const i=keysets.findIndex(s=>s.includes(k));if(i>=0&&!players.some(p=>p.source==='key'&&p.sourceId===i)&&keyboardPlayerCount()<keyboardPlayerLimit&&players.length<8)joinKeyboard(i)
  },{passive:false});
  window.addEventListener('keyup',e=>{held.delete(keyboardKey(e))});
  window.addEventListener('blur',()=>{held.clear();resetTouchStick();touchState.fire=touchState.interact=touchState.jump=touchState.weapon=false;touchState.forward=touchState.brake=false;for(const p of players){p.padFireHeld=false;p.padTriggerHeld=false;setFireHeld(p,false)}});
  window.NocnyKursLocale.onChange(()=>{
    lastUi='';renderPlayers();refreshWantedHud();
    document.querySelector('#round-label').textContent=translate(running||winnerId===null?'round':'roundDone');
    document.querySelector('#zoom-indicator').textContent=translate('camera')+' '+Math.round(zoom*100)+'%';
    if(currentStatus)setGameStatus(currentStatus.key,currentStatus.vars);refreshAmmoHud();
    if(winnerId!==null&&!running)showFinishText();
  });
  setGameStatus('cityWait');
  document.querySelector('#round-label').textContent=translate('round');
  document.querySelector('#zoom-indicator').textContent=translate('camera')+' 100%';
  document.querySelector('#gt-scoreboard-toggle')?.addEventListener('click',event=>{
    const board=document.querySelector('#gt-scoreboard'),toggle=document.querySelector('#gt-scoreboard-toggle');
    const expanded=toggle.getAttribute('aria-expanded')!=='true';
    setScoreboardExpanded(board,toggle,expanded);renderPlayers(true);
    if(event.detail>0)toggle.blur();
  });
  document.querySelector('#start').addEventListener('click',event=>{start();if(running)event.currentTarget.blur()});bindTouchControls();renderPlayers();requestAnimationFrame(loop);
})();
