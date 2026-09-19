import { expect, it } from 'vitest'
import { simulateCannonShot } from './cannonPog'
import { simulateRealScaleShot } from './realScalePog'

const reportIt = process.env.POG_CANNON_BAKEOFF ? it : it.skip

const scenarios = [
  { name: 'controlled', speedMps: 3.25, lateralFraction: 0.24 },
  { name: 'strong', speedMps: 4, lateralFraction: 0.32 },
  { name: 'overdrive', speedMps: 5.5, lateralFraction: 0.32 },
] as const

const slammerMasses = [0.03, 0.06, 0.09]
const seeds = Array.from({ length: 8 }, (_, index) => 'cannon-' + index)

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function summarize(results: Array<{
  finalFlips: number
  anyFlip: boolean
  everFaceUpCount: number
  maxRiseCm: number
  scatterRadiusCm: number
  settleMs: number
  maxPitchRollRadPerSec: number
}>) {
  return {
    shots: results.length,
    avgFlips: mean(results.map((r) => r.finalFlips)),
    flipRate: results.filter((r) => r.anyFlip).length / results.length,
    avgEverFaceUp: mean(results.map((r) => r.everFaceUpCount)),
    avgRiseCm: mean(results.map((r) => r.maxRiseCm)),
    avgScatterCm: mean(results.map((r) => r.scatterRadiusCm)),
    avgSettleMs: mean(results.map((r) => r.settleMs)),
    avgPeakPitchRoll: mean(
      results.map((r) => r.maxPitchRollRadPerSec),
    ),
  }
}

reportIt(
  'compares Rapier and Cannon on identical real-scale POG shots',
  async () => {
    const report: Record<string, unknown> = {}

    for (const scenario of scenarios) {
      for (const slammerMassKg of slammerMasses) {
        const key =
          scenario.name + '-' + Math.round(slammerMassKg * 1000) + 'g'
        const rapier = []
        const cannon = []

        for (const seed of seeds) {
          const input = {
            capMassKg: 0.0011,
            slammerMassKg,
            speedMps: scenario.speedMps,
            lateralFraction: scenario.lateralFraction,
            tiltDeg: 0,
            spinRadPerSec: 0,
            seed,
          }

          rapier.push(await simulateRealScaleShot(input))
          cannon.push(await simulateCannonShot(input))
        }

        report[key] = {
          input: {
            speedMps: scenario.speedMps,
            lateralFraction: scenario.lateralFraction,
            slammerMassKg,
          },
          rapier: summarize(rapier),
          cannon: summarize(cannon),
        }
      }
    }

    console.log(
      'POG_CANNON_BAKEOFF=' + JSON.stringify(report, null, 2),
    )

    expect(Object.keys(report)).toHaveLength(
      scenarios.length * slammerMasses.length,
    )
  },
  120_000,
)
