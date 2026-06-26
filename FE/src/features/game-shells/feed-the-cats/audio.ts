'use client'

/**
 * Tiny Web Audio engine for the Feed the Hungry Cats shell.
 *
 * Every sound is synthesized at runtime (no asset files), ported from the
 * original design's chiptune tones. One AudioContext is built lazily on the
 * first user gesture — browsers block autoplay until then.
 */

export type Sfx = 'pickup' | 'feed' | 'wrong' | 'win'

export interface FeedCatsAudio {
  unlock(): void
  play(name: Sfx): void
  setMuted(m: boolean): void
  toggleMuted(): boolean
  readonly muted: boolean
  dispose(): void
}

export function createFeedCatsAudio(): FeedCatsAudio {
  let ctx: AudioContext | null = null
  let muted = false

  function ensureCtx(): AudioContext | null {
    if (muted) return null
    if (ctx) {
      if (ctx.state === 'suspended') void ctx.resume()
      return ctx
    }
    try {
      const AC: typeof AudioContext | undefined =
        window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      ctx = new AC()
    } catch {
      ctx = null
      return null
    }
    return ctx
  }

  // One enveloped oscillator note, scheduled `startIn` seconds from now.
  function tone(freq: number, startIn: number, dur: number, type: OscillatorType, peak: number) {
    const ac = ensureCtx()
    if (!ac) return
    const t0 = ac.currentTime + startIn
    const osc = ac.createOscillator()
    const g = ac.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t0)
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    osc.connect(g)
    g.connect(ac.destination)
    osc.start(t0)
    osc.stop(t0 + dur + 0.02)
  }

  function play(name: Sfx) {
    switch (name) {
      case 'pickup':
        tone(520, 0, 0.09, 'triangle', 0.12)
        break
      case 'feed': // bright little arpeggio E5 → G5 → C6
        tone(659, 0, 0.14, 'triangle', 0.16)
        tone(784, 0.08, 0.16, 'triangle', 0.16)
        tone(1047, 0.16, 0.22, 'triangle', 0.14)
        break
      case 'wrong':
        tone(300, 0, 0.16, 'sawtooth', 0.1)
        tone(196, 0.12, 0.22, 'sawtooth', 0.1)
        break
      case 'win':
        ;[523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.1, 0.28, 'triangle', 0.16))
        break
    }
  }

  return {
    unlock() {
      ensureCtx()
    },
    play,
    setMuted(m: boolean) {
      muted = m
    },
    toggleMuted() {
      muted = !muted
      if (!muted) ensureCtx()
      return muted
    },
    get muted() {
      return muted
    },
    dispose() {
      if (ctx) {
        void ctx.close().catch(() => {})
        ctx = null
      }
    },
  }
}
