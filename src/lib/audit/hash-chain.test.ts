import { describe, expect, it } from "vitest";
import { buildAuditChain, computeAuditHash, GENESIS_HASH, verifyChain, type ChainedAuditRow } from "./hash-chain";

function entry(overrides: Partial<ChainedAuditRow> = {}): ChainedAuditRow {
  return {
    case_id: "case-1",
    event_type: "SIGNAL_DETECTED",
    actor: "system",
    detail: { foo: "bar" },
    model_version: null,
    created_at: "2026-01-01T00:00:00.000Z",
    prev_hash: GENESIS_HASH,
    hash: "",
    ...overrides,
  };
}

describe("computeAuditHash", () => {
  it("is deterministic for identical input", () => {
    const e = entry();
    expect(computeAuditHash(e.prev_hash, e)).toBe(computeAuditHash(e.prev_hash, e));
  });

  it("changes when any field changes", () => {
    const base = entry();
    const h1 = computeAuditHash(base.prev_hash, base);
    const h2 = computeAuditHash(base.prev_hash, { ...base, detail: { foo: "baz" } });
    const h3 = computeAuditHash(base.prev_hash, { ...base, event_type: "CASE_CREATED" });
    const h4 = computeAuditHash("different-prev", base);
    expect(new Set([h1, h2, h3, h4]).size).toBe(4);
  });

  it("produces the identical hash for a timestamp in Z format vs Postgres's +00:00 format for the same instant (regression: found via real E2E DB round-trip)", () => {
    const e = entry({ created_at: "2026-01-01T00:00:00.000Z" });
    const ePostgres = entry({ created_at: "2026-01-01T00:00:00.000+00:00" });
    expect(computeAuditHash(e.prev_hash, e)).toBe(computeAuditHash(ePostgres.prev_hash, ePostgres));
  });

  it("produces the identical hash regardless of `detail` object key order (regression: Postgres jsonb does not preserve key insertion order)", () => {
    const inOrder = entry({ detail: { risk_type: "failed_payment", amount: 100, customer_tier: "smb" } });
    const reordered = entry({ detail: { amount: 100, risk_type: "failed_payment", customer_tier: "smb" } });
    expect(computeAuditHash(inOrder.prev_hash, inOrder)).toBe(computeAuditHash(reordered.prev_hash, reordered));
  });

  it("still distinguishes genuinely different detail content regardless of key order", () => {
    const a = entry({ detail: { amount: 100, risk_type: "failed_payment" } });
    const b = entry({ detail: { amount: 999, risk_type: "failed_payment" } });
    expect(computeAuditHash(a.prev_hash, a)).not.toBe(computeAuditHash(b.prev_hash, b));
  });

  it("preserves array order as semantically meaningful (does not sort array elements)", () => {
    const a = entry({ detail: { items: ["x", "y"] } });
    const b = entry({ detail: { items: ["y", "x"] } });
    expect(computeAuditHash(a.prev_hash, a)).not.toBe(computeAuditHash(b.prev_hash, b));
  });

  it("sorts keys within nested objects too, not just the top level", () => {
    const a = entry({ detail: { outer: { z: 1, a: 2 } } });
    const b = entry({ detail: { outer: { a: 2, z: 1 } } });
    expect(computeAuditHash(a.prev_hash, a)).toBe(computeAuditHash(b.prev_hash, b));
  });

  it("produces a 64-char hex sha256 digest", () => {
    const e = entry();
    expect(computeAuditHash(e.prev_hash, e)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("verifyChain", () => {
  it("validates a correctly chained sequence", () => {
    const e1 = entry({ event_type: "SIGNAL_DETECTED", prev_hash: GENESIS_HASH });
    e1.hash = computeAuditHash(e1.prev_hash, e1);
    const e2 = entry({ event_type: "CASE_CREATED", prev_hash: e1.hash });
    e2.hash = computeAuditHash(e2.prev_hash, e2);
    const e3 = entry({ event_type: "AI_DIAGNOSIS", prev_hash: e2.hash });
    e3.hash = computeAuditHash(e3.prev_hash, e3);

    expect(verifyChain([e1, e2, e3])).toBeNull();
  });

  it("detects a tampered detail field", () => {
    const e1 = entry({ event_type: "SIGNAL_DETECTED", prev_hash: GENESIS_HASH });
    e1.hash = computeAuditHash(e1.prev_hash, e1);
    const e2 = entry({ event_type: "CASE_CREATED", prev_hash: e1.hash });
    e2.hash = computeAuditHash(e2.prev_hash, e2);

    const tampered = { ...e2, detail: { foo: "TAMPERED" } };
    expect(verifyChain([e1, tampered])).toBe(1);
  });

  it("detects a row removed from the middle of the chain", () => {
    const e1 = entry({ event_type: "SIGNAL_DETECTED", prev_hash: GENESIS_HASH });
    e1.hash = computeAuditHash(e1.prev_hash, e1);
    const e2 = entry({ event_type: "CASE_CREATED", prev_hash: e1.hash });
    e2.hash = computeAuditHash(e2.prev_hash, e2);
    const e3 = entry({ event_type: "AI_DIAGNOSIS", prev_hash: e2.hash });
    e3.hash = computeAuditHash(e3.prev_hash, e3);

    // e2 deleted — e3.prev_hash no longer matches e1.hash
    expect(verifyChain([e1, e3])).toBe(1);
  });

  it("detects a broken genesis link", () => {
    const e1 = entry({ prev_hash: "not-genesis" });
    e1.hash = computeAuditHash(e1.prev_hash, e1);
    expect(verifyChain([e1])).toBe(0);
  });

  it("treats an empty chain as valid", () => {
    expect(verifyChain([])).toBeNull();
  });
});

describe("buildAuditChain", () => {
  it("produces a valid, verifiable chain from genesis for a fresh case", () => {
    const rows = buildAuditChain([
      { case_id: "case-1", event_type: "SIGNAL_DETECTED", actor: "system", detail: { source: "gateway" } },
      { case_id: "case-1", event_type: "CASE_CREATED", actor: "system", detail: { amount: 5000 } },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0].prev_hash).toBe(GENESIS_HASH);
    expect(rows[1].prev_hash).toBe(rows[0].hash);
    expect(verifyChain(rows)).toBeNull();
  });

  it("assigns strictly increasing timestamps even for entries built in the same tick", () => {
    const rows = buildAuditChain([
      { case_id: "case-1", event_type: "A", actor: "system", detail: {} },
      { case_id: "case-1", event_type: "B", actor: "system", detail: {} },
      { case_id: "case-1", event_type: "C", actor: "system", detail: {} },
    ]);
    const times = rows.map((r) => new Date(r.created_at).getTime());
    expect(times[1]).toBeGreaterThan(times[0]);
    expect(times[2]).toBeGreaterThan(times[1]);
  });

  it("defaults model_version to null when omitted", () => {
    const rows = buildAuditChain([{ case_id: "c", event_type: "X", actor: "system", detail: {} }]);
    expect(rows[0].model_version).toBeNull();
  });

  it("chains onto a supplied startPrevHash instead of GENESIS", () => {
    const rows = buildAuditChain([{ case_id: "c", event_type: "X", actor: "system", detail: {} }], "some-prior-hash");
    expect(rows[0].prev_hash).toBe("some-prior-hash");
  });

  it("produces independent, individually valid chains per case_id when interleaved", () => {
    const rows = buildAuditChain([
      { case_id: "case-1", event_type: "SIGNAL_DETECTED", actor: "system", detail: {} },
      { case_id: "case-2", event_type: "SIGNAL_DETECTED", actor: "system", detail: {} },
      { case_id: "case-1", event_type: "CASE_CREATED", actor: "system", detail: {} },
      { case_id: "case-2", event_type: "CASE_CREATED", actor: "system", detail: {} },
    ]);

    // Interleaving must not leak one case's hash into another's chain: both
    // cases' first events chain from GENESIS, not from each other.
    const case1 = rows.filter((r) => r.case_id === "case-1");
    const case2 = rows.filter((r) => r.case_id === "case-2");
    expect(case1[0].prev_hash).toBe(GENESIS_HASH);
    expect(case2[0].prev_hash).toBe(GENESIS_HASH);
    expect(case1[1].prev_hash).toBe(case1[0].hash);
    expect(case2[1].prev_hash).toBe(case2[0].hash);
    expect(verifyChain(case1)).toBeNull();
    expect(verifyChain(case2)).toBeNull();
  });
});
