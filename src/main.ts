import OBR from "@owlbear-rodeo/sdk";
import "./style.css";

const EXTENSION_ID = "com.nathan.rpg-boss-bar";

interface BossData {
  name: string;
  currentHp: number;
  maxHp: number;
  color: string;
  visible: boolean;
}

interface BossState {
  boss: BossData;
}

const defaultBoss: BossData = {
  name: "EXAMPLE BOSS",
  currentHp: 1000,
  maxHp: 1000,
  color: "#8B0000",
  visible: false,
};

async function getBoss(): Promise<BossData> {
  const metadata = await OBR.room.getMetadata();

  const state = metadata[EXTENSION_ID] as BossState | undefined;

  return state?.boss ?? defaultBoss;
}

async function saveBoss(boss: BossData): Promise<void> {
  await OBR.room.setMetadata({
    [EXTENSION_ID]: {
      boss,
    },
  });
}

async function initialize(): Promise<void> {
  let boss = await getBoss();

  const app = document.querySelector<HTMLDivElement>("#app");

  if (!app) {
    console.error("Elemento #app não encontrado.");
    return;
  }

  app.innerHTML = `
    <div class="panel">

      <h1>RPG BOSS BAR</h1>

      <div class="section">
        <label for="boss-name">Nome do Boss</label>

        <input
          id="boss-name"
          type="text"
          value="${escapeHtml(boss.name)}"
          placeholder="Nome do Boss"
        />
      </div>

      <div class="row">

        <div class="section">
          <label for="current-hp">HP Atual</label>

          <input
            id="current-hp"
            type="number"
            min="0"
            value="${boss.currentHp}"
          />
        </div>

        <div class="section">
          <label for="max-hp">HP Máximo</label>

          <input
            id="max-hp"
            type="number"
            min="1"
            value="${boss.maxHp}"
          />
        </div>

      </div>

      <div class="section">

        <label for="boss-color">
          Cor da Barra
        </label>

        <div class="color-row">

          <input
            id="boss-color"
            type="color"
            value="${boss.color}"
          />

          <span id="color-value">
            ${boss.color}
          </span>

        </div>

      </div>

      <div class="preview">

        <div
          id="preview-name"
          class="preview-name"
        >
          ${escapeHtml(boss.name)}
        </div>

        <div class="preview-bar">

          <div
            id="preview-hp"
            class="preview-hp"
          ></div>

        </div>

      </div>

      <div class="buttons">

        <button id="show">
          MOSTRAR BOSS
        </button>

        <button id="hide">
          OCULTAR BOSS
        </button>

      </div>

      <div class="buttons">

        <button id="damage">
          -10 HP
        </button>

        <button id="heal">
          +10 HP
        </button>

      </div>

    </div>
  `;

  const nameInput =
    document.querySelector<HTMLInputElement>("#boss-name")!;

  const currentHpInput =
    document.querySelector<HTMLInputElement>("#current-hp")!;

  const maxHpInput =
    document.querySelector<HTMLInputElement>("#max-hp")!;

  const colorInput =
    document.querySelector<HTMLInputElement>("#boss-color")!;

  const colorValue =
    document.querySelector<HTMLSpanElement>("#color-value")!;

  const previewHp =
    document.querySelector<HTMLDivElement>("#preview-hp")!;

  const previewName =
    document.querySelector<HTMLDivElement>("#preview-name")!;

  function updatePreview(): void {
    const current =
      Number(currentHpInput.value) || 0;

    const max =
      Math.max(
        1,
        Number(maxHpInput.value) || 1
      );

    const percentage =
      Math.max(
        0,
        Math.min(
          100,
          (current / max) * 100
        )
      );

    previewHp.style.width =
      `${percentage}%`;

    previewHp.style.backgroundColor =
      colorInput.value;

    colorValue.textContent =
      colorInput.value;

    previewName.textContent =
      nameInput.value.trim() ||
      "EXAMPLE BOSS";
  }

  async function updateBoss(
    visible?: boolean
  ): Promise<void> {

    const current =
      Math.max(
        0,
        Number(currentHpInput.value) || 0
      );

    const max =
      Math.max(
        1,
        Number(maxHpInput.value) || 1
      );

    const bossData: BossData = {

      name:
        nameInput.value.trim() ||
        "EXAMPLE BOSS",

      currentHp:
        Math.min(
          current,
          max
        ),

      maxHp:
        max,

      color:
        colorInput.value,

      visible:
        visible !== undefined
          ? visible
          : boss.visible,
    };

    currentHpInput.value =
      String(bossData.currentHp);

    maxHpInput.value =
      String(bossData.maxHp);

    await saveBoss(bossData);

    boss = bossData;

    updatePreview();

    console.log(
      "Boss atualizado:",
      bossData
    );
  }

  nameInput.addEventListener(
    "input",
    updatePreview
  );

  currentHpInput.addEventListener(
    "input",
    updatePreview
  );

  maxHpInput.addEventListener(
    "input",
    updatePreview
  );

  colorInput.addEventListener(
    "input",
    updatePreview
  );

  nameInput.addEventListener(
    "change",
    () => updateBoss()
  );

  currentHpInput.addEventListener(
    "change",
    () => updateBoss()
  );

  maxHpInput.addEventListener(
    "change",
    () => updateBoss()
  );

  colorInput.addEventListener(
    "change",
    () => updateBoss()
  );

  document
    .querySelector<HTMLButtonElement>("#show")!
    .addEventListener(
      "click",
      () => updateBoss(true)
    );

  document
    .querySelector<HTMLButtonElement>("#hide")!
    .addEventListener(
      "click",
      () => updateBoss(false)
    );

  document
    .querySelector<HTMLButtonElement>("#damage")!
    .addEventListener(
      "click",
      async () => {

        const current =
          Math.max(
            0,
            Number(currentHpInput.value) - 10
          );

        currentHpInput.value =
          String(current);

        await updateBoss();
      }
    );

  document
    .querySelector<HTMLButtonElement>("#heal")!
    .addEventListener(
      "click",
      async () => {

        const current =
          Number(currentHpInput.value) || 0;

        const max =
          Number(maxHpInput.value) || 1;

        currentHpInput.value =
          String(
            Math.min(
              max,
              current + 10
            )
          );

        await updateBoss();
      }
    );

  updatePreview();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

OBR.onReady(() => {
  console.log(
    "RPG Boss Bar: painel carregado."
  );

  initialize();
});