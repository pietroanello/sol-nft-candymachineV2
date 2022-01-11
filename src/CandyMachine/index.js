import { Metadata } from '@metaplex-foundation/mpl-token-metadata'
import { Program, Provider, web3 } from '@project-serum/anchor'
import { MintLayout, Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { Connection, PublicKey } from '@solana/web3.js'
import bs58 from 'bs58'
import React, { useEffect, useState } from 'react'
import './CandyMachine.css'
import { sendTransactions } from './connection'
import {
  candyMachineProgram,
  CIVIC,
  getAtaForMint,
  getNetworkExpire,
  getNetworkToken,
  SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
  TOKEN_METADATA_PROGRAM_ID,
} from './helpers'

const { SystemProgram } = web3
const opts = {
  preflightCommitment: 'processed',
}

const CandyMachine = ({ walletAddress }) => {
  const [candyMachine, setCandyMachine] = useState(null)
  // State
  const [machineStats, setMachineStats] = useState(null)
  const [mints, setMints] = useState([])
  // Add these two state properties
  const [isMinting, setIsMinting] = useState(false)
  const [isLoadingMints, setIsLoadingMints] = useState(false)

  const getProvider = () => {
    const rpcHost = process.env.REACT_APP_SOLANA_RPC_HOST
    // Create a new connection object
    const connection = new Connection(rpcHost)

    // Create a new Solana provider object
    const provider = new Provider(connection, window.solana, opts.preflightCommitment)

    return provider
  }

  const fetchHashTable = async candyMachineId => {
    const rpcHost = process.env.REACT_APP_SOLANA_RPC_HOST
    // Create a new connection object
    const connection = new Connection(rpcHost)

    const MAX_NAME_LENGTH = 32
    const MAX_URI_LENGTH = 200
    const MAX_SYMBOL_LENGTH = 10
    const MAX_CREATOR_LEN = 32 + 1 + 1
    const MAX_CREATOR_LIMIT = 5
    const MAX_DATA_SIZE =
      4 +
      MAX_NAME_LENGTH +
      4 +
      MAX_SYMBOL_LENGTH +
      4 +
      MAX_URI_LENGTH +
      2 +
      1 +
      4 +
      MAX_CREATOR_LIMIT * MAX_CREATOR_LEN
    const MAX_METADATA_LEN = 1 + 32 + 32 + MAX_DATA_SIZE + 1 + 1 + 9 + 172
    const CREATOR_ARRAY_START =
      1 + 32 + 32 + 4 + MAX_NAME_LENGTH + 4 + MAX_URI_LENGTH + 4 + MAX_SYMBOL_LENGTH + 2 + 1 + 4

    const [candyMachineCreator, creatorBump] = await getCandyMachineCreator(candyMachineId)

    const metadataAccounts = await connection.getProgramAccounts(TOKEN_METADATA_PROGRAM_ID, {
      // The mint address is located at byte 33 and lasts for 32 bytes.
      dataSlice: { offset: 33, length: 32 },

      filters: [
        // Only get Metadata accounts.
        { dataSize: MAX_METADATA_LEN },

        // Filter using the first creator.
        {
          memcmp: {
            offset: CREATOR_ARRAY_START,
            bytes: candyMachineCreator.toBase58(),
          },
        },
      ],
    })

    const data = []

    for (const metadataAccountInfo of metadataAccounts) {
      const encodedAddress = bs58.encode(metadataAccountInfo.account.data)
      const metadataPDA = await Metadata.getPDA(new PublicKey(encodedAddress))
      const tokenMetadata = await Metadata.load(connection, metadataPDA)
      data.push(tokenMetadata.data)
    }

    return data
  }

  const getCandyMachineState = async () => {
    const provider = getProvider()

    // Get metadata about your deployed candy machine program
    const idl = await Program.fetchIdl(candyMachineProgram, provider)

    // Create a program that you can call
    const program = new Program(idl, candyMachineProgram, provider)

    // Fetch the metadata from your candy machine
    const candyMachine = await program.account.candyMachine.fetch(
      process.env.REACT_APP_CANDY_MACHINE_ID
    )

    // Parse out all our metadata and log it out
    const itemsAvailable = candyMachine.data.itemsAvailable.toNumber()
    const itemsRedeemed = candyMachine.itemsRedeemed.toNumber()
    const itemsRemaining = itemsAvailable - itemsRedeemed
    const goLiveData = candyMachine.data.goLiveDate.toNumber()
    const presale =
      candyMachine.data.whitelistMintSettings &&
      candyMachine.data.whitelistMintSettings.presale &&
      (!candyMachine.data.goLiveDate ||
        candyMachine.data.goLiveDate.toNumber() > new Date().getTime() / 1000)

    // We will be using this later in our UI so let's generate this now
    const goLiveDateTimeString = `${new Date(goLiveData * 1000).toGMTString()}`

    setCandyMachine({
      id: process.env.REACT_APP_CANDY_MACHINE_ID,
      program,
      state: {
        itemsAvailable,
        itemsRedeemed,
        itemsRemaining,
        goLiveData,
        goLiveDateTimeString,
        isSoldOut: itemsRemaining === 0,
        isActive:
          (presale || candyMachine.data.goLiveDate.toNumber() < new Date().getTime() / 1000) &&
          (candyMachine.endSettings
            ? candyMachine.endSettings.endSettingType.date
              ? candyMachine.endSettings.number.toNumber() > new Date().getTime() / 1000
              : itemsRedeemed < candyMachine.endSettings.number.toNumber()
            : true),
        isPresale: presale,
        goLiveDate: candyMachine.data.goLiveDate,
        treasury: candyMachine.wallet,
        tokenMint: candyMachine.tokenMint,
        gatekeeper: candyMachine.data.gatekeeper,
        endSettings: candyMachine.data.endSettings,
        whitelistMintSettings: candyMachine.data.whitelistMintSettings,
        hiddenSettings: candyMachine.data.hiddenSettings,
        price: candyMachine.data.price,
      },
    })

    console.log({
      itemsAvailable,
      itemsRedeemed,
      itemsRemaining,
      goLiveData,
      goLiveDateTimeString,
      presale,
    })

    const data = await fetchHashTable(process.env.REACT_APP_CANDY_MACHINE_ID)

    if (data.length !== 0) {
      console.log(data)
      const requests = data.map(async mint => {
        try {
          const response = await fetch(mint.data.uri)
          const parse = await response.json()
          console.log('Past Minted NFT', mint)

          return parse.image
        } catch (e) {
          console.error('Failed retrieving Minted NFT', mint)
          return null
        }
      })

      const allMints = await Promise.all(requests)
      const filteredMints = allMints.filter(mint => mint !== null)
      console.log(filteredMints)
      setMints(filteredMints)
    }
  }

  useEffect(() => {
    getCandyMachineState()
  }, [])

  const getCandyMachineCreator = async candyMachine => {
    const candyMachineID = new PublicKey(candyMachine)
    return await web3.PublicKey.findProgramAddress(
      [Buffer.from('candy_machine'), candyMachineID.toBuffer()],
      candyMachineProgram
    )
  }

  const getMetadata = async mint => {
    return (
      await PublicKey.findProgramAddress(
        [Buffer.from('metadata'), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
        TOKEN_METADATA_PROGRAM_ID
      )
    )[0]
  }

  const getMasterEdition = async mint => {
    return (
      await PublicKey.findProgramAddress(
        [
          Buffer.from('metadata'),
          TOKEN_METADATA_PROGRAM_ID.toBuffer(),
          mint.toBuffer(),
          Buffer.from('edition'),
        ],
        TOKEN_METADATA_PROGRAM_ID
      )
    )[0]
  }

  const createAssociatedTokenAccountInstruction = (
    associatedTokenAddress,
    payer,
    walletAddress,
    splTokenMintAddress
  ) => {
    const keys = [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: associatedTokenAddress, isSigner: false, isWritable: true },
      { pubkey: walletAddress, isSigner: false, isWritable: false },
      { pubkey: splTokenMintAddress, isSigner: false, isWritable: false },
      {
        pubkey: web3.SystemProgram.programId,
        isSigner: false,
        isWritable: false,
      },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      {
        pubkey: web3.SYSVAR_RENT_PUBKEY,
        isSigner: false,
        isWritable: false,
      },
    ]
    return new web3.TransactionInstruction({
      keys,
      programId: SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
      data: Buffer.from([]),
    })
  }

  const mintToken = async () => {
    const mint = web3.Keypair.generate()

    const userTokenAccountAddress = (
      await getAtaForMint(mint.publicKey, walletAddress.publicKey)
    )[0]

    const userPayingAccountAddress = candyMachine.state.tokenMint
      ? (await getAtaForMint(candyMachine.state.tokenMint, walletAddress.publicKey))[0]
      : walletAddress.publicKey

    const candyMachineAddress = candyMachine.id
    const remainingAccounts = []
    const signers = [mint]
    const cleanupInstructions = []
    const instructions = [
      web3.SystemProgram.createAccount({
        fromPubkey: walletAddress.publicKey,
        newAccountPubkey: mint.publicKey,
        space: MintLayout.span,
        lamports: await candyMachine.program.provider.connection.getMinimumBalanceForRentExemption(
          MintLayout.span
        ),
        programId: TOKEN_PROGRAM_ID,
      }),
      Token.createInitMintInstruction(
        TOKEN_PROGRAM_ID,
        mint.publicKey,
        0,
        walletAddress.publicKey,
        walletAddress.publicKey
      ),
      createAssociatedTokenAccountInstruction(
        userTokenAccountAddress,
        walletAddress.publicKey,
        walletAddress.publicKey,
        mint.publicKey
      ),
      Token.createMintToInstruction(
        TOKEN_PROGRAM_ID,
        mint.publicKey,
        userTokenAccountAddress,
        walletAddress.publicKey,
        [],
        1
      ),
    ]

    if (candyMachine.state.gatekeeper) {
      remainingAccounts.push({
        pubkey: (
          await getNetworkToken(
            walletAddress.publicKey,
            candyMachine.state.gatekeeper.gatekeeperNetwork
          )
        )[0],
        isWritable: true,
        isSigner: false,
      })
      if (candyMachine.state.gatekeeper.expireOnUse) {
        remainingAccounts.push({
          pubkey: CIVIC,
          isWritable: false,
          isSigner: false,
        })
        remainingAccounts.push({
          pubkey: (await getNetworkExpire(candyMachine.state.gatekeeper.gatekeeperNetwork))[0],
          isWritable: false,
          isSigner: false,
        })
      }
    }
    if (candyMachine.state.whitelistMintSettings) {
      const mint = new web3.PublicKey(candyMachine.state.whitelistMintSettings.mint)

      const whitelistToken = (await getAtaForMint(mint, walletAddress.publicKey))[0]
      remainingAccounts.push({
        pubkey: whitelistToken,
        isWritable: true,
        isSigner: false,
      })

      if (candyMachine.state.whitelistMintSettings.mode.burnEveryTime) {
        const whitelistBurnAuthority = web3.Keypair.generate()

        remainingAccounts.push({
          pubkey: mint,
          isWritable: true,
          isSigner: false,
        })
        remainingAccounts.push({
          pubkey: whitelistBurnAuthority.publicKey,
          isWritable: false,
          isSigner: true,
        })
        signers.push(whitelistBurnAuthority)
        const exists = await candyMachine.program.provider.connection.getAccountInfo(whitelistToken)
        if (exists) {
          instructions.push(
            Token.createApproveInstruction(
              TOKEN_PROGRAM_ID,
              whitelistToken,
              whitelistBurnAuthority.publicKey,
              walletAddress.publicKey,
              [],
              1
            )
          )
          cleanupInstructions.push(
            Token.createRevokeInstruction(
              TOKEN_PROGRAM_ID,
              whitelistToken,
              walletAddress.publicKey,
              []
            )
          )
        }
      }
    }

    if (candyMachine.state.tokenMint) {
      const transferAuthority = web3.Keypair.generate()

      signers.push(transferAuthority)
      remainingAccounts.push({
        pubkey: userPayingAccountAddress,
        isWritable: true,
        isSigner: false,
      })
      remainingAccounts.push({
        pubkey: transferAuthority.publicKey,
        isWritable: false,
        isSigner: true,
      })

      instructions.push(
        Token.createApproveInstruction(
          TOKEN_PROGRAM_ID,
          userPayingAccountAddress,
          transferAuthority.publicKey,
          walletAddress.publicKey,
          [],
          candyMachine.state.price.toNumber()
        )
      )
      cleanupInstructions.push(
        Token.createRevokeInstruction(
          TOKEN_PROGRAM_ID,
          userPayingAccountAddress,
          walletAddress.publicKey,
          []
        )
      )
    }
    const metadataAddress = await getMetadata(mint.publicKey)
    const masterEdition = await getMasterEdition(mint.publicKey)

    const [candyMachineCreator, creatorBump] = await getCandyMachineCreator(candyMachineAddress)

    instructions.push(
      await candyMachine.program.instruction.mintNft(creatorBump, {
        accounts: {
          candyMachine: candyMachineAddress,
          candyMachineCreator,
          payer: walletAddress.publicKey,
          wallet: candyMachine.state.treasury,
          mint: mint.publicKey,
          metadata: metadataAddress,
          masterEdition,
          mintAuthority: walletAddress.publicKey,
          updateAuthority: walletAddress.publicKey,
          tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: web3.SYSVAR_RENT_PUBKEY,
          clock: web3.SYSVAR_CLOCK_PUBKEY,
          recentBlockhashes: web3.SYSVAR_RECENT_BLOCKHASHES_PUBKEY,
          instructionSysvarAccount: web3.SYSVAR_INSTRUCTIONS_PUBKEY,
        },
        remainingAccounts: remainingAccounts.length > 0 ? remainingAccounts : undefined,
      })
    )

    try {
      return (
        await sendTransactions(
          candyMachine.program.provider.connection,
          candyMachine.program.provider.wallet,
          [instructions, cleanupInstructions],
          [signers, []]
        )
      ).txs.map(t => t.txid)
    } catch (e) {
      console.log(e)
    }
    return []
  }

  const renderMintedItems = () => {
    return mints.map(mint => <img src={mint} />)
  }

  return (
    candyMachine && (
      <div className='machine-container'>
        <p>{`Drop Date: ${candyMachine.state.goLiveDateTimeString}`}</p>
        <p>{`Items Minted: ${candyMachine.state.itemsRedeemed} / ${candyMachine.state.itemsAvailable}`}</p>
        <button className='cta-button mint-button' onClick={mintToken}>
          Mint NFT
        </button>
        {mints.length > 0 && renderMintedItems()}
      </div>
    )
  )
}

export default CandyMachine
