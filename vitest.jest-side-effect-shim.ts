import {expect} from "vitest"
import {jest} from "./vitest.jest-globals-shim"

Object.assign(globalThis, {expect, jest})
