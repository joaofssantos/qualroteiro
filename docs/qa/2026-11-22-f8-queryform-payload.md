# F8 — payload do perfil de veículo

## Resultado

**Veredito: PASSOU.** O `QueryForm` agora tem uma prova comportamental de que submete o payload completo para cada opção do grupo de veículo: Carro, Caminhão, Moto e Reboque.

O contrato de rota continua inalterado para Carro (`car`/`car`), Caminhão (`truck`/`truck_2_axle`) e Moto (`motorcycle`/`motorcycle`). Reboque mantém o perfil de roteamento `car`, mas envia `car_with_trailer` como categoria tarifária.

## Mutação

Como controle negativo, o preset de Reboque foi alterado temporariamente de `car_with_trailer` para `car`. O teste falhou exclusivamente naquele caso, mostrando `expected car_with_trailer, received car`. A alteração foi restaurada; não foi necessário mudar código de produção.

## Gates

Executados em ambiente descartável com Node 20.19.0:

- `QueryForm.test.tsx` e `rotaCustos.test.tsx`: 22 testes aprovados.
- `pnpm --filter @qualroteiro/web typecheck`: aprovado.
- `pnpm --filter @qualroteiro/web lint`: aprovado.
