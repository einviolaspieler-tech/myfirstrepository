export class Paddle {
  constructor(W, H, w, h, speed) {
    this.bounds = { W, H };
    this.w = w; this.h = h; this.speed = speed;
    this.x = (W - w) / 2; this.y = H - 28;
    this.min = 50; this.max = 180;
  }
  setClamp(min, max) { this.min = min; this.max = max; }
  widen(dx) { this.w = Math.min(this.max, this.w + dx); }
  shrink(dx){ this.w = Math.max(this.min, this.w - dx); }
  reset()   { this.x = (this.bounds.W - this.w)/2; }
  update(dt, input) {
    if (input.left)  this.x -= this.speed * dt;
    if (input.right) this.x += this.speed * dt;
    this.x = Math.max(0, Math.min(this.bounds.W - this.w, this.x));
  }
  draw(ctx) {
    ctx.fillStyle = '#e8ecf1';
    ctx.fillRect(this.x, this.y, this.w, this.h);
  }
}
