import { useEffect, useMemo, useState } from 'react'
import { PackReveal } from './PackReveal'
import { RewardTray } from './RewardTray'
import { SlamScene } from './SlamScene'
import { ENEMIES, POGS, pogById } from '../game/content'
import { useCollectionStore } from '../game/collectionStore'
import { isFinalEncounter } from '../game/run'
import { useGameStore } from '../game/store'
import { appHref, navigate } from '../navigation'
import { emitFeedback, onFeedback } from '../presentation/events'
import type { PackResult } from '../game/types'

function Meter({ value, max }: { value: number; max: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className="meter" aria-label={value + ' of ' + max}>
      <span style={{ width: pct + '%' }} />
    </div>
  )
}

export function GameShell() {
  const {
    runSeed,
    battle,
    encounterIndex,
    phase,
    rewards,
    slammer,
    lastResolution,
    completionPackClaimed,
    resolve,
    openReward,
    chooseReward,
    claimCompletionPack,
    restartRun,
  } = useGameStore()

  const entries = useCollectionStore((state) => state.entries)
  const openPack = useCollectionStore((state) => state.openPack)
  const activeStack = useCollectionStore((state) => state.activeStack)
  const ownedCount = POGS.filter((pog) => (entries[pog.id]?.copies ?? 0) > 0).length

  const enemy = ENEMIES[encounterIndex]
  const [impact, setImpact] = useState({ id: 0, strength: 0 })
  const [enemyHit, setEnemyHit] = useState({ id: 0, amount: 0 })
  const [playerHit, setPlayerHit] = useState({ id: 0, amount: 0 })
  const [showActivations, setShowActivations] = useState(false)
  const [completionPack, setCompletionPack] = useState<PackResult | null>(null)

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

  const handleOpenReward = () => {
    setShowActivations(false)
    openReward()
  }

  const handleChooseReward = (instanceId: string) => {
    setShowActivations(false)
    setEnemyHit((current) => ({ id: current.id, amount: 0 }))
    setPlayerHit((current) => ({ id: current.id, amount: 0 }))
    chooseReward(instanceId)
  }

  const handleCompletionPack = () => {
    if (!claimCompletionPack()) return
    const pack = openPack(runSeed + ':completion')
    setCompletionPack(pack)
  }

  const handleRestart = () => {
    setShowActivations(false)
    setEnemyHit({ id: 0, amount: 0 })
    setPlayerHit({ id: 0, amount: 0 })
    setCompletionPack(null)
    restartRun()
  }

  const encounterLabel = String(encounterIndex + 1).padStart(2, '0')
  const finalEncounter = isFinalEncounter(encounterIndex)

  return (
    <main className="game-shell">
      <header className="combat-hud">
        <div>
          <p className="eyebrow">
            ENCOUNTER {encounterLabel} / {String(ENEMIES.length).padStart(2, '0')}
          </p>
          <h1>{enemy.name}</h1>
          <Meter value={battle.enemyHp} max={battle.enemyMaxHp} />
          <p className="hud-number">{battle.enemyHp} / {battle.enemyMaxHp} HP</p>
        </div>

        <div className="combat-hud-actions">
          <a className="binder-shortcut" href={appHref('/stack')}>
            STACK
            <strong>{activeStack.length}/8</strong>
          </a>
          <a className="binder-shortcut" href={appHref('/binder')}>
            BINDER
            <strong>{ownedCount}/{POGS.length}</strong>
          </a>
          <div className="intent">
            <span>{battle.won ? 'DOWN' : 'NEXT'}</span>
            <strong>{battle.won ? '—' : enemy.attack}</strong>
            <small>{battle.won ? 'CLEARED' : 'DAMAGE'}</small>
          </div>
        </div>
      </header>

      <section className="table-stage">
        <SlamScene
          pogIds={activeStack}
          slammer={slammer}
          disabled={phase !== 'combat' || battle.won || battle.lost}
          onResolved={handleResolved}
        />

        {impact.id > 0 && phase === 'combat' && (
          <div
            key={'impact-' + impact.id}
            className="impact-flash"
            style={{ opacity: Math.max(0.12, impact.strength * 0.42) }}
          />
        )}

        {enemyHit.amount > 0 && phase === 'combat' && (
          <div key={'enemy-' + enemyHit.id} className="damage-pop enemy-damage">
            -{enemyHit.amount}
          </div>
        )}

        {playerHit.amount > 0 && phase === 'combat' && (
          <div key={'player-' + playerHit.id} className="damage-pop player-damage">
            -{playerHit.amount} HP
          </div>
        )}

        {showActivations && lastResolution && phase === 'combat' && (
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

        {phase === 'reward' && (
          <RewardTray rewards={rewards} onChoose={handleChooseReward} />
        )}

        {phase === 'complete' && !completionPack && (
          <div className="run-complete-overlay">
            <p className="eyebrow">RUN COMPLETE</p>
            <h2>Five fights. Still standing.</h2>
            {!completionPackClaimed ? (
              <>
                <p>Your permanent reward is waiting.</p>
                <button onClick={handleCompletionPack}>OPEN 5-POG PACK</button>
              </>
            ) : (
              <>
                <p>The completion pack is already in your binder.</p>
                <div className="run-complete-actions">
                  <a href="/binder">VIEW BINDER</a>
                  <button onClick={handleRestart}>RUN IT AGAIN</button>
                </div>
              </>
            )}
          </div>
        )}

        {completionPack && (
          <PackReveal
            pack={completionPack}
            onDone={() => {
              setCompletionPack(null)
              navigate('/binder')
            }}
          />
        )}

        <div className="slam-instruction">
          {completionPack
            ? 'PACK REVEAL'
            : phase === 'reward'
              ? 'CHOOSE ONE'
              : phase === 'complete'
                ? 'RUN COMPLETE'
                : battle.won
                  ? finalEncounter ? 'FINAL ENCOUNTER CLEARED' : 'REWARD READY'
                  : battle.lost
                    ? 'RUN ENDED'
                    : 'GRAB SLAMMER · PULL BACK · RELEASE'}
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

        {lastResolution && phase === 'combat' && (
          <div className="resolution-strip">
            <span>{lastResolution.flippedPogIds.length} FLIPPED</span>
            <strong>{lastResolution.totalDamage} DAMAGE</strong>
            {lastResolution.guardGained > 0 && <span>+{lastResolution.guardGained} GUARD</span>}
          </div>
        )}

        {phase === 'combat' && battle.won && (
          <button className="reset-button" onClick={handleOpenReward}>
            {finalEncounter ? 'FINISH RUN' : 'OPEN REWARD'}
          </button>
        )}

        {phase === 'combat' && battle.lost && (
          <button className="reset-button danger" onClick={handleRestart}>
            RESTART RUN
          </button>
        )}
      </footer>
    </main>
  )
}
