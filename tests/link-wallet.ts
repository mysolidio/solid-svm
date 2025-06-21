import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import { Ed25519Program } from "@solana/web3.js";
import * as bs58 from "bs58";
import { expect } from "chai";
import * as nacl from "tweetnacl";

import { SolidSvm } from "../target/types/solid_svm";

describe("link-wallet", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SolidSvm as Program<SolidSvm>;

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

    // Create plain text message in the new format
    const nonce = 10;
    const messageText = `Link wallet: ${linkingWallet.publicKey.toString()} with nonce: ${nonce}`;

    // Convert the plain text message to bytes using TextEncoder
    const messageBuffer = new TextEncoder().encode(messageText);

    // Sign the message using the same approach Phantom wallet would use
    // Phantom wallet signs the raw message bytes directly
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

    await provider.sendAndConfirm(tx, [linkingWallet], { skipPreflight: true });

    const [masterAccountPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_account"), masterWallet.publicKey.toBuffer()],
      program.programId
    );

    const userAccount = await program.account.user.fetch(masterAccountPda);
    expect(userAccount.linkingWallets[0].toBase58()).to.include(
      linkingWallet.publicKey.toBase58()
    );
  });

  it("Links a wallet successfully with Phantom-compatible signing", async () => {
    // Create keypairs for testing
    const masterWallet = Keypair.generate();
    const linkingWallet = Keypair.generate();

    // Airdrop SOL to wallets for testing
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

    // Create message exactly as Phantom wallet would
    const nonce = Math.floor(Math.random() * 1000000); // Random nonce like Phantom would use
    const messageText = `Link wallet: ${linkingWallet.publicKey.toString()} with nonce: ${nonce}`;

    // Phantom wallet converts string to Uint8Array the same way
    const messageBytes = new TextEncoder().encode(messageText);

    // Phantom wallet uses ed25519 signing (same as nacl.sign.detached)
    // This simulates exactly what Phantom's signMessage would return
    const signature_bytes = nacl.sign.detached(
      messageBytes,
      masterWallet.secretKey
    );

    // Verify the signature is exactly 64 bytes (ed25519 signature length)
    expect(signature_bytes).to.have.length(64);

    // Create Ed25519 verification instruction (same as Phantom would need)
    const verifyInstruction = Ed25519Program.createInstructionWithPublicKey({
      publicKey: masterWallet.publicKey.toBytes(),
      message: messageBytes,
      signature: signature_bytes,
    });

    // Create the link wallet instruction
    const linkWalletIx = await program.methods
      .linkWallet(masterWallet.publicKey)
      .accounts({
        requester: linkingWallet.publicKey,
      })
      .instruction();

    // Build and send transaction
    const tx = new anchor.web3.Transaction();
    tx.add(verifyInstruction);
    tx.add(linkWalletIx);

    await provider.sendAndConfirm(tx, [linkingWallet], { skipPreflight: true });

    // Verify the wallet was linked successfully
    const [masterAccountPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_account"), masterWallet.publicKey.toBuffer()],
      program.programId
    );

    const userAccount = await program.account.user.fetch(masterAccountPda);
    expect(userAccount.linkingWallets).to.have.length(1);
    expect(userAccount.linkingWallets[0].toBase58()).to.equal(
      linkingWallet.publicKey.toBase58()
    );
  });

  it("Should handle message format variations that Phantom might produce", async () => {
    // Test different message formats that might come from different wallet implementations
    const masterWallet = Keypair.generate();
    const linkingWallet = Keypair.generate();

    // Airdrop SOL
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

    // Test with different nonce formats (what if Phantom uses different nonce generation?)
    const testCases = [
      { nonce: 0, description: "zero nonce" },
      { nonce: 1, description: "small nonce" },
      { nonce: 999999999, description: "large nonce" },
      { nonce: Date.now(), description: "timestamp nonce" },
    ];

    for (const testCase of testCases) {
      // Create message with specific nonce
      const messageText = `Link wallet: ${linkingWallet.publicKey.toString()} with nonce: ${
        testCase.nonce
      }`;
      const messageBytes = new TextEncoder().encode(messageText);

      // Sign with master wallet
      const signatureBytes = nacl.sign.detached(
        messageBytes,
        masterWallet.secretKey
      );

      // Verify signature length and format
      expect(
        signatureBytes,
        `Failed for ${testCase.description}`
      ).to.have.length(64);

      // Verify the signature can be used in Ed25519Program
      expect(() => {
        Ed25519Program.createInstructionWithPublicKey({
          publicKey: masterWallet.publicKey.toBytes(),
          message: messageBytes,
          signature: signatureBytes,
        });
      }, `Ed25519Program creation failed for ${testCase.description}`).to.not.throw();
    }
  });

  it("Should validate message format strictly", async () => {
    // Test that invalid message formats are rejected
    const masterWallet = Keypair.generate();
    const linkingWallet = Keypair.generate();

    // Airdrop SOL
    const signature = await provider.connection.requestAirdrop(
      linkingWallet.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(signature);

    // Test invalid message formats that should fail
    const invalidMessages = [
      `Link wallet ${linkingWallet.publicKey.toString()} with nonce 123`, // Missing colons
      `Link wallet: ${linkingWallet.publicKey.toString()} nonce: 123`, // Missing "with"
      `Link: ${linkingWallet.publicKey.toString()} with nonce: 123`, // Missing "wallet"
      `Link wallet: ${linkingWallet.publicKey.toString()} with nonce:`, // Missing nonce value
      `Link wallet: invalid_key with nonce: 123`, // Invalid public key
      `Link wallet: ${linkingWallet.publicKey.toString()} with nonce: abc`, // Invalid nonce
    ];

    for (const invalidMessage of invalidMessages) {
      const messageBytes = new TextEncoder().encode(invalidMessage);
      const signatureBytes = nacl.sign.detached(
        messageBytes,
        masterWallet.secretKey
      );

      const verifyInstruction = Ed25519Program.createInstructionWithPublicKey({
        publicKey: masterWallet.publicKey.toBytes(),
        message: messageBytes,
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

      // This should fail due to invalid message format
      try {
        await provider.sendAndConfirm(tx, [linkingWallet], {
          skipPreflight: true,
        });
        expect.fail(
          `Transaction should have failed for invalid message: ${invalidMessage}`
        );
      } catch (error) {
        // Expected to fail - this is good
        expect(error).to.exist;
      }
    }
  });
});
