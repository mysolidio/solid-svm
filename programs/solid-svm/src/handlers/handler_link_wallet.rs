use anchor_lang::prelude::*;
use anchor_lang::solana_program;
use anchor_lang::solana_program::sysvar;
use crate::state::User;
use crate::common::SolidError;
use crate::utils::verify_signature;

#[derive(Accounts)]
pub struct LinkWallet<'info> {
  #[account(mut)]
  master: Signer<'info>,

  #[account(
    mut,
    seeds = [b"user_account", master.key().as_ref()],
    bump
  )]
  userAccount: Account<'info, User>,

  /// CHECK: Safe because it's a sysvar account
  #[account(address = sysvar::instructions::ID)]
  pub instructions: UncheckedAccount<'info>,
  pub system_program: Program<'info, System>,
}

pub fn process(ctx: Context<LinkWallet>, wallet: Pubkey) -> Result<()> {
  let instructions = ctx.accounts.instructions.to_account_info();
  let verify_instruction = sysvar::instructions::get_instruction_relative(-1, &instructions)?;
  require_keys_eq!(verify_instruction.program_id, solana_program::ed25519_program::ID, SolidError::MustBeSignatureVerificationInstruction);
  let recover = verify_signature(verify_instruction.data).unwrap();

  require_keys_eq!(recover.message.wallet, ctx.accounts.master.key(), SolidError::MasterKeyDoesNotMatch);
  require_keys_eq!(recover.signer, wallet, SolidError::LinkingWalletNotMatchWithSignerKey);

  let user_account = &mut ctx.accounts.userAccount;

  // Check for duplicate wallet
  require!(!user_account.linking_wallets.contains(&wallet), SolidError::WalletAlreadyLinked);

  user_account.linking_wallets.push(wallet);

  msg!("Wallet linked: {}", wallet);
  Ok(())
}
