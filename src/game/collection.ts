import { STARTER_STACK } from './content'
import type {
  CollectionEntry,
  PackPull,
  PrintTreatment,
} from './types'

const emptyPrints = (): Record<PrintTreatment, number> => ({
  standard: 0,
  foil: 0,
  prism: 0,
  error: 0,
})

export function initialCollectionEntries(): Record<string, CollectionEntry> {
  return Object.fromEntries(
    STARTER_STACK.map((pogId) => [
      pogId,
      {
        pogId,
        copies: 1,
        prints: {
          ...emptyPrints(),
          standard: 1,
        },
      },
    ]),
  )
}

export function applyPullsToCollection(
  current: Record<string, CollectionEntry>,
  pulls: PackPull[],
): Record<string, CollectionEntry> {
  const next = structuredClone(current)

  for (const pull of pulls) {
    const entry = next[pull.pogId] ?? {
      pogId: pull.pogId,
      copies: 0,
      prints: emptyPrints(),
    }

    entry.copies += 1
    entry.prints[pull.print] += 1
    next[pull.pogId] = entry
  }

  return next
}

export function ownedPogIds(entries: Record<string, CollectionEntry>): string[] {
  return Object.values(entries)
    .filter((entry) => entry.copies > 0)
    .map((entry) => entry.pogId)
}
