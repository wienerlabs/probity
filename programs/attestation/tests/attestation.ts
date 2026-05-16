import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";
import type { Attestation } from "../target/types/attestation";

// Pack a semver string like "0.1.0" into a 16-byte fixed buffer so the
// PDA seed and on-chain field can be compared byte-for-byte.
function ruleVersionBytes(s: string): number[] {
  const buf = Buffer.alloc(16, 0);
  buf.write(s, 0, "utf8");
  return Array.from(buf);
}

function evidenceHash(seed: number): number[] {
  const buf = Buffer.alloc(32, 0);
  for (let i = 0; i < 32; i++) buf[i] = (seed * (i + 1)) & 0xff;
  return Array.from(buf);
}

function findPda(
  programId: PublicKey,
  mint: PublicKey,
  ruleVersion: number[],
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("attestation"), mint.toBuffer(), Buffer.from(ruleVersion)],
    programId,
  );
}

describe("attestation", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Attestation as Program<Attestation>;
  const signer = provider.wallet;

  const RULE = ruleVersionBytes("0.1.0");

  it("creates an attestation at the deterministic PDA", async () => {
    const mint = Keypair.generate().publicKey;
    const [pda] = findPda(program.programId, mint, RULE);
    const now = Math.floor(Date.now() / 1000);
    const expires = new BN(now + 30 * 86_400);

    await program.methods
      .createAttestation(0, RULE, evidenceHash(7), expires)
      .accounts({
        attestation: pda,
        mint,
        signer: signer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const a = await program.account.attestation.fetch(pda);
    expect(a.verdict).to.equal(0);
    expect(a.mint.toBase58()).to.equal(mint.toBase58());
    expect(a.signer.toBase58()).to.equal(signer.publicKey.toBase58());
    expect(a.revoked).to.equal(false);
    expect(a.expiresAt.toNumber()).to.equal(expires.toNumber());
    expect(Array.from(a.ruleVersion)).to.deep.equal(RULE);
    expect(Array.from(a.evidenceHash)).to.deep.equal(evidenceHash(7));
  });

  it("rejects an out-of-range verdict", async () => {
    const mint = Keypair.generate().publicKey;
    const [pda] = findPda(program.programId, mint, RULE);
    const now = Math.floor(Date.now() / 1000);
    let threw = false;
    try {
      await program.methods
        .createAttestation(7, RULE, evidenceHash(1), new BN(now + 3600))
        .accounts({
          attestation: pda,
          mint,
          signer: signer.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    } catch (e: unknown) {
      threw = true;
      expect(String(e)).to.match(/InvalidVerdict|6000/);
    }
    expect(threw).to.equal(true);
  });

  it("rejects an expiry in the past", async () => {
    const mint = Keypair.generate().publicKey;
    const [pda] = findPda(program.programId, mint, RULE);
    let threw = false;
    try {
      await program.methods
        .createAttestation(1, RULE, evidenceHash(2), new BN(1))
        .accounts({
          attestation: pda,
          mint,
          signer: signer.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    } catch (e: unknown) {
      threw = true;
      expect(String(e)).to.match(/ExpiryInPast|6004/);
    }
    expect(threw).to.equal(true);
  });

  it("revokes an attestation only as the original signer", async () => {
    const mint = Keypair.generate().publicKey;
    const [pda] = findPda(program.programId, mint, RULE);
    const now = Math.floor(Date.now() / 1000);

    await program.methods
      .createAttestation(1, RULE, evidenceHash(3), new BN(now + 86_400))
      .accounts({
        attestation: pda,
        mint,
        signer: signer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    // Unauthorized signer tries to revoke
    const intruder = Keypair.generate();
    await provider.connection.requestAirdrop(
      intruder.publicKey,
      1_000_000_000,
    );
    await new Promise((r) => setTimeout(r, 600));

    let unauthorizedThrew = false;
    try {
      await program.methods
        .revokeAttestation(0)
        .accounts({ attestation: pda, signer: intruder.publicKey })
        .signers([intruder])
        .rpc();
    } catch (e: unknown) {
      unauthorizedThrew = true;
      expect(String(e)).to.match(/Unauthorized|6001/);
    }
    expect(unauthorizedThrew).to.equal(true);

    // Original signer revokes
    await program.methods
      .revokeAttestation(1)
      .accounts({ attestation: pda, signer: signer.publicKey })
      .rpc();

    const a = await program.account.attestation.fetch(pda);
    expect(a.revoked).to.equal(true);

    // Cannot double-revoke
    let doubleThrew = false;
    try {
      await program.methods
        .revokeAttestation(1)
        .accounts({ attestation: pda, signer: signer.publicKey })
        .rpc();
    } catch (e: unknown) {
      doubleThrew = true;
      expect(String(e)).to.match(/AlreadyRevoked|6003/);
    }
    expect(doubleThrew).to.equal(true);
  });

  it("updates expiry forward, rejects regression and revoked state", async () => {
    const mint = Keypair.generate().publicKey;
    const [pda] = findPda(program.programId, mint, RULE);
    const now = Math.floor(Date.now() / 1000);

    await program.methods
      .createAttestation(0, RULE, evidenceHash(4), new BN(now + 86_400))
      .accounts({
        attestation: pda,
        mint,
        signer: signer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    // Move expiry forward — OK
    await program.methods
      .updateExpiry(new BN(now + 2 * 86_400))
      .accounts({ attestation: pda, signer: signer.publicKey })
      .rpc();
    const a = await program.account.attestation.fetch(pda);
    expect(a.expiresAt.toNumber()).to.equal(now + 2 * 86_400);

    // Backwards regression — should fail
    let regressedThrew = false;
    try {
      await program.methods
        .updateExpiry(new BN(now + 3600))
        .accounts({ attestation: pda, signer: signer.publicKey })
        .rpc();
    } catch (e: unknown) {
      regressedThrew = true;
      expect(String(e)).to.match(/ExpiryRegressed|6005/);
    }
    expect(regressedThrew).to.equal(true);
  });

  it("two distinct rule versions for the same mint live at distinct PDAs", async () => {
    const mint = Keypair.generate().publicKey;
    const RULE_2 = ruleVersionBytes("0.2.0");
    const [pdaA] = findPda(program.programId, mint, RULE);
    const [pdaB] = findPda(program.programId, mint, RULE_2);
    expect(pdaA.toBase58()).to.not.equal(pdaB.toBase58());

    const now = Math.floor(Date.now() / 1000);
    await program.methods
      .createAttestation(0, RULE, evidenceHash(5), new BN(now + 86_400))
      .accounts({
        attestation: pdaA,
        mint,
        signer: signer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    await program.methods
      .createAttestation(2, RULE_2, evidenceHash(6), new BN(now + 86_400))
      .accounts({
        attestation: pdaB,
        mint,
        signer: signer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const a = await program.account.attestation.fetch(pdaA);
    const b = await program.account.attestation.fetch(pdaB);
    expect(a.verdict).to.equal(0);
    expect(b.verdict).to.equal(2);
  });
});
