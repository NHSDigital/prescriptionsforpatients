export type EventHeaders = Record<string, string | undefined>

// Custom error classes for error flow control
export class SpineCertNotConfiguredError extends Error {
  constructor() {
    super("Spine certificate is not configured")
    this.name = "SpineCertNotConfiguredError"
  }
}

export class PrescriptionTimeoutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PrescriptionTimeoutError"
  }
}

export class TC008TestError extends Error {
  constructor() {
    super("Test NHS number corresponding to TC008 has been received")
    this.name = "TC008TestError"
  }
}
