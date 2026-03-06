declare namespace jest {
  type MockedFunction<T extends (...args: any[]) => any> = T & {
    mockResolvedValue(value: Awaited<ReturnType<T>>): this;
    mockRejectedValue(error: unknown): this;
    mockImplementation(fn: T): this;
  };
}

declare const describe: typeof import("vitest").describe;
declare const it: typeof import("vitest").it;
declare const test: typeof import("vitest").test;
declare const expect: typeof import("vitest").expect;
declare const beforeEach: typeof import("vitest").beforeEach;
declare const afterEach: typeof import("vitest").afterEach;
declare const beforeAll: typeof import("vitest").beforeAll;
declare const afterAll: typeof import("vitest").afterAll;
declare const jest: typeof import("vitest").vi & {
  unstable_mockModule: typeof import("vitest").vi.doMock;
};

declare module "@jest/globals" {
  export * from "vitest";
  export const jest: typeof import("vitest").vi & {
    unstable_mockModule: typeof import("vitest").vi.doMock;
  };
}

declare module "jest" {}

declare module "expect" {
  export type MatcherFunction<T extends any[] = any[]> = (
    this: {utils: {printReceived(value: unknown): string; printExpected(value: unknown): string}},
    actual: unknown,
    ...expected: T
  ) => {pass: boolean; message: () => string};
}
