export function GrowthSparkline({ values }) {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const points = values
    .map((value, index) => {
      const x = 12 + index * (276 / (values.length - 1))
      const y = 112 - ((value - min) / range) * 78
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg className="h-full w-full" viewBox="0 0 300 132" role="img" aria-label="Growth trend over the last seven days">
      <defs>
        <linearGradient id="growthFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#7fb069" stopOpacity="0.34" />
          <stop offset="100%" stopColor="#7fb069" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`M12 120 L${points} L288 120 Z`} fill="url(#growthFill)" />
      <polyline fill="none" points={points} stroke="#9bcf82" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5" />
      {values.map((value, index) => {
        const x = 12 + index * (276 / (values.length - 1))
        const y = 112 - ((value - min) / range) * 78
        return <circle key={value + index} cx={x} cy={y} r="3.5" fill="#d8f3c9" />
      })}
    </svg>
  )
}
