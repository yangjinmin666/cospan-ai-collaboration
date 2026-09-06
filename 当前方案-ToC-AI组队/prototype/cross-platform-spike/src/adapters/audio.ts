import { scheduleSwipeCue } from '../static/generated/audio.js';
import type { Direction } from '../domain/deck';
declare const wx: { createWebAudioContext(): AudioContext };
export function createAudio() {
  let context: AudioContext | null = null;
  return {
    enabled: true,
    prime() {
      if (!this.enabled) return;
      try {
        // #ifdef H5
        context ||= new AudioContext();
        // #endif
        // #ifdef MP-WEIXIN
        context ||= wx.createWebAudioContext() as unknown as AudioContext;
        // #endif
        if (context?.state === 'suspended') void context.resume().catch(() => {});
      } catch { context = null; }
    },
    play(direction: Direction) {
      if (!this.enabled) return;
      this.prime();
      if (context?.state === 'running') {
        try { scheduleSwipeCue(context, direction); } catch { /* Audio must never prevent a card action. */ }
      }
    },
    suspend() { try { void context?.suspend().catch(() => {}); } catch {} },
    dispose() { try { void context?.close().catch(() => {}); } catch {} context = null; },
  };
}
