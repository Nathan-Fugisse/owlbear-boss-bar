import OBR from "@owlbear-rodeo/sdk";
import "./style.css";

const EXTENSION_ID = "com.nathan.rpg-boss-bar";
const CINEMATIC_STORAGE_KEY = `${EXTENSION_ID}/cinematics`;
const MAX_ACTIVE_CINEMATIC_BYTES = 14000;

interface BossData {
  name: string;
  currentHp: number;
  maxHp: number;
  color: string;
  visible: boolean;
}

interface CameraCue {
  x: number;
  y: number;
  scale: number;
}

export type CinematicCueType =
  | "TITLE_IN"
  | "SUBTITLE_IN"
  | "BODY_IN"
  | "BOSS_SHOW"
  | "BOSS_HIDE"
  | "BOSS_DAMAGE"
  | "BOSS_HEAL"
  | "CAMERA";

export interface CinematicCue {
  id: string;
  atMs: number;
  type: CinematicCueType;
  value?: number;
  camera?: CameraCue;
}

export interface CinematicScene {
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
  cues: CinematicCue[];
}

export interface Cinematic {
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
  boss: BossData;
  activeCinematic?: ActiveCinematic | null;
}

const defaultBoss: BossData = {
  name: "EXAMPLE BOSS",
  currentHp: 1000,
  maxHp: 1000,
  color: "#8B0000",
  visible: false,
};

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createScene(): CinematicScene {
  return {
    id: uid("scene"),
    title: "THE BOSS AWAKENS",
    subtitle: "A NEW CHALLENGER",
    body: "The fog parts. Something ancient has noticed the party.",
    imageUrl: "",
    background: "#080808",
    durationMs: 4500,
    fadeInMs: 700,
    fadeOutMs: 700,
    cues: [
      { id: uid("cue"), atMs: 250, type: "SUBTITLE_IN" },
      { id: uid("cue"), atMs: 700, type: "TITLE_IN" },
      { id: uid("cue"), atMs: 1300, type: "BODY_IN" },
      { id: uid("cue"), atMs: 0, type: "CAMERA", camera: { x: 0, y: 0, scale: 1 } },
      { id: uid("cue"), atMs: 3500, type: "BOSS_SHOW" },
    ],
  };
}

function createCinematic(): Cinematic {
  return {
    id: uid("cinematic"),
    name: "Boss Introduction",
    scenes: [createScene()],
  };
}

function loadLibrary(): Cinematic[] {
  try {
    const raw = localStorage.getItem(CINEMATIC_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLibrary(items: Cinematic[]): void {
  localStorage.setItem(CINEMATIC_STORAGE_KEY, JSON.stringify(items));
}

async function getRoomState(): Promise<RoomState> {
  const metadata = await OBR.room.getMetadata();
  const state = metadata[EXTENSION_ID] as Partial<RoomState> | undefined;
  return {
    boss: state?.boss ?? defaultBoss,
    activeCinematic: state?.activeCinematic ?? null,
  };
}

async function saveBoss(boss: BossData): Promise<void> {
  await OBR.room.setMetadata({
    [EXTENSION_ID]: {
      ...(await getRoomState()),
      boss,
    },
  });
}

async function playCinematic(cinematic: Cinematic): Promise<void> {
  const payload: ActiveCinematic = {
    cinematic,
    startedAt: Date.now(),
    nonce: uid("play"),
    directorId: OBR.player.id,
  };

  const bytes = new TextEncoder().encode(JSON.stringify(payload)).byteLength;
  if (bytes > MAX_ACTIVE_CINEMATIC_BYTES) {
    throw new Error(
      `This cinematic is ${bytes} bytes. Keep the active cinematic below ${MAX_ACTIVE_CINEMATIC_BYTES} bytes.`
    );
  }

  const state = await getRoomState();
  await OBR.room.setMetadata({
    [EXTENSION_ID]: {
      ...state,
      activeCinematic: payload,
      boss: { ...state.boss, visible: false },
    },
  });
}

async function stopCinematic(): Promise<void> {
  const state = await getRoomState();
  await OBR.room.setMetadata({
    [EXTENSION_ID]: {
      ...state,
      activeCinematic: null,
    },
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function sceneCard(scene: CinematicScene, index: number, selected: boolean): string {
  return `
    <button class="scene-card ${selected ? "selected" : ""}" data-scene="${scene.id}">
      <span class="scene-number">${String(index + 1).padStart(2, "0")}</span>
      <span class="scene-card-copy">
        <strong>${escapeHtml(scene.title || "Untitled scene")}</strong>
        <small>${(scene.durationMs / 1000).toFixed(1)}s</small>
      </span>
    </button>
  `;
}

async function initialize(): Promise<void> {
  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) return;

  // The director/editor is GM-only. Players may still receive the cinematic
  // through background.ts, but never get access to the control interface.
  // IMPORTANT: call the SDK method directly. Extracting getRole into a variable can
  // lose its SDK context and leave the popover blank if the call throws.
  let role: "GM" | "PLAYER";
  try {
    role = await OBR.player.getRole();
  } catch (error) {
    console.error("Unable to read Owlbear player role", error);
    app.innerHTML = `
      <main class="gm-shell role-error">
        <div class="panel player-locked-card">
          <div class="brand-mark">!</div>
          <h1>RPG BOSS BAR</h1>
          <p>Unable to verify your Owlbear role. Close and reopen the extension.</p>
        </div>
      </main>`;
    return;
  }

  if (role !== "GM") {
    app.innerHTML = `
      <main class="gm-shell player-locked">
        <div class="panel player-locked-card">
          <div class="brand-mark">☾</div>
          <h1>RPG BOSS BAR</h1>
          <p>The director controls are available to the Game Master only.</p>
        </div>
      </main>`;
    return;
  }

  let library = loadLibrary();
  if (!library.length) {
    library = [createCinematic()];
    saveLibrary(library);
  }

  let selectedCinematicId = library[0].id;
  let selectedSceneId = library[0].scenes[0]?.id ?? "";

  const state = await getRoomState();
  let boss = state.boss;

  app.innerHTML = `
    <main class="gm-shell">
      <header class="topbar">
        <div class="brand">
          <div class="brand-mark">☾</div>
          <div>
            <div class="eyebrow">DARK FANTASY EXTENSION</div>
            <h1>RPG BOSS BAR</h1>
          </div>
        </div>
        <div class="top-actions">
          <button id="import-cinematic" class="ghost">IMPORT</button>
          <button id="export-cinematic" class="ghost">EXPORT</button>
          <button id="new-cinematic" class="accent">+ NEW CINEMATIC</button>
          <input id="import-file" type="file" accept=".json,application/json" hidden />
        </div>
      </header>

      <section class="workspace">
        <aside class="library-panel panel">
          <div class="panel-heading">
            <div>
              <span class="eyebrow">LIBRARY</span>
              <h2>Cinematics</h2>
            </div>
            <span id="library-count" class="badge"></span>
          </div>
          <div id="cinematic-list" class="cinematic-list"></div>
        </aside>

        <section class="editor-panel panel">
          <div class="panel-heading">
            <div>
              <span class="eyebrow">DIRECTOR</span>
              <h2 id="cinematic-title">Cinematic</h2>
            </div>
            <div class="editor-actions">
              <button id="save-cinematic" class="ghost">SAVE</button>
              <button id="delete-cinematic" class="danger">DELETE</button>
            </div>
          </div>

          <div class="cinematic-name-row">
            <label>
              <span>Name</span>
              <input id="cinematic-name" type="text" />
            </label>
            <button id="add-scene" class="accent">+ SCENE</button>
          </div>

          <div class="timeline-overview">
            <div class="section-title">
              <div>
                <span class="eyebrow">MASTER TIMELINE</span>
                <strong>Sequence overview</strong>
              </div>
              <span class="hint">Click a scene to edit its cues.</span>
            </div>
            <div id="master-timeline" class="master-timeline"></div>
          </div>

          <div class="timeline-layout">
            <div id="scene-list" class="scene-list"></div>
            <div class="scene-editor" id="scene-editor"></div>
          </div>

          <div class="playback">
            <div>
              <span class="eyebrow">PLAYBACK</span>
              <strong>Run this cinematic for everyone in the room.</strong>
            </div>
            <div class="playback-actions">
              <button id="stop-cinematic" class="ghost">STOP</button>
              <button id="play-cinematic" class="play">▶ PLAY FOR PLAYERS</button>
            </div>
          </div>
        </section>
      </section>

      <section class="boss-panel panel">
        <div class="panel-heading">
          <div>
            <span class="eyebrow">BOSS CONTROL</span>
            <h2>Boss Bar</h2>
          </div>
          <div id="status" class="status">READY</div>
        </div>

        <div class="boss-grid">
          <label>Name<input id="boss-name" type="text" /></label>
          <label>Current HP<input id="current-hp" type="number" min="0" /></label>
          <label>Max HP<input id="max-hp" type="number" min="1" /></label>
          <label>Color<input id="boss-color" type="color" /></label>
          <div class="boss-buttons">
            <button id="show" class="accent">SHOW BOSS</button>
            <button id="hide" class="ghost">HIDE BOSS</button>
            <button id="damage" class="ghost">−10 HP</button>
            <button id="heal" class="ghost">+10 HP</button>
          </div>
        </div>
      </section>
    </main>
  `;

  const status = document.querySelector<HTMLDivElement>("#status")!;
  const cinematicList = document.querySelector<HTMLDivElement>("#cinematic-list")!;
  const sceneList = document.querySelector<HTMLDivElement>("#scene-list")!;
  const sceneEditor = document.querySelector<HTMLDivElement>("#scene-editor")!;
  const masterTimeline = document.querySelector<HTMLDivElement>("#master-timeline")!;

  const selectedCinematic = (): Cinematic =>
    library.find((c) => c.id === selectedCinematicId) ?? library[0];

  function setStatus(text: string, error = false) {
    status.textContent = text;
    status.classList.toggle("error", error);
    window.setTimeout(() => {
      status.textContent = "READY";
      status.classList.remove("error");
    }, 2200);
  }

  function renderLibrary() {
    cinematicList.innerHTML = library
      .map(
        (c) => `
          <button class="library-item ${c.id === selectedCinematicId ? "selected" : ""}" data-cinematic="${c.id}">
            <span>${escapeHtml(c.name)}</span>
            <small>${c.scenes.length} scene${c.scenes.length === 1 ? "" : "s"}</small>
          </button>
        `
      )
      .join("");
    document.querySelector("#library-count")!.textContent = String(library.length);

    cinematicList.querySelectorAll<HTMLButtonElement>("[data-cinematic]").forEach((button) => {
      button.addEventListener("click", () => {
        selectedCinematicId = button.dataset.cinematic!;
        selectedSceneId = selectedCinematic().scenes[0]?.id ?? "";
        render();
      });
    });
  }

  const cueLabels: Record<CinematicCueType, string> = {
    TITLE_IN: "TITLE IN",
    SUBTITLE_IN: "SUBTITLE IN",
    BODY_IN: "DIALOGUE IN",
    BOSS_SHOW: "BOSS SHOW",
    BOSS_HIDE: "BOSS HIDE",
    BOSS_DAMAGE: "DAMAGE",
    BOSS_HEAL: "HEAL",
    CAMERA: "CAMERA",
  };

  const cueIcons: Record<CinematicCueType, string> = {
    TITLE_IN: "T",
    SUBTITLE_IN: "S",
    BODY_IN: "D",
    BOSS_SHOW: "B",
    BOSS_HIDE: "B",
    BOSS_DAMAGE: "−",
    BOSS_HEAL: "+",
    CAMERA: "⌖",
  };

  function cueColorClass(type: CinematicCueType): string {
    if (type.startsWith("BOSS")) return "cue-boss";
    if (type === "CAMERA") return "cue-camera";
    return "cue-text";
  }

  function renderMasterTimeline() {
    const cinematic = selectedCinematic();
    const total = Math.max(1000, cinematic.scenes.reduce((sum, scene) => sum + Math.max(500, scene.durationMs), 0));
    let offset = 0;

    masterTimeline.innerHTML = cinematic.scenes.map((scene, index) => {
      const duration = Math.max(500, scene.durationMs);
      const left = (offset / total) * 100;
      const width = (duration / total) * 100;
      const selected = scene.id === selectedSceneId;
      const markers = (scene.cues ?? []).map((cue) => {
        const markerLeft = Math.min(100, Math.max(0, cue.atMs / duration * 100));
        return `<span class="overview-cue ${cueColorClass(cue.type)}" style="left:${markerLeft}%" title="${escapeHtml(cueLabels[cue.type])} @ ${(cue.atMs / 1000).toFixed(2)}s">${cueIcons[cue.type]}</span>`;
      }).join("");
      offset += duration;
      return `<button class="timeline-scene ${selected ? "selected" : ""}" data-master-scene="${scene.id}" style="left:${left}%;width:${width}%">
        <span class="timeline-scene-title">${String(index + 1).padStart(2, "0")} · ${escapeHtml(scene.title || "Untitled")}</span>
        <span class="timeline-scene-time">${(duration / 1000).toFixed(1)}s</span>
        <span class="overview-track">${markers}</span>
      </button>`;
    }).join("");

    masterTimeline.querySelectorAll<HTMLButtonElement>("[data-master-scene]").forEach((button) => {
      button.addEventListener("click", () => {
        selectedSceneId = button.dataset.masterScene!;
        renderSceneListOnly();
        renderSceneEditor();
        renderMasterTimeline();
      });
    });
  }

  function cueRow(scene: CinematicScene, cue: CinematicCue): string {
    const camera = cue.camera ?? { x: 0, y: 0, scale: 1 };
    const value = cue.value ?? 10;
    return `
      <div class="cue-row" data-cue="${cue.id}">
        <span class="cue-dot ${cueColorClass(cue.type)}">${cueIcons[cue.type]}</span>
        <select class="cue-type">
          ${Object.entries(cueLabels).map(([type, label]) => `<option value="${type}" ${cue.type === type ? "selected" : ""}>${label}</option>`).join("")}
        </select>
        <label class="cue-time"><span>AT</span><input class="cue-at" type="number" min="0" max="${Math.max(500, scene.durationMs)}" step="50" value="${cue.atMs}" /><span>ms</span></label>
        <label class="cue-value ${cue.type === "BOSS_DAMAGE" || cue.type === "BOSS_HEAL" ? "" : "hidden"}"><span>AMOUNT</span><input class="cue-amount" type="number" min="1" step="1" value="${value}" /></label>
        <label class="cue-camera-fields ${cue.type === "CAMERA" ? "" : "hidden"}"><span>X</span><input class="cue-x" type="number" step="1" value="${camera.x}" /></label>
        <label class="cue-camera-fields ${cue.type === "CAMERA" ? "" : "hidden"}"><span>Y</span><input class="cue-y" type="number" step="1" value="${camera.y}" /></label>
        <label class="cue-camera-fields ${cue.type === "CAMERA" ? "" : "hidden"}"><span>ZOOM</span><input class="cue-scale" type="number" min=".05" step=".05" value="${camera.scale}" /></label>
        <button class="cue-delete danger" type="button">×</button>
      </div>
    `;
  }

  function bindCueRow(scene: CinematicScene, cue: CinematicCue, row: HTMLElement) {
    const typeSelect = row.querySelector<HTMLSelectElement>(".cue-type")!;
    const atInput = row.querySelector<HTMLInputElement>(".cue-at")!;
    const amountInput = row.querySelector<HTMLInputElement>(".cue-amount")!;
    const xInput = row.querySelector<HTMLInputElement>(".cue-x")!;
    const yInput = row.querySelector<HTMLInputElement>(".cue-y")!;
    const scaleInput = row.querySelector<HTMLInputElement>(".cue-scale")!;

    const refresh = () => {
      renderSceneEditor();
      renderMasterTimeline();
    };

    typeSelect.addEventListener("change", () => {
      cue.type = typeSelect.value as CinematicCueType;
      if (cue.type === "CAMERA" && !cue.camera) cue.camera = { x: 0, y: 0, scale: 1 };
      refresh();
    });
    atInput.addEventListener("input", () => {
      cue.atMs = Math.max(0, Math.min(Math.max(500, scene.durationMs), Number(atInput.value) || 0));
      renderMasterTimeline();
    });
    amountInput.addEventListener("input", () => {
      cue.value = Math.max(1, Number(amountInput.value) || 1);
    });
    const updateCameraCue = () => {
      cue.camera = {
        x: Number(xInput.value) || 0,
        y: Number(yInput.value) || 0,
        scale: Math.max(.05, Number(scaleInput.value) || 1),
      };
    };
    xInput.addEventListener("input", updateCameraCue);
    yInput.addEventListener("input", updateCameraCue);
    scaleInput.addEventListener("input", updateCameraCue);
    row.querySelector<HTMLButtonElement>(".cue-delete")!.addEventListener("click", () => {
      scene.cues = scene.cues.filter((item) => item.id !== cue.id);
      refresh();
    });
  }

  function renderCueTimeline(scene: CinematicScene) {
    const timeline = sceneEditor.querySelector<HTMLDivElement>("#cue-timeline")!;
    const duration = Math.max(500, scene.durationMs);
    const cues = [...(scene.cues ?? [])].sort((a, b) => a.atMs - b.atMs);
    timeline.querySelector<HTMLElement>(".cue-track")!.innerHTML = cues.map((cue) => {
      const left = Math.min(100, Math.max(0, cue.atMs / duration * 100));
      return `<button class="cue-marker ${cueColorClass(cue.type)}" style="left:${left}%" title="${escapeHtml(cueLabels[cue.type])}">${cueIcons[cue.type]}</button>`;
    }).join("");
    timeline.querySelectorAll<HTMLButtonElement>(".cue-marker").forEach((button, index) => {
      button.addEventListener("click", () => {
        const rows = timeline.querySelectorAll<HTMLElement>(".cue-row");
        rows[index]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        rows[index]?.classList.add("flash");
        window.setTimeout(() => rows[index]?.classList.remove("flash"), 500);
      });
    });
  }

  function renderSceneEditor() {
    const cinematic = selectedCinematic();
    const scene = cinematic.scenes.find((s) => s.id === selectedSceneId) ?? cinematic.scenes[0];

    if (!scene) {
      sceneEditor.innerHTML = `<div class="empty">Add a scene to begin directing.</div>`;
      return;
    }

    selectedSceneId = scene.id;
    scene.cues ??= [];
    sceneEditor.innerHTML = `
      <div class="editor-scroll">
        <div class="form-section">
          <span class="eyebrow">SCENE ${String(cinematic.scenes.indexOf(scene) + 1).padStart(2, "0")}</span>
          <div class="form-grid">
            <label>Title<input id="scene-title" value="${escapeHtml(scene.title)}" /></label>
            <label>Subtitle<input id="scene-subtitle" value="${escapeHtml(scene.subtitle)}" /></label>
            <label class="full">Dialogue / narration<textarea id="scene-body" rows="4">${escapeHtml(scene.body)}</textarea></label>
            <label>Image URL<input id="scene-image" placeholder="https://..." value="${escapeHtml(scene.imageUrl)}" /></label>
            <label>Background<input id="scene-background" type="color" value="${scene.background}" /></label>
            <label>Duration (sec)<input id="scene-duration" type="number" min="0.5" step="0.5" value="${scene.durationMs / 1000}" /></label>
            <label>Fade in (ms)<input id="scene-fade-in" type="number" min="0" step="50" value="${scene.fadeInMs}" /></label>
            <label>Fade out (ms)<input id="scene-fade-out" type="number" min="0" step="50" value="${scene.fadeOutMs}" /></label>
          </div>
        </div>

        <div class="form-section cue-section">
          <div class="section-title">
            <div>
              <span class="eyebrow">EVENT TIMELINE</span>
              <strong>Control exactly when things happen</strong>
            </div>
            <div class="timeline-actions"><button id="capture-camera" class="ghost">📍 CAPTURE CURRENT CAMERA</button><button id="add-cue" class="accent">+ ADD EVENT</button></div>
          </div>
          <div id="cue-timeline" class="cue-timeline">
            <div class="cue-ruler">
              <span>0s</span><span>${(scene.durationMs / 2000).toFixed(1)}s</span><span>${(scene.durationMs / 1000).toFixed(1)}s</span>
            </div>
            <div class="cue-track"></div>
            <div class="cue-rows">${[...(scene.cues ?? [])].sort((a,b) => a.atMs-b.atMs).map((cue) => cueRow(scene, cue)).join("")}</div>
          </div>
          <p class="hint">Text events reveal the title, subtitle or dialogue. Boss events change the shared Boss Bar. Camera events move every player's viewport.</p>
        </div>

        <div class="form-section">
          <div class="section-title">
            <div>
              <span class="eyebrow">LEGACY CAMERA DEFAULT</span>
              <strong>Optional camera position for the whole scene</strong>
            </div>
          </div>
          <div class="form-grid camera-grid">
            <label>Camera X<input id="camera-x" type="number" step="1" value="${scene.camera?.x ?? 0}" /></label>
            <label>Camera Y<input id="camera-y" type="number" step="1" value="${scene.camera?.y ?? 0}" /></label>
            <label>Zoom<input id="camera-scale" type="number" min="0.05" step="0.05" value="${scene.camera?.scale ?? 1}" /></label>
            <button id="clear-camera" class="ghost">CLEAR CAMERA</button>
          </div>
          <p class="hint">Use map coordinates. The cue is optional; if left cleared, players keep their current view.</p>
        </div>

        <div class="scene-preview" style="background:${scene.background}">
          ${scene.imageUrl ? `<img src="${escapeHtml(scene.imageUrl)}" alt="" />` : ""}
          <div class="preview-vignette"></div>
          <div class="preview-copy">
            <div class="preview-subtitle">${escapeHtml(scene.subtitle)}</div>
            <div class="preview-title">${escapeHtml(scene.title)}</div>
              </div>
        </div>

        <div class="scene-footer">
          <button id="duplicate-scene" class="ghost">DUPLICATE</button>
          <button id="delete-scene" class="danger">DELETE SCENE</button>
        </div>
      </div>
    `;

    const bind = (selector: string, event: string, fn: () => void) => {
      document.querySelector(selector)?.addEventListener(event, fn);
    };

    bind("#scene-title", "input", () => {
      scene.title = (document.querySelector<HTMLInputElement>("#scene-title")!).value;
      renderSceneListOnly();
      renderPreviewOnly();
    });
    bind("#scene-subtitle", "input", () => {
      scene.subtitle = (document.querySelector<HTMLInputElement>("#scene-subtitle")!).value;
      renderPreviewOnly();
    });
    bind("#scene-body", "input", () => {
      scene.body = (document.querySelector<HTMLTextAreaElement>("#scene-body")!).value;
      renderPreviewOnly();
    });
    bind("#scene-image", "input", () => {
      scene.imageUrl = (document.querySelector<HTMLInputElement>("#scene-image")!).value.trim();
      renderPreviewOnly();
    });
    bind("#scene-background", "input", () => {
      scene.background = (document.querySelector<HTMLInputElement>("#scene-background")!).value;
      renderPreviewOnly();
    });
    bind("#scene-duration", "input", () => {
      scene.durationMs = Math.max(500, Number((document.querySelector<HTMLInputElement>("#scene-duration")!).value) * 1000 || 500);
      renderSceneListOnly();
    });
    bind("#scene-fade-in", "input", () => {
      scene.fadeInMs = Math.max(0, Number((document.querySelector<HTMLInputElement>("#scene-fade-in")!).value) || 0);
    });
    bind("#scene-fade-out", "input", () => {
      scene.fadeOutMs = Math.max(0, Number((document.querySelector<HTMLInputElement>("#scene-fade-out")!).value) || 0);
    });
    bind("#camera-x", "input", updateCamera);
    bind("#camera-y", "input", updateCamera);
    bind("#camera-scale", "input", updateCamera);

    document.querySelector<HTMLButtonElement>("#capture-camera")!.addEventListener("click", async () => {
      try {
        const [position, scale] = await Promise.all([OBR.viewport.getPosition(), OBR.viewport.getScale()]);
        scene.cues ??= [];
        const atMs = Math.min(Math.max(0, Math.round(scene.durationMs / 2 / 50) * 50), scene.durationMs);
        scene.cues.push({ id: uid("cue"), atMs, type: "CAMERA", camera: { x: position.x, y: position.y, scale } });
        setStatus(`Camera captured at ${(atMs / 1000).toFixed(2)}s`);
        renderSceneEditor();
        renderMasterTimeline();
      } catch (error) {
        console.error(error);
        setStatus("Could not capture camera.", true);
      }
    });

    document.querySelector<HTMLButtonElement>("#add-cue")!.addEventListener("click", () => {
      scene.cues ??= [];
      scene.cues.push({ id: uid("cue"), atMs: Math.min(1000, Math.max(0, scene.durationMs - 100)), type: "TITLE_IN" });
      renderSceneEditor();
      renderMasterTimeline();
    });

    sceneEditor.querySelectorAll<HTMLElement>(".cue-row").forEach((row) => {
      const cue = scene.cues.find((item) => item.id === row.dataset.cue);
      if (cue) bindCueRow(scene, cue, row);
    });

    renderCueTimeline(scene);

    document.querySelector<HTMLButtonElement>("#clear-camera")!.addEventListener("click", () => {
      delete scene.camera;
      renderSceneEditor();
    });

    document.querySelector<HTMLButtonElement>("#duplicate-scene")!.addEventListener("click", () => {
      const copy = structuredClone(scene);
      copy.id = uid("scene");
      copy.title = `${copy.title} COPY`;
      cinematic.scenes.splice(cinematic.scenes.indexOf(scene) + 1, 0, copy);
      selectedSceneId = copy.id;
      render();
    });

    document.querySelector<HTMLButtonElement>("#delete-scene")!.addEventListener("click", () => {
      if (cinematic.scenes.length <= 1) {
        setStatus("A cinematic needs at least one scene.", true);
        return;
      }
      const index = cinematic.scenes.indexOf(scene);
      cinematic.scenes.splice(index, 1);
      selectedSceneId = cinematic.scenes[Math.max(0, index - 1)].id;
      render();
    });

    function updateCamera() {
      const x = Number((document.querySelector<HTMLInputElement>("#camera-x")!).value);
      const y = Number((document.querySelector<HTMLInputElement>("#camera-y")!).value);
      const scale = Number((document.querySelector<HTMLInputElement>("#camera-scale")!).value);
      if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(scale) && scale > 0) {
        scene.camera = { x, y, scale };
      }
    }
  }

  function renderSceneListOnly() {
    const cinematic = selectedCinematic();
    sceneList.innerHTML = cinematic.scenes.map((s, i) => sceneCard(s, i, s.id === selectedSceneId)).join("");
    sceneList.querySelectorAll<HTMLButtonElement>("[data-scene]").forEach((button) => {
      button.addEventListener("click", () => {
        selectedSceneId = button.dataset.scene!;
        renderSceneEditor();
        renderSceneListOnly();
      });
    });
  }

  function renderPreviewOnly() {
    const cinematic = selectedCinematic();
    const scene = cinematic.scenes.find((s) => s.id === selectedSceneId);
    if (!scene) return;
    const preview = sceneEditor.querySelector<HTMLDivElement>(".scene-preview");
    if (!preview) return;
    preview.style.background = scene.background;
    preview.innerHTML = `
      ${scene.imageUrl ? `<img src="${escapeHtml(scene.imageUrl)}" alt="" />` : ""}
      <div class="preview-vignette"></div>
      <div class="preview-copy">
        <div class="preview-subtitle">${escapeHtml(scene.subtitle)}</div>
        <div class="preview-title">${escapeHtml(scene.title)}</div>
      </div>
    `;
  }

  function renderBossControls() {
    (document.querySelector<HTMLInputElement>("#boss-name")!).value = boss.name;
    (document.querySelector<HTMLInputElement>("#current-hp")!).value = String(boss.currentHp);
    (document.querySelector<HTMLInputElement>("#max-hp")!).value = String(boss.maxHp);
    (document.querySelector<HTMLInputElement>("#boss-color")!).value = boss.color;
  }

  function render() {
    const cinematic = selectedCinematic();
    (document.querySelector<HTMLInputElement>("#cinematic-name")!).value = cinematic.name;
    (document.querySelector<HTMLHeadingElement>("#cinematic-title")!).textContent = cinematic.name;
    renderLibrary();
    renderSceneListOnly();
    renderSceneEditor();
    renderMasterTimeline();
    renderBossControls();
  }

  async function updateBoss(visible?: boolean) {
    const current = Math.max(0, Number((document.querySelector<HTMLInputElement>("#current-hp")!).value) || 0);
    const max = Math.max(1, Number((document.querySelector<HTMLInputElement>("#max-hp")!).value) || 1);
    boss = {
      name: (document.querySelector<HTMLInputElement>("#boss-name")!).value.trim() || "EXAMPLE BOSS",
      currentHp: Math.min(current, max),
      maxHp: max,
      color: (document.querySelector<HTMLInputElement>("#boss-color")!).value,
      visible: visible !== undefined ? visible : boss.visible,
    };
    await saveBoss(boss);
    renderBossControls();
  }

  document.querySelector("#cinematic-name")!.addEventListener("input", () => {
    selectedCinematic().name = (document.querySelector<HTMLInputElement>("#cinematic-name")!).value;
    (document.querySelector("#cinematic-title")!).textContent = selectedCinematic().name;
    renderLibrary();
  });

  document.querySelector("#new-cinematic")!.addEventListener("click", () => {
    const c = createCinematic();
    library.push(c);
    saveLibrary(library);
    selectedCinematicId = c.id;
    selectedSceneId = c.scenes[0].id;
    render();
  });

  document.querySelector("#add-scene")!.addEventListener("click", () => {
    const c = selectedCinematic();
    const s = createScene();
    c.scenes.push(s);
    selectedSceneId = s.id;
    renderSceneListOnly();
    renderSceneEditor();
    renderMasterTimeline();
  });

  document.querySelector("#save-cinematic")!.addEventListener("click", () => {
    saveLibrary(library);
    setStatus("CINEMATIC SAVED");
  });

  document.querySelector("#delete-cinematic")!.addEventListener("click", () => {
    if (library.length <= 1) {
      setStatus("Keep at least one cinematic.", true);
      return;
    }
    library = library.filter((c) => c.id !== selectedCinematicId);
    saveLibrary(library);
    selectedCinematicId = library[0].id;
    selectedSceneId = library[0].scenes[0].id;
    render();
  });

  document.querySelector("#play-cinematic")!.addEventListener("click", async () => {
    try {
      saveLibrary(library);
      await playCinematic(selectedCinematic());
      setStatus("CINEMATIC PLAYING");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not play cinematic.", true);
    }
  });

  document.querySelector("#stop-cinematic")!.addEventListener("click", async () => {
    await stopCinematic();
    setStatus("CINEMATIC STOPPED");
  });

  document.querySelector("#export-cinematic")!.addEventListener("click", () => {
    const data = JSON.stringify(selectedCinematic(), null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedCinematic().name.replace(/[^a-z0-9-_]+/gi, "-").toLowerCase() || "cinematic"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.querySelector("#import-cinematic")!.addEventListener("click", () => {
    document.querySelector<HTMLInputElement>("#import-file")!.click();
  });

  document.querySelector("#import-file")!.addEventListener("change", async (event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text()) as Cinematic;
      if (!parsed || typeof parsed.name !== "string" || !Array.isArray(parsed.scenes)) {
        throw new Error("Invalid cinematic file.");
      }
      parsed.id = uid("cinematic");
      parsed.scenes = parsed.scenes.map((s) => ({ ...s, id: uid("scene") }));
      library.push(parsed);
      saveLibrary(library);
      selectedCinematicId = parsed.id;
      selectedSceneId = parsed.scenes[0]?.id ?? "";
      render();
      setStatus("CINEMATIC IMPORTED");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Import failed.", true);
    } finally {
      input.value = "";
    }
  });

  for (const id of ["show", "hide"]) {
    document.querySelector<HTMLButtonElement>(`#${id}`)!.addEventListener("click", () => updateBoss(id === "show"));
  }
  document.querySelector("#damage")!.addEventListener("click", async () => {
    const input = document.querySelector<HTMLInputElement>("#current-hp")!;
    input.value = String(Math.max(0, Number(input.value) - 10));
    await updateBoss();
  });
  document.querySelector("#heal")!.addEventListener("click", async () => {
    const input = document.querySelector<HTMLInputElement>("#current-hp")!;
    const max = Number(document.querySelector<HTMLInputElement>("#max-hp")!.value) || 1;
    input.value = String(Math.min(max, Number(input.value) + 10));
    await updateBoss();
  });
  ["#boss-name", "#current-hp", "#max-hp", "#boss-color"].forEach((selector) => {
    document.querySelector(selector)!.addEventListener("change", () => updateBoss());
  });

  render();
}

OBR.onReady(() => {
  initialize().catch(console.error);
});
