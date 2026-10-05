import "server-only";
import type { Tx } from "./db";

/**
 * Gap-free numbering (docs/architecture.md §3.2 invariant 5). Call inside the same transaction
 * that writes the numbered row, so a rollback also rolls back the number.
 *
 * Keys: „PACIENT”, „FACTURA:<serie>”, „CHITANTA:<serie>”.
 */
export async function nextSequence(tx: Tx, key: string): Promise<number> {
  const row = await tx.numberSequence.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
    select: { value: true },
  });
  return row.value;
}

/** Sequence keys used across packages. */
export const SEQUENCE_KEYS = {
  patient: "PACIENT",
  invoice: (series: string) => `FACTURA:${series}`,
  receipt: (series: string) => `CHITANTA:${series}`,
} as const;
