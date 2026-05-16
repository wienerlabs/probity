import type { RuleDefinition } from "@probity/types";
import { rules as v0_1_0, VERSION as V0_1_0 } from "./v0.1.0";

const REGISTRY: Record<string, RuleDefinition[]> = {
  [V0_1_0]: v0_1_0,
};

export function loadRuleSet(version: string): RuleDefinition[] {
  const rs = REGISTRY[version];
  if (!rs) {
    throw new Error(
      `Unknown rule version: ${version}. Known: ${Object.keys(REGISTRY).join(", ")}`,
    );
  }
  return rs;
}

export function listRuleVersions(): string[] {
  return Object.keys(REGISTRY).sort();
}

export { V0_1_0 };
