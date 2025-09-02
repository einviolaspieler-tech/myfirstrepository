function shade(hex, amt) {
  const n = hex.startsWith('#') ? hex.slice(1) : hex;
  const num = parseInt(n,16);
  const r = Math.min(255, Math.max(0, (num>>16) + amt));
  const g = Math.min(255, Math.max(0, ((num>>8)&0xff) + amt));
  const b = Math.min(255, Math.max(0, (num&0xff) + amt));
  return `rgb(${r},${g},${b})`;
}

export class Brick {
  constructor(x, y, w, h, hp=1, colorIndex=0, base='#6cc6ff') {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.hp = hp; this.maxHp = hp; this.alive = true;
    this.colorIndex = colorIndex;
    this.base = base; // ベース色
  }
  hit() { if (!this.alive) return; this.hp--; if (this.hp <= 0) this.alive = false; }
  rect() { return { x:this.x, y:this.y, w:this.w, h:this.h }; }
  draw(ctx) {
    if (!this.alive) return;

    // HPで明度を少し調整
    const t = this.hp / this.maxHp;
    const base = this.base;
    const topCol = shade(base, +Math.floor(40 * t));   // 明るい天面
    const midCol = shade(base, 0);
    const botCol = shade(base, -40);                   // 影

    // グラデーション本体
    const grd = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.h);
    grd.addColorStop(0, topCol);
    grd.addColorStop(0.55, midCol);
    grd.addColorStop(1, botCol);

    // 本体
    ctx.fillStyle = grd;
    ctx.fillRect(this.x, this.y, this.w, this.h);

    // 縁取り（下側を濃く）
    ctx.strokeStyle = 'rgba(0,0,0,.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(this.x+0.5, this.y+0.5, this.w-1, this.h-1);

    // 上ハイライト
    ctx.fillStyle = 'rgba(255,255,255,.2)';
    ctx.fillRect(this.x+1, this.y+1, this.w-2, 2);

    // HPバー（多段のみ表示）
    if (this.maxHp > 1) {
      const barH = 3;
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.fillRect(this.x+2, this.y + this.h - (barH+2), this.w-4, barH);
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.fillRect(this.x+2, this.y + this.h - (barH+2), (this.w-4) * (this.hp/this.maxHp), barH);
    }
  }
}
