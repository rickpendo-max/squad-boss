export function calculateSplitTotal(splitSeconds: string[]) {
  if (
    splitSeconds.length === 0 ||
    splitSeconds.some((split) => {
      const seconds = Number(split)
      return split.trim() === '' || !Number.isFinite(seconds) || seconds <= 0
    })
  ) {
    return undefined
  }

  const total = splitSeconds.reduce((sum, split) => sum + Number(split), 0)

  return Math.round(total * 100) / 100
}
