import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Keypair } from "@solana/web3.js";
import { assert } from "chai";
import { SolidSvm } from "../target/types/solid_svm";

describe("attestation", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.solidSvm as Program<SolidSvm>;

  // Helper to derive the PDA for a wallet
  function getAttestationPda(wallet: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("attestation"), wallet.toBuffer()],
      program.programId
    );
  }

  let wallet: Keypair;
  let attestation: Keypair;
  let attestationPda: PublicKey;

  beforeEach(async () => {
    wallet = Keypair.generate();
    attestation = Keypair.generate();
    [attestationPda] = getAttestationPda(wallet.publicKey);
    // Fund the wallet
    const sig = await provider.connection.requestAirdrop(
      wallet.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig);
    // Create the attestation account for each test
    await program.methods
      .createAttestation(attestation.publicKey)
      .accounts({
        attestationAccount: attestationPda,
        payer: provider.wallet.publicKey,
        wallet: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([])
      .rpc();
  });

  it("fails to create a duplicate attestation account", async () => {
    // Try to create the same attestation account again, should fail
    try {
      await program.methods
        .createAttestation(attestation.publicKey)
        .accounts({
          attestationAccount: attestationPda,
          payer: provider.wallet.publicKey,
          wallet: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([])
        .rpc();
      assert.fail(
        "Should not be able to create a duplicate attestation account"
      );
    } catch (e) {
      assert.include(e.message, "already in use");
    }
  });

  it("updates the attestation address", async () => {
    const newAttestation = Keypair.generate();
    await program.methods
      .updateAttestation(newAttestation.publicKey)
      .accounts({
        attestationAccount: attestationPda,
        wallet: wallet.publicKey,
        authority: provider.wallet.publicKey,
      })
      .signers([])
      .rpc();

    const account = await program.account.attestationAccount.fetch(
      attestationPda
    );
    assert.ok(account.attestation.equals(newAttestation.publicKey));
  });

  it("fetches the attestation account", async () => {
    const account = await program.account.attestationAccount.fetch(
      attestationPda
    );
    assert.ok(account.wallet.equals(wallet.publicKey));
  });

  it("deletes the attestation account", async () => {
    await program.methods
      .deleteAttestation()
      .accounts({
        attestationAccount: attestationPda,
        wallet: wallet.publicKey,
        authority: provider.wallet.publicKey,
      })
      .signers([])
      .rpc();
    // Should throw when fetching deleted account
    try {
      await program.account.attestationAccount.fetch(attestationPda);
      assert.fail("Account should be closed");
    } catch (e) {
      assert.include(e.message, "Account does not exist");
    }
  });

  it("fetches the attestation address from a wallet address", async () => {
    // Derive the PDA for the wallet
    const [pda] = getAttestationPda(wallet.publicKey);
    // Fetch the attestation account
    const account = await program.account.attestationAccount.fetch(pda);
    // Assert the attestation address matches what was set up
    assert.ok(account.wallet.equals(wallet.publicKey));
    assert.ok(account.attestation.equals(attestation.publicKey));
  });
});
