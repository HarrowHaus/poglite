import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  applyPullsToCollection,
  initialCollectionEntries,
  ownedPogIds,
} from './collection'
import { rollPack } from './packs'
import type { CollectionEntry, PackResult } from './types'

interface CollectionStore {
  entries: Record<string, CollectionEntry>
  packsOpened: number
  openPack: (seedPrefix: string) => PackResult
  ownedIds: () => string[]
  resetCollection: () => void
}

export const useCollectionStore = create<CollectionStore>()(
  persist(
    (set, get) => ({
      entries: initialCollectionEntries(),
      packsOpened: 0,

      openPack(seedPrefix) {
        const serial = get().packsOpened
        const pack = rollPack(seedPrefix + ':pack:' + serial)

        set((state) => ({
          entries: applyPullsToCollection(state.entries, pack.pulls),
          packsOpened: state.packsOpened + 1,
        }))

        return pack
      },

      ownedIds() {
        return ownedPogIds(get().entries)
      },

      resetCollection() {
        set({
          entries: initialCollectionEntries(),
          packsOpened: 0,
        })
      },
    }),
    {
      name: 'poglite-collection-v1',
    },
  ),
)
