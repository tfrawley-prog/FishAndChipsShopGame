const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const floor=$('#floor'),ticketsEl=$('#tickets'),toast=$('#toast'),bell=$('#bell');
let money=0,rating=3.5,id=0,elapsed=0,mode='normal',lastSpawn=0,customers=[],tickets=[],gameStarted=false,paused=false,lastFrame=0,served=0,missed=0,firstOrder=true;
const cfg={chips:{cap:3,cook:7000,green:5500,burn:7500,level:1},fish:{cap:2,cook:8500,green:5500,burn:7500,level:1},burger:{cap:2,cook:6500,green:5000,burn:7000,level:1}};
const stationNames={chips:'Chip Fryer',fish:'Fish Fryer',burger:'Burger Grill'};
const people=[
 {tag:'SURFER',shirt:'#4d8b8e',skin:'#d8a06b',hair:'#c79a52'},
 {tag:'TRADIE',shirt:'#d89d37',skin:'#c98b5e',hair:'#6a432f'},
 {tag:'LOCAL',shirt:'#b65746',skin:'#e1aa78',hair:'#4e382f'},
 {tag:'TOURIST',shirt:'#6d7fa8',skin:'#d8a06b',hair:'#b56d43'},
 {tag:'KID',shirt:'#6b9c5b',skin:'#e4b17f',hair:'#57382b'},
 {tag:'OLD MATE',shirt:'#7c6b86',skin:'#d4a176',hair:'#c9c0ad'}
];
const stations={};
$$('.station').forEach(el=>stations[el.dataset.kind]={el,kind:el.dataset.kind,qty:0,state:'idle',started:0,readyAt:0});

let audioCtx;
function tone(freq=440,dur=.06,type='square',vol=.035){
 try{
  audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();
  const o=audioCtx.createOscillator(),g=audioCtx.createGain();
  o.type=type;o.frequency.value=freq;g.gain.value=vol;o.connect(g);g.connect(audioCtx.destination);
  o.start();g.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+dur);o.stop(audioCtx.currentTime+dur);
 }catch{}
}
function buzz(ms=25){try{navigator.vibrate?.(ms)}catch{}}
function say(s,ms=900){toast.textContent=s;toast.classList.add('show');clearTimeout(say.t);say.t=setTimeout(()=>toast.classList.remove('show'),ms)}
function updateHUD(){ $('#money').textContent=money; $('#rating').textContent=rating.toFixed(1); let m=9*60+Math.floor(elapsed/1000*2); $('#clock').textContent=`${Math.floor(m/60)%24}:${String(m%60).padStart(2,'0')}` }

function randomOrder(person){
 let r=Math.random();
 if(r<.075){
   let k=['chips','fish','burger'][Math.floor(Math.random()*3)];
   let n=5+Math.floor(Math.random()*4);
   return {[k]:n};
 }
 let o={}, count=1+(Math.random()<.58?1:0)+(Math.random()<.16?1:0);
 for(let i=0;i<count;i++){
   let k=['chips','fish','burger','drink'][Math.floor(Math.random()*4)];
   o[k]=(o[k]||0)+1+(Math.random()<.10?1:0);
 }
 return o;
}
function spawn(){
 if(customers.filter(c=>c.stage==='counter').length) return;
 let p=people[Math.floor(Math.random()*people.length)];
 let base=rating>=4.5?30000:34000;
 let c={id:++id,stage:'enter',born:performance.now(),patience:mode==='chaos'?19000:mode==='rush'?26000:base,order:null,person:p};
 customers.push(c);
 let el=document.createElement('div');el.className='customer';el.dataset.id=c.id;
 el.style.setProperty('--shirt',p.shirt);el.style.setProperty('--skin',p.skin);el.style.setProperty('--hair',p.hair);
 el.innerHTML=`<span class="head"></span><span class="hair"></span><span class="body"></span><em class="mood">🙂</em><span class="tag">${p.tag}</span>`;
 floor.append(el);c.el=el;el.style.left='47%';el.style.top='12%';
 setTimeout(()=>{if(!c.el)return;c.stage='counter';el.classList.add('counter');el.style.left='44%';el.style.top='72%';tone(660,.05);},380);
 attachSwipe(el,c);
}
function attachSwipe(el,c){
 let sy=null;
 el.addEventListener('pointerdown',e=>{sy=e.clientY;el.setPointerCapture(e.pointerId)});
 el.addEventListener('pointerup',e=>{if(sy!=null&&e.clientY-sy>32&&c.stage==='counter')takeOrder(c);sy=null});
}
function takeOrder(c){
 c.order=randomOrder(c.person);c.stage='waiting';c.taken=performance.now();c.patience=mode==='chaos'?32000:mode==='rush'?44000:60000;
 c.el.classList.remove('counter');c.el.style.left=(9+Math.random()*76)+'%';c.el.style.top=(25+Math.random()*38)+'%';
 tickets.push({id:c.id,customer:c,need:{...c.order},done:{}});
 buzz(28);tone(520,.045);setTimeout(()=>tone(700,.05),55);
 let desc=Object.entries(c.order).map(([k,n])=>`${k.toUpperCase()} ×${n}`).join(' · ');
 say(desc,1300);renderTickets();
 if(firstOrder){firstOrder=false;$('.hint').classList.add('hide')}
}
function renderTickets(){
 ticketsEl.innerHTML='';
 if(!tickets.length)ticketsEl.innerHTML='<div class="empty">No open orders.</div>';
 tickets.forEach(t=>{
   let d=document.createElement('div'),ready=isReady(t);
   d.className='ticket'+(ready?' ready':'');
   d.innerHTML=`<b>#${t.id} · ${t.customer.person.tag}</b>`+
    Object.entries(t.need).map(([k,n])=>`<div class="${(t.done[k]||0)>=n?'done':''}">${k.toUpperCase()} ×${n} ${(t.done[k]||0)>=n?'✓':`(${t.done[k]||0}/${n})`}</div>`).join('');
   ticketsEl.append(d);
 });
}
function isReady(t){return Object.entries(t.need).every(([k,n])=>(t.done[k]||0)>=n)}
function fulfill(kind,n){
 for(let x=0;x<n;x++){
   let t=tickets.find(t=>(t.done[kind]||0)<(t.need[kind]||0));
   if(!t)break;
   t.done[kind]=(t.done[kind]||0)+1;
 }
 renderTickets();autoCompleteOrders();
}
function autoCompleteOrders(){
 tickets.filter(t=>isReady(t)&&!t.completing).forEach((t,i)=>{t.completing=true;setTimeout(()=>completeOrder(t),120+i*230)});
}
function ringBell(){
 bell.classList.remove('ring');void bell.offsetWidth;bell.classList.add('ring');
 tone(1046,.08,'sine',.055);setTimeout(()=>tone(1318,.11,'sine',.04),70);
}
function completeOrder(t){
 if(!tickets.includes(t))return;
 const age=performance.now()-(t.customer.taken||performance.now());
 const quick=age<18000,reward=quick?18:12;
 money+=reward;served++;rating=Math.min(5,rating+(quick?.045:.025));
 ringBell();
 t.customer.el?.classList.add('served');setTimeout(()=>t.customer.el?.remove(),260);
 customers=customers.filter(c=>c!==t.customer);tickets=tickets.filter(x=>x!==t);
 buzz(quick?75:50);say((quick?'NICE! ':'ORDER OUT! ')+`+$${reward}`,1150);renderTickets();updateUpgradeUI();
}
function stationTap(s){
 if(s.state==='fire'){
   s.state='idle';s.qty=0;s.el.className='station '+s.kind;
   say('FIRE OUT — BACK TO WORK');rating=Math.max(0,rating-.25);buzz(120);tone(130,.15,'sawtooth');drawStation(s);return;
 }
 if(s.state!=='idle')return;
 if(s.qty<cfg[s.kind].cap){s.qty++;buzz(12);tone(250+s.qty*45,.035);drawStation(s)}
}
function startStation(s){
 if(s.state!=='idle'||!s.qty)return;
 s.state='cooking';s.started=performance.now();s.readyAt=s.started+cfg[s.kind].cook;
 s.el.classList.add('cooking');buzz(28);tone(180,.07);drawStation(s);
}
function collect(s){
 if(s.state!=='ready'&&s.state!=='burn')return;
 const burnt=s.state==='burn';
 if(burnt){rating=Math.max(0,rating-.07);say('BURNT BATCH — BINNED',1050);buzz(90);tone(110,.12,'sawtooth')}
 else{fulfill(s.kind,s.qty);say(s.kind.toUpperCase()+' SENT');buzz(45);tone(780,.055)}
 s.qty=0;s.state='idle';s.started=0;s.readyAt=0;s.el.className='station '+s.kind;drawStation(s);
}
function drawStation(s){
 let strong=s.el.querySelector('strong'),small=s.el.querySelector('small'),bar=s.el.querySelector('.bar i');
 strong.textContent=`${s.qty}/${cfg[s.kind].cap}`;
 if(s.state==='idle'){small.textContent='tap load · swipe ↓';bar.style.width='0'}
 else if(s.state==='cooking'){small.textContent='COOKING'}
 else if(s.state==='ready'){small.textContent='READY · swipe ↑';bar.style.width='100%'}
 else if(s.state==='burn'){small.textContent='BURNING! SWIPE ↑';bar.style.width='100%'}
 else if(s.state==='fire'){small.textContent='🔥 FIRE — TAP!';strong.textContent='🔥'}
}
Object.values(stations).forEach(s=>{
 let sy=null;
 s.el.addEventListener('pointerdown',e=>{sy=e.clientY;s.el.setPointerCapture(e.pointerId)});
 s.el.addEventListener('pointerup',e=>{let dy=e.clientY-sy;if(dy>35)startStation(s);else if(dy<-35)collect(s);else stationTap(s);sy=null});
});
$('#drink').onclick=()=>{if(!gameStarted||paused)return;fulfill('drink',1);buzz(15);tone(600,.04);say('DRINK SENT')};

$$('footer [data-mode]').forEach(b=>b.onclick=()=>{
 $$('footer [data-mode]').forEach(x=>x.classList.remove('active'));b.classList.add('active');mode=b.dataset.mode;say(mode.toUpperCase());
});

const upgradeDefs=[
 {kind:'chips',name:'Chip Fryer',cap:[3,4,5,6],cook:[7000,6500,6000,5400],cost:[45,90,160]},
 {kind:'fish',name:'Fish Fryer',cap:[2,3,4,5],cook:[8500,7900,7300,6600],cost:[50,100,175]},
 {kind:'burger',name:'Burger Grill',cap:[2,3,4,5],cook:[6500,6000,5500,5000],cost:[45,90,160]}
];
function updateUpgradeUI(){
 const box=$('#upgradeList');box.innerHTML='';
 upgradeDefs.forEach(u=>{
   const c=cfg[u.kind],idx=c.level-1,max=c.level>=4,cost=max?0:u.cost[idx];
   let row=document.createElement('div');row.className='upgrade-row';
   row.innerHTML=`<b>${u.name} <span class="level">LV ${c.level}</span></b>
   <small>Capacity ${c.cap} · ${(c.cook/1000).toFixed(1)} sec cook</small>
   <button ${max||money<cost?'disabled':''}>${max?'MAX':`$${cost}`}</button>`;
   row.querySelector('button').onclick=()=>buyUpgrade(u);
   box.append(row);
 });
}
function buyUpgrade(u){
 const c=cfg[u.kind],idx=c.level-1;if(c.level>=4)return;
 const cost=u.cost[idx];if(money<cost){say('NOT ENOUGH CASH');return}
 money-=cost;c.level++;c.cap=u.cap[c.level-1];c.cook=u.cook[c.level-1];
 drawStation(stations[u.kind]);updateHUD();updateUpgradeUI();buzz(60);tone(660,.06);setTimeout(()=>tone(880,.08),70);say(`${u.name.toUpperCase()} UPGRADED!`,1200);
}
function openUpgrades(){
 paused=true;updateUpgradeUI();$('#upgradeOverlay').classList.remove('hidden');
}
function closeUpgrades(){
 $('#upgradeOverlay').classList.add('hidden');paused=false;lastFrame=performance.now();
}
$('#upgradeBtn').onclick=openUpgrades;
$('#menuUpgrades').onclick=openUpgrades;
$('#closeUpgrades').onclick=closeUpgrades;

$('#startGame').onclick=()=>{
 gameStarted=true;paused=false;lastSpawn=performance.now();lastFrame=performance.now();
 $('#menu').classList.add('hidden');buzz(35);tone(440,.05);setTimeout(()=>tone(660,.08),70);spawn();requestAnimationFrame(loop);
};
$('#restartGame').onclick=()=>location.reload();

function endGame(){
 gameStarted=false;
 $('#gameOverStats').innerHTML=`You served <b>${served}</b> customers.<br>You lost <b>${missed}</b> customers.<br>Takings: <b>$${money}</b>`;
 $('#gameOver').classList.remove('hidden');tone(180,.3,'sawtooth',.03);
}
function loop(now){
 if(!gameStarted)return;
 if(paused){lastFrame=now;requestAnimationFrame(loop);return}
 const dt=Math.min(50,now-lastFrame||16);lastFrame=now;elapsed+=dt;
 // Success attracts more people: higher rating slightly accelerates arrivals.
 let ramp=Math.min(2200,elapsed*.014),repBoost=Math.max(0,rating-3.5)*500;
 let interval=(mode==='chaos'?3300:mode==='rush'?5200:8200)-ramp-repBoost;
 if(now-lastSpawn>interval&&customers.length<18){spawn();lastSpawn=now}
 customers.slice().forEach(c=>{
   let start=c.stage==='counter'?c.born:c.taken;if(!start)return;
   let age=now-start,limit=c.patience,ratio=age/limit;
   const mood=c.el?.querySelector('.mood');
   if(mood)mood.textContent=ratio>.82?'😡':ratio>.6?'😒':ratio>.38?'😐':'🙂';
   if(ratio>.6)c.el?.classList.add('angry');
   if(age>limit){
     rating=Math.max(0,rating-.22);missed++;c.el?.remove();customers=customers.filter(x=>x!==c);
     if(c.stage==='waiting'){tickets=tickets.filter(t=>t.customer!==c);renderTickets()}
     say('CUSTOMER LEFT · BAD REVIEW ★↓',1200);tone(150,.1,'sawtooth');
   }
 });
 Object.values(stations).forEach(s=>{
   if(s.state==='cooking'){
     let p=(now-s.started)/cfg[s.kind].cook;s.el.querySelector('.bar i').style.width=Math.min(100,p*100)+'%';
     if(now>=s.readyAt){s.state='ready';s.el.classList.add('ready');drawStation(s);tone(900,.06)}
   }else if(s.state==='ready'&&now>s.readyAt+cfg[s.kind].green){
     s.state='burn';s.el.classList.remove('ready');s.el.classList.add('burn');drawStation(s);tone(220,.1,'sawtooth');
   }else if(s.state==='burn'&&now>s.readyAt+cfg[s.kind].green+cfg[s.kind].burn){
     s.state='fire';s.el.classList.add('fire');rating=Math.max(0,rating-.22);drawStation(s);say('🔥 FIRE! TAP THE STATION',1400);tone(100,.2,'sawtooth');
   }
 });
 updateHUD();
 if(rating<=0){endGame();return}
 requestAnimationFrame(loop);
}
updateHUD();updateUpgradeUI();
