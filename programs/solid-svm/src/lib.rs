use anchor_lang::prelude::*;
mod state;
mod handlers;
mod common;
mod utils;

use crate::handlers::*;

declare_id!("6UZqUB1eVVzUkjrA9bCETqby9GiApBKGwgWoQZ3Qr4EY");

#[program]
pub mod solid_svm {
    use super::*;
    pub fn register(ctx: Context<Register>, username: String) -> Result<()> {
        handler_register::process(ctx, username)
    }

    pub fn link_wallet(ctx: Context<LinkWallet>, wallet: Pubkey) -> Result<()> {
        handler_link_wallet::process(ctx, wallet)
    }
}
