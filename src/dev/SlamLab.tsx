import { useMemo, useState } from 'react'
import { STARTER_STACK } from '../game/content'
import { rollSlammer } from '../game/loot'
import { SlamScene } from '../components/SlamScene'

export function SlamLab() {
  const [force, setForce] = useState(1)
  const [last, setLast] = useState<string[]>([])
  const slammer = useMemo(() => rollSlammer('slam-lab', 4), [])

  return (
    <main className="slam-lab">
      <section className="lab-header compact">
        <div>
          <p className="eyebrow">DEV / SLAM</p>
          <h1>Feel first.</h1>
        </div>
        <label>
          Force × {force.toFixed(2)}
          <input
            type="range"
            min="0.55"
            max="1.6"
            step="0.05"
            value={force}
            onChange={(event) => setForce(Number(event.target.value))}
          />
        </label>
        <div className="flip-readout">
          {last.length ? last.length + ' face-up: ' + last.join(', ') : 'No resolved slam yet.'}
        </div>
      </section>
      <section className="lab-canvas">
        <SlamScene
          pogIds={STARTER_STACK}
          slammer={slammer}
          slamImpulseScale={force}
          onResolved={setLast}
        />
      </section>
    </main>
  )
}
