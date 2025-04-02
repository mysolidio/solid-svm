use anchor_lang::prelude::*;

#[account]
pub struct Identity {
  pub master: Pubkey
}