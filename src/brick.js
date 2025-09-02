export class Brick {
  constructor(x, y, w, h, hp=1) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.hp = hp; this.maxHp = hp; this.alive = true;
  }
  hit() { if (!this.alive) return; this.hp--; if (this.hp <= 0) { this.alive = false; } }
  rect() { return { x:this.x, y:this.y, w:this.w, h:this.h }; }
  draw(ctx) {
    if (!this.alive) return;
    const t = this.hp / this.maxHp;
    // 強度で色を変える（簡易グラデ）
    const r = Math.floor(120 + 100*(1-t));
    const g = Math.floor(180 - 100*(1-t));
    const b = Math.floor(220 - 160*(1-t));
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(this.x, this.y, this.w, this.h);
    // HPバー（小さめ）
    if (this.maxHp > 1) {
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.fillRect(this.x, this.y + this.h - 3, this.w, 3);
      ctx.fillStyle = '#fff';
      ctx.fillRect(this.x, this.y + this.h - 3, this.w * t, 3);
    }
  }
}
