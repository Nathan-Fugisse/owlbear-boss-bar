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