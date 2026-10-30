declare global {
  interface Window {
    jade?: {
      retryStartup(): void;
      openDataDir(): Promise<void>;
      openCheckout(url: string): Promise<void>;
    };
  }
}

export {};
