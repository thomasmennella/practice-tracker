import { JSDOM } from 'jsdom';
import fs from 'fs';
let fail=0; const ok=(n,c,x='')=>{console.log((c?'  PASS  ':'  FAIL  ')+n+(x?'   '+x:'')); if(!c)fail++;};

// A realistic pre-upgrade user: every top-level key populated with v1-shape data.
const LEGACY = {
  meta: { version:1, created:'2024-11-02T10:00:00.000Z', streakBase:12, streakBaseDate:'2024-11-02' },
  sits: [
    { id:1712, date:'2025-03-02', duration:35, quality:4, stability:3, depth:4, energy:3,
      sessionType:'Sit', practiceType:'Ānāpānasati', retreat:'Regular', samadhi:'Access',
      jhanaFactors:['Vitakka','Sukha'],
      hindrances:['Kāmacchanda','Thīna-middha'], hindrance_note:'sleepy start, settled by 15min',
      nimitta:'Uggaha', nimitta_desc:'grey disc, unstable',
      insights:['Anicca'], phenomena_note:'tingling in hands',
      insight_note:'saw the wanting itself', hypnagogic:'None', dream_note:'',
      prestate:'Tired', substances:['None'], notes:'good sit' },
    { id:1713, date:'2025-04-11', duration:20, quality:2, hindrances:[], nimitta:'None', notes:'' }
  ],
  dailyChecks: [{ date:'2025-03-02', precepts:[true,true,true,false,true],
                  samadhi_checks:[true,false,true,true], re_checks:[true,true,false,false],
                  kaya_checks:[true,true,true,false], panna_checks:[true,false,true,true,false,true,true,false],
                  int_checks:[true,true,false] }],
  journal: [{ id:9, date:'2025-03-02', text:'a long entry', prompt:'What arose?' }],
  pathMarkers: [{ id:3, date:'2025-02-01', purification:'Purification of View', description:'first clear seeing' }],
  dreams: [{ id:4, date:'2025-01-15', text:'lucid fragment' }],
  readSuttas: ['mn10','sn56.11'],
  quickNotes: [{ id:5, date:'2025-03-02', category:'effort', text:'noticed aversion' }],
  dailyIntention: { date:'2025-03-02', text:'patience' },
  suttaReflections: { 'mn10':'the four foundations, again' },
  checkins: [{ id:6, date:'2025-03-01', text:'steady' }],
  coachMemory: null, apiBalance: null, apiSpentSince: 0, coachMemoryUpdated: null
};
const SNAPSHOT = JSON.stringify(LEGACY);
const dataJs = fs.readFileSync('data.js','utf8');

async function loadPage(file, query='') {
  const raw = fs.readFileSync(file,'utf8')
    .replace('<link rel="stylesheet" href="style.css"/>','')
    .replace('<script src="data.js"></script>','<script>'+dataJs+'</script>');
  const dom = new JSDOM(raw,{runScripts:'dangerously',url:'https://example.com/'+file+query,
    beforeParse(w){
      w.confirm=()=>true; w.alert=()=>{};
      w.localStorage.setItem('the_path_data', SNAPSHOT);
      w.AudioContext = class { constructor(){this.state='running';this.sampleRate=44100;this.destination={};}
        get currentTime(){return 0;} createGain(){return g();} createOscillator(){return g();}
        createBiquadFilter(){return g();} createBufferSource(){return g();}
        createBuffer(c,l){const d=new Float32Array(l);return{getChannelData:()=>d,length:l};}
        resume(){return Promise.resolve();} suspend(){return Promise.resolve();} };
      function g(){const p={value:0,setValueAtTime(){return p;},linearRampToValueAtTime(){return p;},
        exponentialRampToValueAtTime(){return p;},cancelScheduledValues(){return p;}};
        return {connect(){},disconnect(){},start(){},stop(){},gain:p,frequency:p,Q:p,
                type:'sine',buffer:null,loop:false};}
      w.navigator.wakeLock={request:()=>Promise.resolve({addEventListener(){},release(){}})};
      w.navigator.audioSession={type:'auto'};
    }});
  await new Promise(r=>dom.window.addEventListener('load',r));
  await new Promise(r=>setTimeout(r,50));
  return dom.window;
}

console.log('── Merely OPENING each changed page must not write to the log ──');
for (const page of ['index.html','sit.html','timer.html']) {
  const w = await loadPage(page);
  const after = w.localStorage.getItem('the_path_data');
  ok(`${page}: log byte-identical after load`, after === SNAPSHOT,
     after === SNAPSHOT ? '' : 'MUTATED ON LOAD');
}
{
  const w = await loadPage('sit.html','?duration=45');
  ok('sit.html?duration=45: log byte-identical after load',
     w.localStorage.getItem('the_path_data') === SNAPSHOT);
}

console.log('\n── loadData() round-trip preserves every key and value ──');
{
  const w = await loadPage('sit.html');
  const d = w.loadData();
  const orig = JSON.parse(SNAPSHOT);
  for (const k of Object.keys(orig)) {
    ok(`key "${k}" preserved exactly`, JSON.stringify(d[k]) === JSON.stringify(orig[k]));
  }
  const added = Object.keys(d).filter(k => !(k in orig));
  ok('new keys are additive only (nothing removed)',
     Object.keys(orig).every(k => k in d), `added: ${added.join(', ')||'none'}`);
}

console.log('\n── Saving a NEW sit leaves OLD sits untouched ──');
{
  const w = await loadPage('sit.html');
  const d = w.document;
  d.getElementById('sit-duration').value = '25';
  d.querySelector('input[name="hl-thina"][value="Minor"]').checked = true;
  w.onHindranceLevel('thina');
  w.saveSit();
  const after = w.loadData();
  const orig = JSON.parse(SNAPSHOT);
  ok('sit count grew by exactly 1', after.sits.length === orig.sits.length + 1);
  const oldOnes = after.sits.filter(s => s.id === 1712 || s.id === 1713);
  ok('both original sits still present', oldOnes.length === 2);
  ok('original sit #1712 byte-identical',
     JSON.stringify(after.sits.find(s=>s.id===1712)) === JSON.stringify(orig.sits[0]));
  ok('original sit #1713 byte-identical',
     JSON.stringify(after.sits.find(s=>s.id===1713)) === JSON.stringify(orig.sits[1]));
  for (const k of ['journal','dailyChecks','pathMarkers','dreams','readSuttas',
                   'quickNotes','suttaReflections','checkins','dailyIntention','meta']) {
    ok(`"${k}" untouched by saving a sit`,
       JSON.stringify(after[k]) === JSON.stringify(orig[k]));
  }
}

console.log('\n── New records stay compatible with logs.html ──');
{
  const w = await loadPage('sit.html');
  const d = w.document;
  d.getElementById('sit-duration').value = '30';
  d.querySelector('input[name="hl-kama"][value="Major"]').checked = true;
  w.onHindranceLevel('kama');
  w.saveSit();
  const s = w.loadData().sits[0];
  const FILTER_VOCAB = ['Kāmacchanda','Byāpāda','Thīna-middha','Uddhacca-kukkucca','Vicikicchā'];
  ok('hindrance labels match logs.html filter vocabulary exactly',
     s.hindrances.every(h => FILTER_VOCAB.includes(h)), s.hindrances.join(','));
  ok('hindrance_note is a string (logs.html search reads it)', typeof s.hindrance_note === 'string');
  ok('nimitta present for logs.html display', 'nimitta' in s);
}

console.log('\n── Timer prefs are isolated from the log ──');
{
  const w = await loadPage('timer.html');
  w.savePrefs();
  ok('timer wrote its own key', w.localStorage.getItem('the_path_timer_prefs') !== null);
  ok('log still byte-identical after timer saves prefs',
     w.localStorage.getItem('the_path_data') === SNAPSHOT);
}

console.log('\n── Service worker touches Cache Storage, never localStorage ──');
{
  const sw = fs.readFileSync('service-worker.js','utf8');
  ok('no localStorage reference in service worker', !/localStorage/.test(sw));
  ok('no indexedDB reference in service worker', !/indexedDB/.test(sw));
  ok('deletes only caches', /caches\.delete/.test(sw) && !/clear\(\)/.test(sw));
}

console.log(fail===0?'\nALL SAFETY TESTS PASSED':`\n${fail} FAILED`);
process.exit(fail?1:0);
