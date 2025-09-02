export class Input {
  constructor() {
    this.left = false; this.right = false; this.space = false;
    addEventListener('keydown', e => this.#onKey(e, true));
    addEventListener('keyup',   e => this.#onKey(e, false));
  }
  #onKey(e, down) {
    if (e.key === 'ArrowLeft'  || e.key === 'a') this.left  = down;
    if (e.key === 'ArrowRight' || e.key === 'd') this.right = down;
    if (e.key === ' ') { this.space = down; }
  }
  consumeSpace() { const s = this.space; this.space = false; return s; }
}
