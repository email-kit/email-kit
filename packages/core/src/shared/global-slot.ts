// A value on globalThis under a Symbol.for key, so every copy of @email-kit/core shares it.

export interface GlobalSlot<T> {
  get(): T | undefined
  run<R>(value: T | undefined, run: () => R): R
}

export function globalSlot<T>(name: string): GlobalSlot<T> {
  const key = Symbol.for(name)
  const store = globalThis as unknown as Record<symbol, T | undefined>
  return {
    get: () => store[key],
    run(value, run) {
      const previous = store[key]
      store[key] = value
      try {
        return run()
      } finally {
        store[key] = previous
      }
    },
  }
}
