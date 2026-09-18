import { SlamScene } from './SlamScene'
import { ENEMIES, STARTER_STACK } from '../game/content'
import { useGameStore } from '../game/store'

function Meter({ value, max }: { value: number; max: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className="meter" aria-label={value + ' of ' + max}>
      <span style={{ width: pct + '%' }} />
    </div>
  )
}

export function GameShell() {
  const { battle, slammer, lastResolution, resolve, reset } = useGameStore()
  const enemy = ENEMIES[0]

  return (
    <main className="game-shell">
      <header className="combat-hud">
        <div>
          <p className="eyebrow">ENCOUNTER 01</p>
          <h1>{enemy.name}</h1>
          <Meter value={battle.enemyHp} max={battle.enemyMaxHp} />
          <p className="hud-number">{battle.enemyHp} / {battle.enemyMaxHp} HP</p>
        </div>
        <div className="intent">
          <span>NEXT</span>
          <strong>{enemy.attack}</strong>
          <small>DAMAGE</small>
        </div>
      </header>

      <section className="table-stage">
        <SlamScene
          pogIds={STARTER_STACK}
          slammer={slammer}
          disabled={battle.won || battle.lost}
          onResolved={resolve}
        />
        <div className="slam-instruction">MOVE TO AIM · TAP TABLE TO SLAM</div>
      </section>

      <footer className="player-hud">
        <div className="slammer-card">
          <p className={'rarity ' + slammer.rarity}>{slammer.rarity}</p>
          <h2>{slammer.name}</h2>
          <strong>{slammer.power} POWER</strong>
          {slammer.affixes.map((affix) => (
            <small key={affix.id}>{affix.text}</small>
          ))}
        </div>

        <div className="player-status">
          <div><span>HP</span><strong>{battle.playerHp}</strong></div>
          <div><span>GUARD</span><strong>{battle.guard}</strong></div>
          <div><span>TURN</span><strong>{battle.turn}</strong></div>
        </div>

        {lastResolution && (
          <div className="resolution-strip">
            <span>{lastResolution.flippedPogIds.length} FLIPPED</span>
            <strong>{lastResolution.totalDamage} DAMAGE</strong>
            {lastResolution.guardGained > 0 && <span>+{lastResolution.guardGained} GUARD</span>}
          </div>
        )}

        {(battle.won || battle.lost) && (
          <button className="reset-button" onClick={reset}>
            {battle.won ? 'RUN IT BACK' : 'TRY AGAIN'}
          </button>
        )}
      </footer>
    </main>
  )
}
