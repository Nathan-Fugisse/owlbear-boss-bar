import OBR from "@owlbear-rodeo/sdk";

const EXTENSION_ID = "com.nathan.rpg-boss-bar";
const DAMAGE_LIFETIME = 1500;

interface DamageEvent {
  id: string;
  amount: number;
  createdAt: number;
}

interface BossData {
  name: string;
  currentHp: number;
  maxHp: number;
  color: string;
  visible: boolean;
  damageEvents?: DamageEvent[];
}

interface BossState {
  boss: BossData;
}

let lastDamageSignature = "";
let animationTimer: number | undefined;

function renderDamageEvents(events: DamageEvent[]) {
  const damageLayer = document.getElementById("damage-layer");
  if (!damageLayer) return;

  const now = Date.now();
  const recent = events
    .filter((event) => now - event.createdAt < DAMAGE_LIFETIME)
    .sort((a, b) => a.createdAt - b.createdAt);

  damageLayer.innerHTML = "";

  recent.forEach((event, index) => {
    const element = document.createElement("div");
    element.className = "damage-number";
    element.textContent = `-${event.amount}`;
    element.dataset.id = event.id;

    // Several hits can exist at the same time. Spread them so they accumulate
    // instead of replacing one another.
    const offset = (index - (recent.length - 1) / 2) * 58;
    element.style.setProperty("--damage-x", `${offset}px`);
    element.style.animationDelay = `${Math.min(index * 45, 180)}ms`;

    damageLayer.appendChild(element);
  });

  if (animationTimer !== undefined) {
    window.clearTimeout(animationTimer);
  }

  if (recent.length > 0) {
    const remaining = Math.max(
      50,
      DAMAGE_LIFETIME - (now - Math.min(...recent.map((e) => e.createdAt)))
    );

    animationTimer = window.setTimeout(() => {
      void loadBoss();
    }, remaining + 30);
  }
}

function renderBoss(boss: BossData) {
  const container = document.getElementById("boss-container");
  const name = document.getElementById("boss-name");
  const hp = document.getElementById("boss-hp");
  const hpValue = document.getElementById("boss-hp-value");

  if (!container || !name || !hp || !hpValue) return;

  if (!boss.visible) {
    container.style.display = "none";
    return;
  }

  container.style.display = "flex";

  name.textContent = boss.name || "EXAMPLE BOSS";
  hpValue.textContent = String(Math.max(0, Math.round(boss.currentHp)));

  const percentage =
    boss.maxHp > 0
      ? Math.max(0, Math.min(100, (boss.currentHp / boss.maxHp) * 100))
      : 0;

  hp.style.width = `${percentage}%`;
  hp.style.backgroundColor = boss.color || "#8b0000";

  hp.style.boxShadow = `
    inset 0 1px 1px rgba(255,255,255,.28),
    0 0 10px ${boss.color || "#8b0000"}
  `;

  renderDamageEvents(boss.damageEvents ?? []);
}

async function loadBoss() {
  const metadata = await OBR.room.getMetadata();
  const state = metadata[EXTENSION_ID] as BossState | undefined;

  if (!state?.boss) return;

  const events = state.boss.damageEvents ?? [];
  const signature = events.map((event) => `${event.id}:${event.amount}`).join("|");

  // If a new event arrived, restart the visual sequence naturally.
  if (signature !== lastDamageSignature) {
    lastDamageSignature = signature;
  }

  renderBoss(state.boss);
}

OBR.onReady(async () => {
  await loadBoss();

  OBR.room.onMetadataChange(() => {
    void loadBoss();
  });
});
