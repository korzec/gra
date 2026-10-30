(() => {
  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d');
  const overlay = document.querySelector('#overlay');
  const startButton = document.querySelector('#start');
  const playerList = document.querySelector('#player-list');
  const colors = ['#d6f36a','#ff7b64','#72d9d0','#c99aff','#ffcb66','#74a9ff','#ff8fc2','#a4e887'];
  const keys = [ ['w','a','s','d'], ['arrowup','arrowleft','arrowdown','arrowright'], ['i','j','k','l'], ['t','f','g','h'] ];
  const keyNames = ['WASD','STRZAŁKI','IJKL','TFGH'];
  let players = [], fireflies = [], shadows = [], running = false, remaining = 60, lastTime = 0, spawnTimer = 0, shadowTimer = 0, gamepads = new Map();
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

  function join(source, id) {
    if (players.length >= 8) return null;
    const existing = players.find(p => p.source === source && p.sourceId === id);
    if (existing) return existing;
    const p = { id: players.length+1, source, sourceId:id, x:rand(55,W()-55), y:rand(65,H()-55), score:0, stun:0, vx:0, vy:0, color:colors[players.length], invuln:0 };
    players.push(p); renderPlayers();
    return p;
  }
  function renderPlayers() {
    document.querySelector('#player-count').textContent=players.length;
    if (!players.length) { playerList.innerHTML='<div class="empty-state"><span>＋</span><p>Wskocz do gry<br>na klawiaturze lub padzie.</p></div>'; return; }
    playerList.innerHTML=players.map(p=>`<div class="player-entry"><span class="swatch" style="background:${p.color};color:${p.color}"></span>GRACZ ${p.id}<small>${p.source==='pad'?'PAD '+(p.sourceId+1):keyNames[p.sourceId]}</small></div>`).join('');
  }
  function begin() {
    if (running) return;
    if (!players.length) join('key',0);
    running=true; remaining=60; fireflies=[]; shadows=[]; lastTime=performance.now(); spawnTimer=0; shadowTimer=4;
    players.forEach(p=>{p.score=0;p.stun=0;p.invuln=1.5;p.x=rand(40,W()-40);p.y=rand(55,H()-40)});
    overlay.classList.add('hidden'); document.querySelector('#status').textContent='RUNDKA W TOKU'; document.querySelector('#round-label').textContent='ZBIERAJ ŚWIETLIKI';
    for(let i=0;i<7;i++) spawnFirefly(); requestAnimationFrame(loop);
  }
  function spawnFirefly(){fireflies.push({x:rand(22,W()-22),y:rand(48,H()-22),phase:rand(0,6.28),r:rand(4,7)})}
  function loop(now){if(!running)return;const dt=Math.min((now-lastTime)/1000,.04);lastTime=now;update(dt);draw(now/1000);requestAnimationFrame(loop)}
  function update(dt){
    remaining=Math.max(0,remaining-dt);document.querySelector('#timer').textContent=Math.ceil(remaining);
    spawnTimer+=dt;if(spawnTimer>0.85&&fireflies.length<13){spawnFirefly();spawnTimer=0}
    shadowTimer-=dt;if(shadowTimer<=0&&shadows.length<4){shadows.push({x:rand(25,W()-25),y:rand(55,H()-25),phase:rand(0,6.28)});shadowTimer=rand(8,11)}
    const pads=navigator.getGamepads?navigator.getGamepads():[];
    for(let i=0;i<pads.length;i++){const pad=pads[i];if(!pad)continue;
      if(pad.connected&&!gamepads.has(i))gamepads.set(i,true);
      if(pad.connected&&!players.some(p=>p.source==='pad'&&p.sourceId===i)&&pad.buttons.some((b,j)=>j<4&&b.pressed))join('pad',i);
      const p=players.find(p=>p.source==='pad'&&p.sourceId===i);if(p){let x=pad.axes[0]||0,y=pad.axes[1]||0;if(Math.abs(x)<.18)x=0;if(Math.abs(y)<.18)y=0;if(pad.buttons[14]?.pressed)x=-1;if(pad.buttons[15]?.pressed)x=1;if(pad.buttons[12]?.pressed)y=-1;if(pad.buttons[13]?.pressed)y=1;move(p,x,y,dt)}
    }
    for(const p of players){if(p.source==='key'){const ks=keys[p.sourceId];move(p,(held.has(ks[3]?ks[3]:'')?1:0)-(held.has(ks[1])?1:0),(held.has(ks[2])?1:0)-(held.has(ks[0])?1:0),dt)}p.stun=Math.max(0,p.stun-dt);p.invuln=Math.max(0,p.invuln-dt)}
    for(const s of shadows){s.phase+=dt;const target=players.reduce((a,b)=>Math.hypot(b.x-s.x,b.y-s.y)<Math.hypot(a.x-s.x,a.y-s.y)?b:a,players[0]);if(target){const dx=target.x-s.x,dy=target.y-s.y,d=Math.hypot(dx,dy)||1;s.x+=dx/d*34*dt;s.y+=dy/d*34*dt;if(d<16&&target.invuln<=0){target.stun=1;target.invuln=2.1;s.x-=dx/d*60;s.y-=dy/d*60}}}
    for(const p of players) for(let i=fireflies.length-1;i>=0;i--){const f=fireflies[i];if(Math.hypot(p.x-f.x,p.y-f.y)<17){p.score++;fireflies.splice(i,1);}}
    renderPlayers();if(remaining<=0)finish();
  }
  function move(p,x,y,dt){if(p.stun>0)return;const d=Math.hypot(x,y)||1;p.x=Math.max(15,Math.min(W()-15,p.x+x/d*150*dt));p.y=Math.max(42,Math.min(H()-15,p.y+y/d*150*dt))}
  function finish(){running=false;const high=Math.max(...players.map(p=>p.score));if(high>best){best=high;localStorage.setItem('swietliki-best',best);document.querySelector('#best').textContent=best}const winners=players.filter(p=>p.score===high);document.querySelector('#overlay-title').innerHTML=winners.length===1?`Wygrywa <em>gracz ${winners[0].id}!</em>`:'Ale była <em>dogrywka!</em>';document.querySelector('#overlay-copy').textContent=`Najlepszy wynik: ${high} ${high===1?'świetlik':'świetliki'}. ${players.map(p=>`Gracz ${p.id}: ${p.score}`).join(' · ')}`;document.querySelector('#round-label').textContent='KONIEC RUNDY';document.querySelector('#status').textContent='KONIEC RUNDY';overlay.classList.remove('hidden')}
  function draw(t){const w=W(),h=H();ctx.clearRect(0,0,w,h);ctx.fillStyle='#18221c';ctx.fillRect(0,0,w,h);
    ctx.strokeStyle='#ffffff08';ctx.lineWidth=1;for(let x=0;x<w;x+=32){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke()}for(let y=0;y<h;y+=32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}
    for(let i=0;i<24;i++){const x=(i*97+37)%w,y=(i*157+71)%h;ctx.fillStyle='#d8e1b00d';ctx.beginPath();ctx.arc(x,y,1.2,0,7);ctx.fill()}
    for(const f of fireflies){const pulse=.7+Math.sin(t*5+f.phase)*.3;ctx.shadowColor='#ffcf66';ctx.shadowBlur=17*pulse;ctx.fillStyle='#ffdf88';ctx.beginPath();ctx.arc(f.x,f.y,f.r*pulse,0,7);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#fff4ce';ctx.beginPath();ctx.arc(f.x,f.y,1.6,0,7);ctx.fill()}
    for(const s of shadows){ctx.shadowColor='#aa83ff';ctx.shadowBlur=15;ctx.fillStyle='#8c6bb2';ctx.beginPath();ctx.arc(s.x,s.y,10+Math.sin(s.phase*4)*1.5,0,7);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#d1a7ff';ctx.beginPath();ctx.arc(s.x-3,s.y-2,1.3,0,7);ctx.arc(s.x+3,s.y-2,1.3,0,7);ctx.fill()}
    for(const p of players){if(p.invuln>0&&Math.floor(t*10)%2===0)continue;ctx.shadowColor=p.color;ctx.shadowBlur=17;ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,11,0,7);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#171914';ctx.beginPath();ctx.arc(p.x-3,p.y-1,1.3,0,7);ctx.arc(p.x+3,p.y-1,1.3,0,7);ctx.fill();ctx.font='10px "DM Mono",monospace';ctx.fillStyle='#fff';ctx.textAlign='center';ctx.fillText(String(p.score),p.x,p.y-19);if(p.stun>0){ctx.fillStyle='#fff';ctx.fillText('✦',p.x,p.y-28)}}
  }
  const held=new Set();
  window.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k))e.preventDefault();held.add(k);if(k==='enter'||k===' '){if(!running)begin();else if(players.length<4&&!e.repeat){const next=[0,1,2,3].find(i=>!players.some(p=>p.source==='key'&&p.sourceId===i));if(next!==undefined)join('key',next)}}else{keys.forEach((set,i)=>{if(set.includes(k)&&!players.some(p=>p.source==='key'&&p.sourceId===i))join('key',i)})}}, {passive:false});
  window.addEventListener('keyup',e=>held.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>held.clear());
  window.addEventListener('gamepadconnected',e=>{document.querySelector('#status').textContent='PAD PODŁĄCZONY · NACIŚNIJ A'});
  startButton.addEventListener('click',begin);
  document.querySelector('#overlay').addEventListener('click',e=>{if(e.target===overlay)begin()});
  draw(0);
})();
