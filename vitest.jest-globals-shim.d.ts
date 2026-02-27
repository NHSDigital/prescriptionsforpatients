import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, test, vi } from "vitest";
declare const jest: import("vitest").VitestUtils & {
    unstable_mockModule: {
        (path: string, factory?: import("vitest/dist/chunks/mocker.d.BE_2ls6u").M | import("vitest/dist/chunks/mocker.d.BE_2ls6u").a): void;
        <T>(module: Promise<T>, factory?: import("vitest/dist/chunks/mocker.d.BE_2ls6u").M<T> | import("vitest/dist/chunks/mocker.d.BE_2ls6u").a): void;
    };
};
export { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest, test, vi };
