import { describe, expect, it } from 'vitest'
import {
  ACTIVE_STACK_SIZE,
  applyPullsToCollection,
  initialCollectionEntries,
  isValidActiveStack,
  ownedPogIds,
} from './collection'
import { STARTER_STACK } from './content'

describe('collection', () => {
  it('starts with exactly the starter stack owned', () => {
    const entries = initialCollectionEntries()
    expect(ownedPogIds(entries).sort()).toEqual([...STARTER_STACK].sort())
  })

  it('duplicates increase copies and print ownership without changing gameplay data', () => {
    const entries = initialCollectionEntries()
    const target = STARTER_STACK[0]
    const next = applyPullsToCollection(entries, [
      { pullId: 'a', pogId: target, print: 'foil' },
      { pullId: 'b', pogId: target, print: 'foil' },
    ])

    expect(next[target].copies).toBe(3)
    expect(next[target].prints.standard).toBe(1)
    expect(next[target].prints.foil).toBe(2)
  })

  it('accepts exactly eight unique owned POGs as an active stack', () => {
    const entries = initialCollectionEntries()

    expect(ACTIVE_STACK_SIZE).toBe(8)
    expect(isValidActiveStack(STARTER_STACK, entries)).toBe(true)
    expect(isValidActiveStack(STARTER_STACK.slice(0, 7), entries)).toBe(false)
    expect(isValidActiveStack([...STARTER_STACK.slice(0, 7), STARTER_STACK[0]], entries)).toBe(false)
    expect(isValidActiveStack([...STARTER_STACK.slice(0, 7), 'not-owned'], entries)).toBe(false)
  })
})
