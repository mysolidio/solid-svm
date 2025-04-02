import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SolidSvm } from "../target/types/solid_svm";
import PK from "../.config/solana/payer.json";
import {Keypair} from "@solana/web3.js";
import * as bs58 from 'bs58';

describe("solid-svm", () => {
  // // Configure the client to use the local cluster.
  // anchor.setProvider(anchor.AnchorProvider.env());
  //
  // const program = anchor.workspace.SolidSvm as Program<SolidSvm>;

  it("Is initialized!", async () => {
    // Add your test here.
    // const tx = await program.methods.initialize().rpc();
    const pk = Keypair.fromSecretKey(new Uint8Array(PK));
    console.log("Your pk:", bs58.default.encode(pk.secretKey).toString())
  });
});
