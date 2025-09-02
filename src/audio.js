export class AudioManager {
  constructor() {
    this.enabled = true;
    this.volume = 0.6;
    this.ctx = null; // WebAudio (fallback用)
    this.bgm = { play: null, clear: null }; // HTMLAudioElement
  }
  async unlock() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext||window.webkitAudioContext)(); }
      catch { /* なくてもOK */ }
    }
  }
  setVolume(v){ this.volume = Math.max(0, Math.min(1, v)); for (const k of ['play','clear']) if (this.bgm[k]) this.bgm[k].volume = this.volume; }
  setMute(m){ this.enabled = !m; for (const k of ['play','clear']) if (this.bgm[k]) this.bgm[k].muted = m; }

  setBgm(type, filename) {
    if (!filename) { this.bgm[type] = null; return; }
    const url = `./assets/audio/${filename}`;
    const a = new Audio(url);
    a.loop = (type==='play'); a.volume = this.volume;
    this.bgm[type] = a;
  }
  playBgm(type){
    const a = this.bgm[type];
    if (!this.enabled || !a) return;
    a.currentTime = 0;
    a.play().catch(()=>{});
  }
  stopBgm(type){ const a=this.bgm[type]; if(a) a.pause(); }

  // 簡易SFX（ファイルが無ければビープ）
  playSfx(name, file){
    if (!this.enabled) return;
    if (file) { new Audio(`./assets/audio/${file}`).play().catch(()=>{}); return; }
    // fallback beep
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'square';
    const f = {paddle:700,wall:500,brick:600,break:400,speedup:900,item:800}[name] ?? 600;
    o.frequency.value = f;
    g.gain.value = 0.08 * this.volume;
    o.connect(g).connect(this.ctx.destination);
    o.start();
    o.stop(this.ctx.currentTime + 0.08);
  }
}
