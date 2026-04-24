import React, { createContext, useContext, useState } from 'react';

interface DemoContextType {
  isDemoMode: boolean;
  setDemoMode: (value: boolean) => void;
}

const DemoContext = createContext<DemoContextType>({
  isDemoMode: false,
  setDemoMode: () => {},
});

export function DemoProvider({ children }: { children: React.ReactNode }) {
  // Default ON: app runs entirely client-side against demoData (localStorage).
  // No server auth, no tRPC round-trips — the login UI is bypassed entirely.
  const [isDemoMode, setDemoMode] = useState(true);
  return (
    <DemoContext.Provider value={{ isDemoMode, setDemoMode }}>
      {children}
    </DemoContext.Provider>
  );
}

export function useDemo() {
  return useContext(DemoContext);
}
