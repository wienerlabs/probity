import type {
  RuleDefinition,
  RuleOutcome,
  ScreeningContext,
} from "@probity/types";

export const VERSION = "0.1.0";

const INTEREST_BEARING = "InterestBearingConfig";
const PERMANENT_DELEGATE = "PermanentDelegate";
const TRANSFER_FEE = "TransferFeeConfig";
const NON_TRANSFERABLE = "NonTransferable";
const TRANSFER_HOOK = "TransferHook";
const DEFAULT_ACCOUNT_STATE = "DefaultAccountState";
const MINT_CLOSE = "MintCloseAuthority";
const CONFIDENTIAL_TRANSFER = "ConfidentialTransferMint";

export const rule: RuleDefinition = {
  id: "token-2022.extensions",
  version: VERSION,
  material: true,
  category: "riba",
  description:
    "Inspects the Token-2022 extension set. InterestBearingConfig with a non-zero rate fails as direct riba; PermanentDelegate / TransferFee / restrictive DefaultAccountState surface as flags. Pre-Token-2022 mints pass trivially.",
  evaluate(ctx: ScreeningContext): RuleOutcome {
    const exts = ctx.state.extensions ?? [];
    if (!exts.length || ctx.state.tokenProgram !== "spl-token-2022") {
      return {
        ruleId: this.id,
        ruleVersion: this.version,
        category: this.category,
        material: this.material,
        outcome: "pass",
        rationale: "Legacy SPL Token mint; Token-2022 extension surface does not apply.",
        evidence: [
          {
            type: "onchain",
            account: ctx.state.mint,
            slot: ctx.state.snapshotSlot,
            field: "token_program",
            value: ctx.state.tokenProgram ?? "spl-token",
          },
        ],
      };
    }

    const findExt = (type: string) => exts.find((e) => e.type === type);

    const interestBearing = findExt(INTEREST_BEARING);
    const permanentDelegate = findExt(PERMANENT_DELEGATE);
    const transferFee = findExt(TRANSFER_FEE);
    const nonTransferable = findExt(NON_TRANSFERABLE);
    const transferHook = findExt(TRANSFER_HOOK);
    const defaultAccountState = findExt(DEFAULT_ACCOUNT_STATE);
    const mintClose = findExt(MINT_CLOSE);
    const confidentialTransfer = findExt(CONFIDENTIAL_TRANSFER);

    if (interestBearing) {
      const currentRate = Number(
        (interestBearing.details?.["currentRate"] as number | undefined) ?? 0,
      );
      const preRate = Number(
        (interestBearing.details?.["preUpdateAverageRate"] as number | undefined) ?? 0,
      );
      if (currentRate !== 0 || preRate !== 0) {
        return {
          ruleId: this.id,
          ruleVersion: this.version,
          category: this.category,
          material: this.material,
          outcome: "fail",
          rationale: `Token-2022 InterestBearingConfig active with rate ${currentRate} (pre-update ${preRate}). The token mechanically pays continuous interest accrual to holders — direct riba violation under AAOIFI screens.`,
          evidence: [
            {
              type: "onchain",
              account: ctx.state.mint,
              slot: ctx.state.snapshotSlot,
              field: "extension.InterestBearingConfig.currentRate",
              value: String(currentRate),
            },
            {
              type: "derivation",
              formula: "interestBearing.currentRate != 0 OR interestBearing.preUpdateAverageRate != 0",
              result: "riba_active",
            },
          ],
        };
      }
      return {
        ruleId: this.id,
        ruleVersion: this.version,
        category: this.category,
        material: this.material,
        outcome: "flag",
        rationale:
          "Token-2022 InterestBearingConfig present but rate is zero. Authority can flip on accrual at any time — flagged pending governance audit.",
        evidence: [
          {
            type: "onchain",
            account: ctx.state.mint,
            slot: ctx.state.snapshotSlot,
            field: "extension.InterestBearingConfig.currentRate",
            value: "0",
          },
          {
            type: "onchain",
            account: ctx.state.mint,
            slot: ctx.state.snapshotSlot,
            field: "extension.InterestBearingConfig.rateAuthority",
            value: String(interestBearing.details?.["rateAuthority"] ?? "null"),
          },
        ],
      };
    }

    const concerns: string[] = [];
    const evidence: RuleOutcome["evidence"] = [
      {
        type: "onchain",
        account: ctx.state.mint,
        slot: ctx.state.snapshotSlot,
        field: "token_program",
        value: "spl-token-2022",
      },
    ];

    if (permanentDelegate) {
      const delegate = permanentDelegate.details?.["delegate"];
      if (delegate && delegate !== null) {
        concerns.push("PermanentDelegate present — holder balances can be moved without consent");
        evidence.push({
          type: "onchain",
          account: ctx.state.mint,
          slot: ctx.state.snapshotSlot,
          field: "extension.PermanentDelegate.delegate",
          value: String(delegate),
        });
      }
    }

    if (transferFee) {
      const newer = transferFee.details?.["newerTransferFee"] as
        | { transferFeeBasisPoints?: number }
        | undefined;
      const bps = newer?.transferFeeBasisPoints ?? 0;
      if (bps > 0) {
        concerns.push(`TransferFeeConfig active at ${bps} bps — fees accrue to fee authority`);
        evidence.push({
          type: "onchain",
          account: ctx.state.mint,
          slot: ctx.state.snapshotSlot,
          field: "extension.TransferFeeConfig.newerTransferFee.bps",
          value: String(bps),
        });
      }
    }

    if (nonTransferable) {
      concerns.push("NonTransferable extension makes the token non-tradeable; treat as soulbound");
      evidence.push({
        type: "onchain",
        account: ctx.state.mint,
        slot: ctx.state.snapshotSlot,
        field: "extension.NonTransferable",
        value: "true",
      });
    }

    if (transferHook) {
      const programId = transferHook.details?.["programId"];
      if (programId) {
        concerns.push(`TransferHook wired to ${programId} — every transfer CPIs into a custom program`);
        evidence.push({
          type: "onchain",
          account: ctx.state.mint,
          slot: ctx.state.snapshotSlot,
          field: "extension.TransferHook.programId",
          value: String(programId),
        });
      }
    }

    if (defaultAccountState) {
      const state = Number(defaultAccountState.details?.["state"] ?? 0);
      if (state === 2) {
        concerns.push("DefaultAccountState=Frozen — new holders open frozen, require thaw");
        evidence.push({
          type: "onchain",
          account: ctx.state.mint,
          slot: ctx.state.snapshotSlot,
          field: "extension.DefaultAccountState",
          value: "frozen",
        });
      }
    }

    if (mintClose) {
      const auth = mintClose.details?.["closeAuthority"];
      if (auth) {
        concerns.push(`MintCloseAuthority retained — issuer can close the mint account`);
        evidence.push({
          type: "onchain",
          account: ctx.state.mint,
          slot: ctx.state.snapshotSlot,
          field: "extension.MintCloseAuthority",
          value: String(auth),
        });
      }
    }

    if (confidentialTransfer) {
      concerns.push("ConfidentialTransfer present — token balances are encrypted, audit surface degraded");
      evidence.push({
        type: "onchain",
        account: ctx.state.mint,
        slot: ctx.state.snapshotSlot,
        field: "extension.ConfidentialTransferMint",
        value: "active",
      });
    }

    if (concerns.length === 0) {
      return {
        ruleId: this.id,
        ruleVersion: this.version,
        category: this.category,
        material: this.material,
        outcome: "pass",
        rationale:
          "Token-2022 mint observed; no riba or material custodial extensions active.",
        evidence,
      };
    }

    return {
      ruleId: this.id,
      ruleVersion: this.version,
      category: this.category,
      material: this.material,
      outcome: "flag",
      rationale: `Token-2022 extension concerns — ${concerns.join("; ")}.`,
      evidence,
    };
  },
};
