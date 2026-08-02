import { JSDOM } from 'jsdom';
import fs from 'fs';
let fail=0; const ok=(n,c,x='')=>{console.log((c?'  PASS  ':'  FAIL  ')+n+(x?'   '+x:'')); if(!c)fail++;};

const dataJs = fs.readFileSync('data.js','utf8');
const raw = fs.readFileSync('sit.html','utf8')
  .replace('<link rel="stylesheet" href="style.css"/>','')
  .replace('<script src="data.js"></script>','<script>'+dataJs+'</script>');

async function load(query, seed) {
  const dom = new JSDOM(raw,{runScripts:'dangerously',url:'https://example.com/sit.html'+query,
    beforeParse(w){ w.confirm=()=>true; w.alert=()=>{};
      if(seed) w.localStorage.setItem('the_path_data', JSON.stringify(seed)); }});
  await new Promise(r=>dom.window.addEventListener('load',r));
  return dom.window;
}

console.log('── Public sit.html: new features present ──');
let w = await load(''); let d = w.document;
ok('page renders', typeof w.saveSit === 'function');
ok('granular hindrance rows', d.querySelectorAll('.hind-item').length === 5);
ok('Major/Minor/None radios (5x3)', d.querySelectorAll('.hind-levels input[type=radio]').length === 15);
ok('nimitta mode toggle present', d.getElementById('nimitta-mode-pills') !== null);
ok('doctrinal path visible by default', d.getElementById('nimitta-doctrinal').style.display !== 'none');
ok('feel path hidden by default', d.getElementById('nimitta-feel').style.display === 'none');

console.log('\n── PWA bits preserved ──');
const html = fs.readFileSync('sit.html','utf8');
ok('manifest link present', /rel="manifest"/.test(html));
ok('apple-touch-icon present', /apple-touch-icon/.test(html));
ok('theme-color present', /theme-color/.test(html));
ok('service worker registered', /navigator\.serviceWorker\.register/.test(html));

console.log('\n── Nimitta toggle behaviour ──');
w.setNimittaMode('feel');
ok('feel mode reveals feel path', d.getElementById('nimitta-feel').style.display !== 'none');
ok('feel mode hides doctrinal', d.getElementById('nimitta-doctrinal').style.display === 'none');
const other = d.querySelector('#nimitta-feel-pills .pill[data-val="__OTHER__"]');
w.setNimittaFeel(other);
ok('Other reveals free-text box', d.getElementById('nimitta-feel-other-wrap').style.display !== 'none');
d.getElementById('nimitta-feel-other').value = 'went silvery and wide';
d.getElementById('sit-duration').value = '30';
w.saveSit();
let saved = JSON.parse(w.localStorage.getItem('the_path_data')).sits[0];
ok('nimitta_mode recorded', saved.nimitta_mode === 'feel');
ok('free-text feel captured', saved.nimitta_feel === 'went silvery and wide');
ok('legacy nimitta field still written', 'nimitta' in saved && 'nimitta_desc' in saved);

console.log('\n── Granular hindrances write back-compatible data ──');
w = await load(''); d = w.document;
d.getElementById('sit-duration').value = '40';
d.querySelector('input[name="hl-kama"][value="Major"]').checked = true;
w.onHindranceLevel('kama');
d.getElementById('hn-kama').value = 'long fantasy, lost ten minutes';
d.querySelector('input[name="hl-vicikiccha"][value="Minor"]').checked = true;
w.onHindranceLevel('vicikiccha');
ok('detail box revealed on Major', d.getElementById('hi-kama').classList.contains('marked'));
ok('untouched hindrance stays collapsed', !d.getElementById('hi-byapada').classList.contains('marked'));
w.saveSit();
ok('clearForm collapses detail boxes again', !d.getElementById('hi-kama').classList.contains('marked'));
ok('clearForm resets severity to None',
   d.querySelector('input[name="hl-kama"][value="None"]').checked);
saved = JSON.parse(w.localStorage.getItem('the_path_data')).sits[0];
ok('hindrances[] populated for logs.html filter', Array.isArray(saved.hindrances) && saved.hindrances.length === 2);
ok('hindrance_note populated for logs.html search', typeof saved.hindrance_note === 'string' && saved.hindrance_note.length > 0);
ok('hindrance_detail is additive', typeof saved.hindrance_detail === 'object');
ok('severity captured', saved.hindrance_detail.kama.level === 'Major');
ok('detail note captured', /fantasy/.test(saved.hindrance_detail.kama.note));

console.log('\n── EXISTING PUBLIC USER DATA (v1 schema) survives ──');
const legacy = { sits: [
  { id:1, date:'2025-03-02', duration:35, quality:4, stability:3, depth:4,
    hindrances:['Kāmacchanda','Thīna-middha'], hindrance_note:'sleepy start',
    nimitta:'Uggaha', nimitta_desc:'grey disc', notes:'old record' },
  { id:2, date:'2025-04-11', duration:20, quality:2, hindrances:[], nimitta:'None' }
]};
w = await load('', legacy); d = w.document;
const hist = d.getElementById('sit-history-list').textContent;
ok('legacy sits render', /2025-03-02/.test(hist) && /2025-04-11/.test(hist));
ok('legacy hindrances still display', /Kāmacchanda/.test(hist));
ok('legacy nimitta still displays (no nimitta_mode)', /Uggaha/.test(hist));
ok('loadData preserves legacy records', w.loadData().sits.length === 2);
ok('legacy record untouched by new code', w.loadData().sits[0].hindrance_note === 'sleepy start');

console.log('\n── Timer handoff ──');
w = await load('?duration=45');
ok('duration prefilled', w.document.getElementById('sit-duration').value === '45');
w = await load('?duration=abc');
ok('bad param ignored', w.document.getElementById('sit-duration').value === '');

console.log('\n── Nav ──');
const dom2 = new JSDOM('<div id="m"></div>',{runScripts:'outside-only',url:'https://example.com/'});
dom2.window.eval(dataJs);
dom2.window.document.getElementById('m').innerHTML = dom2.window.renderNav('timer');
const links=[...dom2.window.document.querySelectorAll('.nav-link')].map(a=>a.textContent.trim());
ok('Timer in public nav', links.includes('Timer'));
ok('Timer after Sit Log', links.indexOf('Timer')===links.indexOf('Sit Log')+1);
ok('no private-only pages leaked into nav',
   !/bodhi|chants|capture|coach|Advisor/i.test(dom2.window.renderNav('index')));

console.log(fail===0?'\nALL PUBLIC TESTS PASSED':`\n${fail} FAILED`);
process.exit(fail?1:0);
