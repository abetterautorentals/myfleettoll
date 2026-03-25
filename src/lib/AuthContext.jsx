import React, { createContext, useContext } from 'react';
const AuthContext = createContext({});
export function AuthProvider({ children }) {
  return <AuthContext.Provider value={{ isLoadingAuth: false, isLoadingPublicSettings: false, authError: null, navigateToLogin: () => {} }}>{children}</AuthContext.Provider>;
}
export function useAuth() { return useContext(AuthContext); }
