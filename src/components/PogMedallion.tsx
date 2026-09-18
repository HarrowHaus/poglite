import { useMemo } from 'react'
import { createPogArtCanvas } from '../art/pogArt'
import { pogById } from '../game/content'
import type { PrintTreatment } from '../game/types'

export function PogMedallion({
  pogId,
  print = 'standard',
  size = 'normal',
}: {
  pogId: string
  print?: PrintTreatment
  size?: 'small' | 'normal' | 'large'
}) {
  const pog = pogById(pogId)
  const src = useMemo(
    () => createPogArtCanvas(pog, 0, 256).toDataURL(),
    [pog],
  )

  return (
    <div
      className={[
        'pog-medallion',
        pog.rarity,
        'print-' + print,
        'size-' + size,
      ].join(' ')}
      aria-label={pog.name + ', ' + pog.rarity + ', ' + print}
    >
      <img src={src} alt="" />
      {print !== 'standard' && <i>{print}</i>}
    </div>
  )
}
