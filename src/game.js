import { CONFIG } from './config.js';
import { Input } from './input.js';
import { Paddle } from './paddle.js';
import { Ball } from './ball.js';
import { generateLevel } from './level.js';
import { maybeDropItem, applyItem } from './items.js';

function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
function deg2rad(d){ return d*Math.PI/180; }

function currentTierIndex(cleared) {
  const tiers = CONFIG.speedRamp.byClearTiers;
  let idx = 0;
  for (let i=tiers.length-1;i>=0;i--) if (cleared>=tiers[i]) { idx=i; break; }
  return idx;
}
function tierMultiplier(idx){ return CONFIG.speedRamp.byClearMults[idx] ?? 1.0; }

export class Game {
  constructor(canvas, ui, audio) {
    this.cvs = canvas; this.ctx = canvas.getContext('2d');
    this.ui = ui;
    this.audio = audio;
    this.input = new Input(canvas);

    this.state='ready';
    this.level=CONFIG.defaultLevel;
    this.maxLives=CONFIG.defaultLives;
    this.lives=this.maxLives;

    this.bgImage=null; this.bgName=''; this.bgFit=CONFIG.background.fit;

    this.paddle = new Paddle(this.cvs.width, this.cvs.height, CONFIG.paddle.width, CONFIG.paddle.height, CONFIG.paddle.speed);
    this.paddle.setClamp(CONFIG.paddle.min, CONFIG.paddle.max);
    this.balls=[]; this.bricks=[]; this.items=[];

    this.speedMultiplier=1.0;
    this.timeElapsed=0;
    this.breakTimer=0;
    this.prevTier = 0;

    this.#resetLevel();
    this.#spawnBall();

    this.last=performance.now();
    requestAnimationFrame(this.#loop.bind(this));
  }

  // ===== API =====
  setLives(n){ this.maxLives=this.lives=clamp(n|0,1,99); this.updateLivesUI(); }
  setLevel(n){ this.level=clamp(n|0,1,99); this.#resetLevel(); this.updateLevelUI(); }
  setDropChance(p){ CONFIG.items.dropChance=clamp(p,0,1); }
  setFallSpeed(v){ CONFIG.items.fallSpeed=clamp(v,20,600); }
  setBgFit(mode){ this.bgFit = mode; }
  async setBackground(name){
    if(!name){ this.bgImage=null; this.bgName=''; return; }
    const img=new Image(); img.src=`./assets/backgrounds/${name}`;
    await img.decode().catch(()=>{});
    if(img.complete){ this.bgImage=img; this.bgName=name; }
  }
  applyAndRestart(){
    this.state='ready';
    this.lives=this.maxLives;
    this.speedMultiplier=1.0; this.timeElapsed=0; this.breakTimer=0; this.prevTier=0;
    this.#resetLevel(); this.#resetPaddleAndBall();
    this.updateLivesUI(); this.updateBallCountUI();
    this.audio?.stopBgm('clear'); this.audio?.playBgm('play');
  }

  // ===== internals =====
  #resetLevel(){ this.bricks=generateLevel(this.level, this.cvs.width, this.cvs.height); }
  #spawnBall(){
    const speed=CONFIG.baseBallSpeed;
    const ang=-Math.PI/2 + (Math.random()*deg2rad(20)-deg2rad(10));
    const vx=Math.cos(ang)*speed, vy=Math.sin(ang)*speed;
    this.balls=[ new Ball(this.cvs.width/2, this.cvs.height-42, 6, vx, vy) ];
    this.updateBallCountUI();
  }
  #resetPaddleAndBall(){ this.paddle.reset(); this.#spawnBall(); }
  updateLevelUI(){ this.ui.level.textContent=`Lv ${this.level}`; }
  updateLivesUI(){ this.ui.lives.textContent=`❤ ${this.lives}`; }
  updateBallCountUI(){ this.ui.balls.textContent=`⚪ ${this.balls.length}`; }

  #startIfInput(){
    if ((this.state==='ready') && (this.input.consumeSpace() || this.input.consumeTap())){
      this.state='running';
      document.getElementById('overlay').classList.add('hidden');
      this.audio?.unlock();
      this.audio?.stopBgm('clear');
      this.audio?.playBgm('play');
    }
    if ((this.state==='gameover') && (this.input.consumeSpace() || this.input.consumeTap())){
      document.getElementById('gameover').classList.add('hidden');
      document.getElementById('overlay').classList.remove('hidden');
      this.applyAndRestart();
    }
  }

  #loop(now){
    const dt=Math.min(0.033,(now-this.last)/1000); this.last=now;
    this.#startIfInput();
    if(this.state==='running') this.update(dt);
    this.draw();
    requestAnimationFrame(this.#loop.bind(this));
  }

  update(dt){
    // 入力
    this.paddle.update(dt, {left:this.input.left, right:this.input.right, pointerVX:this.input.pointerVX});

    // 経過
    this.timeElapsed += dt;

    // ブレイク効果
    if (this.breakTimer>0){
      this.breakTimer -= dt;
      if (this.breakTimer<=0) for (const b of this.balls) b.breakThrough=false;
    }

    // クリア率で段階加速
    const alive = this.bricks.filter(b=>b.alive).length;
    const cleared = 1 - (alive / Math.max(1, this.bricks.length));
    const idx = currentTierIndex(cleared);
    if (idx > this.prevTier){ this.audio?.playSfx('speedup'); this.prevTier = idx; }
    const totalMul = Math.min(CONFIG.speedRamp.maxMultiplier, tierMultiplier(idx) * this.speedMultiplier);

    // ボール更新＋壁
    for (const ball of this.balls){
      const target = CONFIG.baseBallSpeed * totalMul;
      const len = Math.hypot(ball.vx, ball.vy) || 1;
      ball.vx = ball.vx/len*target; ball.vy = ball.vy/len*target;

      const prevX=ball.x, prevY=ball.y;
      ball.update(dt);

      let bounced=false;
      if (ball.x < ball.r){ ball.x=ball.r; ball.vx*=-1; bounced=true; }
      if (ball.x > this.cvs.width-ball.r){ ball.x=this.cvs.width-ball.r; ball.vx*=-1; bounced=true; }
      if (ball.y < ball.r){ ball.y=ball.r; ball.vy*=-1; bounced=true; }
      if (bounced) this.audio?.playSfx('wall');

      // パドル
      const p=this.paddle;
      if (ball.vy>0 && ball.y+ball.r>=p.y && ball.y-ball.r<=p.y+p.h && ball.x>=p.x && ball.x<=p.x+p.w){
        ball.y=p.y-ball.r;
        // 反射角
        const rel=clamp((ball.x-(p.x+p.w/2))/(p.w/2),-1,1);
        const maxD=deg2rad(CONFIG.bounce.maxDeflectDeg);
        let delta=rel*maxD;
        const inf=clamp(p.vx/600,-1,1)*deg2rad(CONFIG.bounce.paddleInfluenceDeg);
        delta+=inf;
        const minD=deg2rad(CONFIG.bounce.minDeflectDeg);
        if(Math.abs(delta)<minD) delta=delta>=0?minD:-minD;
        const ang=-Math.PI/2 + delta;
        const spd=Math.hypot(ball.vx,ball.vy);
        ball.vx=Math.cos(ang)*spd; ball.vy=Math.sin(ang)*spd;
        this.audio?.playSfx('paddle');
      }
    }

    // ブロック衝突
    for (const ball of this.balls){
      for (const br of this.bricks){
        if(!br.alive) continue;
        const cx=Math.max(br.x, Math.min(ball.x, br.x+br.w));
        const cy=Math.max(br.y, Math.min(ball.y, br.y+br.h));
        const dx=ball.x-cx, dy=ball.y-cy;
        if (dx*dx+dy*dy <= ball.r*ball.r){
          if (!ball.breakThrough){
            const ox=Math.min(ball.x+ball.r-br.x, br.x+br.w-(ball.x-ball.r));
            const oy=Math.min(ball.y+ball.r-br.y, br.y+br.h-(ball.y-ball.r));
            if (ox<oy) ball.vx*=-1; else ball.vy*=-1;
          }
          br.hit();
          this.audio?.playSfx(br.alive?'brick':'break');
          if (!br.alive){
            const drop = maybeDropItem(br);
            if (drop) this.items.push(drop);
          }
        }
      }
    }

    // アイテム
    for (const it of this.items) it.update(dt);
    this.items = this.items.filter(it=>{
      const p=this.paddle;
      const withinX=it.x>=p.x && it.x<=p.x+p.w;
      const withinY=it.y+it.size/2>=p.y && it.y-it.si
