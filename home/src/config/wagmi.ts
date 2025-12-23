import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { createStorage } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { http } from 'viem';

const inMemoryStorage = () => {
  const storage = new Map<string, string>();
  return {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
  };
};

export const config = getDefaultConfig({
  appName: 'SecretPlay',
  projectId: '2f1b7f9bd4f94b6ab6a4a7c3f3e9d0c7',
  chains: [sepolia],
  ssr: false,
  transports: {
    [sepolia.id]: http(),
  },
  storage: createStorage({
    storage: inMemoryStorage(),
  }),
});
