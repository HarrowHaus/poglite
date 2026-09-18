import { expect, it } from 'vitest'
import {
  simulateVerticalShot,
  type HeadlessShotMetrics,
} from './headlessPog'

interface Profile {
  name: string
  baseTilt: number
  extraTilt: number
  spinScale: number
}

const profiles: Profile[] = [
  { name: 'flat-no-spin', baseTilt: 0, extraTilt: 0, spinScale: 0 },
  { name: 'flat-spin', baseTilt: 0, extraTilt: 0, spinScale: 1 },
  { name: 'tilt-no-spin', baseTilt: 0.13, extraTilt: 0.16, spinScale: 0 },
  { name: 'tilt-spin', baseTilt: 0.13, extraTilt: 0.16, spinScale: 1 },
]

const powers = [0.55, 0.75, 1]
const laterals = [-1, -0.5, 0, 0.5, 1]
const seeds = ['a', 'b', 'c']
const families = ['steel-puncher', 'brass-drop']

function mean(values: number[]) {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0
}

function nullableMean(values: Array<number | null>) {
  return mean(values.filter((value): value is number => value !== null))
}

function summarize(results: HeadlessShotMetrics[]) {
  return {
    shots: results.length,
    avgFlips: mean(results.map((result) => result.flips)),
    anyFlipRate:
      results.filter((result) => result.flips > 0).length / results.length,
    avgContactEccentricity: nullableMean(
      results.map((result) => result.contactEccentricity),
    ),
    avgContactNormalTiltDeg: nullableMean(
      results.map((result) => result.contactNormalTiltDeg),
    ),
    avgNormalImpulse: mean(
      results.map((result) => result.totalNormalImpulse),
    ),
    avgTangentImpulse: mean(
      results.map((result) => result.totalTangentImpulse),
    ),
    avgTangentRatio: mean(
      results.map((result) => result.tangentToNormalRatio),
    ),
    avgPeakPitchRoll: mean(
      results.map((result) => result.maxCapPitchRollSpeed),
    ),
    avgMeanPitchRoll: mean(
      results.map((result) => result.meanCapPitchRollSpeed),
    ),
    avgScatterRadius: mean(
      results.map((result) => result.scatterRadius),
    ),
    avgMaxHeight: mean(results.map((result) => result.maxHeight)),
    avgSettleMs: mean(results.map((result) => result.settleMs)),
  }
}

const reportIt = process.env.POG_PHYSICS_REPORT ? it : it.skip

reportIt(
  'reports controlled flip-mechanism comparison',
  async () => {
    const report: Record<string, unknown> = {}

    for (const profile of profiles) {
      const results: HeadlessShotMetrics[] = []

      for (const familyId of families) {
        for (const power of powers) {
          for (const lateral of laterals) {
            for (const jitterSeed of seeds) {
              results.push(
                await simulateVerticalShot({
                  familyId,
                  power,
                  lateral,
                  jitterSeed,
                  baseTilt: profile.baseTilt,
                  extraTilt: profile.extraTilt,
                  spinScale: profile.spinScale,
                }),
              )
            }
          }
        }
      }

      const lateralGroups = Object.fromEntries(
        laterals.map((lateral) => [
          String(lateral),
          summarize(
            results.filter((result) => result.lateral === lateral),
          ),
        ]),
      )

      report[profile.name] = {
        overall: summarize(results),
        byLateral: lateralGroups,
      }
    }

    console.log(
      'POG_PHYSICS_REPORT=' +
        JSON.stringify(report, null, 2),
    )

    expect(Object.keys(report)).toHaveLength(profiles.length)
  },
  60_000,
)
