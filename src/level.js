import { Brick } from './brick.js';
import { CONFIG } from './config.js';

// 画面に収まる列・行数を計算
function fitGrid(W, H) {
  const { width:bw, height:bh, pad, topOffset, sideMargin, bottomSafe } = CONFIG.brick;
  const maxCols = Math.max(1, Math.floor((W - sideMargin*2 + pad) / (bw + pad)));
  const maxRows = Math.max(1, Math.floor((H - bottomSafe - topOffset + pad) / (bh + pad)));
  return { maxCols, maxRows };
}

// パレット: 5色（青/赤/黄/橙/緑）
const PALETTE = ['#6cc6ff','#ff6b6b','#ffd166','#ffa94d','#95e56b'];

function chooseColorIndex(level, r, c, hp) {
  // レベルと座標、HPでバラけさせる
  return (level + r + 2*c + hp) % PALETTE.length;
}

// パターン群（true=置く）
const Patterns = {
  solid: (r,c)=> true,
  checker: (r,c)=> (r+c)%2===0,
  diagonal: (r,c)=> ((r%3)===0 ? (c%2===0) : (c%2===1)),
  pyramid: (r,c,rows,cols)=> {
    const mid = (cols-1)/2;
    const span = Math.floor(r * (cols/rows));
    return c >= mid - span && c <= mid + span;
  },
  diamond: (r,c,rows,cols)=> {
    const midR = (rows-1)/2, midC = (cols-1)/2;
    return Math.abs(r - midR) + Math.abs(c - midC) <= Math.floor(rows/2);
  },
  hollow: (r,c,rows,cols)=> (r===0 || c===0 || r===rows-1 || c===cols-1),
  stripes: (r,c)=> (r%2===0),
  ring: (r,c,rows,cols)=> {
    const thick = 2;
    const border = (r<thick || c<thick || r>=rows-thick || c>=cols-thick);
    const inner = (r>=thick*2 && c>=thick*2 && r<rows-thick*2 && c<cols-thick*2);
    return border && !inner;
  }
};
const PatternList = ['solid','checker','diagonal','pyramid','diamond','hollow','stripes','ring'];

export function generateLevel(level, W, H) {
  const { width:bw, height:bh, pad, topOffset, sideMargin } = CONFIG.brick;
  let desiredCols = Math.max(7, Math.min(12, 6 + Math.floor(level/9)));
  let desiredRows = Math.max(4, Math.min(12, 3 + Math.floor(level/7)));

  // 画面に収める
  const { maxCols, maxRows } = fitGrid(W, H);
  const cols = Math.min(desiredCols, maxCols);
  const rows = Math.min(desiredRows, maxRows);

  // 中央寄せ
  const totalW = cols*bw + (cols-1)*pad;
  const offX = Math.max(sideMargin, Math.floor((W - totalW)/2));
  const offY = CONFIG.brick.topOffset;

  // 一番下の段は空ける
  const usableRows = Math.max(1, rows - 1);

  // 強度上限（1〜5）
  const maxHp = Math.min(5, 1 + Math.floor(level/12));

  // パターン選択をレベルで振り分け
  const patternName = PatternList[level % PatternList.length];
  const pat = Patterns[patternName];

  const bricks = [];
  for (let r=0; r<usableRows; r++) {
    for (let c=0; c<cols; c++) {
      const place = pat.length === 2 ? pat(r,c) : pat(r,c,usableRows,cols);
      if (!place) continue;

      // 強度分布：レベル高いほど高HPが出やすい
      const bias = Math.min(0.7, level / 140);
      const roll = Math.random();
      let hp = 1;
      if (roll < 0.15 + bias*0.20) hp = 2;
      if (roll < 0.06 + bias*0.15) hp = 3;
      if (roll < 0.03 + bias*0.10) hp = 4;
      if (roll < 0.015 + bias*0.05) hp = 5;
      hp = Math.min(hp, maxHp);

      const x = offX + c*(bw+pad);
      const y = offY + r*(bh+pad);
      const colorIndex = chooseColorIndex(level, r, c, hp);
      bricks.push(new Brick(x,y,bw,bh,hp,colorIndex,PALETTE[colorIndex]));
    }
  }
  return bricks;
}
