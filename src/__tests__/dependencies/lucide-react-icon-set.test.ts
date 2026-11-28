/**
 * Regression test for the lucide-react icon-set floor.
 *
 * lucide-react 1.82.0 adds the `braces-sigma` icon and unifies the arrow
 * modifier icon shapes. The dashboard depends on the newer icon set, so the
 * manifest and the lockfile must agree on a resolution at or above 1.82.0
 * without needing a browser or a rendered component.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

interface LockPackage {
  version?: string;
  resolved?: string;
  integrity?: string;
}

interface Lockfile {
  lockfileVersion: number;
  packages: Record<string, LockPackage>;
}

const ICON_SET_FLOOR = "1.82.0";

function parseVersion(version: string): [number, number, number] {
  const parts = version.split("-")[0].split(".").map((part) => Number.parseInt(part, 10));
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

function greaterOrEqual(version: string, floor: string): boolean {
  const [major, minor, patch] = parseVersion(version);
  const [floorMajor, floorMinor, floorPatch] = parseVersion(floor);

  if (major !== floorMajor) return major > floorMajor;
  if (minor !== floorMinor) return minor > floorMinor;
  return patch >= floorPatch;
}

function commandVersion(range: string): [number, number, number] {
  const match = /^\s*[\^~]?\s*(\d+\.\d+\.\d+)/.exec(range);
  expect(match).not.toBeNull();
  return parseVersion(match![1]);
}

describe("lucide-react icon-set floor", () => {
  it("pins lucide-react 1.82.0 or later in the manifest and the lockfile", () => {
    const manifest = JSON.parse(
      readFileSync(path.resolve(process.cwd(), "package.json"), "utf8"),
    ) as { dependencies?: Record<string, string> };
    const lockfile = JSON.parse(
      readFileSync(path.resolve(process.cwd(), "package-lock.json"), "utf8"),
    ) as Lockfile;

    const range = manifest.dependencies?.["lucide-react"];
    expect(range).toBeTruthy();
    expect(greaterOrEqual(`${commandVersion(range!).join(".")}`, ICON_SET_FLOOR)).toBe(true);

    const resolved = lockfile.packages["node_modules/lucide-react"];
    expect(resolved?.version).toBeTruthy();
    expect(greaterOrEqual(resolved!.version!, ICON_SET_FLOOR)).toBe(true);

    // The lockfile entry must describe the same release the manifest asks for.
    expect(resolved!.resolved).toContain(`lucide-react-${resolved!.version}.tgz`);
    expect(resolved!.integrity).toMatch(/^sha512-/);
  });
});
