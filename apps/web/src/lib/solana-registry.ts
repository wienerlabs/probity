// Thin re-export so server components and pages can reflect the registry
// without each importing from a workspace package directly.
import { PROGRAM_REGISTRY, listKnownPrograms } from "@probity/solana";

export { PROGRAM_REGISTRY, listKnownPrograms };

export function programCountByKind(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of PROGRAM_REGISTRY) {
    out[p.kind] = (out[p.kind] ?? 0) + 1;
  }
  return out;
}
