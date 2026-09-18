import { uniformFloat64 } from 'pure-rand/distribution/uniformFloat64'
import { uniformInt } from 'pure-rand/distribution/uniformInt'
import { xoroshiro128plus } from 'pure-rand/generator/xoroshiro128plus'

export interface Rng {
  next(): number
  int(minInclusive: number, maxInclusive: number): number
}

function hashSeed(seed: string): number {
  let hash = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash | 0
}

export function seededRng(seed: string): Rng {
  const generator = xoroshiro128plus(hashSeed(seed) || 0x6d2b79f5)

  return {
    next() {
      return uniformFloat64(generator)
    },
    int(minInclusive, maxInclusive) {
      return uniformInt(generator, minInclusive, maxInclusive)
    },
  }
}
