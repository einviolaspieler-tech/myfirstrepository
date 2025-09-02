export const CONFIG = {
  canvas: { width: 640, height: 480 },

  // ▼スピード関連
  baseBallSpeed: 280, // 初速UP（既存:220）
  speedRamp: {
    // クリア率で段階加速（何%壊したか）
    byClearTiers: [0.00, 0.25, 0.50, 0.75, 0.90],
    byClearMults: [1.00, 1.20, 1.40, 1.65, 1.90],
    // 時間でも段階加速（15秒ごとに最大5段）
    byTimeStepSec: 15,
    byTimeStepInc: 0.08,
    byTimeMaxSteps: 5,
    maxMultiplier: 3.0
  },

  // ▼反射角の気持ちよさ
  bounce: {
    maxDeflectDeg: 60,   // パドル中央基準で最大±60°
    minDeflectDeg: 10,   // 垂直すぎを防ぐための最小偏角
    paddleInfluenceDeg: 12 // パドル移動の影響角（最大）
  },

  paddle: { width: 90, height: 12, speed: 360, min: 50, max: 180 },
  ball: { radius: 6 },

  // ブロック
  brick: { width: 64, height: 18, pad: 8, topOffset: 56, sideMargin: 12, bottomSafe: 110 },

  items: {
    dropChance: 0.05,  // 5%（UIで上書き）
    fallSpeed: 140,
    breakDuration: 8.0
  },

  defaultLives: 3,
  defaultLevel: 1,
};
