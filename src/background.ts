import OBR, { buildPointer } from "@owlbear-rodeo/sdk";

const EXTENSION_ID = "com.nathan.rpg-boss-bar";
const TOOL_ID = `${EXTENSION_ID}/cinematic-path-tool`;
const PATH_MODE_ID = `${TOOL_ID}/record`;
const FADE_OUT_MS = 1100;

interface DamageEvent { id: string; amount: number; createdAt: number; }
interface BossData { name:string; currentHp:number; maxHp:number; color:string; visible:boolean; damageEvents?:DamageEvent[]; }
interface IntroData { name:string; subtitle:string; imageUrl:string; durationMs:number; background:string; }
interface PathPoint { x:number; y:number; }
interface TokenPath { id:string; tokenId:string; tokenName:string; points:PathPoint[]; durationMs:number; delayMs:number; }
interface CinematicData { name:string; durationMs:number; transition:string; transitionMs:number; effect:string; effectIntensity:number; overlayColor:string; overlayOpacity:number; title:string; subtitle:string; paths:TokenPath[]; }
interface ActiveCinematic { cinematic:CinematicData; introDurationMs:number; startedAt:number; nonce:string; }
interface RoomState { boss?:BossData; intro?:IntroData; introVisible?:boolean; introPhase?:"show"|"fade"; introStartedAt?:number; introPhaseStartedAt?:number; cinematic?:CinematicData; activeCinematic?:ActiveCinematic|null; }

let overlayOpen = false;
let finishTimer = 0;
let fadeTimer = 0;
let lastIntroStart = 0;
let cinematicNonce = "";
let cinematicFrame = 0;
let cinematicPathStarted = new Set<string>();
let lastTokenUpdate = 0;
let pathRecorder: { tokenId:string; tokenName:string; points:PathPoint[]; } | null = null;
let pathPreview: any = null;

async function getState(): Promise<RoomState> {
  const metadata = await OBR.room.getMetadata();
  return (metadata[EXTENSION_ID] as RoomState | undefined) ?? {};
}

async function openOverlay() {
  if (overlayOpen) return;
  overlayOpen = true;
  try {
    await OBR.modal.open({ id:`${EXTENSION_ID}/overlay`, url:"/bossbar.html", fullScreen:true, hideBackdrop:true, hidePaper:true, disablePointerEvents:true });
  } catch { overlayOpen = false; }
}
async function closeOverlay() { if (!overlayOpen) return; overlayOpen=false; try { await OBR.modal.close(`${EXTENSION_ID}/overlay`); } catch {} }
function clearTimers(){ if(finishTimer)clearTimeout(finishTimer); if(fadeTimer)clearTimeout(fadeTimer); finishTimer=0;fadeTimer=0; }

async function finishIntroFade(){
  const latest=await getState();
  if(!latest.introVisible || latest.introPhase!=="fade") return;
  await OBR.room.setMetadata({[EXTENSION_ID]:{...latest,introVisible:false,introPhase:undefined,introStartedAt:undefined,introPhaseStartedAt:undefined}});
}
async function startFade(state:RoomState){
  if(!state.introVisible||!state.intro||state.introPhase==="fade")return;
  await OBR.room.setMetadata({[EXTENSION_ID]:{...state,introVisible:true,introPhase:"fade",introPhaseStartedAt:Date.now()}});
  if(fadeTimer)clearTimeout(fadeTimer);
  fadeTimer=window.setTimeout(()=>void finishIntroFade(),FADE_OUT_MS);
}
async function scheduleIntro(state:RoomState){
  const startedAt=Number(state.introStartedAt)||Date.now();
  const duration=Math.max(1000,Math.min(60000,Number(state.intro?.durationMs)||4500));
  const remaining=Math.max(0,duration-(Date.now()-startedAt));
  if(state.introPhase==="fade"){
    const fadeStarted=Number(state.introPhaseStartedAt)||Date.now();
    const remainingFade=Math.max(0,FADE_OUT_MS-(Date.now()-fadeStarted));
    if(!fadeTimer)fadeTimer=window.setTimeout(()=>void finishIntroFade(),remainingFade);
    return;
  }
  if(finishTimer)clearTimeout(finishTimer);
  finishTimer=window.setTimeout(async()=>{const latest=await getState();if(latest.introVisible)await startFade(latest);},remaining);
}

function dist(a:PathPoint,b:PathPoint){return Math.hypot(b.x-a.x,b.y-a.y);}
function pointAt(points:PathPoint[],t:number):PathPoint{
  if(points.length===0)return {x:0,y:0};
  if(points.length===1)return points[0];
  const lengths:number[]=[];let total=0;
  for(let i=0;i<points.length-1;i++){const d=dist(points[i],points[i+1]);lengths.push(d);total+=d;}
  if(total<=0)return points[0];
  let target=t*total;
  for(let i=0;i<lengths.length;i++){
    if(target<=lengths[i]){const r=lengths[i]===0?0:target/lengths[i];return{x:points[i].x+(points[i+1].x-points[i].x)*r,y:points[i].y+(points[i+1].y-points[i].y)*r};}
    target-=lengths[i];
  }
  return points[points.length-1];
}

async function animateTokenPaths(cinematic:CinematicData,elapsed:number){
  if (Date.now() - lastTokenUpdate < 50) return;
  lastTokenUpdate = Date.now();
  for(const path of cinematic.paths||[]){
    if(path.points.length<2)continue;
    const local=elapsed-(Number(path.delayMs)||0);
    if(local<0)continue;
    const duration=Math.max(100,Number(path.durationMs)||1000);
    const t=Math.max(0,Math.min(1,local/duration));
    const pos=pointAt(path.points,t);
    await OBR.scene.items.updateItems([path.tokenId],items=>{for(const item of items)item.position=pos;});
  }
}

function registerPathTool(){
  void OBR.tool.create({id:TOOL_ID,icons:[{icon:"/icon.svg",label:"Caminho da Cinemática",filter:{roles:["GM"]}}],defaultMode:PATH_MODE_ID});
  void OBR.tool.createMode({
    id:PATH_MODE_ID,
    icons:[{icon:"/icon.svg",label:"Marcar ponto",filter:{activeTools:[TOOL_ID],roles:["GM"]}}],
    cursors:[{cursor:"crosshair"}],
    onActivate:async()=>{
      const meta=await OBR.tool.getMetadata(TOOL_ID);
      const tokenId=typeof meta.tokenId==="string"?meta.tokenId:"";
      if(!tokenId){OBR.notification.show("Selecione um token e clique em Gravar Caminho.");void OBR.tool.removeMode(PATH_MODE_ID);return;}
      const items=await OBR.scene.items.getItems([tokenId]);
      pathRecorder={tokenId,tokenName:items[0]?.name||"Token",points:[]};
    },
    onToolClick:async(_,event)=>{
      if(!pathRecorder)return true;
      pathRecorder.points.push({x:event.pointerPosition.x,y:event.pointerPosition.y});
      try{
        if(pathPreview)await OBR.scene.local.deleteItems([pathPreview.id]);
        pathPreview=buildPointer().position(event.pointerPosition).radius(10).color("#f0b429").build();
        await OBR.scene.local.addItems([pathPreview]);
      }catch{}
      OBR.notification.show(`Ponto ${pathRecorder.points.length} adicionado. Duplo clique ou Enter para finalizar.`);
      return true;
    },
    onToolDoubleClick:async()=>{await saveRecordedPath();return true;},
    onKeyDown:async(_,event)=>{if(event.code==="Enter"){await saveRecordedPath();} if(event.code==="Escape"){await cancelRecordedPath();}},
    onDeactivate:async()=>{if(pathRecorder)await cancelRecordedPath();}
  });
}

async function saveRecordedPath(){
  if(!pathRecorder||pathRecorder.points.length<2){OBR.notification.show("Marque pelo menos 2 pontos.");return;}
  const state=await getState();
  const cinematic={...(state.cinematic||defaultCinematic()),paths:[...((state.cinematic?.paths)||[]),{id:`path-${Date.now()}`,tokenId:pathRecorder.tokenId,tokenName:pathRecorder.tokenName,points:pathRecorder.points,durationMs:2000,delayMs:0}]};
  await OBR.room.setMetadata({[EXTENSION_ID]:{...state,cinematic}});
  OBR.notification.show("Caminho salvo na Cinemática.");
  await cancelRecordedPath();
  await OBR.tool.removeMode(PATH_MODE_ID).catch(()=>{});
}
async function cancelRecordedPath(){
  pathRecorder=null;
  if(pathPreview){try{await OBR.scene.local.deleteItems([pathPreview.id]);}catch{} pathPreview=null;}
}
function defaultCinematic():CinematicData{return{name:"Entrada Cinemática",durationMs:6000,transition:"FADE",transitionMs:800,effect:"NONE",effectIntensity:50,overlayColor:"#000000",overlayOpacity:0,title:"",subtitle:"",paths:[]};}

async function startCinematic(){
  const state=await getState();
  const cinematic=state.cinematic||defaultCinematic();
  const introDuration=Math.max(1000,Number(state.intro?.durationMs)||4500)+FADE_OUT_MS;
  const active={cinematic,introDurationMs:introDuration,startedAt:Date.now(),nonce:`cin-${Date.now()}-${Math.random().toString(36).slice(2)}`};
  await OBR.room.setMetadata({[EXTENSION_ID]:{...state,intro:state.intro||{name:"BOSS",subtitle:"",imageUrl:"",durationMs:4500,background:"#080808"},introVisible:true,introPhase:"show",introStartedAt:Date.now(),introPhaseStartedAt:Date.now(),activeCinematic:active}});
}

async function stopCinematic(){const state=await getState();await OBR.room.setMetadata({[EXTENSION_ID]:{...state,activeCinematic:null}});}

async function runCinematic(state:RoomState){
  const active=state.activeCinematic;if(!active)return;
  if(cinematicNonce===active.nonce && cinematicFrame) return;
  cinematicNonce=active.nonce;
  if(cinematicFrame)cancelAnimationFrame(cinematicFrame);
  const tick=async()=>{
    if(cinematicNonce!==active.nonce)return;
    const elapsed=Date.now()-active.startedAt;
    const introMs=Number(active.introDurationMs)||0;
    const cinematicElapsed=Math.max(0,elapsed-introMs);
    const total=Math.max(500,Number(active.cinematic.durationMs)||6000);
    if(cinematicElapsed>=total){await stopCinematic();return;}
    if(cinematicElapsed>=0)await animateTokenPaths(active.cinematic,cinematicElapsed);
    cinematicFrame=requestAnimationFrame(()=>void tick());
  };
  await tick();
}

async function update(){
  const state=await getState();
  const introActive=Boolean(state.introVisible&&state.intro);
  const bossActive=Boolean(state.boss?.visible);
  const cinematicActive=Boolean(state.activeCinematic);
  const isGM=(await OBR.player.getRole())==="GM";
  if(introActive||bossActive||cinematicActive)await openOverlay();else{clearTimers();await closeOverlay();return;}
  if(introActive){const startedAt=Number(state.introStartedAt)||0;if(startedAt!==lastIntroStart){lastIntroStart=startedAt;clearTimers();}if(isGM)await scheduleIntro(state);return;}
  if(cinematicActive){if(isGM)void runCinematic(state);return;}
  clearTimers();lastIntroStart=0;
}

OBR.onReady(()=>{
  registerPathTool();
  void update();
  OBR.room.onMetadataChange(()=>void update());
});
