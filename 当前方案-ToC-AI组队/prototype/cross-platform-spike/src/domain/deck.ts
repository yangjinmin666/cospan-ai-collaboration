export type Direction = 'left' | 'right';
export type DeckResult = 'reset' | 'details' | 'next' | 'failed' | 'busy';
export interface DeckPort { sendInterest(id: string): Promise<void>; wait(ms: number): Promise<void>; }
export function createDeck(port: DeckPort) {
  return {
    x: 0, y: 0, startX: 0, startY: 0, axis: '' as '' | 'x' | 'y',
    dragging: false, busy: false, direction: '' as '' | Direction, error: '',
    start(x: number, y: number) {
      if (this.busy) return;
      this.startX = x; this.startY = y; this.x = 0; this.y = 0; this.axis = '';
      this.direction = ''; this.dragging = true; this.error = '';
    },
    move(x: number, y: number) {
      if (!this.dragging || this.busy) return;
      const dx = x - this.startX, dy = y - this.startY;
      this.y = dy;
      if (!this.axis && Math.max(Math.abs(dx), Math.abs(dy)) >= 6) this.axis = Math.abs(dy) > Math.abs(dx) ? 'y' : 'x';
      if (this.axis === 'x') this.x = dx;
    },
    reset() { this.x = 0; this.y = 0; this.axis = ''; this.direction = ''; this.dragging = false; },
    async commit(direction: Direction, id: string): Promise<DeckResult> {
      if (this.busy) return 'busy';
      this.busy = true; this.dragging = false; this.direction = direction; this.error = '';
      // Catch the request immediately, but retain the slide-out interval even on failure.
      const request = direction === 'right' ? port.sendInterest(id).then(() => '', e => e instanceof Error ? e.message : '请求失败') : Promise.resolve('');
      const [error] = await Promise.all([request, port.wait(200)]);
      if (error) this.error = error;
      this.reset(); this.busy = false;
      return error ? 'failed' : 'next';
    },
    async end(id: string): Promise<DeckResult> {
      if (this.busy) return 'busy';
      if (!this.dragging) return 'reset';
      if (this.axis === 'x' && Math.abs(this.x) >= 72) return this.commit(this.x > 0 ? 'right' : 'left', id);
      const clicked = !this.axis && Math.max(Math.abs(this.x), Math.abs(this.y)) < 7;
      this.reset();
      return clicked ? 'details' : 'reset';
    },
  };
}
