import { createContext, useContext, useState, ReactNode } from 'react';

interface AccountContextType {
  selectedAccount: string;
  setSelectedAccount: (account: string) => void;
}

const AccountContext = createContext<AccountContextType>({
  selectedAccount: 'all',
  setSelectedAccount: () => {},
});

export function AccountProvider({ children }: { children: ReactNode }) {
  const [selectedAccount, setSelectedAccount] = useState('all');
  return (
    <AccountContext.Provider value={{ selectedAccount, setSelectedAccount }}>
      {children}
    </AccountContext.Provider>
  );
}

export function useSelectedAccount() {
  return useContext(AccountContext);
}
