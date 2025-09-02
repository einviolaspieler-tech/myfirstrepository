import { CONFIG } from './config.js';
import { Game } from './game.js';
import { AudioManager } from './audio.js';

// ===== 基本セットアップ =====
const cvs = document.getElementById('game');
cvs.width = CONFIG.canvas.width;
cvs.height = CONFIG.canvas.height;
// スワイプを取りこぼさないように
cvs.style.touchAction = 'none';

const ui = {
  level: document.getElementById('statusLevel'),
  lives: document.getElementById('statusLives'),
  balls: document.getElementById('statusBalls'),
};

const audio = new AudioManager();
const game = new Game(cvs, ui, audio);

// ===== 右パネル要素 =====
const inputLives = document.getElementById('inputLives');
const inputLevel = document.getElementById('inputLevel');
const inputDrop  = document.getElementById('inputDrop');
const inputFall  = document.getElementById('inputFall');
const inputBg    = document.getElementById('inputBg');
const selectBg   = document.getElementById('selectBg');
const selectBgFit= document.getElementById('selectBgFit');
const selectBgmPlay  = document.getElementById('selectBgmPlay');
const selectBgmClear = document.getElementById('selectBgmClear');
const inputVol   = document.getElementById('inputVol');
const chkMute    = document.getElementById('chkMute');
const btnApply   = document.getElementById('btnApply');

// ===== ドロワー要素 =====
const btnMenu  = document.getElementById('btnMenu');
const drawer   = document.getElementById('drawer');
const backdrop = document.getElementById('backdrop');

// ===== タップ開始の取りこぼし対策（overlay/stage/gameover 全部で拾う） =====
const overlayEl  = document.getElementById('overlay');
const gameoverEl = document.getElementById('gameover');
const stageEl    = document.getElementById('stage');
const flagTap = () => { game.input.tapped = true; };
['pointerdown','touchstart','click'].forEach(ev=>{
  overlayEl.addEventListener(ev, flagTap, {passive:true});
  gameoverEl.addEventListener(ev, flagTap, {passive:true});
  stageEl.addEventListener(ev, flagTap, {passive:true});
});

// ===== 初期値の反映 =====
game.setLives(parseInt(inputLives.value, 10) || CONFIG.defaultLives);
game.setLevel(parseInt(inputLevel.value, 10) || CONFIG.defaultLevel);
game.setDropChance((parseFloat(inputDrop.value) || 10) / 100);
game.setFallSpeed(parseFloat(inputFall.value) || CONFIG.items.fallSpeed);
game.setBgFit(selectBgFit.value || CONFIG.background.fit);

// ===== マニフェスト読み込み（背景/BGM候補） =====
async function loadManifest(){
  function fillSelect(sel, arr, withNone=true){
    sel.innerHTML = '';
    if (withNone){
      const op = document.createElement('option');
      op.value = ''; op.textContent = '（なし/手入力）';
      sel.appendChild(op);
    }
    (arr || []).forEach(name => {
      const op = document.createElement('option');
      op.value = name; op.textContent = name;
      sel.appendChild(op);
    });
  }
  try{
    const res = await fetch('./assets/manifest.json');
    const m = await res.json();
    fillSelect(selectBg, m.backgrounds);
    fillSelect(selectBgmPlay,  m.bgm?.play || []);
    fillSelect(selectBgmClear, m.bgm?.clear || []);
  }catch{
    fillSelect(selectBg, []); fillSelect(selectBgmPlay, []); fillSelect(selectBgmClear, []);
  }
}
loadManifest();

// 背景セレクト → 手入力欄へも反映
selectBg.addEventListener('change', () => {
  inputBg.value = selectBg.value || '';
});

// ===== サウンド設定 =====
inputVol.addEventListener('input', () => {
  const v = parseFloat(inputVol.value);
  audio.setVolume(Number.isFinite(v) ? v : 0.6);
});
chkMute.addEventListener('change', () => audio.setMute(chkMute.checked));

// ===== 設定の反映ボタン =====
btnApply.addEventListener('click', async () => {
  // 数値系
  game.setLives(parseInt(inputLives.value, 10) || CONFIG.defaultLives);
  game.setLevel(parseInt(inputLevel.value, 10) || CONFIG.defaultLevel);
  game.setDropChance((parseFloat(inputDrop.value) || 10) / 100);
  game.setFallSpeed(parseFloat(inputFall.value) || CONFIG.items.fallSpeed);
  game.setBgFit(selectBgFit.value || CONFIG.background.fit);

  // 背景（セレクト優先→手入力）
  const bgName = (selectBg.value || inputBg.value || '').trim();
  await game.setBackground(bgName);

  // BGM
  audio.setBgm('play',  selectBgmPlay.value  || '');
  audio.setBgm('clear', selectBgmClear.value || '');
  audio.setVolume(parseFloat(inputVol.value) || 0.6);
  audio.setMute(chkMute.checked);

  // 反映して再開
  game.applyAndRestart();
  closeDrawer();
});

// ===== ドロワー（ハンバーガー/スワイプ/外側タップ） =====
function openDrawer(){
  drawer.classList.add('open');
  backdrop.classList.add('show');
  backdrop.classList.remove('hidden');
}
function closeDrawer(){
  drawer.classList.remove('open');
  backdrop.classList.remove('show');
  setTimeout(() => backdrop.classList.add('hidden'), 200);
}
btnMenu.addEventListener('click', openDrawer);
backdrop.addEventListener('click', closeDrawer);

// スワイプで閉じる（右方向に一定以上）
(() => {
  let startX = 0, tracking = false;
  drawer.addEventListener('pointerdown', e => { tracking = true; startX = e.clientX; });
  drawer.addEventListener('pointermove', e => {
    if (!tracking) return;
    const dx = e.clientX - startX;
    if (dx > 60) { tracking = false; closeDrawer(); }
  });
  drawer.addEventListener('pointerup',   () => tracking = false);
  drawer.addEventListener('pointercancel',() => tracking = false);
})();

// ===== スマホ向け：キャンバス自動フィット =====
function fitCanvas(){
  const isMobile = matchMedia('(max-width: 900px)').matches;
  if (!isMobile) return; // デスクトップはそのまま

  const topbar = document.querySelector('.topbar');
  const topH = topbar ? topbar.offsetHeight : 48;

  const vw = Math.max(document.documentElement.clientWidth,  window.innerWidth  || 0);
  const vh = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);

  // ほぼ全画面（上部のヘッダー分を差し引く）
  const W = vw;
  const H = Math.max(240, vh - topH - 8);

  // 見た目サイズ
  cvs.style.width  = W + 'px';
  cvs.style.height = H + 'px';

  // 内部ロジックサイズも合わせる
  game.resize(W, H);
}
addEventListener('resize', fitCanvas);
addEventListener('orientationchange', fitCanvas);
document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(fitCanvas, 50); });
fitCanvas(); // 初回
