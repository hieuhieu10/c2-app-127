'use client'

/**
 * Audio engine for the Battleship shell.
 *
 * Background music is the real theme track (`battleship.mp3`, served from
 * /public) streamed through a looping <audio> element. The short SFX are
 * synthesized at runtime from oscillators + white noise + gain envelopes, so
 * they need no asset files and keep the 8-bit feel. The synth runs on a single
 * AudioContext built lazily on the first user gesture (browsers block autoplay
 * until then; calling `unlock()` from a click handler is enough).
 *
 * Usage:
 *   const audio = createBattleshipAudio('/games/battleship/battleship.mp3')
 *   audio.unlock()            // on first user gesture
 *   audio.startMusic()        // loop the theme track
 *   audio.play('hit')         // one-shot SFX
 *   audio.toggleMuted()       // mute/unmute everything
 *   audio.dispose()           // on unmount
 */

export type Sfx =
  | 'click' | 'select' | 'place' | 'fire'
  | 'hit' | 'miss' | 'sunk'
  | 'correct' | 'wrong' | 'skill'
  | 'win' | 'lose'

export interface BattleshipAudio {
  unlock(): void
  play(name: Sfx): void
  startMusic(): void
  stopMusic(): void
  setMuted(m: boolean): void
  toggleMuted(): boolean
  readonly muted: boolean
  dispose(): void
}

/**
 * @param musicUrl  URL of the looping theme track (served from /public). Omit
 *                  to run SFX-only.
 */
export function createBattleshipAudio(musicUrl?: string): BattleshipAudio {
  let ctx: AudioContext | null = null
  let master: GainNode | null = null
  let sfxGain: GainNode | null = null
  let noiseBuffer: AudioBuffer | null = null
  let music: HTMLAudioElement | null = null
  let muted = false

  // Lazily build the SFX audio graph the first time a sound is needed. Returns
  // null if Web Audio is unavailable (e.g. SSR or an old browser) so callers no-op.
  function ensureCtx(): AudioContext | null {
    if (ctx) return ctx
    try {
      const AC: typeof AudioContext | undefined =
        window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      ctx = new AC()
      master = ctx.createGain()
      master.gain.value = muted ? 0 : 1
      master.connect(ctx.destination)
      sfxGain = ctx.createGain()
      sfxGain.gain.value = 0.9
      sfxGain.connect(master)
      noiseBuffer = makeNoise(ctx)
    } catch {
      ctx = null
      return null
    }
    return ctx
  }

  // Lazily build the <audio> element for the theme track (only on first play,
  // so the 2 MB file isn't fetched until the player actually starts a game).
  function ensureMusic(): HTMLAudioElement | null {
    if (music || !musicUrl || typeof Audio === 'undefined') return music
    music = new Audio(musicUrl)
    music.loop = true
    music.preload = 'auto'
    music.volume = 0.45 // sit under the SFX
    music.muted = muted
    return music
  }

  function makeNoise(c: AudioContext): AudioBuffer {
    const buf = c.createBuffer(1, c.sampleRate, c.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    return buf
  }

  // ── Voice primitives ──
  function tone(t: number, freq: number, dur: number, type: OscillatorType, vol: number, dest: AudioNode) {
    if (!ctx) return
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(freq, t)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g)
    g.connect(dest)
    o.start(t)
    o.stop(t + dur + 0.02)
  }

  function sweep(t: number, f0: number, f1: number, dur: number, type: OscillatorType, vol: number, dest: AudioNode) {
    if (!ctx) return
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(f0, t)
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g)
    g.connect(dest)
    o.start(t)
    o.stop(t + dur + 0.02)
  }

  function noise(t: number, dur: number, vol: number, dest: AudioNode, filter?: { type: BiquadFilterType; freq: number }) {
    if (!ctx || !noiseBuffer) return
    const src = ctx.createBufferSource()
    src.buffer = noiseBuffer
    let node: AudioNode = src
    if (filter) {
      const f = ctx.createBiquadFilter()
      f.type = filter.type
      f.frequency.value = filter.freq
      src.connect(f)
      node = f
    }
    const g = ctx.createGain()
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    node.connect(g)
    g.connect(dest)
    src.start(t)
    src.stop(t + dur + 0.02)
  }

  // ── SFX ──
  function play(name: Sfx) {
    if (!ensureCtx() || !sfxGain) return
    void ctx!.resume()
    const t = ctx!.currentTime + 0.001
    const S = sfxGain
    switch (name) {
      case 'click':
        tone(t, 740, 0.05, 'square', 0.16, S)
        break
      case 'select':
        tone(t, 587, 0.07, 'square', 0.16, S)
        tone(t + 0.08, 880, 0.1, 'square', 0.16, S)
        break
      case 'place':
        tone(t, 196, 0.05, 'square', 0.2, S)
        tone(t + 0.05, 110, 0.12, 'triangle', 0.26, S)
        break
      case 'fire':
        sweep(t, 1000, 180, 0.24, 'sawtooth', 0.15, S)
        noise(t, 0.2, 0.07, S, { type: 'highpass', freq: 800 })
        break
      case 'hit':
        noise(t, 0.3, 0.5, S, { type: 'lowpass', freq: 1400 })
        sweep(t, 260, 60, 0.32, 'square', 0.32, S)
        break
      case 'miss':
        noise(t, 0.22, 0.26, S, { type: 'bandpass', freq: 1200 })
        tone(t, 320, 0.12, 'sine', 0.1, S)
        break
      case 'sunk':
        noise(t, 0.5, 0.6, S, { type: 'lowpass', freq: 1000 })
        sweep(t, 300, 40, 0.55, 'square', 0.34, S)
        sweep(t + 0.05, 180, 30, 0.5, 'sawtooth', 0.2, S)
        break
      case 'correct':
        tone(t, 523, 0.1, 'square', 0.17, S)
        tone(t + 0.1, 659, 0.1, 'square', 0.17, S)
        tone(t + 0.2, 784, 0.16, 'square', 0.19, S)
        break
      case 'wrong':
        tone(t, 330, 0.16, 'sawtooth', 0.18, S)
        tone(t + 0.12, 247, 0.28, 'sawtooth', 0.18, S)
        break
      case 'skill':
        tone(t, 659, 0.08, 'square', 0.15, S)
        tone(t + 0.07, 880, 0.08, 'square', 0.15, S)
        tone(t + 0.14, 1175, 0.08, 'square', 0.15, S)
        tone(t + 0.21, 1568, 0.22, 'square', 0.17, S)
        break
      case 'win':
        ;[523, 659, 784, 1047].forEach((f, i) => tone(t + i * 0.12, f, 0.16, 'square', 0.19, S))
        tone(t + 0.48, 1047, 0.4, 'square', 0.19, S)
        break
      case 'lose':
        ;[392, 330, 294, 247].forEach((f, i) => tone(t + i * 0.14, f, 0.22, 'triangle', 0.18, S))
        break
    }
  }

  function startMusic() {
    const el = ensureMusic()
    if (!el) return
    el.muted = muted
    void el.play().catch(() => {}) // ignore autoplay rejection; retried on next gesture
  }

  function stopMusic() {
    music?.pause()
  }

  function setMuted(m: boolean) {
    muted = m
    if (master) master.gain.value = m ? 0 : 1
    if (music) music.muted = m
  }

  return {
    unlock() {
      if (ensureCtx()) void ctx!.resume()
    },
    play,
    startMusic,
    stopMusic,
    setMuted,
    toggleMuted() {
      setMuted(!muted)
      return muted
    },
    get muted() {
      return muted
    },
    dispose() {
      stopMusic()
      if (music) {
        music.src = ''
        music = null
      }
      if (ctx) {
        void ctx.close().catch(() => {})
        ctx = null
      }
    },
  }
}
