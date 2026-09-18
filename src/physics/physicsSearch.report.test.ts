import { expect, it } from 'vitest'
import { simulateVerticalShot } from './headlessPog'

interface Candidate {
  capMass: number
  impulseScale: number
  baseTilt: number
  spinScale: number
}

interface CandidateSummary extends Candidate {
  shots: number
  avgFlips: number
  anyFlipRate: number
  anyEverFaceUpRate: number
  avgEverFaceUpCount: number
  avgMaxCapRise: number
  avgScatterRadius: number
  avgSettleMs: number
  avgPeakPitchRoll: number
}

const reportIt = process.env.POG_PHYSICS_REPORT ? it : it.skip

const capMasses = [0.015, 0.02, 0.025]
const impulseScales = [1.8, 2.2, 2.6]
const baseTilts = [0.25, 0.35, 0.45]
const spinScales = [1, 1.3]

const powers = [0.75, 1]
const laterals = [-1, 0, 1]
const seeds = ['a', 'b']

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

reportIt(
  'searches the pure-rigid POG flip envelope',
  async () => {
    const summaries: CandidateSummary[] = []

    for (const capMass of capMasses) {
      for (const impulseScale of impulseScales) {
        for (const baseTilt of baseTilts) {
          for (const spinScale of spinScales) {
            const candidate: Candidate = {
              capMass,
              impulseScale,
              baseTilt,
              spinScale,
            }

            const results = []

            for (const power of powers) {
              for (const lateral of laterals) {
                for (const jitterSeed of seeds) {
                  results.push(
                    await simulateVerticalShot({
                      familyId: 'steel-puncher',
                      power,
                      lateral,
                      jitterSeed,
                      baseTilt,
                      extraTilt: 0.3,
                      spinScale,
                      capRestitution: 0.22,
                      tableRestitution: 0.35,
                      slammerRestitution: 0.22,
                      capMass,
                      impulseScale,
                    }),
                  )
                }
              }
            }

            summaries.push({
              ...candidate,
              shots: results.length,
              avgFlips: mean(results.map((r) => r.flips)),
              anyFlipRate:
                results.filter((r) => r.flips > 0).length / results.length,
              anyEverFaceUpRate:
                results.filter((r) => r.everFaceUpCount > 0).length /
                results.length,
              avgEverFaceUpCount: mean(
                results.map((r) => r.everFaceUpCount),
              ),
              avgMaxCapRise: mean(results.map((r) => r.maxCapRise)),
              avgScatterRadius: mean(
                results.map((r) => r.scatterRadius),
              ),
              avgSettleMs: mean(results.map((r) => r.settleMs)),
              avgPeakPitchRoll: mean(
                results.map((r) => r.maxCapPitchRollSpeed),
              ),
            })
          }
        }
      }
    }

    const topByFlips = [...summaries]
      .sort((a, b) => b.avgFlips - a.avgFlips)
      .slice(0, 12)

    const balanced = summaries
      .filter(
        (candidate) =>
          candidate.anyFlipRate >= 0.5 &&
          candidate.avgFlips >= 0.75 &&
          candidate.avgFlips <= 4 &&
          candidate.avgScatterRadius <= 2.75,
      )
      .sort((a, b) => {
        const aScore =
          Math.abs(a.avgFlips - 2.25) +
          Math.abs(a.anyFlipRate - 0.85) * 1.5 +
          Math.max(0, a.avgSettleMs - 1050) / 1000
        const bScore =
          Math.abs(b.avgFlips - 2.25) +
          Math.abs(b.anyFlipRate - 0.85) * 1.5 +
          Math.max(0, b.avgSettleMs - 1050) / 1000
        return aScore - bScore
      })
      .slice(0, 12)

    console.log(
      'POG_PHYSICS_SEARCH=' +
        JSON.stringify({ topByFlips, balanced }, null, 2),
    )

    expect(summaries.length).toBe(
      capMasses.length *
        impulseScales.length *
        baseTilts.length *
        spinScales.length,
    )
  },
  60_000,
)
