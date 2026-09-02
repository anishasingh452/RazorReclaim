import { createHash } from "crypto";

export const GENESIS_HASH = "GENESIS";

export interface HashableAuditEntry {
  case_id: string;
  event_type: string;
  actor: string;
  detail: Record<string, unknown>;
  model_version: string | null;
  created_at: string;
}

/**
 * JSON.stringify with object keys sorted (recursively) so the output
 * doesn't depend on key insertion order. Needed because Postgres's `jsonb`
 * column type does NOT preserve key insertion order on storage — unlike
 * `json`, it re-orders keys internally — so a plain JSON.stringify of a
 * `detail` object read back from the database can differ from the string
 * used to compute its hash at insert time, even though the data is
 * identical. Arrays keep their order (order is semantically meaningful
 * there); only object keys are sorted.
 */
function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalStringify).join(",")}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const body = keys
    .map((k) => `${JSON.stringify(k)}:${canonicalStringify((value as Record<string, unknown>)[k])}`)
    .join(",");
  return `{${body}}`;
}

/**
 * Deterministic SHA-256 hash of one audit entry chained to the previous
 * entry's hash, so tampering with (or deleting) any row in a case's audit
 * trail is detectable — verifyChain below recomputes and compares.
 * `created_at` must be generated in application code (not left to the DB
 * default) so the hash covers the exact value that gets stored.
 *
 * Two normalizations happen before hashing, both required for a hash
 * computed at insert time to still match after the row round-trips through
 * Postgres and back:
 *  - `created_at` is parsed and re-serialized to a canonical ISO string —
 *    Postgres's `timestamptz` comes back as `...+00:00` while JS's own
 *    `Date.toISOString()` (used when building rows for insert) produces
 *    `...Z` for the same instant.
 *  - `detail` (and every other object) is stringified with sorted keys —
 *    see canonicalStringify above.
 */
export function computeAuditHash(prevHash: string, entry: HashableAuditEntry): string {
  const canonical = canonicalStringify({
    prevHash,
    case_id: entry.case_id,
    event_type: entry.event_type,
    actor: entry.actor,
    detail: entry.detail,
    model_version: entry.model_version,
    created_at: new Date(entry.created_at).toISOString(),
  });
  return createHash("sha256").update(canonical).digest("hex");
}

export interface ChainedAuditRow extends HashableAuditEntry {
  prev_hash: string;
  hash: string;
}

export interface AuditEntryDraft {
  case_id: string;
  event_type: string;
  actor: string;
  detail: Record<string, unknown>;
  model_version?: string | null;
}

/**
 * Builds locally-chained audit rows ready for a single bulk insert, instead
 * of N sequential read-then-write round trips through appendAudit(). Each
 * distinct `case_id` in `entries` gets its OWN chain starting from
 * `startPrevHash` (GENESIS by default) — entries for different cases may be
 * freely interleaved in the input; this groups by case_id internally so
 * that's always safe. Only use this for a case's first events (e.g. at
 * batch-seed time, before any other audit writes exist for it), since every
 * case's chain here starts fresh from genesis. Timestamps are forced
 * strictly increasing per case so chain order is unambiguous even when
 * entries are generated within the same millisecond.
 */
export function buildAuditChain(entries: AuditEntryDraft[], startPrevHash: string = GENESIS_HASH): ChainedAuditRow[] {
  const prevByCase = new Map<string, string>();
  const seqByCase = new Map<string, number>();
  const base = Date.now();

  return entries.map((e) => {
    const prev = prevByCase.get(e.case_id) ?? startPrevHash;
    const seq = seqByCase.get(e.case_id) ?? 0;
    const created_at = new Date(base + seq).toISOString();

    const row: ChainedAuditRow = {
      case_id: e.case_id,
      event_type: e.event_type,
      actor: e.actor,
      detail: e.detail,
      model_version: e.model_version ?? null,
      created_at,
      prev_hash: prev,
      hash: "",
    };
    row.hash = computeAuditHash(prev, row);

    prevByCase.set(e.case_id, row.hash);
    seqByCase.set(e.case_id, seq + 1);
    return row;
  });
}

/**
 * Verifies an ordered (oldest-first) audit trail for one case: each row's
 * `hash` must equal computeAuditHash(row.prev_hash, row), and each row's
 * `prev_hash` must equal the previous row's `hash` (or GENESIS for the
 * first). Returns the index of the first broken row, or null if the whole
 * chain is intact.
 */
export function verifyChain(rows: ChainedAuditRow[]): number | null {
  let expectedPrev = GENESIS_HASH;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.prev_hash !== expectedPrev) return i;
    if (computeAuditHash(row.prev_hash, row) !== row.hash) return i;
    expectedPrev = row.hash;
  }
  return null;
}
