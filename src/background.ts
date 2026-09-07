import OBR from "@owlbear-rodeo/sdk";

const EXTENSION_ID = "com.nathan.rpg-boss-bar";

interface BossData {
  name: string;
  currentHp: number;
  maxHp: number;
  color: string;
  visible: boolean;
}

interface RoomState {
  boss?: BossData;
}

let overlayOpen = false;

async function getState(): Promise<RoomState> {
  const metadata = await OBR.room.getMetadata();
  return (metadata[EXTENSION_ID] as RoomState | undefined) ?? {};
}

async function openBossOverlay() {
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
    throw error;
  }
}

async function closeBossOverlay() {
  if (!overlayOpen) return;
  overlayOpen = false;
  try {
    await OBR.modal.close(`${EXTENSION_ID}/overlay`);
  } catch (error) {
    console.warn("RPG Boss Bar: overlay close failed", error);
  }
}

async function updateOverlay() {
  const state = await getState();
  if (state.boss?.visible) await openBossOverlay();
  else await closeBossOverlay();
}

OBR.onReady(() => {
  void updateOverlay();
  OBR.room.onMetadataChange(() => void updateOverlay());
});
