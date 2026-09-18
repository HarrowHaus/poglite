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
      <span className="pog-medallion-mark">{pog.face.mark}</span>
      <span className="pog-medallion-caption">{pog.face.caption}</span>
      <b>{pog.power}</b>
      {print !== 'standard' && <i>{print}</i>}
    </div>
  )
}
