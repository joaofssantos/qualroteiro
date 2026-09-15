import { createContext, useContext } from 'react';

type GetToken = () => Promise<string | null>;

export interface AuthState {
  readonly isConfigured: boolean;
  readonly isLoaded: boolean;
  readonly isSignedIn: boolean;
  readonly userName: string | null;
  readonly getToken: GetToken;
}

export const missingAuth: AuthState = {
  isConfigured: false,
  isLoaded: true,
  isSignedIn: false,
  userName: null,
  getToken: async () => null,
};

export const AuthContext = createContext<AuthState>(missingAuth);

export function useQualAuth(): AuthState {
  return useContext(AuthContext);
}
