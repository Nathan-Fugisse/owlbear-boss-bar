import OBR from "@owlbear-rodeo/sdk";

const NS = "com.nathan.rpg-boss-bar";
const STATE_KEY = `${NS}/state`;

type CameraCue = {
  id: string;
  name: string;
  x: number;
  y: number;
  scale: number;
  duration: number;
  effect: string;
  intensity: number;
};

type CineState = {
  active?: { id: string; startedAt: number; introDurationMs: number; durationMs: number };
  cues: CameraCue[];
};

function overlayHtml(effect: string) {
  if (effect === "wave" || effect === "roar") {
    return `<div class="sound-wave wave-1"></div><div class="sound-wave wave-2"></div><div class="sound-wave wave-3"></div>`;
  }
  return "";
}

async function run() {
  await OBR.onReady(async () => {
    let lastId = "";
    let frame = 0;

    const tick = async () => {
      const meta = await OBR.room.getMetadata();
      const state = meta[STATE_KEY] as CineState | undefined;
      if (!state?.active || !state.cues?.length) return;

      if (state.active.id === lastId) {
        frame = requestAnimationFrame(() => { void tick(); });
        return;
      }
      lastId = state.active.id;

      const overlay = document.createElement("div");
      overlay.className = "cinematic-effects";
      document.body.appendChild(overlay);

      const introEnd = state.active.startedAt + state.active.introDurationMs;
      const wait = Math.max(0, introEnd - Date.now());
      if (wait) await new Promise(r => setTimeout(r, wait));

      for (const cue of state.cues) {
        await OBR.viewport.animateTo(
          { position: { x: cue.x, y: cue.y }, scale: cue.scale },
          { duration: cue.duration, easing: "easeInOutCubic" }
        );

        overlay.className = `cinematic-effects effect-${cue.effect}`;
        overlay.innerHTML = overlayHtml(cue.effect);

        if (cue.effect === "shake" || cue.effect === "roar" || cue.effect === "impact") {
          const power = Math.max(1, cue.intensity / 10);
          overlay.style.setProperty("--shake", `${power}px`);
          await new Promise(r => setTimeout(r, Math.min(700, cue.duration)));
        } else if (cue.effect === "flash") {
          await new Promise(r => setTimeout(r, 220));
        } else if (cue.effect === "wave" || cue.effect === "roar") {
          await new Promise(r => setTimeout(r, 900));
        } else if (cue.effect === "zoom" || cue.effect === "distort") {
          await new Promise(r => setTimeout(r, Math.min(800, cue.duration)));
        }
        overlay.className = "cinematic-effects";
        overlay.innerHTML = "";
      }

      overlay.remove();
      frame = requestAnimationFrame(() => { void tick(); });
    };

    void tick();
  });
}

void run();
