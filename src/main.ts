import OBR from "@owlbear-rodeo/sdk";
import "./style.css";

const EXTENSION_ID = "com.nathan.rpg-boss-bar";
const INTRO_STORAGE_KEY = `${EXTENSION_ID}/intro`;

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

interface CameraCue {
  id: string;
  atMs: number;
  x: number;
  y: number;
  scale: number;
  effect: "none" | "shake" | "roar" | "wave" | "impact" | "flash" | "zoom" | "distort";
  intensity: number;
}

interface CinematicConfig {
  durationMs: number;
  transition: "fade" | "flash" | "black" | "none";
  cameraCues: CameraCue[];
}

interface RoomState {
  boss?: BossData;
  intro?: IntroData;
  introVisible?: boolean;
  introPhase?: "show" | "fade";
  introStartedAt?: number;
  introPhaseStartedAt?: number;
  activeCinematic?: unknown;
  cinematicConfig?: CinematicConfig;
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
        <section class="panel cinematic-panel">
          <div class="section-heading">
            <div>
              <div class="eyebrow">DIREÇÃO CINEMATOGRÁFICA</div>
              <h2>EDITOR DE CINEMÁTICA</h2>
              <p>Crie uma sequência de câmera e efeitos. A introdução do Boss acontece primeiro.</p>
            </div>
            <span id="cinematic-route-status">PRONTO</span>
          </div>

          <div class="cinematic-builder">
            <section class="cine-section">
              <div class="cine-section-title"><span class="rune">ᛉ</span><div><h3>PONTOS DE CÂMERA</h3><p>Posicione a visão do GM exatamente onde deseja e marque a cena.</p></div></div>
              <div class="grid cinematic-controls">
                <label>Tempo da cena (ms)<input id="camera-at" type="number" min="0" step="250" value="0" /></label>
                <label>Duração total (ms)<input id="cine-duration" type="number" min="500" step="250" value="7000" /></label>
                <label>Intensidade padrão<input id="cine-intensity" type="range" min="0" max="100" value="65" /></label>
                <label>Efeito<select id="cine-effect"><option value="none">Nenhum</option><option value="roar">Rugido</option><option value="shake">Shake Camera</option><option value="wave">Onda de Som</option><option value="impact">Impacto</option><option value="flash">Flash</option><option value="zoom">Zoom Dramático</option><option value="distort">Distorção</option></select></label>
              </div>
              <div class="actions">
                <button id="camera-mark" class="accent">MARCAR VISÃO ATUAL</button>
                <button id="camera-clear" class="danger">LIMPAR CENAS</button>
              </div>
              <div id="camera-info" class="path-info">Nenhum ponto marcado.</div>
              <div id="camera-list" class="path-list"></div>
            </section>

            <section class="cine-section">
              <div class="cine-section-title"><span class="rune">ᚱ</span><div><h3>TRANSIÇÃO</h3><p>Escolha como a câmera entra na sequência depois da introdução.</p></div></div>
              <div class="grid cinematic-controls">
                <label>Transição<select id="cine-transition"><option value="fade">Fade</option><option value="flash">Flash</option><option value="black">Tela preta</option><option value="none">Nenhuma</option></select></label>
                <label>Duração do efeito (ms)<input id="cine-effect-duration" type="number" min="100" step="100" value="700" /></label>
              </div>
            </section>

            <section class="cine-section cine-execution">
              <div class="cine-section-title"><span class="rune">ᛟ</span><div><h3>EXECUÇÃO</h3><p>Somente o GM controla. Todos os jogadores recebem a mesma sequência.</p></div></div>
              <div class="actions">
                <button id="cine-save" class="accent">SALVAR CINEMÁTICA</button>
                <button id="cine-play" class="show">EXECUTAR CINEMÁTICA</button>
              </div>
            </section>
          </div>
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

  // ---------------- CINEMATIC EDITOR ----------------
  let cameraCues: CameraCue[] = [];
  const cameraAt = document.querySelector<HTMLInputElement>("#camera-at")!;
  const cameraInfo = document.querySelector<HTMLElement>("#camera-info")!;
  const cameraList = document.querySelector<HTMLElement>("#camera-list")!;
  const cineDuration = document.querySelector<HTMLInputElement>("#cine-duration")!;
  const cineEffect = document.querySelector<HTMLSelectElement>("#cine-effect")!;
  const cineIntensity = document.querySelector<HTMLInputElement>("#cine-intensity")!;
  const cineTransition = document.querySelector<HTMLSelectElement>("#cine-transition")!;
  const cineEffectDuration = document.querySelector<HTMLInputElement>("#cine-effect-duration")!;

  function effectLabel(effect: CameraCue["effect"]): string {
    return ({ none:"Nenhum", roar:"Rugido", shake:"Shake Camera", wave:"Onda de Som", impact:"Impacto", flash:"Flash", zoom:"Zoom Dramático", distort:"Distorção" } as Record<string,string>)[effect] ?? effect;
  }

  async function saveCinematicConfig() {
    const state = await getState();
    const config: CinematicConfig = {
      durationMs: Math.max(500, Number(cineDuration.value) || 7000),
      transition: cineTransition.value as CinematicConfig["transition"],
      cameraCues: [...cameraCues].sort((a,b) => a.atMs - b.atMs),
    };
    await saveState({ ...state, cinematicConfig: config } as RoomState & { cinematicConfig: CinematicConfig });
  }

  function renderCameraList() {
    cameraList.innerHTML = cameraCues.length
      ? cameraCues.map((c, i) => `<div class="saved-path cine-cue"><div><strong>${i + 1}. CENA ${String(c.atMs).padStart(4,"0")} ms</strong><small>${effectLabel(c.effect)} · zoom ${c.scale.toFixed(2)}x · intensidade ${c.intensity}%</small></div><button data-remove-camera="${c.id}" class="danger small">REMOVER</button></div>`).join("")
      : '<div class="empty">Nenhuma cena criada. Posicione a visão do GM e marque a primeira.</div>';
    cameraList.querySelectorAll<HTMLButtonElement>("[data-remove-camera]").forEach(btn => btn.addEventListener("click", async () => {
      cameraCues = cameraCues.filter(c => c.id !== btn.dataset.removeCamera);
      await saveCinematicConfig(); renderCameraList();
    }));
  }

  document.querySelector<HTMLButtonElement>("#camera-mark")!.addEventListener("click", async () => {
    const pos = await OBR.viewport.getPosition();
    const scale = await OBR.viewport.getScale();
    const atMs = Math.max(0, Number(cameraAt.value) || 0);
    const cue: CameraCue = {
      id: uid("cam"), atMs, x: pos.x, y: pos.y, scale,
      effect: cineEffect.value as CameraCue["effect"],
      intensity: Math.max(0, Math.min(100, Number(cineIntensity.value) || 65)),
    };
    cameraCues = [...cameraCues.filter(c => c.atMs !== atMs), cue].sort((a,b) => a.atMs-b.atMs);
    cameraInfo.textContent = `Cena marcada em ${atMs} ms · ${effectLabel(cue.effect)}.`;
    await saveCinematicConfig(); renderCameraList();
  });

  document.querySelector<HTMLButtonElement>("#camera-clear")!.addEventListener("click", async () => {
    cameraCues = []; await saveCinematicConfig(); renderCameraList(); cameraInfo.textContent = "Todas as cenas foram removidas.";
  });

  document.querySelector<HTMLButtonElement>("#cine-save")!.addEventListener("click", async () => {
    await saveCinematicConfig(); status.textContent = "CINEMÁTICA SALVA";
  });

  document.querySelector<HTMLButtonElement>("#cine-play")!.addEventListener("click", async () => {
    if (!cameraCues.length) { cameraInfo.textContent = "Marque pelo menos uma cena de câmera."; return; }
    const state = await getState();
    const duration = Math.max(500, Number(cineDuration.value) || 7000);
    const startedAt = Date.now();
    const cinematic = { id: uid("cine"), name: "Cinemática", showBossBar: true, scenes: [{ id: "main", title: "", subtitle: "", body: "", imageUrl: "", background: "#000", durationMs: duration, fadeInMs: 500, fadeOutMs: 500 }] };
    await saveState({
      ...state,
      intro: { ...intro }, introVisible: true, introPhase: "show", introStartedAt: startedAt, introPhaseStartedAt: startedAt,
      activeCinematic: { cinematic, introDurationMs: intro.durationMs, startedAt, nonce: uid("cine"), directorId: "GM" },
      cinematicConfig: { durationMs: duration, transition: cineTransition.value, cameraCues: [...cameraCues].sort((a,b)=>a.atMs-b.atMs) },
    } as RoomState & { cinematicConfig: CinematicConfig; activeCinematic: unknown });
    status.textContent = "CINEMÁTICA INICIADA";
  });

  const cineState = (await getState()) as RoomState & { cinematicConfig?: CinematicConfig };
  if (cineState.cinematicConfig) {
    const cfg = cineState.cinematicConfig;
    cameraCues = Array.isArray(cfg.cameraCues) ? cfg.cameraCues : [];
    cineDuration.value = String(cfg.durationMs || 7000);
    cineTransition.value = cfg.transition || "fade";
  }
  renderCameraList();

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
