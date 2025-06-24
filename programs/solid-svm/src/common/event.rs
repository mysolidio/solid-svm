use anchor_lang::prelude::*;

#[event]
pub struct UserRegistered {
    pub user: Pubkey,
    pub username: String,
    pub user_account: Pubkey,
    pub identity: Pubkey,
}

#[event]
pub struct WalletLinked {
    pub master: Pubkey,
    pub linked_wallet: Pubkey,
    pub nonce: u64,
}
