import { useNavigate } from 'react-router-dom';

import { MODULE_PATH } from './module';
import { QueryForm } from './QueryForm';

/** Tela 1 — nova consulta: composição fina em volta do `QueryForm` compartilhado. */
export function NewQueryScreen() {
  const navigate = useNavigate();
  return (
    <div className="route-query-panel mx-auto w-full max-w-3xl px-4 py-8 md:px-8 md:py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-primary md:text-3xl">
          Quanto custa essa viagem?
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Informe o trajeto e o perfil do veículo para ver distância, tempo, pedágios e
          combustível.
        </p>
      </header>

      <QueryForm variant="panel" onSubmitted={() => navigate(`${MODULE_PATH}/resultado`)} />
    </div>
  );
}
