import OBR, { buildLine } from "@owlbear-rodeo/sdk";
import "./style.css";

const EXTENSION_ID = "com.nathan.rpg-boss-bar";
const INTRO_STORAGE_KEY = `${EXTENSION_ID}/intro`;
const PATH_TOOL_ID = `${EXTENSION_ID}/path-tool`;
const PATH_MODE_ID = `${EXTENSION_ID}/path-mode`;
const ROUTE_KEY = `${EXTENSION_ID}/patrolRoute`;

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
  damageEvents: DamageEvent[];
}

interface IntroData {
  name: string;
  subtitle: string;
  imageUrl: string;
  durationMs: number;
  background: string;
}

interface PatrolRoute {
  id: string;
  name: string;
  points: { x: number; y: number }[];
  durationMs: number;
  delayMs: number;
  loop: boolean;
  pingPong: boolean;
  rotate: boolean;
}

interface CinematicState {
  patrols?: { tokenId: string; route: PatrolRoute }[];
}

interface RoomState {
  boss?: BossData;
  intro?: IntroData;
  introVisible?: boolean;
  introPhase?: "show" | "fade";
  introStartedAt?: number;
  introPhaseStartedAt?: number;
}

const defaultBoss: BossData = {
  name: "EXAMPLE BOSS",
  currentHp: 200,
  maxHp: 200,
  color: "#8B0000",
  visible: false,
  damageEvents: [],
};

const defaultIntro: IntroData = {
  name: "BUSHI",
  subtitle: "O DESTRUIDOR DE ESPÍRITOS",
  imageUrl: "",
  durationMs: 4500,
  background: "#080808",
};

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadIntro(): IntroData {
  try {
    const raw = localStorage.getItem(INTRO_STORAGE_KEY);
    if (!raw) return { ...defaultIntro };
    return { ...defaultIntro, ...JSON.parse(raw) };
  } catch {
    return { ...defaultIntro };
  }
}

function saveIntroLocal(intro: IntroData): void {
  localStorage.setItem(INTRO_STORAGE_KEY, JSON.stringify(intro));
}

async function getState(): Promise<RoomState> {
  const metadata = await OBR.room.getMetadata();
  return (metadata[EXTENSION_ID] as RoomState | undefined) ?? {};
}

async function saveState(state: RoomState): Promise<void> {
  await OBR.room.setMetadata({
    [EXTENSION_ID]: state,
  });
}

function evaluateHpExpression(raw: string, fallback: number): number {
  const expression = raw.replace(/\s+/g, "");
  if (!expression || !/^[0-9+\-*/().]+$/.test(expression)) return fallback;
  if (/[*/]{2,}|[+\-*/.]$|^[*/.]/.test(expression)) return fallback;

  try {
    const value = Function(`"use strict"; return (${expression});`)();
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function initialize() {
  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) return;

  if ((await OBR.player.getRole()) !== "GM") {
    app.innerHTML = `
      <main class="shell locked">
        <section class="panel locked-card">
          <h1>RPG BOSS BAR</h1>
          <p>Os controles são exclusivos do Mestre.</p>
        </section>
      </main>`;
    return;
  }

  const state = await getState();
  let boss: BossData = {
    ...defaultBoss,
    ...(state.boss ?? {}),
    damageEvents: state.boss?.damageEvents ?? [],
  };
  let intro: IntroData = {
    ...defaultIntro,
    ...(state.intro ?? loadIntro()),
  };

  app.innerHTML = `
    <main class="shell">
      <header>
        <div>
          <div class="eyebrow">OWLBEAR RODEO EXTENSION</div>
          <h1>RPG BOSS BAR</h1>
          <p>Introdução do Boss e Boss Bar, sem sistema de cutscene.</p>
        </div>
        <span id="status">PRONTO</span>
      </header>

      <nav class="tabs">
        <button class="tab active" data-tab="intro">INTRODUÇÃO DO BOSS</button>
        <button class="tab" data-tab="boss">BOSS BAR</button>
        <button class="tab" data-tab="cinematic">CINEMÁTICA</button>
      </nav>

      <section id="tab-intro" class="tab-content active">
        <section class="panel">
          <div class="section-heading">
            <div>
              <h2>INTRODUÇÃO DO BOSS</h2>
              <p>Funciona como a versão antiga: uma imagem por URL ocupa a tela inteira.</p>
            </div>
          </div>

          <div class="grid intro-grid">
            <label class="wide">
              URL da imagem
              <input id="intro-image" type="url" placeholder="https://exemplo.com/imagem-do-boss.jpg" />
              <small>A imagem é carregada diretamente pela URL e cobre a tela.</small>
            </label>

            <label>
              Nome do Boss
              <input id="intro-name" type="text" maxlength="100" />
            </label>

            <label>
              Subtítulo
              <input id="intro-subtitle" type="text" maxlength="120" placeholder="O DESTRUIDOR DE ESPÍRITOS" />
            </label>

            <label>
              Duração
              <input id="intro-duration" type="number" min="1000" max="60000" step="500" />
              <small>milissegundos</small>
            </label>

            <label>
              Fundo
              <input id="intro-background" type="color" />
            </label>
          </div>

          <div class="actions">
            <button id="intro-save" class="accent">SALVAR</button>
            <button id="intro-show" class="show">MOSTRAR INTRODUÇÃO</button>
            <button id="intro-hide" class="danger">ENCERRAR INTRODUÇÃO</button>
          </div>
        </section>

        <section class="panel">
          <h2>PRÉ-VISUALIZAÇÃO</h2>
          <div id="intro-preview" class="intro-preview">
            <img id="intro-preview-image" alt="" />
            <div class="preview-vignette"></div>
            <div class="preview-copy">
              <div id="intro-preview-subtitle" class="preview-subtitle"></div>
              <div id="intro-preview-name" class="preview-title">BUSHI</div>
              <div class="preview-rule"></div>
            </div>
          </div>
        </section>
      </section>

      <section id="tab-cinematic" class="tab-content">
        <section class="panel">
          <div class="section-heading">
            <div>
              <h2>EDITOR DE CINEMÁTICA</h2>
              <p>A cinemática começa automaticamente depois da introdução do Boss.</p>
            </div>
            <span id="cinematic-route-status">NENHUM CAMINHO</span>
          </div>

          <div class="cinematic-builder">
            <div class="path-card">
              <h3>CAMINHO DO TOKEN</h3>
              <p>Selecione um token no mapa e grave um caminho clicando nos pontos por onde ele deve passar.</p>
              <div class="actions">
                <button id="path-start" class="accent">GRAVAR CAMINHO</button>
                <button id="path-finish" class="show">FINALIZAR CAMINHO</button>
                <button id="path-clear" class="danger">LIMPAR</button>
              </div>
              <div class="path-info" id="path-info">Selecione um token no mapa.</div>
            </div>

            <div class="grid">
              <label>Nome do caminho<input id="path-name" type="text" maxlength="60" placeholder="Entrada do Boss" /></label>
              <label>Duração (ms)<input id="path-duration" type="number" min="250" step="250" value="5000" /></label>
              <label>Atraso (ms)<input id="path-delay" type="number" min="0" step="100" value="0" /></label>
              <label>Comportamento
                <select id="path-behavior"><option value="once">Uma vez</option><option value="loop">Repetir</option><option value="pingpong">Ida e volta</option></select>
              </label>
              <label class="check"><input id="path-rotate" type="checkbox" checked /> Girar o token conforme o movimento</label>
            </div>
          </div>
        </section>

        <section class="panel">
          <h2>CAMINHOS SALVOS</h2>
          <div id="path-list" class="path-list"></div>
        </section>

        <section class="panel">
          <h2>EFEITOS</h2>
          <div class="grid">
            <label>Transição
              <select id="cine-transition"><option value="fade">Fade</option><option value="flash">Flash</option><option value="black">Tela preta</option><option value="none">Nenhuma</option></select>
            </label>
            <label>Efeito de tela
              <select id="cine-effect"><option value="none">Nenhum</option><option value="shake">Camera Shake</option><option value="glitch">Glitch</option><option value="flash">Flash</option><option value="vignette">Vinheta</option></select>
            </label>
            <label>Duração do efeito (ms)<input id="cine-effect-duration" type="number" min="100" step="100" value="700" /></label>
          </div>
          <div class="actions"><button id="cine-save" class="accent">SALVAR CONFIGURAÇÃO</button><button id="cine-play" class="show">TESTAR CINEMÁTICA</button></div>
        </section>
      </section>

      <section id="tab-boss" class="tab-content">
        <section class="panel">
          <h2>CONFIGURAÇÃO DA BOSS BAR</h2>
          <div class="grid boss-grid">
            <label class="wide">
              Nome do Boss
              <input id="boss-name" type="text" maxlength="100" />
            </label>

            <label>
              HP Atual
              <input id="current-hp" type="text" inputmode="decimal" placeholder="200-21" />
              <small>Ex.: 200-21 → 179 e gera -21</small>
            </label>

            <label>
              HP Máximo
              <input id="max-hp" type="number" min="1" step="1" />
            </label>

            <label>
              Cor
              <input id="boss-color" type="color" />
            </label>
          </div>

          <div class="actions">
            <button id="boss-save" class="accent">SALVAR</button>
            <button id="boss-show" class="show">MOSTRAR BOSS BAR</button>
            <button id="boss-hide" class="danger">OCULTAR BOSS BAR</button>
          </div>

          <p class="help">
            Os jogadores não veem o número do HP. Eles veem apenas o nome, a barra e o dano temporário,
            como <strong>-21</strong>.
          </p>
        </section>

        <section class="panel">
          <h2>PRÉ-VISUALIZAÇÃO</h2>
          <div class="boss-preview">
            <div id="preview-boss-name">EXAMPLE BOSS</div>
            <div class="boss-preview-bar"><div id="preview-boss-hp"></div></div>
          </div>
        </section>
      </section>
    </main>`;

  const status = document.querySelector<HTMLSpanElement>("#status")!;

  document.querySelectorAll<HTMLButtonElement>(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
      button.classList.add("active");
      document.querySelector(`#tab-${button.dataset.tab}`)?.classList.add("active");
    });
  });

  // ---------------- INTRODUCTION ----------------
  const introImage = document.querySelector<HTMLInputElement>("#intro-image")!;
  const introName = document.querySelector<HTMLInputElement>("#intro-name")!;
  const introSubtitle = document.querySelector<HTMLInputElement>("#intro-subtitle")!;
  const introDuration = document.querySelector<HTMLInputElement>("#intro-duration")!;
  const introBackground = document.querySelector<HTMLInputElement>("#intro-background")!;

  const previewImage = document.querySelector<HTMLImageElement>("#intro-preview-image")!;
  const previewName = document.querySelector<HTMLDivElement>("#intro-preview-name")!;
  const previewSubtitle = document.querySelector<HTMLDivElement>("#intro-preview-subtitle")!;

  const renderIntro = () => {
    introImage.value = intro.imageUrl;
    introName.value = intro.name;
    introSubtitle.value = intro.subtitle;
    introDuration.value = String(intro.durationMs);
    introBackground.value = intro.background;

    previewName.textContent = intro.name;
    previewSubtitle.textContent = intro.subtitle;
    previewSubtitle.style.display = intro.subtitle ? "block" : "none";
    previewImage.style.display = intro.imageUrl ? "block" : "none";
    previewImage.src = intro.imageUrl;
    document.querySelector<HTMLElement>("#intro-preview")!.style.background = intro.background;
  };

  const readIntro = (): IntroData => {
    const duration = Number(introDuration.value);
    return {
      name: introName.value.trim() || "BUSHI",
      subtitle: introSubtitle.value.trim(),
      imageUrl: introImage.value.trim(),
      durationMs: Number.isFinite(duration) ? Math.max(1000, Math.min(60000, Math.round(duration))) : 4500,
      background: introBackground.value || "#080808",
    };
  };

  [introImage, introName, introSubtitle, introDuration, introBackground].forEach((input) => {
    input.addEventListener("input", () => {
      const draft = readIntro();
      previewName.textContent = draft.name;
      previewSubtitle.textContent = draft.subtitle;
      previewSubtitle.style.display = draft.subtitle ? "block" : "none";
      previewImage.style.display = draft.imageUrl ? "block" : "none";
      if (previewImage.src !== draft.imageUrl) previewImage.src = draft.imageUrl;
      document.querySelector<HTMLElement>("#intro-preview")!.style.background = draft.background;
    });
  });

  async function saveIntro(show = false) {
    intro = readIntro();
    saveIntroLocal(intro);

    const nextState = await getState();
    await saveState({
      ...nextState,
      boss: nextState.boss ?? boss,
      intro,
      introVisible: show,
      introPhase: show ? "show" : undefined,
      introStartedAt: show ? Date.now() : undefined,
      introPhaseStartedAt: show ? Date.now() : undefined,
    });

    status.textContent = show ? "INTRODUÇÃO ATIVA" : "INTRODUÇÃO SALVA";
  }

  document.querySelector<HTMLButtonElement>("#intro-save")!
    .addEventListener("click", () => void saveIntro(false));

  document.querySelector<HTMLButtonElement>("#intro-show")!
    .addEventListener("click", () => void saveIntro(true));

  document.querySelector<HTMLButtonElement>("#intro-hide")!
    .addEventListener("click", async () => {
      const currentState = await getState();
      if (currentState.introVisible) {
        await saveState({
          ...currentState,
          intro: { ...intro },
          introVisible: true,
          introPhase: "fade",
          introPhaseStartedAt: Date.now(),
        });
      } else {
        await saveState({ ...currentState, intro: { ...intro }, introVisible: false });
      }
      status.textContent = "INTRODUÇÃO ENCERRADA";
    });

  // ---------------- CINEMATIC PATH EDITOR ----------------
  let recording = false;
  let recordingTokenId = "";
  let recordingPoints: { x: number; y: number }[] = [];
  let localPreviewIds: string[] = [];

  const routeStatus = document.querySelector<HTMLElement>("#cinematic-route-status")!;
  const pathInfo = document.querySelector<HTMLElement>("#path-info")!;
  const pathList = document.querySelector<HTMLElement>("#path-list")!;
  const pathName = document.querySelector<HTMLInputElement>("#path-name")!;
  const pathDuration = document.querySelector<HTMLInputElement>("#path-duration")!;
  const pathDelay = document.querySelector<HTMLInputElement>("#path-delay")!;
  const pathBehavior = document.querySelector<HTMLSelectElement>("#path-behavior")!;
  const pathRotate = document.querySelector<HTMLInputElement>("#path-rotate")!;

  function routeFromDraft(): PatrolRoute {
    return {
      id: uid("route"),
      name: pathName.value.trim() || "Caminho do Token",
      points: recordingPoints.map((p) => ({ ...p })),
      durationMs: Math.max(250, Number(pathDuration.value) || 5000),
      delayMs: Math.max(0, Number(pathDelay.value) || 0),
      loop: pathBehavior.value === "loop",
      pingPong: pathBehavior.value === "pingpong",
      rotate: pathRotate.checked,
    };
  }

  async function getSelectedToken() {
    const ids = (await OBR.player.getSelection()) ?? [];
    if (!ids.length) return null;
    const items = await OBR.scene.items.getItems(ids);
    return items.find((item) => item.layer === "CHARACTER") ?? items[0] ?? null;
  }

  async function clearLocalPreview() {
    if (!localPreviewIds.length) return;
    try { await OBR.scene.local.deleteItems(localPreviewIds); } catch {}
    localPreviewIds = [];
  }

  async function drawPreview() {
    await clearLocalPreview();
    if (recordingPoints.length < 2) return;
    const lines = [];
    for (let i = 1; i < recordingPoints.length; i += 1) {
      const a = recordingPoints[i - 1], b = recordingPoints[i];
      lines.push(buildLine().endPosition(b).position(a).strokeColor("#d9a441").strokeOpacity(0.85).strokeWidth(4).build());
    }
    await OBR.scene.local.addItems(lines);
    localPreviewIds = lines.map((line) => line.id);
  }

  async function setupPathTool() {
    try {
      await OBR.tool.create({
        id: PATH_TOOL_ID,
        icons: [{ icon: "/path.svg", label: "Gravar caminho" }],
        defaultMode: PATH_MODE_ID,
        disabled: { roles: ["PLAYER"] },
      });
    } catch {}
    try {
      await OBR.tool.createMode({
        id: PATH_MODE_ID,
        icons: [{ icon: "/path.svg", label: "Marcar ponto" }],
        cursors: [{ cursor: "crosshair" }],
        disabled: { roles: ["PLAYER"] },
        onToolClick: (_context, event) => {
          if (!recording) return true;
          recordingPoints.push({ ...event.pointerPosition });
          pathInfo.textContent = `${recordingPoints.length} ponto(s) marcado(s)`;
          void drawPreview();
          return false;
        },
        onKeyDown: (_context, event) => {
          if (event.key === "Enter" && recording) void finishPath();
          if (event.key === "Escape" && recording) void cancelPath();
        },
      });
    } catch {}
  }

  async function startPath() {
    const token = await getSelectedToken();
    if (!token) { pathInfo.textContent = "Selecione um token antes de gravar."; return; }
    recording = true;
    recordingTokenId = token.id;
    recordingPoints = [{ ...token.position }];
    routeStatus.textContent = `GRAVANDO: ${token.name || token.id}`;
    pathInfo.textContent = "Clique no mapa para adicionar pontos. Enter finaliza; Esc cancela.";
    await OBR.tool.activateMode(PATH_TOOL_ID, PATH_MODE_ID);
    await drawPreview();
  }

  async function cancelPath() {
    recording = false;
    recordingTokenId = "";
    recordingPoints = [];
    routeStatus.textContent = "NENHUM CAMINHO";
    pathInfo.textContent = "Gravação cancelada.";
    await clearLocalPreview();
  }

  async function finishPath() {
    if (!recording) return;
    if (recordingPoints.length < 2) { pathInfo.textContent = "Marque pelo menos dois pontos."; return; }
    const route = routeFromDraft();
    const tokenId = recordingTokenId;
    await OBR.scene.items.updateItems([tokenId], (items) => {
      for (const item of items) item.metadata[ROUTE_KEY] = route;
    });
    const state = await getState();
    const cinematic: CinematicState = (state as RoomState & { cinematic?: CinematicState }).cinematic ?? {};
    cinematic.patrols = [...(cinematic.patrols ?? []).filter((p) => p.tokenId !== tokenId), { tokenId, route }];
    await saveState({ ...state, cinematic } as RoomState);
    recording = false;
    routeStatus.textContent = "CAMINHO SALVO";
    pathInfo.textContent = `${route.name}: ${route.points.length} pontos.`;
    await clearLocalPreview();
    await renderPathList();
  }

  async function renderPathList() {
    const state = await getState();
    const cinematic: CinematicState = (state as RoomState & { cinematic?: CinematicState }).cinematic ?? {};
    const patrols = cinematic.patrols ?? [];
    pathList.innerHTML = patrols.length ? patrols.map((p) => `
      <div class="saved-path"><div><strong>${escapeHtml(p.route.name)}</strong><small>${p.route.points.length} pontos · ${Math.round(p.route.durationMs / 1000)}s</small></div><button data-remove-route="${p.tokenId}" class="danger small">REMOVER</button></div>`).join("") : '<div class="empty">Nenhum caminho salvo.</div>';
    pathList.querySelectorAll<HTMLButtonElement>("[data-remove-route]").forEach((button) => button.addEventListener("click", async () => {
      const tokenId = button.dataset.removeRoute!;
      const next = await getState();
      const cine: CinematicState = (next as RoomState & { cinematic?: CinematicState }).cinematic ?? {};
      await saveState({ ...next, cinematic: { ...cine, patrols: (cine.patrols ?? []).filter((p) => p.tokenId !== tokenId) } } as RoomState);
      try { await OBR.scene.items.updateItems([tokenId], (items) => { for (const item of items) delete item.metadata[ROUTE_KEY]; }); } catch {}
      await renderPathList();
    }));
  }

  document.querySelector<HTMLButtonElement>("#path-start")!.addEventListener("click", () => void startPath());
  document.querySelector<HTMLButtonElement>("#path-finish")!.addEventListener("click", () => void finishPath());
  document.querySelector<HTMLButtonElement>("#path-clear")!.addEventListener("click", () => void cancelPath());
  document.querySelector<HTMLButtonElement>("#cine-save")!.addEventListener("click", async () => {
    const state = await getState();
    const transition = (document.querySelector<HTMLSelectElement>("#cine-transition")!).value;
    const effect = (document.querySelector<HTMLSelectElement>("#cine-effect")!).value;
    const effectDurationMs = Math.max(100, Number((document.querySelector<HTMLInputElement>("#cine-effect-duration")!).value) || 700);
    await saveState({ ...state, cinematicConfig: { transition, effect, effectDurationMs } } as RoomState);
    status.textContent = "CONFIGURAÇÃO DA CINEMÁTICA SALVA";
  });
  document.querySelector<HTMLButtonElement>("#cine-play")!.addEventListener("click", async () => {
    const state = await getState();
    const cinematic = { id: uid("cine"), name: "Cinemática", showBossBar: true, scenes: [{ id: "main", title: "", subtitle: "", body: "", imageUrl: "", background: "#000", durationMs: 7000, fadeInMs: 500, fadeOutMs: 500 }] };
    const activeCinematic = { cinematic, introDurationMs: intro.durationMs, startedAt: Date.now(), nonce: uid("cine"), directorId: "GM" };
    await saveState({ ...state, intro: { ...intro }, introVisible: true, introPhase: "show", introStartedAt: Date.now(), introPhaseStartedAt: Date.now(), activeCinematic } as RoomState);
    status.textContent = "CINEMÁTICA INICIADA APÓS A INTRODUÇÃO";
  });
  await setupPathTool();
  const cineState = (await getState()) as RoomState & { cinematicConfig?: { transition:string; effect:string; effectDurationMs:number } };
  if (cineState.cinematicConfig) {
    (document.querySelector<HTMLSelectElement>("#cine-transition")!).value = cineState.cinematicConfig.transition || "fade";
    (document.querySelector<HTMLSelectElement>("#cine-effect")!).value = cineState.cinematicConfig.effect || "none";
    (document.querySelector<HTMLInputElement>("#cine-effect-duration")!).value = String(cineState.cinematicConfig.effectDurationMs || 700);
  }
  await renderPathList();

  // ---------------- BOSS BAR ----------------
  const bossName = document.querySelector<HTMLInputElement>("#boss-name")!;
  const currentHp = document.querySelector<HTMLInputElement>("#current-hp")!;
  const maxHp = document.querySelector<HTMLInputElement>("#max-hp")!;
  const bossColor = document.querySelector<HTMLInputElement>("#boss-color")!;

  const previewBossName = document.querySelector<HTMLDivElement>("#preview-boss-name")!;
  const previewBossHp = document.querySelector<HTMLDivElement>("#preview-boss-hp")!;

  const renderBoss = () => {
    bossName.value = boss.name;
    currentHp.value = String(boss.currentHp);
    maxHp.value = String(boss.maxHp);
    bossColor.value = boss.color;
    previewBossName.textContent = boss.name;

    const pct = boss.maxHp > 0 ? Math.max(0, Math.min(100, boss.currentHp / boss.maxHp * 100)) : 0;
    previewBossHp.style.width = `${pct}%`;
    previewBossHp.style.backgroundColor = boss.color;
    previewBossHp.style.boxShadow = `0 0 12px ${boss.color}`;
  };

  const draftBoss = (): BossData => {
    const max = Math.max(1, Math.round(Number(maxHp.value) || boss.maxHp));
    const hp = Math.max(0, Math.min(max, Math.round(evaluateHpExpression(currentHp.value, boss.currentHp))));
    return {
      name: bossName.value.trim() || "EXAMPLE BOSS",
      currentHp: hp,
      maxHp: max,
      color: bossColor.value || "#8B0000",
      visible: boss.visible,
      damageEvents: boss.damageEvents ?? [],
    };
  };

  [bossName, currentHp, maxHp, bossColor].forEach((input) => {
    input.addEventListener("input", () => {
      const draft = draftBoss();
      previewBossName.textContent = draft.name;
      const pct = draft.maxHp > 0 ? draft.currentHp / draft.maxHp * 100 : 0;
      previewBossHp.style.width = `${Math.max(0, Math.min(100, pct))}%`;
      previewBossHp.style.backgroundColor = draft.color;
      previewBossHp.style.boxShadow = `0 0 12px ${draft.color}`;
    });
  });

  async function saveBoss(show = boss.visible) {
    const oldHp = boss.currentHp;
    const next = draftBoss();
    const damage = Math.max(0, oldHp - next.currentHp);

    if (damage > 0) {
      next.damageEvents = [
        ...(boss.damageEvents ?? []),
        { id: uid("damage"), amount: damage, createdAt: Date.now() },
      ].slice(-12);
    }

    next.visible = show;
    boss = next;

    const nextState = await getState();
    await saveState({ ...nextState, boss, intro });
    status.textContent = damage > 0 ? `DANO -${damage}` : "BOSS SALVO";
  }

  document.querySelector<HTMLButtonElement>("#boss-save")!
    .addEventListener("click", () => void saveBoss());

  document.querySelector<HTMLButtonElement>("#boss-show")!
    .addEventListener("click", () => void saveBoss(true));

  document.querySelector<HTMLButtonElement>("#boss-hide")!
    .addEventListener("click", () => void saveBoss(false));

  renderIntro();
  renderBoss();
}

OBR.onReady(() => {
  void initialize().catch((error) => console.error("RPG Boss Bar error", error));
});
