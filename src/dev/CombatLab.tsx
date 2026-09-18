import { useMemo, useState } from 'react'
import { ENEMIES, POGS } from '../game/content'
import { initialBattleState, resolveSlam } from '../game/combat'
import { rollSlammer } from '../game/loot'

export function CombatLab() {
  const [flipped, setFlipped] = useState<string[]>(['big-dog', 'brain-freeze', 'bootleg-dragon'])
  const enemy = ENEMIES[0]
  const slammer = useMemo(() => rollSlammer('combat-lab', 7), [])
  const resolution = resolveSlam(initialBattleState(enemy), enemy, slammer, flipped)

  return (
    <main className="lab-page">
      <header className="lab-header">
        <div>
          <p className="eyebrow">DEV / COMBAT</p>
          <h1>Math microscope</h1>
          <p>The player should never need this screen. We do.</p>
        </div>
      </header>

      <section className="combat-lab-grid">
        <div className="pog-picker">
          {POGS.map((pog) => {
            const active = flipped.includes(pog.id)
            return (
              <button
                key={pog.id}
                className={active ? 'active' : ''}
                onClick={() =>
                  setFlipped(active
                    ? flipped.filter((id) => id !== pog.id)
                    : [...flipped, pog.id])
                }
              >
                <strong>{pog.name}</strong>
                <span>{pog.power} Power</span>
              </button>
            )
          })}
        </div>

        <article className="math-card">
          <p className={'rarity ' + slammer.rarity}>{slammer.rarity}</p>
          <h2>{slammer.name}</h2>
          <dl>
            <div><dt>POG damage</dt><dd>{resolution.pogDamage}</dd></div>
            <div><dt>Slammer</dt><dd>{resolution.slammerDamage}</dd></div>
            <div><dt>Bonuses</dt><dd>{resolution.bonusDamage}</dd></div>
            <div className="total"><dt>Total</dt><dd>{resolution.totalDamage}</dd></div>
            <div><dt>Guard gained</dt><dd>{resolution.guardGained}</dd></div>
            <div><dt>Damage taken</dt><dd>{resolution.playerDamageTaken}</dd></div>
          </dl>
        </article>
      </section>
    </main>
  )
}
