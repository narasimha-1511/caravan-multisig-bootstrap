import { RpcConnectionBox } from './components/RpcConnectionBox'
import { ModeSwitcher } from './components/ModeSwitcher'
import { BootstrapWallet } from './components/BootstrapWallet'
import { useWalletStore } from './store/useWalletStore'
import './App.css'

function App() {
  const { mode } = useWalletStore();

  return (
    <div className="text-white h-full w-full">
      <header className="bg-slate-800/50 backdrop-blur border-b border-slate-700/50 sticky top-0 z-10">
        <div className="container mx-auto p-2 flex justify-between items-center">
          <span className="font-semibold text-blue-400 text-2xl uppercase">Multisig Wallet</span>
          <ModeSwitcher />
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="max-w-2xl mx-auto">
          {mode === 'bootstrap' ? (
            <BootstrapWallet />
          ) : (
            <div className="bg-slate-800 rounded-lg p-6">
              <p className="text-gray-400">Manual setup coming soon...</p>
            </div>
          )}
        </div>
      </main>
      
      <RpcConnectionBox />
    </div>
  )
}

export default App
