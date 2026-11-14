const waveBarHeights = (count: number, seed: number): number[] =>
  Array.from({ length: count }, (_, i) => {
    const v = (Math.sin(i * 0.6 + seed) + Math.sin(i * 0.27 + seed * 2) + 2) / 4
    return 0.18 + v * 0.82
  })

export { waveBarHeights }
