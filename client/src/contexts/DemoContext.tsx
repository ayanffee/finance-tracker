import React, { createContext, useContext } from 'react';

interface DemoContextType {
  isDemoMode: boolean;
  setDemoMode: (value: boolean) => void;
}

const DemoContext = createContext<DemoContextType>({
  isDemoMode: false,
  setDemoMode: () => {},
});

export function DemoProvider({ children }: { children: React.ReactNode }) {
  return (
    <DemoContext.Provider value={{ isDemoMode: false, setDemoMode: () => {} }}>
      {children}
    </DemoContext.Provider>
  );
}

export function useDemo() {
  return useContext(DemoContext);
}
