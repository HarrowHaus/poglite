import { slammerFamilyById } from '../game/content'
import type { GeneratedSlammer } from '../game/types'

export function RewardTray({
  rewards,
  onChoose,
}: {
  rewards: GeneratedSlammer[]
  onChoose: (instanceId: string) => void
}) {
  return (
    <div className="reward-overlay">
      <div className="reward-heading">
        <p className="eyebrow">ENCOUNTER CLEARED</p>
        <h2>Pick a slammer.</h2>
        <p>One choice. Next fight starts immediately.</p>
      </div>

      <div className="reward-grid">
        {rewards.map((reward) => {
          const family = slammerFamilyById(reward.familyId)
          return (
            <button
              className={'reward-card ' + reward.rarity}
              key={reward.instanceId}
              onClick={() => onChoose(reward.instanceId)}
            >
              <span className={'rarity ' + reward.rarity}>{reward.rarity}</span>
              <div
                className="reward-slammer"
                style={{
                  width: 60 + family.physics.radius * 54,
                  height: 10 + family.physics.thickness * 92,
                }}
              />
              <h3>{reward.name}</h3>
              <strong>{reward.power} POWER</strong>
              <div className="reward-affixes">
                {reward.affixes.length > 0
                  ? reward.affixes.map((affix) => <small key={affix.id}>{affix.text}</small>)
                  : <small>Clean roll.</small>}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
