use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct User {
    pub username: String,
    pub master: Pubkey,
    pub linking_wallets: Vec<Pubkey>
}