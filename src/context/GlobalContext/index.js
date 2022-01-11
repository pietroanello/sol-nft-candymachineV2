import React, { useState } from 'react'

const GlobalContext = React.createContext()

const GlobalContextProvider = props => {
  const [walletAddress, setWalletAddress] = useState(null)
  return (
    <GlobalContext.Provider value={{ walletAddress, setWalletAddress }}>
      {props.children}
    </GlobalContext.Provider>
  )
}

export { GlobalContextProvider, GlobalContext }
