import OBR from "@owlbear-rodeo/sdk";
import "./cinematic.css";

const EXTENSION_ID = "com.nathan.rpg-boss-bar";

type CameraCue = { id:string; atMs:number; x:number; y:number; scale:number; effect:string; intensity:number };
type State = { activeCinematic?: { startedAt:number; introDurationMs:number; nonce:string }; cinematicConfig?: { durationMs:number; transition:string; cameraCues:CameraCue[] } };

const sleep = (ms:number) => new Promise<void>(resolve => setTimeout(resolve, ms));
const clamp = (v:number,a:number,b:number) => Math.max(a,Math.min(b,v));
const ease = (t:number) => t*t*(3-2*t);

function effectClass(effect:string){ return effect === "roar" ? "effect-roar" : `effect-${effect}`; }

async function run(){
  await OBR.onReady(async () => {
    let lastNonce = "";
    let raf = 0;
    let overlay: HTMLDivElement | null = null;
    let running = false;

    const ensureOverlay = () => {
      if (!overlay) { overlay = document.createElement("div"); overlay.className = "cinematic-effects"; document.body.appendChild(overlay); }
      return overlay;
    };
    const clearOverlay = () => { if (overlay) { overlay.className="cinematic-effects"; overlay.innerHTML=""; overlay.style.removeProperty("--shake"); } };

    const drawEffect = (el:HTMLDivElement, effect:string, intensity:number) => {
      el.className = `cinematic-effects ${effectClass(effect)}`;
      el.innerHTML = "";
      el.style.setProperty("--shake", `${Math.max(1,intensity/12)}px`);
      if (effect === "roar" || effect === "wave") {
        el.innerHTML = `<div class="sound-wave wave-1"></div><div class="sound-wave wave-2"></div><div class="sound-wave wave-3"></div><div class="roar-ring"></div>`;
      } else if (effect === "impact") {
        el.innerHTML = `<div class="impact-ring"></div>`;
      }
    };

    const animateCamera = async (cues:CameraCue[], total:number, startTime:number) => {
      const sorted = [...cues].sort((a,b)=>a.atMs-b.atMs);
      if (!sorted.length) return;
      while (running) {
        const elapsed = Date.now() - startTime;
        if (elapsed >= total) break;
        let a = sorted[0], b = sorted[0];
        for (let i=0;i<sorted.length-1;i++) if (elapsed >= sorted[i].atMs && elapsed <= sorted[i+1].atMs) { a=sorted[i]; b=sorted[i+1]; break; }
        if (elapsed < sorted[0].atMs) { a=sorted[0]; b=sorted[0]; }
        if (elapsed > sorted[sorted.length-1].atMs) { a=sorted[sorted.length-1]; b=a; }
        const span = Math.max(1,b.atMs-a.atMs);
        const t = a===b ? 1 : ease(clamp((elapsed-a.atMs)/span,0,1));
        await OBR.viewport.setPosition({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
        await OBR.viewport.setScale(a.scale+(b.scale-a.scale)*t);
        await new Promise<void>(r=>requestAnimationFrame(()=>r()));
      }
    };

    const loop = async () => {
      const meta = await OBR.room.getMetadata();
      const state = meta[EXTENSION_ID] as State | undefined;
      const active = state?.activeCinematic;
      if (active?.nonce && active.nonce !== lastNonce && state?.cinematicConfig?.cameraCues?.length) {
        lastNonce = active.nonce; running = true;
        const cfg = state.cinematicConfig;
        const cameraStart = active.startedAt + active.introDurationMs;
        const wait = cameraStart - Date.now();
        if (wait > 0) await sleep(wait);
        if (cfg.transition === "flash") { const e=ensureOverlay(); e.className="cinematic-effects transition-flash"; await sleep(220); clearOverlay(); }
        if (cfg.transition === "black") { const e=ensureOverlay(); e.className="cinematic-effects transition-black"; await sleep(500); }
        const effectEnd = Math.min(cfg.durationMs, cfg.cameraCues[0].atMs + 1200);
        void effectEnd;
        await animateCamera(cfg.cameraCues, cfg.durationMs, cameraStart);
        running = false; clearOverlay();
      }
      raf = requestAnimationFrame(()=>void loop());
    };
    void loop();
  });
}
void run();
