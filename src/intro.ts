import OBR from "@owlbear-rodeo/sdk";

const EXTENSION_ID = "com.nathan.rpg-boss-bar";

interface IntroData {
  name: string;
  subtitle: string;
  imageUrl: string;
  durationMs: number;
  background: string;
}

interface RoomState {
  intro?: IntroData;
  introVisible?: boolean;
}

async function render() {
  const metadata = await OBR.room.getMetadata();
  const state = metadata[EXTENSION_ID] as RoomState | undefined;
  const root = document.getElementById("intro-root")!;
  const image = document.getElementById("intro-image") as HTMLImageElement;
  const subtitle = document.getElementById("intro-subtitle")!;
  const name = document.getElementById("intro-name")!;

  if (!state?.introVisible || !state.intro) {
    root.classList.remove("active");
    return;
  }

  const intro = state.intro;
  root.style.background = intro.background || "#080808";

  if (intro.imageUrl) {
    image.src = intro.imageUrl;
    image.style.display = "block";
  } else {
    image.removeAttribute("src");
    image.style.display = "none";
  }

  subtitle.textContent = intro.subtitle || "";
  subtitle.style.display = intro.subtitle ? "block" : "none";
  name.textContent = intro.name || "BUSHI";

  // Restart the old-style fade every time a new introduction is shown.
  root.classList.remove("active");
  void root.offsetWidth;
  root.classList.add("active");
}

OBR.onReady(() => {
  void render();
  OBR.room.onMetadataChange(() => void render());
});
