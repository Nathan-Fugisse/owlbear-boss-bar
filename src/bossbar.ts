import OBR from "@owlbear-rodeo/sdk";

const EXTENSION_ID = "com.nathan.rpg-boss-bar";
const DAMAGE_LIFETIME = 1500;

interface DamageEvent { id: string; amount: number; createdAt: number; }
interface BossData { name:string; currentHp:number; maxHp:number; color:string; visible:boolean; damageEvents?:DamageEvent[]; }
interface IntroData { name:string; subtitle:string; imageUrl:string; durationMs:number; background:string; }
type IntroPhase = "show" | "fade";
interface RoomState { boss?:BossData; intro?:IntroData; introVisible?:boolean; introPhase?:IntroPhase; introStartedAt?:number; }

let refreshTimer = 0;
let fadeFallbackTimer = 0;

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
    refreshTimer = window.setTimeout(() => void load(), DAMAGE_LIFETIME + 40);
  }
}

function renderBoss(boss: BossData | undefined, introActive: boolean) {
  const container = document.getElementById("boss-container");
  const name = document.getElementById("boss-name");
  const hp = document.getElementById("boss-hp");
  if (!container || !name || !hp) return;

  if (introActive || !boss?.visible) {
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

function renderIntro(intro: IntroData | undefined, visible: boolean, phase: IntroPhase = "show") {
  const root = document.getElementById("intro-container");
  const image = document.getElementById("intro-image") as HTMLImageElement | null;
  const subtitle = document.getElementById("intro-subtitle");
  const name = document.getElementById("intro-name");
  if (!root || !image || !subtitle || !name) return;

  if (!visible || !intro) {
    root.classList.remove("intro-visible", "intro-fading");
    return;
  }

  root.style.background = intro.background || "#080808";

  const nextUrl = intro.imageUrl?.trim() || "";
  if (image.dataset.url !== nextUrl) {
    image.dataset.url = nextUrl;
    image.src = nextUrl;
  }
  image.style.display = nextUrl ? "block" : "none";

  subtitle.textContent = intro.subtitle || "";
  subtitle.style.display = intro.subtitle ? "block" : "none";
  name.textContent = intro.name || "BUSHI";

  // Restart only when entering the intro. The fade phase is intentionally
  // separate so the image and text dissolve instead of being cut off.
  if (phase === "fade") {
    root.classList.remove("intro-visible");
    void root.offsetWidth;
    root.classList.add("intro-visible", "intro-fading");
  } else {
    root.classList.remove("intro-fading");
    if (!root.classList.contains("intro-visible")) {
      void root.offsetWidth;
      root.classList.add("intro-visible");
    }
  }
}

async function load() {
  const metadata = await OBR.room.getMetadata();
  const state = metadata[EXTENSION_ID] as RoomState | undefined;
  const introActive = Boolean(state?.introVisible && state?.intro);

  renderIntro(state?.intro, introActive, state?.introPhase ?? "show");
  renderBoss(state?.boss, introActive);

  // Fallback: if the background scheduler is interrupted, the overlay still
  // performs the visual fade locally after the configured duration.
  if (fadeFallbackTimer) window.clearTimeout(fadeFallbackTimer);
  if (introActive && state?.introPhase !== "fade") {
    const started = Number(state?.introStartedAt) || Date.now();
    const duration = Math.max(1000, Math.min(60000, Number(state?.intro?.durationMs) || 4500));
    const remaining = Math.max(0, duration - (Date.now() - started));
    fadeFallbackTimer = window.setTimeout(() => {
      const root = document.getElementById("intro-container");
      if (root) root.classList.add("intro-fading");
    }, remaining);
  }
}

OBR.onReady(() => {
  void load();
  OBR.room.onMetadataChange(() => void load());
});
