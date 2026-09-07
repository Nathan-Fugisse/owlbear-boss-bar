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

interface RoomState {
  boss?: BossData;
}

const defaultBoss: BossData = {
  name: "EXAMPLE BOSS",
  currentHp: 200,
  maxHp: 200,
  color: "#8B0000",
  visible: false,
  damageEvents: [],
};

async function getState(): Promise<RoomState> {
  const metadata = await OBR.room.getMetadata();
  return (metadata[EXTENSION_ID] as RoomState | undefined) ?? {};
}

async function saveBoss(boss: BossData): Promise<void> {
  const state = await getState();
  await OBR.room.setMetadata({
    [EXTENSION_ID]: {
      ...state,
      boss: {
        ...boss,
        damageEvents: (boss.damageEvents ?? []).slice(-12),
      },
    },
  });
}

/**
 * Small, safe arithmetic parser.
 * Supports expressions such as:
 *   200-21
 *   179-15-8
 *   50+10
 *   200/2
 *
 * No variables, functions, letters, or arbitrary JavaScript are allowed.
 */
function evaluateHpExpression(raw: string, fallback: number): number {
  const expression = raw.replace(/\s+/g, "");

  if (!expression) return fallback;

  // Only numbers and + - * / ( ) are accepted.
  if (!/^[0-9+\-*/().]+$/.test(expression)) return fallback;

  // Prevent malformed operator sequences and unsafe constructs.
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
    app.innerHTML = `<main class="shell locked"><section class="panel"><h1>RPG BOSS BAR</h1><p>Os controles são exclusivos do Mestre.</p></section></main>`;
    return;
  }

  app.innerHTML = `
    <main class="shell">
      <header>
        <div>
          <div class="eyebrow">OWLBEAR RODEO EXTENSION</div>
          <h1>RPG BOSS BAR</h1>
          <p>Controle uma Boss Bar sincronizada para todos os jogadores.</p>
        </div>
        <span id="status">PRONTO</span>
      </header>

      <section class="panel controls">
        <h2>CONFIGURAÇÃO DO BOSS</h2>
        <div class="grid">
          <label class="wide">Nome do Boss<input id="boss-name" type="text" maxlength="80" /></label>
          <label>HP Atual
            <input id="current-hp" type="text" inputmode="decimal" autocomplete="off" placeholder="200-21" />
            <small>Ex.: 200-21 → 179</small>
          </label>
          <label>HP Máximo<input id="max-hp" type="number" min="1" step="1" /></label>
          <label>Cor da Barra<input id="boss-color" type="color" /></label>
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
            <div id="preview-value">200</div>
          </div>
          <div class="preview-track"><div id="preview-hp"></div></div>
        </div>
      </section>

      <p class="hint">
        A Boss Bar aparece acima da área inferior da tela para não cobrir os controles do Owlbear.
        O nome fica alinhado à esquerda e o HP atual à direita, no estilo Souls-like.
      </p>
    </main>`;

  const status = document.querySelector<HTMLSpanElement>("#status")!;
  const name = document.querySelector<HTMLInputElement>("#boss-name")!;
  const current = document.querySelector<HTMLInputElement>("#current-hp")!;
  const max = document.querySelector<HTMLInputElement>("#max-hp")!;
  const color = document.querySelector<HTMLInputElement>("#boss-color")!;
  const previewName = document.querySelector<HTMLDivElement>("#preview-name")!;
  const previewHp = document.querySelector<HTMLDivElement>("#preview-hp")!;
  const previewValue = document.querySelector<HTMLDivElement>("#preview-value")!;

  let boss = { ...defaultBoss, ...(await getState()).boss };
  boss.damageEvents = boss.damageEvents ?? [];

  const render = () => {
    name.value = boss.name;
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
    previewValue.textContent = String(boss.currentHp);
  };

  function getInputBoss(visible = boss.visible): BossData {
    const maxHp = readMaxHp(max, boss.maxHp);
    const currentHp = readCurrentHp(current, boss.currentHp, maxHp);

    return {
      name: name.value.trim() || "EXAMPLE BOSS",
      currentHp,
      maxHp,
      color: color.value || "#8B0000",
      visible,
      damageEvents: boss.damageEvents ?? [],
    };
  }

  const updatePreviewFromInputs = () => {
    const maxHp = readMaxHp(max, boss.maxHp);
    const currentHp = readCurrentHp(current, boss.currentHp, maxHp);

    previewName.textContent = name.value.trim() || "EXAMPLE BOSS";
    previewValue.textContent = String(currentHp);

    const percent = Math.max(
      0,
      Math.min(100, (currentHp / maxHp) * 100)
    );

    previewHp.style.width = `${percent}%`;
    previewHp.style.backgroundColor = color.value || "#8B0000";
    previewHp.style.boxShadow = `0 0 12px ${color.value || "#8B0000"}`;
  };

  [name, current, max, color].forEach((input) =>
    input.addEventListener("input", updatePreviewFromInputs)
  );

  async function commit(visible?: boolean) {
    const oldHp = boss.currentHp;
    const next = getInputBoss(visible ?? boss.visible);

    // Only a decrease in HP creates a damage popup.
    const damage = Math.max(0, oldHp - next.currentHp);

    if (damage > 0) {
      const event: DamageEvent = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        amount: damage,
        createdAt: Date.now(),
      };

      next.damageEvents = [...(boss.damageEvents ?? []), event].slice(-12);
    } else {
      // Keep existing recent events. They will disappear automatically by age.
      next.damageEvents = boss.damageEvents ?? [];
    }

    boss = next;
    await saveBoss(boss);
    render();

    status.textContent = boss.visible
      ? damage > 0
        ? `DANO -${damage}`
        : "BOSS BAR ATIVA"
      : "SALVO";
  }

  document.querySelector<HTMLButtonElement>("#save")!
    .addEventListener("click", () => void commit());

  document.querySelector<HTMLButtonElement>("#show")!
    .addEventListener("click", () => void commit(true));

  document.querySelector<HTMLButtonElement>("#hide")!
    .addEventListener("click", () => void commit(false));

  render();
}

OBR.onReady(() => {
  void initialize().catch((error) => {
    console.error("RPG Boss Bar initialization failed", error);
  });
});
