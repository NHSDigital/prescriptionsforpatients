export interface Timeout {
  isTimeout: true
}
export async function jobWithTimeout<T>(timeoutMS: number, job: Promise<T>): Promise<T | Timeout> {
  const timeoutPromise: Promise<Timeout> = new Promise((resolve) => {
    setTimeout(() => {
      resolve({isTimeout: true})
    }, timeoutMS)
  })
  return Promise.race([job, timeoutPromise])
}

export function hasTimedOut<T>(response: T | Timeout): response is Timeout{
  return !!(response as Timeout)?.isTimeout
}

export const NHS_LOGIN_HEADER = "nhsd-nhslogin-user"
export const PROOFING_LEVEL = "P9"
