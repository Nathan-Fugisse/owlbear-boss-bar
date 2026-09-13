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

interface CinematicPath { id:string; tokenId:string; tokenName:string; points:{x:number;y:number}[]; durationMs:number; delayMs:number; }
interface CinematicData { name:string; durationMs:number; transition:string; transitionMs:number; effect:string; effectIntensity:number; overlayColor:string; overlayOpacity:number; title:string; subtitle:string; paths:CinematicPath[]; }
interface RoomState {
  boss?: BossData;
  intro?: IntroData;
  introVisible?: boolean;
  introPhase?: "show" | "fade";
  introStartedAt?: number;
  introPhaseStartedAt?: number;
  cinematic?: CinematicData;
  activeCinematic?: any;
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

      <section id="tab-cinematic" class="tab-content">
        <section class="panel">
          <div class="section-heading">
            <div>
              <h2>SISTEMA DE CINEMÁTICA</h2>
              <p>A introdução do Boss acontece primeiro. Depois dela, esta sequência é executada automaticamente para todos.</p>
            </div>
          </div>
          <div class="grid cinematic-grid">
            <label class="wide">Nome da Cinemática<input id="cin-name" type="text" maxlength="100" /></label>
            <label>Duração<input id="cin-duration" type="number" min="500" max="120000" step="100" /><small>milissegundos</small></label>
            <label>Transição<select id="cin-transition"><option value="FADE">Fade</option><option value="BLACK">Tela preta</option><option value="FLASH">Flash</option><option value="NONE">Nenhuma</option></select></label>
            <label>Tempo da transição<input id="cin-transition-ms" type="number" min="0" max="5000" step="50" /></label>
            <label>Efeito de tela<select id="cin-effect"><option value="NONE">Nenhum</option><option value="SHAKE">Camera Shake</option><option value="GLITCH">Glitch</option><option value="FLASH">Flash</option><option value="VIGNETTE">Vinheta</option><option value="LETTERBOX">Cinema / Letterbox</option></select></label>
            <label>Intensidade<input id="cin-intensity" type="number" min="0" max="100" step="5" /></label>
            <label>Cor da sobreposição<input id="cin-color" type="color" /></label>
            <label>Opacidade<input id="cin-opacity" type="number" min="0" max="100" step="5" /></label>
            <label class="wide">Título da cena<input id="cin-title" type="text" maxlength="100" placeholder="ENTRADA DO CHEFE" /></label>
            <label class="wide">Subtítulo<input id="cin-subtitle" type="text" maxlength="160" placeholder="O campo ficou em silêncio..." /></label>
          </div>
          <div class="actions">
            <button id="cin-save" class="accent">SALVAR CINEMÁTICA</button>
            <button id="cin-play" class="show">TESTAR / EXECUTAR</button>
            <button id="cin-stop" class="danger">PARAR</button>
          </div>
        </section>

        <section class="panel">
          <div class="section-heading"><div><h2>MOVIMENTO DE TOKENS</h2><p>Selecione um token no mapa, clique em <strong>GRAVAR CAMINHO</strong> e marque os pontos no mapa. Duplo clique ou Enter termina.</p></div></div>
          <div class="actions"><button id="cin-record" class="accent">GRAVAR CAMINHO DO TOKEN SELECIONADO</button></div>
          <div id="cin-paths" class="cin-paths"></div>
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

  // ---------------- CINEMATIC ----------------
  const defaultCinematic: CinematicData = { name:"Entrada Cinemática", durationMs:6000, transition:"FADE", transitionMs:800, effect:"NONE", effectIntensity:50, overlayColor:"#000000", overlayOpacity:0, title:"", subtitle:"", paths:[] };
  let cinematic: CinematicData = { ...defaultCinematic, ...(state.cinematic ?? {}), paths: state.cinematic?.paths ?? [] };
  const cName=document.querySelector<HTMLInputElement>("#cin-name")!;
  const cDuration=document.querySelector<HTMLInputElement>("#cin-duration")!;
  const cTransition=document.querySelector<HTMLSelectElement>("#cin-transition")!;
  const cTransitionMs=document.querySelector<HTMLInputElement>("#cin-transition-ms")!;
  const cEffect=document.querySelector<HTMLSelectElement>("#cin-effect")!;
  const cIntensity=document.querySelector<HTMLInputElement>("#cin-intensity")!;
  const cColor=document.querySelector<HTMLInputElement>("#cin-color")!;
  const cOpacity=document.querySelector<HTMLInputElement>("#cin-opacity")!;
  const cTitle=document.querySelector<HTMLInputElement>("#cin-title")!;
  const cSubtitle=document.querySelector<HTMLInputElement>("#cin-subtitle")!;
  const pathsBox=document.querySelector<HTMLDivElement>("#cin-paths")!;
  const renderCinematic=()=>{
    cName.value=cinematic.name;cDuration.value=String(cinematic.durationMs);cTransition.value=cinematic.transition;cTransitionMs.value=String(cinematic.transitionMs);cEffect.value=cinematic.effect;cIntensity.value=String(cinematic.effectIntensity);cColor.value=cinematic.overlayColor;cOpacity.value=String(cinematic.overlayOpacity);cTitle.value=cinematic.title;cSubtitle.value=cinematic.subtitle;
    pathsBox.innerHTML=cinematic.paths.length?cinematic.paths.map((p,i)=>`<div class="cin-path"><div><strong>${escapeHtml(p.tokenName)}</strong><small>${p.points.length} pontos</small></div><label>Duração <input data-path-duration="${p.id}" type="number" min="100" max="120000" step="100" value="${p.durationMs}" /></label><label>Atraso <input data-path-delay="${p.id}" type="number" min="0" max="120000" step="100" value="${p.delayMs}" /></label><button data-path-delete="${p.id}" class="danger">REMOVER</button></div>`).join(""):`<div class="empty">Nenhum caminho gravado ainda.</div>`;
    pathsBox.querySelectorAll<HTMLInputElement>("[data-path-duration]").forEach(input=>input.addEventListener("change",async()=>{const p=cinematic.paths.find(x=>x.id===input.dataset.pathDuration);if(p)p.durationMs=Math.max(100,Number(input.value)||p.durationMs);await saveCinematic();}));
    pathsBox.querySelectorAll<HTMLInputElement>("[data-path-delay]").forEach(input=>input.addEventListener("change",async()=>{const p=cinematic.paths.find(x=>x.id===input.dataset.pathDelay);if(p)p.delayMs=Math.max(0,Number(input.value)||0);await saveCinematic();}));
    pathsBox.querySelectorAll<HTMLButtonElement>("[data-path-delete]").forEach(btn=>btn.addEventListener("click",async()=>{cinematic.paths=cinematic.paths.filter(p=>p.id!==btn.dataset.pathDelete);await saveCinematic();renderCinematic();}));
  };
  const readCinematic=():CinematicData=>({...cinematic,name:cName.value.trim()||"Entrada Cinemática",durationMs:Math.max(500,Math.min(120000,Number(cDuration.value)||6000)),transition:cTransition.value,transitionMs:Math.max(0,Math.min(5000,Number(cTransitionMs.value)||800)),effect:cEffect.value,effectIntensity:Math.max(0,Math.min(100,Number(cIntensity.value)||50)),overlayColor:cColor.value||"#000000",overlayOpacity:Math.max(0,Math.min(100,Number(cOpacity.value)||0)),title:cTitle.value.trim(),subtitle:cSubtitle.value.trim(),paths:cinematic.paths});
  async function saveCinematic(){cinematic=readCinematic();const current=await getState();await saveState({...current,cinematic});status.textContent="CINEMÁTICA SALVA";}
  document.querySelector<HTMLButtonElement>("#cin-save")!.addEventListener("click",()=>void saveCinematic());
  document.querySelector<HTMLButtonElement>("#cin-play")!.addEventListener("click",async()=>{await saveCinematic();const current=await getState();const active={cinematic, introDurationMs:Math.max(1000,Number(current.intro?.durationMs)||4500)+1100, startedAt:Date.now(), nonce:`cin-${Date.now()}-${Math.random().toString(36).slice(2)}`};await saveState({...current,intro:current.intro||defaultIntro,introVisible:true,introPhase:"show",introStartedAt:Date.now(),introPhaseStartedAt:Date.now(),activeCinematic:active});status.textContent="CINEMÁTICA EXECUTANDO";});
  document.querySelector<HTMLButtonElement>("#cin-stop")!.addEventListener("click",async()=>{const current=await getState();await saveState({...current,activeCinematic:null,introVisible:false,introPhase:undefined});status.textContent="CINEMÁTICA PARADA";});
  document.querySelector<HTMLButtonElement>("#cin-record")!.addEventListener("click",async()=>{const selection=await OBR.player.getSelection();if(!selection?.length){status.textContent="SELECIONE UM TOKEN NO MAPA";return;}await OBR.tool.setMetadata("com.nathan.rpg-boss-bar/cinematic-path-tool",{tokenId:selection[0]});await OBR.tool.activateMode("com.nathan.rpg-boss-bar/cinematic-path-tool","com.nathan.rpg-boss-bar/cinematic-path-tool/record");status.textContent="GRAVANDO CAMINHO — MARQUE OS PONTOS NO MAPA";});
  renderCinematic();

  renderIntro();
  renderBoss();
}

OBR.onReady(() => {
  void initialize().catch((error) => console.error("RPG Boss Bar error", error));
});
