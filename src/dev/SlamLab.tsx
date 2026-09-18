import { folder, Leva, useControls } from 'leva'
import { useMemo, useState } from 'react'
import { SlamScene } from '../components/SlamScene'
import { SLAMMER_FAMILIES, STARTER_STACK, slammerFamilyById } from '../game/content'
import { DEFAULT_SLAM_TUNING, type SlamTuning } from '../game/slamPhysics'
import type { SlamTelemetrySample } from '../game/slamTelemetry'
import type { GeneratedSlammer } from '../game/types'

function average(values: number[]) {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function SlamLab() {
  const [samples, setSamples] = useState<SlamTelemetrySample[]>([])

  const familyOptions = useMemo(
    () =>
      Object.fromEntries(
        SLAMMER_FAMILIES.map((family) => [family.name, family.id]),
      ),
    [],
  )

  const controls = useControls({
    Shot: folder({
      familyId: {
        value: SLAMMER_FAMILIES[0].id,
        options: familyOptions,
        label: 'Slammer family',
      },
      maxPullWorld: {
        value: DEFAULT_SLAM_TUNING.maxPullWorld,
        min: 0.7,
        max: 2.6,
        step: 0.05,
        label: 'Max pull',
      },
      horizontalImpulseBase: {
        value: DEFAULT_SLAM_TUNING.horizontalImpulseBase,
        min: 0.3,
        max: 2.4,
        step: 0.05,
        label: 'Horizontal base',
      },
      horizontalImpulsePower: {
        value: DEFAULT_SLAM_TUNING.horizontalImpulsePower,
        min: 0,
        max: 2,
        step: 0.05,
        label: 'Power gain',
      },
      downwardImpulseBase: {
        value: DEFAULT_SLAM_TUNING.downwardImpulseBase,
        min: 0,
        max: 0.8,
        step: 0.01,
        label: 'Downward base',
      },
      downwardImpulsePower: {
        value: DEFAULT_SLAM_TUNING.downwardImpulsePower,
        min: 0,
        max: 0.8,
        step: 0.01,
        label: 'Downward gain',
      },
      slammerAnchorY: {
        value: DEFAULT_SLAM_TUNING.slammerAnchorY,
        min: 0.5,
        max: 2.5,
        step: 0.05,
        label: 'Anchor height',
      },
      slammerAnchorZ: {
        value: DEFAULT_SLAM_TUNING.slammerAnchorZ,
        min: 0.8,
        max: 3.5,
        step: 0.05,
        label: 'Anchor distance',
      },
      impulseMultiplier: {
        value: DEFAULT_SLAM_TUNING.impulseMultiplier,
        min: 0.55,
        max: 1.6,
        step: 0.05,
        label: 'Family impulse ×',
      },
    }),
    Caps: folder({
      pogFriction: {
        value: DEFAULT_SLAM_TUNING.pogFriction,
        min: 0.2,
        max: 1.2,
        step: 0.02,
        label: 'POG friction',
      },
      pogRestitution: {
        value: DEFAULT_SLAM_TUNING.pogRestitution,
        min: 0,
        max: 0.5,
        step: 0.01,
        label: 'POG bounce',
      },
      pogLinearDamping: {
        value: DEFAULT_SLAM_TUNING.pogLinearDamping,
        min: 0,
        max: 1,
        step: 0.02,
        label: 'Linear damping',
      },
      pogAngularDamping: {
        value: DEFAULT_SLAM_TUNING.pogAngularDamping,
        min: 0,
        max: 1,
        step: 0.02,
        label: 'Angular damping',
      },
      stackGap: {
        value: DEFAULT_SLAM_TUNING.stackGap,
        min: 0,
        max: 0.03,
        step: 0.001,
        label: 'Stack gap',
      },
      faceUpThreshold: {
        value: DEFAULT_SLAM_TUNING.faceUpThreshold,
        min: 0,
        max: 0.8,
        step: 0.05,
        label: 'Face-up threshold',
      },
    }),
    Resolution: folder({
      settleMs: {
        value: DEFAULT_SLAM_TUNING.settleMs,
        min: 900,
        max: 2600,
        step: 50,
        label: 'Resolve after ms',
      },
      debugPhysics: {
        value: false,
        label: 'Rapier colliders',
      },
    }),
  })

  const tuning: SlamTuning = useMemo(
    () => ({
      ...DEFAULT_SLAM_TUNING,
      maxPullWorld: controls.maxPullWorld,
      horizontalImpulseBase: controls.horizontalImpulseBase,
      horizontalImpulsePower: controls.horizontalImpulsePower,
      downwardImpulseBase: controls.downwardImpulseBase,
      downwardImpulsePower: controls.downwardImpulsePower,
      slammerAnchorY: controls.slammerAnchorY,
      slammerAnchorZ: controls.slammerAnchorZ,
      impulseMultiplier: controls.impulseMultiplier,
      pogFriction: controls.pogFriction,
      pogRestitution: controls.pogRestitution,
      pogLinearDamping: controls.pogLinearDamping,
      pogAngularDamping: controls.pogAngularDamping,
      stackGap: controls.stackGap,
      faceUpThreshold: controls.faceUpThreshold,
      settleMs: controls.settleMs,
    }),
    [controls],
  )

  const slammer: GeneratedSlammer = useMemo(() => {
    const family = slammerFamilyById(controls.familyId)
    return {
      instanceId: 'slam-lab:' + family.id,
      familyId: family.id,
      name: family.name + ' LAB',
      rarity: 'common',
      level: 1,
      power: family.basePower,
      affixes: [],
    }
  }, [controls.familyId])

  const recent = samples.slice(-50)
  const impacts = recent.filter((sample) => sample.timeToImpactMs !== null)
  const misses = recent.filter((sample) => sample.missed).length

  const avgPull = average(recent.map((sample) => sample.pullPower))
  const avgImpact = average(impacts.map((sample) => sample.impactStrength))
  const avgImpactTime = average(
    impacts.map((sample) => sample.timeToImpactMs ?? 0),
  )
  const avgFlips = average(recent.map((sample) => sample.flips))
  const avgResolution = average(recent.map((sample) => sample.resolutionMs))
  const missRate = recent.length ? (misses / recent.length) * 100 : 0

  const histogram = Array.from(
    { length: STARTER_STACK.length + 1 },
    (_, flipCount) => recent.filter((sample) => sample.flips === flipCount).length,
  )
  const histogramMax = Math.max(1, ...histogram)

  return (
    <>
      <Leva collapsed={false} oneLineLabels />
      <main className="slam-lab">
        <section className="slam-lab-sidebar">
          <div>
            <p className="eyebrow">DEV / SLAM</p>
            <h1>Shot lab.</h1>
            <p className="lab-copy">
              Pull, release, measure. Leva owns generic tuning controls; this panel
              only shows Poglite-specific shot outcomes.
            </p>
          </div>

          <section className="slam-metrics">
            <div><span>SHOTS</span><strong>{recent.length}</strong></div>
            <div><span>MISS RATE</span><strong>{missRate.toFixed(0)}%</strong></div>
            <div><span>AVG PULL</span><strong>{avgPull.toFixed(2)}</strong></div>
            <div><span>AVG IMPACT</span><strong>{avgImpact.toFixed(2)}</strong></div>
            <div><span>IMPACT TIME</span><strong>{avgImpactTime.toFixed(0)}ms</strong></div>
            <div><span>AVG FLIPS</span><strong>{avgFlips.toFixed(2)}</strong></div>
            <div><span>RESOLUTION</span><strong>{avgResolution.toFixed(0)}ms</strong></div>
            <button onClick={() => setSamples([])}>CLEAR</button>
          </section>

          <section className="slam-telemetry">
            <p className="eyebrow">FLIP DISTRIBUTION / LAST 50</p>
            <div className="flip-histogram">
              {histogram.map((count, flips) => (
                <div key={flips} title={flips + ' flips: ' + count}>
                  <span style={{ height: (count / histogramMax) * 100 + '%' }} />
                  <small>{flips}</small>
                </div>
              ))}
            </div>
          </section>

          <section className="recent-shots">
            <p className="eyebrow">RECENT SHOTS</p>
            {recent.slice(-8).reverse().map((sample, index) => (
              <div key={index} className={sample.missed ? 'miss' : ''}>
                <span>P {sample.pullPower.toFixed(2)}</span>
                <span>I {sample.impactStrength.toFixed(2)}</span>
                <span>F {sample.flips}</span>
                <strong>{sample.missed ? 'MISS' : (sample.timeToImpactMs ?? 0).toFixed(0) + 'ms'}</strong>
              </div>
            ))}
          </section>
        </section>

        <section className="lab-canvas">
          <SlamScene
            pogIds={STARTER_STACK}
            slammer={slammer}
            tuning={tuning}
            debugPhysics={controls.debugPhysics}
            onResolved={() => {}}
            onShotTelemetry={(sample) =>
              setSamples((current) => [...current.slice(-99), sample])
            }
          />
        </section>
      </main>
    </>
  )
}
