import { POGS, SLAMMER_FAMILIES } from '../game/content'
import type { PogDefinition } from '../game/types'

function effectText(pog: PogDefinition) {
  if (!pog.effect) return 'Pure Power.'
  if (pog.effect.kind === 'guard') return 'Gain ' + pog.effect.amount + ' Guard.'
  return 'Flip ' + pog.effect.minimumFlips + '+: +' + pog.effect.amount + ' damage.'
}

export function CatalogLab() {
  return (
    <main className="lab-page catalog-lab">
      <header className="lab-header">
        <div>
          <p className="eyebrow">DEV / CATALOG</p>
          <h1>Content wall</h1>
          <p>
            Twenty POGs, two effect forms. The point is to see whether authored content can feel broad
            before the rules vocabulary grows.
          </p>
        </div>
      </header>

      <section className="catalog-grid">
        {POGS.map((pog) => (
          <article className="catalog-card" key={pog.id}>
            <div className={'catalog-pog ' + pog.rarity}>
              <span className="catalog-pog-mark">{pog.face.mark}</span>
              <span className="catalog-pog-caption">{pog.face.caption}</span>
              <b>{pog.power}</b>
            </div>
            <div>
              <span className={'rarity ' + pog.rarity}>{pog.rarity}</span>
              <h2>{pog.name}</h2>
              <p>{effectText(pog)}</p>
            </div>
          </article>
        ))}
      </section>

      <header className="lab-header catalog-section-header">
        <div>
          <p className="eyebrow">SLAMMERS</p>
          <h1>Six physical families</h1>
          <p>
            Different silhouettes and mass/impulse envelopes; generated level, rarity and affixes live on top.
          </p>
        </div>
      </header>

      <section className="slammer-catalog">
        {SLAMMER_FAMILIES.map((family) => (
          <article key={family.id}>
            <div
              className="slammer-silhouette"
              style={{
                width: 54 + family.physics.radius * 45,
                height: 12 + family.physics.thickness * 95,
              }}
            />
            <h2>{family.name}</h2>
            <dl>
              <div><dt>Base Power</dt><dd>{family.basePower}</dd></div>
              <div><dt>Mass</dt><dd>{family.physics.mass.toFixed(2)}</dd></div>
              <div><dt>Impulse</dt><dd>{family.physics.slamImpulse.toFixed(1)}</dd></div>
              <div><dt>Radius</dt><dd>{family.physics.radius.toFixed(2)}</dd></div>
            </dl>
          </article>
        ))}
      </section>
    </main>
  )
}
