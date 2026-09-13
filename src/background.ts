import OBR from "@owlbear-rodeo/sdk";

const EXTENSION_ID = "com.nathan.rpg-boss-bar";
const FADE_OUT_MS = 1100;

interface DamageEvent { id: string; amount: number; createdAt: number; }
interface BossData { name:string; currentHp:number; maxHp:number; color:string; visible:boolean; damageEvents?:DamageEvent[]; }
interface IntroData { name:string; subtitle:string; imageUrl:string; durationMs:number; background:string; }
type IntroPhase = "show" | "fade";
interface RoomState { boss?:BossData; intro?:IntroData; introVisible?:boolean; introPhase?:IntroPhase; introStartedAt?:number; introPhaseStartedAt?:number; }

let overlayOpen = false;
let finishTimer = 0;
let fadeTimer = 0;
let lastIntroStart = 0;

async function getState(): Promise<RoomState> {
  const metadata = await OBR.room.getMetadata();
  return (metadata[EXTENSION_ID] as RoomState | undefined) ?? {};
}

async function openOverlay() {
  if (overlayOpen) return;
  overlayOpen = true;
  try {
    await OBR.modal.open({
      id: `${EXTENSION_ID}/overlay`,
      url: "/bossbar.html",
      fullScreen: true,
      hideBackdrop: true,
      hidePaper: true,
      disablePointerEvents: true,
    });
  } catch (error) {
    overlayOpen = false;
    console.error("RPG Boss Bar: overlay failed", error);
  }
}

async function closeOverlay() {
  if (!overlayOpen) return;
  overlayOpen = false;
  try { await OBR.modal.close(`${EXTENSION_ID}/overlay`); } catch {}
}

function clearTimers() {
  if (finishTimer) window.clearTimeout(finishTimer);
  if (fadeTimer) window.clearTimeout(fadeTimer);
  finishTimer = 0;
  fadeTimer = 0;
}

async function startFade(state: RoomState) {
  if (!state.introVisible || !state.intro) return;
  if (state.introPhase === "fade") return;

  await OBR.room.setMetadata({
    [EXTENSION_ID]: {
      ...state,
      introVisible: true,
      introPhase: "fade",
      introPhaseStartedAt: Date.now(),
    },
  });

  if (fadeTimer) window.clearTimeout(fadeTimer);
  fadeTimer = window.setTimeout(async () => {
    const latest = await getState();
    if (!latest.introVisible || latest.introPhase !== "fade") return;

    await OBR.room.setMetadata({
      [EXTENSION_ID]: {
        ...latest,
        introVisible: false,
        introPhase: undefined,
        introStartedAt: undefined,
        introPhaseStartedAt: undefined,
      },
    });
  }, FADE_OUT_MS);
}

async function scheduleIntro(state: RoomState) {
  const startedAt = Number(state.introStartedAt) || Date.now();
  const duration = Math.max(1000, Math.min(60000, Number(state.intro?.durationMs) || 4500));
  const elapsed = Date.now() - startedAt;
  const remaining = Math.max(0, duration - elapsed);

  if (state.introPhase === "fade") {
    // A manual hide can put the shared state directly into the fade phase.
    // Finish that fade locally and then remove the shared intro state.
    if (!fadeTimer) {
      fadeTimer = window.setTimeout(async () => {
        const latest = await getState();
        if (!latest.introVisible || latest.introPhase !== "fade") return;
        await OBR.room.setMetadata({
          [EXTENSION_ID]: {
            ...latest,
            introVisible: false,
            introPhase: undefined,
            introStartedAt: undefined,
          },
        });
      }, FADE_OUT_MS);
    }
    return;
  }

  if (finishTimer) window.clearTimeout(finishTimer);
  finishTimer = window.setTimeout(async () => {
    const latest = await getState();
    if (!latest.introVisible) return;
    await startFade(latest);
  }, remaining);
}

async function update() {
  const state = await getState();
  const introActive = Boolean(state.introVisible && state.intro);
  const bossActive = Boolean(state.boss?.visible);
  const isGM = (await OBR.player.getRole()) === "GM";

  // One persistent overlay is used for both modes. This avoids the race that
  // occurred when one modal was being closed while another was opening.
  if (introActive || bossActive) {
    await openOverlay();
  } else {
    clearTimers();
    lastIntroStart = 0;
    await closeOverlay();
    return;
  }

  if (introActive) {
    // Intro always takes priority. The overlay itself hides the Boss Bar.
    // Only the GM advances the shared timeline. Players render it locally
    // from the timestamps, avoiding competing metadata writes.
    const startedAt = Number(state.introStartedAt) || 0;
    if (startedAt !== lastIntroStart) {
      lastIntroStart = startedAt;
      clearTimers();
    }
    if (isGM) await scheduleIntro(state);
  } else {
    // Intro ended: the same overlay immediately switches to the Boss Bar.
    clearTimers();
    lastIntroStart = 0;
  }
}

OBR.onReady(() => {
  void update();
  OBR.room.onMetadataChange(() => void update());
});
