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

interface RoomState {
  boss?: BossData;
}

let refreshTimer = 0;

function renderDamage(events: DamageEvent[]) {
  const layer = document.getElementById("damage-layer");
  if (!layer) return;

  const now = Date.now();
  const recent = events
    .filter((event) => now - event.createdAt < DAMAGE_LIFETIME)
    .sort((a, b) => a.createdAt - b.createdAt);

  layer.innerHTML = "";

  recent.forEach((event, index) => {
    const el = document.createElement("div");
    el.className = "damage-number";
    el.textContent = `-${event.amount}`;
    el.style.setProperty("--damage-x", `${(index - (recent.length - 1) / 2) * 62}px`);
    el.style.animationDelay = `${Math.min(index * 45, 180)}ms`;
    layer.appendChild(el);
  });

  if (refreshTimer) window.clearTimeout(refreshTimer);
  if (recent.length) {
    refreshTimer = window.setTimeout(() => void loadBoss(), DAMAGE_LIFETIME + 40);
  }
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
  name.textContent = boss.name || "EXAMPLE BOSS";

  const pct = boss.maxHp > 0
    ? Math.max(0, Math.min(100, boss.currentHp / boss.maxHp * 100))
    : 0;

  hp.style.width = `${pct}%`;
  hp.style.backgroundColor = boss.color || "#8B0000";
  hp.style.boxShadow = `inset 0 1px 1px rgba(255,255,255,.25), 0 0 10px ${boss.color || "#8B0000"}`;

  renderDamage(boss.damageEvents ?? []);
}

async function loadBoss() {
  const metadata = await OBR.room.getMetadata();
  const state = metadata[EXTENSION_ID] as RoomState | undefined;
  if (state?.boss) renderBoss(state.boss);
}

OBR.onReady(() => {
  void loadBoss();
  OBR.room.onMetadataChange(() => void loadBoss());
});
