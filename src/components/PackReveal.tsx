import { useState } from 'react'
import { PogMedallion } from './PogMedallion'
import { pogById } from '../game/content'
import type { PackResult } from '../game/types'

export function PackReveal({
  pack,
  onDone,
}: {
  pack: PackResult
  onDone: () => void
}) {
  const [opened, setOpened] = useState(false)

  if (!opened) {
    return (
      <div className="pack-overlay">
        <button className="sealed-pack" onClick={() => setOpened(true)}>
          <span>POGLITE</span>
          <strong>5 POG PACK</strong>
          <small>RARE+ GUARANTEED</small>
          <i>TEAR PACK</i>
        </button>
      </div>
    )
  }

  return (
    <div className="pack-overlay">
      <div className="pack-reveal">
        <header>
          <p className="eyebrow">PACK OPENED</p>
          <h2>Five pulls.</h2>
        </header>

        <div className="pack-pulls">
          {pack.pulls.map((pull, index) => {
            const pog = pogById(pull.pogId)
            return (
              <article
                key={pull.pullId}
                className={'pack-pull ' + pog.rarity + ' print-' + pull.print}
                style={{ animationDelay: index * 90 + 'ms' }}
              >
                <PogMedallion pogId={pull.pogId} print={pull.print} size="large" />
                <span className={'rarity ' + pog.rarity}>{pog.rarity}</span>
                <h3>{pog.name}</h3>
                <small>{pull.print === 'standard' ? 'Standard print' : pull.print + ' print'}</small>
              </article>
            )
          })}
        </div>

        <button className="pack-done" onClick={onDone}>TO BINDER</button>
      </div>
    </div>
  )
}
