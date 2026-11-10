export interface GlobalSlot<T> {
  /** The current value, or `undefined` outside `run()`. */
  get(): T | undefined
  /** Sets the value while `fn` runs, then puts the previous value back, even if `fn` throws. */
  run<R>(value: T | undefined, fn: () => R): R
}

/**
 * A value that code deep inside a template can read without it being passed down, such as the
 * theme being compiled. It lives on `globalThis` under `Symbol.for(name)`, so every installed copy
 * of @email-kit/core reads the same value.
 */
export function globalSlot<T>(name: string): GlobalSlot<T> {
  const key = Symbol.for(name)
  const store = globalThis as unknown as Record<symbol, T | undefined>
  return {
    get: () => store[key],
    run(value, fn) {
      const previous = store[key]
      store[key] = value
      try {
        return fn()
      } finally {
        store[key] = previous
      }
    },
  }
}
