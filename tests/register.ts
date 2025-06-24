import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SolidSvm } from "../target/types/solid_svm";
import { Keypair, PublicKey } from "@solana/web3.js";
import { expect } from "chai";

const EVENT_NAME = "userRegistered";

describe("register", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.SolidSvm as Program<SolidSvm>;

  it("Emits UserRegistered event on register", async () => {
    const user = Keypair.generate();
    const username = "testuser_" + Math.random().toString(36).substring(2, 8);

    // Airdrop SOL for transaction fees
    const sig = await provider.connection.requestAirdrop(
      user.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig);

    // Listen for events
    let eventPromise = new Promise<{
      user: PublicKey;
      username: string;
      userAccount: PublicKey;
      identity: PublicKey;
    }>((resolve, reject) => {
      const listener = program.addEventListener(
        EVENT_NAME,
        (event: any, slot: number, signature: string) => {
          program.removeEventListener(listener);
          resolve(event);
        }
      );
      // Timeout after 10s
      setTimeout(() => {
        program.removeEventListener(listener);
        reject(new Error("Event not emitted in time"));
      }, 10000);
    });

    // Register the user
    await program.methods
      .register(username)
      .accounts({ user: user.publicKey })
      .signers([user])
      .rpc();

    // Wait for the event
    const event: {
      user: PublicKey;
      username: string;
      userAccount: PublicKey;
      identity: PublicKey;
    } = await eventPromise;
    expect(event.user.toBase58()).to.equal(user.publicKey.toBase58());
    expect(event.username).to.equal(username);
    console.log(event.user.toBase58());
    console.log(event.username);
    console.log(event.userAccount.toBase58());
    console.log(event.identity.toBase58());
  });
});
