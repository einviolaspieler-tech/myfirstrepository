import { Brick } from './brick.js';
import { CONFIG } from './config.js';

export function generateLevel(level, W, H) {
  const bw = CONFIG.brick.width, bh = CONFIG.brick.height, pad = CONFIG.brick.pad;
  const cols = Math.max(7, Math.min(10, 6 + Math.floor(level/10)));          // 6→10列へ
  const rows = Math.max(4, Math.min(11, 3 + Math.floor(level/8)));           // 3→11行へ
  const offX = Math.floor((W - (cols*bw + (cols-1)*pad)) / 2);
  const offY = CONFIG.brick.topOffset;

  // 一番下の段は空ける（= rows-1 まで配置）
  const usableRows = rows - 1;

  // 強度（HP）上限：レベルで上がる（1〜5）
  const maxHp = Math.min(5, 1 + Math.floor(level/12));

  // パターンの複雑さ
  const patternKind = level % 3; // 0:全面, 1:斜め, 2:市松

  const bricks = [];
  for (let r=0; r<usableRows; r++) {
    for (let c=0; c<cols; c++) {
      // 配置可否（パターン）
      let place = true;
      if (patternKind === 1) place = (c + r) % 2 === 0;        // 斜め
      if (patternKind === 2) place = (c % 2 === 0) || (r % 2 === 0); // 市松寄り

      if (!place) continue;

      // 強度：レベルが高いほど高HPが出やすい
      const bias = Math.min(0.7, level / 140); // 0→0.7
      const roll = Math.random();
      let hp = 1;
      if (roll < 0.15 + bias*0.2) hp = 2;
      if (roll < 0.06 + bias*0.15) hp = 3;
      if (roll < 0.03 + bias*0.10) hp = 4;
      if (roll < 0.015 + bias*0.05) hp = 5;
      hp = Math.min(hp, maxHp);

      const x = offX + c*(bw+pad);
      const y = offY + r*(bh+pad);
      bricks.push(new Brick(x,y,bw,bh,hp));
    }
  }
  return bricks;
}
