(() => {
  const canvas=document.querySelector('#city'),ctx=canvas.getContext('2d'),overlay=document.querySelector('#overlay');
  const colors=['#d6f36a','#ff806a','#72d9d0','#c99aff','#ffcb66','#74a9ff','#ff8fc2','#a4e887'];
  const keysets=[['w','a','s','d'],['arrowup','arrowleft','arrowdown','arrowright']];
  const controls=[{enter:'e',fire:'q'},{enter:'shift',fire:'.'}];
  const keyboardPlayerLimit=2,controllerFireButton=7;
  const world={w:2800,h:2200},roadsX=[120,630,1140,1650,2160,2670],roadsY=[120,510,900,1290,1680,2070],roadWidth=122;
  const held=new Set(),padALatch=new Set(),padBLatch=new Set(),touchStick={pointerId:null,x:0,y:0,intensity:0,element:null},touchState={fire:false,interact:false};
  const touchAvailable=()=>Boolean(navigator.maxTouchPoints>0||matchMedia('(pointer:coarse)').matches);
  let players=[],buildings=[],cars=[],guards=[],parcels=[],bullets=[],explosions=[],running=false,timeLeft=90,teamScore=0;
  let cam={x:1400,y:1100},zoom=1,last=performance.now(),delta=0,lastUi='',shotId=0;
  const w=()=>canvas.clientWidth,h=()=>canvas.clientHeight,rnd=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

  function resize(){const r=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.max(1,Math.round(r.width*dpr));canvas.height=Math.max(1,Math.round(r.height*dpr));ctx.setTransform(dpr,0,0,dpr,0,0)}
  new ResizeObserver(resize).observe(canvas);resize();
  function makeCity(){
    for(let yi=0;yi<roadsY.length-1;yi++)for(let xi=0;xi<roadsX.length-1;xi++){
      const left=roadsX[xi]+roadWidth/2+15,right=roadsX[xi+1]-roadWidth/2-15,top=roadsY[yi]+roadWidth/2+15,bottom=roadsY[yi+1]-roadWidth/2-15;
      const splitX=left+(right-left)*.52,splitY=top+(bottom-top)*.53;
      const blocks=[[left+8,top+8,splitX-left-18,splitY-top-18],[splitX+8,top+8,right-splitX-16,splitY-top-18],[left+8,splitY+8,splitX-left-18,bottom-splitY-16],[splitX+8,splitY+8,right-splitX-16,bottom-splitY-16]];
      for(const [x,y,bw,bh] of blocks){if(bw<45||bh<45)continue;const m=rnd(7,17);buildings.push({x:x+m,y:y+m,w:bw-m*2,h:bh-m*2,tone:Math.floor(rnd(0,4)),kind:Math.random()<.16?'yard':'building'})}
    }
  }
  function makeCars(){
    const palette=['#b84e42','#4f7791','#c29a50','#638261','#7b6797','#cf7048'];
    const parkedSpots=[[1178,900,0],[900,510,0],[1450,900,Math.PI],[1960,1290,0],[2400,1680,Math.PI],[900,2070,0],[630,290,Math.PI/2],[1140,700,Math.PI/2]];
    let id=0;
    cars=parkedSpots.map(([x,y,angle])=>({id:id++,x,y,angle,speed:0,driver:null,color:palette[id%palette.length],health:3,destroyed:false,traffic:false}));
    for(let row=1;row<=4;row++)for(let slot=0;slot<5;slot++){
      const y=roadsY[row],east=slot%2===0,lane=east?y-29:y+29;
      const route=east?[[2670,y-29],[2670,y+29],[120,y+29],[120,y-29]]:[[120,y+29],[120,y-29],[2670,y-29],[2670,y+29]];
      const x=roadsX[0]+250+slot*450;
      cars.push({id:id++,x,y:lane,angle:east?0:Math.PI,speed:92,driver:null,color:palette[id%palette.length],health:3,destroyed:false,traffic:true,trafficRoute:route,trafficIndex:0,trafficSpeed:92,trafficWait:0});
    }
  }
  makeCity();makeCars();
  function addParcel(){if(parcels.length>=13)return;const vertical=Math.random()<.5,x=vertical?roadsX[Math.floor(Math.random()*roadsX.length)]+rnd(-32,32):rnd(90,world.w-90),y=vertical?rnd(90,world.h-90):roadsY[Math.floor(Math.random()*roadsY.length)]+rnd(-32,32);parcels.push({x,y,phase:rnd(0,6.28)})}
  function pos(p){return p.car?{x:p.car.x,y:p.car.y}:p}
  function keyLabel(key){return({arrowup:'↑',arrowleft:'←',arrowdown:'↓',arrowright:'→',shift:'SHIFT',enter:'ENTER',' ':'SPACJA'})[key]||key.toUpperCase()}
  function playerButtons(p){
    const tags=[];
    if(p.source==='key'){
      keysets[p.sourceId].forEach(k=>tags.push(keyLabel(k)));
      tags.push(keyLabel(controls[p.sourceId].fire),keyLabel(controls[p.sourceId].enter),'ENTER','SPACJA');
    }else if(p.source==='pad'){
      tags.push('LEWY DRĄŻEK','KRZYŻAK','A · START / STRZAŁ');
      if(p.padSourceGame==='night')tags.push('RT · STRZAŁ','B · AKCJA');
    }
    if(p.id===1&&touchAvailable())tags.push('DOTYK GAŁKA',...(p.padSourceGame==='night'?['STRZAŁ','AKCJA']:[]));
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
      }else throw new Error('Unknown player control source');
      const binding=`${p.source}:${p.sourceId}`;
      if(bindings.has(binding))throw new Error('Control binding has more than one player owner');
      bindings.set(binding,p.id);
    }
  }
  function renderPlayers(){
    validatePlayerBindings();
    document.querySelector('#player-count').textContent=players.length;
    const key=players.map(p=>`${p.id},${p.source},${p.sourceId},${p.score},${p.hits},${p.car?1:0}`).join('|');if(key===lastUi)return;lastUi=key;
    const el=document.querySelector('#player-list');el.innerHTML=players.slice().sort((a,b)=>a.id-b.id).map(p=>`<div class="player-entry"><span class="swatch" style="background:${p.color};color:${p.color}"></span><b class="player-name">P${p.id}</b><span class="player-controls">${playerButtons(p)}</span></div>`).join('');
  }
  function keyboardPlayerCount(){return players.filter(p=>p.source==='key').length}
  function connectedPadSlots(){const slots=new Set(players.filter(p=>p.source==='pad').map(p=>p.sourceId+1));if(navigator.getGamepads)for(let i=0;i<navigator.getGamepads().length&&i<8;i++){const pad=navigator.getGamepads()[i];if(pad&&pad.connected!==false)slots.add(i+1)}return slots}
  function freeSlot(reserved=new Set(),except=null,preferred=null){const occupied=id=>players.some(p=>p!==except&&p.id===id);if(preferred&&!reserved.has(preferred)&&!occupied(preferred))return preferred;for(let id=1;id<=8;id++)if(!reserved.has(id)&&!occupied(id))return id;return null}
  function setPlayerId(p,id){const old=p.id;if(old===id)return;p.id=id;p.color=colors[(id-1)%colors.length];for(const b of bullets)if(b.owner===old)b.owner=id;lastUi='';}
  function moveKeyboardPlayers(reserved){const movers=players.filter(p=>p.source==='key'&&reserved.has(p.id)).sort((a,b)=>a.sourceId-b.sourceId),occupied=new Set(players.filter(p=>!movers.includes(p)).map(p=>p.id)),moves=[];for(const p of movers){let next=null;for(let id=1;id<=8;id++)if(!reserved.has(id)&&!occupied.has(id)){next=id;break}if(!next)return false;occupied.add(next);moves.push([p,next])}for(const[p,id]of moves)setPlayerId(p,id);return true}
  function createPlayer(source,sourceId,id){if(players.length>=8)return null;const base=players.length?pos(players[0]):{x:roadsX[2],y:roadsY[2]},spread=players.length?75:0;const p={id,source,sourceId,x:clamp(base.x+rnd(-spread,spread),30,world.w-30),y:clamp(base.y+rnd(-spread,spread),30,world.h-30),score:0,hits:0,color:colors[(id-1)%colors.length],stun:0,invuln:0,fireCooldown:0,fireHeld:false,padFireHeld:false,padTriggerHeld:false,facing:0,walk:0,car:null,padSourceGame:'night'};players.push(p);lastUi='';renderPlayers();if(!running){cam.x=p.x;cam.y=p.y}return p}
  function joinKeyboard(sourceId){
    const prior=players.find(p=>p.source==='key'&&p.sourceId===sourceId);if(prior)return prior;if(sourceId<0||sourceId>=keyboardPlayerLimit||keyboardPlayerCount()>=keyboardPlayerLimit)return null;
    const touched=players.find(p=>p.id===1&&p.source==='touch'&&sourceId===0);if(touched){touched.source='key';touched.sourceId=0;lastUi='';renderPlayers();return touched}
    if(players.length>=8)return null;const reserved=connectedPadSlots(),id=freeSlot(reserved,null,sourceId+1);if(!id)return null;return createPlayer('key',sourceId,id)
  }
  function ensureTouchP1(){let p=players.find(p=>p.id===1);if(p)return p;if(players.length>=8)return null;return createPlayer('touch',0,1)}
  function joinPad(index){
    if(index<0||index>=8)return null;const prior=players.find(p=>p.source==='pad'&&p.sourceId===index);if(prior)return prior;const target=index+1,occupant=players.find(p=>p.id===target);
    if(occupant&&occupant.source==='touch'&&target===1){occupant.source='pad';occupant.sourceId=index;occupant.padFireHeld=false;occupant.padTriggerHeld=false;lastUi='';renderPlayers();return occupant}
    if(players.length>=8)return null;const reserved=connectedPadSlots();reserved.add(target);if(occupant&&occupant.source==='key'&&!moveKeyboardPlayers(reserved))return null;if(players.some(p=>p.id===target))return null;return createPlayer('pad',index,target)
  }
  function touchAxes(){return{x:touchStick.x,y:touchStick.y}}
  function resetTouchStick(){touchStick.pointerId=null;touchStick.x=touchStick.y=touchStick.intensity=0;if(touchStick.element){touchStick.element.classList.remove('is-active');touchStick.element.style.setProperty('--stick-x','0px');touchStick.element.style.setProperty('--stick-y','0px')}}
  function updateTouchStick(event){if(!touchStick.element)return;const rect=touchStick.element.getBoundingClientRect(),maxTravel=Math.max(1,Math.min(rect.width,rect.height)*.34),dx=event.clientX-(rect.left+rect.width/2),dy=event.clientY-(rect.top+rect.height/2),distance=Math.hypot(dx,dy),limited=Math.min(distance,maxTravel),raw=limited/maxTravel,deadzone=.12;touchStick.intensity=raw<=deadzone?0:(raw-deadzone)/(1-deadzone);touchStick.x=distance?dx/distance*touchStick.intensity:0;touchStick.y=distance?dy/distance*touchStick.intensity:0;const knobX=distance?dx/distance*limited:0,knobY=distance?dy/distance*limited:0;touchStick.element.style.setProperty('--stick-x',`${knobX}px`);touchStick.element.style.setProperty('--stick-y',`${knobY}px`);touchStick.element.classList.toggle('is-active',touchStick.intensity>0)}
  function bindTouchControls(){const root=document.querySelector('#touch-controls'),stick=root?.querySelector('[data-touch-joystick]');if(!root||!stick)return;touchStick.element=stick;stick.addEventListener('pointerdown',event=>{if(touchStick.pointerId!==null)return;event.preventDefault();if(!ensureTouchP1())return;touchStick.pointerId=event.pointerId;stick.setPointerCapture(event.pointerId);updateTouchStick(event)});stick.addEventListener('pointermove',event=>{if(event.pointerId===touchStick.pointerId){event.preventDefault();updateTouchStick(event)}});const release=event=>{if(event.pointerId!==touchStick.pointerId)return;event.preventDefault();resetTouchStick()};stick.addEventListener('pointerup',release);stick.addEventListener('pointercancel',release);stick.addEventListener('lostpointercapture',release);root.querySelectorAll('[data-touch-action]').forEach(button=>{const action=button.dataset.touchAction;button.addEventListener('pointerdown',e=>{e.preventDefault();const p=ensureTouchP1();if(!p)return;button.setPointerCapture(e.pointerId);button.classList.add('is-pressed');if(action==='fire')touchState.fire=true;else if(running)enterOrExit(p)});const release=e=>{e.preventDefault();button.classList.remove('is-pressed');if(action==='fire')touchState.fire=false};button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release)})}
  function start(){if(running)return;if(!players.length){if(touchAvailable())ensureTouchP1();else joinKeyboard(0)}players.forEach(p=>{p.score=0;p.hits=0;p.stun=0;p.invuln=0;p.fireHeld=false;p.padFireHeld=false;p.padTriggerHeld=false;p.car=null});
    running=true;timeLeft=90;teamScore=0;bullets=[];parcels=[];explosions=[];makeCars();zoom=1;guards=[[1450,900],[365,510],[1640,510],[2440,900],[630,1680],[2160,1290]].map(([x,y],i)=>({id:100+i,x,y,color:['#f18161','#e8a14e','#db7258','#e5bf64','#e98561'][i%5],facing:0,walk:0,stun:0,hp:2,invuln:0}));const q=pos(players[0]);cam.x=q.x;cam.y=q.y;for(let i=0;i<11;i++)addParcel();
    document.querySelector('#score').textContent='0 / 12';document.querySelector('#timer').textContent='90';document.querySelector('#status').textContent='EKIPA W DRODZE';document.querySelector('#round-label').textContent='12 PRZESYŁEK';document.querySelector('#zoom-indicator').textContent='KADR 100%';lastUi='';renderPlayers();overlay.classList.add('hidden')
  }
  function finish(won){running=false;document.querySelector('#round-label').textContent=won?'KURS DOWIEZIONY':'KONIEC ZMIANY';document.querySelector('#status').textContent=won?'DOSTAWA KOMPLETNA':'KONIEC RUNDY';document.querySelector('#overlay-title').innerHTML=won?'Dobra robota.<br><em>Kurs dowieziony!</em>':'Zmiana <em>zakończona.</em>';document.querySelector('#overlay-copy').textContent=`Paczki: ${teamScore} / 12`;overlay.classList.remove('hidden')}
  function blocked(x,y,r=10){for(const b of buildings)if(x+r>b.x&&x-r<b.x+b.w&&y+r>b.y&&y-r<b.y+b.h)return true;return false}
  function carBlocksCircle(c,x,y,r){const dx=x-c.x,dy=y-c.y,cos=Math.cos(c.angle),sin=Math.sin(c.angle),localX=dx*cos+dy*sin,localY=-dx*sin+dy*cos,nearX=clamp(localX,-22,22),nearY=clamp(localY,-13,13);return(localX-nearX)**2+(localY-nearY)**2<r*r}
  function blockedByCar(x,y,r=10,ignore=null){for(const c of cars)if(!c.destroyed&&c.id!==ignore&&carBlocksCircle(c,x,y,r))return true;return false}
  function carOverlapsAt(a,ax,ay,angle,b){
    const axes=[[Math.cos(angle),Math.sin(angle)],[-Math.sin(angle),Math.cos(angle)],[Math.cos(b.angle),Math.sin(b.angle)],[-Math.sin(b.angle),Math.cos(b.angle)]],deltaX=b.x-ax,deltaY=b.y-ay;
    for(const [ux,uy] of axes){const aForward=Math.abs(ux*Math.cos(angle)+uy*Math.sin(angle)),aSide=Math.abs(-ux*Math.sin(angle)+uy*Math.cos(angle)),bForward=Math.abs(ux*Math.cos(b.angle)+uy*Math.sin(b.angle)),bSide=Math.abs(-ux*Math.sin(b.angle)+uy*Math.cos(b.angle));const reachA=22*aForward+13*aSide,reachB=22*bForward+13*bSide;if(Math.abs(deltaX*ux+deltaY*uy)>=reachA+reachB)return false}return true
  }
  function advanceTraffic(dt){
    for(const c of cars){
      if(!c.traffic||c.destroyed||c.driver)continue;
      c.trafficWait=Math.max(0,c.trafficWait-dt);if(c.trafficWait>0)continue;
      let [targetX,targetY]=c.trafficRoute[c.trafficIndex],dx=targetX-c.x,dy=targetY-c.y,distance=Math.hypot(dx,dy);
      if(distance<1){c.trafficIndex=(c.trafficIndex+1)%c.trafficRoute.length;[targetX,targetY]=c.trafficRoute[c.trafficIndex];dx=targetX-c.x;dy=targetY-c.y;distance=Math.hypot(dx,dy)}
      const angle=Math.atan2(dy,dx),step=Math.min(c.trafficSpeed*dt,distance),nx=c.x+Math.cos(angle)*step,ny=c.y+Math.sin(angle)*step,carHit=cars.some(other=>other!==c&&!other.destroyed&&carOverlapsAt(c,nx,ny,angle,other));
      if(!blocked(nx,ny,16)&&!carHit&&nx>15&&nx<world.w-15&&ny>15&&ny<world.h-15){c.x=nx;c.y=ny;c.angle=angle;c.speed=c.trafficSpeed;hitPedestrians(c);if(step>=distance-.01)c.trafficIndex=(c.trafficIndex+1)%c.trafficRoute.length}
      else{c.speed=0;c.trafficWait=.12}
    }
  }
  function blockedByPlayer(x,y,r=10,ignore=null){for(const p of players)if(p!==ignore&&!p.car&&Math.hypot(x-p.x,y-p.y)<r+10)return true;return false}
  function eject(p,c){const angle=Math.atan2(p.y-c.y,p.x-c.x);p.x=clamp(c.x+Math.cos(angle)*36,14,world.w-14);p.y=clamp(c.y+Math.sin(angle)*36,14,world.h-14);p.car=null;p.stun=.9;p.invuln=1.5}
  function enterOrExit(p){
    if(p.car){const c=p.car,side=c.angle+Math.PI/2;p.x=c.x+Math.cos(side)*34;p.y=c.y+Math.sin(side)*34;c.driver=null;c.speed=0;p.car=null;lastUi='';renderPlayers();return}
    let closest=null,dist=48;for(const c of cars)if(!c.destroyed&&!c.driver){const d=Math.hypot(c.x-p.x,c.y-p.y);if(d<dist){dist=d;closest=c}}
    if(closest){p.car=closest;closest.driver=p;closest.speed=0;p.x=closest.x;p.y=closest.y;lastUi='';renderPlayers()}
  }
  function walk(p,dx,dy,dt){if(p.stun>0){p.stun=Math.max(0,p.stun-dt);p.walk=0;return}const len=Math.hypot(dx,dy);p.walk=Math.min(1,len);if(len<.01)return;p.facing=Math.atan2(dy,dx);const intensity=Math.min(1,len),nx=clamp(p.x+dx/len*155*dt*intensity,14,world.w-14),ny=clamp(p.y+dy/len*155*dt*intensity,14,world.h-14);if(!blocked(nx,p.y,9)&&!blockedByCar(nx,p.y,10)&&!blockedByPlayer(nx,p.y,10,p))p.x=nx;if(!blocked(p.x,ny,9)&&!blockedByCar(p.x,ny,10)&&!blockedByPlayer(p.x,ny,10,p))p.y=ny}
  function drive(p,throttle,steer,dt){const c=p.car;if(!c||c.destroyed)return;if(p.stun>0){p.stun=Math.max(0,p.stun-dt);c.speed*=.92;return}c.speed+=throttle*465*dt;c.speed*=Math.pow(.975,dt*60);c.speed=clamp(c.speed,-172.5,427.5);const previousAngle=c.angle;c.angle+=steer*dt*1.5*(1.05+Math.min(Math.abs(c.speed)/150,1.4))*(c.speed< -3?-1:1);const nx=c.x+Math.cos(c.angle)*c.speed*dt,ny=c.y+Math.sin(c.angle)*c.speed*dt,carHit=cars.some(other=>other!==c&&!other.destroyed&&carOverlapsAt(c,nx,ny,c.angle,other));if(!blocked(nx,ny,16)&&!carHit&&nx>15&&nx<world.w-15&&ny>15&&ny<world.h-15){c.x=nx;c.y=ny;hitPedestrians(c)}else{c.angle=previousAngle;c.speed*=-.22}p.x=c.x;p.y=c.y;p.facing=c.angle;p.walk=Math.abs(c.speed)>.5?1:0}
  function hitPedestrians(c){for(const p of players){if(p.car||!carBlocksCircle(c,p.x,p.y,10))continue;eject(p,c);lastUi='';renderPlayers()}}
  function resolvePlayerCollisions(){
    for(let pass=0;pass<4;pass++)for(let i=0;i<players.length;i++)for(let j=i+1;j<players.length;j++){
      const a=players[i],b=players[j];if(a.car||b.car)continue;let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);if(d>=20)continue;if(d<.001){const angle=((a.id*17+b.id*31)%360)*Math.PI/180;dx=Math.cos(angle);dy=Math.sin(angle);d=1}const push=(20-d)/2,ax=a.x-dx/d*push,ay=a.y-dy/d*push,bx=b.x+dx/d*push,by=b.y+dy/d*push,clear=(p,x,y,other)=>x>=14&&x<=world.w-14&&y>=14&&y<=world.h-14&&!blocked(x,y,10)&&!blockedByCar(x,y,10)&&!players.some(q=>q!==p&&q!==other&&!q.car&&Math.hypot(x-q.x,y-q.y)<20);const canA=clear(a,ax,ay,b),canB=clear(b,bx,by,a);if(canA&&canB){a.x=ax;a.y=ay;b.x=bx;b.y=by}else if(clear(a,a.x-dx/d*(20-d),a.y-dy/d*(20-d),b)){a.x-=dx/d*(20-d);a.y-=dy/d*(20-d)}else if(clear(b,b.x+dx/d*(20-d),b.y+dy/d*(20-d),a)){b.x+=dx/d*(20-d);b.y+=dy/d*(20-d)}
    }
  }
  function setFireHeld(p,isHeld){p.fireHeld=Boolean(isHeld)}
  function shoot(p){if(!p.fireHeld||p.fireCooldown>0||p.stun>0)return;const q=pos(p),angle=p.car?p.car.angle:p.facing;p.fireCooldown=.24;bullets.push({x:q.x+Math.cos(angle)*19,y:q.y+Math.sin(angle)*19,vx:Math.cos(angle)*510,vy:Math.sin(angle)*510,angle,owner:p.id,carOwnerId:p.car?p.car.id:null,life:1.15});}
  function explodeCar(c){if(c.destroyed)return;c.destroyed=true;c.speed=0;c.driver=null;explosions.push({x:c.x,y:c.y,age:0,duration:.9,radius:112});
    for(const p of players){const q=pos(p);if(Math.hypot(q.x-c.x,q.y-c.y)>112)continue;if(p.car){const occupied=p.car;p.car=null;occupied.driver=null;occupied.speed=0}eject(p,c)}
    cars=cars.filter(car=>car!==c);document.querySelector('#status').textContent='AUTO WYBUCHŁO';lastUi='';renderPlayers()}
  function pollPads(){
    const pads=navigator.getGamepads?navigator.getGamepads():[],seen=new Set();
    for(const index of padALatch)if(!pads[index]||pads[index].connected===false){padALatch.delete(index);padBLatch.delete(index)}
    for(let i=0;i<pads.length;i++){
      const pad=pads[i];if(!pad||pad.connected===false)continue;
      const a=!!pad.buttons[0]?.pressed,b=!!pad.buttons[1]?.pressed;
      if(a&&!padALatch.has(i)){padALatch.add(i);if(!players.some(p=>p.source==='pad'&&p.sourceId===i))joinPad(i);if(!running)start()}if(!a)padALatch.delete(i);
      if(b&&!padBLatch.has(i)){padBLatch.add(i);const p=players.find(q=>q.source==='pad'&&q.sourceId===i);if(p&&running)enterOrExit(p)}if(!b)padBLatch.delete(i);
      const p=players.find(q=>q.source==='pad'&&q.sourceId===i);if(!p)continue;
      seen.add(p.id);
      const trigger=pad.buttons[controllerFireButton],triggerValue=Math.max(trigger?.value||0,trigger?.pressed?1:0);
      p.padTriggerHeld=p.padTriggerHeld?triggerValue>0.2:triggerValue>=0.35;p.padFireHeld=a||p.padTriggerHeld;
      if(running){let dx=pad.axes[0]||0,dy=pad.axes[1]||0;if(Math.abs(dx)<.17)dx=0;if(Math.abs(dy)<.17)dy=0;if(p.car)drive(p,-dy,dx,delta);else walk(p,dx,dy,delta)}
    }
    for(const p of players)if(p.source==='pad'&&!seen.has(p.id)){p.padFireHeld=false;p.padTriggerHeld=false}
  }
  function update(dt){pollPads();for(const ex of explosions)ex.age+=dt;explosions=explosions.filter(ex=>ex.age<ex.duration);advanceTraffic(dt);if(!running)return;timeLeft=Math.max(0,timeLeft-dt);document.querySelector('#timer').textContent=Math.ceil(timeLeft);
    for(const p of players){p.invuln=Math.max(0,p.invuln-dt);p.fireCooldown=Math.max(0,p.fireCooldown-dt);if(p.source==='key'){const s=keysets[p.sourceId],up=held.has(s[0]),left=held.has(s[1]),down=held.has(s[2]),right=held.has(s[3]);if(p.car)drive(p,(up?1:0)-(down?1:0),(right?1:0)-(left?1:0),dt);else walk(p,(right?1:0)-(left?1:0),(down?1:0)-(up?1:0),dt)}if(p.id===1){const a=touchAxes();if(p.car)drive(p,-a.y,a.x,dt);else if(a.x||a.y)walk(p,a.x,a.y,dt)}const keyFire=p.source==='key'&&held.has(controls[p.sourceId].fire);setFireHeld(p,keyFire||p.padFireHeld||Boolean(p.id===1&&touchState.fire));if(p.fireHeld&&p.fireCooldown<=0)shoot(p)}
    resolvePlayerCollisions();
    for(const g of guards){g.stun=Math.max(0,g.stun-dt);g.walk=0;if(g.stun>0)continue;let target=null,nearest=370;for(const p of players){const q=pos(p),d=Math.hypot(q.x-g.x,q.y-g.y);if(d<nearest){nearest=d;target=q}}if(target){const dx=target.x-g.x,dy=target.y-g.y;g.facing=Math.atan2(dy,dx);g.walk=1;const speed=nearest<65?-35:54,n=Math.hypot(dx,dy)||1,nx=g.x+dx/n*speed*dt,ny=g.y+dy/n*speed*dt;if(!blocked(nx,g.y,9))g.x=nx;if(!blocked(g.x,ny,9))g.y=ny}}
    const target=players.reduce((a,p)=>{const q=pos(p);return{x:a.x+q.x/players.length,y:a.y+q.y/players.length}},{x:0,y:0});let far=0;for(const p of players){const q=pos(p);far=Math.max(far,Math.hypot(q.x-target.x,q.y-target.y))}
    const fit=Math.min(w(),h())/2-55,targetZoom=clamp(1-Math.max(0,far-fit*.55)/950*.5,.5,1);zoom+=(targetZoom-zoom)*Math.min(1,dt*1.7);const halfW=w()/(2*zoom),halfH=h()/(2*zoom);cam.x+=(clamp(target.x,halfW,world.w-halfW)-cam.x)*Math.min(1,dt*2.5);cam.y+=(clamp(target.y,halfH,world.h-halfH)-cam.y)*Math.min(1,dt*2.5);document.querySelector('#zoom-indicator').textContent=`KADR ${Math.round(zoom*100)}%`;
    for(let i=parcels.length-1;i>=0;i--)for(const p of players){const q=pos(p);if(Math.hypot(q.x-parcels[i].x,q.y-parcels[i].y)<24){parcels.splice(i,1);p.score++;teamScore++;document.querySelector('#score').textContent=`${teamScore} / 12`;lastUi='';renderPlayers();addParcel();break}}
    for(let i=bullets.length-1;i>=0;i--){const b=bullets[i];b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;if(b.life<=0||b.x<0||b.x>world.w||b.y<0||b.y>world.h||blocked(b.x,b.y,3)){bullets.splice(i,1);continue}let hit=false;for(const p of players){if(p.id===b.owner||p.invuln>0)continue;const q=pos(p),distance=Math.hypot(q.x-b.x,q.y-b.y);if(p.car&&distance<23)continue;if(distance<16){p.stun=.85;p.invuln=1.1;if(p.car)p.car.speed*=.25;p.hits++;lastUi='';renderPlayers();bullets.splice(i,1);hit=true;break}}if(hit)continue;for(let j=guards.length-1;j>=0;j--){const g=guards[j];if(Math.hypot(g.x-b.x,g.y-b.y)<16){g.hp--;g.stun=.8;bullets.splice(i,1);if(g.hp<=0){guards.splice(j,1);document.querySelector('#status').textContent='OCHRONA ROZBROJONA'}else document.querySelector('#status').textContent='STRAŻNIK OGŁUSZONY';hit=true;break}}if(hit)continue;for(const c of cars){if(c.destroyed||c.id===b.carOwnerId)continue;if(Math.hypot(c.x-b.x,c.y-b.y)<23){c.health--;bullets.splice(i,1);if(c.health<=0)explodeCar(c);else document.querySelector('#status').textContent=`AUTO USZKODZONE · ${c.health}/3`;hit=true;break}}if(hit)continue}
    if(teamScore>=12){finish(true);return}if(timeLeft<=0)finish(false)
  }
  function screen(x,y){return{x:(x-cam.x)*zoom+w()/2,y:(y-cam.y)*zoom+h()/2}}
  function drawPerson(p,t){const q=pos(p),moving=p.walk>.02,step=moving?Math.sin(t*15+p.id):0;ctx.save();ctx.translate(q.x,q.y);ctx.rotate(p.facing);if(p.invuln>0&&Math.floor(t*14)%2===0)ctx.globalAlpha=.5;
    // Legs and shoes: local forward is +X.
    ctx.lineCap='round';ctx.strokeStyle='#202422';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-7,-3);ctx.lineTo(-11+step*3,-7);ctx.moveTo(-7,3);ctx.lineTo(-11-step*3,7);ctx.stroke();ctx.strokeStyle='#b6a391';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-11+step*3,-7);ctx.lineTo(-15+step*3,-7);ctx.moveTo(-11-step*3,7);ctx.lineTo(-15-step*3,7);ctx.stroke();
    // Jacket, arms, hands, and a small sidearm, all visible from above.
    ctx.strokeStyle='#17201a';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(-4,-3);ctx.lineTo(2,-8);ctx.moveTo(-4,3);ctx.lineTo(2,8);ctx.stroke();ctx.strokeStyle=p.color;ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-4,-3);ctx.lineTo(2,-8);ctx.moveTo(-4,3);ctx.lineTo(2,8);ctx.stroke();ctx.fillStyle='#e4bc98';ctx.beginPath();ctx.arc(2,-8,2.4,0,7);ctx.arc(2,8,2.4,0,7);ctx.fill();ctx.fillStyle=p.color;ctx.strokeStyle='#121815';ctx.lineWidth=1.5;ctx.beginPath();ctx.roundRect(-10,-5,13,10,3);ctx.fill();ctx.stroke();ctx.fillStyle='#dcb995';ctx.beginPath();ctx.arc(5,0,5.1,0,7);ctx.fill();ctx.strokeStyle='#4a2c24';ctx.lineWidth=1;ctx.beginPath();ctx.arc(6,0,5,Math.PI*1.55,Math.PI*2.25);ctx.stroke();ctx.fillStyle='#b8bcc0';ctx.fillRect(9,-1.2,9,2.4);ctx.fillStyle='#4d5555';ctx.fillRect(11,-.2,3,3);ctx.restore();
  }
  function drawStreetLamps(left,top,viewW,viewH,t){
    for(let xi=0;xi<roadsX.length;xi++)for(let yi=0;yi<roadsY.length;yi++){
      const x=roadsX[xi]+(xi%2?-43:43),y=roadsY[yi]+(yi%2?-43:43);if(x<left-130||x>left+viewW+130||y<top-130||y>top+viewH+130)continue;
      const radius=128,pulse=.92+Math.sin(t*1.5+xi*1.9+yi)*.08,glow=ctx.createRadialGradient(x,y,2,x,y,radius*pulse);glow.addColorStop(0,'rgba(255,213,137,.23)');glow.addColorStop(.26,'rgba(255,183,105,.11)');glow.addColorStop(1,'rgba(255,158,87,0)');ctx.fillStyle=glow;ctx.beginPath();ctx.arc(x,y,radius*pulse,0,Math.PI*2);ctx.fill();
      const reflection=ctx.createLinearGradient(x-38,y+18,x+38,y+18);reflection.addColorStop(0,'rgba(119,205,215,0)');reflection.addColorStop(.5,'rgba(152,221,219,.14)');reflection.addColorStop(1,'rgba(119,205,215,0)');ctx.fillStyle=reflection;ctx.fillRect(x-38,y+16,76,4);
      ctx.strokeStyle='#59615b';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y+4);ctx.lineTo(x,y-15);ctx.stroke();ctx.fillStyle='#e9d495';ctx.shadowColor='#ffd78e';ctx.shadowBlur=13;ctx.beginPath();ctx.arc(x,y-16,3.2,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    }
  }
  function drawWorld(t){const cw=w(),ch=h();ctx.clearRect(0,0,cw,ch);ctx.fillStyle='#091115';ctx.fillRect(0,0,cw,ch);const left=cam.x-cw/(2*zoom),top=cam.y-ch/(2*zoom);ctx.save();ctx.translate(cw/2,ch/2);ctx.scale(zoom,zoom);ctx.translate(-cam.x,-cam.y);
    ctx.fillStyle='#1a2529';for(const x of roadsX)ctx.fillRect(x-roadWidth/2,0,roadWidth,world.h);for(const y of roadsY)ctx.fillRect(0,y-roadWidth/2,world.w,roadWidth);
    ctx.fillStyle='#b79e6388';for(const x of roadsX)for(let y=0;y<world.h;y+=58)ctx.fillRect(x-1,y,2,24);for(const y of roadsY)for(let x=0;x<world.w;x+=58)ctx.fillRect(x,y-1,24,2);
    drawStreetLamps(left,top,cw/zoom,ch/zoom,t);
    for(const b of buildings){if(b.x+b.w<left-30||b.x>left+cw/zoom+30||b.y+b.h<top-30||b.y>top+ch/zoom+30)continue;ctx.fillStyle=['#1d2828','#202b2c','#1a2729','#292522'][b.tone];ctx.fillRect(b.x,b.y,b.w,b.h);if(b.kind==='yard'){ctx.fillStyle='#142922';ctx.fillRect(b.x+6,b.y+6,b.w-12,b.h-12);ctx.fillStyle='#486453';for(let xx=b.x+18;xx<b.x+b.w-10;xx+=30){ctx.beginPath();ctx.arc(xx,b.y+b.h/2,5,0,7);ctx.fill()}continue}ctx.fillStyle='#151e20';ctx.fillRect(b.x+7,b.y+7,b.w-14,b.h-14);ctx.shadowColor='#ffcf72';ctx.shadowBlur=7;ctx.fillStyle='#ffd779';for(let xx=b.x+16;xx<b.x+b.w-10;xx+=27){ctx.fillRect(xx,b.y+13,8,4);ctx.fillRect(xx,b.y+b.h-17,8,4)}ctx.shadowBlur=0;ctx.fillStyle=b.tone%2?'#4de2e7':'#f06b9a';ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=8;ctx.fillRect(b.x+b.w/2-10,b.y+b.h/2-2,20,3);ctx.shadowBlur=0;ctx.fillStyle='#4b5a4d';ctx.fillRect(b.x+b.w/2-4,b.y+b.h/2+5,8,4)}
    for(const c of cars)drawCar(c,t);
    drawExplosions();
    for(const g of guards){drawPerson(g,t);const qx=g.x,qy=g.y-20;ctx.fillStyle='#211a17';ctx.fillRect(qx-15,qy-4,30,8);ctx.fillStyle=g.hp===2?'#f08a64':'#e6c86d';ctx.fillRect(qx-13,qy-2,g.hp*13,4);ctx.font='7px "DM Mono",monospace';ctx.textAlign='center';ctx.fillStyle='#f1d8ae';ctx.fillText('OCHRONA',qx,qy-8)}
    for(const f of parcels){const pulse=1+Math.sin(t*5+f.phase)*.16;ctx.save();ctx.translate(f.x,f.y);ctx.rotate(Math.PI/4);ctx.shadowColor='#f4cb67';ctx.shadowBlur=14;ctx.fillStyle='#e6b94e';ctx.fillRect(-7*pulse,-7*pulse,14*pulse,14*pulse);ctx.shadowBlur=0;ctx.fillStyle='#fff0bd';ctx.fillRect(-2,-2,4,4);ctx.restore()}
    for(const b of bullets){ctx.strokeStyle='#fff0a8';ctx.lineWidth=7;ctx.shadowColor='#ffad36';ctx.shadowBlur=16;ctx.beginPath();ctx.moveTo(b.x-b.vx*.025,b.y-b.vy*.025);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.shadowBlur=0}
    for(const p of players){if(!p.car)drawPerson(p,t)}ctx.restore();drawArrows();
  }
  function drawExplosions(){for(const ex of explosions){const progress=ex.age/ex.duration,r=ex.radius*(.35+progress*.85);ctx.save();ctx.globalAlpha=1-progress;const gradient=ctx.createRadialGradient(ex.x,ex.y,2,ex.x,ex.y,r);gradient.addColorStop(0,'#fff6b2');gradient.addColorStop(.22,'#ffd35b');gradient.addColorStop(.58,'#f27635');gradient.addColorStop(1,'#b93020');ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(ex.x,ex.y,r,0,Math.PI*2);ctx.fill();ctx.globalAlpha=(1-progress)*.9;ctx.strokeStyle='#ffe594';ctx.lineWidth=4;ctx.beginPath();ctx.arc(ex.x,ex.y,r*.72,0,Math.PI*2);ctx.stroke();for(let i=0;i<8;i++){const a=i*Math.PI/4+progress*.4,d=r*(.55+progress*.35);ctx.fillStyle=i%2?'#ffe7a0':'#ff713b';ctx.fillRect(ex.x+Math.cos(a)*d-3,ex.y+Math.sin(a)*d-3,6,6)}ctx.restore()}}
  function drawArrows(){const cw=w(),ch=h(),cx=cw/2,cy=ch/2,margin=34;for(const p of players){const q=pos(p),sp=screen(q.x,q.y);if(sp.x>=18&&sp.x<=cw-18&&sp.y>=18&&sp.y<=ch-18)continue;const dx=sp.x-cx,dy=sp.y-cy,scale=Math.min((cw/2-margin)/Math.max(Math.abs(dx),.001),(ch/2-margin)/Math.max(Math.abs(dy),.001)),ax=cx+dx*scale,ay=cy+dy*scale,angle=Math.atan2(dy,dx),meters=Math.round(Math.hypot(dx,dy)/zoom/2);ctx.save();ctx.translate(ax,ay);ctx.rotate(angle);ctx.fillStyle=p.color;ctx.shadowColor=p.color;ctx.shadowBlur=12;ctx.beginPath();ctx.moveTo(13,0);ctx.lineTo(-9,-8);ctx.lineTo(-6,0);ctx.lineTo(-9,8);ctx.closePath();ctx.fill();ctx.restore();const tx=clamp(ax+Math.cos(angle)*23,48,cw-48),ty=clamp(ay+Math.sin(angle)*23,16,ch-16);ctx.font='9px "DM Mono",monospace';ctx.textAlign='center';ctx.textBaseline='middle';const label=`P${p.id} · ${meters} m`,lw=ctx.measureText(label).width+12;ctx.fillStyle='#101510e8';ctx.fillRect(tx-lw/2,ty-9,lw,18);ctx.fillStyle=p.color;ctx.fillText(label,tx,ty+.5)}}
  function drawCar(c,t){ctx.save();ctx.translate(c.x,c.y);ctx.rotate(c.angle);if(c.destroyed){ctx.fillStyle='#080a09';ctx.fillRect(-21,-12,44,26);ctx.fillStyle='#282421';ctx.fillRect(-17,-8,34,18);ctx.fillStyle='#111718';ctx.fillRect(-8,-7,16,14);ctx.fillStyle='#e65b39';ctx.shadowColor='#ff5638';ctx.shadowBlur=8;ctx.fillRect(-20,-7,3,4);ctx.fillRect(-20,3,3,4);ctx.restore();return}
    const beam=ctx.createLinearGradient(14,0,205,0);beam.addColorStop(0,'rgba(255,243,188,.22)');beam.addColorStop(.34,'rgba(255,223,157,.11)');beam.addColorStop(1,'rgba(255,208,133,0)');ctx.fillStyle=beam;ctx.beginPath();ctx.moveTo(14,-6);ctx.lineTo(205,-39);ctx.lineTo(205,39);ctx.lineTo(14,6);ctx.closePath();ctx.fill();
    ctx.fillStyle='#05090c';ctx.fillRect(-21,-12,44,26);ctx.fillStyle=c.driver?c.driver.color:c.color;ctx.fillRect(-20,-11,40,22);ctx.fillStyle='#9ab6bb';ctx.fillRect(-6,-8,14,16);ctx.fillStyle='#283e45';ctx.fillRect(10,-8,6,16);ctx.fillStyle='#161c1d';ctx.fillRect(-13,-13,8,3);ctx.fillRect(7,-13,8,3);ctx.fillRect(-13,10,8,3);ctx.fillRect(7,10,8,3);
    ctx.fillStyle='#ff493b';ctx.shadowColor='#ff362d';ctx.shadowBlur=12;ctx.fillRect(-20,-8,3,5);ctx.fillRect(-20,3,3,5);ctx.fillStyle='#fff1b0';ctx.shadowColor='#fff0a0';ctx.shadowBlur=15;ctx.fillRect(17,-8,3,5);ctx.fillRect(17,3,3,5);ctx.shadowBlur=0;if(c.driver){ctx.fillStyle='#f0d0a4';ctx.beginPath();ctx.arc(0,0,4,0,7);ctx.fill()}ctx.restore();if(c.health<3){ctx.fillStyle='#17140f';ctx.fillRect(c.x-15,c.y-21,30,5);ctx.fillStyle=c.health===2?'#f0b94f':'#ea6546';ctx.fillRect(c.x-13,c.y-20,26*c.health/3,3)}}
  function loop(now){delta=Math.min((now-last)/1000,.05);last=now;update(delta);drawWorld(now/1000);requestAnimationFrame(loop)}
  window.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k))e.preventDefault();held.add(k);if(k==='enter'||k===' '){if(!running)start();else if(!e.repeat&&keyboardPlayerCount()<keyboardPlayerLimit){const i=keysets.findIndex((_,n)=>!players.some(p=>p.source==='key'&&p.sourceId===n));if(i>=0)joinKeyboard(i)}return}if(k==='enter')return;
    const existing=players.find(p=>p.source==='key'&&controls[p.sourceId].enter===k);if(existing&&running&&!e.repeat){enterOrExit(existing);return}
    const i=keysets.findIndex(s=>s.includes(k));if(i>=0&&!players.some(p=>p.source==='key'&&p.sourceId===i)&&keyboardPlayerCount()<keyboardPlayerLimit&&players.length<8)joinKeyboard(i)
  },{passive:false});
  window.addEventListener('keyup',e=>{held.delete(e.key.toLowerCase())});
  window.addEventListener('blur',()=>{held.clear();resetTouchStick();touchState.fire=false;for(const p of players){p.padFireHeld=false;p.padTriggerHeld=false;setFireHeld(p,false)}});
  document.querySelector('#start').addEventListener('click',start);overlay.addEventListener('click',e=>{if(e.target===overlay)start()});bindTouchControls();renderPlayers();requestAnimationFrame(loop);
})();
