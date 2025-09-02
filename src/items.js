import { CONFIG } from './config.js';

export const ItemType = Object.freeze({ Multi:'M', Long:'L', Short:'S', Up:'U', Down:'D', Break:'B' });

export class Item {
  constructor(x,y,type){ this.x=x; this.y=y; this.type=type; this.size=14; }
  update(dt){ this.y += CONFIG.items.fallSpeed * dt; }
  draw(ctx){
    ctx.fillStyle='rgba(255,255,255,.9)';
    ctx.fillRect(this.x-this.size/2, this.y-this.size/2, this.size, this.size);
    ctx.fillStyle='#000'; ctx.font='bold 12px system-ui';
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(this.type, this.x, this.y+0.5);
  }
}

export function maybeDropItem(brick){
  if (Math.random() < CONFIG.items.dropChance){
    const kinds=[ItemType.Multi,ItemType.Long,ItemType.Short,ItemType.Up,ItemType.Down,ItemType.Break];
    const type=kinds[Math.floor(Math.random()*kinds.length)];
    return new Item(brick.x+brick.w/2, brick.y+brick.h/2, type);
  }
  return null;
}

export function applyItem(game, type){
  const { paddle, balls } = game;
  game.audio?.playSfx('item');

  switch(type){
    case ItemType.Multi:{
      const base = balls[0]; if (base){ game.balls.push(base.clone(-0.2), base.clone(+0.2)); game.updateBallCountUI(); }
      break;
    }
    case ItemType.Long: paddle.widen(18); break;
    case ItemType.Short: paddle.shrink(18); break;
    case ItemType.Up: game.speedMultiplier = Math.min(game.speedMultiplier+0.12, CONFIG.speedRamp.maxMultiplier); game.audio?.playSfx('speedup'); break;
    case ItemType.Down: game.speedMultiplier = Math.max(0.6, game.speedMultiplier-0.12); break;
    case ItemType.Break:
      game.breakTimer = CONFIG.items.breakDuration;
      for (const b of game.balls) b.breakThrough = true;
      break;
  }
}
