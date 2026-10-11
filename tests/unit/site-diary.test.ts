import { describe, expect, it } from "vitest";
import { decodeSignature, diaryContentHash, signatureHash } from "@/lib/site-diary";

const base = {
  projectId: "p1",
  date: "2026-10-12",
  weather: "Rain",
  manpower: { Plumbing: 2, "General worker": 1, Tiling: 0 },
  machinery: ["Generator", "Crane"],
  materialsIn: [{ description: "Cement", vendor: null }],
  worksDone: "Laid pipes",
  issues: null,
  visitorLog: null,
  preparedById: "u1",
  preparedAtIso: "2026-10-12T10:00:00.000Z",
};

describe("site diary hashing", () => {
  it("ignores order and zero counts, but any real change alters the hash", () => {
    const h = diaryContentHash(base);
    expect(diaryContentHash({ ...base, manpower: { "General worker": 1, Plumbing: 2 }, machinery: ["Crane", "Generator"] })).toBe(h);
    for (const change of [{ weather: "Sunny" }, { worksDone: "Laid pipes." }, { manpower: { Plumbing: 3, "General worker": 1 } }, { issues: "Delay" }, { preparedById: "u2" }]) {
      expect(diaryContentHash({ ...base, ...change })).not.toBe(h);
    }
  });

  it("binds a signature to the content, the signer, the time and the drawing", () => {
    const png = new Uint8Array(300).fill(7);
    const h = diaryContentHash(base);
    const s = signatureHash(h, "u1", "2026-10-12T10:00:00.000Z", png);
    expect(signatureHash(h, "u2", "2026-10-12T10:00:00.000Z", png)).not.toBe(s);
    expect(signatureHash(h, "u1", "2026-10-12T10:00:01.000Z", png)).not.toBe(s);
    expect(signatureHash(h, "u1", "2026-10-12T10:00:00.000Z", new Uint8Array(300).fill(8))).not.toBe(s);
    expect(signatureHash(diaryContentHash({ ...base, weather: "Sunny" }), "u1", "2026-10-12T10:00:00.000Z", png)).not.toBe(s);
  });

  it("accepts only a real PNG data URL", () => {
    const magic = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(300, 1)]);
    expect(decodeSignature(`data:image/png;base64,${magic.toString("base64")}`)).not.toBeNull();
    expect(decodeSignature(`data:image/png;base64,${Buffer.alloc(400, 1).toString("base64")}`)).toBeNull();
    expect(decodeSignature("data:text/html;base64,AAAA")).toBeNull();
    expect(decodeSignature("")).toBeNull();
  });
});
