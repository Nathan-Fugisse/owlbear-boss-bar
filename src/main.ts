import OBR from "@owlbear-rodeo/sdk";

const NS = "com.nathan.rpg-boss-bar";
const STATE_KEY = `${NS}/state`;

type CameraCue = {
  id: string;
  name: string;
  x: number;
  y: number;
  scale: number;
  duration: number;
  effect: string;
  intensity: number;
};

type CineState = {
  active?: {
    id: string;
    startedAt: number;
    introDurationMs: number;
    durationMs: number;
  };
  cues: CameraCue[];
};

const defaultState: CineState = { cues: [] };

async function getState(): Promise<CineState> {
  const meta = await OBR.room.getMetadata();
  return (meta[STATE_KEY] as CineState) ?? defaultState;
}

async function setState(state: CineState) {
  await OBR.room.setMetadata({ [STATE_KEY]: state });
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]!));
}

function cameraEffectOptions(selected: string) {
  const effects = [
    ["none", "Nenhum"],
    ["shake", "Shake Camera"],
    ["roar", "Rugido"],
    ["impact", "Impacto"],
    ["wave", "Onda de Som"],
    ["flash", "Flash"],
    ["zoom", "Zoom Dramático"],
    ["distort", "Distorção"],
  ];
  return effects.map(([v, n]) => `<option value="${v}" ${v === selected ? "selected" : ""}>${n}</option>`).join("");
}

function render(state: CineState) {
  const app = document.querySelector<HTMLDivElement>("#app")!;
  app.innerHTML = `
    <div class="panel">
      <div class="tabs">
        <button class="tab active">BOSS BAR</button>
        <button class="tab">INTRODUÇÃO</button>
        <button class="tab active-cine">CINEMÁTICA</button>
      </div>

      <section class="cine">
        <h2>EDITOR DE CINEMÁTICA</h2>
        <p class="hint">Marque pontos do mapa usando a visão atual do GM e adicione efeitos de câmera. Tudo é executado para os jogadores.</p>

        <div class="card">
          <h3>Ponto de câmera</h3>
          <button id="mark-camera" class="primary">MARCAR VISÃO ATUAL</button>
          <p class="small">O ponto usa exatamente a posição e o zoom atuais da câmera do GM.</p>
        </div>

        <div class="card">
          <h3>Biblioteca de efeitos</h3>
          <div class="effect-grid">
            <button data-effect="roar">RUGIDO</button>
            <button data-effect="shake">SHAKE CAMERA</button>
            <button data-effect="wave">ONDA DE SOM</button>
            <button data-effect="impact">IMPACTO</button>
            <button data-effect="flash">FLASH</button>
            <button data-effect="zoom">ZOOM DRAMÁTICO</button>
            <button data-effect="distort">DISTORÇÃO</button>
          </div>
        </div>

        <div class="card">
          <h3>Pontos salvos</h3>
          <div id="cues">
            ${state.cues.length ? state.cues.map((c, i) => `
              <div class="cue">
                <div>
                  <strong>${i + 1}. ${esc(c.name)}</strong>
                  <span>${c.duration} ms · ${c.effect}</span>
                </div>
                <button data-delete="${c.id}">REMOVER</button>
              </div>`).join("") : `<div class="empty">Nenhum ponto criado.</div>`}
          </div>
        </div>

        <div class="card">
          <h3>Execução</h3>
          <label>Duração da transição
            <input id="default-duration" type="number" min="100" step="100" value="1200">
          </label>
          <label>Intensidade do efeito
            <input id="default-intensity" type="range" min="0" max="100" value="65">
          </label>
          <div class="actions">
            <button id="save-config">SALVAR CONFIGURAÇÃO</button>
            <button id="play" class="primary">TESTAR CINEMÁTICA</button>
          </div>
        </div>
      </section>
    </div>
  `;

  document.querySelector("#mark-camera")?.addEventListener("click", async () => {
    const vp = await OBR.viewport.getViewport();
    const duration = Number((document.querySelector("#default-duration") as HTMLInputElement).value) || 1200;
    const intensity = Number((document.querySelector("#default-intensity") as HTMLInputElement).value) || 65;
    const effect = (document.querySelector("[data-effect].selected") as HTMLElement)?.dataset.effect ?? "none";

    const cue: CameraCue = {
      id: crypto.randomUUID(),
      name: `Cena ${state.cues.length + 1}`,
      x: vp.position.x,
      y: vp.position.y,
      scale: vp.scale,
      duration,
      effect,
      intensity
    };
    state.cues.push(cue);
    await setState(state);
    render(state);
  });

  document.querySelectorAll<HTMLButtonElement>("[data-effect]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-effect]").forEach(x => x.classList.remove("selected"));
      btn.classList.add("selected");
      const input = document.querySelector<HTMLInputElement>("#default-intensity");
      if (input && btn.dataset.effect === "roar") input.value = "80";
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-delete]").forEach(btn => {
    btn.addEventListener("click", async () => {
      state.cues = state.cues.filter(c => c.id !== btn.dataset.delete);
      await setState(state);
      render(state);
    });
  });

  document.querySelector("#play")?.addEventListener("click", async () => {
    if (!state.cues.length) {
      alert("Marque pelo menos um ponto de câmera.");
      return;
    }
    const duration = state.cues.reduce((sum, c) => sum + c.duration, 0);
    state.active = {
      id: crypto.randomUUID(),
      startedAt: Date.now(),
      introDurationMs: 3000,
      durationMs: duration
    };
    await setState(state);
  });
}

async function init() {
  await OBR.onReady(async () => {
    if ((await OBR.player.getRole()) !== "GM") {
      document.querySelector("#app")!.innerHTML = `<div class="panel"><h2>CINEMÁTICA</h2><p>Somente o Mestre pode editar e executar a cinemática.</p></div>`;
      return;
    }
    render(await getState());
  });
}

init();
