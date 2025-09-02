import { CONFIG } from './config.js';
import { Input } from './input.js';
import { Paddle } from './paddle.js';
import { Ball } from './ball.js';
import { generateLevel } from './level.js';
import { Item, maybeDropItem, applyItem } from './items.js';

export class Game {
  constructor(canvas, ui) {
    this.cvs = canvas; this.ctx = canvas.getContext('2d');
    this.ui = ui; // {level,lives,balls}
    this.input = new Input();

    // 状態
    this.state = 'ready'; // 'ready' | 'running' | 'life' | 'gameover'
    this.level = CONFIG.defaultLevel;
    this.maxLives = CONFIG.defaultLives;
    this.lives = this.maxLives;

    // 背景
    this.bgImage = null;
    this.bgName = '';

    // エンティティ
    this.paddle = new Paddle(this.cvs.width, this.cvs.height, CONFIG.paddle.width, CONFIG.paddle.height, CONFIG.paddle.speed);
    this.paddle.setClamp(CONFIG.paddle.min, CONFIG.paddle.max);
    this.balls = [];
    this.bricks = [];
    this.items = [];

    // 速度
    this.speedMultiplier = 1.0;
    this.timeElapsed = 0;
    this.breakTimer = 0;

    this.#resetLevel();
    this.#spawnBall();

    this.last = performance.now();
    requestAnimationFrame(this.#loop.bind(this));
  }

  // ========= Public API from main.js =========
  setLives(n) { this.maxLives = this.lives = Math.max(1, Math.min(99, n|0)); this.updateLivesUI(); }
  setLevel(n) { this.level = Math.max(1, Math.min(99, n|0)); this.#resetLevel(); this.updateLevelUI(); }
  setDropChance(p) { CONFIG.items.dropChance = Math.max(0, Math.min(1, p)); }
  setFallSpeed(v) { CONFIG.items.fallSpeed = Math.max(20, Math.min(600, v)); }
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
    this.#resetLevel();
    this.#resetPaddleAndBall();
    this.updateLivesUI(); this.updateBallCountUI();
  }

  // ========= Internals =========
  #resetLevel() {
    this.bricks = generateLevel(this.level, this.cvs.width, this.cvs.height);
  }
  #spawnBall() {
    const speed = CONFIG.baseBallSpeed;
    const angle = (-Math.PI/3) + Math.random()* (Math.PI/6); // -60〜-30度
    const vx = Math.cos(angle) * speed, vy = Math.sin(angle) * speed;
    this.balls = [ new Ball(this.cvs.width/2, this.cvs.height-42, CONFIG.ball.radius, vx, vy) ];
    this.updateBallCountUI();
  }
  #resetPaddleAndBall() {
    this.paddle.reset();
    this.speedMultiplier = 1.0;
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
    if (this.state === 'running') {
      this.update(dt);
    }
    this.draw();

    requestAnimationFrame(this.#loop.bind(this));
  }

  update(dt) {
    // 入力
    this.paddle.update(dt, this.input);

    // 時間経過
    this.timeElapsed += dt;

    // ブレイク効果タイマー
    if (this.breakTimer > 0) {
      this.breakTimer -= dt;
      if (this.breakTimer <= 0) {
        for (const b of this.balls) b.breakThrough = false;
      }
    }

    // スピード逓増（時間・残ブロックに応じて）
    const timeMul = 1 + CONFIG.speedRamp.byTime * (this.timeElapsed / 10); // 10sごとに少しUP
    const cleared = 1 - (this.bricks.filter(b=>b.alive).length / Math.max(1, this.bricks.length));
    const clearMul = 1 + CONFIG.speedRamp.byClear * cleared;
    this.speedMultiplier = Math.min(CONFIG.speedRamp.maxMultiplier, Math.max(this.speedMultiplier, timeMul * clearMul));

    // ボール更新＋壁反射
    for (const ball of this.balls) {
      const speed = CONFIG.baseBallSpeed * this.speedMultiplier;
      const len = Math.hypot(ball.vx, ball.vy) || 1;
      ball.vx = ball.vx / len * speed;
      ball.vy = ball.vy / len * speed;

      ball.update(dt);

      // 左右壁
      if (ball.x < ball.r) { ball.x = ball.r; ball.vx *= -1; }
      if (ball.x > this.cvs.width - ball.r) { ball.x = this.cvs.width - ball.r; ball.vx *= -1; }
      // 天井
      if (ball.y < ball.r) { ball.y = ball.r; ball.vy *= -1; }

      // パドル衝突
      const p = this.paddle;
      if (ball.vy > 0 && ball.y + ball.r >= p.y && ball.y - ball.r <= p.y + p.h &&
          ball.x >= p.x && ball.x <= p.x + p.w) {
        ball.y = p.y - ball.r;
        ball.vy *= -1;
        const hit = (ball.x - (p.x + p.w/2)) / (p.w/2);
        ball.vx += hit * 80; // 反射角補正
      }
    }

    // ブロック衝突
    for (const ball of this.balls) {
      for (const br of this.bricks) {
        if (!br.alive) continue;
        const hit = this.#circleRectHit(ball, br);
        if (!hit) continue;

        // 強度無視（Break）でなければHP減
        if (!ball.breakThrough) {
          // 反射方向：重なりの少ない軸で反転（簡易）
          const dx = Math.min(ball.x + ball.r - br.x, br.x + br.w - (ball.x - ball.r));
          const dy = Math.min(ball.y + ball.r - br.y, br.y + br.h - (ball.y - ball.r));
          if (dx < dy) ball.vx *= -1; else ball.vy *= -1;
        }
        br.hit();
        if (!br.alive) {
          const drop = maybeDropItem(br);
          if (drop) this.items.push(drop);
        }
        if (ball.breakThrough) {
          // そのまま進む（反射しない）
        }
      }
    }

    // アイテム更新＆取得判定
    for (const it of this.items) it.update(dt);
    this.items = this.items.filter(it => {
      // パドル取得
      const p = this.paddle;
      const withinX = it.x >= p.x && it.x <= p.x + p.w;
      const withinY = it.y + it.size/2 >= p.y && it.y - it.size/2 <= p.y + p.h;
      if (withinX && withinY) {
        applyItem(this, it.type);
        this.updateBallCountUI();
        return false;
      }
      // 画面外
      return it.y < this.cvs.height + it.size;
    });

    // すべてのボールが落下 → ライフ消費＆再開待ち
    this.balls = this.balls.filter(b => b.y - b.r <= this.cvs.height + 4);
    if (this.balls.length === 0) {
      this.lives--;
      this.updateLivesUI();
      if (this.lives <= 0) {
        this.state = 'gameover';
        document.getElementById('gameover').classList.remove('hidden');
        return;
      }
      // 続きから（リセットして"ready"に戻す）
      this.state = 'ready';
      document.getElementById('overlay').classList.remove('hidden');
      this.#resetPaddleAndBall();
    }

    // 全クリア → 次レベル自動
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
    // 背景
    if (this.bgImage) {
      ctx.drawImage(this.bgImage, 0, 0, this.cvs.width, this.cvs.height);
      ctx.fillStyle = 'rgba(0,0,0,.25)'; // 見やすさのために少し暗く
      ctx.fillRect(0,0,this.cvs.width,this.cvs.height);
    } else {
      ctx.fillStyle = '#111';
      ctx.fillRect(0,0,this.cvs.width,this.cvs.height);
    }

    // ブロック
    for (const b of this.bricks) b.draw(ctx);

    // パドル・ボール
    this.paddle.draw(ctx);
    for (const b of this.balls) b.draw(ctx);

    // アイテム
    for (const it of this.items) it.draw(ctx);

    // ブレイク効果中インジケータ
    if (this.breakTimer > 0) {
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      ctx.font = 'bold 12px system-ui';
      ctx.fillText(`BREAK ${this.breakTimer.toFixed(1)}s`, 8, this.cvs.height - 8);
    }
  }

  // 円と矩形の粗判定
  #circleRectHit(ball, br) {
    const cx = Math.max(br.x, Math.min(ball.x, br.x + br.w));
    const cy = Math.max(br.y, Math.min(ball.y, br.y + br.h));
    const dx = ball.x - cx, dy = ball.y - cy;
    return (dx*dx + dy*dy) <= ball.r * ball.r;
  }
}
