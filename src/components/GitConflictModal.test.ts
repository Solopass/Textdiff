import { describe, it, expect } from "vitest";
import { parseGitConflict } from "./GitConflictModal";

describe("parseGitConflict", () => {
  it("parses 2-way conflict without base", () => {
    const raw = `before
<<<<<<< HEAD
local line
=======
remote line
>>>>>>> branch
after`;

    const result = parseGitConflict(raw);
    expect(result.orig).toBe("before\nlocal line\nafter");
    expect(result.mod).toBe("before\nremote line\nafter");
    expect(result.isThreeWay).toBe(false);
    expect(result.base).toBeUndefined();
  });

  it("parses 3-way conflict with base (diff3 format)", () => {
    const raw = `header
<<<<<<< HEAD
ours
||||||| base
common ancestor
=======
theirs
>>>>>>> incoming
footer`;

    const result = parseGitConflict(raw);
    expect(result.orig).toBe("header\nours\nfooter");
    expect(result.base).toBe("header\ncommon ancestor\nfooter");
    expect(result.mod).toBe("header\ntheirs\nfooter");
    expect(result.isThreeWay).toBe(true);
  });
});
