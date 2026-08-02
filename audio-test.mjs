import { JSDOM } from 'jsdom';
import fs from 'fs';
let fail=0; const ok=(n,c,extra='')=>{console.log((c?'  PASS  ':'  FAIL  ')+n+(extra?'   '+extra:'')); if(!c)fail++;};

let clock = 0;
class Param { constructor(v){this.value=v;}
  setValueAtTime(v){this.value=v;return this;} linearRampToValueAtTime(v){this.value=v;return this;}
  exponentialRampToValueAtTime(v){this.value=v;return this;} cancelScheduledValues(){return this;} }
const node=(e={})=>Object.assign({connect(){},disconnect(){},start(){},stop(){}},e);
class FakeCtx {
  constructor(){ this.state='running'; this.sampleRate=44100; this.destination=node(); }
  get currentTime(){ return clock; }
  createGain(){ return node({gain:new Param(1)}); }
  createOscillator(){ return node({type:'sine',frequency:new Param(440)}); }
  createBiquadFilter(){ return node({type:'lowpass',frequency:new Param(1),Q:new Param(1),gain:new Param(0)}); }
  createBufferSource(){ return node({buffer:null,loop:false}); }
  createBuffer(ch,len){ const d=new Float32Array(len); return { getChannelData(){return d;}, length:len }; }
  resume(){ this.state='running'; return Promise.resolve(); }
  suspend(){ this.state='suspended'; return Promise.resolve(); }
}

const stub = fs.readFileSync('stub-data.js','utf8');
const html = fs.readFileSync('timer.html','utf8')
  .replace('<script src="data.js"></script>','<script>'+stub+'</script>')
  .replace('<link rel="stylesheet" href="style.css"/>','');
const dom = new JSDOM(html,{runScripts:'dangerously',url:'https://example.com/timer.html',
  beforeParse(w){ w.AudioContext=FakeCtx; w.navigator.audioSession={type:'auto'};
    w.navigator.wakeLock={request:()=>Promise.resolve({addEventListener(){},release(){}})}; }});
await new Promise(r=>dom.window.addEventListener('load',r));
const w = dom.window;
w.ensureCtx();

const SR = 44100;
const rmsWindows = (d, winSec) => {
  const win = Math.floor(SR*winSec), out=[];
  for (let s=0; s+win<=d.length; s+=win) {
    let acc=0; for(let i=s;i<s+win;i++) acc+=d[i]*d[i];
    out.push(Math.sqrt(acc/win));
  }
  return out;
};
const median = a => { const s=[...a].sort((x,y)=>x-y); return s[Math.floor(s.length/2)]; };

for (const kind of ['white','pink','brown']) {
  console.log(`\n── ${kind} noise: continuity ──`);
  const buf = w.getNoiseBuffer(kind);
  const d = buf.getChannelData(0);
  ok(`buffer is ${w.LOOP_SECS ?? 20}s long`, d.length === SR*20, `(${d.length} samples)`);

  // THE OLD BUG: a fade to zero at each end produced a ~0.1s dip every loop.
  const wins = rmsWindows(d, 0.025);
  const med = median(wins);
  const worst = Math.min(...wins);
  ok('no level dip anywhere in the buffer', worst > med*0.55,
     `min/median RMS = ${(worst/med).toFixed(3)}`);
  ok('head is not faded to silence', rmsWindows(d.subarray(0, SR*0.05),0.025)[0] > med*0.55);
  ok('tail is not faded to silence', rmsWindows(d.subarray(d.length-SR*0.05),0.025)[0] > med*0.55);

  // Seam: wrapping from last sample to first must look like any other step.
  let deltas=[]; for(let i=1;i<d.length;i++) deltas.push(Math.abs(d[i]-d[i-1]));
  deltas.sort((a,b)=>a-b);
  const p999 = deltas[Math.floor(deltas.length*0.999)];
  const seam = Math.abs(d[0]-d[d.length-1]);
  ok('loop seam within normal sample-step range', seam <= p999,
     `seam=${seam.toFixed(5)} p99.9=${p999.toFixed(5)}`);

  // DC offset (brown's leaky integrator drifts without correction)
  let mean=0; for(let i=0;i<d.length;i++) mean+=d[i]; mean/=d.length;
  ok('DC offset removed', Math.abs(mean) < 1e-3, `mean=${mean.toExponential(2)}`);
}

console.log('\n── Caching ──');
ok('same buffer reused across sources', w.getNoiseBuffer('brown') === w.getNoiseBuffer('brown'));
ok('transient buffer cached', w.getTransientBuffer() === w.getTransientBuffer());
ok('transient buffer is short (1s, not 20s)', w.getTransientBuffer().length === SR);

console.log(fail===0?'\nALL AUDIO TESTS PASSED':`\n${fail} FAILED`);
process.exit(fail?1:0);
