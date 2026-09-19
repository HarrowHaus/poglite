import { expect, it } from 'vitest'
import { simulateAmmoShot } from './ammoPog'

const reportIt = process.env.POG_ENGINE_BAKEOFF ? it : it.skip

const speeds = [1.75, 2.25, 2.75, 3.25]
const laterals = [0.16, 0.24, 0.32]
const slammerFrictions = [0.2, 0.5, 0.9]
const restitutions = [0, 0.08]
const seeds = ['a', 'b', 'c', 'd']

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

reportIt(
  'searches for a plausible Bullet POG flip envelope',
  async () => {
    const rows = []

    for (const speedMps of speeds) {
      for (const lateralFraction of laterals) {
        for (const slammerFriction of slammerFrictions) {
          for (const slammerRestitution of restitutions) {
            const results = []

            for (const seed of seeds) {
              results.push(
                await simulateAmmoShot({
                  capMassKg: 0.0011,
                  slammerMassKg: 0.06,
                  speedMps,
                  lateralFraction,
                  spinRadPerSec: 0,
                  seed,
                  capFriction: 0.12,
                  capRestitution: 0.03,
                  tableFriction: 0.3,
                  tableRestitution: 0.03,
                  slammerFriction,
                  slammerRestitution,
                  capMarginM: 0.00003,
                  slammerMarginM: 0.00015,
                  tableMarginM: 0.0003,
                }),
              )
            }

            rows.push({
              speedMps,
              lateralFraction,
              slammerFriction,
              slammerRestitution,
              shots: results.length,
              avgFlips: mean(results.map((r) => r.finalFlips)),
              flipRate:
                results.filter((r) => r.finalFlips > 0).length /
                results.length,
              avgEverFaceUp: mean(
                results.map((r) => r.everFaceUpCount),
              ),
              avgRiseCm: mean(results.map((r) => r.maxRiseCm)),
              avgScatterCm: mean(
                results.map((r) => r.scatterRadiusCm),
              ),
              avgPitchRoll: mean(
                results.map((r) => r.maxPitchRollRadPerSec),
              ),
              avgSettleMs: mean(results.map((r) => r.settleMs)),
            })
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
          Math.max(0, a.avgScatterCm - 6) * 0.1 +
          Math.max(0, a.avgSettleMs - 650) / 700
        const bScore =
          Math.abs(b.avgFlips - 2.5) +
          Math.abs(b.flipRate - 0.8) +
          Math.max(0, b.avgScatterCm - 6) * 0.1 +
          Math.max(0, b.avgSettleMs - 650) / 700
        return aScore - bScore
      })
      .slice(0, 15)

    console.log(
      'POG_AMMO_ENVELOPE=' +
        JSON.stringify({ top, plausible }, null, 2),
    )

    expect(rows).toHaveLength(
      speeds.length *
        laterals.length *
        slammerFrictions.length *
        restitutions.length,
    )
  },
  120_000,
)
