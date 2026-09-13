export interface BossData {
  id: string;
  name: string;
  currentHp: number;
  maxHp: number;
  hpColor: string;
  visible: boolean;
}

export interface BossUpdateMessage {
  type: "BOSS_UPDATE";
  boss: BossData;
}

export type CinematicTransition = "FADE" | "BLACK" | "FLASH" | "NONE";
export type CinematicEffect = "NONE" | "SHAKE" | "GLITCH" | "FLASH" | "VIGNETTE" | "LETTERBOX";

export interface CinematicPathPoint {
  x: number;
  y: number;
}

export interface CinematicTokenPath {
  id: string;
  tokenId: string;
  tokenName: string;
  points: CinematicPathPoint[];
  durationMs: number;
  delayMs: number;
}

export interface CinematicData {
  name: string;
  durationMs: number;
  transition: CinematicTransition;
  transitionMs: number;
  effect: CinematicEffect;
  effectIntensity: number;
  overlayColor: string;
  overlayOpacity: number;
  title: string;
  subtitle: string;
  paths: CinematicTokenPath[];
}
