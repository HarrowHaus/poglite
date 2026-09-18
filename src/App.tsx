import { useEffect } from 'react'
import { Binder } from './components/Binder'
import { GameShell } from './components/GameShell'
import { CatalogLab } from './dev/CatalogLab'
import { CombatLab } from './dev/CombatLab'
import { LootLab } from './dev/LootLab'
import { PackLab } from './dev/PackLab'
import { SlamLab } from './dev/SlamLab'
import { installFeedbackAudio } from './presentation/audio'

export function App() {
  useEffect(() => installFeedbackAudio(), [])

  const path = window.location.pathname
  if (path === '/binder') return <Binder />
  if (path === '/dev/pack') return <PackLab />
  if (path === '/dev/catalog') return <CatalogLab />
  if (path === '/dev/loot') return <LootLab />
  if (path === '/dev/combat') return <CombatLab />
  if (path === '/dev/slam') return <SlamLab />
  return <GameShell />
}
