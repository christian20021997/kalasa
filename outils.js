const get=k=>JSON.parse(localStorage.getItem(k)||'[]');
const getO=k=>JSON.parse(localStorage.getItem(k)||'{}');
const setK=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){alert('Mémoire pleine.');return false}};
const ETABS=window.KAUTH?KAUTH.filtrerEtabs(get('kalasa_etablissements')):[],ANNEES=get('kalasa_annees'),CLASSES=get('kalasa_classes'),
      INS=get('kalasa_inscriptions'),PERS=get('kalasa_personnel'),PAR=get('kalasa_parents');
const $=i=>document.getElementById(i);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const opts=(a,f,sel)=>a.map(x=>`<option value="${x.id}" ${sel&&sel(x)?'selected':''}>${esc(f(x))}</option>`).join('');
const today=()=>new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
const fmtD=d=>new Date(d).toLocaleDateString('fr-FR');
const nom=e=>[e.nom,e.postnom,e.prenom].filter(Boolean).join(' ');
const nE=id=>(ETABS.find(x=>x.id===id)||{}).nom||'—';
const nA=id=>(ANNEES.find(x=>x.id===id)||{}).lib||'—';
const cl=id=>CLASSES.find(x=>x.id===id)||{};
const cid=()=>+$('classe').value;
const elevesDe=id=>INS.filter(x=>x.classe===id).sort((a,b)=>nom(a).localeCompare(nom(b)));
const av=e=>e.photo?`<img src="${e.photo}" alt="">`:`<div class="av">${esc((e.prenom||e.nom||'?')[0].toUpperCase())}</div>`;
const q=v=>`"${String(v??'').replace(/"/g,'""')}"`;
function telecharger(f,h,r){const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob(['\ufeff'+[h.join(';'),...r].join('\n')],{type:'text/csv;charset=utf-8'}));a.download=f;a.click()}
function avertir(l){const m=l.filter(x=>x[0]).map(x=>x[1]);
  if(m.length){$('warn').innerHTML='Créez d\'abord '+m.join(', ')+'.';$('warn').style.display='block'}}
function initSel(cb){
  $('etab').innerHTML=opts(ETABS,x=>x.nom);
  $('annee').innerHTML=opts(ANNEES,x=>x.lib,x=>x.active);
  const maj=()=>{const e=+$('etab').value,a=+$('annee').value,l=CLASSES.filter(c=>c.etab===e&&c.annee===a);
    $('classe').innerHTML=l.length?opts(l,c=>c.nom+(c.option?' · '+c.option:'')):'<option value="">Aucune classe</option>';cb()};
  $('etab').onchange=maj;$('annee').onchange=maj;$('classe').onchange=cb;maj();
                        }
