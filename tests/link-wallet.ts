import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SolidSvm } from "../target/types/solid_svm";
import { Keypair, PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";
import { expect } from "chai";
import { Ed25519Program } from "@solana/web3.js";
import * as bs58 from "bs58";
import * as nacl from "tweetnacl";
import * as borsh from "borsh";

describe("link-wallet", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SolidSvm as Program<SolidSvm>;

  // Define the schema for serialization
  const schema = {
    struct: {
      wallet: {
        array: {
          type: 'u8',
          len: 32,
        },
      },
      nonce: 'u64'
    },
  };

  it("Links a wallet successfully", async () => {
    // Create keypairs for testing
    const masterWallet = Keypair.generate();
    const linkingWallet = Keypair.generate();

    // Airdrop SOL to master wallet for testing
    const signature = await provider.connection.requestAirdrop(
      masterWallet.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(signature);

    const signature2 = await provider.connection.requestAirdrop(
      linkingWallet.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(signature2);

    const messageBuffer = borsh.serialize(schema, {
      wallet: linkingWallet.publicKey.toBytes(),
      nonce: 10
    }, true);
    
    // Sign the message with the linking wallet using nacl
    const signatureBytes = nacl.sign.detached(
      messageBuffer,
      masterWallet.secretKey
    );

    // Create the Ed25519 signature verification instruction
    const verifyInstruction = Ed25519Program.createInstructionWithPublicKey({
      publicKey: masterWallet.publicKey.toBytes(),
      message: messageBuffer,
      signature: signatureBytes,
    });

    const linkWalletIx = await program.methods
      .linkWallet(masterWallet.publicKey)
      .accounts({
        requester: linkingWallet.publicKey,
      })
      .instruction();

    const tx = new anchor.web3.Transaction();
    tx.add(verifyInstruction);
    tx.add(linkWalletIx);

    await provider.sendAndConfirm(tx, [linkingWallet], {skipPreflight: true});

    const [masterAccountPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_account"), masterWallet.publicKey.toBuffer()],
      program.programId
    );

    const userAccount = await program.account.user.fetch(masterAccountPda);
    expect(userAccount.linkingWallets[0].toBase58()).to.include(linkingWallet.publicKey.toBase58());
  });
}); 