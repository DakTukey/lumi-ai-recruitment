// Balance groups so the final radar never contains just one or two axes.
export function radarGroups(count: number): number[][] {
  const maximum = 8
  if (count < 3) return []
  const groupCount = Math.ceil(count / maximum)
  const size = Math.floor(count / groupCount)
  let start = 0
  return Array.from({ length: groupCount }, (_, group) => {
    const length = size + (group < count % groupCount ? 1 : 0)
    const indices = Array.from({ length }, (_, offset) => start + offset)
    start += length
    return indices
  })
}

export function radarPoint(index: number, count: number, value: number, radius = 100) {
  const angle = -Math.PI / 2 + (index * Math.PI * 2) / count
  const distance = (Math.max(0, Math.min(100, value)) / 100) * radius
  return { x: 180 + Math.cos(angle) * distance, y: 170 + Math.sin(angle) * distance }
}

export function radarLabel(name: string): string[] {
  const words = name.trim().split(/\s+/)
  const lines = ['']
  for (const word of words) {
    const last = lines.length - 1
    if (lines[last] && `${lines[last]} ${word}`.length > 17) lines.push(word)
    else lines[last] = `${lines[last]} ${word}`.trim()
  }
  return lines.slice(0, 2).map((line, index) => {
    const truncated = line.length > 18 || (index === 1 && lines.length > 2)
    return truncated ? `${line.slice(0, 16)}…` : line
  })
}
