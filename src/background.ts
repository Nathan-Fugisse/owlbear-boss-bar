import OBR from "@owlbear-rodeo/sdk";

const EXTENSION_ID = "com.nathan.rpg-boss-bar";
const FADE_OUT_MS = 1100;
const ROUTE_KEY = `${EXTENSION_ID}/patrolRoute`;
const CINEMATIC_MODAL_ID = `${EXTENSION_ID}/cinematic-overlay`;
const BOSS_MODAL_ID = `${EXTENSION_ID}/overlay`;

interface DamageEvent { id: string; amount: number; createdAt: number; }
interface BossData { name:string; currentHp:number; maxHp:number; color:string; visible:boolean; damageEvents?:DamageEvent[]; }
interface IntroData { name:string; subtitle:string; imageUrl:string; durationMs:number; background:string; }
interface Point { x:number; y:number; }
interface PatrolRoute { id:string; name:string; points:Point[]; durationMs:number; delayMs:number; loop:boolean; pingPong:boolean; rotate:boolean; }
interface PatrolAssignment { tokenId:string; route:PatrolRoute; }
interface CinematicConfig { transition:string; effect:string; effectDurationMs:number; }
interface ActiveCinematic { cinematic:any; introDurationMs?:number; startedAt:number; nonce:string; directorId:string; }
interface RoomState { boss?:BossData; intro?:IntroData; introVisible?:boolean; introPhase?:"show"|"fade"; introStartedAt?:number; introPhaseStartedAt?:number; cinematic?:{ patrols?:PatrolAssignment[] }; cinematicConfig?:CinematicConfig; activeCinematic?:ActiveCinematic|null; }

let bossOverlayOpen = false;
let cinematicOverlayOpen = false;
let finishTimer = 0;
let fadeTimer = 0;
let routeTimer = 0;
let lastIntroStart = 0;
let lastCinematicNonce = "";

async function getState(): Promise<RoomState> {
  const metadata = await OBR.room.getMetadata();
  return (metadata[EXTENSION_ID] as RoomState | undefined) ?? {};
}

async function openBossOverlay() {
  if (bossOverlayOpen) return;
  bossOverlayOpen = true;
  try { await OBR.modal.open({ id:BOSS_MODAL_ID, url:"/bossbar.html", fullScreen:true, hideBackdrop:true, hidePaper:true, disablePointerEvents:true }); }
  catch { bossOverlayOpen=false; }
}
async function closeBossOverlay() {
  if (!bossOverlayOpen) return;
  bossOverlayOpen=false;
  try { await OBR.modal.close(BOSS_MODAL_ID); } catch {}
}
async function openCinematicOverlay() {
  if (cinematicOverlayOpen) return;
  cinematicOverlayOpen=true;
  try { await OBR.modal.open({ id:CINEMATIC_MODAL_ID, url:"/cinematic.html", fullScreen:true, hideBackdrop:true, hidePaper:true, disablePointerEvents:true }); }
  catch { cinematicOverlayOpen=false; }
}
async function closeCinematicOverlay() {
  if (!cinematicOverlayOpen) return;
  cinematicOverlayOpen=false;
  try { await OBR.modal.close(CINEMATIC_MODAL_ID); } catch {}
}
function clearTimers() {
  if (finishTimer) clearTimeout(finishTimer);
  if (fadeTimer) clearTimeout(fadeTimer);
  if (routeTimer) clearInterval(routeTimer);
  finishTimer=0; fadeTimer=0; routeTimer=0;
}

async function startFade(state: RoomState) {
  if (!state.introVisible || !state.intro || state.introPhase === "fade") return;
  await OBR.room.setMetadata({ [EXTENSION_ID]: { ...state, introVisible:true, introPhase:"fade", introPhaseStartedAt:Date.now() } });
  fadeTimer = window.setTimeout(async () => {
    const latest=await getState();
    if (!latest.introVisible || latest.introPhase!=="fade") return;
    await OBR.room.setMetadata({ [EXTENSION_ID]: { ...latest, introVisible:false, introPhase:undefined, introStartedAt:undefined, introPhaseStartedAt:undefined } });
  }, FADE_OUT_MS);
}
async function scheduleIntro(state:RoomState) {
  const startedAt=Number(state.introStartedAt)||Date.now();
  const duration=Math.max(1000,Math.min(60000,Number(state.intro?.durationMs)||4500));
  const remaining=Math.max(0,duration-(Date.now()-startedAt));
  if (state.introPhase === "fade") {
    if (!fadeTimer) fadeTimer=window.setTimeout(async()=>{
      const latest=await getState();
      if (!latest.introVisible || latest.introPhase!=="fade") return;
      await OBR.room.setMetadata({ [EXTENSION_ID]:{...latest,introVisible:false,introPhase:undefined,introStartedAt:undefined,introPhaseStartedAt:undefined} });
    }, FADE_OUT_MS);
    return;
  }
  if (finishTimer) clearTimeout(finishTimer);
  finishTimer=window.setTimeout(async()=>{ const latest=await getState(); if(latest.introVisible) await startFade(latest); },remaining);
}

function clamp(v:number,a=0,b=1){return Math.max(a,Math.min(b,v));}
function distance(a:Point,b:Point){return Math.hypot(b.x-a.x,b.y-a.y);}
function pointOnRoute(points:Point[], progress:number): { point:Point; angle:number } {
  if (points.length<2) return {point:points[0]??{x:0,y:0},angle:0};
  const lengths=points.slice(1).map((p,i)=>distance(points[i],p));
  const total=lengths.reduce((a,b)=>a+b,0);
  let target=clamp(progress)*total;
  for(let i=0;i<lengths.length;i++){
    const len=lengths[i];
    if(target<=len){
      const a=points[i],b=points[i+1],t=len?target/len:0;
      return {point:{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t},angle:Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI};
    }
    target-=len;
  }
  const a=points[points.length-2],b=points[points.length-1];
  return {point:{...b},angle:Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI};
}
function routeProgress(route:PatrolRoute, elapsed:number){
  const duration=Math.max(250,route.durationMs||5000);
  const t=clamp(elapsed/duration);
  if(route.loop){ const cycle=(elapsed/duration)%1; return route.pingPong && Math.floor(elapsed/duration)%2===1 ? 1-cycle:cycle; }
  if(route.pingPong){ return t<0.5?t*2:2-t*2; }
  return t;
}

async function runRoutes(active:ActiveCinematic, state:RoomState) {
  const isGM=await OBR.player.getRole()==="GM";
  if(!isGM || !state.cinematic?.patrols?.length) return;
  if(lastCinematicNonce===active.nonce) return;
  lastCinematicNonce=active.nonce;
  if(routeTimer) clearInterval(routeTimer);
  const assignments=state.cinematic.patrols;
  routeTimer=window.setInterval(async()=>{
    const latest=await getState();
    if(!latest.activeCinematic || latest.activeCinematic.nonce!==active.nonce){ clearInterval(routeTimer); routeTimer=0; return; }
    const elapsed=Date.now()-active.startedAt-(Number(active.introDurationMs)||0);
    if(elapsed<0) return;
    const updates=assignments.map(a=>{
      const route=a.route; const local=elapsed-route.delayMs; if(local<0) return null;
      const cycleDuration=Math.max(250,route.durationMs||5000);
      if(!route.loop && !route.pingPong && local>cycleDuration) return null;
      const progress=routeProgress(route,local);
      const pose=pointOnRoute(route.points,progress);
      return {id:a.tokenId,point:pose.point,angle:pose.angle,route};
    }).filter(Boolean) as {id:string;point:Point;angle:number;route:PatrolRoute}[];
    if(!updates.length) return;
    try { await OBR.scene.items.updateItems(updates.map(u=>u.id),(items)=>{ for(const item of items){ const u=updates.find(x=>x.id===item.id); if(!u) continue; item.position={...u.point}; if(u.route.rotate) item.rotation=u.angle; } }); } catch {}
  },50);
}

async function update() {
  const state=await getState();
  const introActive=Boolean(state.introVisible&&state.intro);
  const activeCinematic=state.activeCinematic;
  const bossActive=Boolean(state.boss?.visible);
  const isGM=await OBR.player.getRole()==="GM";

  if(introActive){
    if(activeCinematic) await closeCinematicOverlay();
    await openBossOverlay();
    const started=Number(state.introStartedAt)||0;
    if(started!==lastIntroStart){lastIntroStart=started;clearTimers();}
    if(isGM) await scheduleIntro(state);
    return;
  }

  if(activeCinematic){
    await closeBossOverlay();
    await openCinematicOverlay();
    await runRoutes(activeCinematic,state);
    return;
  }

  if(bossActive) await openBossOverlay(); else await closeBossOverlay();
  await closeCinematicOverlay();
  clearTimers(); lastIntroStart=0; lastCinematicNonce="";
}

OBR.onReady(()=>{ void update(); OBR.room.onMetadataChange(()=>void update()); });
