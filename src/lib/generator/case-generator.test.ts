import { describe, expect, it } from "vitest";
import { generateBatch } from "./case-generator";

const CONFIG = { seed: "test-seed", caseCount: 60, demoEmailBase: "demo@example.com", demoEmailPoolSize: 10 };

describe("generateBatch", () => {
  it("is deterministic for a given seed", () => {
    const a = generateBatch(CONFIG);
    const b = generateBatch(CONFIG);
    expect(a.cases.map((c) => c.customer_id)).toEqual(b.cases.map((c) => c.customer_id));
    expect(a.totalAtRisk).toBe(b.totalAtRisk);
  });

  it("gives some customers more than one case, so shared memory has something to read", () => {
    const { cases } = generateBatch(CONFIG);
    const counts = new Map<string, number>();
    for (const c of cases) counts.set(c.customer_id, (counts.get(c.customer_id) ?? 0) + 1);

    const repeatCustomers = [...counts.values()].filter((n) => n > 1).length;
    const casesWithHistory = [...counts.values()].filter((n) => n > 1).reduce((sum, n) => sum + n, 0);

    expect(repeatCustomers).toBeGreaterThan(0);
    // A meaningful share of the batch should belong to a returning customer —
    // one lucky collision isn't enough to demonstrate the feature.
    expect(casesWithHistory / cases.length).toBeGreaterThan(0.15);
    // ...but they must not collapse onto a handful of identities either.
    expect(counts.size).toBeGreaterThan(cases.length * 0.4);
  });

  it("keeps a customer's tier consistent across their cases", () => {
    const { cases } = generateBatch(CONFIG);
    const tierById = new Map<string, string>();
    for (const c of cases) {
      const seen = tierById.get(c.customer_id);
      if (seen) expect(c.customer_tier, `customer ${c.customer_id}`).toBe(seen);
      else tierById.set(c.customer_id, c.customer_tier);
    }
  });

  it("always includes a stop candidate and an escalation candidate", () => {
    const { cases } = generateBatch({ ...CONFIG, caseCount: 12 });
    expect(cases.some((c) => c.contact_attempts >= 3)).toBe(true);
    expect(cases.some((c) => c.customer_tier === "b2b" && c.amount >= 80000)).toBe(true);
  });

  it("rejects batch sizes outside the supported range", () => {
    expect(() => generateBatch({ ...CONFIG, caseCount: 0 })).toThrow();
    expect(() => generateBatch({ ...CONFIG, caseCount: 501 })).toThrow();
  });
});
