import { CONFIG } from './config.js';
import { Game } from './game.js';

const cvs = document.getElementById('game');
cvs.width = CONFIG.canvas.width;
cvs.height = CONFIG.canvas.height;

const ui = {
  level: document.getElementById('statusLevel'),
  lives: document.getElementById('statusLives'),
  balls: document.getElementById('statusBalls'),
};
const game = new Game(cvs, ui);

// 右パネル
const inputLives = document.getElementById('inputLives');
const inputLevel = document.getElementById('inputLevel');
const inputDrop  = document.getElementById('inputDrop');
const inputFall  = document.getElementById('inputFall');
const inputBg    = document.getElementById('inputBg');
const btnApply   = document.getElementById('btnApply');

// 初期反映
game.setLives(parseInt(inputLives.value,10) || CONFIG.defaultLives);
game.setLevel(parseInt(inputLevel.value,10) || CONFIG.defaultLevel);
game.setDropChance((parseFloat(inputDrop.value)||5)/100);
game.setFallSpeed(parseFloat(inputFall.value)||CONFIG.items.fallSpeed);
if (inputBg.value) { game.setBackground(inputBg.value); }

// 反映ボタン
btnApply.addEventListener('click', async () => {
  game.setLives(parseInt(inputLives.value,10) || CONFIG.defaultLives);
  game.setLevel(parseInt(inputLevel.value,10) || CONFIG.defaultLevel);
  game.setDropChance((parseFloat(inputDrop.value)||5)/100);
  game.setFallSpeed(parseFloat(inputFall.value)||CONFIG.items.fallSpeed);
  await game.setBackground(inputBg.value.trim());
  game.applyAndRestart();
});
