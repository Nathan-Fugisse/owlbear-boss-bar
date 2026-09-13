import OBR from "@owlbear-rodeo/sdk";

const EXTENSION_ID = "com.nathan.rpg-boss-bar";
const FADE_OUT_MS = 1100;
const BOSS_MODAL_ID = `${EXTENSION_ID}/overlay`;

interface DamageEvent { id:string; amount:number; createdAt:number; }
interface BossData { name:string; currentHp:number; maxHp:number; color:string; visible:boolean; damageEvents?:DamageEvent[]; }
interface IntroData { name:string; subtitle:string; imageUrl:string; durationMs:number; background:string; }
interface RoomState { boss?:BossData; intro?:IntroData; introVisible?:boolean; introPhase?:"show"|"fade"; introStartedAt?:number; introPhaseStartedAt?:number; }

let bossOverlayOpen=false;
let finishTimer=0;
let fadeTimer=0;
let lastIntroStart=0;

async function getState():Promise<RoomState>{
  const metadata=await OBR.room.getMetadata();
  return (metadata[EXTENSION_ID] as RoomState|undefined)??{};
}
async function openBossOverlay(){
  if(bossOverlayOpen)return;
  try{await OBR.modal.open({id:BOSS_MODAL_ID,url:"/bossbar.html",fullScreen:true,hideBackdrop:true,hidePaper:true,disablePointerEvents:true});bossOverlayOpen=true;}catch{}
}
async function closeBossOverlay(){if(!bossOverlayOpen)return;bossOverlayOpen=false;try{await OBR.modal.close(BOSS_MODAL_ID);}catch{}}
function clearTimers(){
  if(finishTimer)clearTimeout(finishTimer);
  if(fadeTimer)clearTimeout(fadeTimer);
  finishTimer=0;fadeTimer=0;
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

async function update(){
  const state=await getState();
  const introActive=Boolean(state.introVisible&&state.intro);
  const bossActive=Boolean(state.boss?.visible);
  const isGM=await OBR.player.getRole()==="GM";
  if(introActive){
    await openBossOverlay();
    const started=Number(state.introStartedAt)||0;
    if(started!==lastIntroStart){lastIntroStart=started;clearTimers();}
    if(isGM)await scheduleIntro(state);
    return;
  }
  if(bossActive)await openBossOverlay();else await closeBossOverlay();
  clearTimers();lastIntroStart=0;
}

OBR.onReady(()=>{void update();OBR.room.onMetadataChange(()=>void update());});
