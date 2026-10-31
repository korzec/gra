(() => {
  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d');
  const overlay = document.querySelector('#overlay');
  const startButton = document.querySelector('#start');
  const playerList = document.querySelector('#player-list');
  const colors = ['#d6f36a','#ff7b64','#72d9d0','#c99aff','#ffcb66','#74a9ff','#ff8fc2','#a4e887'];
  const keys = [ ['w','a','s','d'], ['arrowup','arrowleft','arrowdown','arrowright'], ['i','j','k','l'], ['t','f','g','h'] ];
  const padALatch=new Set(),touchStick={pointerId:null,x:0,y:0,intensity:0,element:null},touchAvailable=()=>Boolean(navigator.maxTouchPoints>0||matchMedia('(pointer:coarse)').matches);
  let players = [], fireflies = [], shadows = [], running = false, lastTime = performance.now(), spawnTimer = 0, shadowTimer = 0, rosterState='';
  let best = Number(localStorage.getItem('swietliki-best') || 0);
  document.querySelector('#best').textContent = best;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  new ResizeObserver(resize).observe(canvas);
  resize();
  const W = () => canvas.clientWidth, H = () => canvas.clientHeight;
  const rand = (a,b) => a + Math.random()*(b-a);

  function keyLabel(key){return({arrowup:'↑',arrowleft:'←',arrowdown:'↓',arrowright:'→',enter:'ENTER',' ':'SPACJA'})[key]||key.toUpperCase()}
  function playerButtons(p){const tags=[];if(p.source==='key'){keys[p.sourceId].forEach(k=>tags.push(keyLabel(k)));tags.push('ENTER','SPACJA')}else if(p.source==='pad')tags.push('LEWY DRĄŻEK','KRZYŻAK','A · START');if(p.id===1&&touchAvailable())tags.push('DOTYK GAŁKA');return [...new Set(tags)].map(tag=>`<kbd>${tag}</kbd>`).join('')}
  function validatePlayerBindings(){
    const ids=new Set(),bindings=new Map(),keyboardOwners=new Map(),padOwners=new Map();
    if(players.length>8)throw new Error('More than eight active players');
    for(const p of players){
      if(!Number.isInteger(p.id)||p.id<1||p.id>8||ids.has(p.id))throw new Error('Duplicate or unstable player id');
      ids.add(p.id);
      if(p.source==='key'){
        if(!Number.isInteger(p.sourceId)||p.sourceId<0||p.sourceId>=keys.length||keyboardOwners.has(p.sourceId))throw new Error('Keyboard set has more than one player owner');
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
    const key=players.map(p=>`${p.id},${p.source},${p.sourceId},${p.score}`).join('|');if(key===rosterState)return;rosterState=key;
    playerList.innerHTML=players.slice().sort((a,b)=>a.id-b.id).map(p=>`<div class="player-entry"><span class="swatch" style="background:${p.color};color:${p.color}"></span><b class="player-name">P${p.id}</b><span class="player-controls">${playerButtons(p)}</span></div>`).join('');
  }
  function connectedPadSlots(){const slots=new Set(players.filter(p=>p.source==='pad').map(p=>p.sourceId+1));if(navigator.getGamepads)for(let i=0;i<navigator.getGamepads().length&&i<8;i++){const pad=navigator.getGamepads()[i];if(pad&&pad.connected!==false)slots.add(i+1)}return slots}
  function freeSlot(reserved=new Set(),except=null,preferred=null){const occupied=id=>players.some(p=>p!==except&&p.id===id);if(preferred&&!reserved.has(preferred)&&!occupied(preferred))return preferred;for(let id=1;id<=8;id++)if(!reserved.has(id)&&!occupied(id))return id;return null}
  function setPlayerId(p,id){const old=p.id;if(old===id)return;p.id=id;p.color=colors[(id-1)%colors.length];rosterState=''}
  function keyboardCount(){return players.filter(p=>p.source==='key').length}
  function moveKeyboardPlayers(reserved){const movers=players.filter(p=>p.source==='key'&&reserved.has(p.id)).sort((a,b)=>a.sourceId-b.sourceId),occupied=new Set(players.filter(p=>!movers.includes(p)).map(p=>p.id)),moves=[];for(const p of movers){let next=null;for(let id=1;id<=8;id++)if(!reserved.has(id)&&!occupied.has(id)){next=id;break}if(!next)return false;occupied.add(next);moves.push([p,next])}for(const[p,id]of moves)setPlayerId(p,id);return true}
  function createPlayer(source,sourceId,id){if(players.length>=8)return null;const p={id,source,sourceId,x:rand(55,W()-55),y:rand(65,H()-55),score:0,stun:0,vx:0,vy:0,color:colors[(id-1)%colors.length],invuln:0};players.push(p);rosterState='';renderPlayers();return p}
  function joinKeyboard(sourceId){const prior=players.find(p=>p.source==='key'&&p.sourceId===sourceId);if(prior)return prior;if(keyboardCount()>=keys.length)return null;const touched=players.find(p=>p.id===1&&p.source==='touch'&&sourceId===0);if(touched){touched.source='key';touched.sourceId=0;rosterState='';renderPlayers();return touched}if(players.length>=8)return null;const id=freeSlot(connectedPadSlots(),null,sourceId+1);return id?createPlayer('key',sourceId,id):null}
  function ensureTouchP1(){let p=players.find(p=>p.id===1);if(p)return p;if(players.length>=8)return null;return createPlayer('touch',0,1)}
  function joinPad(index){if(index<0||index>=8)return null;const prior=players.find(p=>p.source==='pad'&&p.sourceId===index);if(prior)return prior;const target=index+1,occupant=players.find(p=>p.id===target);if(occupant&&occupant.source==='touch'&&target===1){occupant.source='pad';occupant.sourceId=index;rosterState='';renderPlayers();return occupant}if(players.length>=8)return null;const reserved=connectedPadSlots();reserved.add(target);if(occupant&&occupant.source==='key'&&!moveKeyboardPlayers(reserved))return null;if(players.some(p=>p.id===target))return null;return createPlayer('pad',index,target)}
  function touchAxes(){return{x:touchStick.x,y:touchStick.y}}
  function resetTouchStick(){touchStick.pointerId=null;touchStick.x=touchStick.y=touchStick.intensity=0;if(touchStick.element){touchStick.element.classList.remove('is-active');touchStick.element.style.setProperty('--stick-x','0px');touchStick.element.style.setProperty('--stick-y','0px')}}
  function updateTouchStick(event){if(!touchStick.element)return;const rect=touchStick.element.getBoundingClientRect(),maxTravel=Math.max(1,Math.min(rect.width,rect.height)*.34),dx=event.clientX-(rect.left+rect.width/2),dy=event.clientY-(rect.top+rect.height/2),distance=Math.hypot(dx,dy),limited=Math.min(distance,maxTravel),raw=limited/maxTravel,deadzone=.12;touchStick.intensity=raw<=deadzone?0:(raw-deadzone)/(1-deadzone);touchStick.x=distance?dx/distance*touchStick.intensity:0;touchStick.y=distance?dy/distance*touchStick.intensity:0;const knobX=distance?dx/distance*limited:0,knobY=distance?dy/distance*limited:0;touchStick.element.style.setProperty('--stick-x',`${knobX}px`);touchStick.element.style.setProperty('--stick-y',`${knobY}px`);touchStick.element.classList.toggle('is-active',touchStick.intensity>0)}
  function bindTouchControls(){const root=document.querySelector('#touch-controls'),stick=root?.querySelector('[data-touch-joystick]');if(!root||!stick)return;touchStick.element=stick;stick.addEventListener('pointerdown',event=>{if(touchStick.pointerId!==null)return;event.preventDefault();if(!ensureTouchP1())return;touchStick.pointerId=event.pointerId;stick.setPointerCapture(event.pointerId);updateTouchStick(event)});stick.addEventListener('pointermove',event=>{if(event.pointerId===touchStick.pointerId){event.preventDefault();updateTouchStick(event)}});const release=event=>{if(event.pointerId!==touchStick.pointerId)return;event.preventDefault();resetTouchStick()};stick.addEventListener('pointerup',release);stick.addEventListener('pointercancel',release);stick.addEventListener('lostpointercapture',release)}
  function begin() {
    if (running) return;
    if (!players.length){if(touchAvailable())ensureTouchP1();else joinKeyboard(0)}
    running=true; fireflies=[]; shadows=[]; lastTime=performance.now(); spawnTimer=0; shadowTimer=4;
    players.forEach(p=>{p.score=0;p.stun=0;p.invuln=1.5;p.x=rand(40,W()-40);p.y=rand(55,H()-40)});
    overlay.classList.add('hidden'); document.querySelector('#status').textContent='GRA W TOKU'; document.querySelector('#round-label').textContent='ZBIERAJ ŚWIETLIKI';
    for(let i=0;i<7;i++) spawnFirefly();
  }
  function spawnFirefly(){fireflies.push({x:rand(22,W()-22),y:rand(48,H()-22),phase:rand(0,6.28),r:rand(4,7)})}
  function loop(now){const dt=Math.min((now-lastTime)/1000,.04);lastTime=now;pollPads(dt);if(running)update(dt);draw(now/1000);requestAnimationFrame(loop)}
  function update(dt){
    spawnTimer+=dt;if(spawnTimer>0.85&&fireflies.length<13){spawnFirefly();spawnTimer=0}
    shadowTimer-=dt;if(shadowTimer<=0&&shadows.length<4){shadows.push({x:rand(25,W()-25),y:rand(55,H()-25),phase:rand(0,6.28)});shadowTimer=rand(8,11)}
    for(const p of players){if(p.source==='key'){const ks=keys[p.sourceId];move(p,(held.has(ks[3]?ks[3]:'')?1:0)-(held.has(ks[1])?1:0),(held.has(ks[2])?1:0)-(held.has(ks[0])?1:0),dt)}if(p.id===1){const a=touchAxes();if(a.x||a.y)move(p,a.x,a.y,dt)}p.stun=Math.max(0,p.stun-dt);p.invuln=Math.max(0,p.invuln-dt)}
    for(const s of shadows){s.phase+=dt;const target=players.reduce((a,b)=>Math.hypot(b.x-s.x,b.y-s.y)<Math.hypot(a.x-s.x,a.y-s.y)?b:a,players[0]);if(target){const dx=target.x-s.x,dy=target.y-s.y,d=Math.hypot(dx,dy)||1;s.x+=dx/d*34*dt;s.y+=dy/d*34*dt;if(d<16&&target.invuln<=0){target.stun=1;target.invuln=2.1;s.x-=dx/d*60;s.y-=dy/d*60}}}
    for(const p of players) for(let i=fireflies.length-1;i>=0;i--){const f=fireflies[i];if(Math.hypot(p.x-f.x,p.y-f.y)<17){p.score++;if(p.score>best){best=p.score;localStorage.setItem('swietliki-best',best);document.querySelector('#best').textContent=best}fireflies.splice(i,1);}}
    renderPlayers();
  }
  function pollPads(dt){
    const pads=navigator.getGamepads?navigator.getGamepads():[];
    for(const index of padALatch)if(!pads[index]||pads[index].connected===false)padALatch.delete(index);
    for(let i=0;i<pads.length&&i<8;i++){
      const pad=pads[i];if(!pad||pad.connected===false)continue;
      const joinPressed=Boolean(pad.buttons[0]?.pressed);
      if(joinPressed&&!padALatch.has(i)){
        padALatch.add(i);
        if(!players.some(p=>p.source==='pad'&&p.sourceId===i))joinPad(i);
        if(!running)begin();
      }
      if(!joinPressed)padALatch.delete(i);
      const p=players.find(player=>player.source==='pad'&&player.sourceId===i);
      if(p&&running){let x=pad.axes[0]||0,y=pad.axes[1]||0;if(Math.abs(x)<.18)x=0;if(Math.abs(y)<.18)y=0;if(pad.buttons[14]?.pressed)x=-1;if(pad.buttons[15]?.pressed)x=1;if(pad.buttons[12]?.pressed)y=-1;if(pad.buttons[13]?.pressed)y=1;move(p,x,y,dt)}
    }
  }
  function move(p,x,y,dt){if(p.stun>0)return;const d=Math.hypot(x,y);if(d<.001)return;const intensity=Math.min(1,d);p.x=Math.max(15,Math.min(W()-15,p.x+x/d*150*dt*intensity));p.y=Math.max(42,Math.min(H()-15,p.y+y/d*150*dt*intensity))}
  function draw(t){const w=W(),h=H();ctx.clearRect(0,0,w,h);ctx.fillStyle='#18221c';ctx.fillRect(0,0,w,h);
    ctx.strokeStyle='#ffffff08';ctx.lineWidth=1;for(let x=0;x<w;x+=32){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke()}for(let y=0;y<h;y+=32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}
    for(let i=0;i<24;i++){const x=(i*97+37)%w,y=(i*157+71)%h;ctx.fillStyle='#d8e1b00d';ctx.beginPath();ctx.arc(x,y,1.2,0,7);ctx.fill()}
    for(const f of fireflies){const pulse=.7+Math.sin(t*5+f.phase)*.3;ctx.shadowColor='#ffcf66';ctx.shadowBlur=17*pulse;ctx.fillStyle='#ffdf88';ctx.beginPath();ctx.arc(f.x,f.y,f.r*pulse,0,7);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#fff4ce';ctx.beginPath();ctx.arc(f.x,f.y,1.6,0,7);ctx.fill()}
    for(const s of shadows){ctx.shadowColor='#aa83ff';ctx.shadowBlur=15;ctx.fillStyle='#8c6bb2';ctx.beginPath();ctx.arc(s.x,s.y,10+Math.sin(s.phase*4)*1.5,0,7);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#d1a7ff';ctx.beginPath();ctx.arc(s.x-3,s.y-2,1.3,0,7);ctx.arc(s.x+3,s.y-2,1.3,0,7);ctx.fill()}
    for(const p of players){if(p.invuln>0&&Math.floor(t*10)%2===0)continue;ctx.shadowColor=p.color;ctx.shadowBlur=17;ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,11,0,7);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#171914';ctx.beginPath();ctx.arc(p.x-3,p.y-1,1.3,0,7);ctx.arc(p.x+3,p.y-1,1.3,0,7);ctx.fill();ctx.font='10px "DM Mono",monospace';ctx.fillStyle='#fff';ctx.textAlign='center';ctx.fillText(String(p.score),p.x,p.y-19);if(p.stun>0){ctx.fillStyle='#fff';ctx.fillText('✦',p.x,p.y-28)}}
  }
  const held=new Set();
  window.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k))e.preventDefault();held.add(k);if(k==='enter'||k===' '){if(!running)begin();else if(keyboardCount()<keys.length&&!e.repeat){const next=keys.findIndex((_,i)=>!players.some(p=>p.source==='key'&&p.sourceId===i));if(next>=0)joinKeyboard(next)}}else{keys.forEach((set,i)=>{if(set.includes(k)&&!players.some(p=>p.source==='key'&&p.sourceId===i))joinKeyboard(i)})}}, {passive:false});
  window.addEventListener('keyup',e=>held.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>{held.clear();resetTouchStick()});
  window.addEventListener('gamepadconnected',e=>{document.querySelector('#status').textContent='PAD PODŁĄCZONY · NACIŚNIJ A'});
  startButton.addEventListener('click',begin);bindTouchControls();
  document.querySelector('#overlay').addEventListener('click',e=>{if(e.target===overlay)begin()});
  draw(0);requestAnimationFrame(loop);
})();
