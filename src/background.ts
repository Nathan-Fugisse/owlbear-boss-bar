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

let bossBarOpen = false;

function getDefaultBoss(): BossData {
  return {
    name: "Exemple Boss",
    currentHp: 1000,
    maxHp: 1000,
    color: "#8B0000",
    visible: false,
  };
}

async function getBoss(): Promise<BossData> {
  const metadata = await OBR.room.getMetadata();

  const data = metadata[EXTENSION_ID] as BossState | undefined;

  if (!data?.boss) {
    return getDefaultBoss();
  }

  return data.boss;
}

async function openBossBar() {
  if (bossBarOpen) {
    return;
  }

  bossBarOpen = true;

  await OBR.popover.open({
    id: `${EXTENSION_ID}/bossbar`,
    url: "/bossbar.html",
    width: 760,
    height: 100,

    anchorReference: "POSITION",

    anchorPosition: {
      left: window.innerWidth / 2,
      top: window.innerHeight - 80,
    },

    anchorOrigin: {
      horizontal: "CENTER",
      vertical: "CENTER",
    },

    transformOrigin: {
      horizontal: "CENTER",
      vertical: "CENTER",
    },

    hidePaper: true,
    disableClickAway: true,
  });
}

async function closeBossBar() {
  if (!bossBarOpen) {
    return;
  }

  bossBarOpen = false;

  await OBR.popover.close(
    `${EXTENSION_ID}/bossbar`
  );
}

async function updateBossBar() {
  const boss = await getBoss();

  if (boss.visible) {
    await openBossBar();
  } else {
    await closeBossBar();
  }
}

OBR.onReady(async () => {
  console.log("Boss Bar Load.");

  await updateBossBar();

  OBR.room.onMetadataChange(async () => {
    await updateBossBar();
  });
});