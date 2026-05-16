import type { RuleDefinition } from "@probity/types";
import { rule as riba } from "./riba.lending-protocol-interaction";
import { rule as sector } from "./haram-sector.exposure";
import { rule as maysir } from "./maysir.zero-sum-structures";
import { rule as gharar } from "./gharar.tokenomics-disclosure";
import { rule as governance } from "./governance.proposal-transparency";
import { rule as transparency } from "./transparency.metadata-immutability";

export const VERSION = "0.1.0";

// Order matters: rule outcomes are emitted in this order in verdicts and
// audit exports. Treat as part of the public surface of v0.1.0.
export const rules: RuleDefinition[] = [
  riba,
  sector,
  maysir,
  gharar,
  governance,
  transparency,
];
