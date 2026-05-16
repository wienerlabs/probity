//! Probity attestation — commits a verdict (Halal / Mushtabah / Haram)
//! plus its rule version and an evidence hash to a deterministic PDA
//! keyed by (mint, rule_version). A signer-only model: only the issuer
//! who created an attestation can revoke or extend it. Reads are
//! permissionless.

use anchor_lang::prelude::*;

declare_id!("HDpm5Ge4Zryoib6KYHewYoeAXXTE3GMkASZNbSpZZa9U");

#[program]
pub mod attestation {
    use super::*;

    pub fn create_attestation(
        ctx: Context<CreateAttestation>,
        verdict: u8,
        rule_version: [u8; 16],
        evidence_hash: [u8; 32],
        expires_at: i64,
    ) -> Result<()> {
        require!(verdict <= 2, AttestationError::InvalidVerdict);
        let clock = Clock::get()?;
        require!(
            expires_at > clock.unix_timestamp,
            AttestationError::ExpiryInPast
        );

        let a = &mut ctx.accounts.attestation;
        a.mint = ctx.accounts.mint.key();
        a.verdict = verdict;
        a.rule_version = rule_version;
        a.evidence_hash = evidence_hash;
        a.computed_at = clock.unix_timestamp;
        a.expires_at = expires_at;
        a.signer = ctx.accounts.signer.key();
        a.revoked = false;
        a.bump = ctx.bumps.attestation;

        emit!(AttestationCreated {
            attestation: a.key(),
            mint: a.mint,
            verdict: a.verdict,
            rule_version,
            computed_at: a.computed_at,
            expires_at: a.expires_at,
            signer: a.signer,
        });
        Ok(())
    }

    pub fn revoke_attestation(ctx: Context<RevokeAttestation>, reason_code: u8) -> Result<()> {
        let a = &mut ctx.accounts.attestation;
        require_keys_eq!(a.signer, ctx.accounts.signer.key(), AttestationError::Unauthorized);
        require!(!a.revoked, AttestationError::AlreadyRevoked);
        a.revoked = true;

        emit!(AttestationRevoked {
            attestation: a.key(),
            mint: a.mint,
            reason_code,
            revoked_at: Clock::get()?.unix_timestamp,
            signer: a.signer,
        });
        Ok(())
    }

    pub fn update_expiry(ctx: Context<UpdateExpiry>, new_expires_at: i64) -> Result<()> {
        let a = &mut ctx.accounts.attestation;
        require_keys_eq!(a.signer, ctx.accounts.signer.key(), AttestationError::Unauthorized);
        require!(!a.revoked, AttestationError::Revoked);
        let clock = Clock::get()?;
        require!(
            new_expires_at > clock.unix_timestamp,
            AttestationError::ExpiryInPast
        );
        require!(
            new_expires_at >= a.expires_at,
            AttestationError::ExpiryRegressed
        );
        a.expires_at = new_expires_at;
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(verdict: u8, rule_version: [u8; 16])]
pub struct CreateAttestation<'info> {
    #[account(
        init,
        payer = signer,
        space = 8 + Attestation::SIZE,
        seeds = [b"attestation", mint.key().as_ref(), &rule_version],
        bump,
    )]
    pub attestation: Account<'info, Attestation>,
    /// CHECK: only used as a PDA seed; the program never reads from it.
    pub mint: UncheckedAccount<'info>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RevokeAttestation<'info> {
    #[account(mut)]
    pub attestation: Account<'info, Attestation>,
    pub signer: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdateExpiry<'info> {
    #[account(mut)]
    pub attestation: Account<'info, Attestation>,
    pub signer: Signer<'info>,
}

#[account]
pub struct Attestation {
    pub mint: Pubkey,
    pub verdict: u8,
    pub rule_version: [u8; 16],
    pub evidence_hash: [u8; 32],
    pub computed_at: i64,
    pub expires_at: i64,
    pub signer: Pubkey,
    pub revoked: bool,
    pub bump: u8,
}

impl Attestation {
    // 32 + 1 + 16 + 32 + 8 + 8 + 32 + 1 + 1
    pub const SIZE: usize = 131;
}

#[event]
pub struct AttestationCreated {
    pub attestation: Pubkey,
    pub mint: Pubkey,
    pub verdict: u8,
    pub rule_version: [u8; 16],
    pub computed_at: i64,
    pub expires_at: i64,
    pub signer: Pubkey,
}

#[event]
pub struct AttestationRevoked {
    pub attestation: Pubkey,
    pub mint: Pubkey,
    pub reason_code: u8,
    pub revoked_at: i64,
    pub signer: Pubkey,
}

#[error_code]
pub enum AttestationError {
    #[msg("verdict must be 0 (halal), 1 (mushtabah), or 2 (haram)")]
    InvalidVerdict,
    #[msg("only the original signer may mutate this attestation")]
    Unauthorized,
    #[msg("attestation has been revoked")]
    Revoked,
    #[msg("attestation has already been revoked")]
    AlreadyRevoked,
    #[msg("expiry must be in the future")]
    ExpiryInPast,
    #[msg("expiry cannot move backwards")]
    ExpiryRegressed,
}
