import OBR from "@owlbear-rodeo/sdk";
import "./cinematic.css";

const EXTENSION_ID = "com.nathan.rpg-boss-bar";

type CueType =
  | "TITLE_IN"
  | "SUBTITLE_IN"
  | "BODY_IN"
  | "BOSS_SHOW"
  | "BOSS_HIDE"
  | "BOSS_DAMAGE"
  | "BOSS_HEAL"
  | "CAMERA";

interface CameraCue {
  x: number;
  y: number;
  scale: number;
}

interface CinematicCue {
  id: string;
  atMs: number;
  type: CueType;
  value?: number;
  camera?: CameraCue;
}

interface CinematicScene {
  id: string;
  title: string;
  subtitle: string;
  body: string;
  imageUrl: string;
  background: string;
  durationMs: number;
  fadeInMs: number;
  fadeOutMs: number;
  camera?: CameraCue;
  cues?: CinematicCue[];
}

interface Cinematic {
  id: string;
  name: string;
  scenes: CinematicScene[];
}

interface ActiveCinematic {
  cinematic: Cinematic;
  introDurationMs?: number;
  startedAt: number;
  nonce: string;
  directorId: string;
}

interface RoomState {
  activeCinematic?: ActiveCinematic | null;
}

let activeNonce = "";
let animationFrame = 0;
let currentCameraKey = "";
let currentCameraSegment = "";
const executedCueIds = new Set<string>();

function getActiveFromMetadata(metadata: Record<string, unknown>): ActiveCinematic | null {
  const state = metadata[EXTENSION_ID] as RoomState | undefined;
  return state?.activeCinematic ?? null;
}

function timelineDuration(cinematic: Cinematic): number {
  return cinematic.scenes.reduce(
    (sum, scene) => sum + Math.max(500, Number(scene.durationMs) || 500),
    0
  );
}

function introDuration(active: ActiveCinematic): number {
  return Math.max(0, Number(active.introDurationMs) || 4500);
}

function sceneAt(cinematic: Cinematic, elapsed: number) {
  let remaining = Math.max(0, elapsed);
  let sceneIndex = 0;

  for (let index = 0; index < cinematic.scenes.length; index += 1) {
    const scene = cinematic.scenes[index];
    const duration = Math.max(500, Number(scene.durationMs) || 500);
    if (remaining < duration) {
      sceneIndex = index;
      return { scene, sceneIndex, elapsed: remaining, duration };
    }
    remaining -= duration;
  }

  const lastIndex = Math.max(0, cinematic.scenes.length - 1);
  const last = cinematic.scenes[lastIndex];
  return {
    scene: last,
    sceneIndex: lastIndex,
    elapsed: Math.max(0, Number(last?.durationMs) || 500),
    duration: Math.max(500, Number(last?.durationMs) || 500),
  };
}

function cuePassed(cue: CinematicCue, elapsed: number): boolean {
  return elapsed >= Math.max(0, Number(cue.atMs) || 0);
}

function opacityAfterCue(elapsed: number, cueTime: number, ramp = 280): number {
  if (elapsed < cueTime) return 0;
  return Math.min(1, (elapsed - cueTime) / Math.max(1, ramp));
}

function renderBossIntroduction(scene: CinematicScene, elapsed: number, duration: number) {
  const root = document.getElementById("cinematic-root")!;
  const image = document.getElementById("cinematic-image") as HTMLImageElement;
  const subtitle = document.getElementById("cinematic-subtitle")!;
  const title = document.getElementById("cinematic-title")!;
  const copy = document.querySelector<HTMLElement>(".cinematic-copy")!;

  root.classList.add("boss-intro");
  root.style.background = scene.background || "#080808";
  copy.style.display = "block";

  if (scene.imageUrl) {
    image.src = scene.imageUrl;
    image.style.display = "block";
  } else {
    image.removeAttribute("src");
    image.style.display = "none";
  }

  subtitle.textContent = scene.subtitle || "";
  title.textContent = scene.title || "";

  const fadeInMs = Math.min(700, Math.max(150, duration * 0.2));
  const fadeOutMs = Math.min(700, Math.max(150, duration * 0.2));
  const fadeIn = Math.min(1, elapsed / fadeInMs);
  const fadeOutStart = Math.max(0, duration - fadeOutMs);
  const fadeOut = elapsed >= fadeOutStart
    ? Math.max(0, 1 - (elapsed - fadeOutStart) / fadeOutMs)
    : 1;

  root.style.setProperty("--scene-opacity", String(Math.min(fadeIn, fadeOut)));
  subtitle.style.opacity = "1";
  title.style.opacity = "1";
}

function renderTimelineOverlay() {
  const root = document.getElementById("cinematic-root")!;
  const image = document.getElementById("cinematic-image") as HTMLImageElement;
  const copy = document.querySelector<HTMLElement>(".cinematic-copy")!;

  root.classList.remove("boss-intro");
  root.style.background = "transparent";
  root.style.setProperty("--scene-opacity", "1");
  image.removeAttribute("src");
  image.style.display = "none";
  copy.style.display = "none";
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

async function applyCamera(scene: CinematicScene, elapsed: number) {
  const keys = (scene.cues ?? [])
    .filter((cue) => cue.type === "CAMERA" && cue.camera)
    .sort((a, b) => a.atMs - b.atMs);

  if (keys.length === 0) return;

  let target = keys[0].camera!;
  if (elapsed >= keys[keys.length - 1].atMs) {
    target = keys[keys.length - 1].camera!;
  } else {
    for (let i = 0; i < keys.length - 1; i += 1) {
      const from = keys[i];
      const to = keys[i + 1];
      if (elapsed >= from.atMs && elapsed < to.atMs) {
        const span = Math.max(1, to.atMs - from.atMs);
        const raw = Math.max(0, Math.min(1, (elapsed - from.atMs) / span));
        const t = easeInOut(raw);
        const a = from.camera!;
        const b = to.camera!;
        target = {
          x: lerp(a.x, b.x, t),
          y: lerp(a.y, b.y, t),
          scale: lerp(a.scale, b.scale, t),
        };
        break;
      }
    }
  }

  // The viewport API controls the current player's view. This cinematic page is
  // opened locally for every connected extension instance by background.ts, so
  // each player follows the same shared timeline. We use setPosition/setScale
  // every frame instead of repeatedly restarting animateTo().
  await Promise.all([
    OBR.viewport.setPosition({ x: target.x, y: target.y }),
    OBR.viewport.setScale(target.scale),
  ]);
}

async function play(active: ActiveCinematic) {
  clearAnimation();
  activeNonce = active.nonce;
  currentCameraKey = "";
  currentCameraSegment = "";
  executedCueIds.clear();

  const cinematic = active.cinematic;
  const startedAt = active.startedAt;
  const introMs = introDuration(active);
  const timelineMs = timelineDuration(cinematic);

  const tick = async () => {
    if (active.nonce !== activeNonce) return;

    const elapsedTotal = Date.now() - startedAt;
    if (elapsedTotal >= introMs + timelineMs) {
      await close();
      return;
    }

    // Phase 1: keep the boss introduction exactly as a full-screen card.
    // The map camera and all timeline events are intentionally paused here.
    if (elapsedTotal < introMs) {
      const introScene = cinematic.scenes[0];
      if (introScene) renderBossIntroduction(introScene, elapsedTotal, introMs);
    } else {
      // Phase 2: remove the card and reveal the actual Owlbear map.
      // Only now does the camera timeline start moving the player's viewport.
      renderTimelineOverlay();
      const timelineElapsed = elapsedTotal - introMs;
      const { scene, elapsed: sceneElapsed } = sceneAt(cinematic, timelineElapsed);
      await applyCamera(scene, sceneElapsed);
    }

    animationFrame = requestAnimationFrame(() => {
      void tick();
    });
  };

  document.body.classList.add("active");
  await tick();
}

function clearAnimation() {
  if (animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = 0;
}

async function close() {
  clearAnimation();
  activeNonce = "";
  currentCameraKey = "";
  currentCameraSegment = "";
  executedCueIds.clear();
  document.body.classList.remove("active");
}

OBR.onReady(async () => {
  const metadata = await OBR.room.getMetadata();
  const active = getActiveFromMetadata(metadata);

  if (active) {
    await play(active);
  }

  OBR.room.onMetadataChange(async (nextMetadata) => {
    const next = getActiveFromMetadata(nextMetadata);

    if (!next) {
      await close();
      return;
    }

    if (next.nonce !== activeNonce) {
      await play(next);
    }
  });
});
