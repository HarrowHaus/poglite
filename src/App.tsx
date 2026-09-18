import { lazy, Suspense, useEffect } from 'react'
import { Binder } from './components/Binder'
import { GameShell } from './components/GameShell'
import { StackBuilder } from './components/StackBuilder'
import { appPath } from './navigation'
import { installFeedbackAudio } from './presentation/audio'

const CatalogLab = lazy(() =>
  import('./dev/CatalogLab').then((module) => ({ default: module.CatalogLab })),
)
const FoundryLab = lazy(() =>
  import('./dev/FoundryLab').then((module) => ({ default: module.FoundryLab })),
)
const CombatLab = lazy(() =>
  import('./dev/CombatLab').then((module) => ({ default: module.CombatLab })),
)
const LootLab = lazy(() =>
  import('./dev/LootLab').then((module) => ({ default: module.LootLab })),
)
const PackLab = lazy(() =>
  import('./dev/PackLab').then((module) => ({ default: module.PackLab })),
)
const SlamLab = lazy(() =>
  import('./dev/SlamLab').then((module) => ({ default: module.SlamLab })),
)

function DevRoute({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<main className="lab-page"><p>Loading developer tools…</p></main>}>
      {children}
    </Suspense>
  )
}

export function App() {
  useEffect(() => installFeedbackAudio(), [])

  const path = appPath()
  if (path === '/stack') return <StackBuilder />
  if (path === '/binder') return <Binder />
  if (path === '/dev/pack') return <DevRoute><PackLab /></DevRoute>
  if (path === '/dev/foundry') return <DevRoute><FoundryLab /></DevRoute>
  if (path === '/dev/catalog') return <DevRoute><CatalogLab /></DevRoute>
  if (path === '/dev/loot') return <DevRoute><LootLab /></DevRoute>
  if (path === '/dev/combat') return <DevRoute><CombatLab /></DevRoute>
  if (path === '/dev/slam') return <DevRoute><SlamLab /></DevRoute>
  return <GameShell />
}
