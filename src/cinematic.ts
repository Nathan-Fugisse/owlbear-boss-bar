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
const executedCueIds = new Set<string>();

function getActiveFromMetadata(metadata: Record<string, unknown>): ActiveCinematic | null {
  const state = metadata[EXTENSION_ID] as RoomState | undefined;
  return state?.activeCinematic ?? null;
}

function totalDuration(cinematic: Cinematic): number {
  return cinematic.scenes.reduce(
    (sum, scene) => sum + Math.max(500, Number(scene.durationMs) || 500),
    0
  );
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

function renderScene(scene: CinematicScene, elapsed: number) {
  const root = document.getElementById("cinematic-root")!;
  root.style.background = scene.background || "#050505";

  const image = document.getElementById("cinematic-image") as HTMLImageElement;
  const subtitle = document.getElementById("cinematic-subtitle")!;
  const title = document.getElementById("cinematic-title")!;
  const body = document.getElementById("cinematic-body")!;

  if (scene.imageUrl) {
    if (image.src !== scene.imageUrl) image.src = scene.imageUrl;
    image.style.display = "block";
  } else {
    image.removeAttribute("src");
    image.style.display = "none";
  }

  subtitle.textContent = scene.subtitle || "";
  title.textContent = scene.title || "";
  body.textContent = scene.body || "";

  const cues = scene.cues ?? [];
  const titleCue = cues.find((cue) => cue.type === "TITLE_IN");
  const subtitleCue = cues.find((cue) => cue.type === "SUBTITLE_IN");
  const bodyCue = cues.find((cue) => cue.type === "BODY_IN");

  const titleOpacity = titleCue ? opacityAfterCue(elapsed, titleCue.atMs) : 1;
  const subtitleOpacity = subtitleCue ? opacityAfterCue(elapsed, subtitleCue.atMs) : 1;
  const bodyOpacity = bodyCue ? opacityAfterCue(elapsed, bodyCue.atMs) : 1;

  subtitle.style.opacity = String(subtitleOpacity);
  title.style.opacity = String(titleOpacity);
  body.style.opacity = String(bodyOpacity);

  const fadeIn = Math.min(1, elapsed / Math.max(1, scene.fadeInMs));
  const fadeOutStart = Math.max(0, scene.durationMs - scene.fadeOutMs);
  const fadeOut = elapsed >= fadeOutStart
    ? Math.max(0, 1 - (elapsed - fadeOutStart) / Math.max(1, scene.fadeOutMs))
    : 1;

  root.style.setProperty("--scene-opacity", String(Math.min(fadeIn, fadeOut)));
}

async function applyCamera(scene: CinematicScene, elapsed: number) {
  const cues = (scene.cues ?? [])
    .filter((cue) => cue.type === "CAMERA" && cue.camera && cuePassed(cue, elapsed))
    .sort((a, b) => a.atMs - b.atMs);

  const cue = cues[cues.length - 1];

  if (cue?.camera) {
    const key = `${scene.id}:${cue.id}`;
    if (key !== currentCameraKey) {
      currentCameraKey = key;
      await OBR.viewport.animateTo({
        position: { x: cue.camera.x, y: cue.camera.y },
        scale: cue.camera.scale,
      });
    }
    return;
  }

  if (scene.camera) {
    const key = `${scene.id}:legacy:${scene.camera.x}:${scene.camera.y}:${scene.camera.scale}`;
    if (key !== currentCameraKey) {
      currentCameraKey = key;
      await OBR.viewport.animateTo({
        position: { x: scene.camera.x, y: scene.camera.y },
        scale: scene.camera.scale,
      });
    }
  }
}

async function play(active: ActiveCinematic) {
  clearAnimation();
  activeNonce = active.nonce;
  currentCameraKey = "";
  executedCueIds.clear();

  const cinematic = active.cinematic;
  const startedAt = active.startedAt;
  const total = totalDuration(cinematic);

  const tick = async () => {
    if (active.nonce !== activeNonce) return;

    const elapsed = Date.now() - startedAt;
    if (elapsed >= total) {
      await close();
      return;
    }

    const { scene, elapsed: sceneElapsed } = sceneAt(cinematic, elapsed);
    renderScene(scene, sceneElapsed);
    await applyCamera(scene, sceneElapsed);

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
