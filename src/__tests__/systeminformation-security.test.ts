/**
 * Regression test for the systeminformation security pin (GHSA-3f7j-7jwc-fxfj).
 *
 * systeminformation is a transitive dependency of @dotenvx/dotenvx
 * (declared as ^5.22.11). The advisory is fixed in 5.33.16; the lockfile
 * must resolve the package to that patched version or newer.
 *
 * This test fails on the pre-fix lockfile (5.33.1) and passes once the
 * lockfile pins 5.33.16+, guarding the security pin from regressing.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function parsePatchVersion(version: string): number {
  const parts = version.split(".");
  return Number(parts[2] ?? 0);
}

describe("systeminformation CVE pin (GHSA-3f7j-7jwc-fxfj)", () => {
  it("locks systeminformation to the patched version (>= 5.33.16)", () => {
    const lockfilePath = join(__dirname, "../../package-lock.json");
    const lockfile = JSON.parse(readFileSync(lockfilePath, "utf8"));
    const pkg = lockfile.packages?.["node_modules/systeminformation"];

    expect(pkg, "systeminformation entry missing from package-lock.json").toBeDefined();

    const [major, minor] = pkg.version.split(".").map(Number);
    expect(major).toBe(5);
    expect(minor).toBeGreaterThanOrEqual(33);

    if (minor === 33) {
      expect(parsePatchVersion(pkg.version)).toBeGreaterThanOrEqual(16);
    }
  });
});
