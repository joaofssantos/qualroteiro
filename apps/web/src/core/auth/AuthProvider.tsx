import {
  ClerkProvider,
  SignInButton,
  SignUpButton,
  UserButton,
  useAuth,
  useUser,
} from '@clerk/clerk-react';
import { type ReactNode, useMemo } from 'react';

import { Button } from '@/components/ui/button';

import { AuthContext, missingAuth, type AuthState, useQualAuth } from './AuthContext';

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

export function AuthProvider({ children }: { children: ReactNode }) {
  if (!publishableKey) {
    return <AuthContext.Provider value={missingAuth}>{children}</AuthContext.Provider>;
  }

  return (
    <ClerkProvider publishableKey={publishableKey}>
      <ClerkAuthBridge>{children}</ClerkAuthBridge>
    </ClerkProvider>
  );
}

function ClerkAuthBridge({ children }: { children: ReactNode }) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();

  const value = useMemo<AuthState>(
    () => ({
      isConfigured: true,
      isLoaded,
      isSignedIn: Boolean(isSignedIn),
      userName: user?.firstName ?? user?.primaryEmailAddress?.emailAddress ?? null,
      getToken,
    }),
    [getToken, isLoaded, isSignedIn, user?.firstName, user?.primaryEmailAddress?.emailAddress],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function AuthActions() {
  const auth = useQualAuth();

  if (!auth.isConfigured) {
    return (
      <Button variant="outline" size="sm" disabled>
        Login indisponível
      </Button>
    );
  }

  if (!auth.isLoaded) {
    return (
      <Button variant="outline" size="sm" disabled>
        Carregando
      </Button>
    );
  }

  if (auth.isSignedIn) {
    return (
      <div className="flex items-center gap-2 rounded-md bg-primary-foreground/10 px-2 py-1.5 text-xs text-primary-foreground/80">
        {auth.userName ? <span className="hidden max-w-28 truncate md:inline">{auth.userName}</span> : null}
        <UserButton afterSignOutUrl="/" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <SignInButton mode="modal">
        <Button variant="outline" size="sm" className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
          Entrar
        </Button>
      </SignInButton>
      <SignUpButton mode="modal">
        <Button variant="accent" size="sm">
          Criar conta
        </Button>
      </SignUpButton>
    </div>
  );
}
