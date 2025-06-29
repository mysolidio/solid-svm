use anchor_lang::prelude::*;

#[account]
pub struct AttestationAccount {
    pub wallet: Pubkey,           // The wallet address (owner of this account)
    pub attestation: Pubkey,      // The attestation address
} 
