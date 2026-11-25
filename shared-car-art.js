// Grand T passenger car body, reused by Micro M. Draw in car-local coordinates.
(function(root){
  function draw(ctx,{paint,brakeLight=0,turnSignal=null,occupied=false,time=0}){
    const t=time;
    ctx.fillStyle='#05090c';ctx.fillRect(-21,-12,44,26);ctx.fillStyle=paint;ctx.fillRect(-20,-11,40,22);ctx.fillStyle='#9ab6bb';ctx.fillRect(-6,-8,14,16);ctx.fillStyle='#283e45';ctx.fillRect(10,-8,6,16);ctx.fillStyle='#161c1d';ctx.fillRect(-13,-13,8,3);ctx.fillRect(7,-13,8,3);ctx.fillRect(-13,10,8,3);ctx.fillRect(7,10,8,3);
    const brake=Math.max(0,Math.min(1,brakeLight||0));ctx.fillStyle='#ff493b';ctx.shadowColor=brake>.02?'#ff7868':'#ff362d';ctx.shadowBlur=12+14*brake;ctx.fillRect(-20,-8,3,5);ctx.fillRect(-20,3,3,5);if(brake>.01){ctx.fillStyle=`rgba(255,137,113,${brake*.72})`;ctx.shadowColor='#ff5445';ctx.shadowBlur=14+16*brake;ctx.fillRect(-21,-9,5,7);ctx.fillRect(-21,2,5,7)}ctx.fillStyle='#fff1b0';ctx.shadowColor='#fff0a0';ctx.shadowBlur=15;ctx.fillRect(17,-8,3,5);ctx.fillRect(17,3,3,5);ctx.shadowBlur=0;if(turnSignal&&(t%0.72)<0.4){const y=turnSignal==='left'?-10:10;ctx.fillStyle='#ffc447';ctx.shadowColor='#ffb52e';ctx.shadowBlur=9;ctx.fillRect(15,y-2,5,4);ctx.fillRect(-20,y-2,5,4);ctx.shadowBlur=0}
    if(occupied){ctx.fillStyle='#f0d0a4';ctx.beginPath();ctx.arc(0,0,4,0,7);ctx.fill()}
  }
  root.SharedCarArt=Object.freeze({draw});
})(window);
