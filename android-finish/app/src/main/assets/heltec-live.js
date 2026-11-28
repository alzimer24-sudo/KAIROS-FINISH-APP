/* KAIROS FINISH V12: native Heltec Wi-Fi transport, local race register. */
(function(){
 'use strict';
 if (!window.KAIROS_LOCAL || !window.KAIROS_LOCAL.real) return;
 const M=window.KAIROS_LOCAL;
 const H=window.KAIROS_HELTEC={
  connected:false,state:null,pendingUs:null,ready:false,recorded:false,
  activeRunId:null,seenStart:false,startAtMs:null,lastSeenAt:0,lastError:'',bib:null
 };
 let screen,liveUs=0; let lastNativeState=null,select,view,sub,controlBusy=false,permitView,confirmed=null;
 const control=(endpoint,body='')=>window.AndroidHeltec.requestControl(endpoint,body);
 window.KAIROS_CONTROL=function(raw){try{const r=JSON.parse(raw);controlBusy=false;if(r.status!==200){if(permitView)permitView.textContent='Comando o lettura non confermati';return;}const d=JSON.parse(r.data);if(r.endpoint==='lookup'&&!r.post){if(d.pending){const a=M.roster().find(a=>Number(a.bib)===d.bib);controlBusy=true;control('lookup',new URLSearchParams({session:d.session,nonce:d.nonce,bib:d.bib,name:a?a.name:''}).toString());}else if(d.confirmed_bib===d.bib&&d.confirmed_nonce===d.nonce&&d.bib){confirmed=d.bib;if(H.state!==1)H.bib=confirmed;}}if(r.endpoint==='training'&&!r.post&&permitView)permitView.textContent=d.permit?'Consenso FINISH attivo (ricezione START da verificare)':'STOP FINISH';}catch(e){controlBusy=false;}};
 const fmt=us=>{
  const cs=Math.round(us/10000);
  return Math.floor(cs/6000)+':'+String(Math.floor(cs/100)%60).padStart(2,'0')+'.'+String(cs%100).padStart(2,'0');
 };
 function setView(){
  if(screen)renderDisplay(); if (!view)return;
  if (!H.connected){
   view.textContent='HELTEC NON COLLEGATA · collega Wi-Fi KAIROS-FINISH';
  }else if(H.state===0){
   view.textContent='HELTEC PRONTA · in attesa di START';
  }else if(H.state===1){
   view.textContent='START RICEVUTO · cronometro indicativo in corso';
  }else if(H.state===2){
   view.textContent=H.recorded?'ARRIVO REGISTRATO: '+fmt(H.pendingUs):H.ready?'ARRIVO CANDIDATO: '+fmt(H.pendingUs)+' · salvataggio in corso':'Ultimo tempo Heltec: '+fmt(H.pendingUs||0)+' · nessuna nuova partenza confermata';
  }else if(H.state===3){
   view.textContent='ARRIVO NON VALIDO · verifica sincronizzazione GPS/PPS';
  }
  if(sub)sub.textContent='Tempo concluso: Heltec FINISH via Wi-Fi. Precisione GPS/PPS non certificata. Pettorale da conferma LoRa.';
 }
 function renderDisplay(){
  if(!screen)return;
  const put=(id,v)=>{screen.querySelector('#'+id).textContent=v;};
  const bib=H.state===1?H.bib:confirmed;
  const a=M.roster().find(a=>Number(a.bib)===bib);
  put('kd-link',H.connected?'HELTEC FINISH COLLEGATA':'HELTEC NON COLLEGATA');
  put('kd-label',H.state===1?'ATLETA IN PISTA':H.state===3?'ARRIVO NON VALIDO':'PROSSIMO ATLETA');
  put('kd-athlete',a?bib+' · '+a.name:'—');
  put('kd-time',H.state===1||H.state===2?fmt(liveUs).padStart(8,'0'):'00:00.00');
  const runs=M.runs().filter(r=>r.elapsed_us>0||r.elapsed_ms>0);
  const last=runs[runs.length-1];
  put('kd-last',last?last.bib+' · '+last.name+'   '+fmt(last.elapsed_us||last.elapsed_ms*1000):'—');
  const rank=screen.querySelector('#kd-rank');rank.replaceChildren();
  const round=last?last.run_no:1;
  const sorted=runs.filter(r=>r.run_no===round).sort((a,b)=>(a.elapsed_us||a.elapsed_ms*1000)-(b.elapsed_us||b.elapsed_ms*1000));
  sorted.forEach((r,i)=>{const line=document.createElement('div');line.style.cssText='display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #35435a';const name=document.createElement('span');name.textContent=(i+1)+'. '+r.bib+' · '+r.name;const time=document.createElement('strong');time.textContent=fmt(r.elapsed_us||r.elapsed_ms*1000);line.append(name,time);rank.appendChild(line);});
  put('kd-permit',permitView?permitView.textContent:'Consenso da verificare');
 }
 function athleteOptions(){
  if(!select)return;
  const roster=M.roster();
  const sig=JSON.stringify(roster.map(a=>[a.bib,a.name]));
  if(select.dataset.sig===sig)return;
  const old=select.value||String(H.bib||'');
  select.innerHTML='<option value="">Seleziona pettorale...</option>';
  for(const a of roster){
   const option=document.createElement('option');
   option.value=String(a.bib);
   option.textContent='#'+a.bib+' '+a.name;
   select.appendChild(option);
  }
  select.value=roster.some(a=>String(a.bib)===old)?old:'';
  select.dataset.sig=sig;
 }
 function bindIfStart(){
  if(H.state!==1 || !H.bib || H.activeRunId)return;
  const run=M.addStart(H.bib,H.startAtMs||Date.now());
  if(run){H.activeRunId=run.id;setView();}
 }
 window.KAIROS_HELTEC_ONDATA=function(raw){
  let d;try{d=JSON.parse(raw);}catch(_){return;}
  const st=Number(d.state),us=Number(d.us);
  if(![0,1,2,3].includes(st)||!Number.isSafeInteger(us)||us<0)return;
  liveUs=us; H.connected=true;H.lastError='';H.lastSeenAt=Date.now();
  if(st===1 && lastNativeState!==1){
   H.bib=confirmed; H.startAtMs=Date.now()-Math.floor(us/1000);
   H.seenStart=true;H.pendingUs=null;H.ready=false;H.recorded=false;H.activeRunId=null;
  }
  if(st===2 && lastNativeState===1 && H.seenStart && us>0){
   H.pendingUs=us;
   H.ready=Boolean(H.activeRunId);
   H.recorded=false;
   if(H.ready){const id=H.activeRunId;fetch('/api/finish',{method:'POST',body:JSON.stringify({run_id:id,heltec_us:us})}).then(r=>{if(r.ok){H.recorded=true;H.ready=false;setView();}});}
  }
  if(st===3 || st===0){
   H.pendingUs=null;H.ready=false;H.seenStart=false;
  }
  H.state=st;
  if(st===2 && !H.pendingUs && us>0) H.pendingUs=us;
  if(st===1)bindIfStart();
  lastNativeState=st;
  setView();
 };
 window.KAIROS_HELTEC_ONERROR=function(message){
  H.connected=false;
  H.lastError=String(message||'Wi-Fi non disponibile').slice(0,150);
  setView();
 };
 document.addEventListener('DOMContentLoaded',()=>{
  const banner=document.querySelector('.finish-test-banner');
  if(banner)banner.innerHTML='<strong>KAIROS FINISH · HELTEC REALE · PROVA</strong><span>Gestione atleti e classifiche offline. Cronometro live indicativo; tempo concluso dalla Heltec via Wi-Fi. Pettorali da START via LoRa, ricerca nella lista locale. GPS/PPS non ancora validati.</span>';
  const bar=document.getElementById('demo-bar');if(bar)bar.style.display='none';
  const area=document.querySelector('.finish-kpis');
  if(area){
   const panel=document.createElement('section');
   panel.className='finish-card';
   panel.setAttribute('aria-label','Collegamento Heltec FINISH');
   panel.innerHTML='<div class="finish-card-head"><h2>📡 HELTEC FINISH · WI-FI LOCALE</h2><span class="small">192.168.4.1/api/tempo</span></div>'+
    '<div id="heltec-state" role="status" style="padding:12px 0;color:#ffd84d;font-weight:800">COLLEGAMENTO IN CORSO...</div>'+
    '<p class="small">Il pettorale confermato da START viene associato automaticamente.</p>'+
    '<div class="form-row"><select id="heltec-bib" aria-label="Pettorale da associare"><option value="">Carica concorrenti CSV...</option></select><button type="button" id="heltec-assign" class="blue">ASSOCIA PETTORALE</button></div>'+
    '<p id="heltec-selection" class="small">Nessun pettorale associato.</p>'+
    '<p id="heltec-source" class="small">Heltec FINISH via Wi-Fi, senza Internet.</p>';
   area.before(panel);
   const controls=document.createElement('div');controls.className='form-row';
   controls.innerHTML='<button class="danger" id="v13-stop">STOP</button><button class="primary" id="v13-go">CONSENSO</button><p id="v13-permit" role="status">Consenso da verificare</p>';
   panel.prepend(controls);permitView=controls.querySelector('#v13-permit');
   for(const [id,v] of [['v13-stop',0],['v13-go',1]])controls.querySelector('#'+id).onclick=()=>{permitView.textContent='Comando in attesa';control('training/permit','permit='+v);};
   let cycle=0;setInterval(()=>{if(!controlBusy){controlBusy=true;control(cycle++%3===0?'training':'lookup');}},1000);
   select=panel.querySelector('#heltec-bib');
   view=panel.querySelector('#heltec-state');
   sub=panel.querySelector('#heltec-source');
   panel.querySelector('#heltec-assign').addEventListener('click',()=>{
    athleteOptions();
    const bib=Number(select.value);
    if(!bib){alert('Importa prima il CSV e scegli un pettorale.');return;}
    if(H.activeRunId&&H.state===1){alert('Un atleta è già associato alla partenza.');return;}
    if(H.state===2){alert('Arrivo già rilevato. Attendi una nuova partenza.');return;}
    H.bib=bib;
    panel.querySelector('#heltec-selection').textContent='Pettorale #'+bib+' associato al prossimo START';
    bindIfStart();
    setView();
   });
  }
  screen=document.createElement('section');
  screen.style.cssText='position:fixed;inset:0;z-index:99999;overflow:auto;background:#101b2d;color:#f4f7ff;padding:18px;box-sizing:border-box;font-family:system-ui';
  screen.innerHTML='<header style="display:flex;justify-content:space-between;align-items:center"><strong>KAIROS · FINISH</strong><button id="kd-manage">Gestione locale</button></header><p id="kd-link" style="font-size:13px"></p><div style="background:#192941;border-radius:16px;padding:20px;text-align:center"><div id="kd-label" style="color:#ffd84d;font-weight:800">ATLETA IN PISTA</div><h2 id="kd-athlete">—</h2><div id="kd-time" style="font-size:clamp(48px,13vw,96px);font-weight:800;font-variant-numeric:tabular-nums">00:00.00</div></div><div style="background:#173a35;border-radius:12px;padding:16px;margin-top:14px"><small>ULTIMO ARRIVO</small><h2 id="kd-last">—</h2></div><h3>Classifica locale</h3><div id="kd-rank"></div><div style="display:flex;gap:12px;margin-top:20px"><button id="kd-stop" style="flex:1;background:#a82935;color:white;padding:18px;border:0;border-radius:10px;font-weight:bold">STOP</button><button id="kd-go" style="flex:1;background:#18784d;color:white;padding:18px;border:0;border-radius:10px;font-weight:bold">CONSENSO</button></div><p id="kd-permit"></p><small>Offline · Archivio locale · GPS/PPS da validare</small>';
  document.body.appendChild(screen);
  screen.querySelector('#kd-manage').onclick=()=>{screen.hidden=true;};
  const back=document.createElement('button');back.textContent='TORNA AL DISPLAY FINISH';back.style.cssText='position:fixed;bottom:8px;right:8px;z-index:99998;padding:12px';back.onclick=()=>{screen.hidden=false;renderDisplay();};document.body.appendChild(back);
  for(const [id,v] of [['kd-stop',0],['kd-go',1]])screen.querySelector('#'+id).onclick=()=>{if(permitView)permitView.textContent='Comando in attesa';control('training/permit','permit='+v);renderDisplay();};
  setInterval(renderDisplay,500);
  athleteOptions();setView();
  try{window.AndroidHeltec.requestTempo();}catch(e){window.KAIROS_HELTEC_ONERROR(e.message);}
  setInterval(()=>{athleteOptions();try{window.AndroidHeltec.requestTempo();}catch(e){window.KAIROS_HELTEC_ONERROR(e.message);}},750);
  setInterval(()=>{if(Date.now()-H.lastSeenAt>4500&&H.connected){H.connected=false;setView();}},1000);
 });
})();
