import { expect, it } from 'vitest'
import { simulateAmmoShot } from './ammoPog'
import { simulateRealScaleShot } from './realScalePog'

const reportIt = process.env.POG_ENGINE_BAKEOFF ? it : it.skip

const seeds = Array.from({ length: 8 }, (_, index) => 'ammo-engine-' + index)

const scenarios = [
  {
    name: 'medium-offset',
    slammerMassKg: 0.06,
    speedMps: 3.25,
    lateralFraction: 0.24,
    spinRadPerSec: 0,
  },
  {
    name: 'fast-offset',
    slammerMassKg: 0.06,
    speedMps: 4,
    lateralFraction: 0.32,
    spinRadPerSec: 0,
  },
  {
    name: 'heavy-medium',
    slammerMassKg: 0.09,
    speedMps: 3.25,
    lateralFraction: 0.24,
    spinRadPerSec: 0,
  },
  {
    name: 'fast-spin',
    slammerMassKg: 0.06,
    speedMps: 4,
    lateralFraction: 0.32,
    spinRadPerSec: 18,
  },
] as const

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function summarize(
  results: Array<{
    finalFlips: number
    everFaceUpCount: number
    maxRiseCm: number
    scatterRadiusCm: number
    maxPitchRollRadPerSec: number
    settleMs: number
  }>,
) {
  return {
    shots: results.length,
    avgFlips: mean(results.map((r) => r.finalFlips)),
    anyFlipRate:
      results.filter((r) => r.finalFlips > 0).length / results.length,
    avgEverFaceUp: mean(results.map((r) => r.everFaceUpCount)),
    avgMaxRiseCm: mean(results.map((r) => r.maxRiseCm)),
    avgScatterCm: mean(results.map((r) => r.scatterRadiusCm)),
    avgPitchRoll: mean(results.map((r) => r.maxPitchRollRadPerSec)),
    avgSettleMs: mean(results.map((r) => r.settleMs)),
  }
}

reportIt(
  'compares Rapier and Bullet Ammo on identical real-scale POG shots',
  async () => {
    const report: Record<string, unknown> = {}

    for (const scenario of scenarios) {
      const rapierResults = []
      const ammoResults = []

      for (const seed of seeds) {
        rapierResults.push(
          await simulateRealScaleShot({
            capMassKg: 0.0011,
            slammerMassKg: scenario.slammerMassKg,
            speedMps: scenario.speedMps,
            lateralFraction: scenario.lateralFraction,
            tiltDeg: 0,
            spinRadPerSec: scenario.spinRadPerSec,
            seed,
          }),
        )

        ammoResults.push(
          await simulateAmmoShot({
            capMassKg: 0.0011,
            slammerMassKg: scenario.slammerMassKg,
            speedMps: scenario.speedMps,
            lateralFraction: scenario.lateralFraction,
            spinRadPerSec: scenario.spinRadPerSec,
            seed,
          }),
        )
      }

      report[scenario.name] = {
        input: scenario,
        rapier: summarize(rapierResults),
        ammo: summarize(ammoResults),
      }
    }

    console.log(
      'POG_AMMO_BAKEOFF=' + JSON.stringify(report, null, 2),
    )

    expect(Object.keys(report)).toHaveLength(scenarios.length)
  },
  120_000,
)
