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
}

interface RoomState {
  boss?: BossData;
  intro?: IntroData;
}

async function load() {
  const metadata = await OBR.room.getMetadata();
  const state = metadata[EXTENSION_ID] as RoomState | undefined;

  const intro = state?.intro;
  const boss = state?.boss;

  const screen = document.getElementById("intro-screen")!;
  const subtitle = document.getElementById("intro-subtitle")!;
  const name = document.getElementById("intro-name")!;
  const bottomName = document.getElementById("intro-bottom-name")!;
  const bar = document.getElementById("intro-bar")!;

  if (!intro?.visible) {
    screen.style.display = "none";
    return;
  }

  screen.style.display = "block";

  const bossName = intro.name || boss?.name || "REI DO GADO";
  const color = intro.color || boss?.color || "#8B0000";

  name.textContent = bossName;
  bottomName.textContent = bossName;
  subtitle.textContent = intro.subtitle || "";
  subtitle.style.display = intro.subtitle ? "block" : "none";

  // Intro uses the boss's current/max HP only as a visual fill.
  // It does not display HP numbers.
  const current = boss?.currentHp ?? 1;
  const max = boss?.maxHp ?? 1;
  const percent = max > 0 ? Math.max(0, Math.min(100, current / max * 100)) : 100;

  bar.style.width = `${percent}%`;
  bar.style.backgroundColor = color;
  bar.style.boxShadow = `0 0 12px ${color}`;
}

OBR.onReady(() => {
  void load();
  OBR.room.onMetadataChange(() => void load());
});
