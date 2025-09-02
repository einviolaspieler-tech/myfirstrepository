export class Input {
  constructor(canvas) {
    this.left=false; this.right=false; this.space=false;
    this.tapped=false;         // タップ開始フラグ
    this.pointerVX=0;          // スワイプ速度(px/s)
    this.#bindKeys();
    if (canvas) this.#bindPointer(canvas);
  }
  #bindKeys(){
    addEventListener('keydown', e => {
      if (e.key==='ArrowLeft'||e.key==='a') this.left=true;
      if (e.key==='ArrowRight'||e.key==='d') this.right=true;
      if (e.key===' ') this.space=true;
    });
    addEventListener('keyup', e => {
      if (e.key==='ArrowLeft'||e.key==='a') this.left=false;
      if (e.key==='ArrowRight'||e.key==='d') this.right=false;
      if (e.key===' ') this.space=false;
    });
  }
  #bindPointer(canvas){
    let holding=false, lastX=0, lastT=0;
    const toLocalX = (e)=> (e.clientX ?? (e.touches?.[0]?.clientX)) - canvas.getBoundingClientRect().left;

    const down = (x)=>{ holding=true; lastX=x; lastT=performance.now(); this.tapped=true; };
    const move = (x)=>{
      if(!holding) return;
      const now = performance.now();
      const dt = Math.max(1, now-lastT)/1000;
      const dx = x - lastX;
      this.pointerVX = dx / dt;
      lastX=x; lastT=now;
    };
    const up = ()=>{ holding=false; this.pointerVX=0; };

    canvas.addEventListener('pointerdown', e=>down(toLocalX(e)));
    canvas.addEventListener('pointermove', e=>move(toLocalX(e)));
    canvas.addEventListener('pointerup',   up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('touchstart', e=>down(toLocalX(e)));
    canvas.addEventListener('touchmove',  e=>{ e.preventDefault(); move(toLocalX(e)); }, {passive:false});
    canvas.addEventListener('touchend',   up);
  }
  consumeSpace(){ const s=this.space; this.space=false; return s; }
  consumeTap(){ const t=this.tapped; this.tapped=false; return t; }
}
