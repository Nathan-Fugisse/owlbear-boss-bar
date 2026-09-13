import OBR from "@owlbear-rodeo/sdk";
import "./cinematic.css";

const EXTENSION_ID = "com.nathan.rpg-boss-bar";
interface CinematicData { name:string; durationMs:number; transition:string; transitionMs:number; effect:string; effectIntensity:number; overlayColor:string; overlayOpacity:number; title:string; subtitle:string; paths:any[]; }
interface ActiveCinematic { cinematic:CinematicData; introDurationMs:number; startedAt:number; nonce:string; }
interface RoomState { activeCinematic?:ActiveCinematic|null; introVisible?:boolean; introPhase?:"show"|"fade"; introPhaseStartedAt?:number; }

let nonce="";let frame=0;
function activeFrom(metadata:any):ActiveCinematic|null{return (metadata[EXTENSION_ID] as RoomState|undefined)?.activeCinematic??null;}
function clamp(v:number,a=0,b=1){return Math.max(a,Math.min(b,v));}
function ease(t:number){return t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;}
function introProgress(active:ActiveCinematic){const intro=Number(active.introDurationMs)||0;const elapsed=Date.now()-active.startedAt;return{elapsed,intro,cinematic:Math.max(0,elapsed-intro)};}
function applyEffect(root:HTMLElement,c:CinematicData,t:number){
  root.className="cinematic-root cinematic-running";
  root.dataset.effect=c.effect||"NONE";
  root.style.setProperty("--effect-intensity",String(clamp((Number(c.effectIntensity)||50)/100)));
  root.style.setProperty("--overlay-color",c.overlayColor||"#000");
  root.style.setProperty("--overlay-opacity",String(clamp((Number(c.overlayOpacity)||0)/100)));
  if(c.effect==="FLASH" && t<Math.min(450,Number(c.transitionMs)||450)) root.dataset.flash="1"; else delete root.dataset.flash;
}
function render(active:ActiveCinematic){
  const root=document.getElementById("cinematic-root")!;const title=document.getElementById("cinematic-title")!;const subtitle=document.getElementById("cinematic-subtitle")!;const progress=introProgress(active);const c=active.cinematic;
  if(progress.cinematic<0)return;
  const total=Math.max(500,Number(c.durationMs)||6000);const t=progress.cinematic;
  root.style.setProperty("--scene-opacity","1");
  title.textContent=c.title||"";subtitle.textContent=c.subtitle||"";
  title.style.display=c.title?"block":"none";subtitle.style.display=c.subtitle?"block":"none";
  applyEffect(root,c,t);
  const tr=Math.max(0,Number(c.transitionMs)||800);
  if(c.transition==="FADE"&&t<tr)root.style.setProperty("--transition-opacity",String(clamp(t/tr)));
  else if(c.transition==="BLACK"&&t<tr)root.style.setProperty("--transition-opacity","1");
  else if(c.transition==="FLASH"&&t<tr)root.style.setProperty("--transition-opacity",String(1-clamp(t/tr)));
  else root.style.setProperty("--transition-opacity","0");
  if(c.effect==="LETTERBOX")root.classList.add("letterboxed");
  if(c.effect==="VIGNETTE")root.classList.add("vignetted");
  if(c.effect==="SHAKE")root.classList.add("shaking");
  if(c.effect==="GLITCH")root.classList.add("glitching");
  const fadeOut=Math.min(700,total*.18);if(t>total-fadeOut)root.style.setProperty("--scene-opacity",String(clamp((total-t)/fadeOut)));
}
function hide(){const root=document.getElementById("cinematic-root")!;root.className="cinematic-root";root.style.setProperty("--scene-opacity","0");}
async function play(active:ActiveCinematic){
  if(frame)cancelAnimationFrame(frame);nonce=active.nonce;document.body.classList.add("active");
  const tick=async()=>{if(active.nonce!==nonce)return;const {cinematic}=active;const {cinematic:elapsed}=introProgress(active);const total=Math.max(500,Number(cinematic.durationMs)||6000);if(elapsed>=total){hide();return;}if(elapsed>=0)render(active);frame=requestAnimationFrame(()=>void tick());};
  await tick();
}
OBR.onReady(()=>{
  void OBR.room.getMetadata().then(m=>{const a=activeFrom(m);if(a)void play(a);});
  OBR.room.onMetadataChange(metadata=>{const a=activeFrom(metadata);if(a)void play(a);else hide();});
});
