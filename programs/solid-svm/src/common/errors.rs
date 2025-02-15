use anchor_lang::prelude::*;
#[error_code]
pub enum SolidError {
  #[msg("The username is too long.")]
  UsernameTooLong,

  #[msg("Linking wallet does not match with signer key")]
  LinkingWalletNotMatchWithSignerKey,

  #[msg("Master key does not match with wallet from signature")]
  MasterKeyDoesNotMatch,

  #[msg("Previous instruction must be ed25519 signature verification")]
  MustBeSignatureVerificationInstruction,

  #[msg("This wallet is already linked to the account")]
  WalletAlreadyLinked,

  #[msg("Invalid signature data.")]
  SignatureDataInvalid,
}