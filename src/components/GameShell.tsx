import { useEffect, useMemo, useState } from 'react'
import { SlamScene } from './SlamScene'
import { ENEMIES, STARTER_STACK, pogById } from '../game/content'
import { useGameStore } from '../game/store'
import { emitFeedback, onFeedback } from '../presentation/events'

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
  const [impact, setImpact] = useState({ id: 0, strength: 0 })
  const [enemyHit, setEnemyHit] = useState({ id: 0, amount: 0 })
  const [playerHit, setPlayerHit] = useState({ id: 0, amount: 0 })
  const [showActivations, setShowActivations] = useState(false)

  const activatedPogs = useMemo(
    () => lastResolution?.flippedPogIds.map(pogById) ?? [],
    [lastResolution],
  )

  useEffect(
    () =>
      onFeedback((event) => {
        if (event.type === 'slam:start') {
          setShowActivations(false)
          return
        }

        if (event.type === 'slam:impact') {
          setImpact((current) => ({
            id: current.id + 1,
            strength: event.strength,
          }))
          return
        }

        if (event.type === 'slam:resolved') {
          setShowActivations(true)
        }
      }),
    [],
  )

  const handleResolved = (flippedPogIds: string[]) => {
    const result = resolve(flippedPogIds)

    if (result.totalDamage > 0) {
      setEnemyHit((current) => ({ id: current.id + 1, amount: result.totalDamage }))
      emitFeedback({ type: 'combat:enemy-hit', amount: result.totalDamage })
    }

    if (result.playerDamageTaken > 0) {
      setPlayerHit((current) => ({
        id: current.id + 1,
        amount: result.playerDamageTaken,
      }))
      emitFeedback({ type: 'combat:player-hit', amount: result.playerDamageTaken })
    }
  }

  const handleReset = () => {
    setShowActivations(false)
    reset()
  }

  return (
    <main className={'game-shell' + (playerHit.amount > 0 ? ' has-player-hit' : '')}>
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
          onResolved={handleResolved}
        />

        {impact.id > 0 && (
          <div
            key={'impact-' + impact.id}
            className="impact-flash"
            style={{ opacity: Math.max(0.12, impact.strength * 0.42) }}
          />
        )}

        {enemyHit.id > 0 && (
          <div key={'enemy-' + enemyHit.id} className="damage-pop enemy-damage">
            -{enemyHit.amount}
          </div>
        )}

        {playerHit.id > 0 && (
          <div key={'player-' + playerHit.id} className="damage-pop player-damage">
            -{playerHit.amount} HP
          </div>
        )}

        {showActivations && lastResolution && (
          <div className="activation-readout" aria-live="polite">
            <div className="activation-summary">
              <strong>{lastResolution.totalDamage}</strong>
              <span>DAMAGE</span>
            </div>
            <div className="activation-caps">
              {activatedPogs.length > 0 ? (
                activatedPogs.map((pog) => (
                  <span key={pog.id} className={'activation-chip ' + pog.rarity}>
                    <b>{pog.face.mark}</b>
                    <small>{pog.power}</small>
                  </span>
                ))
              ) : (
                <span className="activation-miss">NO POGS FLIPPED</span>
              )}
            </div>
          </div>
        )}

        <div className="slam-instruction">
          {battle.won
            ? 'ENCOUNTER CLEARED'
            : battle.lost
              ? 'RUN ENDED'
              : 'MOVE TO AIM · TAP TABLE TO SLAM'}
        </div>
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
          <button className="reset-button" onClick={handleReset}>
            {battle.won ? 'RUN IT BACK' : 'TRY AGAIN'}
          </button>
        )}
      </footer>
    </main>
  )
}
