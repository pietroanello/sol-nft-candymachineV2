import { useContext } from 'react'
import { GlobalContext } from '../../context/GlobalContext'

const useWalletFunctions = () => {
  const { setWalletAddress } = useContext(GlobalContext)

  const checkIfWalletIsPhantom = async () => {
    const { solana } = window
    try {
      if (solana && solana.isPhantom) {
        console.log('Phantom wallet found')

        /*
         * The solana object gives us a function that will allow us to connect
         * directly with the user's wallet!
         */
        const response = await solana.connect({ onlyIfTrusted: true })
        console.log('Connected with Public Key:', response.publicKey.toString())
        setWalletAddress(response.publicKey.toString())
      } else {
        console.error('Solana object not found or your wallet is not Phantom 👻')
      }
    } catch (error) {
      console.error(error)
    }
  }

  const connectWallet = async () => {
    const { solana } = window
    try {
      if (solana) {
        const response = await solana.connect()
        console.log('Connected with Public Key:', response.publicKey.toString())
        setWalletAddress(response.publicKey.toString())
      }
    } catch (error) {
      console.error(error)
    }
  }

  return { connectWallet, checkIfWalletIsPhantom }
}

export default useWalletFunctions
