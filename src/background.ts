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
  | "CAMERA";

interface CinematicCue {
  id: string;
  atMs: number;
  type: CueType;
  value?: number;
}

interface CinematicScene {
  durationMs: number;
  cues?: CinematicCue[];
}

interface Cinematic {
  scenes: CinematicScene[];
}

interface ActiveCinematic {
  cinematic: Cinematic;
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
let runningNonce = "";
const executedCueIds = new Set<string>();

function cinematicDuration(active: ActiveCinematic): number {
  return active.cinematic.scenes.reduce(
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
        absoluteMs: offset + Math.max(0, Number(cue.atMs) || 0),
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
        if (
          ["BOSS_SHOW", "BOSS_HIDE", "BOSS_DAMAGE", "BOSS_HEAL"].includes(item.cue.type)
        ) {
          await executeBossCue(item.cue);
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
    }

    return;
  }

  if (!active) {
    lastCompletedNonce = "";
    stopCueScheduler();

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
