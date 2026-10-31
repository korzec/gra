(() => {
  const canvas=document.querySelector('#forest'),ctx=canvas.getContext('2d'),overlay=document.querySelector('#overlay');
  const colors=['#e8f394','#ff9da4','#80e2dc','#d5b0ff','#ffd875','#88b9ff','#ffa8d2','#abe68d'];
  const keysets=[['w','a','s','d'],['arrowup','arrowleft','arrowdown','arrowright']],keyboardLimit=2;
  const world={w:1600,h:1200},spawn={x:800,y:495},headOffset=24,forageDuration=.95,goal=20;
  const spawnOffsets=[[-112,-35],[-37,-35],[38,-35],[113,-35],[-112,35],[-37,35],[38,35],[113,35]];
  const held=new Set(),padALatch=new Set(),touchStick={pointerId:null,x:0,y:0,intensity:0,element:null};
  const glades=[
    {x:800,y:510,w:270,h:182,tone:0},
    {x:275,y:220,w:270,h:182,tone:1},
    {x:690,y:205,w:220,h:156,tone:2},
    {x:1330,y:360,w:260,h:178,tone:1},
    {x:320,y:765,w:280,h:200,tone:2},
    {x:865,y:735,w:270,h:185,tone:0}
  ];
  const flowerSpots=[
    [800,506],[750,470],[825,450],[870,500],[735,540],[845,560],
    [205,170],[255,200],[310,155],[365,225],[235,270],[345,285],
      [630,165],[685,210],[745,160],[805,200],[665,260],
      [1245,325],[1310,300],[1370,330],[1400,390],[1290,420],[1370,455],
      [235,700],[285,740],[350,705],[405,755],[270,805],[370,825],
      [780,675],[835,700],[900,660],[950,730],[805,790],[920,805]
  ];
  const landmarks={tree:{x:1160,y:260,r:55},pond:{x:1110,y:845,rx:125,ry:66},stones:{x:570,y:385,r:78}};
  let players=[],flowers=[],running=false,teamScore=0,cam={x:spawn.x,y:spawn.y},zoom=.65,lastTime=performance.now(),lastRoster='',delta=0;
  const W=()=>canvas.clientWidth,H=()=>canvas.clientHeight,rand=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const touchAvailable=()=>Boolean(navigator.maxTouchPoints>0||matchMedia('(pointer:coarse)').matches);
  const setStatus=text=>{document.querySelector('#status').textContent=text};

  function resize(){const rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.max(1,Math.round(rect.width*dpr));canvas.height=Math.max(1,Math.round(rect.height*dpr));ctx.setTransform(dpr,0,0,dpr,0,0)}
  new ResizeObserver(resize).observe(canvas);resize();

  function keyLabel(key){return({arrowup:'↑',arrowleft:'←',arrowdown:'↓',arrowright:'→',enter:'ENTER',' ':'SPACJA'})[key]||key.toUpperCase()}
  function playerButtons(p){const tags=[];if(p.source==='key'){keysets[p.sourceId].forEach(k=>tags.push(keyLabel(k)));tags.push('ENTER','SPACJA')}else if(p.source==='pad')tags.push('LEWY DRĄŻEK','KRZYŻAK','A · START');if(p.id===1&&touchAvailable())tags.push('DOTYK GAŁKA');return[...new Set(tags)].map(tag=>`<kbd>${tag}</kbd>`).join('')}
  function validateBindings(){const ids=new Set(),bindings=new Map(),keys=new Set(),pads=new Set();if(players.length>8)throw new Error('Too many unicorn players');for(const p of players){if(!Number.isInteger(p.id)||p.id<1||p.id>8||ids.has(p.id))throw new Error('Duplicate player id');ids.add(p.id);if(p.source==='key'){if(!Number.isInteger(p.sourceId)||p.sourceId<0||p.sourceId>=keyboardLimit||keys.has(p.sourceId))throw new Error('Keyboard binding has multiple owners');keys.add(p.sourceId)}else if(p.source==='pad'){if(!Number.isInteger(p.sourceId)||p.sourceId<0||p.sourceId>7||p.id!==p.sourceId+1||pads.has(p.sourceId))throw new Error('Unstable gamepad binding');pads.add(p.sourceId)}else if(p.source==='touch'){if(p.id!==1||p.sourceId!==0)throw new Error('Touch must be additional P1 input')}else throw new Error('Unknown unicorn control source');const binding=`${p.source}:${p.sourceId}`;if(bindings.has(binding))throw new Error('Control binding has multiple owners');bindings.set(binding,p.id)}}
  function renderPlayers(){validateBindings();document.querySelector('#player-count').textContent=players.length;const key=players.map(p=>`${p.id}:${p.source}:${p.sourceId}:${p.score}`).join('|');if(key===lastRoster)return;lastRoster=key;document.querySelector('#player-list').innerHTML=players.slice().sort((a,b)=>a.id-b.id).map(p=>`<div class="player-entry"><span class="swatch" style="background:${p.color};color:${p.color}"></span><b class="player-name">P${p.id}</b><span class="player-controls">${playerButtons(p)}</span><small>${p.score} ✿</small></div>`).join('')}
  function connectedPadSlots(){const slots=new Set(players.filter(p=>p.source==='pad').map(p=>p.sourceId+1));if(navigator.getGamepads)for(let i=0;i<navigator.getGamepads().length&&i<8;i++){const pad=navigator.getGamepads()[i];if(pad&&pad.connected!==false)slots.add(i+1)}return slots}
  function freeSlot(reserved=new Set(),except=null,preferred=null){const occupied=id=>players.some(p=>p!==except&&p.id===id);if(preferred&&!reserved.has(preferred)&&!occupied(preferred))return preferred;for(let id=1;id<=8;id++)if(!reserved.has(id)&&!occupied(id))return id;return null}
  function setPlayerId(p,id){if(p.id===id)return;p.id=id;p.color=colors[(id-1)%colors.length];lastRoster=''}
  function moveKeyboardPlayers(reserved){const movers=players.filter(p=>p.source==='key'&&reserved.has(p.id)).sort((a,b)=>a.sourceId-b.sourceId),occupied=new Set(players.filter(p=>!movers.includes(p)).map(p=>p.id)),moves=[];for(const p of movers){let next=null;for(let id=1;id<=8;id++)if(!reserved.has(id)&&!occupied.has(id)){next=id;break}if(!next)return false;occupied.add(next);moves.push([p,next])}for(const[p,id]of moves)setPlayerId(p,id);return true}
  function keyboardCount(){return players.filter(p=>p.source==='key').length}
  function createPlayer(source,sourceId,id){if(players.length>=8)return null;const offset=spawnOffsets[id-1]||[0,0],p={id,source,sourceId,x:spawn.x+offset[0],y:spawn.y+offset[1],score:0,color:colors[(id-1)%colors.length],facing:-Math.PI/2,walk:0,moveIntent:0,forage:null,padX:0,padY:0};players.push(p);lastRoster='';renderPlayers();return p}
  function joinKeyboard(sourceId){if(sourceId<0||sourceId>=keyboardLimit||keyboardCount()>=keyboardLimit)return null;const prior=players.find(p=>p.source==='key'&&p.sourceId===sourceId);if(prior)return prior;const touched=players.find(p=>p.id===1&&p.source==='touch'&&sourceId===0);if(touched){touched.source='key';touched.sourceId=0;lastRoster='';renderPlayers();return touched}if(players.length>=8)return null;const id=freeSlot(connectedPadSlots(),null,sourceId+1);return id?createPlayer('key',sourceId,id):null}
  function ensureTouchP1(){const prior=players.find(p=>p.id===1);if(prior)return prior;if(players.length>=8)return null;return createPlayer('touch',0,1)}
  function joinPad(index){if(index<0||index>=8)return null;const prior=players.find(p=>p.source==='pad'&&p.sourceId===index);if(prior)return prior;const target=index+1,occupant=players.find(p=>p.id===target);if(occupant&&occupant.source==='touch'&&target===1){occupant.source='pad';occupant.sourceId=index;lastRoster='';renderPlayers();return occupant}if(players.length>=8)return null;const reserved=connectedPadSlots();reserved.add(target);if(occupant&&occupant.source==='key'&&!moveKeyboardPlayers(reserved))return null;if(players.some(p=>p.id===target))return null;return createPlayer('pad',index,target)}

  function resetTouchStick(){touchStick.pointerId=null;touchStick.x=touchStick.y=touchStick.intensity=0;if(touchStick.element){touchStick.element.classList.remove('is-active');touchStick.element.style.setProperty('--stick-x','0px');touchStick.element.style.setProperty('--stick-y','0px')}}
  function updateTouchStick(event){if(!touchStick.element)return;const rect=touchStick.element.getBoundingClientRect(),maxTravel=Math.max(1,Math.min(rect.width,rect.height)*.34),dx=event.clientX-(rect.left+rect.width/2),dy=event.clientY-(rect.top+rect.height/2),distance=Math.hypot(dx,dy),limited=Math.min(distance,maxTravel),raw=limited/maxTravel,deadzone=.12;touchStick.intensity=raw<=deadzone?0:(raw-deadzone)/(1-deadzone);touchStick.x=distance?dx/distance*touchStick.intensity:0;touchStick.y=distance?dy/distance*touchStick.intensity:0;touchStick.element.style.setProperty('--stick-x',`${distance?dx/distance*limited:0}px`);touchStick.element.style.setProperty('--stick-y',`${distance?dy/distance*limited:0}px`);touchStick.element.classList.toggle('is-active',touchStick.intensity>0)}
  function bindTouchControls(){const stick=document.querySelector('[data-touch-joystick]');if(!stick)return;touchStick.element=stick;stick.addEventListener('pointerdown',event=>{if(touchStick.pointerId!==null)return;event.preventDefault();if(!ensureTouchP1())return;touchStick.pointerId=event.pointerId;stick.setPointerCapture(event.pointerId);updateTouchStick(event)});stick.addEventListener('pointermove',event=>{if(event.pointerId===touchStick.pointerId){event.preventDefault();updateTouchStick(event)}});const release=event=>{if(event.pointerId!==touchStick.pointerId)return;event.preventDefault();resetTouchStick()};stick.addEventListener('pointerup',release);stick.addEventListener('pointercancel',release);stick.addEventListener('lostpointercapture',release)}

  function makeFlowers(){return flowerSpots.map(([x,y],index)=>({id:index,x,y,type:index%5,phase:rand(0,Math.PI*2),active:true,respawnTimer:0}))}
  flowers=makeFlowers();
  function start(){if(running)return;if(!players.length){if(touchAvailable())ensureTouchP1();else joinKeyboard(0)}if(!players.length)return;running=true;teamScore=0;flowers=makeFlowers();players.forEach(p=>{const offset=spawnOffsets[p.id-1]||[0,0];p.x=spawn.x+offset[0];p.y=spawn.y+offset[1];p.score=0;p.walk=0;p.moveIntent=0;p.facing=-Math.PI/2;p.forage=null;p.padX=0;p.padY=0});cam.x=spawn.x;cam.y=spawn.y;zoom=baseZoom();document.querySelector('#flower-count').textContent='0';document.querySelector('#flower-goal').textContent=goal;document.querySelector('#round-label').textContent='ZBIERAJCIE KWIATY';setStatus('POLANA BUDZI SIĘ');lastRoster='';renderPlayers();overlay.classList.add('hidden')}
  function finish(){running=false;document.querySelector('#round-label').textContent='CEL OSIĄGNIĘTY';document.querySelector('#overlay-title').innerHTML='Leśna <em>ekipa!</em>';document.querySelector('#overlay-copy').textContent=`Zebraliście ${teamScore} kwiatów. Polana znowu rozkwitła.`;document.querySelector('#start').innerHTML='Jeszcze raz <span>↗</span>';setStatus('BRAWO, POLANA ROZKWITŁA');overlay.classList.remove('hidden')}

  function baseZoom(){return clamp(Math.min(W()/world.w,H()/world.h)*1.45,.60,1.05)}
  function movementFor(p){let x=0,y=0;if(p.source==='key'){const set=keysets[p.sourceId];x=(held.has(set[3])?1:0)-(held.has(set[1])?1:0);y=(held.has(set[2])?1:0)-(held.has(set[0])?1:0)}else if(p.source==='pad'){x=p.padX;y=p.padY}if(p.id===1){x+=touchStick.x;y+=touchStick.y}const length=Math.hypot(x,y);if(length>1){x/=length;y/=length}return{x,y,length:Math.min(1,length)}}
  function blocked(x,y,r=13,ignore=null){if(x<28||x>world.w-28||y<28||y>world.h-28)return true;const tree=landmarks.tree,treeR=tree.r+r;if(Math.hypot(x-tree.x,y-tree.y)<treeR)return true;const pond=landmarks.pond;if(((x-pond.x)/(pond.rx+r))**2+((y-pond.y)/(pond.ry+r))**2<1)return true;const ring=landmarks.stones;for(let i=0;i<8;i++){const a=i*Math.PI/4,sx=ring.x+Math.cos(a)*ring.r,sy=ring.y+Math.sin(a)*ring.r;if(Math.hypot(x-sx,y-sy)<r+12)return true}for(const p of players)if(p!==ignore&&Math.hypot(x-p.x,y-p.y)<r+14)return true;return false}
  function move(p,x,y,dt){const length=Math.hypot(x,y);p.moveIntent=Math.min(1,length);p.walk=0;if(length<.001)return;p.facing=Math.atan2(y,x);const intensity=Math.min(1,length),speed=165*intensity,startX=p.x,startY=p.y,nx=clamp(p.x+x/length*speed*dt,22,world.w-22),ny=clamp(p.y+y/length*speed*dt,22,world.h-22);if(!blocked(nx,p.y,13,p))p.x=nx;if(!blocked(p.x,ny,13,p))p.y=ny;const moved=Math.hypot(p.x-startX,p.y-startY);p.walk=moved>.05?clamp(moved/(165*dt),0,1):0}
  function headAnchor(p){return{x:p.x+Math.cos(p.facing)*headOffset,y:p.y+Math.sin(p.facing)*headOffset}}
  function forageCandidate(p){if(p.moveIntent>.12||p.walk>.04)return null;const head=headAnchor(p);let target=null,nearest=10;for(const f of flowers){if(!f.active)continue;const bodyDistance=Math.hypot(f.x-p.x,f.y-p.y),headDistance=Math.hypot(f.x-head.x,f.y-head.y);if(bodyDistance<22||bodyDistance>34||headDistance>9)continue;if(headDistance<nearest){nearest=headDistance;target=f}}return target}
  function updateForage(p,dt){if(p.moveIntent>.12||p.walk>.04){p.forage=null;return}if(p.forage){const f=flowers.find(q=>q.id===p.forage.flowerId);if(!f||!f.active){p.forage=null;return}const anchor=headAnchor(p);if(Math.hypot(f.x-anchor.x,f.y-anchor.y)>12){p.forage=null;return}p.forage.progress+=dt;if(p.forage.progress>=forageDuration){f.active=false;f.respawnTimer=rand(12,18);p.forage=null;p.score++;teamScore++;document.querySelector('#flower-count').textContent=teamScore;document.querySelector('#round-label').textContent=`KWIATY ${teamScore}/${goal}`;lastRoster='';renderPlayers();setStatus(`P${p.id} zebrał kwiatek`);if(teamScore>=goal)finish()}return}const f=forageCandidate(p);if(f)p.forage={flowerId:f.id,progress:0}}
  function update(dt){for(const f of flowers)if(!f.active){f.respawnTimer-=dt;if(f.respawnTimer<=0){f.active=true;f.respawnTimer=0;f.phase=rand(0,Math.PI*2)}}for(const p of players){const input=movementFor(p);move(p,input.x,input.y,dt);updateForage(p,dt)}if(players.length){const target=players.reduce((a,p)=>({x:a.x+p.x/players.length,y:a.y+p.y/players.length}),{x:0,y:0});let spread=0;for(const p of players)spread=Math.max(spread,Math.hypot(p.x-target.x,p.y-target.y));const targetZoom=clamp(baseZoom()/(1+Math.max(0,spread-90)/600),.34,baseZoom());zoom+=(targetZoom-zoom)*Math.min(1,dt*2.3);const halfW=W()/(2*zoom),halfH=H()/(2*zoom);cam.x=world.w<halfW*2?world.w/2:clamp(target.x,halfW,world.w-halfW);cam.y=world.h<halfH*2?world.h/2:clamp(target.y,halfH,world.h-halfH)}}

  function pollPads(){const pads=navigator.getGamepads?navigator.getGamepads():[],seen=new Set();for(const index of padALatch)if(!pads[index]||pads[index].connected===false)padALatch.delete(index);for(let i=0;i<pads.length&&i<8;i++){const pad=pads[i];if(!pad||pad.connected===false)continue;const a=Boolean(pad.buttons[0]?.pressed);if(a&&!padALatch.has(i)){padALatch.add(i);if(!players.some(p=>p.source==='pad'&&p.sourceId===i))joinPad(i);if(!running)start()}if(!a)padALatch.delete(i);const p=players.find(q=>q.source==='pad'&&q.sourceId===i);if(!p)continue;seen.add(p.id);let x=pad.axes?.[0]||0,y=pad.axes?.[1]||0;if(Math.abs(x)<.17)x=0;if(Math.abs(y)<.17)y=0;if(pad.buttons[14]?.pressed)x=-1;if(pad.buttons[15]?.pressed)x=1;if(pad.buttons[12]?.pressed)y=-1;if(pad.buttons[13]?.pressed)y=1;p.padX=x;p.padY=y}for(const p of players)if(p.source==='pad'&&!seen.has(p.id)){p.padX=0;p.padY=0}}

  function drawForestFloor(t){ctx.fillStyle='#10221b';ctx.fillRect(0,0,world.w,world.h);for(let i=0;i<140;i++){const x=(i*197+83)%world.w,y=(i*313+149)%world.h;ctx.fillStyle=i%3?'rgba(137,167,95,.10)':'rgba(202,194,113,.09)';ctx.beginPath();ctx.ellipse(x,y,4+(i%4),2+(i%3),i*.6,0,Math.PI*2);ctx.fill()}ctx.strokeStyle='rgba(144,177,107,.07)';ctx.lineWidth=2;for(let y=120;y<world.h;y+=180){ctx.beginPath();ctx.moveTo(30,y+Math.sin(t+y)*4);ctx.bezierCurveTo(380,y-25,810,y+24,world.w-20,y-10);ctx.stroke()}}
  function drawStream(){ctx.lineCap='round';ctx.lineJoin='round';const path=()=>{ctx.beginPath();ctx.moveTo(-20,610);ctx.bezierCurveTo(190,500,290,675,510,580);ctx.bezierCurveTo(735,486,850,626,1050,555);ctx.bezierCurveTo(1250,485,1420,535,1620,430)};path();ctx.strokeStyle='#132f2e';ctx.lineWidth=67;ctx.stroke();path();ctx.strokeStyle='#285f62';ctx.lineWidth=52;ctx.stroke();path();ctx.strokeStyle='#60aaa0';ctx.globalAlpha=.56;ctx.lineWidth=34;ctx.stroke();ctx.globalAlpha=1;path();ctx.strokeStyle='rgba(198,240,192,.48)';ctx.lineWidth=2;ctx.setLineDash([10,24]);ctx.stroke();ctx.setLineDash([]);ctx.lineCap='butt';ctx.lineJoin='miter';for(let i=0;i<7;i++){const x=80+i*218,y=600+Math.sin(i*1.7)*62;ctx.fillStyle='#90b773';ctx.beginPath();ctx.ellipse(x,y,12,5,i*.7,0,Math.PI*2);ctx.fill()}}
  function drawPond(t){const p=landmarks.pond;ctx.fillStyle='#132620';ctx.beginPath();ctx.ellipse(p.x,p.y+8,p.rx+12,p.ry+12,-.08,0,Math.PI*2);ctx.fill();ctx.fillStyle='#52784b';ctx.beginPath();ctx.ellipse(p.x,p.y,p.rx+5,p.ry+5,-.08,0,Math.PI*2);ctx.fill();const water=ctx.createRadialGradient(p.x-30,p.y-18,4,p.x,p.y,p.rx);water.addColorStop(0,'#67a9a1');water.addColorStop(.55,'#34777b');water.addColorStop(1,'#214e58');ctx.fillStyle=water;ctx.beginPath();ctx.ellipse(p.x,p.y-4,p.rx,p.ry,-.08,0,Math.PI*2);ctx.fill();ctx.strokeStyle='rgba(198,235,192,.4)';ctx.lineWidth=3;for(let i=0;i<4;i++){ctx.beginPath();ctx.ellipse(p.x-25+i*17,p.y-8+i*11,24,5,.1,0,Math.PI);ctx.stroke()}for(let i=0;i<5;i++){const x=p.x-85+i*41,y=p.y+Math.sin(i*2+t)*30;ctx.fillStyle='#86af73';ctx.beginPath();ctx.ellipse(x,y,15,7,i*.7,0,Math.PI*2);ctx.fill();ctx.fillStyle='#d4dc9a';ctx.beginPath();ctx.arc(x+5,y-3,2,0,Math.PI*2);ctx.fill()}}
  function drawStoneCircle(t){const s=landmarks.stones;ctx.strokeStyle='rgba(195,202,154,.24)';ctx.setLineDash([4,12]);ctx.lineWidth=2;ctx.beginPath();ctx.arc(s.x,s.y,s.r+26,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#20372b';ctx.beginPath();ctx.arc(s.x,s.y,s.r-13,0,Math.PI*2);ctx.fill();for(let i=0;i<8;i++){const a=i*Math.PI/4,x=s.x+Math.cos(a)*s.r,y=s.y+Math.sin(a)*s.r;ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.fillStyle='#525f53';ctx.beginPath();ctx.moveTo(-14,12);ctx.lineTo(-12,-9);ctx.lineTo(-2,-17);ctx.lineTo(12,-11);ctx.lineTo(15,12);ctx.closePath();ctx.fill();ctx.fillStyle='#8b9981';ctx.beginPath();ctx.moveTo(-9,-8);ctx.lineTo(-2,-14);ctx.lineTo(7,-9);ctx.lineTo(4,-4);ctx.closePath();ctx.fill();ctx.restore()}ctx.fillStyle='#c1c78e';ctx.shadowColor='#b5d481';ctx.shadowBlur=20;ctx.beginPath();ctx.arc(s.x,s.y,5+Math.sin(t*2)*1.4,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0}
  function drawAncientTree(t){const q=landmarks.tree;ctx.fillStyle='rgba(0,0,0,.35)';ctx.beginPath();ctx.ellipse(q.x+8,q.y+16,91,70,.1,0,Math.PI*2);ctx.fill();ctx.fillStyle='#584334';ctx.beginPath();ctx.arc(q.x,q.y,58,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#ad8758';ctx.lineWidth=7;ctx.beginPath();ctx.arc(q.x,q.y,42,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#786043';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(q.x-22,q.y+22);ctx.bezierCurveTo(q.x-20,q.y-5,q.x+24,q.y+8,q.x+8,q.y-24);ctx.stroke();ctx.fillStyle='#234631';ctx.beginPath();ctx.arc(q.x-20,q.y-22,49,0,Math.PI*2);ctx.arc(q.x+24,q.y-26,48,0,Math.PI*2);ctx.arc(q.x+5,q.y+14,54,0,Math.PI*2);ctx.fill();ctx.fillStyle='#426e46';for(const [dx,dy,r]of [[-40,-18,23],[4,-48,24],[38,-12,27],[-5,22,28]]){ctx.beginPath();ctx.arc(q.x+dx,q.y+dy,r,0,Math.PI*2);ctx.fill()}ctx.fillStyle='#90bb6a';ctx.shadowColor='#9cca68';ctx.shadowBlur=18;ctx.beginPath();ctx.arc(q.x-6,q.y-35,4+Math.sin(t*2)*1.3,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0}
  function drawMushrooms(){for(const grove of [[300,780],[1300,680]]){const[x,y]=grove;for(let i=0;i<7;i++){const mx=x+(i%3)*22-22,my=y+Math.floor(i/3)*17-12,size=8+(i%2)*2;ctx.fillStyle='#d8c99d';ctx.fillRect(mx-3,my-1,6,size+3);ctx.fillStyle=['#d9716c','#e7a55d','#a588d1'][i%3];ctx.beginPath();ctx.ellipse(mx,my-2,size,size*.48,0,Math.PI,Math.PI*2);ctx.fill();ctx.fillStyle='#f6e8bb';ctx.beginPath();ctx.arc(mx-3,my-5,1.7,0,Math.PI*2);ctx.arc(mx+3,my-4,1.3,0,Math.PI*2);ctx.fill()}}}
  function drawGlades(t){for(const g of glades){ctx.fillStyle=['rgba(114,153,77,.31)','rgba(112,153,86,.26)','rgba(146,161,88,.22)'][g.tone];ctx.beginPath();ctx.ellipse(g.x,g.y,g.w/2,g.h/2,.1,0,Math.PI*2);ctx.fill();ctx.strokeStyle='rgba(216,222,148,.19)';ctx.lineWidth=2;ctx.setLineDash([3,13]);ctx.beginPath();ctx.ellipse(g.x,g.y,g.w/2-8,g.h/2-8,.1,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);for(let i=0;i<12;i++){const x=g.x-Math.cos(i*2.4)*g.w*.38,y=g.y-Math.sin(i*1.7)*g.h*.38;ctx.strokeStyle='rgba(195,218,142,.28)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y+5);ctx.quadraticCurveTo(x-3,y-2,x+Math.sin(t+i)*4,y-7);ctx.stroke()}}}
  function drawFlower(f,t){if(!f.active)return;const bob=Math.sin(t*3+f.phase)*1.5;ctx.save();ctx.translate(f.x,f.y+bob);ctx.strokeStyle='#6d9b61';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,10);ctx.quadraticCurveTo(1,5,0,2);ctx.stroke();ctx.fillStyle='#7cac6d';ctx.beginPath();ctx.ellipse(-4,6,4,2,-.4,0,Math.PI*2);ctx.ellipse(4,4,4,2,.45,0,Math.PI*2);ctx.fill();const shades=['#ffdb78','#f49bc9','#d9b0ff','#b2e582','#8fe1dc'],petal=shades[f.type];ctx.shadowColor=petal;ctx.shadowBlur=11;ctx.fillStyle=petal;for(let i=0;i<5;i++){const a=i*Math.PI*2/5;ctx.beginPath();ctx.ellipse(Math.cos(a)*5,Math.sin(a)*5,3.6,5.1,a,0,Math.PI*2);ctx.fill()}ctx.shadowBlur=0;ctx.fillStyle='#ffe9a7';ctx.beginPath();ctx.arc(0,0,3.1,0,Math.PI*2);ctx.fill();if(players.some(p=>p.forage?.flowerId===f.id)){ctx.strokeStyle='#fff4bf';ctx.globalAlpha=.65+.25*Math.sin(t*14);ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,13+Math.sin(t*12)*2,0,Math.PI*2);ctx.stroke()}ctx.restore()}

  function drawUnicorn(p,t){
    const bob=p.walk>.05?Math.sin(t*14+p.id)*1.2:0;
    const forage=p.forage?clamp(p.forage.progress/forageDuration,0,1):0;
    const dip=forage?Math.sin(forage*Math.PI/2):0;
    ctx.save();
    ctx.translate(p.x,p.y+bob);
    // The local sprite faces north; rotate that forward axis to the player's heading.
    ctx.rotate(p.facing+Math.PI/2);

    if(p.walk>.05){
      const stride=Math.sin(t*14+p.id)*4;
      const legs=[
        {x:-6,y:-6,kneeX:-11,kneeY:-8+stride*.5,footX:-16,footY:-12+stride,side:-1},
        {x:6,y:-6,kneeX:11,kneeY:-8-stride*.5,footX:16,footY:-12-stride,side:1},
        {x:-6,y:10,kneeX:-11,kneeY:13-stride*.5,footX:-16,footY:16-stride,side:-1},
        {x:6,y:10,kneeX:11,kneeY:13+stride*.5,footX:16,footY:16+stride,side:1}
      ];
      for(const leg of legs){
        ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#29342d';ctx.lineWidth=6;
        ctx.beginPath();ctx.moveTo(leg.x,leg.y);ctx.lineTo(leg.kneeX,leg.kneeY);ctx.lineTo(leg.footX,leg.footY);ctx.stroke();
        ctx.strokeStyle=p.color;ctx.lineWidth=3.5;
        ctx.beginPath();ctx.moveTo(leg.x,leg.y);ctx.lineTo(leg.kneeX,leg.kneeY);ctx.lineTo(leg.footX,leg.footY);ctx.stroke();
        ctx.fillStyle='#514537';ctx.strokeStyle='#d9c9a9';ctx.lineWidth=.8;
        ctx.beginPath();ctx.ellipse(leg.footX,leg.footY,3.6,2.4,leg.side*.3,0,Math.PI*2);ctx.fill();ctx.stroke();
        ctx.strokeStyle='#ebdec0';ctx.lineWidth=.65;ctx.beginPath();ctx.moveTo(leg.footX,leg.footY-1.5);ctx.lineTo(leg.footX,leg.footY+1.5);ctx.stroke();
      }
    }

    // Four hooves frame a compact body, with the tail at the rear.
    ctx.fillStyle='rgba(0,0,0,.34)';ctx.beginPath();ctx.ellipse(0,5,14,23,0,0,Math.PI*2);ctx.fill();
    ctx.lineCap='round';ctx.strokeStyle='#29342d';ctx.lineWidth=8;
    ctx.beginPath();ctx.moveTo(0,16);ctx.quadraticCurveTo(-2,24,-7,28);ctx.stroke();
    ctx.strokeStyle=p.color;ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(0,16);ctx.quadraticCurveTo(-2,23,-7,27);ctx.stroke();
    ctx.strokeStyle='#efa2d4';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-1,21);ctx.quadraticCurveTo(-4,25,-8,27);ctx.stroke();

    ctx.fillStyle='#293a32';ctx.beginPath();ctx.ellipse(0,4,12,20,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=p.color;ctx.beginPath();ctx.ellipse(0,3,9.5,17,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.36)';ctx.beginPath();ctx.ellipse(-3,-3,3.5,9,-.08,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#b8caa3';ctx.beginPath();ctx.ellipse(0,-10,7,7,0,Math.PI,Math.PI*2);ctx.fill();

    // A striped mane runs from the forehead down the center of the back.
    ctx.lineCap='round';ctx.strokeStyle='#ef9bcf';ctx.lineWidth=4;
    ctx.beginPath();ctx.moveTo(0,-15);ctx.quadraticCurveTo(-3,-6,0,2);ctx.stroke();
    ctx.strokeStyle='#b6a0fa';ctx.lineWidth=3;
    ctx.beginPath();ctx.moveTo(2,-13);ctx.quadraticCurveTo(3,-5,2,0);ctx.stroke();
    ctx.strokeStyle='#ffd37e';ctx.lineWidth=2.5;
    ctx.beginPath();ctx.moveTo(-2,-12);ctx.quadraticCurveTo(-1,-5,-2,-1);ctx.stroke();

    // The centered head sits at the front of the torso; ears, muzzle, eyes and horn all point forward.
    const headY=-15-dip*4;
    ctx.save();ctx.translate(0,headY);ctx.scale(1,1+dip*.1);
    ctx.fillStyle='#293a32';ctx.beginPath();ctx.ellipse(0,0,8,9.5,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#e5edcf';ctx.beginPath();ctx.ellipse(0,0,6.6,8.2,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=p.color;ctx.beginPath();ctx.ellipse(0,-5,5.5,3.5,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#f0c4d3';ctx.beginPath();
    ctx.moveTo(-4,-4);ctx.lineTo(-8,-11);ctx.lineTo(-1,-8);
    ctx.moveTo(4,-4);ctx.lineTo(8,-11);ctx.lineTo(1,-8);ctx.closePath();ctx.fill();
    ctx.fillStyle='#25352d';ctx.beginPath();ctx.arc(-4,-1,1.2,0,Math.PI*2);ctx.arc(4,-1,1.2,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#bc8387';ctx.beginPath();ctx.ellipse(0,-7,4.6,3.1,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#473a37';ctx.beginPath();ctx.arc(-1.5,-7.3,.8,0,Math.PI*2);ctx.arc(1.5,-7.3,.8,0,Math.PI*2);ctx.fill();
    ctx.lineCap='round';ctx.strokeStyle='#8a6539';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(0,-15);ctx.stroke();
    ctx.strokeStyle='#f7d57c';ctx.lineWidth=2.7;ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(0,-15);ctx.stroke();
    ctx.fillStyle='#f0a3d0';ctx.beginPath();ctx.ellipse(-2,-9,3,1.8,-.2,0,Math.PI*2);ctx.fill();
    ctx.restore();

    if(dip>.1){
      ctx.save();ctx.globalAlpha=.58;ctx.fillStyle='#ffe8a2';
      for(let i=0;i<3;i++){const a=t*4+i*2.1;ctx.beginPath();ctx.arc(Math.cos(a)*5,-28-dip*4+Math.sin(a)*5,1.5,0,Math.PI*2);ctx.fill()}
      ctx.restore();
    }
    ctx.restore();
  }

  function draw(t){const w=W(),h=H();ctx.clearRect(0,0,w,h);ctx.fillStyle='#0c1d18';ctx.fillRect(0,0,w,h);ctx.save();ctx.translate(w/2,h/2);ctx.scale(zoom,zoom);ctx.translate(-cam.x,-cam.y);drawForestFloor(t);drawStream();drawGlades(t);drawMushrooms();drawPond(t);drawStoneCircle(t);drawAncientTree(t);for(const f of flowers)drawFlower(f,t);for(const p of players)drawUnicorn(p,t);ctx.restore()}

  function tick(now){delta=Math.min((now-lastTime)/1000,.04);lastTime=now;pollPads();if(running)update(delta);draw(now/1000);requestAnimationFrame(tick)}
  window.addEventListener('keydown',event=>{const k=event.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k))event.preventDefault();held.add(k);if(k==='enter'||k===' '){if(!running)start();else if(!event.repeat&&keyboardCount()<keyboardLimit){const next=keysets.findIndex((_,i)=>!players.some(p=>p.source==='key'&&p.sourceId===i));if(next>=0)joinKeyboard(next)}return}const setIndex=keysets.findIndex(set=>set.includes(k));if(setIndex>=0&&!players.some(p=>p.source==='key'&&p.sourceId===setIndex)&&keyboardCount()<keyboardLimit)joinKeyboard(setIndex)},{passive:false});
  window.addEventListener('keyup',event=>held.delete(event.key.toLowerCase()));
  window.addEventListener('blur',()=>{held.clear();resetTouchStick();for(const p of players){p.padX=0;p.padY=0}});
  document.querySelector('#start').addEventListener('click',start);overlay.addEventListener('click',event=>{if(event.target===overlay)start()});bindTouchControls();renderPlayers();draw(0);requestAnimationFrame(tick);
})();
