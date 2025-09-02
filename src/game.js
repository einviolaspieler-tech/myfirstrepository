import { CONFIG } from './config.js';
import { Input } from './input.js';
import { Paddle } from './paddle.js';
import { Ball } from './ball.js';
import { generateLevel } from './level.js';
import { Item, maybeDropItem, applyItem } from './items.js';

function deg2rad(d){ return d * Math.PI / 180; }
function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }

function tierMultiplier(cleared, timeElapsed) {
  const SR = CONFIG.speedRamp;
  // クリア率
  let clearMul = SR.byClearMults[0];
  for (let i=SR.byClearTiers.length-1; i>=0; i--) {
    if (cleared >= SR.byClearTiers[i]) { clearMul = SR.byClearMults[i]; break; }
  }
  // 時間ステップ
  const steps = clamp(Math.floor(timeElapsed / SR.byTimeStepSec), 0, SR.byTimeMaxSteps);
  const timeMul = 1 + steps * SR.byTimeStepInc;

  return Math.min(SR.maxMultiplier, clearMul * timeMul);
}

export class Game {
  constructor(canvas, ui) {
    this.cvs = canvas; this.ctx = canvas.getContext('2d');
    this.ui = ui;
    this.input = new Input();

    this.state = 'ready';
    this.level = CONFIG.defaultLevel;
    this.maxLives = CONFIG.defaultLives;
    this.lives = this.maxLives;

    this.bgImage = null; this.bgName = '';

    this.paddle = new Paddle(this.cvs.width, this.cvs.height, CONFIG.paddle.width, CONFIG.paddle.height, CONFIG.paddle.speed);
    this.paddle.setClamp(CONFIG.paddle.min, CONFIG.paddle.max);
    this.balls = [];
    this.bricks = [];
    this.items = [];

    // アイテムでの速度ブースト（U/Dで変わる）※基準は1.0
    this.speedMultiplier = 1.0;

    this.timeElapsed = 0;
    this.breakTimer = 0;

    this.#resetLevel();
    this.#spawnBall();

    this.last = performance.now();
    requestAnimationFrame(this.#loop.bind(this));
  }

  setLives(n) { this.maxLives = this.lives = clamp(n|0, 1, 99); this.updateLivesUI(); }
  setLevel(n) { this.level = clamp(n|0, 1, 99); this.#resetLevel(); this.updateLevelUI(); }
  setDropChance(p) { CONFIG.items.dropChance = clamp(p, 0, 1); }
  setFallSpeed(v) { CONFIG.items.fallSpeed = clamp(v, 20, 600); }
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
    this.#resetLevel();
    this.#resetPaddleAndBall();
    this.updateLivesUI(); this.updateBallCountUI();
  }

  #resetLevel() {
    this.bricks = generateLevel(this.level, this.cvs.width, this.cvs.height);
  }
  #spawnBall() {
    const speed = CONFIG.baseBallSpeed;
    const angle = (-Math.PI/2) + (Math.random()*deg2rad(20) - deg2rad(10)); // 上向き±10°
    const vx = Math.cos(angle) * speed, vy = Math.sin(angle) * speed;
    this.balls = [ new Ball(this.cvs.width/2, this.cvs.height-42, CONFIG.ball.radius, vx, vy) ];
    this.updateBallCountUI();
  }
  #resetPaddleAndBall() {
    this.paddle.reset();
    this.timeElapsed = 0;
    this.breakTimer = 0;
    this.#spawnBall();
  }
  updateLevelUI() { this.ui.level.textContent = `Lv ${this.level}`; }
  updateLivesUI() { this.ui.lives.textContent = `❤ ${this.lives}`; }
  updateBallCountUI() { this.ui.balls.textContent = `⚪ ${this.balls.length}`; }

  #startIfSpace() {
    if (this.state === 'ready' && this.input.consumeSpace()) {
      this.state = 'running';
      document.getElementById('overlay').classList.add('hidden');
    }
    if (this.state === 'gameover' && this.input.consumeSpace()) {
      document.getElementById('gameover').classList.add('hidden');
      document.getElementById('overlay').classList.remove('hidden');
      this.applyAndRestart();
    }
  }

  #loop(now) {
    const dt = Math.min(0.033, (now - this.last) / 1000);
    this.last = now;

    this.#startIfSpace();
    if (this.state === 'running') this.update(dt);
    this.draw();

    requestAnimationFrame(this.#loop.bind(this));
  }

  update(dt) {
    this.paddle.update(dt, this.input);
    this.timeElapsed += dt;

    // ブレイク効果
    if (this.breakTimer > 0) {
      this.breakTimer -= dt;
      if (this.breakTimer <= 0) for (const b of this.balls) b.breakThrough = false;
    }

    // クリア率＆時間で段階加速
    const cleared = 1 - (this.bricks.filter(b=>b.alive).length / Math.max(1, this.bricks.length));
    const tierMul = tierMultiplier(cleared, this.timeElapsed);
    const totalMul = Math.min(CONFIG.speedRamp.maxMultiplier, tierMul * this.speedMultiplier);

    // ボール更新
    for (const ball of this.balls) {
      const target = CONFIG.baseBallSpeed * totalMul;
      const len = Math.hypot(ball.vx, ball.vy) || 1;
      ball.vx = ball.vx / len * target;
      ball.vy = ball.vy / len * target;

      ball.update(dt);

      // 壁
      if (ball.x < ball.r) { ball.x = ball.r; ball.vx *= -1; }
      if (ball.x > this.cvs.width - ball.r) { ball.x = this.cvs.width - ball.r; ball.vx *= -1; }
      if (ball.y < ball.r) { ball.y = ball.r; ball.vy *= -1; }

      // パドル
      const p = this.paddle;
      if (ball.vy > 0 && ball.y + ball.r >= p.y && ball.y - ball.r <= p.y + p.h &&
          ball.x >= p.x && ball.x <= p.x + p.w) {
        // 上に出す
        ball.y = p.y - ball.r;

        // 反射角：パドル中央±maxDeflect、パドル移動の影響も加味
        const rel = clamp((ball.x - (p.x + p.w/2)) / (p.w/2), -1, 1);
        const maxDef = deg2rad(CONFIG.bounce.maxDeflectDeg);
        let delta = rel * maxDef;

        // パドル移動の影響角
        const inf = clamp(p.vx / 600, -1, 1) * deg2rad(CONFIG.bounce.paddleInfluenceDeg);
        delta += inf;

        // 垂直すぎを避ける（最小偏角）
        const minDef = deg2rad(CONFIG.bounce.minDeflectDeg);
        if (Math.abs(delta) < minDef) delta = (delta >= 0 ? minDef : -minDef);

        // 上向きに投げる角度（基準は真上 -90°）
        const ang = -Math.PI/2 + delta;
        const spd = Math.hypot(ball.vx, ball.vy);
        ball.vx = Math.cos(ang) * spd;
        ball.vy = Math.sin(ang) * spd;
      }
    }

    // ブロック衝突
    for (const ball of this.balls) {
      for (const br of this.bricks) {
        if (!br.alive) continue;
        const hit = this.#circleRectHit(ball, br);
        if (!hit) continue;

        if (!ball.breakThrough) {
          const dx = Math.min(ball.x + ball.r - br.x, br.x + br.w - (ball.x - ball.r));
          const dy = Math.min(ball.y + ball.r - br.y, br.y + br.h - (ball.y - ball.r));
          if (dx < dy) ball.vx *= -1; else ball.vy *= -1;
        }
        br.hit();
        if (!br.alive) {
          const drop = maybeDropItem(br);
          if (drop) this.items.push(drop);
        }
      }
    }

    // アイテム
    for (const it of this.items) it.update(dt);
    this.items = this.items.filter(it => {
      const p = this.paddle;
      const withinX = it.x >= p.x && it.x <= p.x + p.w;
      const withinY = it.y + it.size/2 >= p.y && it.y - it.size/2 <= p.y + p.h;
      if (withinX && withinY) {
        applyItem(this, it.type);
        this.updateBallCountUI();
        return false;
      }
      return it.y < this.cvs.height + it.size;
    });

    // ライフ処理
    this.balls = this.balls.filter(b => b.y - b.r <= this.cvs.height + 4);
    if (this.balls.length === 0) {
      this.lives--; this.updateLivesUI();
      if (this.lives <= 0) {
        this.state = 'gameover';
        document.getElementById('gameover').classList.remove('hidden');
        return;
      }
      this.state = 'ready';
      document.getElementById('overlay').classList.remove('hidden');
      this.#resetPaddleAndBall();
    }

    // 全消し→次レベル
    if (this.bricks.every(b => !b.alive)) {
      this.level = Math.min(99, this.level + 1);
      this.updateLevelUI();
      this.state = 'ready';
      document.getElementById('overlay').classList.remove('hidden');
      this.#resetLevel();
      this.#resetPaddleAndBall();
    }
  }

  draw() {
    const ctx = this.ctx;
    if (this.bgImage) {
      ctx.drawImage(this.bgImage, 0, 0, this.cvs.width, this.cvs.height);
      ctx.fillStyle = 'rgba(0,0,0,.25)';
      ctx.fillRect(0,0,this.cvs.width,this.cvs.height);
    } else {
      ctx.fillStyle = '#111';
      ctx.fillRect(0,0,this.cvs.width,this.cvs.height);
    }

    for (const b of this.bricks) b.draw(ctx);
    this.paddle.draw(ctx);
    for (const b of this.balls) b.draw(ctx);
    for (const it of this.items) it.draw(ctx);

    if (this.breakTimer > 0) {
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      ctx.font = 'bold 12px system-ui';
      ctx.fillText(`BREAK ${this.breakTimer.toFixed(1)}s`, 8, this.cvs.height - 8);
    }
  }

  #circleRectHit(ball, br) {
    const cx = Math.max(br.x, Math.min(ball.x, br.x + br.w));
    const cy = Math.max(br.y, Math.min(ball.y, br.y + br.h));
    const dx = ball.x - cx, dy = ball.y - cy;
    return (dx*dx + dy*dy) <= ball.r * ball.r;
  }
}
