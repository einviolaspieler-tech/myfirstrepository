export const CONFIG = {
  canvas: { width: 640, height: 480 },

  // ▼速度（段階加速：等間隔／時間加速は無し）
  baseBallSpeed: 280,
  speedRamp: {
    byClearTiers: [0.00, 0.25, 0.50, 0.75, 0.90],
    byClearMults: [1.00, 1.30, 1.60, 1.90, 2.20],
    maxMultiplier: 2.20
  },

  // 反射角
  bounce: { maxDeflectDeg: 60, minDeflectDeg: 10, paddleInfluenceDeg: 12 },

  paddle: { width: 90, height: 12, speed: 360, min: 50, max: 180 },
  ball: { radius: 6 },

  // ブロック
  brick: { width: 64, height: 18, pad: 8, topOffset: 56, sideMargin: 12, bottomSafe: 110 },

  // アイテム
  items: { dropChance: 0.10, fallSpeed: 140, breakDuration: 8.0 },

  // 背景描画モード
  background: { fit: 'cover-center' }, // 'cover-center' | 'cover-top' | 'contain'

  defaultLives: 3,
  defaultLevel: 1,
};
