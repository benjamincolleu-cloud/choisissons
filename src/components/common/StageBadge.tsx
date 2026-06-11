import type { Stage } from '../../types'
import { STAGE_CONFIG } from '../../lib/constants'

export default function StageBadge({ stage }: { stage: Stage }) {
    const config = STAGE_CONFIG[stage]
    if (!config) return null
    const { label, color, icon: Icon } = config
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
            <Icon size={10} />
            {label}
        </span>
    )
}
