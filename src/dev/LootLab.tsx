import { useMemo, useState } from 'react'
import { rollSlammerBatch } from '../game/loot'
import type { Rarity } from '../game/types'

export function LootLab() {
  const [seed, setSeed] = useState('loot-lab')
  const [depth, setDepth] = useState(6)
  const rolls = useMemo(() => rollSlammerBatch(seed, depth, 100), [seed, depth])
  const counts = rolls.reduce<Record<Rarity, number>>(
    (acc, roll) => ({ ...acc, [roll.rarity]: acc[roll.rarity] + 1 }),
    { common: 0, rare: 0, unique: 0, legendary: 0 },
  )

  return (
    <main className="lab-page">
      <header className="lab-header">
        <div>
          <p className="eyebrow">DEV / LOOT</p>
          <h1>100-roll wall</h1>
          <p>Rich generator, tiny tooltip. Bad loot distributions should be obvious at a glance.</p>
        </div>
        <div className="lab-controls">
          <label>
            Seed
            <input value={seed} onChange={(event) => setSeed(event.target.value)} />
          </label>
          <label>
            Run depth: {depth}
            <input
              type="range"
              min="0"
              max="20"
              value={depth}
              onChange={(event) => setDepth(Number(event.target.value))}
            />
          </label>
        </div>
      </header>

      <section className="rarity-summary">
        {Object.entries(counts).map(([rarity, count]) => (
          <div key={rarity}>
            <span className={'rarity ' + rarity}>{rarity}</span>
            <strong>{count}</strong>
          </div>
        ))}
      </section>

      <section className="loot-grid">
        {rolls.map((roll) => (
          <article key={roll.instanceId} className="loot-card">
            <span className={'rarity ' + roll.rarity}>{roll.rarity}</span>
            <h2>{roll.name}</h2>
            <strong>{roll.power} POWER</strong>
            {roll.affixes.length === 0
              ? <small>Clean roll.</small>
              : roll.affixes.map((affix) => <small key={affix.id}>{affix.text}</small>)}
          </article>
        ))}
      </section>
    </main>
  )
}
