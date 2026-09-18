import { expect, it } from 'vitest'
import {
  simulateRealScaleShot,
  type RealScaleShotMetrics,
} from './realScalePog'

const reportIt = process.env.POG_PHYSICS_REPORT ? it : it.skip

const capMasses = [0.0007, 0.0011, 0.0016]
const slammerMasses = [0.03, 0.06, 0.09]
const speeds = [2.5, 4, 5.5]
const tilts = [0, 10, 20]
const laterals = [0, 0.18, 0.32]
const spins = [0, 18]
const seeds = ['a', 'b']

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

interface Summary {
  capMassKg: number
  slammerMassKg: number
  speedMps: number
  tiltDeg: number
  lateralFraction: number
  spinRadPerSec: number
  shots: number
  avgFlips: number
  flipRate: number
  avgEverFaceUp: number
  everRate: number
  avgMaxRiseCm: number
  avgScatterCm: number
  avgSettleMs: number
  avgPitchRoll: number
}

reportIt(
  'searches physically scaled POG collision envelope',
  async () => {
    const summaries: Summary[] = []

    for (const capMassKg of capMasses) {
      for (const slammerMassKg of slammerMasses) {
        for (const speedMps of speeds) {
          for (const tiltDeg of tilts) {
            for (const lateralFraction of laterals) {
              for (const spinRadPerSec of spins) {
                const results: RealScaleShotMetrics[] = []

                for (const seed of seeds) {
                  results.push(
                    await simulateRealScaleShot({
                      capMassKg,
                      slammerMassKg,
                      speedMps,
                      tiltDeg,
                      lateralFraction,
                      spinRadPerSec,
                      seed,
                    }),
                  )
                }

                summaries.push({
                  capMassKg,
                  slammerMassKg,
                  speedMps,
                  tiltDeg,
                  lateralFraction,
                  spinRadPerSec,
                  shots: results.length,
                  avgFlips: mean(results.map((r) => r.finalFlips)),
                  flipRate:
                    results.filter((r) => r.anyFlip).length / results.length,
                  avgEverFaceUp: mean(
                    results.map((r) => r.everFaceUpCount),
                  ),
                  everRate:
                    results.filter((r) => r.anyEverFaceUp).length /
                    results.length,
                  avgMaxRiseCm: mean(results.map((r) => r.maxRiseCm)),
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
      }
    }

    const top = [...summaries]
      .sort((a, b) => b.avgFlips - a.avgFlips)
      .slice(0, 20)

    const playable = summaries
      .filter(
        (s) =>
          s.flipRate >= 0.5 &&
          s.avgFlips >= 0.75 &&
          s.avgFlips <= 4.5 &&
          s.avgScatterCm <= 12 &&
          s.avgSettleMs <= 1150,
      )
      .sort((a, b) => {
        const scoreA =
          Math.abs(a.avgFlips - 2.25) +
          Math.abs(a.flipRate - 0.8) +
          Math.max(0, a.avgScatterCm - 7) * 0.08
        const scoreB =
          Math.abs(b.avgFlips - 2.25) +
          Math.abs(b.flipRate - 0.8) +
          Math.max(0, b.avgScatterCm - 7) * 0.08
        return scoreA - scoreB
      })
      .slice(0, 20)

    console.log(
      'POG_REAL_SCALE_SEARCH=' +
        JSON.stringify({ top, playable }, null, 2),
    )

    expect(summaries.length).toBe(
      capMasses.length *
        slammerMasses.length *
        speeds.length *
        tilts.length *
        laterals.length *
        spins.length,
    )
  },
  120_000,
)
