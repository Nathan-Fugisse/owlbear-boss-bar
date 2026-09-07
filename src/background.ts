import OBR from "@owlbear-rodeo/sdk";

const EXTENSION_ID = "com.nathan.rpg-boss-bar";

interface DamageEvent { id:string; amount:number; createdAt:number; }
interface BossData { name:string; currentHp:number; maxHp:number; color:string; visible:boolean; damageEvents?:DamageEvent[]; }
interface IntroData { name:string; subtitle:string; imageUrl:string; durationMs:number; background:string; }
interface RoomState { boss?:BossData; intro?:IntroData; introVisible?:boolean; }

let bossOverlayOpen = false;
let introOverlayOpen = false;
let autoCloseTimer = 0;
let lastIntroNonce = "";

async function getState(): Promise<RoomState> {
  const metadata = await OBR.room.getMetadata();
  return (metadata[EXTENSION_ID] as RoomState | undefined) ?? {};
}

async function openBoss() {
  if (bossOverlayOpen) return;
  bossOverlayOpen = true;
  try {
    await OBR.modal.open({
      id:`${EXTENSION_ID}/boss-overlay`,
      url:"/bossbar.html",
      fullScreen:true,
      hideBackdrop:true,
      hidePaper:true,
      disablePointerEvents:true,
    });
  } catch (error) {
    bossOverlayOpen=false;
    console.error("Boss overlay failed",error);
  }
}

async function closeBoss() {
  if (!bossOverlayOpen) return;
  bossOverlayOpen=false;
  try { await OBR.modal.close(`${EXTENSION_ID}/boss-overlay`); } catch {}
}

async function openIntro() {
  if (introOverlayOpen) return;
  introOverlayOpen=true;
  try {
    await OBR.modal.open({
      id:`${EXTENSION_ID}/intro-overlay`,
      url:"/intro.html",
      fullScreen:true,
      hideBackdrop:true,
      hidePaper:true,
      disablePointerEvents:true,
    });
  } catch (error) {
    introOverlayOpen=false;
    console.error("Intro overlay failed",error);
  }
}

async function closeIntro() {
  if (!introOverlayOpen) return;
  introOverlayOpen=false;
  try { await OBR.modal.close(`${EXTENSION_ID}/intro-overlay`); } catch {}
}

async function update() {
  const state = await getState();
  const intro = state.introVisible && state.intro ? state.intro : null;

  // IMPORTANT: while the intro is active, the Boss Bar is explicitly closed.
  if (intro) {
    await closeBoss();
    await openIntro();

    const nonce = `${intro.name}|${intro.imageUrl}|${intro.durationMs}|${state.introVisible}`;
    if (nonce !== lastIntroNonce) {
      lastIntroNonce = nonce;
      if (autoCloseTimer) window.clearTimeout(autoCloseTimer);

      autoCloseTimer = window.setTimeout(async () => {
        const latest = await getState();
        if (latest.introVisible) {
          await OBR.room.setMetadata({
            [EXTENSION_ID]: {
              ...latest,
              introVisible:false,
            },
          });
        }
      }, Math.max(1000, Math.min(60000, intro.durationMs || 4500)));
    }
    return;
  }

  if (autoCloseTimer) {
    window.clearTimeout(autoCloseTimer);
    autoCloseTimer=0;
  }

  await closeIntro();
  lastIntroNonce = "";

  if (state.boss?.visible) await openBoss();
  else await closeBoss();
}

OBR.onReady(() => {
  void update();
  OBR.room.onMetadataChange(() => void update());
});
