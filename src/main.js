import { CONFIG } from './config.js';
import { Game } from './game.js';
import { AudioManager } from './audio.js';

const cvs = document.getElementById('game');
cvs.width = CONFIG.canvas.width; cvs.height = CONFIG.canvas.height;

const ui = {
  level: document.getElementById('statusLevel'),
  lives: document.getElementById('statusLives'),
  balls: document.getElementById('statusBalls'),
};
const audio = new AudioManager();
const game = new Game(cvs, ui, audio);

// 右パネル
const inputLives = document.getElementById('inputLives');
const inputLevel = document.getElementById('inputLevel');
const inputDrop  = document.getElementById('inputDrop');
const inputFall  = document.getElementById('inputFall');
const inputBg    = document.getElementById('inputBg');
const selectBg   = document.getElementById('selectBg');
const selectBgFit= document.getElementById('selectBgFit');
const selectBgmPlay = document.getElementById('selectBgmPlay');
const selectBgmClear= document.getElementById('selectBgmClear');
const inputVol   = document.getElementById('inputVol');
const chkMute    = document.getElementById('chkMute');
const btnApply   = document.getElementById('btnApply');

// 初期反映
game.setLives(parseInt(inputLives.value,10) || CONFIG.defaultLives);
game.setLevel(parseInt(inputLevel.value,10) || CONFIG.defaultLevel);
game.setDropChance((parseFloat(inputDrop.value)||10)/100);
game.setFallSpeed(parseFloat(inputFall.value)||CONFIG.items.fallSpeed);
game.setBgFit(selectBgFit.value || CONFIG.background.fit);

// マニフェストから候補を埋める
async function loadManifest(){
  function fillSelect(sel, arr, withNone=true){
    sel.innerHTML='';
    if (withNone){ const op=document.createElement('option'); op.value=''; op.textContent='（なし/手入力）'; sel.appendChild(op); }
    (arr||[]).forEach(name=>{ const op=document.createElement('option'); op.value=name; op.textContent=name; sel.appendChild(op); });
  }
  try{
    const res = await fetch('./assets/manifest.json');
    const m = await res.json();
    fillSelect(selectBg, m.backgrounds);
    fillSelect(selectBgmPlay,  m.bgm?.play || []);
    fillSelect(selectBgmClear, m.bgm?.clear|| []);
  }catch{
    fillSelect(selectBg, []); fillSelect(selectBgmPlay, []); fillSelect(selectBgmClear, []);
  }
}
loadManifest();

// 選択が変わったらテキスト欄にも反映
selectBg.addEventListener('change', ()=>{ inputBg.value = selectBg.value || ''; });

// サウンド設定
inputVol.addEventListener('input', ()=> audio.setVolume(parseFloat(inputVol.value)||0.6));
chkMute.addEventListener('change', ()=> audio.setMute(chkMute.checked));

// 反映ボタン
btnApply.addEventListener('click', async () => {
  game.setLives(parseInt(inputLives.value,10) || CONFIG.defaultLives);
  game.setLevel(parseInt(inputLevel.value,10) || CONFIG.defaultLevel);
  game.setDropChance((parseFloat(inputDrop.value)||10)/100);
  game.setFallSpeed(parseFloat(inputFall.value)||CONFIG.items.fallSpeed);
  game.setBgFit(selectBgFit.value || CONFIG.background.fit);

  // 背景
  const bgName = (selectBg.value || inputBg.value || '').trim();
  await game.setBackground(bgName);

  // BGM
  audio.setBgm('play',  selectBgmPlay.value || '');
  audio.setBgm('clear', selectBgmClear.value || '');
  audio.setVolume(parseFloat(inputVol.value)||0.6);
  audio.setMute(chkMute.checked);

  game.applyAndRestart();
});
