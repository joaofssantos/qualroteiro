# F2c Restaurantes

Branch: `codex/f2c/restaurantes`
Scope: `apps/web/**`

## Entrega

- Novo módulo standalone `restaurantes`, registrado no `moduleRegistry`.
- Cálculo puro `calculateRestaurantCost`: `pricePerPerson * people`.
- Tela única sem rede para nome, endereço opcional, data opcional, preço por pessoa e número de pessoas.
- Ação autenticada "Salvar na viagem" seguindo o fluxo do módulo de rota:
  `moduleId: 'restaurantes'`, `kind: 'meal'`, `payload` com o `RestaurantVisit` e `costEstimate` com o total calculado.

## Limites

- Não há busca de lugares nem integração com API externa nesta fase.
- Sem login, o módulo segue funcionando como calculadora; a ação de salvar não aparece.
