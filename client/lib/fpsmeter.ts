// Minimal FPS meter — drop-in replacement for FPSMeter v0.3.1
// Only the subset used by the game: `new FPSMeter(opts)`, `.show()`, `.hide()`, `.tickStart()`, `.tick()`

export interface FPSMeterOptions {
  bottom?: string;
  graph?: number;
  heat?: number;
  left?: string;
  margin?: string;
  theme?: string;
  top?: string;
}

export default class FPSMeter {
  private el: HTMLDivElement;
  private frames = 0;
  private lastTime = performance.now();
  private fps = 0;
  private visible = false;

  constructor(opts: FPSMeterOptions = {}) {
    this.el = document.createElement('div');
    this.el.style.cssText = `
      position: fixed; z-index: 9999;
      background: rgba(0,0,0,0.7); color: #0f0;
      font: 12px monospace; padding: 4px 8px; border-radius: 3px;
      ${opts.bottom ? `bottom: ${opts.bottom};` : 'top: 10px;'}
      ${opts.left ? `left: ${opts.left};` : 'right: 10px;'}
      ${opts.margin ? `margin: ${opts.margin};` : ''}
      display: none;
    `;
    document.body.appendChild(this.el);
  }

  show(): void {
    this.visible = true;
    this.el.style.display = 'block';
  }

  hide(): void {
    this.visible = false;
    this.el.style.display = 'none';
  }

  tickStart(): void {
    if (!this.visible) return;
    this.frames++;
  }

  tick(): void {
    if (!this.visible) return;
    const now = performance.now();
    const elapsed = now - this.lastTime;
    if (elapsed >= 1000) {
      this.fps = Math.round((this.frames / elapsed) * 1000);
      this.el.textContent = `${this.fps} FPS`;
      this.frames = 0;
      this.lastTime = now;
    }
  }
}
