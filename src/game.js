import { CONFIG } from './config.js';
import { Input } from './input.js';
import { Paddle } from './paddle.js';
import { Ball } from './ball.js';
import { generateLevel } from './level.js';
import { maybeDropItem, applyItem } from './items.js';

function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }
function deg2rad(d){ return d * Math.PI / 180; }

// クリア率に応じた段階インデックス
function currentTierIndex(cleared) {
  const tiers = CONFIG.speedRamp.byClearTiers;
  let idx = 0;
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (cleared >= tiers[i]) { idx = i; break; }
  }
  return idx;
}
// 段階インデックス→倍率
function tierMultiplier(idx){ return CONFIG.speedRamp.byClearMults[idx] ?? 1.0; }

export class Game {
  constructor(canvas, ui, audio) {
    this.cvs = canvas;
    this.ctx = canvas.getContext('2d');
    this.ui = ui;
    this.audio = audio;

    // 入力（キーボード＋タッチ/スワイプ）
    this.input = new Input(canvas);

    // 状態
    this.state = 'ready'; // 'ready' | 'running' | 'gameover'
    this.level = CONFIG.defaultLevel;
    this.maxLives = CONFIG.defaultLives;
    this.lives = this.maxLives;

    // 背景
    this.bgImage = null;
    this.bgName = '';
    this.bgFit = CONFIG.background?.fit || 'cover-center'; // 'cover-center' | 'cover-top' | 'contain'

    // エンティティ
    this.paddle = new Paddle(this.cvs.width, this.cvs.height,
      CONFIG.paddle.width, CONFIG.paddle.height, CONFIG.paddle.speed);
    this.paddle.setClamp(CONFIG.paddle.min, CONFIG.paddle.max);
    this.balls = [];
    this.bricks = [];
    this.items = [];

    // 速度倍率（U/Dや段階加速の合成用）
    this.speedMultiplier = 1.0;
    this.timeElapsed = 0;
    this.breakTimer = 0;
    this.prevTier = 0; // 段階が上がった瞬間のSFX用

    // 初期化
    this.#resetLevel();
    this.#spawnBall();

    // ループ
    this.last = performance.now();
    requestAnimationFrame(this.#loop.bind(this));
  }

  /* ====== 公開API（UIから呼ばれる） ====== */
  setLives(n){ this.maxLives = this.lives = clamp(n|0, 1, 99); this.updateLivesUI(); }
  setLevel(n){ this.level = clamp(n|0, 1, 99); this.#resetLevel(); this.updateLevelUI(); }
  setDropChance(p){ CONFIG.items.dropChance = clamp(p, 0, 1); }
  setFallSpeed(v){ CONFIG.items.fallSpeed = clamp(v, 20, 600); }
  setBgFit(mode){ this.bgFit = mode; }

  async setBackground(name) {
    if (!name) { this.bgImage = null; this.bgName = ''; return; }
    const img = new Image();
    img.src = `./assets/backgrounds/${name}`;
    await img.decode().catch(()=>{});
    if (img.complete) { this.bgImage = img; this.bgName = name; }
  }

  applyAndRestart() {
    this.state = 'ready';
    this.lives = this.maxLives;
    this.speedMultiplier = 1.0;
    this.timeElapsed = 0;
    this.breakTimer = 0;
    this.prevTier = 0;

    this.#resetLevel();
    this.#resetPaddleAndBall();
    this.updateLivesUI(); this.updateBallCountUI();

    this.audio?.stopBgm('clear');
    this.audio?.playBgm('play');
  }

  // 画面サイズに合わせてキャンバスと境界を更新
  resize(width, height){
    if (!width || !height) return;
    this.cvs.width  = Math.floor(width);
    this.cvs.height = Math.floor(height);
    // パドル境界・位置
    this.paddle.bounds = { W: this.cvs.width, H: this.cvs.height };
    this.paddle.y = this.cvs.height - 28;

    // レベルを画面サイズに合わせて再生成（進行はリセット）
    const keepLevel = this.level;
    const keepLives = this.lives;
    this.#resetLevel();
    this.#resetPaddleAndBall();
    this.level = keepLevel;
    this.lives = Math.max(1, keepLives);
    this.updateLevelUI(); this.updateLivesUI(); this.updateBallCountUI();
  }

  /* ====== 内部処理 ====== */
  #resetLevel(){
    this.bricks = generateLevel(this.level, this.cvs.width, this.cvs.height);
  }
  #spawnBall(){
    const speed = CONFIG.baseBallSpeed;
    // 初期角度：真上±10°
    const ang = -Math.PI/2 + (Math.random()*deg2rad(20) - deg2rad(10));
    const vx = Math.cos(ang) * speed;
    const vy = Math.sin(ang) * speed;
    this.balls = [ new Ball(this.cvs.width/2, this.cvs.height-42, CONFIG.ball.radius, vx, vy) ];
    this.updateBallCountUI();
  }
  #resetPaddleAndBall(){
    this.paddle.reset();
    this.#spawnBall();
  }
  updateLevelUI(){ this.ui.level.textContent = `Lv ${this.level}`; }
  updateLivesUI(){ this.ui.lives.textContent = `❤ ${this.lives}`; }
  updateBallCountUI(){ this.ui.balls.textContent = `⚪ ${this.balls.length}`; }

  #startIfInput(){
    const pressed = this.input.consumeSpace() || this.input.consumeTap();
    if (this.state === 'ready' && pressed){
      this.state = 'running';
      document.getElementById('overlay').classList.add('hidden');
      this.audio?.unlock();
      this.audio?.stopBgm('clear');
      this.audio?.playBgm('play');
    }
    if (this.state === 'gameover' && pressed){
      document.getElementById('gameover').classList.add('hidden');
      document.getElementById('overlay').classList.remove('hidden');
      this.applyAndRestart();
    }
  }

  #loop(now){
    const dt = Math.min(0.033, (now - this.last) / 1000);
    this.last = now;

    this.#startIfInput();
    if (this.state === 'running') this.update(dt);
    this.draw();

    requestAnimationFrame(this.#loop.bind(this));
  }

  update(dt){
    // 入力（キーボード＋スワイプ速度）
    this.paddle.update(dt, {
      left: this.input.left,
      right: this.input.right,
      pointerVX: this.input.pointerVX
    });

    this.timeElapsed += dt;

    // Break効果の残り時間
    if (this.breakTimer > 0){
      this.breakTimer -= dt;
      if (this.breakTimer <= 0){
        for (const b of this.balls) b.breakThrough = false;
      }
    }

    // クリア率で段階加速（等間隔）
    const alive = this.bricks.filter(b => b.alive).length;
    const cleared = 1 - (alive / Math.max(1, this.bricks.length));
    const idx = currentTierIndex(cleared);
    if (idx > this.prevTier){ this.audio?.playSfx('speedup'); this.prevTier = idx; }
    const totalMul = Math.min(CONFIG.speedRamp.maxMultiplier,
      tierMultiplier(idx) * this.speedMultiplier);

    // ボール更新＋壁・パドル
    for (const ball of this.balls){
      // 速度の再正規化
      const target = CONFIG.baseBallSpeed * totalMul;
      const len = Math.hypot(ball.vx, ball.vy) || 1;
      ball.vx = ball.vx / len * target;
      ball.vy = ball.vy / len * target;

      ball.update(dt);

      // 壁反射
      let bounced = false;
      if (ball.x < ball.r){ ball.x = ball.r; ball.vx *= -1; bounced = true; }
      if (ball.x > this.cvs.width - ball.r){ ball.x = this.cvs.width - ball.r; ball.vx *= -1; bounced = true; }
      if (ball.y < ball.r){ ball.y = ball.r; ball.vy *= -1; bounced = true; }
      if (bounced) this.audio?.playSfx('wall');

      // パドル反射
      const p = this.paddle;
      if (ball.vy > 0 &&
          ball.y + ball.r >= p.y && ball.y - ball.r <= p.y + p.h &&
          ball.x >= p.x && ball.x <= p.x + p.w){
        ball.y = p.y - ball.r;

        // 反射角：中央基準±maxDeflect + パドル移動の影響、最小偏角あり
        const rel = clamp((ball.x - (p.x + p.w/2)) / (p.w/2), -1, 1);
        const maxD = deg2rad(CONFIG.bounce.maxDeflectDeg);
        let delta = rel * maxD;

        const inf = clamp(p.vx / 600, -1, 1) * deg2rad(CONFIG.bounce.paddleInfluenceDeg);
        delta += inf;

        const minD = deg2rad(CONFIG.bounce.minDeflectDeg);
        if (Math.abs(delta) < minD) delta = (delta >= 0 ? minD : -minD);

        const ang = -Math.PI/2 + delta;
        const spd = Math.hypot(ball.vx, ball.vy);
        ball.vx = Math.cos(ang) * spd;
        ball.vy = Math.sin(ang) * spd;

        this.audio?.playSfx('paddle');
      }
    }

    // ブロック衝突
    for (const ball of this.balls){
      for (const br of this.bricks){
        if (!br.alive) continue;

        // 円と矩形の最近点で判定
        const cx = Math.max(br.x, Math.min(ball.x, br.x + br.w));
        const cy = Math.max(br.y, Math.min(ball.y, br.y + br.h));
        const dx = ball.x - cx, dy = ball.y - cy;
        if (dx*dx + dy*dy <= ball.r * ball.r){
          if (!ball.breakThrough){
            const ox = Math.min(ball.x + ball.r - br.x, br.x + br.w - (ball.x - ball.r));
            const oy = Math.min(ball.y + ball.r - br.y, br.y + br.h - (ball.y - ball.r));
            if (ox < oy) ball.vx *= -1; else ball.vy *= -1;
          }
          br.hit();
          this.audio?.playSfx(br.alive ? 'brick' : 'break');

          if (!br.alive){
            const drop = maybeDropItem(br);
            if (drop) this.items.push(drop);
          }
        }
      }
    }

    // アイテム更新・取得
    for (const it of this.items) it.update(dt);
    this.items = this.items.filter(it => {
      const p = this.paddle;
      const withinX = it.x >= p.x && it.x <= p.x + p.w;
      const withinY = it.y + it.size/2 >= p.y && it.y - it.size/2 <= p.y + p.h;
      if (withinX && withinY){
        this.audio?.playSfx('item');
        applyItem(this, it.type);
        this.updateBallCountUI();
        return false;
      }
      return it.y < this.cvs.height + it.size;
    });

    // ライフ・リスタート
    this.balls = this.balls.filter(b => b.y - b.r <= this.cvs.height + 4);
    if (this.balls.length === 0){
      this.lives--;
      this.updateLivesUI();
      if (this.lives <= 0){
        this.state = 'gameover';
        document.getElementById('gameover').classList.remove('hidden');
        this.audio?.stopBgm('play');
        this.audio?.playBgm('clear');
        return;
      }
      this.state = 'ready';
      document.getElementById('overlay').classList.remove('hidden');
      this.#resetPaddleAndBall();
    }

    // 全消し→次レベル（準備状態へ）
    if (this.bricks.every(b => !b.alive)){
      this.level = Math.min(99, this.level + 1);
      this.updateLevelUI();
      this.state = 'ready';
      document.getElementById('overlay').classList.remove('hidden');
      this.#resetLevel();
      this.#resetPaddleAndBall();
      this.prevTier = 0;
    }
  }

  draw(){
    const ctx = this.ctx;

    // 背景
    if (this.bgImage) this.#drawBackground(this.bgImage, this.bgFit);
    else { ctx.fillStyle = '#111'; ctx.fillRect(0,0,this.cvs.width,this.cvs.height); }

    // エンティティ
    for (const b of this.bricks) b.draw(ctx);
    this.paddle.draw(ctx);
    for (const b of this.balls) b.draw(ctx);
    for (const it of this.items) it.draw(ctx);

    // 効果時間表示
    if (this.breakTimer > 0){
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      ctx.font = 'bold 12px system-ui';
      ctx.fillText(`BREAK ${this.breakTimer.toFixed(1)}s`, 8, this.cvs.height - 8);
    }
  }

  #drawBackground(img, mode){
    const W = this.cvs.width, H = this.cvs.height, ctx = this.ctx;
    const ir = img.width / img.height;
    const cr = W / H;

    if (mode === 'contain'){
      let dw = W, dh = W / ir;
      if (dh > H){ dh = H; dw = H * ir; }
      const dx = (W - dw) / 2, dy = (H - dh) / 2;
      ctx.fillStyle = '#000'; ctx.fillRect(0,0,W,H);
      ctx.drawImage(img, 0,0,img.width,img.height, dx,dy,dw,dh);
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(0,0,W,H);
      return;
    }

    // cover（中央/上寄せ）
    let sx = 0, sy = 0, sw = img.width, sh = img.height;
    if (ir > cr){
      // 横長：横をトリム
      sh = img.height;
      sw = sh * cr;
      sx = (img.width - sw) / 2;
    } else {
      // 縦長：縦をトリム
      sw = img.width;
      sh = sw / cr;
      sy = (mode === 'cover-top') ? 0 : (img.height - sh) / 2;
    }
    ctx.drawImage(img, sx,sy,sw,sh, 0,0,W,H);
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.fillRect(0,0,W,H);
  }
}
