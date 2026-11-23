const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const root=resolve(__dirname,'..');
const html=readFileSync(resolve(root,'nocny-kurs/index.html'),'utf8');
const css=readFileSync(resolve(root,'style.css'),'utf8');
const game=readFileSync(resolve(root,'nocny-kurs/game.js'),'utf8');
const locale=readFileSync(resolve(root,'nocny-kurs/locale.js'),'utf8');
test('touch controls use two icon-only holdable pedals instead of a gear toggle',()=>{
  assert.doesNotMatch(html,/data-touch-action="gear"/);
  for(const action of ['forward','brake']){
    const button=html.match(new RegExp('<button data-touch-action="'+action+'"[\\s\\S]*?<\\/button>'));
    assert.ok(button,action+' button exists');
    assert.match(button[0],/<svg class="touch-pedal-icon"/);
    assert.doesNotMatch(button[0],/<span/);
    assert.match(button[0],/data-i18n-aria-label=/);
  }
  assert.match(css,/\.play-page \.touch-drive-pedals/);
  assert.ok(html.indexOf('data-touch-action="brake"') < html.indexOf('data-touch-action="forward"'), 'brake is on the left of gas');
  assert.match(css,/--night-button-size:/);
  assert.match(css,/\.night-touch \.touch-actions button\{/);
  assert.match(css,/touch-pedal-icon\{[^}]*pointer-events:none/);
});
test('pedals press on pointerdown and release on pointerup, cancel and lostcapture',()=>{
  assert.match(game,/touchState\[action\]=true/);
  assert.match(game,/touchState\[action\]=false/);
  assert.match(game,/pointercancel',release/);
  assert.match(game,/lostpointercapture',release/);
  assert.match(game,/touchState\.forward=touchState\.brake=false/);
  assert.match(game,/own\?\.car\?Number\(touchState\.brake\)-Number\(touchState\.forward\):touchStick\.y/);
  assert.match(locale,/"driveForward": "Jedź do przodu"/);
  assert.match(locale,/"driveBrake": "Bromsa \/ backa"/);
  assert.match(locale,/"driveBrake": "Hamuj i cofaj"/);
  assert.match(game,/c\.speed-brake\*spec\.acceleration\*\.7\*dt/);
});
