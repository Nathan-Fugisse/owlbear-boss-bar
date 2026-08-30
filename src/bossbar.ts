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

function renderBoss(boss: BossData) {
  const container = document.getElementById("boss-container");
  const name = document.getElementById("boss-name");
  const hp = document.getElementById("boss-hp");

  if (!container || !name || !hp) return;

  if (!boss.visible) {
    container.style.display = "none";
    return;
  }

  container.style.display = "flex";

  name.textContent = boss.name;

  const percentage =
    boss.maxHp > 0
      ? Math.max(
          0,
          Math.min(100, (boss.currentHp / boss.maxHp) * 100)
        )
      : 0;

  hp.style.width = `${percentage}%`;

  hp.style.backgroundColor = boss.color;

  hp.style.boxShadow = `
    inset 0 1px 1px rgba(255,255,255,.25),
    0 0 12px ${boss.color}
  `;
}

async function loadBoss() {
  const metadata = await OBR.room.getMetadata();

  const state =
    metadata[EXTENSION_ID] as BossState | undefined;

  if (!state?.boss) {
    return;
  }

  renderBoss(state.boss);
}

OBR.onReady(async () => {
  await loadBoss();

  OBR.room.onMetadataChange(() => {
    loadBoss();
  });
});