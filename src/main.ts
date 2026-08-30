import "./style.css";

const boss = {
  name: "Exemple Boss",
  currentHp: 1000,
  maxHp: 1000,
  color: "#8B0000",
};

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div id="boss-container">

    <div id="boss-name">
      ${boss.name}
    </div>

    <div id="boss-bar">
      <div id="boss-hp"></div>
    </div>

  </div>
`;

function updateBossBar() {
  const hpBar = document.querySelector<HTMLDivElement>("#boss-hp");

  if (!hpBar) return;

  const percentage =
    (boss.currentHp / boss.maxHp) * 100;

  hpBar.style.width = `${percentage}%`;
  hpBar.style.backgroundColor = boss.color;
}

updateBossBar();