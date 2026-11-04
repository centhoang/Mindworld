// The postcard album (C, or the Album chip): one card at a time over the game, the newest first; left/right flip,
// C/Esc/X close. Drawn as a page element in the game's panel colours (cream card, brown frame, the pixel font).
import type { Card } from "../game/postcard-api";

const SCENE_TITLE: Record<Card["scene"], string> = { win: "A big win", friends: "A new friend", campfire: "By the campfire" };

export class AlbumView {
  private el: HTMLDivElement | null = null;
  private at = 0;
  open = false;

  constructor(private readonly cards: () => readonly Card[]) {}

  toggle(): void {
    if (this.open) this.close();
    else this.show(this.cards().length - 1);
  }

  show(at: number): void {
    const cards = this.cards();
    this.open = true;
    this.at = Math.max(0, Math.min(cards.length - 1, at));
    if (!this.el) {
      this.el = document.createElement("div");
      this.el.id = "album";
      this.el.setAttribute("role", "dialog");
      Object.assign(this.el.style, {
        position: "fixed", inset: "0", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(8,8,12,0.55)", zIndex: "20",
      });
      this.el.addEventListener("pointerdown", (e) => {
        if (e.target === this.el) this.close();
      });
      document.body.appendChild(this.el);
    }
    const card = cards[this.at];
    const font = 'font: 10px "Press Start 2P", monospace; line-height: 1.6;';
    this.el.innerHTML = "";
    const box = document.createElement("div");
    box.style.cssText = `${font} color: #39463F; background: #FFF3D8; border: 4px solid #795849; box-shadow: 0 0 0 4px #A57954; padding: 12px; max-width: min(92vw, 640px); text-align: center;`;
    if (!card) {
      box.textContent = "Your album is empty. Win a fight, make a friend, or sit by the campfire in the evening: a postcard may come.";
    } else {
      const img = document.createElement("img");
      img.src = card.img;
      img.alt = card.caption;
      img.style.cssText = "display: block; width: 100%; height: auto; border: 2px solid #795849; margin-bottom: 8px; background: #A57954;";
      const title = document.createElement("div");
      title.textContent = `${SCENE_TITLE[card.scene]} - day ${card.day + 1}`;
      title.style.color = "#795849";
      const cap = document.createElement("div");
      cap.textContent = card.caption;
      const nav = document.createElement("div");
      nav.textContent = `${this.at + 1}/${cards.length}  < > flip  C close  - painted by Muse Image`;
      nav.style.cssText = "font-size: 7px; color: #A57954; margin-top: 6px;";
      box.append(img, title, cap, nav);
    }
    this.el.appendChild(box);
  }

  close(): void {
    this.open = false;
    this.el?.remove();
    this.el = null;
  }

  // Keys while the album is open. True = the key was the album's.
  key(k: string): boolean {
    if (!this.open) return false;
    if (k === "arrowleft" || k === "a") this.show(this.at - 1);
    else if (k === "arrowright" || k === "d") this.show(this.at + 1);
    else if (k === "c" || k === "escape" || k === "x") this.close();
    return true;
  }
}
