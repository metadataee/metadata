import {
    createKeypairSignerFromBase58,
    createSolanaClient,
    createTransaction,
    generateKeyPair,
    generateKeyPairSigner,
    getExplorerLink,
    getMinimumBalanceForRentExemption,
    getSignatureFromTransaction,
    signTransactionMessageWithSigners,
} from "gill";
import {
    getCreateAccountInstruction,
    getCreateMetadataAccountV3Instruction,
    getTokenMetadataAddress
} from "gill/programs";
import {
    getAssociatedTokenAccountAddress,
    getCreateAssociatedTokenInstruction,
    getInitializeMintInstruction,
    getMintSize,
    getMintToInstruction,
    getSetAuthorityInstruction,
    AuthorityType,
    TOKEN_PROGRAM_ADDRESS
} from "gill/programs/token";

const { rpc, sendAndConfirmTransaction } = createSolanaClient({
    urlOrMoniker: 'mainnet'
})

const privateKey = Bun.env.privatekey || ''
const signer = await createKeypairSignerFromBase58(privateKey)
console.log("Signer: ", signer.address)

const balance = await rpc.getBalance(signer.address).send();
console.log("Balance:", balance.value);

const { value: latestBlockhash } = await rpc.getLatestBlockhash().send()

const mint = await generateKeyPairSigner()
console.log("Mint: ", mint.address)

const space = getMintSize()
const metadata = await getTokenMetadataAddress(mint)
const associatedTokenAccount = await getAssociatedTokenAccountAddress(
    mint.address,
    signer.address,
    TOKEN_PROGRAM_ADDRESS
);


const tx = createTransaction({
    feePayer: signer,
    version: 'legacy',
    instructions: [
        // 1. Create Mint Account
        getCreateAccountInstruction({
            space,
            lamports: await getMinimumBalanceForRentExemption(space),
            newAccount: mint,
            payer: signer,
            programAddress: TOKEN_PROGRAM_ADDRESS
        }),

        // 2. Initialize Mint
        getInitializeMintInstruction({
            mint: mint.address,
            mintAuthority: signer.address,
            freezeAuthority: signer.address,
            decimals: 9
        }, {
            programAddress: TOKEN_PROGRAM_ADDRESS
        }),

        // 3. Create Metadata (Immutable)
        getCreateMetadataAccountV3Instruction({
            collectionDetails: null,
            isMutable: false,
            updateAuthority: signer,
            mint: mint.address,
            metadata,
            mintAuthority: signer,
            payer: signer,
            data: {
                sellerFeeBasisPoints: 0,
                collection: null,
                creators: null,
                uses: null,
                name: "Ghibli Pepe",
                symbol: "GHIBLIPEPE",
                uri: 'https://raw.githubusercontent.com/metadataee/metadata/refs/heads/main/metadata.json'
            }
        }),

        // 4. Create Associated Token Account
        getCreateAssociatedTokenInstruction({
            payer: signer,
            owner: signer.address,
            mint: mint.address,
            tokenProgram: TOKEN_PROGRAM_ADDRESS,
            ata: associatedTokenAccount
        }),

        // 5. Mint 1 Billion Tokens
        getMintToInstruction({
            mint: mint.address,
            mintAuthority: signer.address,
            amount: BigInt(1_000_000_000 * 10 ** 9),
            token: associatedTokenAccount
        }, {
            programAddress: TOKEN_PROGRAM_ADDRESS
        }),

        // 6. Revoke Mint Authority
        getSetAuthorityInstruction({
            owner: signer.address,
            authorityType: AuthorityType.MintTokens,
            newAuthority: null,
            owned: mint.address
        }, {
            programAddress: TOKEN_PROGRAM_ADDRESS
        }),

        // 7. Revoke Freeze Authority
        getSetAuthorityInstruction({
            owner: signer.address,
            authorityType: AuthorityType.FreezeAccount,
            newAuthority: null,
            owned: mint.address
        }, {
            programAddress: TOKEN_PROGRAM_ADDRESS
        })
    ],
    latestBlockhash,
})

const signedTransaction = await signTransactionMessageWithSigners(tx)

console.log("explorer: ", getExplorerLink({
    cluster: 'mainnet',
    transaction: getSignatureFromTransaction(signedTransaction)
}))

await sendAndConfirmTransaction(signedTransaction)
