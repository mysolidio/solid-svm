use anchor_lang::prelude::*;
use bytemuck::{from_bytes, Pod, Zeroable};
use serde::{Deserialize, Serialize};
use crate::common::SolidError;

// Structs and constants copied from solana_sdk::ed25519_instruction. Copied in order to make fields public.
// Compilation issues hit when importing solana_sdk
#[derive(Default, Debug, Copy, Clone, Zeroable, Pod, Eq, PartialEq)]
#[repr(C)]
pub struct Ed25519SignatureOffsets {
  pub signature_offset: u16, // offset to ed25519 signature of 64 bytes
  pub signature_instruction_index: u16, // instruction index to find signature
  pub public_key_offset: u16, // offset to public key of 32 bytes
  pub public_key_instruction_index: u16, // instruction index to find public key
  pub message_data_offset: u16, // offset to start of message data
  pub message_data_size: u16, // size of message data
  pub message_instruction_index: u16, // index of instruction data to get message data
}

pub const PUBKEY_SERIALIZED_SIZE: usize = 32;
pub const SIGNATURE_SERIALIZED_SIZE: usize = 64;
pub const SIGNATURE_OFFSETS_SERIALIZED_SIZE: usize = 14;

pub const SIGNATURE_OFFSETS_START: usize = 2;
pub const DATA_START: usize = SIGNATURE_OFFSETS_SERIALIZED_SIZE + SIGNATURE_OFFSETS_START;

#[derive(Serialize, Deserialize)]
pub struct SignatureMessage {
  pub wallet: Pubkey,
  pub nonce: u64
}

#[derive(Serialize, Deserialize)]
pub struct SignatureRecover {
  pub signer: Pubkey,
  pub message: SignatureMessage,
}

pub fn verify_signature(instruction_data: Vec<u8>) -> Result<SignatureRecover> {

  let ed25519_offsets = from_bytes::<Ed25519SignatureOffsets>(
    &instruction_data
      [SIGNATURE_OFFSETS_START..SIGNATURE_OFFSETS_START + SIGNATURE_OFFSETS_SERIALIZED_SIZE],
  );

  if ed25519_offsets.signature_instruction_index != ed25519_offsets.public_key_instruction_index
    || ed25519_offsets.signature_instruction_index != ed25519_offsets.message_instruction_index
    || ed25519_offsets.public_key_offset
    != (SIGNATURE_OFFSETS_START + SIGNATURE_OFFSETS_SERIALIZED_SIZE) as u16
    || ed25519_offsets.signature_offset
    != ed25519_offsets.public_key_offset + PUBKEY_SERIALIZED_SIZE as u16
    || ed25519_offsets.message_data_offset
    != ed25519_offsets.signature_offset + SIGNATURE_SERIALIZED_SIZE as u16
  {
    return Err(SolidError::SignatureDataInvalid.into());
  }

  let message_signer = Pubkey::try_from(
    &instruction_data[ed25519_offsets.public_key_offset as usize
      ..ed25519_offsets.public_key_offset as usize + PUBKEY_SERIALIZED_SIZE],
  ).map_err(|_| SolidError::SignatureDataInvalid)?;

  let message_data = &instruction_data[ed25519_offsets.message_data_offset as usize..];

  let message : SignatureMessage = bincode::deserialize(message_data).map_err(|_| SolidError::SignatureDataInvalid)?;

  Ok(SignatureRecover{
    signer: message_signer,
    message
  })
}