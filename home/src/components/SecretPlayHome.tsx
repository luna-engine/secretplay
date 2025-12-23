import { useMemo, useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { Contract, parseEther } from 'ethers';
import type { Address } from 'viem';
import { Header } from './Header';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contracts';
import '../styles/SecretPlayHome.css';

const EMPTY_HANDLE = `0x${'0'.repeat(64)}`;
// const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const isValidHandle = (handle?: string): handle is string =>
  Boolean(handle && handle.length === EMPTY_HANDLE.length && handle !== EMPTY_HANDLE);

const BUILDINGS = [
  { id: 1, name: 'Signal Tower', cost: 100, tone: 'Guides new settlers with encrypted beacons.' },
  { id: 2, name: 'Hydro Lab', cost: 200, tone: 'Turns mist into resources without revealing inputs.' },
  { id: 3, name: 'Sky Archive', cost: 400, tone: 'Stores plans in locked ciphertext shelves.' },
  { id: 4, name: 'Chrono Forge', cost: 1000, tone: 'Synthesizes rare alloys in sealed loops.' },
] as const;

const shorten = (value?: string) => {
  if (!value) return 'N/A';
  return `${value.slice(0, 10)}...${value.slice(-6)}`;
};

export function SecretPlayHome() {
  const { address, isConnected } = useAccount();
  const { instance, isLoading: zamaLoading, error: zamaError } = useZamaInstance();
  const signerPromise = useEthersSigner();

  const [ethAmount, setEthAmount] = useState('0.001');
  const [selectedBuilding, setSelectedBuilding] = useState<(typeof BUILDINGS)[number]['id']>(1);
  const [buyStatus, setBuyStatus] = useState('');
  const [buildStatus, setBuildStatus] = useState('');
  const [decryptStatus, setDecryptStatus] = useState('');
  const [decryptedBuilding, setDecryptedBuilding] = useState<number | null>(null);
  const [decryptedBalance, setDecryptedBalance] = useState<number | null>(null);
  const [buyPending, setBuyPending] = useState(false);
  const [buildPending, setBuildPending] = useState(false);
  const [decryptPending, setDecryptPending] = useState(false);

  const contractAddress = CONTRACT_ADDRESS as Address;
  const playerAddress = address as Address | undefined;
  const contractReady = true;

  const {
    data: encryptedBalance,
    refetch: refetchBalance,
    isFetching: balanceFetching,
  } = useReadContract({
    address: contractAddress,
    abi: CONTRACT_ABI,
    functionName: 'getEncryptedBalance',
    args: playerAddress ? [playerAddress] : undefined,
    query: {
      enabled: Boolean(playerAddress && contractReady),
    },
  });

  const {
    data: encryptedBuilding,
    refetch: refetchBuilding,
    isFetching: buildingFetching,
  } = useReadContract({
    address: contractAddress,
    abi: CONTRACT_ABI,
    functionName: 'getEncryptedBuilding',
    args: playerAddress ? [playerAddress] : undefined,
    query: {
      enabled: Boolean(playerAddress && contractReady),
    },
  });

  const balanceHandle = useMemo(() => encryptedBalance as string | undefined, [encryptedBalance]);
  const buildingHandle = useMemo(() => encryptedBuilding as string | undefined, [encryptedBuilding]);

  const refreshEncryptedState = async () => {
    await Promise.all([refetchBalance(), refetchBuilding()]);
  };

  const ensureSigner = async () => {
    if (!signerPromise) {
      throw new Error('Connect a wallet to sign.');
    }
    const signer = await signerPromise;
    return signer;
  };

  const handleBuyGold = async () => {
    setBuyStatus('');
    setDecryptedBalance(null);
    setDecryptedBuilding(null);

    if (!isConnected || !address) {
      setBuyStatus('Connect your wallet first.');
      return;
    }

    try {
      setBuyPending(true);
      if (!contractReady) {
        setBuyStatus('Contract address is not configured.');
        return;
      }
      const signer = await ensureSigner();
      const value = parseEther(ethAmount);
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      const tx = await contract.buyGold({ value });
      setBuyStatus('Transaction sent. Waiting for confirmation...');
      await tx.wait();
      setBuyStatus('Gold minted. Encrypted balance refreshed.');
      await refreshEncryptedState();
    } catch (error) {
      console.error('Buy gold failed:', error);
      setBuyStatus('Gold purchase failed. Check wallet and amount.');
    } finally {
      setBuyPending(false);
    }
  };

  const handleBuild = async () => {
    setBuildStatus('');
    setDecryptedBuilding(null);

    if (!instance || zamaLoading) {
      setBuildStatus('Encryption service is still loading.');
      return;
    }

    if (!isConnected || !address) {
      setBuildStatus('Connect your wallet first.');
      return;
    }

    try {
      setBuildPending(true);
      if (!contractReady) {
        setBuildStatus('Contract address is not configured.');
        return;
      }
      const signer = await ensureSigner();
      const input = instance.createEncryptedInput(CONTRACT_ADDRESS, address);
      input.add8(selectedBuilding);
      const encryptedInput = await input.encrypt();

      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.build(encryptedInput.handles[0], encryptedInput.inputProof);
      setBuildStatus('Encrypted build request sent...');
      await tx.wait();
      setBuildStatus('Building choice stored. You can decrypt it now.');
      await refreshEncryptedState();
    } catch (error) {
      console.error('Build failed:', error);
      setBuildStatus('Build failed. Verify your gold balance.');
    } finally {
      setBuildPending(false);
    }
  };

  const decryptHandle = async (handle: string) => {
    if (!instance || !signerPromise) {
      throw new Error('Encryption service not ready.');
    }

    const signer = await ensureSigner();
    const signerAddress = await signer.getAddress();
    const keypair = instance.generateKeypair();
    const startTimeStamp = Math.floor(Date.now() / 1000).toString();
    const durationDays = '1';
    const contractAddresses = [CONTRACT_ADDRESS];
    const eip712 = instance.createEIP712(keypair.publicKey, contractAddresses, startTimeStamp, durationDays);

    const signature = await signer.signTypedData(
      eip712.domain,
      { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
      eip712.message,
    );

    const result = await instance.userDecrypt(
      [{ handle, contractAddress: CONTRACT_ADDRESS }],
      keypair.privateKey,
      keypair.publicKey,
      signature.replace('0x', ''),
      contractAddresses,
      signerAddress,
      startTimeStamp,
      durationDays,
    );

    return result[handle];
  };

  const handleDecryptBuilding = async () => {
    setDecryptStatus('');
    if (!isValidHandle(buildingHandle)) {
      setDecryptStatus('No building stored yet.');
      return;
    }
    if (!contractReady) {
      setDecryptStatus('Contract address is not configured.');
      return;
    }

    try {
      setDecryptPending(true);
      const clearValue = await decryptHandle(buildingHandle);
      setDecryptedBuilding(Number(clearValue));
      setDecryptStatus('Building decrypted successfully.');
    } catch (error) {
      console.error('Building decrypt failed:', error);
      setDecryptStatus('Decryption failed. Try again.');
    } finally {
      setDecryptPending(false);
    }
  };

  const handleDecryptBalance = async () => {
    setDecryptStatus('');
    if (!isValidHandle(balanceHandle)) {
      setDecryptStatus('No gold minted yet.');
      return;
    }
    if (!contractReady) {
      setDecryptStatus('Contract address is not configured.');
      return;
    }

    try {
      setDecryptPending(true);
      const clearValue = await decryptHandle(balanceHandle);
      setDecryptedBalance(Number(clearValue));
      setDecryptStatus('Balance decrypted successfully.');
    } catch (error) {
      console.error('Balance decrypt failed:', error);
      setDecryptStatus('Decryption failed. Try again.');
    } finally {
      setDecryptPending(false);
    }
  };

  return (
    <div className="secret-home">
      <Header />
      <main className="home-main">
        <section className="hero reveal">
          <div className="hero-copy">
            <p className="eyebrow">Encrypted builder playground</p>
            <h2>Shape a hidden city with on-chain secrecy.</h2>
            <p className="hero-subtitle">
              Buy encrypted gold, submit a private building choice, and decrypt it only when you are ready.
              Every action stays shielded by FHE while still living on Sepolia.
            </p>
            <div className="hero-actions">
              <div className="stat-chip">
                <span className="stat-label">Rate</span>
                <span className="stat-value">1 ETH -{'>'} 1,000,000 gold</span>
              </div>
              <div className="stat-chip">
                <span className="stat-label">Network</span>
                <span className="stat-value">Sepolia</span>
              </div>
            </div>
          </div>
          <div className="hero-panel">
            <div className="panel-card reveal delay-1">
              <h3>Encrypted Status</h3>
              <div className="panel-row">
                <span>Wallet</span>
                <strong>{isConnected ? 'Connected' : 'Not connected'}</strong>
              </div>
              <div className="panel-row">
                <span>Relayer</span>
                <strong>{zamaLoading ? 'Loading' : zamaError ? 'Error' : 'Ready'}</strong>
              </div>
              <div className="panel-row">
                <span>Contract</span>
                <strong>{contractReady ? 'Configured' : 'Missing'}</strong>
              </div>
              <div className="panel-row">
                <span>Gold Handle</span>
                <strong>{balanceFetching ? 'Loading...' : shorten(balanceHandle)}</strong>
              </div>
              <div className="panel-row">
                <span>Building Handle</span>
                <strong>{buildingFetching ? 'Loading...' : shorten(buildingHandle)}</strong>
              </div>
              <div className="panel-row">
                <span>Decrypted Gold</span>
                <strong>{decryptedBalance ?? 'N/A'}</strong>
              </div>
              <div className="panel-row">
                <span>Decrypted Building</span>
                <strong>{decryptedBuilding ?? 'N/A'}</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="action-grid">
          <div className="card reveal delay-2">
            <h3>Buy Gold</h3>
            <p>Convert ETH into encrypted gold. The balance stays private until you decrypt it.</p>
            <label className="field">
              <span>ETH amount</span>
              <input
                type="number"
                min="0"
                step="0.0001"
                value={ethAmount}
                onChange={(event) => setEthAmount(event.target.value)}
                placeholder="0.001"
              />
            </label>
            <button className="primary" onClick={handleBuyGold} disabled={buyPending}>
              {buyPending ? 'Minting...' : 'Buy encrypted gold'}
            </button>
            {buyStatus && <p className="status">{buyStatus}</p>}
          </div>

          <div className="card reveal delay-3">
            <h3>Choose a Building</h3>
            <p>Select a structure. The choice is encrypted before it hits the chain.</p>
            <div className="building-grid">
              {BUILDINGS.map((building) => (
                <button
                  key={building.id}
                  type="button"
                  onClick={() => setSelectedBuilding(building.id)}
                  className={`building-card ${selectedBuilding === building.id ? 'selected' : ''}`}
                >
                  <div className="building-head">
                    <span>{building.name}</span>
                    <span className="building-cost">{building.cost} gold</span>
                  </div>
                  <p>{building.tone}</p>
                </button>
              ))}
            </div>
            <button className="primary" onClick={handleBuild} disabled={buildPending || zamaLoading}>
              {buildPending ? 'Submitting...' : 'Encrypt & build'}
            </button>
            {buildStatus && <p className="status">{buildStatus}</p>}
          </div>

          <div className="card reveal delay-4">
            <h3>Decrypt Your Data</h3>
            <p>Request user decryption for your encrypted handles.</p>
            <div className="dual-actions">
              <button className="secondary" onClick={handleDecryptBalance} disabled={decryptPending}>
                {decryptPending ? 'Decrypting...' : 'Decrypt gold'}
              </button>
              <button className="secondary" onClick={handleDecryptBuilding} disabled={decryptPending}>
                {decryptPending ? 'Decrypting...' : 'Decrypt building'}
              </button>
            </div>
            {decryptStatus && <p className="status">{decryptStatus}</p>}
          </div>
        </section>
      </main>
    </div>
  );
}
