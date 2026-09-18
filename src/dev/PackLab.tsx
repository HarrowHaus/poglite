import { useMemo, useState } from 'react'
import { PackReveal } from '../components/PackReveal'
import { packOdds, rollPack } from '../game/packs'

export function PackLab() {
  const [seed, setSeed] = useState('pack-lab')
  const [serial, setSerial] = useState(0)
  const [reveal, setReveal] = useState(false)
  const odds = packOdds()
  const pack = useMemo(() => rollPack(seed + ':' + serial), [seed, serial])

  return (
    <main className="lab-page">
      <header className="lab-header">
        <div>
          <p className="eyebrow">DEV / PACKS</p>
          <h1>Pack lab</h1>
          <p>Collection randomness is inspectable and independent from combat math.</p>
        </div>
        <div className="lab-controls">
          <label>
            Seed
            <input value={seed} onChange={(event) => setSeed(event.target.value)} />
          </label>
          <button onClick={() => { setSerial((value) => value + 1); setReveal(true) }}>
            OPEN NEXT
          </button>
        </div>
      </header>

      <section className="pack-odds">
        <div>
          <h2>Rarity weights</h2>
          {Object.entries(odds.rarity).map(([name, weight]) => (
            <p key={name}><span>{name}</span><strong>{weight}</strong></p>
          ))}
        </div>
        <div>
          <h2>Print weights</h2>
          {Object.entries(odds.print).map(([name, weight]) => (
            <p key={name}><span>{name}</span><strong>{weight}</strong></p>
          ))}
        </div>
        <div>
          <h2>Guarantee</h2>
          <p>{odds.guaranteed}</p>
        </div>
      </section>

      {reveal && <PackReveal pack={pack} onDone={() => setReveal(false)} />}
    </main>
  )
}
