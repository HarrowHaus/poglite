import { expect, it } from 'vitest'
import { simulateJoltShot } from './joltPog'

const reportIt = process.env.POG_ENGINE_BAKEOFF ? it : it.skip

const speeds = [4, 5, 6]
const laterals = [0.32, 0.4, 0.5]
const slammerFrictions = [0.9, 1.5]
const slammerRestitutions = [0.18, 0.35]
const slammerConvexRadii = [0.00005, 0.0004]
const seeds = ['a', 'b', 'c', 'd']

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

reportIt(
  'searches for a plausible Jolt POG flip envelope',
  async () => {
    const rows = []

    for (const speedMps of speeds) {
      for (const lateralFraction of laterals) {
        for (const slammerFriction of slammerFrictions) {
          for (const slammerRestitution of slammerRestitutions) {
            for (const slammerConvexRadiusM of slammerConvexRadii) {
              const results = []

              for (const seed of seeds) {
                results.push(
                  await simulateJoltShot({
                    capMassKg: 0.0011,
                    slammerMassKg: 0.06,
                    speedMps,
                    lateralFraction,
                    spinRadPerSec: 0,
                    seed,
                    slammerFriction,
                    slammerRestitution,
                    slammerConvexRadiusM,
                    capConvexRadiusM: 0.00005,
                  }),
                )
              }

              rows.push({
                speedMps,
                lateralFraction,
                slammerFriction,
                slammerRestitution,
                slammerConvexRadiusM,
                shots: results.length,
                avgFlips: mean(results.map((result) => result.finalFlips)),
                flipRate:
                  results.filter((result) => result.finalFlips > 0).length /
                  results.length,
                avgEverFaceUp: mean(
                  results.map((result) => result.everFaceUpCount),
                ),
                avgRiseCm: mean(
                  results.map((result) => result.maxRiseCm),
                ),
                avgScatterCm: mean(
                  results.map((result) => result.scatterRadiusCm),
                ),
                avgPitchRoll: mean(
                  results.map((result) => result.maxPitchRollRadPerSec),
                ),
                avgSettleMs: mean(
                  results.map((result) => result.settleMs),
                ),
              })
            }
          }
        }
      }
    }

    const top = [...rows]
      .sort((a, b) => b.avgFlips - a.avgFlips)
      .slice(0, 15)

    const plausible = rows
      .filter(
        (row) =>
          row.avgFlips >= 1 &&
          row.avgFlips <= 4.5 &&
          row.flipRate >= 0.5 &&
          row.avgScatterCm <= 12 &&
          row.avgSettleMs <= 1000,
      )
      .sort((a, b) => {
        const aScore =
          Math.abs(a.avgFlips - 2.5) +
          Math.abs(a.flipRate - 0.8) +
          Math.max(0, a.avgSettleMs - 650) / 700
        const bScore =
          Math.abs(b.avgFlips - 2.5) +
          Math.abs(b.flipRate - 0.8) +
          Math.max(0, b.avgSettleMs - 650) / 700
        return aScore - bScore
      })
      .slice(0, 15)

    console.log(
      'POG_JOLT_ENVELOPE=' +
        JSON.stringify({ top, plausible }, null, 2),
    )

    expect(rows).toHaveLength(
      speeds.length *
        laterals.length *
        slammerFrictions.length *
        slammerRestitutions.length *
        slammerConvexRadii.length,
    )
  },
  120_000,
)
