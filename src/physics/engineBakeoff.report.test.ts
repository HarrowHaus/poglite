import { expect, it } from 'vitest'
import { simulateJoltShot } from './joltPog'
import { simulateRealScaleShot } from './realScalePog'

const reportIt = process.env.POG_ENGINE_BAKEOFF ? it : it.skip

const seeds = Array.from({ length: 8 }, (_, index) => 'engine-' + index)

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
    avgFlips: mean(results.map((result) => result.finalFlips)),
    anyFlipRate:
      results.filter((result) => result.finalFlips > 0).length /
      results.length,
    avgEverFaceUp: mean(
      results.map((result) => result.everFaceUpCount),
    ),
    avgMaxRiseCm: mean(results.map((result) => result.maxRiseCm)),
    avgScatterCm: mean(
      results.map((result) => result.scatterRadiusCm),
    ),
    avgPitchRoll: mean(
      results.map((result) => result.maxPitchRollRadPerSec),
    ),
    avgSettleMs: mean(results.map((result) => result.settleMs)),
  }
}

reportIt(
  'compares Rapier and Jolt on identical real-scale POG shots',
  async () => {
    const report: Record<string, unknown> = {}

    for (const scenario of scenarios) {
      const rapierResults = []
      const joltResults = []

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

        joltResults.push(
          await simulateJoltShot({
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
        jolt: summarize(joltResults),
      }
    }

    console.log(
      'POG_ENGINE_BAKEOFF=' + JSON.stringify(report, null, 2),
    )

    expect(Object.keys(report)).toHaveLength(scenarios.length)
  },
  120_000,
)
