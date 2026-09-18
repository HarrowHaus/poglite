import { useEffect } from 'react'
import { GameShell } from './components/GameShell'
import { CombatLab } from './dev/CombatLab'
import { LootLab } from './dev/LootLab'
import { SlamLab } from './dev/SlamLab'
import { installFeedbackAudio } from './presentation/audio'

export function App() {
  useEffect(() => installFeedbackAudio(), [])

  const path = window.location.pathname
  if (path === '/dev/loot') return <LootLab />
  if (path === '/dev/combat') return <CombatLab />
  if (path === '/dev/slam') return <SlamLab />
  return <GameShell />
}
