import { useMemo, useState } from 'react'
import { STARTER_STACK } from '../game/content'
import { rollSlammer } from '../game/loot'
import { DEFAULT_SLAM_TUNING, type SlamTuning } from '../game/slamPhysics'
import { SlamScene } from '../components/SlamScene'

function RangeControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}) {
  return (
    <label className="tuning-control">
      <span>{label}</span>
      <strong>{value}</strong>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

export function SlamLab() {
  const [tuning, setTuning] = useState<SlamTuning>(DEFAULT_SLAM_TUNING)
  const [debugPhysics, setDebugPhysics] = useState(false)
  const [results, setResults] = useState<number[]>([])
  const slammer = useMemo(() => rollSlammer('slam-lab', 4), [])

  const set = <K extends keyof SlamTuning>(key: K, value: SlamTuning[K]) => {
    setTuning((current) => ({ ...current, [key]: value }))
  }

  const recent = results.slice(-20)
  const average = recent.length
    ? recent.reduce((sum, value) => sum + value, 0) / recent.length
    : 0
  const histogram = Array.from({ length: STARTER_STACK.length + 1 }, (_, flipCount) =>
    recent.filter((value) => value === flipCount).length,
  )
  const histogramMax = Math.max(1, ...histogram)

  return (
    <main className="slam-lab">
      <section className="slam-lab-sidebar">
        <div>
          <p className="eyebrow">DEV / SLAM</p>
          <h1>Feel first.</h1>
          <p className="lab-copy">
            Tune the physical randomizer here. None of these controls are player-facing rules.
          </p>
        </div>

        <div className="tuning-grid">
          <RangeControl
            label="Impulse"
            value={tuning.impulseMultiplier}
            min={0.55}
            max={1.6}
            step={0.05}
            onChange={(value) => set('impulseMultiplier', value)}
          />
          <RangeControl
            label="POG friction"
            value={tuning.pogFriction}
            min={0.2}
            max={1.2}
            step={0.02}
            onChange={(value) => set('pogFriction', value)}
          />
          <RangeControl
            label="POG bounce"
            value={tuning.pogRestitution}
            min={0}
            max={0.5}
            step={0.01}
            onChange={(value) => set('pogRestitution', value)}
          />
          <RangeControl
            label="Linear damping"
            value={tuning.pogLinearDamping}
            min={0}
            max={1}
            step={0.02}
            onChange={(value) => set('pogLinearDamping', value)}
          />
          <RangeControl
            label="Angular damping"
            value={tuning.pogAngularDamping}
            min={0}
            max={1}
            step={0.02}
            onChange={(value) => set('pogAngularDamping', value)}
          />
          <RangeControl
            label="Stack gap"
            value={tuning.stackGap}
            min={0}
            max={0.03}
            step={0.001}
            onChange={(value) => set('stackGap', value)}
          />
          <RangeControl
            label="Settle ms"
            value={tuning.settleMs}
            min={900}
            max={2600}
            step={50}
            onChange={(value) => set('settleMs', value)}
          />
          <RangeControl
            label="Face-up threshold"
            value={tuning.faceUpThreshold}
            min={0}
            max={0.8}
            step={0.05}
            onChange={(value) => set('faceUpThreshold', value)}
          />
        </div>

        <label className="debug-toggle">
          <input
            type="checkbox"
            checked={debugPhysics}
            onChange={(event) => setDebugPhysics(event.target.checked)}
          />
          Show Rapier colliders
        </label>

        <section className="slam-telemetry">
          <div className="telemetry-head">
            <div>
              <span>RECENT SLAMS</span>
              <strong>{recent.length}</strong>
            </div>
            <div>
              <span>AVG FLIPS</span>
              <strong>{average.toFixed(2)}</strong>
            </div>
            <button onClick={() => setResults([])}>CLEAR</button>
          </div>
          <div className="flip-histogram">
            {histogram.map((count, flips) => (
              <div key={flips} title={flips + ' flips: ' + count}>
                <span style={{ height: (count / histogramMax) * 100 + '%' }} />
                <small>{flips}</small>
              </div>
            ))}
          </div>
        </section>
      </section>

      <section className="lab-canvas">
        <SlamScene
          pogIds={STARTER_STACK}
          slammer={slammer}
          tuning={tuning}
          debugPhysics={debugPhysics}
          onResolved={(ids) => setResults((current) => [...current.slice(-39), ids.length])}
        />
      </section>
    </main>
  )
}
