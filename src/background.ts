import OBR from "@owlbear-rodeo/sdk";

const EXTENSION_ID = "com.nathan.rpg-boss-bar";

interface IntroData {
  visible: boolean;
  name: string;
  subtitle: string;
  duration: number;
  color: string;
}

interface BossData {
  name: string;
  currentHp: number;
  maxHp: number;
  color: string;
  visible: boolean;
  damageEvents?: Array<{ id: string; amount: number; createdAt: number }>;
}

interface RoomState {
  boss?: BossData;
  intro?: IntroData;
}

let bossOverlayOpen = false;
let introOverlayOpen = false;
let introCloseTimer: number | undefined;

async function getState(): Promise<RoomState> {
  const metadata = await OBR.room.getMetadata();
  return (metadata[EXTENSION_ID] as RoomState | undefined) ?? {};
}

async function openBossOverlay() {
  if (bossOverlayOpen) return;
  bossOverlayOpen = true;
  try {
    await OBR.modal.open({
      id: `${EXTENSION_ID}/boss-overlay`,
      url: "/bossbar.html",
      fullScreen: true,
      hideBackdrop: true,
      hidePaper: true,
      disablePointerEvents: true,
    });
  } catch (error) {
    bossOverlayOpen = false;
    throw error;
  }
}

async function closeBossOverlay() {
  if (!bossOverlayOpen) return;
  bossOverlayOpen = false;
  try {
    await OBR.modal.close(`${EXTENSION_ID}/boss-overlay`);
  } catch (error) {
    console.warn("RPG Boss Bar: overlay close failed", error);
  }
}

async function openIntroOverlay() {
  if (introOverlayOpen) {
    try {
      await OBR.modal.close(`${EXTENSION_ID}/intro-overlay`);
    } catch {}
    introOverlayOpen = false;
  }

  introOverlayOpen = true;

  try {
    await OBR.modal.open({
      id: `${EXTENSION_ID}/intro-overlay`,
      url: "/intro.html",
      fullScreen: true,
      hideBackdrop: true,
      hidePaper: true,
      disablePointerEvents: true,
    });
  } catch (error) {
    introOverlayOpen = false;
    throw error;
  }
}

async function closeIntroOverlay() {
  if (!introOverlayOpen) return;
  introOverlayOpen = false;

  if (introCloseTimer !== undefined) {
    window.clearTimeout(introCloseTimer);
    introCloseTimer = undefined;
  }

  try {
    await OBR.modal.close(`${EXTENSION_ID}/intro-overlay`);
  } catch (error) {
    console.warn("RPG Boss Bar: intro close failed", error);
  }
}

async function updateOverlays() {
  const state = await getState();

  if (state.boss?.visible) await openBossOverlay();
  else await closeBossOverlay();

  if (state.intro?.visible) {
    await openIntroOverlay();

    const duration = Math.max(1, Math.min(60, state.intro.duration || 8));
    if (introCloseTimer !== undefined) window.clearTimeout(introCloseTimer);

    introCloseTimer = window.setTimeout(async () => {
      try {
        const latest = await getState();
        if (latest.intro?.visible) {
          await OBR.room.setMetadata({
            [EXTENSION_ID]: {
              ...latest,
              intro: {
                ...latest.intro,
                visible: false,
              },
            },
          });
        }
      } catch (error) {
        console.warn("RPG Boss Bar: intro auto-close failed", error);
      }
    }, duration * 1000);
  } else {
    await closeIntroOverlay();
  }
}

OBR.onReady(() => {
  void updateOverlays();
  OBR.room.onMetadataChange(() => void updateOverlays());
});
