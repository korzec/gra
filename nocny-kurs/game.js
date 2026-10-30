(() => {
  const canvas = document.querySelector('#city');
  const ctx = canvas.getContext('2d');
  const overlay = document.querySelector('#overlay');
  const colors = ['#d6f36a','#ff806a','#72d9d0','#c99aff','#ffcb66','#74a9ff','#ff8fc2','#a4e887'];
  const keysets = [['w','a','s','d'],['arrowup','arrowleft','arrowdown','arrowright'],['i','j','k','l'],['t','f','g','h']];
  const keynames = ['WASD','STRZAŁKI','IJKL','TFGH'];
  const world = {w:2800,h:2200};
  const roadsX = [120,630,1140,1650,2160,2670], roadsY = [120,510,900,1290,1680,2070], roadWidth=122;
  const held = new Set(), padLatch = new Set();
  let players=[], buildings=[], parcels=[], running=false, timeLeft=90, teamScore=0, cam={x:1400,y:1100}, last=performance.now(), lastUi='';
  const w=()=>canvas.clientWidth, h=()=>canvas.clientHeight;
  const rnd=(a,b)=>a+Math.random()*(b-a);
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

  function resize(){const r=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.max(1,Math.round(r.width*dpr));canvas.height=Math.max(1,Math.round(r.height*dpr));ctx.setTransform(dpr,0,0,dpr,0,0)}
  new ResizeObserver(resize).observe(canvas); resize();

  function makeCity(){
    for(let yi=0;yi<roadsY.length-1;yi++) for(let xi=0;xi<roadsX.length-1;xi++){
      const left=roadsX[xi]+roadWidth/2+15, right=roadsX[xi+1]-roadWidth/2-15;
      const top=roadsY[yi]+roadWidth/2+15, bottom=roadsY[yi+1]-roadWidth/2-15;
      const bw=(right-left),bh=(bottom-top);
      const splitX=left+bw*.52, splitY=top+bh*.53;
      const blocks=[[left+8,top+8,splitX-left-18,splitY-top-18],[splitX+8,top+8,right-splitX-16,splitY-top-18],[left+8,splitY+8,splitX-left-18,bottom-splitY-16],[splitX+8,splitY+8,right-splitX-16,bottom-splitY-16]];
      for(const [x,y,ww,hh] of blocks){
        if(ww<45||hh<45)continue;
        const margin=rnd(7,17),rw=ww-margin*2,rh=hh-margin*2;
        buildings.push({x:x+margin,y:y+margin,w:rw,h:rh,tone:Math.floor(rnd(0,4)),seed:rnd(0,1000),kind:Math.random()<.2?'yard':'building'});
      }
    }
  }
  makeCity();
  function addParcel(){
    if(parcels.length>=13)return;
    const onVertical=Math.random()<.5;
    const x=onVertical?roadsX[Math.floor(Math.random()*roadsX.length)]+rnd(-32,32):rnd(90,world.w-90);
    const y=onVertical?rnd(90,world.h-90):roadsY[Math.floor(Math.random()*roadsY.length)]+rnd(-32,32);
    parcels.push({x,y,phase:rnd(0,6.28)});
  }
  function renderPlayers(){
    const el=document.querySelector('#player-list');
    document.querySelector('#player-count').textContent=players.length;
    const key=players.map(p=>p.id+','+p.score).join('|');if(key===lastUi)return;lastUi=key;
    if(!players.length){el.innerHTML='<div class="empty-state"><span>＋</span><p>Dołącz na klawiaturze<br>lub kontrolerze.</p></div>';return}
    el.innerHTML=players.map(p=>`<div class="player-entry"><span class="swatch" style="background:${p.color};color:${p.color}"></span>GRACZ ${p.id}<small>${p.source==='pad'?'PAD '+(p.sourceId+1):keynames[p.sourceId]} · ${p.score}</small></div>`).join('');
  }
  function join(source,sourceId){
    if(players.some(p=>p.source===source&&p.sourceId===sourceId))return;
    if(players.length>=8)return;
    const index=players.length,base=players[0]||{x:roadsX[2],y:roadsY[2]};
    const p={id:index+1,source,sourceId,x:clamp(base.x+rnd(-80,80),30,world.w-30),y:clamp(base.y+rnd(-80,80),30,world.h-30),score:0,color:colors[index],stun:0};
    players.push(p);lastUi='';renderPlayers();
    if(!running){cam.x=p.x;cam.y=p.y}
  }
  function start(){
    if(running)return;
    if(!players.length)join('key',0);
    running=true;timeLeft=90;teamScore=0;parcels=[];cam.x=players[0].x;cam.y=players[0].y;
    players.forEach(p=>{p.score=0;p.stun=0});for(let i=0;i<11;i++)addParcel();
    document.querySelector('#score').textContent='0 / 12';document.querySelector('#timer').textContent='90';document.querySelector('#status').textContent='EKIPA W DRODZE';document.querySelector('#round-label').textContent='12 PRZESYŁEK';
    lastUi='';renderPlayers();overlay.classList.add('hidden');
  }
  function finish(won){
    running=false;document.querySelector('#round-label').textContent=won?'KURS DOWIEZIONY':'KONIEC ZMIANY';document.querySelector('#status').textContent=won?'DOSTAWA KOMPLETNA':'KONIEC RUNDY';
    document.querySelector('#overlay-title').innerHTML=won?'Dobra robota.<br><em>Kurs dowieziony!</em>':'Zmiana <em>zakończona.</em>';
    document.querySelector('#overlay-copy').textContent=`Ekipa zebrała ${teamScore} z 12 przesyłek. Złapcie oddech i ruszajcie jeszcze raz.`;
    overlay.classList.remove('hidden');
  }
  function blocked(x,y,r=10){
    for(const b of buildings)if(x+r>b.x&&x-r<b.x+b.w&&y+r>b.y&&y-r<b.y+b.h)return true;
    return false;
  }
  function move(p,dx,dy,dt){
    if(p.stun>0){p.stun=Math.max(0,p.stun-dt);return}
    const len=Math.hypot(dx,dy)||1,speed=160*dt;
    const nx=clamp(p.x+dx/len*speed,14,world.w-14),ny=clamp(p.y+dy/len*speed,14,world.h-14);
    if(!blocked(nx,p.y))p.x=nx;if(!blocked(p.x,ny))p.y=ny;
  }
  function pollPads(){
    if(!navigator.getGamepads)return;
    const pads=navigator.getGamepads();
    for(let i=0;i<pads.length;i++){
      const pad=pads[i];if(!pad)continue;
      const pressed=!!pad.buttons[0]?.pressed;
      if(pressed&&!padLatch.has(i)){padLatch.add(i);if(!players.some(p=>p.source==='pad'&&p.sourceId===i)){if(players.length<8)join('pad',i);if(!running)start()}}
      if(!pressed)padLatch.delete(i);
      const p=players.find(q=>q.source==='pad'&&q.sourceId===i);if(p&&running){let dx=pad.axes[0]||0,dy=pad.axes[1]||0;if(Math.abs(dx)<.17)dx=0;if(Math.abs(dy)<.17)dy=0;if(pad.buttons[14]?.pressed)dx=-1;if(pad.buttons[15]?.pressed)dx=1;if(pad.buttons[12]?.pressed)dy=-1;if(pad.buttons[13]?.pressed)dy=1;move(p,dx,dy,delta)}
    }
  }
  let delta=0;
  function update(dt){
    pollPads();if(!running)return;
    timeLeft=Math.max(0,timeLeft-dt);document.querySelector('#timer').textContent=Math.ceil(timeLeft);
    for(const p of players){if(p.source==='key'){const set=keysets[p.sourceId];move(p,(held.has(set[3])?1:0)-(held.has(set[1])?1:0),(held.has(set[2])?1:0)-(held.has(set[0])?1:0),dt)}}
    const target=players.reduce((a,p)=>({x:a.x+p.x/players.length,y:a.y+p.y/players.length}),{x:0,y:0});
    const halfW=w()/2,halfH=h()/2;
    cam.x+=(clamp(target.x,halfW,world.w-halfW)-cam.x)*Math.min(1,dt*2.5);
    cam.y+=(clamp(target.y,halfH,world.h-halfH)-cam.y)*Math.min(1,dt*2.5);
    for(let i=parcels.length-1;i>=0;i--)for(const p of players)if(Math.hypot(p.x-parcels[i].x,p.y-parcels[i].y)<23){parcels.splice(i,1);p.score++;teamScore++;document.querySelector('#score').textContent=`${teamScore} / 12`;lastUi='';renderPlayers();addParcel();break}
    if(teamScore>=12){finish(true);return}if(timeLeft<=0)finish(false);
  }
  function screen(x,y){return{x:x-cam.x+w()/2,y:y-cam.y+h()/2}}
  function drawCar(x,y,angle,color){ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.fillStyle='#070b0a';ctx.fillRect(-15,-8,32,20);ctx.fillStyle=color;ctx.fillRect(-14,-10,28,18);ctx.fillStyle='#a9c6c2';ctx.fillRect(-7,-8,12,5);ctx.fillStyle='#ffe4a0';ctx.fillRect(11,-7,3,4);ctx.fillStyle='#e56d58';ctx.fillRect(11,2,3,4);ctx.restore()}
  function drawWorld(t){
    const cw=w(),ch=h();ctx.clearRect(0,0,cw,ch);ctx.fillStyle='#18201b';ctx.fillRect(0,0,cw,ch);
    const left=cam.x-cw/2,top=cam.y-ch/2;
    ctx.save();ctx.translate(cw/2-cam.x,ch/2-cam.y);
    ctx.fillStyle='#28302c';for(const x of roadsX)ctx.fillRect(x-roadWidth/2,0,roadWidth,world.h);for(const y of roadsY)ctx.fillRect(0,y-roadWidth/2,world.w,roadWidth);
    ctx.fillStyle='#dbc98566';for(const x of roadsX)for(let y=0;y<world.h;y+=58)ctx.fillRect(x-1,y,2,24);for(const y of roadsY)for(let x=0;x<world.w;x+=58)ctx.fillRect(x,y-1,24,2);
    for(const b of buildings){if(b.x+b.w<left-30||b.x>left+cw+30||b.y+b.h<top-30||b.y>top+ch+30)continue;
      ctx.fillStyle=['#343a35','#39403b','#303a39','#3d3b37'][b.tone];ctx.fillRect(b.x,b.y,b.w,b.h);
      if(b.kind==='yard'){ctx.fillStyle='#263b30';ctx.fillRect(b.x+6,b.y+6,b.w-12,b.h-12);ctx.fillStyle='#67775a';for(let xx=b.x+18;xx<b.x+b.w-10;xx+=30){ctx.beginPath();ctx.arc(xx,b.y+b.h/2,5,0,Math.PI*2);ctx.fill()}continue}
      ctx.fillStyle='#272e2a';ctx.fillRect(b.x+7,b.y+7,b.w-14,b.h-14);
      ctx.fillStyle='#e9c56d';for(let xx=b.x+16;xx<b.x+b.w-10;xx+=27){ctx.fillRect(xx,b.y+13,8,4);ctx.fillRect(xx,b.y+b.h-17,8,4)}
      ctx.fillStyle='#59634e';ctx.fillRect(b.x+b.w/2-4,b.y+b.h/2-4,8,8);
    }
    for(const y of roadsY){drawCar(((t*53+y*3)%(world.w+100))-50,y-25,0,'#a95449');drawCar((world.w-((t*39+y*5)%(world.w+100)))+50,y+25,Math.PI,'#506f84')}
    for(const x of roadsX){drawCar(x-27,((t*45+x)%(world.h+100))-50,Math.PI/2,'#c18d49');drawCar(x+27,world.h-((t*35+x*2)%(world.h+100))+50,-Math.PI/2,'#547760')}
    for(const parcel of parcels){const q=screen(parcel.x,parcel.y),pulse=1+Math.sin(t*5+parcel.phase)*.16;ctx.save();ctx.translate(parcel.x,parcel.y);ctx.rotate(Math.PI/4);ctx.shadowColor='#f4cb67';ctx.shadowBlur=14;ctx.fillStyle='#e6b94e';ctx.fillRect(-7*pulse,-7*pulse,14*pulse,14*pulse);ctx.shadowBlur=0;ctx.fillStyle='#fff0bd';ctx.fillRect(-2,-2,4,4);ctx.restore()}
    for(const p of players){ctx.save();ctx.translate(p.x,p.y);ctx.shadowColor=p.color;ctx.shadowBlur=15;ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(0,0,12,0,7);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#17201a';ctx.beginPath();ctx.arc(-4,-2,1.8,0,7);ctx.arc(4,-2,1.8,0,7);ctx.fill();ctx.strokeStyle='#17201a';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,2,4,.2,Math.PI-.2);ctx.stroke();ctx.fillStyle='#f2e9ce';ctx.font='9px "DM Mono",monospace';ctx.textAlign='center';ctx.fillText('P'+p.id,0,-18);ctx.restore()}
    ctx.restore();
    drawArrows();
  }
  function drawArrows(){
    const cw=w(),ch=h(),cx=cw/2,cy=ch/2,margin=32;
    for(const p of players){const q=screen(p.x,p.y);if(q.x>=18&&q.x<=cw-18&&q.y>=18&&q.y<=ch-18)continue;
      const dx=q.x-cx,dy=q.y-cy,scale=Math.min((cw/2-margin)/Math.max(Math.abs(dx),.001),(ch/2-margin)/Math.max(Math.abs(dy),.001));
      const ax=cx+dx*scale,ay=cy+dy*scale,angle=Math.atan2(dy,dx),meters=Math.round(Math.hypot(dx,dy)/2);
      ctx.save();ctx.translate(ax,ay);ctx.rotate(angle);ctx.fillStyle=p.color;ctx.shadowColor=p.color;ctx.shadowBlur=12;ctx.beginPath();ctx.moveTo(13,0);ctx.lineTo(-9,-8);ctx.lineTo(-6,0);ctx.lineTo(-9,8);ctx.closePath();ctx.fill();ctx.restore();
      const tx=clamp(ax+Math.cos(angle)*22,46,cw-46),ty=clamp(ay+Math.sin(angle)*22,16,ch-16);
      ctx.font='9px "DM Mono",monospace';ctx.textAlign='center';ctx.textBaseline='middle';const label=`P${p.id} · ${meters} m`;const lw=ctx.measureText(label).width+12;ctx.fillStyle='#101510e8';ctx.fillRect(tx-lw/2,ty-9,lw,18);ctx.fillStyle=p.color;ctx.fillText(label,tx,ty+.5);
    }
  }
  function loop(now){delta=Math.min((now-last)/1000,.05);last=now;update(delta);drawWorld(now/1000);requestAnimationFrame(loop)}
  window.addEventListener('keydown',e=>{
    const k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k))e.preventDefault();
    held.add(k);
    if(k==='enter'||k===' '){if(!running)start();else if(!e.repeat){const next=keysets.findIndex((_,i)=>!players.some(p=>p.source==='key'&&p.sourceId===i));if(next>=0)join('key',next)}return}
    const i=keysets.findIndex(set=>set.includes(k));if(i>=0&&!players.some(p=>p.source==='key'&&p.sourceId===i)&&players.length<8)join('key',i);
  },{passive:false});
  window.addEventListener('keyup',e=>held.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>held.clear());
  document.querySelector('#start').addEventListener('click',start);
  overlay.addEventListener('click',e=>{if(e.target===overlay)start()});
  renderPlayers();requestAnimationFrame(loop);
})();
