use anchor_lang::prelude::*;

#[event]
pub struct UserRegistered {
    pub user: Pubkey,
    pub username: String,
    pub user_account: Pubkey,
    pub identity: Pubkey,
}
