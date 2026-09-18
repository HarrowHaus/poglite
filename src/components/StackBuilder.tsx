import { useMemo, useState } from 'react'
import { ACTIVE_STACK_SIZE } from '../game/collection'
import { appHref } from '../navigation'
import { useCollectionStore } from '../game/collectionStore'
import { POGS } from '../game/content'
import { PogMedallion } from './PogMedallion'

export function StackBuilder() {
  const entries = useCollectionStore((state) => state.entries)
  const activeStack = useCollectionStore((state) => state.activeStack)
  const setActiveStack = useCollectionStore((state) => state.setActiveStack)
  const [draft, setDraft] = useState<string[]>(activeStack)
  const [saved, setSaved] = useState(false)

  const owned = useMemo(
    () => POGS.filter((pog) => (entries[pog.id]?.copies ?? 0) > 0),
    [entries],
  )

  const toggle = (pogId: string) => {
    setSaved(false)

    if (draft.includes(pogId)) {
      setDraft(draft.filter((id) => id !== pogId))
      return
    }

    if (draft.length >= ACTIVE_STACK_SIZE) return
    setDraft([...draft, pogId])
  }

  const save = () => {
    if (setActiveStack(draft)) setSaved(true)
  }

  return (
    <main className="stack-builder-page">
      <header className="stack-builder-header">
        <div>
          <p className="eyebrow">RUN LOADOUT</p>
          <h1>Build the stack.</h1>
          <p>
            Pick exactly {ACTIVE_STACK_SIZE} different POGs you own. Nothing else changes.
          </p>
        </div>
        <a href={appHref('/')}>BACK TO TABLE</a>
      </header>

      <section className="active-stack-tray">
        <div className="active-stack-heading">
          <span>ACTIVE STACK</span>
          <strong>{draft.length}/{ACTIVE_STACK_SIZE}</strong>
        </div>
        <div className="active-stack-slots">
          {Array.from({ length: ACTIVE_STACK_SIZE }, (_, index) => {
            const pogId = draft[index]
            return (
              <button
                key={index}
                className={'active-stack-slot' + (pogId ? ' filled' : '')}
                onClick={() => pogId && toggle(pogId)}
                disabled={!pogId}
              >
                {pogId ? <PogMedallion pogId={pogId} size="small" /> : <span>EMPTY</span>}
              </button>
            )
          })}
        </div>
        <button
          className="save-stack"
          disabled={draft.length !== ACTIVE_STACK_SIZE}
          onClick={save}
        >
          {saved ? 'STACK SAVED' : 'SAVE STACK'}
        </button>
      </section>

      <section className="owned-pog-picker">
        {owned.map((pog) => {
          const selected = draft.includes(pog.id)
          return (
            <button
              key={pog.id}
              className={'owned-pog-choice' + (selected ? ' selected' : '')}
              onClick={() => toggle(pog.id)}
            >
              <PogMedallion pogId={pog.id} size="small" />
              <div>
                <span className={'rarity ' + pog.rarity}>{pog.rarity}</span>
                <strong>{pog.name}</strong>
                <small>{pog.power} Power</small>
              </div>
              <b>{selected ? 'IN STACK' : 'ADD'}</b>
            </button>
          )
        })}
      </section>
    </main>
  )
}
