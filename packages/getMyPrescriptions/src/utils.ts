export function deepCopy<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

export type Milliseconds = number
export interface Timeout {
  isTimeout: true
}
export async function jobWithTimeout<T>(timeout: Milliseconds, job: Promise<T>): Promise<T | Timeout> {
  const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => {
      resolve({isTimeout: true})
    }, timeout)
  }) as Promise<Timeout>
  return Promise.race([job, timeoutPromise])
}

export function hasTimedOut<T>(response: T | Timeout): response is Timeout{
  return !!(response as Timeout)?.isTimeout
}
