# sdd-lite — tarifa de pedágio indisponível

## Problema

As praças reais podem chegar de `POST /routes/plan` com localização e dados da
concessionária, mas sem `tariffByAxleCategory`. A interface não pode ocultar a
praça, formatar `undefined`/`NaN`, nem falhar ao abrir seu detalhe.

## Decisão

`TollsPanel`, `PlazaDrawer` e os rótulos de marcador tratam a tarifa da
categoria selecionada como opcional. Quando ela não existe, exibem `Valor não
disponível`; quando existe, mantêm a formatação monetária atual. O total vem do
backend e continua sendo exibido como recebido.

## Aceite

- Praça sem tabela de tarifas aparece na lista, no mapa e no drawer com fallback.
- Praça com tarifa continua exibindo o valor em BRL.
- A suíte cobre lista e drawer sem `undefined`/`NaN`.
- Nenhuma mudança em API, pacotes de domínio ou ingestão.
