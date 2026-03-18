import React, { createContext, useContext, useState, useEffect } from 'react';

interface DemoContextType {
  isDemoMode: boolean;
  setDemoMode: (value: boolean) => void;
}

const DemoContext = createContext<DemoContextType | undefined>(undefined);

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [isDemoMode, setDemoMode] = useState(true);

  useEffect(() => {
    const savedDemoMode = localStorage.getItem('finance-tracker-demo-mode');
    if (savedDemoMode === 'false') {
      setDemoMode(false);
    }
  }, []);

  const handleSetDemoMode = (value: boolean) => {
    setDemoMode(value);
    localStorage.setItem('finance-tracker-demo-mode', String(value));
  };

  return (
    <DemoContext.Provider value={{ isDemoMode, setDemoMode: handleSetDemoMode }}>
      {children}
    </DemoContext.Provider>
  );
}

export function useDemo() {
  const context = useContext(DemoContext);
  if (context === undefined) {
    throw new Error('useDemo must be used within DemoProvider');
  }
  return context;
}
