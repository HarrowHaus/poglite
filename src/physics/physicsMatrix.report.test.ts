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
  capRestitution: number
  tableRestitution: number
  slammerRestitution: number
  capMass: number
  impulseScale: number
}

const profiles: Profile[] = [
  {
    name: 'tilt-spin-dead',
    baseTilt: 0.13,
    extraTilt: 0.16,
    spinScale: 1,
    capRestitution: 0.03,
    tableRestitution: 0,
    slammerRestitution: 0.09,
    capMass: 0.08,
    impulseScale: 1,
  },
  {
    name: 'tilt-spin-lively',
    baseTilt: 0.13,
    extraTilt: 0.16,
    spinScale: 1,
    capRestitution: 0.22,
    tableRestitution: 0.35,
    slammerRestitution: 0.22,
    capMass: 0.08,
    impulseScale: 1,
  },
  {
    name: 'steep-tilt',
    baseTilt: 0.28,
    extraTilt: 0.28,
    spinScale: 1,
    capRestitution: 0.18,
    tableRestitution: 0.30,
    slammerRestitution: 0.20,
    capMass: 0.08,
    impulseScale: 1,
  },
  {
    name: 'heavy-hit',
    baseTilt: 0.28,
    extraTilt: 0.28,
    spinScale: 1.1,
    capRestitution: 0.20,
    tableRestitution: 0.34,
    slammerRestitution: 0.22,
    capMass: 0.04,
    impulseScale: 1.5,
  },
  {
    name: 'extreme-rigid',
    baseTilt: 0.40,
    extraTilt: 0.30,
    spinScale: 1.3,
    capRestitution: 0.24,
    tableRestitution: 0.40,
    slammerRestitution: 0.28,
    capMass: 0.025,
    impulseScale: 2,
  },
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
    avgEverFaceUpCount: mean(
      results.map((result) => result.everFaceUpCount),
    ),
    anyEverFaceUpRate:
      results.filter((result) => result.everFaceUpCount > 0).length /
      results.length,
    avgMaxCapRise: mean(results.map((result) => result.maxCapRise)),
    avgMeanMaxCapRise: mean(
      results.map((result) => result.meanMaxCapRise),
    ),
    avgMaxUpDot: mean(results.map((result) => result.maxUpDot)),
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
                  capRestitution: profile.capRestitution,
                  tableRestitution: profile.tableRestitution,
                  slammerRestitution: profile.slammerRestitution,
                  capMass: profile.capMass,
                  impulseScale: profile.impulseScale,
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
