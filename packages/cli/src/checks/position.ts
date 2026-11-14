/** A place in a text, with the line and column both counted from 1. */
export interface Position {
  readonly line: number
  readonly column: number
}

/**
 * A function that gives the line and column of an offset in `text`. The line starts are found
 * once, and each lookup is a binary search over them.
 */
export function positionsIn(text: string): (offset: number) => Position {
  const starts = [0]
  for (let i = 0; i < text.length; i++) if (text[i] === "\n") starts.push(i + 1)
  return (offset) => {
    let low = 0
    let high = starts.length - 1
    while (low < high) {
      const mid = (low + high + 1) >> 1
      if ((starts[mid] as number) <= offset) low = mid
      else high = mid - 1
    }
    return { line: low + 1, column: offset - (starts[low] as number) + 1 }
  }
}
