/**
 * Regression test for the @upstash/ratelimit 2.2.3 peer dependency floor.
 *
 * @upstash/ratelimit 2.2.3 requires @upstash/redis 1.41.1 or later. The
 * lockfile is the install contract, so assert that the resolved pair meets
 * that floor without needing a live Redis instance.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

interface LockPackage {
  version?: string;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

interface Lockfile {
  lockfileVersion: number;
  packages: Record<string, LockPackage>;
}

const lockfile = JSON.parse(
  readFileSync(path.resolve(process.cwd(), "package-lock.json"), "utf8"),
) as Lockfile;

const RATELIMIT_FLOOR = "2.2.3";
const REDIS_FLOOR = "1.41.1";

function parseVersion(version: string): [number, number, number] {
  const parts = version.split(".").map((part) => Number.parseInt(part, 10));
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

function greaterOrEqual(version: string, floor: string): boolean {
  const [major, minor, patch] = parseVersion(version);
  const [floorMajor, floorMinor, floorPatch] = parseVersion(floor);

  if (major !== floorMajor) return major > floorMajor;
  if (minor !== floorMinor) return minor > floorMinor;
  return patch >= floorPatch;
}

function satisfiesCaret(version: string, range: string): boolean {
  expect(range.startsWith("^")).toBe(true);
  const floor = range.slice(1);
  const [major] = parseVersion(version);
  const [floorMajor] = parseVersion(floor);
  return major === floorMajor && greaterOrEqual(version, floor);
}

describe("@upstash/ratelimit peer dependency floor", () => {
  it("resolves @upstash/ratelimit 2.2.3+ against @upstash/redis 1.41.1+", () => {
    const ratelimit = lockfile.packages["node_modules/@upstash/ratelimit"];
    const redis = lockfile.packages["node_modules/@upstash/redis"];
    const peerRange = ratelimit?.peerDependencies?.["@upstash/redis"];

    expect(ratelimit?.version).toBeTruthy();
    expect(greaterOrEqual(ratelimit!.version!, RATELIMIT_FLOOR)).toBe(true);
    expect(peerRange).toBe(`^${REDIS_FLOOR}`);

    expect(redis?.version).toBeTruthy();
    expect(greaterOrEqual(redis!.version!, REDIS_FLOOR)).toBe(true);
    expect(satisfiesCaret(redis!.version!, peerRange!)).toBe(true);
  });
});
