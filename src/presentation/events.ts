export type FeedbackEvent =
  | { type: 'slam:start' }
  | { type: 'slam:impact'; strength: number }
  | { type: 'slam:resolved'; flips: number }
  | { type: 'combat:enemy-hit'; amount: number }
  | { type: 'combat:player-hit'; amount: number }

type Listener = (event: FeedbackEvent) => void

const listeners = new Set<Listener>()

export function emitFeedback(event: FeedbackEvent) {
  listeners.forEach((listener) => listener(event))
}

export function onFeedback(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
