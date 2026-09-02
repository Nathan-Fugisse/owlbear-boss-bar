import OBR from "@owlbear-rodeo/sdk";

const EXTENSION_ID = "com.nathan.rpg-boss-bar";

type CueType =
  | "TITLE_IN"
  | "SUBTITLE_IN"
  | "BODY_IN"
  | "BOSS_SHOW"
  | "BOSS_HIDE"
  | "BOSS_DAMAGE"
  | "BOSS_HEAL"
  | "CAMERA"
  | "TOKEN_SHOW"
  | "TOKEN_HIDE";

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
  tokenIds?: string[];
  camera?: CameraCue;
}

interface CinematicScene {
  durationMs: number;
  cues?: CinematicCue[];
}

interface Cinematic {
  /** false disables all Boss Bar cues for this cinematic */
  showBossBar?: boolean;
  scenes: CinematicScene[];
}

interface ActiveCinematic {
  cinematic: Cinematic;
  introDurationMs?: number;
  startedAt: number;
  nonce: string;
  directorId: string;
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
  activeCinematic?: ActiveCinematic | null;
}

let overlayOpen = false;
let cinematicOpen = false;
let lastCompletedNonce = "";
let completionTimer = 0;
let cueTimer = 0;
let cameraTimer = 0;
let cameraRunningNonce = "";
let runningNonce = "";
const executedCueIds = new Set<string>();

function introDuration(active: ActiveCinematic): number {
  return Math.max(0, Number(active.introDurationMs) || 4500);
}

function cinematicDuration(active: ActiveCinematic): number {
  return introDuration(active) + active.cinematic.scenes.reduce(
    (sum, scene) => sum + Math.max(500, Number(scene.durationMs) || 500),
    0
  );
}

function getTimelineCues(active: ActiveCinematic): Array<{ cue: CinematicCue; absoluteMs: number }> {
  const result: Array<{ cue: CinematicCue; absoluteMs: number }> = [];
  let offset = 0;

  for (const scene of active.cinematic.scenes) {
    const duration = Math.max(500, Number(scene.durationMs) || 500);
    for (const cue of scene.cues ?? []) {
      result.push({
        cue,
        absoluteMs: introDuration(active) + offset + Math.max(0, Number(cue.atMs) || 0),
      });
    }
    offset += duration;
  }

  return result.sort((a, b) => a.absoluteMs - b.absoluteMs);
}

async function getState(): Promise<RoomState> {
  const metadata = await OBR.room.getMetadata();
  return (metadata[EXTENSION_ID] as RoomState | undefined) ?? {};
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

async function openCinematicOverlay() {
  if (cinematicOpen) return;
  cinematicOpen = true;

  await OBR.modal.open({
    id: `${EXTENSION_ID}/cinematic`,
    url: "/cinematic.html",
    fullScreen: true,
    hideBackdrop: true,
    hidePaper: true,
    disablePointerEvents: true,
  });
}

async function closeCinematicOverlay() {
  if (!cinematicOpen) return;
  cinematicOpen = false;
  await OBR.modal.close(`${EXTENSION_ID}/cinematic`);
}

async function executeBossCue(cue: CinematicCue) {
  const state = await getState();
  const boss = state.boss;
  if (!boss) return;

  let next = { ...boss };

  switch (cue.type) {
    case "BOSS_SHOW":
      next.visible = true;
      break;
    case "BOSS_HIDE":
      next.visible = false;
      break;
    case "BOSS_DAMAGE":
      next.currentHp = Math.max(0, boss.currentHp - Math.max(1, Number(cue.value) || 10));
      break;
    case "BOSS_HEAL":
      next.currentHp = Math.min(boss.maxHp, boss.currentHp + Math.max(1, Number(cue.value) || 10));
      break;
    default:
      return;
  }

  await OBR.room.setMetadata({
    [EXTENSION_ID]: {
      ...state,
      boss: next,
    },
  });
}

async function executeTokenCue(cue: CinematicCue) {
  const ids = cue.tokenIds ?? [];
  if (ids.length === 0) return;
  const visible = cue.type === "TOKEN_SHOW";
  await OBR.scene.items.updateItems(ids, (items) => {
    for (const item of items) item.visible = visible;
  });
}


function stopCameraScheduler() {
  if (cameraTimer) {
    window.clearTimeout(cameraTimer);
    cameraTimer = 0;
  }
  cameraRunningNonce = "";
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function getCameraTimeline(active: ActiveCinematic): Array<{ atMs: number; camera: CameraCue }> {
  const result: Array<{ atMs: number; camera: CameraCue }> = [];
  let offset = introDuration(active);

  for (const scene of active.cinematic.scenes) {
    const duration = Math.max(500, Number(scene.durationMs) || 500);
    for (const cue of scene.cues ?? []) {
      if (cue.type !== "CAMERA" || !cue.camera) continue;
      const x = Number(cue.camera.x);
      const y = Number(cue.camera.y);
      const scale = Number(cue.camera.scale);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(scale)) continue;
      result.push({
        atMs: offset + Math.max(0, Number(cue.atMs) || 0),
        camera: { x, y, scale },
      });
    }
    offset += duration;
  }

  return result.sort((a, b) => a.atMs - b.atMs);
}

/**
 * IMPORTANT: This runs in the extension BACKGROUND page, not inside the
 * cinematic modal. Owlbear creates one background instance for every client,
 * so this moves each connected player's own viewport locally while all clients
 * read the same shared cinematic metadata.
 */
function scheduleCameraForEveryone(active: ActiveCinematic) {
  if (cameraRunningNonce === active.nonce) return;
  stopCameraScheduler();

  const keys = getCameraTimeline(active);
  if (keys.length === 0) return;

  cameraRunningNonce = active.nonce;

  // Keep only one viewport update in flight. Calling the Owlbear API faster
  // than it can process messages causes a queue, which was the source of the
  // visible "stepping" / stutter in the camera.
  let updateInFlight = false;
  let rafId = 0;

  const stop = () => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    stopCameraScheduler();
  };

  const frame = () => {
    if (cameraRunningNonce !== active.nonce) return;

    const elapsed = Date.now() - active.startedAt;
    const totalDuration = cinematicDuration(active);

    if (elapsed > totalDuration + 100) {
      stop();
      return;
    }

    let target = keys[0].camera;

    if (elapsed <= keys[0].atMs) {
      target = keys[0].camera;
    } else if (elapsed >= keys[keys.length - 1].atMs) {
      target = keys[keys.length - 1].camera;
    } else {
      for (let index = 0; index < keys.length - 1; index += 1) {
        const from = keys[index];
        const to = keys[index + 1];
        if (elapsed >= from.atMs && elapsed < to.atMs) {
          const span = Math.max(1, to.atMs - from.atMs);
          const raw = Math.max(0, Math.min(1, (elapsed - from.atMs) / span));
          // Quintic easing has a gentler acceleration/deceleration than the
          // previous quadratic curve, so long camera pans feel cinematic.
          const t = raw < 0.5
            ? 16 * raw * raw * raw * raw * raw
            : 1 - Math.pow(-2 * raw + 2, 5) / 2;
          target = {
            x: lerp(from.camera.x, to.camera.x, t),
            y: lerp(from.camera.y, to.camera.y, t),
            scale: lerp(from.camera.scale, to.camera.scale, t),
          };
          break;
        }
      }
    }

    // Do not await the viewport calls before scheduling the next animation
    // frame. We instead skip a frame while an API update is pending, avoiding
    // a growing IPC queue while keeping interpolation tied to the display.
    if (!updateInFlight && elapsed >= introDuration(active)) {
      updateInFlight = true;
      void Promise.all([
        OBR.viewport.setPosition({ x: target.x, y: target.y }),
        OBR.viewport.setScale(target.scale),
      ])
        .catch((error) => {
          console.error("RPG Boss Bar: could not move local cinematic camera", error);
        })
        .finally(() => {
          updateInFlight = false;
        });
    }

    rafId = requestAnimationFrame(frame);
  };

  rafId = requestAnimationFrame(frame);
}

function stopCueScheduler() {
  if (cueTimer) {
    window.clearTimeout(cueTimer);
    cueTimer = 0;
  }
  runningNonce = "";
  executedCueIds.clear();
}

function scheduleTimeline(active: ActiveCinematic) {
  stopCueScheduler();
  runningNonce = active.nonce;
  executedCueIds.clear();

  const timeline = getTimelineCues(active);
  const processDueCues = async () => {
    if (active.nonce !== runningNonce) return;

    const elapsed = Date.now() - active.startedAt;
    const due = timeline.filter(
      (item) => item.absoluteMs <= elapsed && !executedCueIds.has(item.cue.id)
    );

    if (active.directorId === OBR.player.id) {
      for (const item of due) {
        executedCueIds.add(item.cue.id);
        if (["BOSS_SHOW", "BOSS_HIDE", "BOSS_DAMAGE", "BOSS_HEAL"].includes(item.cue.type)) {
          // A cinematic can be used purely as a cutscene. In that mode Boss Bar
          // events are ignored without changing the cinematic timeline itself.
          if (active.cinematic.showBossBar !== false) {
            await executeBossCue(item.cue);
          }
        } else if (["TOKEN_SHOW", "TOKEN_HIDE"].includes(item.cue.type)) {
          await executeTokenCue(item.cue);
        }
      }
    } else {
      for (const item of due) executedCueIds.add(item.cue.id);
    }

    const next = timeline.find((item) => item.absoluteMs > elapsed);
    if (!next) return;

    cueTimer = window.setTimeout(() => {
      void processDueCues();
    }, Math.max(10, next.absoluteMs - (Date.now() - active.startedAt) + 5));
  };

  const first = timeline.find(
    (item) => item.absoluteMs >= Math.max(0, Date.now() - active.startedAt)
  );

  if (first) {
    cueTimer = window.setTimeout(() => {
      void processDueCues();
    }, Math.max(10, first.absoluteMs - (Date.now() - active.startedAt) + 5));
  }
}

async function finishCinematic(active: ActiveCinematic) {
  if (active.nonce !== lastCompletedNonce) {
    lastCompletedNonce = active.nonce;
    stopCueScheduler();
    stopCameraScheduler();
    await closeCinematicOverlay();

    // The director ends the shared cinematic state. If a BOSS_SHOW cue
    // was used, the normal Boss Bar overlay can then return automatically.
    if (active.directorId === OBR.player.id) {
      const state = await getState();
      if (state.activeCinematic?.nonce === active.nonce) {
        await OBR.room.setMetadata({
          [EXTENSION_ID]: {
            ...state,
            activeCinematic: null,
          },
        });
      }
    }
  }
}

function scheduleCompletion(active: ActiveCinematic) {
  if (completionTimer) window.clearTimeout(completionTimer);

  const remaining = Math.max(
    0,
    cinematicDuration(active) - (Date.now() - active.startedAt)
  );

  completionTimer = window.setTimeout(() => {
    void finishCinematic(active);
  }, remaining + 50);
}

async function updateOverlays() {
  const state = await getState();
  const active = state.activeCinematic ?? null;

  if (active && active.nonce !== lastCompletedNonce) {
    await closeBossOverlay();
    await openCinematicOverlay();

    if (runningNonce !== active.nonce) {
      scheduleCompletion(active);
      scheduleTimeline(active);
      scheduleCameraForEveryone(active);
    }

    return;
  }

  if (!active) {
    lastCompletedNonce = "";
    stopCueScheduler();
    stopCameraScheduler();

    if (completionTimer) {
      window.clearTimeout(completionTimer);
      completionTimer = 0;
    }

    await closeCinematicOverlay();

    if (state.boss?.visible) {
      await openBossOverlay();
    } else {
      await closeBossOverlay();
    }
  }
}

OBR.onReady(async () => {
  await updateOverlays();

  OBR.room.onMetadataChange(() => {
    void updateOverlays();
  });
});
