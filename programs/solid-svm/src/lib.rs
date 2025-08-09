use anchor_lang::prelude::*;
mod state;
mod handlers;
mod common;
mod utils;

use crate::handlers::*;

declare_id!("EkBnxBMuEm3etvxmGamRKjFva2TXKZ5qhxomN1PXNJS7");

#[program]
pub mod solid_svm {
    use super::*;
    pub fn register(ctx: Context<Register>, username: String) -> Result<()> {
        handler_register::process(ctx, username)
    }

    pub fn link_wallet(ctx: Context<LinkWallet>, wallet: Pubkey) -> Result<()> {
        handler_link_wallet::process(ctx, wallet)
    }

    pub fn create_attestation(ctx: Context<CreateAttestation>, attestation: Pubkey) -> Result<()> {
        handler_attestation::create_attestation(ctx, attestation)
    }

    pub fn update_attestation(ctx: Context<UpdateAttestation>, new_attestation: Pubkey) -> Result<()> {
        handler_attestation::update_attestation(ctx, new_attestation)
    }

    pub fn delete_attestation(ctx: Context<DeleteAttestation>) -> Result<()> {
        handler_attestation::delete_attestation(ctx)
    }
    // Fetch is a view, so no entrypoint needed; clients can fetch the account directly
}
