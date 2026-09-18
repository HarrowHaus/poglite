import { expect, it } from 'vitest'
import {
  simulateRealScaleShot,
  type RealScaleShotMetrics,
} from './realScalePog'

const reportIt = process.env.POG_PHYSICS_REPORT ? it : it.skip

const capMassKg = 0.0011
const slammerMasses = [0.03, 0.06, 0.09]
const speeds = [2.5, 3.25, 4, 4.75, 5.5]
const laterals = [0, 0.08, 0.16, 0.24, 0.32]
const spinRadPerSec = [0, 18]
const seeds = Array.from({ length: 16 }, (_, i) => 'validation-' + i)

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function percentile(values: number[], p: number) {
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor((sorted.length - 1) * p)),
  )
  return sorted[index]
}

reportIt(
  'validates real-scale control and slammer-mass response',
  async () => {
    const rows = []

    for (const slammerMassKg of slammerMasses) {
      for (const speedMps of speeds) {
        for (const lateralFraction of laterals) {
          for (const spin of spinRadPerSec) {
            const results: RealScaleShotMetrics[] = []

            for (const seed of seeds) {
              results.push(
                await simulateRealScaleShot({
                  capMassKg,
                  slammerMassKg,
                  speedMps,
                  tiltDeg: 0,
                  lateralFraction,
                  spinRadPerSec: spin,
                  seed,
                }),
              )
            }

            rows.push({
              slammerMassKg,
              speedMps,
              lateralFraction,
              spinRadPerSec: spin,
              shots: results.length,
              avgFlips: mean(results.map((r) => r.finalFlips)),
              p25Flips: percentile(results.map((r) => r.finalFlips), 0.25),
              p75Flips: percentile(results.map((r) => r.finalFlips), 0.75),
              flipRate:
                results.filter((r) => r.anyFlip).length / results.length,
              avgEverFaceUp: mean(
                results.map((r) => r.everFaceUpCount),
              ),
              avgRiseCm: mean(results.map((r) => r.maxRiseCm)),
              avgScatterCm: mean(
                results.map((r) => r.scatterRadiusCm),
              ),
              avgSettleMs: mean(results.map((r) => r.settleMs)),
              avgPitchRoll: mean(
                results.map((r) => r.maxPitchRollRadPerSec),
              ),
            })
          }
        }
      }
    }

    const controlCurve = rows.filter(
      (row) =>
        row.slammerMassKg === 0.06 &&
        row.spinRadPerSec === 0,
    )

    const familyMassCurve = rows.filter(
      (row) =>
        row.speedMps === 4 &&
        row.lateralFraction === 0.24 &&
        row.spinRadPerSec === 0,
    )

    const good = rows
      .filter(
        (row) =>
          row.flipRate >= 0.55 &&
          row.avgFlips >= 1 &&
          row.avgFlips <= 4 &&
          row.avgScatterCm <= 10 &&
          row.avgSettleMs <= 900,
      )
      .sort((a, b) => {
        const scoreA =
          Math.abs(a.avgFlips - 2.4) +
          Math.abs(a.flipRate - 0.78) +
          Math.max(0, a.avgSettleMs - 650) / 500
        const scoreB =
          Math.abs(b.avgFlips - 2.4) +
          Math.abs(b.flipRate - 0.78) +
          Math.max(0, b.avgSettleMs - 650) / 500
        return scoreA - scoreB
      })
      .slice(0, 20)

    console.log(
      'POG_REAL_SCALE_VALIDATION=' +
        JSON.stringify(
          { controlCurve, familyMassCurve, good },
          null,
          2,
        ),
    )

    expect(rows.length).toBe(
      slammerMasses.length *
        speeds.length *
        laterals.length *
        spinRadPerSec.length,
    )
  },
  120_000,
)
