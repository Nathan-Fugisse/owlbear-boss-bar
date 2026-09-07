import OBR from "@owlbear-rodeo/sdk";
import "./style.css";

const EXTENSION_ID = "com.nathan.rpg-boss-bar";

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
  damageEvents?: DamageEvent[];
}

interface IntroData {
  visible: boolean;
  name: string;
  subtitle: string;
  duration: number;
  color: string;
}

interface RoomState {
  boss?: BossData;
  intro?: IntroData;
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
  visible: false,
  name: "REI DO GADO",
  subtitle: "",
  duration: 8,
  color: "#8B0000",
};

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
  if (!expression) return fallback;

  if (!/^[0-9+\-*/().]+$/.test(expression)) return fallback;
  if (/[*/]{2,}|[+\-*/.]$|^[*/.]/.test(expression)) return fallback;

  try {
    const value = Function(`"use strict"; return (${expression});`)();
    if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
    return value;
  } catch {
    return fallback;
  }
}

function readMaxHp(input: HTMLInputElement, fallback: number): number {
  const value = Number(input.value);
  return Number.isFinite(value) && value > 0
    ? Math.max(1, Math.round(value))
    : fallback;
}

function readCurrentHp(
  input: HTMLInputElement,
  fallback: number,
  maxHp: number
): number {
  const value = evaluateHpExpression(input.value, fallback);
  return Math.max(0, Math.min(maxHp, Math.round(value)));
}

async function initialize() {
  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) return;

  const role = await OBR.player.getRole();

  if (role !== "GM") {
    app.innerHTML = `
      <main class="shell locked">
        <section class="panel">
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
    ...(state.intro ?? {}),
  };

  app.innerHTML = `
    <main class="shell">
      <header>
        <div>
          <div class="eyebrow">OWLBEAR RODEO EXTENSION</div>
          <h1>RPG BOSS BAR</h1>
          <p>Introdução dramática + Boss Bar sincronizadas para todos os jogadores.</p>
        </div>
        <span id="status">PRONTO</span>
      </header>

      <nav class="tabs" aria-label="Configurações">
        <button class="tab active" data-tab="intro">INTRODUÇÃO DO BOSS</button>
        <button class="tab" data-tab="boss">BOSS BAR</button>
      </nav>

      <section id="tab-intro" class="tab-content active">
        <section class="panel">
          <div class="section-title">
            <div>
              <h2>APRESENTAÇÃO DO BOSS</h2>
              <p>Uma tela dramática em tela cheia, inspirada na referência Souls-like.</p>
            </div>
            <span class="badge">TELA DOS JOGADORES</span>
          </div>

          <div class="grid intro-grid">
            <label class="wide">
              Nome do Boss
              <input id="intro-name" type="text" maxlength="80" />
            </label>

            <label class="wide">
              Subtítulo / Título
              <input id="intro-subtitle" type="text" maxlength="100" placeholder="O DESTRUIDOR DE ESPÍRITOS" />
            </label>

            <label>
              Duração (segundos)
              <input id="intro-duration" type="number" min="1" max="60" step="1" />
            </label>

            <label>
              Cor da barra
              <input id="intro-color" type="color" />
            </label>
          </div>

          <div class="actions">
            <button id="intro-save" class="accent">SALVAR INTRODUÇÃO</button>
            <button id="intro-show">MOSTRAR INTRODUÇÃO</button>
            <button id="intro-hide" class="danger">OCULTAR</button>
          </div>
        </section>

        <section class="panel">
          <h2>PRÉ-VISUALIZAÇÃO</h2>
          <div class="intro-preview">
            <div class="intro-preview-center">
              <div id="intro-preview-subtitle" class="intro-subtitle">O DESTRUIDOR DE ESPÍRITOS</div>
              <div id="intro-preview-name" class="intro-name">REI DO GADO</div>
            </div>
            <div class="intro-preview-bottom">
              <div id="intro-preview-name-bottom">REI DO GADO</div>
              <div class="intro-preview-line">
                <div id="intro-preview-bar"></div>
              </div>
            </div>
          </div>
        </section>

        <p class="hint">
          Ao clicar em <strong>MOSTRAR INTRODUÇÃO</strong>, a tela aparece para todos os jogadores,
          permanece pelo tempo definido e desaparece automaticamente. Ela é independente da Boss Bar.
        </p>
      </section>

      <section id="tab-boss" class="tab-content">
        <section class="panel controls">
          <h2>CONFIGURAÇÃO DA BOSS BAR</h2>
          <div class="grid">
            <label class="wide">
              Nome do Boss
              <input id="boss-name" type="text" maxlength="80" />
            </label>

            <label>
              HP Atual
              <input id="current-hp" type="text" inputmode="decimal" autocomplete="off" placeholder="200-21" />
              <small>Ex.: 200-21 → 179</small>
            </label>

            <label>
              HP Máximo
              <input id="max-hp" type="number" min="1" step="1" />
            </label>

            <label>
              Cor da Barra
              <input id="boss-color" type="color" />
            </label>
          </div>

          <div class="actions">
            <button id="save" class="accent">SALVAR</button>
            <button id="show">MOSTRAR BOSS BAR</button>
            <button id="hide" class="danger">OCULTAR</button>
          </div>

          <p class="damage-help">
            Quando o HP atual diminuir, a diferença é calculada automaticamente como dano.
            Ex.: <strong>200-21</strong> gera <strong>-21</strong> na tela de todos os jogadores por alguns instantes.
          </p>
        </section>

        <section class="panel preview-panel">
          <h2>PRÉ-VISUALIZAÇÃO</h2>
          <div class="preview">
            <div class="preview-header">
              <div id="preview-name">EXAMPLE BOSS</div>
            </div>
            <div class="preview-track"><div id="preview-hp"></div></div>
          </div>
        </section>

        <p class="hint">
          A Boss Bar fica fora da área da extensão, acompanha a tela de cada jogador e foi elevada
          para reduzir conflitos com os controles do Owlbear. O valor numérico do HP não aparece para os jogadores.
        </p>
      </section>
    </main>`;

  const status = document.querySelector<HTMLSpanElement>("#status")!;

  // Tabs
  document.querySelectorAll<HTMLButtonElement>(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.tab;
      document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
      button.classList.add("active");
      document.querySelector(`#tab-${tab}`)?.classList.add("active");
    });
  });

  // Intro controls
  const introName = document.querySelector<HTMLInputElement>("#intro-name")!;
  const introSubtitle = document.querySelector<HTMLInputElement>("#intro-subtitle")!;
  const introDuration = document.querySelector<HTMLInputElement>("#intro-duration")!;
  const introColor = document.querySelector<HTMLInputElement>("#intro-color")!;

  const introPreviewName = document.querySelector<HTMLDivElement>("#intro-preview-name")!;
  const introPreviewSubtitle = document.querySelector<HTMLDivElement>("#intro-preview-subtitle")!;
  const introPreviewBottomName = document.querySelector<HTMLDivElement>("#intro-preview-name-bottom")!;
  const introPreviewBar = document.querySelector<HTMLDivElement>("#intro-preview-bar")!;

  const renderIntro = () => {
    introName.value = intro.name;
    introSubtitle.value = intro.subtitle;
    introDuration.value = String(intro.duration);
    introColor.value = intro.color;

    introPreviewName.textContent = intro.name || "REI DO GADO";
    introPreviewBottomName.textContent = intro.name || "REI DO GADO";
    introPreviewSubtitle.textContent = intro.subtitle || "";
    introPreviewSubtitle.style.display = intro.subtitle ? "block" : "none";
    introPreviewBar.style.backgroundColor = intro.color;
    introPreviewBar.style.boxShadow = `0 0 12px ${intro.color}`;
  };

  const readIntro = (visible = intro.visible): IntroData => {
    const durationValue = Number(introDuration.value);
    return {
      visible,
      name: introName.value.trim() || "REI DO GADO",
      subtitle: introSubtitle.value.trim(),
      duration: Number.isFinite(durationValue)
        ? Math.max(1, Math.min(60, Math.round(durationValue)))
        : intro.duration,
      color: introColor.value || "#8B0000",
    };
  };

  const updateIntroPreview = () => {
    const draft = readIntro();
    introPreviewName.textContent = draft.name;
    introPreviewBottomName.textContent = draft.name;
    introPreviewSubtitle.textContent = draft.subtitle;
    introPreviewSubtitle.style.display = draft.subtitle ? "block" : "none";
    introPreviewBar.style.backgroundColor = draft.color;
    introPreviewBar.style.boxShadow = `0 0 12px ${draft.color}`;
  };

  [introName, introSubtitle, introDuration, introColor].forEach((input) =>
    input.addEventListener("input", updateIntroPreview)
  );

  async function commitIntro(visible?: boolean) {
    intro = readIntro(visible ?? intro.visible);
    await saveState({ boss, intro });
    status.textContent = intro.visible ? "INTRODUÇÃO ATIVA" : "INTRODUÇÃO SALVA";
  }

  document.querySelector<HTMLButtonElement>("#intro-save")!
    .addEventListener("click", () => void commitIntro());

  document.querySelector<HTMLButtonElement>("#intro-show")!
    .addEventListener("click", () => void commitIntro(true));

  document.querySelector<HTMLButtonElement>("#intro-hide")!
    .addEventListener("click", () => void commitIntro(false));

  // Boss controls
  const bossName = document.querySelector<HTMLInputElement>("#boss-name")!;
  const current = document.querySelector<HTMLInputElement>("#current-hp")!;
  const max = document.querySelector<HTMLInputElement>("#max-hp")!;
  const color = document.querySelector<HTMLInputElement>("#boss-color")!;

  const previewName = document.querySelector<HTMLDivElement>("#preview-name")!;
  const previewHp = document.querySelector<HTMLDivElement>("#preview-hp")!;

  const renderBoss = () => {
    bossName.value = boss.name;
    current.value = String(boss.currentHp);
    max.value = String(boss.maxHp);
    color.value = boss.color;

    previewName.textContent = boss.name || "EXAMPLE BOSS";

    const percent =
      boss.maxHp > 0
        ? Math.max(0, Math.min(100, (boss.currentHp / boss.maxHp) * 100))
        : 0;

    previewHp.style.width = `${percent}%`;
    previewHp.style.backgroundColor = boss.color;
    previewHp.style.boxShadow = `0 0 12px ${boss.color}`;
  };

  const getInputBoss = (visible = boss.visible): BossData => {
    const maxHp = readMaxHp(max, boss.maxHp);
    const currentHp = readCurrentHp(current, boss.currentHp, maxHp);

    return {
      name: bossName.value.trim() || "EXAMPLE BOSS",
      currentHp,
      maxHp,
      color: color.value || "#8B0000",
      visible,
      damageEvents: boss.damageEvents ?? [],
    };
  };

  [bossName, current, max, color].forEach((input) =>
    input.addEventListener("input", () => {
      const draft = getInputBoss();
      previewName.textContent = draft.name;
      const percent = Math.max(0, Math.min(100, (draft.currentHp / draft.maxHp) * 100));
      previewHp.style.width = `${percent}%`;
      previewHp.style.backgroundColor = draft.color;
      previewHp.style.boxShadow = `0 0 12px ${draft.color}`;
    })
  );

  async function commitBoss(visible?: boolean) {
    const oldHp = boss.currentHp;
    const next = getInputBoss(visible ?? boss.visible);
    const damage = Math.max(0, oldHp - next.currentHp);

    if (damage > 0) {
      next.damageEvents = [
        ...(boss.damageEvents ?? []),
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          amount: damage,
          createdAt: Date.now(),
        },
      ].slice(-12);
    } else {
      next.damageEvents = boss.damageEvents ?? [];
    }

    boss = next;
    await saveState({ boss, intro });
    renderBoss();

    status.textContent = boss.visible
      ? damage > 0 ? `DANO -${damage}` : "BOSS BAR ATIVA"
      : "SALVO";
  }

  document.querySelector<HTMLButtonElement>("#save")!
    .addEventListener("click", () => void commitBoss());

  document.querySelector<HTMLButtonElement>("#show")!
    .addEventListener("click", () => void commitBoss(true));

  document.querySelector<HTMLButtonElement>("#hide")!
    .addEventListener("click", () => void commitBoss(false));

  renderIntro();
  renderBoss();
}

OBR.onReady(() => {
  void initialize().catch((error) => {
    console.error("RPG Boss Bar initialization failed", error);
  });
});
