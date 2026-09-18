import { POGS } from '../game/content'
import { useCollectionStore } from '../game/collectionStore'
import { PogMedallion } from './PogMedallion'
import type { CollectionEntry, PrintTreatment } from '../game/types'

const printOrder: PrintTreatment[] = ['standard', 'foil', 'prism', 'error']

function bestPrint(entry: CollectionEntry): PrintTreatment {
  for (const print of [...printOrder].reverse()) {
    if (entry.prints[print] > 0) return print
  }
  return 'standard'
}

export function Binder() {
  const entries = useCollectionStore((state) => state.entries)
  const owned = POGS.filter((pog) => (entries[pog.id]?.copies ?? 0) > 0).length
  const totalCopies = Object.values(entries).reduce((sum, entry) => sum + entry.copies, 0)
  const discoveredPrints = Object.values(entries).reduce(
    (sum, entry) => sum + printOrder.filter((print) => entry.prints[print] > 0).length,
    0,
  )

  return (
    <main className="binder-page">
      <header className="binder-header">
        <div>
          <p className="eyebrow">COLLECTION</p>
          <h1>The Binder</h1>
          <p>
            {owned}/{POGS.length} POGs · {totalCopies} total copies · {discoveredPrints} print discoveries
          </p>
        </div>
        <a href="/">BACK TO TABLE</a>
      </header>

      <section className="binder-grid">
        {POGS.map((pog, index) => {
          const entry = entries[pog.id]
          const isOwned = Boolean(entry && entry.copies > 0)

          return (
            <article className={'binder-slot' + (isOwned ? ' owned' : ' locked')} key={pog.id}>
              <span className="binder-number">#{String(index + 1).padStart(3, '0')}</span>

              {isOwned ? (
                <>
                  <PogMedallion pogId={pog.id} print={bestPrint(entry)} />
                  <h2>{pog.name}</h2>
                  <span className={'rarity ' + pog.rarity}>{pog.rarity}</span>
                  <strong>×{entry.copies}</strong>
                  <div className="print-ledger">
                    {printOrder.map((print) => (
                      <span key={print} className={entry.prints[print] > 0 ? 'owned-print' : ''}>
                        {print.slice(0, 1).toUpperCase()} {entry.prints[print]}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="pog-silhouette">?</div>
                  <h2>Undiscovered</h2>
                  <span className="rarity">locked</span>
                </>
              )}
            </article>
          )
        })}
      </section>
    </main>
  )
}
