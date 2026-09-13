import OBR from "@owlbear-rodeo/sdk";

const EXTENSION_ID = "com.nathan.rpg-boss-bar";
const FADE_OUT_MS = 1100;
const BOSS_MODAL_ID = `${EXTENSION_ID}/overlay`;
const CINEMATIC_MODAL_ID = `${EXTENSION_ID}/cinematic-overlay`;

interface DamageEvent { id: string; amount: number; createdAt: number; }
interface BossData { name:string; currentHp:number; maxHp:number; color:string; visible:boolean; damageEvents?:DamageEvent[]; }
interface IntroData { name:string; subtitle:string; imageUrl:string; durationMs:number; background:string; }
interface Point { x:number; y:number; }
interface PatrolRoute { id:string; name:string; points:Point[]; durationMs:number; delayMs:number; loop:boolean; pingPong:boolean; rotate:boolean; }
interface PatrolAssignment { tokenId:string; route:PatrolRoute; }
interface CameraCue { id:string; atMs:number; mode:"point"|"follow"; x?:number; y?:number; scale?:number; tokenId?:string; }
interface CinematicConfig { transition:string; effect:string; effectDurationMs:number; durationMs:number; cameraCues?:CameraCue[]; }
interface ActiveCinematic { cinematic:any; introDurationMs?:number; startedAt:number; nonce:string; directorId:string; }
interface RoomState { boss?:BossData; intro?:IntroData; introVisible?:boolean; introPhase?:"show"|"fade"; introStartedAt?:number; introPhaseStartedAt?:number; cinematic?:{ patrols?:PatrolAssignment[] }; cinematicConfig?:CinematicConfig; activeCinematic?:ActiveCinematic|null; }

let bossOverlayOpen=false;
let cinematicOverlayOpen=false;
let finishTimer=0;
let fadeTimer=0;
let directorTimer=0;
let lastIntroStart=0;
let lastCinematicNonce="";

async function getState():Promise<RoomState>{
  const metadata=await OBR.room.getMetadata();
  return (metadata[EXTENSION_ID] as RoomState|undefined)??{};
}
async function openBossOverlay(){
  if(bossOverlayOpen)return;
  try{await OBR.modal.open({id:BOSS_MODAL_ID,url:"/bossbar.html",fullScreen:true,hideBackdrop:true,hidePaper:true,disablePointerEvents:true});bossOverlayOpen=true;}catch{}
}
async function closeBossOverlay(){if(!bossOverlayOpen)return;bossOverlayOpen=false;try{await OBR.modal.close(BOSS_MODAL_ID);}catch{}}
async function openCinematicOverlay(){
  if(cinematicOverlayOpen)return;
  try{await OBR.modal.open({id:CINEMATIC_MODAL_ID,url:"/cinematic.html",fullScreen:true,hideBackdrop:true,hidePaper:true,disablePointerEvents:true});cinematicOverlayOpen=true;}catch{}
}
async function closeCinematicOverlay(){if(!cinematicOverlayOpen)return;cinematicOverlayOpen=false;try{await OBR.modal.close(CINEMATIC_MODAL_ID);}catch{}}
function clearTimers(){
  if(finishTimer)clearTimeout(finishTimer);
  if(fadeTimer)clearTimeout(fadeTimer);
  if(directorTimer)clearInterval(directorTimer);
  finishTimer=0;fadeTimer=0;directorTimer=0;
}
async function startFade(state:RoomState){
  if(!state.introVisible||!state.intro||state.introPhase==="fade")return;
  await OBR.room.setMetadata({[EXTENSION_ID]:{...state,introVisible:true,introPhase:"fade",introPhaseStartedAt:Date.now()}});
  fadeTimer=window.setTimeout(async()=>{
    const latest=await getState();
    if(!latest.introVisible||latest.introPhase!=="fade")return;
    await OBR.room.setMetadata({[EXTENSION_ID]:{...latest,introVisible:false,introPhase:undefined,introStartedAt:undefined,introPhaseStartedAt:undefined}});
  },FADE_OUT_MS);
}
async function scheduleIntro(state:RoomState){
  const startedAt=Number(state.introStartedAt)||Date.now();
  const duration=Math.max(1000,Math.min(60000,Number(state.intro?.durationMs)||4500));
  const remaining=Math.max(0,duration-(Date.now()-startedAt));
  if(state.introPhase==="fade"){
    if(!fadeTimer)fadeTimer=window.setTimeout(async()=>{
      const latest=await getState();
      if(!latest.introVisible||latest.introPhase!=="fade")return;
      await OBR.room.setMetadata({[EXTENSION_ID]:{...latest,introVisible:false,introPhase:undefined,introStartedAt:undefined,introPhaseStartedAt:undefined}});
    },FADE_OUT_MS);
    return;
  }
  if(finishTimer)clearTimeout(finishTimer);
  finishTimer=window.setTimeout(async()=>{const latest=await getState();if(latest.introVisible)await startFade(latest);},remaining);
}

function clamp(v:number,a=0,b=1){return Math.max(a,Math.min(b,v));}
function lerp(a:number,b:number,t:number){return a+(b-a)*t;}
function ease(t:number){return t<0.5?2*t*t:1-Math.pow(-2*t+2,2)/2;}
function distance(a:Point,b:Point){return Math.hypot(b.x-a.x,b.y-a.y);}
function poseOnRoute(points:Point[],progress:number){
  if(points.length<2)return {point:points[0]??{x:0,y:0},angle:0};
  const lengths=points.slice(1).map((p,i)=>distance(points[i],p));
  const total=lengths.reduce((a,b)=>a+b,0);
  if(total<=0)return {point:{...points[0]},angle:0};
  let target=clamp(progress)*total;
  for(let i=0;i<lengths.length;i++){
    const len=lengths[i];
    if(target<=len){const a=points[i],b=points[i+1],t=len?target/len:0;return{point:{x:lerp(a.x,b.x,t),y:lerp(a.y,b.y,t)},angle:Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI};}
    target-=len;
  }
  const a=points[points.length-2],b=points[points.length-1];
  return{point:{...b},angle:Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI};
}
function routeProgress(route:PatrolRoute,elapsed:number){
  const duration=Math.max(250,route.durationMs||5000);
  if(route.loop){const cycles=Math.floor(elapsed/duration);const f=(elapsed%duration)/duration;return route.pingPong&&cycles%2?1-f:f;}
  if(route.pingPong){const f=clamp(elapsed/duration);return f<=0.5?f*2:2-f*2;}
  return clamp(elapsed/duration);
}

function cameraCueAt(cues:CameraCue[],elapsed:number){
  if(!cues.length)return null;
  const sorted=[...cues].sort((a,b)=>a.atMs-b.atMs);
  let from=sorted[0];
  for(let i=0;i<sorted.length-1;i++){
    if(elapsed>=sorted[i].atMs&&elapsed<sorted[i+1].atMs){from=sorted[i];const to=sorted[i+1];return{from,to,t:ease(clamp((elapsed-from.atMs)/Math.max(1,to.atMs-from.atMs)))};}
  }
  return{from,to:null,t:1};
}

async function startDirector(active:ActiveCinematic,state:RoomState){
  if(lastCinematicNonce===active.nonce)return;
  lastCinematicNonce=active.nonce;
  if(directorTimer)clearInterval(directorTimer);
  const isGM=await OBR.player.getRole()==="GM";
  const assignments=state.cinematic?.patrols??[];
  const config=state.cinematicConfig;
  const introMs=Math.max(0,Number(active.introDurationMs)||0);
  const cameraCues=config?.cameraCues??[];

  // Place every recorded token at point 1 while the introduction is covering the map.
  if(isGM&&assignments.length){
    try{await OBR.scene.items.updateItems(assignments.map(a=>a.tokenId),(items)=>{for(const item of items){const a=assignments.find(x=>x.tokenId===item.id);const p=a?.route.points[0];if(p)item.position={...p};}});}catch{}
  }

  directorTimer=window.setInterval(async()=>{
    const latest=await getState();
    if(!latest.activeCinematic||latest.activeCinematic.nonce!==active.nonce){clearInterval(directorTimer);directorTimer=0;return;}
    const elapsed=Date.now()-active.startedAt-introMs;
    if(elapsed<0)return;

    if(isGM&&assignments.length){
      const updates:{id:string;point:Point;angle:number;route:PatrolRoute}[]=[];
      for(const a of assignments){
        const local=elapsed-a.route.delayMs;
        if(local<0)continue;
        const done=!a.route.loop&&!a.route.pingPong&&local>a.route.durationMs;
        if(done)continue;
        const pose=poseOnRoute(a.route.points,routeProgress(a.route,local));
        updates.push({id:a.tokenId,point:pose.point,angle:pose.angle,route:a.route});
      }
      if(updates.length){try{await OBR.scene.items.updateItems(updates.map(u=>u.id),(items)=>{for(const item of items){const u=updates.find(x=>x.id===item.id);if(!u)continue;item.position={...u.point};if(u.route.rotate)item.rotation=u.angle;}});}catch{}}
    }

    if(cameraCues.length){
      const cue=cameraCueAt(cameraCues,elapsed);
      if(cue){
        let x=Number(cue.from.x)||0,y=Number(cue.from.y)||0,scale=Math.max(.1,Number(cue.from.scale)||1);
        if(cue.from.mode==="follow"&&cue.from.tokenId){
          try{const items=await OBR.scene.items.getItems([cue.from.tokenId]);const token=items[0];if(token){x=token.position.x;y=token.position.y;}}catch{}
        } else if(cue.to&&cue.to.mode==="point"&&cue.from.mode==="point"){
          x=lerp(Number(cue.from.x)||0,Number(cue.to.x)||0,cue.t);y=lerp(Number(cue.from.y)||0,Number(cue.to.y)||0,cue.t);scale=lerp(Number(cue.from.scale)||1,Number(cue.to.scale)||1,cue.t);
        }
        try{await OBR.viewport.setPosition({x,y});await OBR.viewport.setScale(scale);}catch{}
      }
    }
  },33);
}

async function update(){
  const state=await getState();
  const introActive=Boolean(state.introVisible&&state.intro);
  const active=state.activeCinematic;
  const bossActive=Boolean(state.boss?.visible);
  const isGM=await OBR.player.getRole()==="GM";
  if(introActive){
    if(active)await closeCinematicOverlay();
    await openBossOverlay();
    const started=Number(state.introStartedAt)||0;
    if(started!==lastIntroStart){lastIntroStart=started;clearTimers();}
    if(isGM)await scheduleIntro(state);
    return;
  }
  if(active){
    await closeBossOverlay();
    await openCinematicOverlay();
    await startDirector(active,state);
    return;
  }
  if(bossActive)await openBossOverlay();else await closeBossOverlay();
  await closeCinematicOverlay();
  clearTimers();lastIntroStart=0;lastCinematicNonce="";
}

OBR.onReady(()=>{void update();OBR.room.onMetadataChange(()=>void update());});
