import OBR from "@owlbear-rodeo/sdk";

const EXTENSION_ID = "com.nathan.rpg-boss-bar";

interface BossData {
  name: string;
  currentHp: number;
  maxHp: number;
  color: string;
  visible: boolean;
}

interface BossState {
  boss: BossData;
}

let overlayOpen = false;

function getDefaultBoss(): BossData {
  return {
    name: "EXAMPLE BOSS",
    currentHp: 1000,
    maxHp: 1000,
    color: "#8B0000",
    visible: false,
  };
}

async function getBoss(): Promise<BossData> {
  const metadata = await OBR.room.getMetadata();

  const state = metadata[EXTENSION_ID] as BossState | undefined;

  if (!state?.boss) {
    return getDefaultBoss();
  }

  return state.boss;
}

async function openBossOverlay() {
  if (overlayOpen) return;

  overlayOpen = true;

  await OBR.modal.open({
    id: `${EXTENSION_ID}/overlay`,
    url: "/bossbar.html",
    fullScreen: true,
    hideBackdrop: true,
    hidePaper: true,
    disablePointerEvents: true,
  });
}

async function closeBossOverlay() {
  if (!overlayOpen) return;

  overlayOpen = false;

  await OBR.modal.close(`${EXTENSION_ID}/overlay`);
}

async function updateBossOverlay() {
  const boss = await getBoss();

  if (boss.visible) {
    await openBossOverlay();
  } else {
    await closeBossOverlay();
  }
}

OBR.onReady(async () => {
  console.log("RPG Boss Bar carregada.");

  await updateBossOverlay();

  OBR.room.onMetadataChange(async () => {
    await updateBossOverlay();
  });
});