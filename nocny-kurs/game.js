(() => {
  const canvas=document.querySelector('#city'),ctx=canvas.getContext('2d'),overlay=document.querySelector('#overlay');
  const colors=['#d6f36a','#ff806a','#72d9d0','#c99aff','#ffcb66','#74a9ff','#ff8fc2','#a4e887'];
  const keysets=[['w','a','s','d'],['arrowup','arrowleft','arrowdown','arrowright'],['i','j','k','l'],['t','f','g','h']];
  const keynames=['WASD','STRZAŁKI','IJKL','TFGH'];
  const controls=[
    {enter:'e',fire:'q'}, {enter:'shift',fire:'.'}, {enter:'o',fire:'u'}, {enter:'v',fire:'r'}
  ];
  const world={w:2800,h:2200},roadsX=[120,630,1140,1650,2160,2670],roadsY=[120,510,900,1290,1680,2070],roadWidth=122;
  const held=new Set(),padALatch=new Set(),padBLatch=new Set();
  let players=[],buildings=[],cars=[],guards=[],parcels=[],bullets=[],running=false,timeLeft=90,teamScore=0;
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
    const spots=[[1170,900,0],[900,510,0],[1450,900,Math.PI],[1960,1290,0],[2400,1680,Math.PI],[900,2070,0],[630,290,Math.PI/2],[1140,700,Math.PI/2],[1650,1100,-Math.PI/2],[2160,1500,Math.PI/2],[2670,1900,-Math.PI/2],[120,1650,Math.PI/2],[630,1250,-Math.PI/2],[2160,300,Math.PI/2],[1650,1900,Math.PI/2],[1200,510,0]];
    cars=spots.map(([x,y,angle],i)=>({id:i,x,y,angle,speed:0,driver:null,color:['#b84e42','#4f7791','#c29a50','#638261','#7b6797','#cf7048'][i%6]}));
  }
  makeCity();makeCars();
  function addParcel(){if(parcels.length>=13)return;const vertical=Math.random()<.5,x=vertical?roadsX[Math.floor(Math.random()*roadsX.length)]+rnd(-32,32):rnd(90,world.w-90),y=vertical?rnd(90,world.h-90):roadsY[Math.floor(Math.random()*roadsY.length)]+rnd(-32,32);parcels.push({x,y,phase:rnd(0,6.28)})}
  function pos(p){return p.car?{x:p.car.x,y:p.car.y}:p}
  function renderPlayers(){
    document.querySelector('#player-count').textContent=players.length;
    const key=players.map(p=>`${p.id},${p.score},${p.hits},${p.car?1:0}`).join('|');if(key===lastUi)return;lastUi=key;
    const el=document.querySelector('#player-list');if(!players.length){el.innerHTML='<div class="empty-state"><span>＋</span><p>Dołącz na klawiaturze<br>lub kontrolerze.</p></div>';return}
    el.innerHTML=players.map(p=>`<div class="player-entry"><span class="swatch" style="background:${p.color};color:${p.color}"></span>GRACZ ${p.id}<small>${p.source==='pad'?'PAD '+(p.sourceId+1):keynames[p.sourceId]} · ${p.score}✦${p.car?' · AUTO':''}</small></div>`).join('');
  }
  function join(source,sourceId){
    if(players.some(p=>p.source===source&&p.sourceId===sourceId)||players.length>=8)return;
    const base=players.length?pos(players[0]):{x:roadsX[2],y:roadsY[2]},id=players.length+1;
    const p={id,source,sourceId,x:clamp(base.x+rnd(-75,75),30,world.w-30),y:clamp(base.y+rnd(-75,75),30,world.h-30),score:0,hits:0,color:colors[id-1],stun:0,invuln:0,fireCooldown:0,facing:0,walk:0,car:null};
    players.push(p);lastUi='';renderPlayers();if(!running){cam.x=p.x;cam.y=p.y}
  }
  function start(){if(running)return;if(!players.length)join('key',0);players.forEach(p=>{p.score=0;p.hits=0;p.stun=0;p.invuln=0;p.car=null});cars.forEach(c=>{c.driver=null;c.speed=0});
    running=true;timeLeft=90;teamScore=0;bullets=[];parcels=[];zoom=1;guards=[[1560,900],[365,510],[1640,510],[2440,900],[630,1680],[2160,1290]].map(([x,y],i)=>({id:100+i,x,y,color:['#f18161','#e8a14e','#db7258','#e5bf64','#e98561'][i],facing:0,walk:0,stun:0,hp:2,invuln:0}));const q=pos(players[0]);cam.x=q.x;cam.y=q.y;for(let i=0;i<11;i++)addParcel();
    document.querySelector('#score').textContent='0 / 12';document.querySelector('#timer').textContent='90';document.querySelector('#status').textContent='EKIPA W DRODZE';document.querySelector('#round-label').textContent='12 PRZESYŁEK';document.querySelector('#zoom-indicator').textContent='KADR 100%';lastUi='';renderPlayers();overlay.classList.add('hidden')
  }
  function finish(won){running=false;document.querySelector('#round-label').textContent=won?'KURS DOWIEZIONY':'KONIEC ZMIANY';document.querySelector('#status').textContent=won?'DOSTAWA KOMPLETNA':'KONIEC RUNDY';document.querySelector('#overlay-title').innerHTML=won?'Dobra robota.<br><em>Kurs dowieziony!</em>':'Zmiana <em>zakończona.</em>';document.querySelector('#overlay-copy').textContent=`Ekipa zebrała ${teamScore} z 12 przesyłek. Złapcie oddech i ruszajcie jeszcze raz.`;overlay.classList.remove('hidden')}
  function blocked(x,y,r=10){for(const b of buildings)if(x+r>b.x&&x-r<b.x+b.w&&y+r>b.y&&y-r<b.y+b.h)return true;return false}
  function enterOrExit(p){
    if(p.car){const c=p.car,side=c.angle+Math.PI/2;p.x=c.x+Math.cos(side)*27;p.y=c.y+Math.sin(side)*27;c.driver=null;c.speed=0;p.car=null;lastUi='';renderPlayers();return}
    let closest=null,dist=48;for(const c of cars)if(!c.driver){const d=Math.hypot(c.x-p.x,c.y-p.y);if(d<dist){dist=d;closest=c}}
    if(closest){p.car=closest;closest.driver=p;closest.speed=0;p.x=closest.x;p.y=closest.y;lastUi='';renderPlayers()}
  }
  function walk(p,dx,dy,dt){if(p.stun>0){p.stun=Math.max(0,p.stun-dt);p.walk=0;return}const len=Math.hypot(dx,dy);p.walk=len;if(len<.01)return;p.facing=Math.atan2(dy,dx);const nx=clamp(p.x+dx/len*155*dt,14,world.w-14),ny=clamp(p.y+dy/len*155*dt,14,world.h-14);if(!blocked(nx,p.y,9))p.x=nx;if(!blocked(p.x,ny,9))p.y=ny}
  function drive(p,throttle,steer,dt){const c=p.car;if(!c)return;if(p.stun>0){p.stun=Math.max(0,p.stun-dt);c.speed*=.92;return}c.speed+=throttle*310*dt;c.speed*=Math.pow(.975,dt*60);c.speed=clamp(c.speed,-115,285);c.angle+=steer*dt*(1.05+Math.min(Math.abs(c.speed)/150,1.4))*(c.speed< -3?-1:1);const nx=c.x+Math.cos(c.angle)*c.speed*dt,ny=c.y+Math.sin(c.angle)*c.speed*dt;if(!blocked(nx,ny,16)&&nx>15&&nx<world.w-15&&ny>15&&ny<world.h-15){c.x=nx;c.y=ny}else c.speed*=-.22;p.x=c.x;p.y=c.y;p.facing=c.angle;p.walk=Math.abs(c.speed)>.5?1:0}
  function shoot(p){if(p.fireCooldown>0||p.stun>0)return;const q=pos(p),angle=p.car?p.car.angle:p.facing;p.fireCooldown=.24;bullets.push({x:q.x+Math.cos(angle)*19,y:q.y+Math.sin(angle)*19,vx:Math.cos(angle)*510,vy:Math.sin(angle)*510,angle,owner:p.id,life:1.15});}
  function pollPads(){if(!navigator.getGamepads)return;const pads=navigator.getGamepads();for(let i=0;i<pads.length;i++){const pad=pads[i];if(!pad)continue;const a=!!pad.buttons[0]?.pressed,b=!!pad.buttons[1]?.pressed;
      if(a&&!padALatch.has(i)){padALatch.add(i);if(!players.some(p=>p.source==='pad'&&p.sourceId===i))join('pad',i);if(!running)start()}if(!a)padALatch.delete(i);
      if(b&&!padBLatch.has(i)){padBLatch.add(i);const p=players.find(q=>q.source==='pad'&&q.sourceId===i);if(p&&running)enterOrExit(p)}if(!b)padBLatch.delete(i);
      const p=players.find(q=>q.source==='pad'&&q.sourceId===i);if(!p)continue;
      if(running){let dx=pad.axes[0]||0,dy=pad.axes[1]||0;if(Math.abs(dx)<.17)dx=0;if(Math.abs(dy)<.17)dy=0;if(p.car)drive(p,-dy,dx,delta);else walk(p,dx,dy,delta);if((pad.buttons[7]?.pressed||pad.buttons[5]?.pressed)&&p.fireCooldown<=0)shoot(p)}
    }}
  function update(dt){pollPads();if(!running)return;timeLeft=Math.max(0,timeLeft-dt);document.querySelector('#timer').textContent=Math.ceil(timeLeft);
    for(const p of players){p.invuln=Math.max(0,p.invuln-dt);p.fireCooldown=Math.max(0,p.fireCooldown-dt);if(p.source==='key'){const s=keysets[p.sourceId],up=held.has(s[0]),left=held.has(s[1]),down=held.has(s[2]),right=held.has(s[3]),fire=held.has(controls[p.sourceId].fire);if(p.car)drive(p,(up?1:0)-(down?1:0),(right?1:0)-(left?1:0),dt);else walk(p,(right?1:0)-(left?1:0),(down?1:0)-(up?1:0),dt);if(fire&&p.fireCooldown<=0)shoot(p)}}
    for(const g of guards){g.stun=Math.max(0,g.stun-dt);g.walk=0;if(g.stun>0)continue;let target=null,nearest=370;for(const p of players){const q=pos(p),d=Math.hypot(q.x-g.x,q.y-g.y);if(d<nearest){nearest=d;target=q}}if(target){const dx=target.x-g.x,dy=target.y-g.y;g.facing=Math.atan2(dy,dx);g.walk=1;const speed=nearest<65?-35:54,n=Math.hypot(dx,dy)||1,nx=g.x+dx/n*speed*dt,ny=g.y+dy/n*speed*dt;if(!blocked(nx,g.y,9))g.x=nx;if(!blocked(g.x,ny,9))g.y=ny}}
    const target=players.reduce((a,p)=>{const q=pos(p);return{x:a.x+q.x/players.length,y:a.y+q.y/players.length}},{x:0,y:0});let far=0;for(const p of players){const q=pos(p);far=Math.max(far,Math.hypot(q.x-target.x,q.y-target.y))}
    const fit=Math.min(w(),h())/2-55,targetZoom=clamp(1-Math.max(0,far-fit*.55)/950*.5,.5,1);zoom+=(targetZoom-zoom)*Math.min(1,dt*1.7);const halfW=w()/(2*zoom),halfH=h()/(2*zoom);cam.x+=(clamp(target.x,halfW,world.w-halfW)-cam.x)*Math.min(1,dt*2.5);cam.y+=(clamp(target.y,halfH,world.h-halfH)-cam.y)*Math.min(1,dt*2.5);document.querySelector('#zoom-indicator').textContent=`KADR ${Math.round(zoom*100)}%`;
    for(let i=parcels.length-1;i>=0;i--)for(const p of players){const q=pos(p);if(Math.hypot(q.x-parcels[i].x,q.y-parcels[i].y)<24){parcels.splice(i,1);p.score++;teamScore++;document.querySelector('#score').textContent=`${teamScore} / 12`;lastUi='';renderPlayers();addParcel();break}}
    for(let i=bullets.length-1;i>=0;i--){const b=bullets[i];b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;if(b.life<=0||b.x<0||b.x>world.w||b.y<0||b.y>world.h||blocked(b.x,b.y,3)){bullets.splice(i,1);continue}let hit=false;for(const p of players){if(p.id===b.owner||p.invuln>0)continue;const q=pos(p);if(Math.hypot(q.x-b.x,q.y-b.y)<16){p.stun=.85;p.invuln=1.1;if(p.car)p.car.speed*=.25;p.hits++;lastUi='';renderPlayers();bullets.splice(i,1);hit=true;break}}if(hit)continue;for(let j=guards.length-1;j>=0;j--){const g=guards[j];if(Math.hypot(g.x-b.x,g.y-b.y)<16){g.hp--;g.stun=.8;bullets.splice(i,1);if(g.hp<=0){guards.splice(j,1);document.querySelector('#status').textContent='OCHRONA ROZBROJONA'}else document.querySelector('#status').textContent='STRAŻNIK OGŁUSZONY';hit=true;break}}if(hit)continue}
    if(teamScore>=12){finish(true);return}if(timeLeft<=0)finish(false)
  }
  function screen(x,y){return{x:(x-cam.x)*zoom+w()/2,y:(y-cam.y)*zoom+h()/2}}
  function drawPerson(p,t){const q=pos(p),moving=p.walk>.02,step=moving?Math.sin(t*15+p.id):0;ctx.save();ctx.translate(q.x,q.y);ctx.rotate(p.facing);if(p.invuln>0&&Math.floor(t*14)%2===0)ctx.globalAlpha=.5;
    // Legs and shoes: local forward is +X.
    ctx.lineCap='round';ctx.strokeStyle='#202422';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-7,-3);ctx.lineTo(-11+step*3,-7);ctx.moveTo(-7,3);ctx.lineTo(-11-step*3,7);ctx.stroke();ctx.strokeStyle='#b6a391';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-11+step*3,-7);ctx.lineTo(-15+step*3,-7);ctx.moveTo(-11-step*3,7);ctx.lineTo(-15-step*3,7);ctx.stroke();
    // Jacket, arms, hands, and a small sidearm, all visible from above.
    ctx.strokeStyle='#17201a';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(-4,-3);ctx.lineTo(2,-8);ctx.moveTo(-4,3);ctx.lineTo(2,8);ctx.stroke();ctx.strokeStyle=p.color;ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-4,-3);ctx.lineTo(2,-8);ctx.moveTo(-4,3);ctx.lineTo(2,8);ctx.stroke();ctx.fillStyle='#e4bc98';ctx.beginPath();ctx.arc(2,-8,2.4,0,7);ctx.arc(2,8,2.4,0,7);ctx.fill();ctx.fillStyle='#273b36';ctx.strokeStyle='#121815';ctx.lineWidth=1.5;ctx.beginPath();ctx.roundRect(-10,-5,13,10,3);ctx.fill();ctx.stroke();ctx.fillStyle='#dcb995';ctx.beginPath();ctx.arc(5,0,5.1,0,7);ctx.fill();ctx.strokeStyle='#4a2c24';ctx.lineWidth=1;ctx.beginPath();ctx.arc(6,0,5,Math.PI*1.55,Math.PI*2.25);ctx.stroke();ctx.fillStyle='#b8bcc0';ctx.fillRect(9,-1.2,9,2.4);ctx.fillStyle='#4d5555';ctx.fillRect(11,-.2,3,3);ctx.restore();
  }
  function drawWorld(t){const cw=w(),ch=h();ctx.clearRect(0,0,cw,ch);ctx.fillStyle='#18201b';ctx.fillRect(0,0,cw,ch);const left=cam.x-cw/(2*zoom),top=cam.y-ch/(2*zoom);ctx.save();ctx.translate(cw/2,ch/2);ctx.scale(zoom,zoom);ctx.translate(-cam.x,-cam.y);
    ctx.fillStyle='#28302c';for(const x of roadsX)ctx.fillRect(x-roadWidth/2,0,roadWidth,world.h);for(const y of roadsY)ctx.fillRect(0,y-roadWidth/2,world.w,roadWidth);
    ctx.fillStyle='#dbc98566';for(const x of roadsX)for(let y=0;y<world.h;y+=58)ctx.fillRect(x-1,y,2,24);for(const y of roadsY)for(let x=0;x<world.w;x+=58)ctx.fillRect(x,y-1,24,2);
    for(const b of buildings){if(b.x+b.w<left-30||b.x>left+cw/zoom+30||b.y+b.h<top-30||b.y>top+ch/zoom+30)continue;ctx.fillStyle=['#343a35','#39403b','#303a39','#3d3b37'][b.tone];ctx.fillRect(b.x,b.y,b.w,b.h);if(b.kind==='yard'){ctx.fillStyle='#263b30';ctx.fillRect(b.x+6,b.y+6,b.w-12,b.h-12);ctx.fillStyle='#67775a';for(let xx=b.x+18;xx<b.x+b.w-10;xx+=30){ctx.beginPath();ctx.arc(xx,b.y+b.h/2,5,0,7);ctx.fill()}continue}ctx.fillStyle='#272e2a';ctx.fillRect(b.x+7,b.y+7,b.w-14,b.h-14);ctx.fillStyle='#e9c56d';for(let xx=b.x+16;xx<b.x+b.w-10;xx+=27){ctx.fillRect(xx,b.y+13,8,4);ctx.fillRect(xx,b.y+b.h-17,8,4)}ctx.fillStyle='#59634e';ctx.fillRect(b.x+b.w/2-4,b.y+b.h/2-4,8,8)}
    for(const y of roadsY){drawTraffic(((t*53+y*3)%(world.w+100))-50,y-25,0,'#a95449');drawTraffic(world.w-((t*39+y*5)%(world.w+100))+50,y+25,Math.PI,'#506f84')}for(const x of roadsX){drawTraffic(x-27,((t*45+x)%(world.h+100))-50,Math.PI/2,'#c18d49');drawTraffic(x+27,world.h-((t*35+x*2)%(world.h+100))+50,-Math.PI/2,'#547760')}
    for(const c of cars)drawCar(c,t);
    for(const g of guards){drawPerson(g,t);const qx=g.x,qy=g.y-20;ctx.fillStyle='#211a17';ctx.fillRect(qx-15,qy-4,30,8);ctx.fillStyle=g.hp===2?'#f08a64':'#e6c86d';ctx.fillRect(qx-13,qy-2,g.hp*13,4);ctx.font='7px "DM Mono",monospace';ctx.textAlign='center';ctx.fillStyle='#f1d8ae';ctx.fillText('OCHRONA',qx,qy-8)}
    for(const f of parcels){const pulse=1+Math.sin(t*5+f.phase)*.16;ctx.save();ctx.translate(f.x,f.y);ctx.rotate(Math.PI/4);ctx.shadowColor='#f4cb67';ctx.shadowBlur=14;ctx.fillStyle='#e6b94e';ctx.fillRect(-7*pulse,-7*pulse,14*pulse,14*pulse);ctx.shadowBlur=0;ctx.fillStyle='#fff0bd';ctx.fillRect(-2,-2,4,4);ctx.restore()}
    for(const b of bullets){ctx.strokeStyle='#fff0a8';ctx.lineWidth=7;ctx.shadowColor='#ffad36';ctx.shadowBlur=16;ctx.beginPath();ctx.moveTo(b.x-b.vx*.025,b.y-b.vy*.025);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.shadowBlur=0}
    for(const p of players){if(!p.car)drawPerson(p,t)}ctx.restore();drawArrows();
  }
  function drawTraffic(x,y,a,color){ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.fillStyle='#090d0c';ctx.fillRect(-14,-8,29,17);ctx.fillStyle=color;ctx.fillRect(-13,-7,27,15);ctx.fillStyle='#acc4bd';ctx.fillRect(-4,-5,9,10);ctx.fillStyle='#ffe4a0';ctx.fillRect(11,-5,2,3);ctx.fillRect(11,2,2,3);ctx.restore()}
  function drawArrows(){const cw=w(),ch=h(),cx=cw/2,cy=ch/2,margin=34;for(const p of players){const q=pos(p),sp=screen(q.x,q.y);if(sp.x>=18&&sp.x<=cw-18&&sp.y>=18&&sp.y<=ch-18)continue;const dx=sp.x-cx,dy=sp.y-cy,scale=Math.min((cw/2-margin)/Math.max(Math.abs(dx),.001),(ch/2-margin)/Math.max(Math.abs(dy),.001)),ax=cx+dx*scale,ay=cy+dy*scale,angle=Math.atan2(dy,dx),meters=Math.round(Math.hypot(dx,dy)/zoom/2);ctx.save();ctx.translate(ax,ay);ctx.rotate(angle);ctx.fillStyle=p.color;ctx.shadowColor=p.color;ctx.shadowBlur=12;ctx.beginPath();ctx.moveTo(13,0);ctx.lineTo(-9,-8);ctx.lineTo(-6,0);ctx.lineTo(-9,8);ctx.closePath();ctx.fill();ctx.restore();const tx=clamp(ax+Math.cos(angle)*23,48,cw-48),ty=clamp(ay+Math.sin(angle)*23,16,ch-16);ctx.font='9px "DM Mono",monospace';ctx.textAlign='center';ctx.textBaseline='middle';const label=`P${p.id} · ${meters} m`,lw=ctx.measureText(label).width+12;ctx.fillStyle='#101510e8';ctx.fillRect(tx-lw/2,ty-9,lw,18);ctx.fillStyle=p.color;ctx.fillText(label,tx,ty+.5)}}
  function drawCar(c,t){ctx.save();ctx.translate(c.x,c.y);ctx.rotate(c.angle);ctx.fillStyle='#080b0a';ctx.fillRect(-21,-12,44,26);ctx.fillStyle=c.driver?c.driver.color:c.color;ctx.fillRect(-20,-11,40,22);ctx.fillStyle='#a8c5c0';ctx.fillRect(-6,-8,14,16);ctx.fillStyle='#334646';ctx.fillRect(10,-8,6,16);ctx.fillStyle='#ffe4a0';ctx.fillRect(17,-8,3,5);ctx.fillRect(17,4,3,5);ctx.fillStyle='#101413';ctx.fillRect(-13,-13,8,3);ctx.fillRect(7,-13,8,3);ctx.fillRect(-13,10,8,3);ctx.fillRect(7,10,8,3);if(c.driver){ctx.fillStyle='#f0d0a4';ctx.beginPath();ctx.arc(0,0,4,0,7);ctx.fill()}ctx.restore()}
  function loop(now){delta=Math.min((now-last)/1000,.05);last=now;update(delta);drawWorld(now/1000);requestAnimationFrame(loop)}
  window.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k))e.preventDefault();held.add(k);if(k==='enter'||k===' '){if(!running)start();else if(!e.repeat){const i=keysets.findIndex((_,n)=>!players.some(p=>p.source==='key'&&p.sourceId===n));if(i>=0)join('key',i)}return}if(k==='enter')return;
    const existing=players.find(p=>p.source==='key'&&controls[p.sourceId].enter===k);if(existing&&running&&!e.repeat){enterOrExit(existing);return}
    const i=keysets.findIndex(s=>s.includes(k));if(i>=0&&!players.some(p=>p.source==='key'&&p.sourceId===i)&&players.length<8)join('key',i)
  },{passive:false});
  window.addEventListener('keyup',e=>held.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>held.clear());
  document.querySelector('#start').addEventListener('click',start);overlay.addEventListener('click',e=>{if(e.target===overlay)start()});renderPlayers();requestAnimationFrame(loop);
})();
