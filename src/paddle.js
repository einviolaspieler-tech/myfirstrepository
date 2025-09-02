export class Paddle {
  constructor(W,H,w,h,speed){
    this.bounds={W,H}; this.w=w; this.h=h; this.speed=speed;
    this.x=(W-w)/2; this.y=H-28; this.min=50; this.max=180; this.vx=0;
  }
  setClamp(min,max){ this.min=min; this.max=max; }
  widen(dx){ this.w=Math.min(this.max,this.w+dx); }
  shrink(dx){ this.w=Math.max(this.min,this.w-dx); }
  reset(){ this.x=(this.bounds.W-this.w)/2; this.vx=0; }
  update(dt, input){
    const oldX=this.x;
    if (input.left)  this.x -= this.speed*dt;
    if (input.right) this.x += this.speed*dt;
    if (Math.abs(input.pointerVX) > 1) this.x += input.pointerVX * dt;
    this.x=Math.max(0, Math.min(this.bounds.W-this.w, this.x));
    this.vx=(this.x-oldX)/Math.max(dt,1e-6);
  }

}
