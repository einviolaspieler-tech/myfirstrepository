export class Ball {
  constructor(x, y, r, vx, vy) {
    this.x = x; this.y = y; this.r = r; this.vx = vx; this.vy = vy;
    this.breakThrough = false;  // Bアイテム中はtrue
  }
  clone(angleDeltaRad=0) {
    const cs = Math.cos(angleDeltaRad), sn = Math.sin(angleDeltaRad);
    const vx = this.vx * cs - this.vy * sn;
    const vy = this.vx * sn + this.vy * cs;
    const b = new Ball(this.x, this.y, this.r, vx, vy);
    b.breakThrough = this.breakThrough;
    return b;
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }
  draw(ctx) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI*2);
    ctx.fillStyle = '#fff';
    ctx.fill();
  }
}
