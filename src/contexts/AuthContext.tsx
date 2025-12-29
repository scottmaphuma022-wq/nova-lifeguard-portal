import React, { createContext, useContext, useState, ReactNode } from 'react';

export type UserRole = 'customer' | 'officer' | 'manager' | null;

interface User {
  username: string;
  role: UserRole;
  name: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => { success: boolean; message: string };
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Dummy credentials
const USERS = {
  customer: { password: 'customer1', role: 'customer' as UserRole, name: 'John Doe' },
  officer: { password: 'officer1', role: 'officer' as UserRole, name: 'Sarah Claims' },
  admin: { password: 'admin123', role: 'manager' as UserRole, name: 'Admin Manager' },
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);

  const login = (username: string, password: string) => {
    const userCredentials = USERS[username as keyof typeof USERS];
    
    if (userCredentials && userCredentials.password === password) {
      setUser({
        username,
        role: userCredentials.role,
        name: userCredentials.name,
      });
      return { success: true, message: 'Login successful!' };
    }
    
    return { success: false, message: 'Invalid username or password' };
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
