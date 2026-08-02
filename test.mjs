import { JSDOM } from 'jsdom';
import fs from 'fs';

let fail = 0;
const ok = (name, cond) => { console.log((cond?'  PASS  ':'  FAIL  ')+name); if(!cond) fail++; };

// ── Fake Web Audio graph that records what gets scheduled ──
let clock = 100;
const started = [];
class Param {
  constructor(v){ this.value=v; }
  setValueAtTime(v,t){ this.value=v; return this; }
  linearRampToValueAtTime(v,t){ this.value=v; return this; }
  exponentialRampToValueAtTime(v,t){ this.value=v; return this; }
  cancelScheduledValues(){ return this; }
}
function node(extra={}) {
  return Object.assign({
    connect(){}, disconnect(){},
    start(t){ started.push({t, node:this}); this._started=true; },
    stop(){ if(!this._started) throw new Error('not started'); }
  }, extra);
}
class FakeCtx {
  constructor(){ this.state='running'; this.sampleRate=44100; this.destination=node(); FakeCtx.last=this; }
  get currentTime(){ return clock; }
  createGain(){ return node({gain:new Param(1)}); }
  createOscillator(){ return node({type:'sine', frequency:new Param(440)}); }
  createBiquadFilter(){ return node({type:'lowpass', frequency:new Param(1), Q:new Param(1), gain:new Param(0)}); }
  createBufferSource(){ return node({buffer:null, loop:false}); }
  createBuffer(ch,len,sr){ const d=new Float32Array(len); return { getChannelData(){ return d; }, length:len }; }
  get audioWorklet(){ return null; }
  resume(){ this.state='running'; return Promise.resolve(); }
  suspend(){ this.state='suspended'; return Promise.resolve(); }
}

const stub = fs.readFileSync('stub-data.js','utf8');
const html = fs.readFileSync('timer.html','utf8')
  .replace('<script src="data.js"></script>', '<script>' + stub + '</script>')
  .replace('<link rel="stylesheet" href="style.css"/>', '');
const dom = new JSDOM(html, { runScripts:'dangerously', resources:'usable', url:'https://example.com/timer.html',
  beforeParse(w){
    w.AudioContext = FakeCtx;
    w.navigator.wakeLock = { request: () => Promise.resolve({ addEventListener(){}, release(){} }) };
    w.confirm = () => true;
    w.alert = () => {};
    // stand in for the WebKit-only Audio Session API
    w.navigator.audioSession = { type: 'auto' };
  }});

await new Promise(r => dom.window.addEventListener('load', r));
const w = dom.window, d = w.document;

console.log('\n── Page load ──');
ok('nav mounted', d.querySelector('#nav-mount nav') !== null);
ok('setup visible, run hidden', !d.getElementById('setup-view').classList.contains('hidden') && d.getElementById('run-view').classList.contains('hidden'));
ok('ambience grid rendered', d.querySelectorAll('.sound-opt').length === 6);

console.log('\n── parseMarks ──');
ok('parses + sorts',            JSON.stringify(w.parseMarks('30, 10, 20', 45)) === '[10,20,30]');
ok('drops marks >= session',    JSON.stringify(w.parseMarks('10, 50, 45', 45)) === '[10]');
ok('drops junk / zero / neg',   JSON.stringify(w.parseMarks('abc, 0, -5, 12', 45)) === '[12]');
ok('empty is empty',            JSON.stringify(w.parseMarks('', 45)) === '[]');

console.log('\n── fmt ──');
ok('45 min',  w.fmt(2700) === '45:00');
ok('rounds up partial second', w.fmt(59.2) === '01:00');
ok('hours',   w.fmt(3725) === '1:02:05');
ok('clamps negative', w.fmt(-3) === '00:00');

console.log('\n── Scheduling: 2 min warm-up, 30 min session, marks at 10/20 ──');
d.getElementById('in-warmup').value = '120';
d.getElementById('in-session').value = '30';
d.getElementById('in-marks').value = '10, 20';
started.length = 0;
w.startTimer();

ok('running view shown', !d.getElementById('run-view').classList.contains('hidden'));
const T0 = 100.2, warmEnd = T0 + 120, sessEnd = warmEnd + 1800;
const times = [...new Set(started.filter(s => typeof s.t === 'number').map(s => +s.t.toFixed(3)))].sort((a,b)=>a-b);
ok('opening chime at END of warm-up', times.includes(warmEnd));
ok('NO chime at t0 (warm-up start)', !times.includes(T0));
ok('interval chime at session+10m', times.includes(warmEnd + 600));
ok('interval chime at session+20m', times.includes(warmEnd + 1200));
ok('closing gong at session end',   times.includes(sessEnd));
ok('nothing scheduled past the gong', times.every(t => t <= sessEnd + 0.001));

console.log('\n── Countdown phases ──');
clock = T0 + 30;  w.tick();
ok('warm-up phase label', d.getElementById('phase-label').textContent === 'Warm-up');
ok('warm-up counts down to chime', d.getElementById('dial-time').textContent === '01:30');
clock = warmEnd + 60; w.tick();
ok('session phase label', d.getElementById('phase-label').textContent === 'Session');
ok('session shows 29:00 remaining', d.getElementById('dial-time').textContent === '29:00');

console.log('\n── Warm-up excluded from logged duration ──');
clock = warmEnd + 600; // 10 min of session done
ok('elapsed session = 10 min, warm-up not counted', Math.round(w.sessionMinutesElapsed()) === 10);
w.endEarly();
ok('done view shown', !d.getElementById('done-view').classList.contains('hidden'));
ok('handoff link carries session-only duration', d.getElementById('btn-log').getAttribute('href') === 'sit.html?duration=10');
ok('done text notes warm-up excluded', /not counted/.test(d.getElementById('done-sub').textContent));

console.log('\n── Full completion ──');
d.getElementById('in-warmup').value = '0';
d.getElementById('in-session').value = '20';
d.getElementById('in-marks').value = '';
clock = 500;
w.backToSetup();
w.startTimer();
clock = 500.2 + 1200 + 1; w.tick();
ok('auto-finishes at session end', !d.getElementById('done-view').classList.contains('hidden'));
ok('logs full 20 min', d.getElementById('btn-log').getAttribute('href') === 'sit.html?duration=20');

console.log('\n── Watchdog ──');
clock = 900; w.backToSetup();
d.getElementById('in-session').value = '10';
w.startTimer();
// simulate an iOS audio-session interruption (call / Siri / route change)
const realCtx = FakeCtx.last; realCtx.state = 'interrupted';
w.watchdog();
ok('warning banner shown on interruption', d.getElementById('audio-warn').classList.contains('show'));
realCtx.state = 'running';
w.watchdog();
ok('banner clears when audio recovers', !d.getElementById('audio-warn').classList.contains('show'));

console.log('\n── Prefs round-trip ──');
d.getElementById('in-session').value = '33';
d.getElementById('in-marks').value = '11';
w.savePrefs();
const saved = JSON.parse(w.localStorage.getItem('the_path_timer_prefs'));
ok('prefs stored under own key', saved.session === '33' && saved.marks === '11');
ok('prefs do NOT touch the synced data object', w.localStorage.getItem('the_path_data') === null);

console.log('\n── Sub-minute warm-up ──');
clock = 2000; w.backToSetup();
d.getElementById('in-warmup').value = '10';
d.getElementById('in-session').value = '20';
d.getElementById('in-marks').value = '';
started.length = 0;
w.startTimer();
const t0b = 2000.2;
const tb = [...new Set(started.filter(s=>typeof s.t==='number').map(s=>+s.t.toFixed(3)))].sort((a,b)=>a-b);
ok('10s warm-up accepted', tb.includes(t0b + 10));
ok('opening chime 10s in, not 10min in', !tb.includes(t0b + 600));
ok('gong at 10s + 20min', tb.includes(t0b + 10 + 1200));
clock = t0b + 4; w.tick();
ok('warm-up counts down in seconds', d.getElementById('dial-time').textContent === '00:06');
clock = t0b + 10 + 600;
ok('warm-up excluded from logged time', Math.round(w.sessionMinutesElapsed()) === 10);
w.endEarly();
ok('done text shows seconds not minutes', /10 sec warm-up not counted/.test(d.getElementById('done-sub').textContent));

clock = 3000; w.backToSetup();
w.setWarmup(0);
ok('setWarmup(0) writes zero', d.getElementById('in-warmup').value === '0');
d.getElementById('in-session').value = '5';
started.length = 0;
w.startTimer();
const t0c = 3000.2;
const tc = [...new Set(started.filter(s=>typeof s.t==='number').map(s=>+s.t.toFixed(3)))].sort((a,b)=>a-b);
ok('zero warm-up chimes immediately', tc.includes(t0c));
w.endEarly();
ok('no warm-up text when zero', !/warm-up/.test(d.getElementById('done-sub').textContent));

console.log('\n── warmLabel formatting ──');
ok('10s', w.warmLabel(10) === '10 sec');
ok('59s', w.warmLabel(59) === '59 sec');
ok('60s -> 1 min', w.warmLabel(60) === '1 min');
ok('90s -> 1.5 min', w.warmLabel(90) === '1.5 min');
ok('120s -> 2 min', w.warmLabel(120) === '2 min');

console.log('\n── Prefs migration (v1 minutes -> v2 seconds) ──');
w.localStorage.setItem('the_path_timer_prefs', JSON.stringify({ warmup:'2', session:'45' }));
const p1 = w.loadPrefs();
ok('unversioned prefs read as v1', p1.v === undefined);
w.localStorage.setItem('the_path_timer_prefs', JSON.stringify({ v:2, warmup:'10', session:'45' }));
ok('v2 prefs keep seconds', w.loadPrefs().warmup === '10');
d.getElementById('in-warmup').value = '45';
w.savePrefs();
ok('savePrefs stamps version', JSON.parse(w.localStorage.getItem('the_path_timer_prefs')).v === 2);
ok('savePrefs records silent-switch pref',
   'silent' in JSON.parse(w.localStorage.getItem('the_path_timer_prefs')));

console.log('\n── Audio session (silent switch override) ──');
d.getElementById('in-silentswitch').checked = true;
w.applyAudioSession();
ok('session set to playback when enabled', w.navigator.audioSession.type === 'playback');
d.getElementById('in-silentswitch').checked = false;
w.applyAudioSession();
ok('session reverts to auto when disabled', w.navigator.audioSession.type === 'auto');
d.getElementById('in-silentswitch').checked = true;

console.log(fail === 0 ? '\nALL TESTS PASSED' : `\n${fail} TEST(S) FAILED`);
process.exit(fail === 0 ? 0 : 1);
