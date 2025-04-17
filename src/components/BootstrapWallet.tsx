import { useWalletStore } from '../store/walletStore';
import { useWalletSetup } from '../hooks/useWalletSetup';
import { useMultisigSetup } from '../hooks/useMultisigSetup';
import { useStepper } from '../hooks/useStepper';
import { Step } from '../types/wallet';

const STEPS: Step[] = [
  { id: 'wallets', title: 'Create Wallets', description: 'Create signing wallets' },
  { id: 'descriptors', title: 'Get Descriptors', description: 'Retrieve wallet descriptors' },
  { id: 'multisig', title: 'Setup Multisig', description: 'Configure multisig wallet' },
  { id: 'fund', title: 'Fund Wallet', description: 'Get deposit address' }
];

export const BootstrapWallet = () => {
  const { rpc } = useWalletStore();
  
  const {
    wallets,
    loading,
    error,
    createWallets,
    handleAddWallet,
    handleRemoveWallet,
    handleWalletNameChange,
    handleClearWallets,
    setError
  } = useWalletSetup();

  const {
    multisigConfig,
    setMultisigConfig,
    depositAddress,
    isMining,
    fundingAmount,
    setFundingAmount,
    exportConfig,
    generateAndSendFunds,
    generateDepositAddress
  } = useMultisigSetup(wallets);

  const {
    currentStep,
    steps,
    handleNext,
    handlePrevious,
    resetStepper
  } = useStepper(STEPS);

  const handleStepNext = async () => {
    if (currentStep === 0) {
      const success = await createWallets();
      if (success) {
        handleNext(true);
      }
    } else if (currentStep === 1) {
      const validWallets = wallets.filter(w => w.created && w.descriptor && w.fingerprint && w.xpub);
      if (validWallets.length >= 2) {
        handleNext(true);
      } else {
        setError('At least 2 wallets must have valid descriptors with fingerprints and xpubs');
      }
    } else if (currentStep === 2) {
      handleNext(true);
    }
  };

  const handleClear = async () => {
    await handleClearWallets();
    resetStepper();
  };

  if (!rpc.connected) {
    return (
      <div className="bg-slate-800 rounded-lg p-6">
        <p className="text-gray-400">Connect to your Bitcoin node first to bootstrap the wallet.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg p-6 space-y-6">
      <h2 className="text-xl font-medium text-white">Bootstrap Multisig Wallet</h2>
      
      {/* Stepper */}
      <div className="relative flex justify-between">
        {steps.map((step, index) => (
          <div key={step.id} className="relative flex-1 flex flex-col items-center">
            {/* Connector Line */}
            {index < steps.length - 1 && (
              <div className="absolute top-5 left-[calc(50%+2rem)] w-[calc(100%-4rem)] h-[2px]">
                <div
                  className={`h-full ${
                    index < currentStep ? 'bg-green-500' : 'bg-gray-600'
                  }`}
                />
              </div>
            )}
            
            {/* Circle */}
            <div className="relative z-10">
              <div
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center
                  ${
                    index === currentStep
                      ? 'bg-blue-500 border-2 border-blue-400 text-white'
                      : index < currentStep
                      ? 'bg-green-500 border-2 border-green-400 text-white'
                      : 'bg-slate-700 border-2 border-slate-600 text-slate-400'
                  }
                  transition-all duration-200
                `}
              >
                {index < currentStep ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className="text-sm font-medium">{index + 1}</span>
                )}
              </div>
            </div>

            {/* Text */}
            <div className="mt-3 text-center">
              <div
                className={`text-sm font-medium ${
                  index === currentStep ? 'text-blue-500' : 'text-gray-400'
                }`}
              >
                {step.title}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {step.description}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="mt-8">
        {currentStep === 0 && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg text-white">Signing Wallets</h3>
              <button
                onClick={handleAddWallet}
                className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
              >
                Add Wallet
              </button>
            </div>
            <div className="space-y-3">
              {wallets.map((wallet, index) => (
                <div key={index} className="flex items-center gap-3 p-1 bg-slate-900 rounded-lg">
                  <input
                    type="text"
                    value={wallet.name}
                    onChange={(e) => handleWalletNameChange(index, e.target.value)}
                    disabled={wallet.created || wallet.loading}
                    className="flex-1 p-2 bg-slate-800 text-white border border-slate-700 rounded focus:border-blue-500 focus:outline-none disabled:opacity-50"
                  />
                  <div className="flex items-center gap-2 pr-2">
                    {wallet.loading ? (
                      <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : wallet.created && wallet.descriptor ? (
                      <span className="text-green-500">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                    ) : wallet.created ? (
                      <span className="text-yellow-500">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </span>
                    ) : wallet.error ? (
                      <span className="text-red-500 hover:text-red-400 cursor-pointer" title={wallet.error}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </span>
                    ) : (
                      wallets.length > 2 && (
                        <button
                          onClick={() => handleRemoveWallet(index)}
                          className="text-red-500 hover:text-red-400"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )
                    )}
                  </div>
                  {wallet.error && (
                    <div className="col-span-2 mt-1 text-sm text-red-400">
                      {wallet.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={createWallets}
              disabled={loading}
              className="w-full p-3 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? 'Creating Wallets...' : 'Create Wallets'}
            </button>
          </div>
        )}

        {currentStep === 1 && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg text-white">Wallet Descriptors</h3>
            </div>
            <div className="space-y-3">
              {wallets.map((wallet, index) => (
                <div key={index} className="p-3 bg-slate-900 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-medium">{wallet.name}</span>
                    {wallet.loading ? (
                      <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : wallet.descriptor && wallet.fingerprint && wallet.xpub ? (
                      <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : null}
                  </div>
                  {wallet.descriptor && wallet.fingerprint && wallet.xpub && (
                    <>
                      <div className="text-sm">
                        <span className="text-gray-400">Fingerprint: </span>
                        <span className="text-white font-mono">{wallet.fingerprint}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-400">Path: </span>
                        <span className="text-white font-mono">{wallet.path}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-400">xPub: </span>
                        <span className="text-white font-mono break-all">{wallet.xpub}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-400">Full Descriptor: </span>
                        <span className="text-white font-mono break-all">{wallet.descriptor}</span>
                      </div>
                    </>
                  )}
                  {wallet.error && (
                    <div className="text-sm text-red-400">
                      {wallet.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg text-white">Configure Multisig</h3>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-slate-900 rounded-lg">
                <label className="block text-sm font-medium text-white mb-2">
                  Required Signers (M of {wallets.length})
                </label>
                <select
                  value={multisigConfig.requiredSigners}
                  onChange={(e) => setMultisigConfig(prev => ({ ...prev, requiredSigners: parseInt(e.target.value) }))}
                  className="w-full bg-slate-800 text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Array.from({ length: wallets.length }, (_, i) => i + 1).map(n => (
                    <option key={n} value={n}>{n} of {wallets.length} signatures required</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg text-white">Fund Your Wallet</h3>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-slate-900 rounded-lg">
                <div className="text-sm text-gray-400 mb-4">
                  Your {multisigConfig.requiredSigners}-of-{wallets.length} multisig wallet is ready.
                </div>

                <div className="flex gap-4 mb-4">
                  <button
                    onClick={exportConfig}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    Export Config
                  </button>
                  {/* <button
                    onClick={() => {
                      const url = `https://unchained-capital.github.io/caravan/#/wallet/import?config=${encodeURIComponent(JSON.stringify({
                        name: "Multisig Wallet",
                        network: multisigConfig.network,
                        addressType: multisigConfig.addressType,
                        extendedPublicKeys: wallets
                          .filter(w => w.fingerprint && w.xpub && w.bip32Path)
                          .map(w => ({
                            name: w.name,
                            bip32Path: w.bip32Path!.replace(/h/g, "'"),
                            xpub: w.xpub!,
                            fingerprint: w.fingerprint!
                          })),
                        requiredSigners: multisigConfig.requiredSigners,
                        startingAddressIndex: 0
                      }))}`;
                      window.open(url, '_blank');
                    }}
                    className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    Open in Caravan
                  </button> */}
                </div>

                <div className="text-sm text-gray-400 mb-4">
                  Send funds to this address:
                </div>
                {depositAddress ? (
                  <>
                    <div className="p-3 bg-slate-800 rounded-lg mb-4">
                      <code className="text-white break-all font-mono text-sm">{depositAddress}</code>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <input
                          type="number"
                          value={fundingAmount}
                          onChange={(e) => setFundingAmount(Math.max(0.00000001, Number(e.target.value)))}
                          min="0.00000001"
                          step="0.1"
                          className="flex-1 p-2 bg-slate-800 text-white border border-slate-700 rounded focus:border-blue-500 focus:outline-none"
                          placeholder="Amount in BTC"
                        />
                        <button
                          onClick={() => generateAndSendFunds(depositAddress, fundingAmount)}
                          disabled={isMining}
                          className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                        >
                          {isMining ? (
                            <div className="flex items-center gap-2">
                              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Mining & Sending...
                            </div>
                          ) : (
                            'Fund your Wallet'
                          )}
                        </button>
                      </div>
                      <div className="text-xs text-gray-500">
                        This will mine blocks to generate coins and send {fundingAmount} BTC to your multisig address (Regtest mode only)
                      </div>
                    </div>
                  </>
                ) : (
                  <button
                    onClick={generateDepositAddress}
                    className="w-full p-3 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                    disabled={loading}
                  >
                    {loading ? 'Getting Address...' : 'Get Deposit Address'}
                  </button>
                )}
              </div>

              <div className="text-sm text-gray-400">
                <p>What's next?</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Use "Fund with Coins" to fund your wallet in regtest mode</li>
                  <li>Or send real funds to the address above in mainnet/testnet</li>
                  <li>Use the exported config to spend from your wallet</li>
                  <li>Always test with small amounts first</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <div className="flex gap-4">
          <button
            onClick={handlePrevious}
            disabled={currentStep === 0}
            className="px-4 py-2 text-white bg-slate-700 rounded hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          {currentStep === 0 && (
            <button
              onClick={handleClear}
              className="px-4 py-2 text-red-400 hover:text-red-300 disabled:opacity-50"
              disabled={loading}
            >
              Clear Wallets
            </button>
          )}
        </div>
        <button
          onClick={handleStepNext}
          disabled={
            loading || 
            (currentStep === 0 && wallets.filter(w => w.created && w.descriptor).length < 2) ||
            (currentStep === 1 && wallets.filter(w => w.created && w.descriptor && w.fingerprint && w.xpub).length < 2)
          }
          className="px-4 py-2 text-white bg-blue-500 rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <div className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {currentStep === 0 ? 'Creating Wallets...' : 'Getting Descriptors...'}
            </div>
          ) : currentStep === steps.length - 1 ? (
            'Finish'
          ) : (
            'Next'
          )}
        </button>
      </div>

      {/* Status Message */}
      {!error && currentStep === 0 && (
        <div className="mt-4 text-sm text-gray-400">
          {wallets.filter(w => w.created && w.descriptor).length < 2 ? (
            `At least ${2 - wallets.filter(w => w.created && w.descriptor).length} more wallet${wallets.filter(w => w.created && w.descriptor).length === 1 ? '' : 's'} must be created to proceed`
          ) : (
            'Ready to proceed to next step'
          )}
        </div>
      )}

      {error && (
        <div className="p-3 mt-4 bg-red-500/10 border border-red-500/20 rounded text-red-400">
          {error}
        </div>
      )}
    </div>
  );
};
