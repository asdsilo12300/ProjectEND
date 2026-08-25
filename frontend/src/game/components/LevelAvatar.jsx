import { resolveAssetUrl } from '../../lib/api'
import './LevelAvatar.css'

const PROFILE_FRAME_TIERS = [
  { key: 'mythic', minLevel: 50, asset: '/media/profile-frames/level-50-mythic.svg' },
  { key: 'royal', minLevel: 40, asset: '/media/profile-frames/level-40-royal.svg' },
  { key: 'crystal', minLevel: 30, asset: '/media/profile-frames/level-30-crystal.svg' },
  { key: 'amber', minLevel: 25, asset: '/media/profile-frames/level-25-amber.svg' },
  { key: 'silver', minLevel: 10, asset: '/media/profile-frames/level-10-silver.svg' },
  { key: 'bronze', minLevel: 5, asset: '/media/profile-frames/level-05-bronze.svg' },
]

function getProfileFrameTier(level) {
  const normalizedLevel = Math.max(1, Number(level) || 1)
  return PROFILE_FRAME_TIERS.find((tier) => normalizedLevel >= tier.minLevel) ?? null
}

function userLevel(user) {
  return Number(user?.level ?? user?.level_progress?.level ?? 1) || 1
}

export function LevelAvatar({
  user,
  fallback,
  className = '',
  imageClassName = '',
  portraitClassName = '',
  showBaseRing = true,
  decorative = false,
}) {
  const level = userLevel(user)
  const tier = getProfileFrameTier(level)
  const avatarUrl = user?.avatar_url ? resolveAssetUrl(user.avatar_url) : ''
  const frameLabel = tier ? `Level ${level} ${tier.key} profile frame` : `Level ${level} profile`

  return (
    <span
      aria-hidden={decorative ? 'true' : undefined}
      aria-label={decorative ? undefined : frameLabel}
      className={`level-avatar ${tier ? `level-avatar--${tier.key}` : 'level-avatar--plain'} ${className}`}
      data-profile-frame={tier?.key ?? 'plain'}
      title={frameLabel}
    >
      <span className={`level-avatar__portrait ${showBaseRing ? 'level-avatar__portrait--ringed' : ''} ${portraitClassName}`}>
        <span className="level-avatar__fallback">{fallback}</span>
        {avatarUrl ? (
          <img
            className={`level-avatar__photo ${imageClassName}`}
            src={avatarUrl}
            alt=""
            onError={(event) => { event.currentTarget.hidden = true }}
          />
        ) : null}
      </span>
      {tier ? <img aria-hidden="true" className="level-avatar__frame" src={tier.asset} alt="" /> : null}
    </span>
  )
}
