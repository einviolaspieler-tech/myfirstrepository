export class Paddle {
  constructor(W, H, w, h, speed) {
    this.bounds = { W, H };
    this.w = w; this.h = h; this.speed = speed;
    this.x = (W - w) / 2; this.y = H - 28;
    this.min = 50; this.max = 180;
    this.vx = 0; // 直近フレームの移動速度(px/s)
  }
  setClamp(min, max) { this.min = min; this.max = max; }
  widen(dx) { this.w = Math.min(this.max, this.w + dx); }
  shrink(dx){ this.w = Math.max(this.min, this.w - dx); }
  reset()   { this.x = (this.bounds.W - this.w)/2; this.vx = 0; }
  update(dt, input) {
    const oldX = this.x;
    if (input.left)  this.x -= this.speed * dt;
    if (input.right) this.x += this.speed * dt;
    this.x = Math.max(0, Math.min(this.bounds.W - this.w, this.x));
    this.vx = (this.x - oldX) / Math.max(dt, 1e-6);
  }
  draw(ctx) {
    ctx.fillStyle = '#e8ecf1';
    ctx.fillRect(this.x, this.y, this.w, this.h);
  }
}
