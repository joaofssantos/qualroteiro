import {
  ClerkProvider,
  SignInButton,
  SignUpButton,
  UserButton,
  useAuth,
  useUser,
} from '@clerk/clerk-react';
import { LogIn, Loader2 } from 'lucide-react';
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

/**
 * `compact` serve a áreas estreitas (rodapé do trilho de 76 px): o estado vira um
 * ícone ≥ 44 px, mantendo o nome acessível e um tooltip (`title`) com o texto.
 */
function StatusButton({ label, compact, icon: Icon }: { label: string; compact: boolean; icon: typeof LogIn }) {
  if (!compact) {
    return (
      <Button variant="outline" size="sm" disabled>
        {label}
      </Button>
    );
  }
  // Botão desabilitado não dispara tooltip nativo: o `title` fica no invólucro.
  return (
    <span title={label} className="inline-flex">
      <Button
        variant="ghost"
        size="icon"
        disabled
        aria-label={label}
        className="min-h-11 min-w-11 text-primary-foreground"
      >
        <Icon aria-hidden />
      </Button>
    </span>
  );
}

export function AuthActions({ compact = false }: { compact?: boolean } = {}) {
  const auth = useQualAuth();

  if (!auth.isConfigured) {
    return <StatusButton label="Login indisponível" compact={compact} icon={LogIn} />;
  }

  if (!auth.isLoaded) {
    return <StatusButton label="Carregando" compact={compact} icon={Loader2} />;
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
    <div className={compact ? 'flex flex-col items-stretch gap-1' : 'flex items-center gap-2'}>
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
