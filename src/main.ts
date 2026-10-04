import OBR from "@owlbear-rodeo/sdk";
import "./style.css";

const EXTENSION_ID = "com.nathan.rpg-boss-bar";
const INTRO_STORAGE_KEY = `${EXTENSION_ID}/intro`;
const LANGUAGE_STORAGE_KEY = `${EXTENSION_ID}/language`;

type Language = "pt" | "en" | "es" | "ja";

const LANGUAGES: Record<Language, string> = {
  pt: "Português",
  en: "English",
  es: "Español",
  ja: "日本語",
};

const I18N: Record<Language, Record<string, string>> = {
  pt: {
    controlsGM: "Os controles são exclusivos do Mestre.", ready: "PRONTO", savedIntro: "INTRODUÇÃO SALVA", activeIntro: "INTRODUÇÃO ATIVA", endedIntro: "INTRODUÇÃO ENCERRADA", damage: "DANO", savedBoss: "BOSS SALVO",
    introTab: "INTRODUÇÃO DO BOSS", bossTab: "BOSS BAR", language: "IDIOMA", extension: "EXTENSÃO PARA OWLBEAR RODEO",
    description: "Introdução do Boss e Boss Bar.", introTitle: "INTRODUÇÃO DO BOSS", introHelp: "Configure a apresentação do Boss antes da batalha.", imageUrl: "URL DA IMAGEM", imageHelp: "A imagem é carregada diretamente pela URL e cobre a tela.", bossName: "NOME DO BOSS", subtitle: "SUBTÍTULO", duration: "DURAÇÃO", milliseconds: "milissegundos", background: "FUNDO", save: "SALVAR", showIntro: "MOSTRAR INTRODUÇÃO", hideIntro: "ENCERRAR INTRODUÇÃO", preview: "PRÉ-VISUALIZAÇÃO",
    bossConfig: "CONFIGURAÇÃO DA BOSS BAR", currentHp: "HP ATUAL", currentHpHelp: "Ex.: 200-21 → 179 e gera -21", maxHp: "HP MÁXIMO", color: "COR", showBoss: "MOSTRAR BOSS BAR", hideBoss: "OCULTAR BOSS BAR", bossHelp: "Os jogadores não veem o número do HP. Eles veem apenas o nome, a barra e o dano temporário, como -21.",
    defaultBoss: "EXAMPLE BOSS", defaultIntro: "BUSHI", defaultSubtitle: "O DESTRUIDOR DE ESPÍRITOS", languageSaved: "IDIOMA: Português"
  },
  en: {
    controlsGM: "Controls are available to the Game Master only.", ready: "READY", savedIntro: "INTRO SAVED", activeIntro: "INTRO ACTIVE", endedIntro: "INTRO ENDED", damage: "DAMAGE", savedBoss: "BOSS SAVED",
    introTab: "BOSS INTRO", bossTab: "BOSS BAR", language: "LANGUAGE", extension: "OWLBEAR RODEO EXTENSION", description: "Boss introduction and Boss Bar.", introTitle: "BOSS INTRODUCTION", introHelp: "Configure the Boss presentation before the battle.", imageUrl: "IMAGE URL", imageHelp: "The image is loaded directly from the URL and covers the screen.", bossName: "BOSS NAME", subtitle: "SUBTITLE", duration: "DURATION", milliseconds: "milliseconds", background: "BACKGROUND", save: "SAVE", showIntro: "SHOW INTRODUCTION", hideIntro: "END INTRODUCTION", preview: "PREVIEW",
    bossConfig: "BOSS BAR CONFIGURATION", currentHp: "CURRENT HP", currentHpHelp: "Example: 200-21 → 179 and creates -21", maxHp: "MAX HP", color: "COLOR", showBoss: "SHOW BOSS BAR", hideBoss: "HIDE BOSS BAR", bossHelp: "Players do not see the HP number. They only see the name, bar, and temporary damage such as -21.",
    defaultBoss: "EXAMPLE BOSS", defaultIntro: "BUSHI", defaultSubtitle: "THE SPIRIT DESTROYER", languageSaved: "LANGUAGE: English"
  },
  es: {
    controlsGM: "Los controles son exclusivos del Maestro.", ready: "LISTO", savedIntro: "INTRODUCCIÓN GUARDADA", activeIntro: "INTRODUCCIÓN ACTIVA", endedIntro: "INTRODUCCIÓN FINALIZADA", damage: "DAÑO", savedBoss: "BOSS GUARDADO",
    introTab: "INTRODUCCIÓN DEL BOSS", bossTab: "BOSS BAR", language: "IDIOMA", extension: "EXTENSIÓN PARA OWLBEAR RODEO", description: "Introducción del Boss y Boss Bar.", introTitle: "INTRODUCCIÓN DEL BOSS", introHelp: "Configura la presentación del Boss antes de la batalla.", imageUrl: "URL DE LA IMAGEN", imageHelp: "La imagen se carga directamente desde la URL y cubre la pantalla.", bossName: "NOMBRE DEL BOSS", subtitle: "SUBTÍTULO", duration: "DURACIÓN", milliseconds: "milisegundos", background: "FONDO", save: "GUARDAR", showIntro: "MOSTRAR INTRODUCCIÓN", hideIntro: "TERMINAR INTRODUCCIÓN", preview: "VISTA PREVIA",
    bossConfig: "CONFIGURACIÓN DE LA BOSS BAR", currentHp: "HP ACTUAL", currentHpHelp: "Ej.: 200-21 → 179 y genera -21", maxHp: "HP MÁXIMO", color: "COLOR", showBoss: "MOSTRAR BOSS BAR", hideBoss: "OCULTAR BOSS BAR", bossHelp: "Los jugadores no ven el número de HP. Solo ven el nombre, la barra y el daño temporal, como -21.",
    defaultBoss: "EXAMPLE BOSS", defaultIntro: "BUSHI", defaultSubtitle: "EL DESTRUCTOR DE ESPÍRITUS", languageSaved: "IDIOMA: Español"
  },
  ja: {
    controlsGM: "操作はゲームマスター専用です。", ready: "準備完了", savedIntro: "イントロを保存しました", activeIntro: "イントロ再生中", endedIntro: "イントロを終了しました", damage: "ダメージ", savedBoss: "ボスを保存しました",
    introTab: "ボス登場演出", bossTab: "ボスバー", language: "言語", extension: "OWLBEAR RODEO 拡張機能", description: "ボス登場演出とボスバー。", introTitle: "ボス登場演出", introHelp: "戦闘前のボス登場演出を設定します。", imageUrl: "画像URL", imageHelp: "URLから画像を読み込み、画面全体に表示します。", bossName: "ボス名", subtitle: "サブタイトル", duration: "表示時間", milliseconds: "ミリ秒", background: "背景", save: "保存", showIntro: "登場演出を表示", hideIntro: "登場演出を終了", preview: "プレビュー",
    bossConfig: "ボスバー設定", currentHp: "現在HP", currentHpHelp: "例: 200-21 → 179、-21のダメージ表示", maxHp: "最大HP", color: "色", showBoss: "ボスバーを表示", hideBoss: "ボスバーを非表示", bossHelp: "プレイヤーにはHPの数値を表示せず、名前・バー・一時的なダメージ（例: -21）のみ表示します。",
    defaultBoss: "EXAMPLE BOSS", defaultIntro: "BUSHI", defaultSubtitle: "精霊の破壊者", languageSaved: "言語: 日本語"
  }
};

interface DamageEvent { id: string; amount: number; createdAt: number; }
interface BossData { name: string; currentHp: number; maxHp: number; color: string; visible: boolean; damageEvents: DamageEvent[]; }
interface IntroData { name: string; subtitle: string; imageUrl: string; durationMs: number; background: string; }
interface RoomState { boss?: BossData; intro?: IntroData; introVisible?: boolean; introPhase?: "show" | "fade"; introStartedAt?: number; introPhaseStartedAt?: number; }

const defaultBoss: BossData = { name: "EXAMPLE BOSS", currentHp: 200, maxHp: 200, color: "#8B0000", visible: false, damageEvents: [] };
const defaultIntro: IntroData = { name: "BUSHI", subtitle: "O DESTRUIDOR DE ESPÍRITOS", imageUrl: "", durationMs: 4500, background: "#080808" };

function uid(prefix: string): string { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
function getLanguage(): Language { const value = localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language | null; return value && value in LANGUAGES ? value : "pt"; }
function setLanguage(language: Language): void { localStorage.setItem(LANGUAGE_STORAGE_KEY, language); }
function t(language: Language, key: string): string { return I18N[language][key] ?? I18N.pt[key] ?? key; }
function loadIntro(): IntroData { try { const raw = localStorage.getItem(INTRO_STORAGE_KEY); return raw ? { ...defaultIntro, ...JSON.parse(raw) } : { ...defaultIntro }; } catch { return { ...defaultIntro }; } }
function saveIntroLocal(intro: IntroData): void { localStorage.setItem(INTRO_STORAGE_KEY, JSON.stringify(intro)); }
async function getState(): Promise<RoomState> {
  if (!OBR.isAvailable || !OBR.isReady) throw new Error("Owlbear Rodeo is not ready.");
  const metadata = await OBR.room.getMetadata();
  return (metadata[EXTENSION_ID] as RoomState | undefined) ?? {};
}

function cleanState(state: RoomState): RoomState {
  const clean = JSON.parse(JSON.stringify(state)) as RoomState;
  return clean;
}

async function saveState(state: RoomState): Promise<void> {
  if (!OBR.isAvailable || !OBR.isReady) throw new Error("Owlbear Rodeo is not ready.");

  // Room metadata writes can briefly fail while Owlbear is reconnecting.
  // Retry the same update instead of immediately showing a red error.
  const payload = { [EXTENSION_ID]: cleanState(state) };
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await OBR.room.setMetadata(payload);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 2) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 250 * (attempt + 1)));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Could not update room metadata.");
}
function evaluateHpExpression(raw: string, fallback: number): number {
  const expression = raw.replace(/\s+/g, "");
  if (!expression || !/^[0-9+\-*/().]+$/.test(expression)) return fallback;
  if (/[*/]{2,}|[+\-*/.]$|^[*/.]/.test(expression)) return fallback;
  try { const value = Function(`"use strict"; return (${expression});`)(); return typeof value === "number" && Number.isFinite(value) ? value : fallback; } catch { return fallback; }
}

async function initialize() {
  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) return;
  let language = getLanguage();
  const L = (key: string) => t(language, key);
  const renderLocked = () => {
    document.documentElement.lang = language === "pt" ? "pt-BR" : language;
    app.innerHTML = `<main class="shell locked"><section class="panel locked-card"><h1>RPG BOSS BAR</h1><p>${t(language, "controlsGM")}</p><div class="language-row"><label>${t(language, "language")}<select id="language-select">${Object.entries(LANGUAGES).map(([key,label]) => `<option value="${key}" ${key===language?"selected":""}>${label}</option>`).join("")}</select></label></div></section></main>`;
    document.querySelector<HTMLSelectElement>("#language-select")?.addEventListener("change", (event) => { language = (event.target as HTMLSelectElement).value as Language; setLanguage(language); renderLocked(); });
  };
  if ((await OBR.player.getRole()) !== "GM") { renderLocked(); return; }

  const state = await getState();
  let boss: BossData = { ...defaultBoss, ...(state.boss ?? {}), damageEvents: state.boss?.damageEvents ?? [] };
  let intro: IntroData = { ...defaultIntro, ...(state.intro ?? loadIntro()) };

  const render = () => {
    document.documentElement.lang = language === "pt" ? "pt-BR" : language;
    app.innerHTML = `
      <main class="shell">
        <header><div><div class="eyebrow">${L("extension")}</div><h1>RPG BOSS BAR</h1><p>${L("description")}</p></div><div class="header-tools"><label class="language-picker">${L("language")}<select id="language-select">${Object.entries(LANGUAGES).map(([key,label]) => `<option value="${key}" ${key===language?"selected":""}>${label}</option>`).join("")}</select></label><span id="status">${L("ready")}</span></div></header>
        <nav class="tabs"><button class="tab active" data-tab="intro">${L("introTab")}</button><button class="tab" data-tab="boss">${L("bossTab")}</button></nav>
        <section id="tab-intro" class="tab-content active"><section class="panel"><div class="section-heading"><div><h2>${L("introTitle")}</h2><p>${L("introHelp")}</p></div></div>
          <div class="grid intro-grid"><label class="wide">${L("imageUrl")}<input id="intro-image" type="url" placeholder="https://example.com/boss.jpg"/><small>${L("imageHelp")}</small></label><label>${L("bossName")}<input id="intro-name" type="text" maxlength="100" /></label><label>${L("subtitle")}<input id="intro-subtitle" type="text" maxlength="120" /></label><label>${L("duration")}<input id="intro-duration" type="number" min="1000" max="60000" step="500" /><small>${L("milliseconds")}</small></label><label>${L("background")}<input id="intro-background" type="color" /></label></div>
          <div class="actions"><button id="intro-save" class="accent">${L("save")}</button><button id="intro-show" class="show">${L("showIntro")}</button><button id="intro-hide" class="danger">${L("hideIntro")}</button></div></section>
          <section class="panel"><h2>${L("preview")}</h2><div id="intro-preview" class="intro-preview"><img id="intro-preview-image" alt=""/><div class="preview-vignette"></div><div class="preview-copy"><div id="intro-preview-subtitle" class="preview-subtitle"></div><div id="intro-preview-name" class="preview-title"></div><div class="preview-rule"></div></div></div></section>
        </section>
        <section id="tab-boss" class="tab-content"><section class="panel"><h2>${L("bossConfig")}</h2><div class="grid boss-grid"><label class="wide">${L("bossName")}<input id="boss-name" type="text" maxlength="100" /></label><label>${L("currentHp")}<input id="current-hp" type="text" inputmode="decimal" placeholder="200-21"/><small>${L("currentHpHelp")}</small></label><label>${L("maxHp")}<input id="max-hp" type="number" min="1" step="1" /></label><label>${L("color")}<input id="boss-color" type="color" /></label></div><div class="actions"><button id="boss-save" class="accent">${L("save")}</button><button id="boss-show" class="show">${L("showBoss")}</button><button id="boss-hide" class="danger">${L("hideBoss")}</button></div><p class="help">${L("bossHelp")}</p></section><section class="panel"><h2>${L("preview")}</h2><div class="boss-preview"><div id="preview-boss-name"></div><div class="boss-preview-bar"><div id="preview-boss-hp"></div></div></div></section></section>
      </main>`;
    bind();
  };

  const bind = () => {
    document.querySelector<HTMLSelectElement>("#language-select")!.addEventListener("change", (event) => { language = (event.target as HTMLSelectElement).value as Language; setLanguage(language); render(); });
    document.querySelectorAll<HTMLButtonElement>(".tab").forEach((button) => button.addEventListener("click", () => { document.querySelectorAll(".tab").forEach(b => b.classList.remove("active")); document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active")); button.classList.add("active"); document.querySelector(`#tab-${button.dataset.tab}`)?.classList.add("active"); }));

    const introImage = document.querySelector<HTMLInputElement>("#intro-image")!; const introName = document.querySelector<HTMLInputElement>("#intro-name")!; const introSubtitle = document.querySelector<HTMLInputElement>("#intro-subtitle")!; const introDuration = document.querySelector<HTMLInputElement>("#intro-duration")!; const introBackground = document.querySelector<HTMLInputElement>("#intro-background")!;
    const previewImage = document.querySelector<HTMLImageElement>("#intro-preview-image")!; const previewName = document.querySelector<HTMLDivElement>("#intro-preview-name")!; const previewSubtitle = document.querySelector<HTMLDivElement>("#intro-preview-subtitle")!;
    const renderIntro = () => { introImage.value=intro.imageUrl; introName.value=intro.name; introSubtitle.value=intro.subtitle; introDuration.value=String(intro.durationMs); introBackground.value=intro.background; previewName.textContent=intro.name; previewSubtitle.textContent=intro.subtitle; previewSubtitle.style.display=intro.subtitle?"block":"none"; previewImage.style.display=intro.imageUrl?"block":"none"; previewImage.src=intro.imageUrl; document.querySelector<HTMLElement>("#intro-preview")!.style.background=intro.background; };
    const readIntro = (): IntroData => { const duration=Number(introDuration.value); return { name:introName.value.trim()||t(language,"defaultIntro"), subtitle:introSubtitle.value.trim(), imageUrl:introImage.value.trim(), durationMs:Number.isFinite(duration)?Math.max(1000,Math.min(60000,Math.round(duration))):4500, background:introBackground.value||"#080808" }; };
    [introImage,introName,introSubtitle,introDuration,introBackground].forEach(input=>input.addEventListener("input",()=>{const d=readIntro();previewName.textContent=d.name;previewSubtitle.textContent=d.subtitle;previewSubtitle.style.display=d.subtitle?"block":"none";previewImage.style.display=d.imageUrl?"block":"none";previewImage.src=d.imageUrl;document.querySelector<HTMLElement>("#intro-preview")!.style.background=d.background;}));
    async function saveIntro(show=false){ try { intro=readIntro(); saveIntroLocal(intro); const next=await getState(); const now = Date.now();
      const updated: RoomState = { ...next, boss: next.boss ?? boss, intro, introVisible: show };
      if (show) {
        updated.introPhase = "show";
        updated.introStartedAt = now;
        updated.introPhaseStartedAt = now;
      } else {
        delete updated.introPhase;
        delete updated.introStartedAt;
        delete updated.introPhaseStartedAt;
      }
      await saveState(updated); status(L(show?"activeIntro":"savedIntro")); } catch(error){ console.error(error); await notifyError(error); } }
    document.querySelector<HTMLButtonElement>("#intro-save")!.addEventListener("click",()=>void saveIntro(false)); document.querySelector<HTMLButtonElement>("#intro-show")!.addEventListener("click",()=>void saveIntro(true));
    document.querySelector<HTMLButtonElement>("#intro-hide")!.addEventListener("click",async()=>{try{const current=await getState();if(current.introVisible) {
        await saveState({...current,intro:{...intro},introVisible:true,introPhase:"fade",introPhaseStartedAt:Date.now()});
      } else {
        const updated: RoomState = {...current,intro:{...intro},introVisible:false};
        delete updated.introPhase;
        delete updated.introStartedAt;
        delete updated.introPhaseStartedAt;
        await saveState(updated);
      }status(L("endedIntro"));}catch(error){console.error(error);await notifyError(error);}});

    const bossName=document.querySelector<HTMLInputElement>("#boss-name")!; const currentHp=document.querySelector<HTMLInputElement>("#current-hp")!; const maxHp=document.querySelector<HTMLInputElement>("#max-hp")!; const bossColor=document.querySelector<HTMLInputElement>("#boss-color")!; const previewBossName=document.querySelector<HTMLDivElement>("#preview-boss-name")!; const previewBossHp=document.querySelector<HTMLDivElement>("#preview-boss-hp")!;
    const renderBoss=()=>{bossName.value=boss.name;currentHp.value=String(boss.currentHp);maxHp.value=String(boss.maxHp);bossColor.value=boss.color;previewBossName.textContent=boss.name;const pct=boss.maxHp>0?Math.max(0,Math.min(100,boss.currentHp/boss.maxHp*100)):0;previewBossHp.style.width=`${pct}%`;previewBossHp.style.backgroundColor=boss.color;previewBossHp.style.boxShadow=`0 0 12px ${boss.color}`;};
    const draftBoss=():BossData=>{const max=Math.max(1,Math.round(Number(maxHp.value)||boss.maxHp));const hp=Math.max(0,Math.min(max,Math.round(evaluateHpExpression(currentHp.value,boss.currentHp))));return{name:bossName.value.trim()||t(language,"defaultBoss"),currentHp:hp,maxHp:max,color:bossColor.value||"#8B0000",visible:boss.visible,damageEvents:boss.damageEvents??[]};};
    [bossName,currentHp,maxHp,bossColor].forEach(input=>input.addEventListener("input",()=>{const d=draftBoss();previewBossName.textContent=d.name;const pct=d.maxHp>0?d.currentHp/d.maxHp*100:0;previewBossHp.style.width=`${Math.max(0,Math.min(100,pct))}%`;previewBossHp.style.backgroundColor=d.color;previewBossHp.style.boxShadow=`0 0 12px ${d.color}`;}));
    async function saveBoss(show=boss.visible){try{const oldHp=boss.currentHp;const next=draftBoss();const damage=Math.max(0,oldHp-next.currentHp);if(damage>0)next.damageEvents=[...(boss.damageEvents??[]),{id:uid("damage"),amount:damage,createdAt:Date.now()}].slice(-12);next.visible=show;boss=next;const nextState=await getState();await saveState({...nextState,boss,intro});status(damage>0?`${L("damage")} -${damage}`:L("savedBoss"));}catch(error){console.error(error);await notifyError(error);}}
    document.querySelector<HTMLButtonElement>("#boss-save")!.addEventListener("click",()=>void saveBoss()); document.querySelector<HTMLButtonElement>("#boss-show")!.addEventListener("click",()=>void saveBoss(true)); document.querySelector<HTMLButtonElement>("#boss-hide")!.addEventListener("click",()=>void saveBoss(false));
    renderIntro(); renderBoss();
  };

  const status=(message:string)=>{const el=document.querySelector<HTMLSpanElement>("#status");if(el)el.textContent=message;};
  const notifyError=async(error:unknown)=>{
    console.error("RPG Boss Bar: room update failed", error);
    const message = language === "pt"
      ? "Não foi possível sincronizar com a sala após 3 tentativas. Verifique se o Owlbear está conectado."
      : language === "en"
        ? "The room could not be synchronized after 3 attempts. Check that Owlbear is connected."
        : language === "es"
          ? "No se pudo sincronizar con la sala después de 3 intentos. Comprueba la conexión de Owlbear."
          : "3回試行してもルームと同期できませんでした。Owlbearの接続を確認してください。";
    try { await OBR.notification.show(message, "ERROR"); } catch {}
  };
  render();
}

OBR.onReady(()=>{void initialize().catch(error=>console.error("RPG Boss Bar error",error));});
