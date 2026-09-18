export interface SlamTelemetrySample {
  pullPower: number
  pullDistance: number
  impactStrength: number
  timeToImpactMs: number | null
  resolutionMs: number
  flips: number
  missed: boolean
}
