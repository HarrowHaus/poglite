export function normalizeImpactForce(forceMagnitude: number): number {
  if (!Number.isFinite(forceMagnitude) || forceMagnitude <= 0) return 0
  const normalized = Math.log1p(forceMagnitude) / Math.log1p(260)
  return Math.max(0, Math.min(1, normalized))
}
