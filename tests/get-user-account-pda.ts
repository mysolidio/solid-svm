import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import { expect } from "chai";
import { SolidSvm } from "../target/types/solid_svm";

// Mock class to simulate the class containing getUserAccountPDA method
class SolidClient {
  program: Program<SolidSvm>;
  publicKey: PublicKey;

  constructor(program: Program<SolidSvm>, publicKey: PublicKey) {
    this.program = program;
    this.publicKey = publicKey;
  }

  private static readonly USER_ACCOUNT_SEED = Buffer.from("user_account");

  getUserAccountPDA(publicKey?: PublicKey) {
    return PublicKey.findProgramAddressSync(
      [SolidClient.USER_ACCOUNT_SEED, (publicKey || this.publicKey).toBuffer()],
      this.program.programId
    );
  }

  async getUserAccount(publicKey?: PublicKey) {
    try {
      const targetKey = publicKey ?? this.publicKey;
      const [userAccountPda] = this.getUserAccountPDA(targetKey);
      console.log("userAccountPda", userAccountPda.toBase58());

      const account = await this.program.account.user.fetch(userAccountPda);
      console.log("account", account);
      return account;
    } catch {
      return null;
    }
  }
}

describe("getUserAccountPDA", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SolidSvm as Program<SolidSvm>;

  it("Should generate PDA using default publicKey", async () => {
    const defaultPublicKey = Keypair.generate().publicKey;
    const client = new SolidClient(program, defaultPublicKey);

    const [pda, bump] = client.getUserAccountPDA();

    // Verify that the PDA is generated correctly
    expect(pda).to.be.instanceOf(PublicKey);
    expect(bump).to.be.a("number");
    expect(bump).to.be.at.least(0);
    expect(bump).to.be.at.most(255);

    // Verify the PDA can be regenerated with the same inputs
    const [pdaVerify, bumpVerify] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_account"), defaultPublicKey.toBuffer()],
      program.programId
    );

    expect(pda.toBase58()).to.equal(pdaVerify.toBase58());
    expect(bump).to.equal(bumpVerify);
  });

  it("Should generate PDA using provided publicKey parameter", async () => {
    const defaultPublicKey = Keypair.generate().publicKey;
    const customPublicKey = Keypair.generate().publicKey;
    const client = new SolidClient(program, defaultPublicKey);

    const [pda, bump] = client.getUserAccountPDA(customPublicKey);

    // Verify that the PDA is generated correctly with custom publicKey
    expect(pda).to.be.instanceOf(PublicKey);
    expect(bump).to.be.a("number");

    // Verify the PDA was generated using the custom publicKey, not the default one
    const [pdaWithCustomKey] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_account"), customPublicKey.toBuffer()],
      program.programId
    );

    const [pdaWithDefaultKey] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_account"), defaultPublicKey.toBuffer()],
      program.programId
    );

    expect(pda.toBase58()).to.equal(pdaWithCustomKey.toBase58());
    expect(pda.toBase58()).to.not.equal(pdaWithDefaultKey.toBase58());
  });

  it("Should generate different PDAs for different publicKeys", async () => {
    const publicKey1 = Keypair.generate().publicKey;
    const publicKey2 = Keypair.generate().publicKey;
    const client = new SolidClient(program, publicKey1);

    const [pda1, bump1] = client.getUserAccountPDA();
    const [pda2, bump2] = client.getUserAccountPDA(publicKey2);

    // PDAs should be different for different public keys
    expect(pda1.toBase58()).to.not.equal(pda2.toBase58());

    // Bumps might be different (though not guaranteed)
    // Just verify they're both valid bump values
    expect(bump1).to.be.at.least(0);
    expect(bump1).to.be.at.most(255);
    expect(bump2).to.be.at.least(0);
    expect(bump2).to.be.at.most(255);
  });

  it("Should generate same PDA for same publicKey", async () => {
    const publicKey = Keypair.generate().publicKey;
    const client1 = new SolidClient(program, publicKey);
    const client2 = new SolidClient(program, publicKey);

    const [pda1, bump1] = client1.getUserAccountPDA();
    const [pda2, bump2] = client2.getUserAccountPDA();

    // Same publicKey should generate same PDA
    expect(pda1.toBase58()).to.equal(pda2.toBase58());
    expect(bump1).to.equal(bump2);
  });

  it("Should handle SystemProgram.programId correctly", async () => {
    const publicKey = Keypair.generate().publicKey;
    const client = new SolidClient(program, publicKey);

    const [pda, bump] = client.getUserAccountPDA();

    // Verify the PDA is derived from the correct program ID
    const [expectedPda, expectedBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_account"), publicKey.toBuffer()],
      program.programId
    );

    expect(pda.toBase58()).to.equal(expectedPda.toBase58());
    expect(bump).to.equal(expectedBump);
  });

  it("Should match PDA generation logic used in program handlers", async () => {
    // This test ensures consistency with the PDA generation logic in the Rust program
    const masterWallet = Keypair.generate().publicKey;
    const client = new SolidClient(program, masterWallet);

    const [clientPda, clientBump] = client.getUserAccountPDA();

    // This should match the seeds used in handler_register.rs and handler_link_wallet.rs:
    // seeds = [b"user_account", user.key().as_ref()]
    const [programPda, programBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_account"), masterWallet.toBuffer()],
      program.programId
    );

    expect(clientPda.toBase58()).to.equal(programPda.toBase58());
    expect(clientBump).to.equal(programBump);
  });

  it("Should work with edge case publicKeys", async () => {
    // Test with PublicKey.default (all zeros)
    const defaultKey = PublicKey.default;
    const client = new SolidClient(program, defaultKey);

    const [pda, bump] = client.getUserAccountPDA();

    expect(pda).to.be.instanceOf(PublicKey);
    expect(bump).to.be.a("number");
    expect(bump).to.be.at.least(0);
    expect(bump).to.be.at.most(255);

    // Verify it's deterministic
    const [pda2, bump2] = client.getUserAccountPDA();
    expect(pda.toBase58()).to.equal(pda2.toBase58());
    expect(bump).to.equal(bump2);
  });

  describe("getUserAccount", () => {
    it("Should return null for non-existent account", async () => {
      const nonExistentKey = Keypair.generate().publicKey;
      const client = new SolidClient(program, nonExistentKey);

      const account = await client.getUserAccount();

      expect(account).to.be.null;
    });

    it("Should return null for non-existent account with custom publicKey", async () => {
      const defaultKey = Keypair.generate().publicKey;
      const nonExistentKey = Keypair.generate().publicKey;
      const client = new SolidClient(program, defaultKey);

      const account = await client.getUserAccount(nonExistentKey);

      expect(account).to.be.null;
    });

    it("Should fetch existing user account using default publicKey", async () => {
      // First, create a user account by registering
      const userKeypair = Keypair.generate();
      const username = "testuser" + Math.random().toString(36).substring(7);

      // Airdrop SOL for transaction fees
      const airdropSignature = await provider.connection.requestAirdrop(
        userKeypair.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(airdropSignature);

      // Register the user to create the account
      await program.methods
        .register(username)
        .accounts({
          user: userKeypair.publicKey,
        })
        .signers([userKeypair])
        .rpc();

      // Now test getUserAccount
      const client = new SolidClient(program, userKeypair.publicKey);
      const account = await client.getUserAccount();

      expect(account).to.not.be.null;
      expect(account!.username).to.equal(username);
      expect(account!.master.toBase58()).to.equal(
        userKeypair.publicKey.toBase58()
      );
      expect(account!.linkingWallets).to.be.an("array");
      expect(account!.linkingWallets).to.have.length(0);
    });

    it("Should fetch existing user account using custom publicKey", async () => {
      // Create a user account
      const userKeypair = Keypair.generate();
      const defaultKey = Keypair.generate().publicKey;
      const username = "testuser" + Math.random().toString(36).substring(7);

      // Airdrop SOL for transaction fees
      const airdropSignature = await provider.connection.requestAirdrop(
        userKeypair.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(airdropSignature);

      // Register the user to create the account
      await program.methods
        .register(username)
        .accounts({
          user: userKeypair.publicKey,
        })
        .signers([userKeypair])
        .rpc();

      // Test getUserAccount with custom publicKey (should find the account)
      const client = new SolidClient(program, defaultKey);
      const account = await client.getUserAccount(userKeypair.publicKey);

      expect(account).to.not.be.null;
      expect(account!.username).to.equal(username);
      expect(account!.master.toBase58()).to.equal(
        userKeypair.publicKey.toBase58()
      );
    });

    it("Should return null when using wrong publicKey", async () => {
      // Create a user account
      const userKeypair = Keypair.generate();
      const wrongKey = Keypair.generate().publicKey;
      const username = "testuser" + Math.random().toString(36).substring(7);

      // Airdrop SOL for transaction fees
      const airdropSignature = await provider.connection.requestAirdrop(
        userKeypair.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(airdropSignature);

      // Register the user to create the account
      await program.methods
        .register(username)
        .accounts({
          user: userKeypair.publicKey,
        })
        .signers([userKeypair])
        .rpc();

      // Test getUserAccount with wrong publicKey (should return null)
      const client = new SolidClient(program, userKeypair.publicKey);
      const account = await client.getUserAccount(wrongKey);

      expect(account).to.be.null;
    });

    it("Should fetch account with linked wallets", async () => {
      // Create master and linking wallets
      const masterWallet = Keypair.generate();
      const linkingWallet = Keypair.generate();
      const username = "testuser" + Math.random().toString(36).substring(7);

      // Airdrop SOL to both wallets
      const airdropSignature1 = await provider.connection.requestAirdrop(
        masterWallet.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(airdropSignature1);

      const airdropSignature2 = await provider.connection.requestAirdrop(
        linkingWallet.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(airdropSignature2);

      // Register the user
      await program.methods
        .register(username)
        .accounts({
          user: masterWallet.publicKey,
        })
        .signers([masterWallet])
        .rpc();

      // Link a wallet using Phantom-compatible signing
      const nonce = Math.floor(Math.random() * 1000000); // Random nonce like Phantom would use
      const messageText = `Link wallet: ${linkingWallet.publicKey.toString()} with nonce: ${nonce}`;
      const messageBuffer = new TextEncoder().encode(messageText);

      // Import nacl for signing (same as Phantom wallet uses)
      const nacl = require("tweetnacl");
      const signatureBytes = nacl.sign.detached(
        messageBuffer,
        masterWallet.secretKey
      );

      const { Ed25519Program } = require("@solana/web3.js");
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

      await provider.sendAndConfirm(tx, [linkingWallet], {
        skipPreflight: true,
      });

      // Now test getUserAccount - should show the linked wallet
      const client = new SolidClient(program, masterWallet.publicKey);
      const account = await client.getUserAccount();

      expect(account).to.not.be.null;
      expect(account!.username).to.equal(username);
      expect(account!.master.toBase58()).to.equal(
        masterWallet.publicKey.toBase58()
      );
      expect(account!.linkingWallets).to.have.length(1);
      expect(account!.linkingWallets[0].toBase58()).to.equal(
        linkingWallet.publicKey.toBase58()
      );
    });

    it("Should handle edge case with PublicKey.default", async () => {
      const client = new SolidClient(program, PublicKey.default);
      const account = await client.getUserAccount();

      // Should return null since PublicKey.default likely doesn't have a registered account
      expect(account).to.be.null;
    });
  });
});
