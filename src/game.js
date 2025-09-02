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
    this.b
