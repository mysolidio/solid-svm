use anchor_lang::prelude::*;
use crate::state::*;
use crate::common::SolidError;

#[derive(Accounts)]
#[instruction(username: String)]
pub struct Register<'info> {
  #[account(mut)]
  user: Signer<'info>,

  #[account(
    init_if_needed,
    payer = user,
    seeds = [b"user_account", user.key().as_ref()],
    bump,
    space = 8 + 4 + 200 + 32 + 4 + 32 * 10 // discriminator + string length + max string + master pubkey + vec length prefix + linked wallets
  )]
  user_account: Account<'info, User>,

  #[account(
    init,
    payer = user,
    seeds = [b"identity", username.as_bytes()],
    bump,
    space = 8 + 32 // discriminator, user_account pubkey
  )]
  identity: Account<'info, Identity>,

  pub system_program: Program<'info, System>,
}

pub fn process(ctx: Context<Register>, username: String) -> Result<()> {
  let user_account = &mut ctx.accounts.user_account;

  require_gt!(200, username.len(), SolidError::UsernameTooLong);

  user_account.username = username;
  user_account.master = ctx.accounts.user.key();
  user_account.linking_wallets = Vec::new();

  let identity = &mut ctx.accounts.identity;
  identity.master = ctx.accounts.user_account.key();

  Ok(())
}
