use anchor_lang::prelude::*;
use crate::state::AttestationAccount;

// PDA seed prefix
pub const ATTESTATION_SEED: &[u8] = b"attestation";

#[derive(Accounts)]
pub struct CreateAttestation<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + 32 + 32, // discriminator + wallet pubkey + attestation pubkey
        seeds = [ATTESTATION_SEED, wallet.key().as_ref()],
        bump
    )]
    pub attestation_account: Account<'info, AttestationAccount>,
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: This is the wallet address for which the attestation is created
    pub wallet: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

pub fn create_attestation(ctx: Context<CreateAttestation>, attestation: Pubkey) -> Result<()> {
    let acc = &mut ctx.accounts.attestation_account;
    acc.wallet = ctx.accounts.wallet.key();
    acc.attestation = attestation;
    Ok(())
}

#[derive(Accounts)]
pub struct UpdateAttestation<'info> {
    #[account(
        mut,
        seeds = [ATTESTATION_SEED, wallet.key().as_ref()],
        bump,
        has_one = wallet
    )]
    pub attestation_account: Account<'info, AttestationAccount>,
    /// CHECK: This is the wallet address for which the attestation is updated
    pub wallet: UncheckedAccount<'info>,
    pub authority: Signer<'info>,
}

pub fn update_attestation(ctx: Context<UpdateAttestation>, new_attestation: Pubkey) -> Result<()> {
    let acc = &mut ctx.accounts.attestation_account;
    acc.attestation = new_attestation;
    Ok(())
}

#[derive(Accounts)]
pub struct DeleteAttestation<'info> {
    #[account(
        mut,
        close = authority,
        seeds = [ATTESTATION_SEED, wallet.key().as_ref()],
        bump,
        has_one = wallet
    )]
    pub attestation_account: Account<'info, AttestationAccount>,
    /// CHECK: This is the wallet address for which the attestation is deleted
    pub wallet: UncheckedAccount<'info>,
    pub authority: Signer<'info>,
}

pub fn delete_attestation(_ctx: Context<DeleteAttestation>) -> Result<()> {
    // Account will be closed automatically
    Ok(())
}

#[derive(Accounts)]
pub struct FetchAttestation<'info> {
    #[account(
        seeds = [ATTESTATION_SEED, wallet.key().as_ref()],
        bump,
        has_one = wallet
    )]
    pub attestation_account: Account<'info, AttestationAccount>,
    /// CHECK: This is the wallet address for which the attestation is fetched
    pub wallet: UncheckedAccount<'info>,
}

// Fetch is usually a view, but you can expose the account for clients to read 
