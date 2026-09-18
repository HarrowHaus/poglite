import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  applyPullsToCollection,
  initialCollectionEntries,
  isValidActiveStack,
  ownedPogIds,
} from './collection'
import { STARTER_STACK } from './content'
import { rollPack } from './packs'
import type { CollectionEntry, PackResult } from './types'

interface CollectionStore {
  entries: Record<string, CollectionEntry>
  packsOpened: number
  activeStack: string[]
  openPack: (seedPrefix: string) => PackResult
  ownedIds: () => string[]
  setActiveStack: (pogIds: string[]) => boolean
  resetCollection: () => void
}

export const useCollectionStore = create<CollectionStore>()(
  persist(
    (set, get) => ({
      entries: initialCollectionEntries(),
      packsOpened: 0,
      activeStack: [...STARTER_STACK],

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

      setActiveStack(pogIds) {
        const state = get()
        if (!isValidActiveStack(pogIds, state.entries)) return false
        set({ activeStack: [...pogIds] })
        return true
      },

      resetCollection() {
        set({
          entries: initialCollectionEntries(),
          packsOpened: 0,
          activeStack: [...STARTER_STACK],
        })
      },
    }),
    {
      name: 'poglite-collection-v1',
    },
  ),
)
