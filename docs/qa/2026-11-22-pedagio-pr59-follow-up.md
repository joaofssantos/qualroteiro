# PR #59 — follow-up dos achados de QA

## Resultado

**Veredito: aprovado para revisão.**

O desempate de registros co-localizados agora prioriza uma tarifa disponível e
só depois a menor distância à rota. A regressão reproduz ANTT sem tarifa a 0 m
e OSM com tarifa de carro de R$ 10 a aproximadamente 33 m: o resultado é a
linha OSM e total de R$ 10.

O agrupamento em `matchTolls` permanece não transitivo. Uma cadeia A–B–C pode
ultrapassar 100 m de ponta a ponta e representar pórticos Free Flow distintos;
como o contrato atual não carrega um identificador de pórtico, uni-los por
single-linkage poderia remover cobranças reais. Registros só se fundem quando
cada um fica a até 100 m do representante; uma futura chave de pórtico poderá
permitir uma regra mais precisa.

## Verificações

- `pnpm --filter @qualroteiro/geo build`: passou.
- `pnpm --filter @qualroteiro/tolls test`: 91 testes passaram.
- `pnpm --filter @qualroteiro/tolls typecheck`: passou. O pacote não possui
  script `lint`.
- `pnpm --filter @qualroteiro/api test`: 173 testes passaram.
- `pnpm --filter @qualroteiro/api typecheck` e `lint`: passaram.

## Medição real SP→RJ

Não foi possível repetir a medição contra o Postgres local: o Docker respondeu
`no such object: qualroteiro-postgres-1`, portanto não havia contêiner local
para iniciar. Quando ele estiver disponível, rode o serviço e execute a rota
SP→RJ pela API antes e depois desta branch, registrando `routes[0].tolls.plazas`
e `routes[0].tolls.total`.

Para inspecionar o conjunto persistido antes da chamada, use:

```sql
SELECT source, count(*)
FROM "TollPlazaRecord"
WHERE active = true
GROUP BY source
ORDER BY source;
```

O SQL sozinho não mede os pontos na rota: a contagem correta depende da
geometria devolvida pelo provedor de rotas e deve usar o mesmo
`POST /routes/plan` da aplicação.
