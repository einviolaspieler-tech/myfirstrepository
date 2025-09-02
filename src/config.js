export const CONFIG = {
  canvas: { width: 640, height: 480 },
  baseBallSpeed: 220,          // px/s（基礎速度）
  paddle: { width: 90, height: 12, speed: 360, min: 50, max: 180 },
  ball: { radius: 6 },
  brick: { width: 64, height: 18, pad: 8, topOffset: 56 },
  // 速度上昇：時間・残ブロックで逓増（乗算係数を足し合わせる）
  speedRamp: { byTime: 0.06, byClear: 0.20, maxMultiplier: 2.6 },
  items: {
    dropChance: 0.05,     // 5%（UIで上書き）
    fallSpeed: 140,       // px/s（UIで上書き）
    breakDuration: 8.0    // Bの効果秒数
  },
  defaultLives: 3,
  defaultLevel: 1,
};
