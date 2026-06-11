import { useState, useEffect } from 'react'

export default function CountUp({ value, duration = 1800 }: { value: number; duration?: number }) {
    const [count, setCount] = useState(0)
    useEffect(() => {
        if (value === 0) { // eslint-disable-next-line react-hooks/set-state-in-effect
            setCount(0); return }
        const start = performance.now()
        let rafId: number
        const tick = (now: number) => {
            const elapsed = now - start
            const progress = Math.min(elapsed / duration, 1)
            const eased = 1 - Math.pow(1 - progress, 3)
            setCount(Math.round(eased * value))
            if (progress < 1) rafId = requestAnimationFrame(tick)
        }
        rafId = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(rafId)
    }, [value, duration])
    return <>{count.toLocaleString('fr-FR')}</>
}
