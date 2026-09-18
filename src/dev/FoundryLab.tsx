import { useMemo, useState } from 'react'
import { createPogArtCanvas, pogArtRecipe } from '../art/pogArt'
import { POGS, pogById } from '../game/content'

function Preview({
  pogId,
  variant,
}: {
  pogId: string
  variant: number
}) {
  const pog = pogById(pogId)
  const src = useMemo(
    () => createPogArtCanvas(pog, variant, 320).toDataURL(),
    [pog, variant],
  )
  const recipe = pogArtRecipe(pogId, variant)

  return (
    <article className="foundry-candidate">
      <img src={src} alt={pog.name + ' art variant ' + variant} />
      <div>
        <strong>VARIANT {variant}</strong>
        <span>{recipe.pattern}</span>
      </div>
    </article>
  )
}

export function FoundryLab() {
  const [pogId, setPogId] = useState(POGS[0].id)
  const pog = pogById(pogId)

  return (
    <main className="lab-page">
      <header className="lab-header">
        <div>
          <p className="eyebrow">DEV / FOUNDRY</p>
          <h1>POG art search space</h1>
          <p>
            Deterministic candidates from one curated visual grammar. The chosen variant can later be locked as authored content.
          </p>
        </div>
        <label>
          POG
          <select value={pogId} onChange={(event) => setPogId(event.target.value)}>
            {POGS.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>{candidate.name}</option>
            ))}
          </select>
        </label>
      </header>

      <section className="foundry-current">
        <div>
          <p className="eyebrow">CURRENT IDENTITY</p>
          <h2>{pog.name}</h2>
          <p>{pog.face.mark} / {pog.face.caption} · {pog.power} Power</p>
        </div>
        <p>
          These are visual candidates only. Selecting a prettier design never changes combat output.
        </p>
      </section>

      <section className="foundry-grid">
        {Array.from({ length: 24 }, (_, variant) => (
          <Preview key={variant} pogId={pogId} variant={variant} />
        ))}
      </section>
    </main>
  )
}
