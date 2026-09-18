import { onFeedback } from './events'

let context: AudioContext | null = null

function audioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const AudioContextClass = window.AudioContext
  if (!AudioContextClass) return null
  context ??= new AudioContextClass()
  return context
}

export function unlockFeedbackAudio() {
  const ctx = audioContext()
  if (ctx?.state === 'suspended') void ctx.resume()
}

function shortTone(
  frequency: number,
  duration: number,
  volume: number,
  detune = 0,
) {
  const ctx = audioContext()
  if (!ctx || ctx.state !== 'running') return

  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  const now = ctx.currentTime

  oscillator.type = 'triangle'
  oscillator.frequency.setValueAtTime(frequency, now)
  oscillator.detune.setValueAtTime(detune, now)
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, frequency * 0.58), now + duration)

  gain.gain.setValueAtTime(Math.max(0.0001, volume), now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)

  oscillator.connect(gain)
  gain.connect(ctx.destination)
  oscillator.start(now)
  oscillator.stop(now + duration)
}

function impactNoise(strength: number) {
  const ctx = audioContext()
  if (!ctx || ctx.state !== 'running') return

  const duration = 0.09 + strength * 0.07
  const frameCount = Math.max(1, Math.floor(ctx.sampleRate * duration))
  const buffer = ctx.createBuffer(1, frameCount, ctx.sampleRate)
  const data = buffer.getChannelData(0)

  for (let i = 0; i < frameCount; i += 1) {
    const envelope = 1 - i / frameCount
    data[i] = (Math.random() * 2 - 1) * envelope
  }

  const source = ctx.createBufferSource()
  const filter = ctx.createBiquadFilter()
  const gain = ctx.createGain()
  const now = ctx.currentTime

  filter.type = 'lowpass'
  filter.frequency.value = 900 + strength * 1500
  gain.gain.setValueAtTime(0.035 + strength * 0.12, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)

  source.buffer = buffer
  source.connect(filter)
  filter.connect(gain)
  gain.connect(ctx.destination)
  source.start(now)
}

export function installFeedbackAudio() {
  return onFeedback((event) => {
    if (event.type === 'slam:impact') {
      const strength = Math.max(0, Math.min(1, event.strength))
      shortTone(78 - strength * 24, 0.11 + strength * 0.07, 0.08 + strength * 0.14)
      impactNoise(strength)
      return
    }

    if (event.type === 'slam:resolved' && event.flips > 0) {
      const notes = Math.min(4, event.flips)
      for (let i = 0; i < notes; i += 1) {
        window.setTimeout(() => shortTone(300 + i * 72, 0.055, 0.035), i * 38)
      }
      return
    }

    if (event.type === 'combat:enemy-hit') {
      shortTone(118, 0.08, 0.04)
      return
    }

    if (event.type === 'combat:player-hit') {
      shortTone(52, 0.16, 0.09, -120)
    }
  })
}
