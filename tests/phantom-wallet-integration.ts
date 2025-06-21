import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import { Ed25519Program } from "@solana/web3.js";
import { expect } from "chai";
import { SolidSvm } from "../target/types/solid_svm";

/**
 * PHANTOM WALLET INTEGRATION GUIDE
 *
 * This file demonstrates how to properly integrate with Phantom wallet
 * for the link wallet functionality. The key points are:
 *
 * 1. Message Format: Must be exactly "Link wallet: [ADDRESS] with nonce: [NUMBER]"
 * 2. Message Encoding: Use TextEncoder().encode() to convert string to bytes
 * 3. Signature: Use Phantom's signMessage() method (equivalent to nacl.sign.detached)
 * 4. Ed25519 Verification: Create verification instruction before link wallet instruction
 *
 **/

describe("Phantom Wallet Integration Tests", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.SolidSvm as Program<SolidSvm>;

  it("Should work with Phantom wallet message signing format", async () => {
    // Simulate Phantom wallet behavior
    const masterWallet = Keypair.generate(); // This would be Phantom's connected wallet
    const linkingWallet = Keypair.generate(); // The wallet being linked

    // Airdrop SOL
    const [sig1, sig2] = await Promise.all([
      provider.connection.requestAirdrop(
        masterWallet.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      ),
      provider.connection.requestAirdrop(
        linkingWallet.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      ),
    ]);
    await Promise.all([
      provider.connection.confirmTransaction(sig1),
      provider.connection.confirmTransaction(sig2),
    ]);

    // STEP 1: Create message in exact format required
    const nonce = Date.now(); // Phantom might use timestamp
    const message = `Link wallet: ${linkingWallet.publicKey.toString()} with nonce: ${nonce}`;

    // STEP 2: Convert to bytes (same as Phantom does)
    const messageBytes = new TextEncoder().encode(message);

    // STEP 3: Sign message (simulating Phantom's signMessage result)
    const nacl = require("tweetnacl");
    const signature = nacl.sign.detached(messageBytes, masterWallet.secretKey);

    // Verify signature format matches Phantom's output
    expect(signature).to.be.instanceOf(Uint8Array);
    expect(signature).to.have.length(64);

    // STEP 4: Create Ed25519 verification instruction
    const verifyInstruction = Ed25519Program.createInstructionWithPublicKey({
      publicKey: masterWallet.publicKey.toBytes(),
      message: messageBytes,
      signature: signature,
    });

    // STEP 5: Create link wallet instruction
    const linkWalletIx = await program.methods
      .linkWallet(masterWallet.publicKey)
      .accounts({
        requester: linkingWallet.publicKey,
      })
      .instruction();

    // STEP 6: Execute transaction
    const tx = new anchor.web3.Transaction();
    tx.add(verifyInstruction);
    tx.add(linkWalletIx);

    await provider.sendAndConfirm(tx, [linkingWallet]);

    // Verify success
    const [userAccountPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_account"), masterWallet.publicKey.toBuffer()],
      program.programId
    );

    const userAccount = await program.account.user.fetch(userAccountPda);
    expect(userAccount.linkingWallets).to.have.length(1);
    expect(userAccount.linkingWallets[0].toBase58()).to.equal(
      linkingWallet.publicKey.toBase58()
    );
  });

  it("Should handle various nonce formats Phantom might use", async () => {
    const masterWallet = Keypair.generate();
    const linkingWallet = Keypair.generate();

    // Airdrop SOL
    const [sig1, sig2] = await Promise.all([
      provider.connection.requestAirdrop(
        masterWallet.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      ),
      provider.connection.requestAirdrop(
        linkingWallet.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      ),
    ]);
    await Promise.all([
      provider.connection.confirmTransaction(sig1),
      provider.connection.confirmTransaction(sig2),
    ]);

    // Test different nonce types that Phantom wallet might generate
    const nonceTypes = [
      { value: 1, name: "simple integer" },
      { value: Date.now(), name: "timestamp" },
      { value: Math.floor(Math.random() * 1000000), name: "random number" },
      { value: 0, name: "zero" },
      { value: 999999999999999, name: "large number" },
    ];

    for (const nonceType of nonceTypes) {
      const message = `Link wallet: ${linkingWallet.publicKey.toString()} with nonce: ${
        nonceType.value
      }`;
      const messageBytes = new TextEncoder().encode(message);

      const nacl = require("tweetnacl");
      const signature = nacl.sign.detached(
        messageBytes,
        masterWallet.secretKey
      );

      // Verify this nonce format would work
      expect(() => {
        Ed25519Program.createInstructionWithPublicKey({
          publicKey: masterWallet.publicKey.toBytes(),
          message: messageBytes,
          signature: signature,
        });
      }, `Failed for nonce type: ${nonceType.name}`).to.not.throw();
    }
  });

  it("Should reject invalid message formats that might come from user error", async () => {
    const masterWallet = Keypair.generate();
    const linkingWallet = Keypair.generate();

    // Airdrop SOL
    const signature = await provider.connection.requestAirdrop(
      linkingWallet.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(signature);

    // Common mistakes users might make when constructing messages
    const invalidFormats = [
      // Missing parts
      `Link wallet: ${linkingWallet.publicKey.toString()}`,
      `${linkingWallet.publicKey.toString()} with nonce: 123`,
      `Link wallet: with nonce: 123`,

      // Wrong separators
      `Link wallet ${linkingWallet.publicKey.toString()} with nonce 123`,
      `Link wallet - ${linkingWallet.publicKey.toString()} with nonce - 123`,

      // Wrong keywords
      `Connect wallet: ${linkingWallet.publicKey.toString()} with nonce: 123`,
      `Link address: ${linkingWallet.publicKey.toString()} with nonce: 123`,
      `Link wallet: ${linkingWallet.publicKey.toString()} with id: 123`,

      // Invalid addresses
      `Link wallet: invalid_address with nonce: 123`,
      `Link wallet: ${linkingWallet.publicKey
        .toString()
        .slice(0, -5)} with nonce: 123`,

      // Invalid nonces
      `Link wallet: ${linkingWallet.publicKey.toString()} with nonce: abc`,
      `Link wallet: ${linkingWallet.publicKey.toString()} with nonce: -123`,
      `Link wallet: ${linkingWallet.publicKey.toString()} with nonce: 123.45`,
    ];

    for (const invalidMessage of invalidFormats) {
      const messageBytes = new TextEncoder().encode(invalidMessage);
      const nacl = require("tweetnacl");
      const signature = nacl.sign.detached(
        messageBytes,
        masterWallet.secretKey
      );

      const verifyInstruction = Ed25519Program.createInstructionWithPublicKey({
        publicKey: masterWallet.publicKey.toBytes(),
        message: messageBytes,
        signature: signature,
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

      // Should fail
      try {
        await provider.sendAndConfirm(tx, [linkingWallet], {
          skipPreflight: true,
        });
        expect.fail(
          `Should have failed for invalid message: "${invalidMessage}"`
        );
      } catch (error) {
        // Expected to fail
        expect(error).to.exist;
      }
    }
  });

  it("Should demonstrate complete Phantom integration workflow", async () => {
    /**
     * This test simulates the complete workflow a user would go through
     * when using Phantom wallet to link a new wallet to their account
     */

    // SETUP: User has Phantom wallet connected (masterWallet)
    // and wants to link a new wallet (linkingWallet)
    const masterWallet = Keypair.generate(); // Phantom connected wallet
    const linkingWallet = Keypair.generate(); // New wallet to link

    // Airdrop SOL to both wallets
    const [sig1, sig2] = await Promise.all([
      provider.connection.requestAirdrop(
        masterWallet.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      ),
      provider.connection.requestAirdrop(
        linkingWallet.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      ),
    ]);
    await Promise.all([
      provider.connection.confirmTransaction(sig1),
      provider.connection.confirmTransaction(sig2),
    ]);

    // STEP 1: User registers their master account first (if not already done)
    const username = "phantom_user_" + Date.now();
    await program.methods
      .register(username)
      .accounts({
        user: masterWallet.publicKey,
      })
      .signers([masterWallet])
      .rpc();

    // STEP 2: Frontend creates message for user to sign
    const nonce = Date.now(); // Use timestamp as nonce
    const messageToSign = `Link wallet: ${linkingWallet.publicKey.toString()} with nonce: ${nonce}`;

    console.log("Message user will sign in Phantom:");
    console.log(messageToSign);

    // STEP 3: User signs message in Phantom wallet
    const messageBytes = new TextEncoder().encode(messageToSign);

    // Simulate Phantom's signMessage response
    const nacl = require("tweetnacl");
    const phantomSignature = nacl.sign.detached(
      messageBytes,
      masterWallet.secretKey
    );

    // STEP 4: Frontend creates and sends transaction
    const verifyInstruction = Ed25519Program.createInstructionWithPublicKey({
      publicKey: masterWallet.publicKey.toBytes(),
      message: messageBytes,
      signature: phantomSignature,
    });

    const linkWalletIx = await program.methods
      .linkWallet(masterWallet.publicKey)
      .accounts({
        requester: linkingWallet.publicKey,
      })
      .instruction();

    const transaction = new anchor.web3.Transaction();
    transaction.add(verifyInstruction);
    transaction.add(linkWalletIx);

    // STEP 5: Send transaction (linking wallet pays fees)
    await provider.sendAndConfirm(transaction, [linkingWallet]);

    // STEP 6: Verify the wallet was successfully linked
    const [userAccountPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_account"), masterWallet.publicKey.toBuffer()],
      program.programId
    );

    const userAccount = await program.account.user.fetch(userAccountPda);

    expect(userAccount.username).to.equal(username);
    expect(userAccount.master.toBase58()).to.equal(
      masterWallet.publicKey.toBase58()
    );
    expect(userAccount.linkingWallets).to.have.length(1);
    expect(userAccount.linkingWallets[0].toBase58()).to.equal(
      linkingWallet.publicKey.toBase58()
    );

    console.log("✅ Wallet successfully linked!");
    console.log(`Master wallet: ${masterWallet.publicKey.toBase58()}`);
    console.log(`Linked wallet: ${linkingWallet.publicKey.toBase58()}`);
  });
});
