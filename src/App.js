import React, { useContext, useEffect } from 'react'
import './App.css'
import CandyMachine from './CandyMachine'
import { GlobalContext } from './context/GlobalContext'
import useWalletFunctions from './hooks/useWalletFunctions'

const App = () => {
  const { walletAddress, setWalletAddress } = useContext(GlobalContext)
  const { connectWallet, checkIfWalletIsPhantom } = useWalletFunctions()

  useEffect(() => {
    const onLoad = async () => {
      await checkIfWalletIsPhantom()
    }
    window.addEventListener('load', onLoad)
    return () => window.removeEventListener('load', onLoad)
  }, [])

  const renderNotConnectedContainer = () => (
    <button className='cta-button connect-wallet-button' onClick={connectWallet}>
      Connect to Wallet
    </button>
  )

  return (
    <div className='App'>
      <div className='container'>
        <div className='header-container'>
          <p className='header'>🍭 Candy Drop</p>
          <p className='sub-text'>NFT drop machine with fair mint</p>
          {!walletAddress && renderNotConnectedContainer()}
        </div>
        {walletAddress && <CandyMachine walletAddress={window.solana} />}
      </div>
    </div>
  )
}

export default App
