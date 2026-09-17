# Auditoria ARTESP x OSM — tarifas de pedágio (rodovias estaduais de SP)

Gerado em: 2026-09-17T14:45:54.454Z

Limiar de divergência: > R$ 1.00 OU > 10% (o que for mais sensível no valor em questão).

## Resumo

- Praças ARTESP (formato simples, parseadas): 136
- Praças ARTESP excluídas (formato CAT-1..9, fora do parser V1): 11
- Praças OSM (`source: 'osm'`) no Postgres: 489
- Praças OSM fora da bounding box de SP (descartadas antes do matching): 227
- Pares casados (ARTESP ↔ OSM): 110
  - Bate (dentro do limiar, em todas as categorias comparáveis): 90
  - Diverge (pelo menos uma categoria acima do limiar): 20
  - Casados mas sem tarifa OSM para comparar (`charge` não parseado): 0
- ARTESP sem match OSM: 26
- OSM (dentro da bbox de SP) sem match ARTESP: 152

## Praças que divergem

| Praça ARTESP | Categoria | ARTESP | OSM | Diferença | % | Status |
|---|---|---|---|---|---|---|
| SP-191 / RIO CLARO (OSM: Rio Claro - 1) | Passeio (car) | R$ 5,00 | R$ 11,60 | R$ -6,60 | -132.0% | ⚠️ diverge |
| SP-191 / RIO CLARO (OSM: Rio Claro - 1) | Comercial por eixo (per-axle) | R$ 5,00 | R$ 11,60 | R$ -6,60 | -132.0% | ⚠️ diverge |
| SP-340 / JAGUARIÚNA (OSM: Jaguariuna - 1) | Passeio (car) | R$ 17,60 | R$ 8,80 | R$ 8,80 | 50.0% | ⚠️ diverge |
| SP-340 / JAGUARIÚNA (OSM: Jaguariuna - 1) | Comercial por eixo (per-axle) | R$ 17,60 | R$ 8,80 | R$ 8,80 | 50.0% | ⚠️ diverge |
| SP-340 / ESTIVA GERBI (OSM: Estiva Gerbi - 1) | Passeio (car) | R$ 10,50 | R$ 7,80 | R$ 2,70 | 25.7% | ⚠️ diverge |
| SP-340 / ESTIVA GERBI (OSM: Estiva Gerbi - 1) | Comercial por eixo (per-axle) | R$ 10,50 | R$ 7,80 | R$ 2,70 | 25.7% | ⚠️ diverge |
| SP-340 / CASA BRANCA (OSM: Casa Branca - 1) | Passeio (car) | R$ 9,40 | R$ 8,15 | R$ 1,25 | 13.3% | ⚠️ diverge |
| SP-340 / CASA BRANCA (OSM: Casa Branca - 1) | Comercial por eixo (per-axle) | R$ 9,40 | R$ 8,15 | R$ 1,25 | 13.3% | ⚠️ diverge |
| SP-350 / ITOBI (OSM: Itobi - 1) | Passeio (car) | R$ 13,40 | R$ 10,75 | R$ 2,65 | 19.8% | ⚠️ diverge |
| SP-350 / ITOBI (OSM: Itobi - 1) | Comercial por eixo (per-axle) | R$ 13,40 | R$ 10,75 | R$ 2,65 | 19.8% | ⚠️ diverge |
| SP-127 / RIO CLARO (OSM: Rio Claro - 1) | Passeio (car) | R$ 8,80 | R$ 5,30 | R$ 3,50 | 39.8% | ⚠️ diverge |
| SP-127 / RIO CLARO (OSM: Rio Claro - 1) | Comercial por eixo (per-axle) | R$ 8,80 | R$ 5,30 | R$ 3,50 | 39.8% | ⚠️ diverge |
| SP-127 / RIO DAS PEDRAS (OSM: Rio das Pedras - 2) | Passeio (car) | R$ 14,20 | R$ 11,50 | R$ 2,70 | 19.0% | ⚠️ diverge |
| SP-127 / RIO DAS PEDRAS (OSM: Rio das Pedras - 2) | Comercial por eixo (per-axle) | R$ 14,20 | R$ 11,50 | R$ 2,70 | 19.0% | ⚠️ diverge |
| SP-150 / RIACHO GRANDE (OSM: Riacho Grande) | Passeio (car) | R$ 38,70 | R$ 40,60 | R$ -1,90 | -4.9% | ⚠️ diverge |
| SP-150 / RIACHO GRANDE (OSM: Riacho Grande) | Comercial por eixo (per-axle) | R$ 38,70 | R$ 40,60 | R$ -1,90 | -4.9% | ⚠️ diverge |
| SP-160 / PIRATININGA (OSM: Piratininga) | Passeio (car) | R$ 38,70 | R$ 40,60 | R$ -1,90 | -4.9% | ⚠️ diverge |
| SP-160 / PIRATININGA (OSM: Piratininga) | Comercial por eixo (per-axle) | R$ 38,70 | R$ 40,60 | R$ -1,90 | -4.9% | ⚠️ diverge |
| SP-332 / ENGENHEIRO COELHO (OSM: Engenheiro Coelho - 1) | Passeio (car) | R$ 9,20 | R$ 9,60 | R$ -0,40 | -4.3% | ✅ bate |
| SP-332 / ENGENHEIRO COELHO (OSM: Engenheiro Coelho - 1) | Motos | R$ 4,60 | R$ 4,00 | R$ 0,60 | 13.0% | ⚠️ diverge |
| SP-332 / ENGENHEIRO COELHO (OSM: Engenheiro Coelho - 1) | Comercial por eixo (per-axle) | R$ 9,20 | R$ 9,60 | R$ -0,40 | -4.3% | ✅ bate |
| SP-308 / RIO DAS PEDRAS (OSM: Rio das Pedras - 1) | Passeio (car) | R$ 11,00 | R$ 14,90 | R$ -3,90 | -35.5% | ⚠️ diverge |
| SP-308 / RIO DAS PEDRAS (OSM: Rio das Pedras - 1) | Motos | R$ 5,50 | R$ 0,00 | R$ 5,50 | 100.0% | ⚠️ diverge |
| SP-308 / RIO DAS PEDRAS (OSM: Rio das Pedras - 1) | Comercial por eixo (per-axle) | R$ 11,00 | R$ 14,90 | R$ -3,90 | -35.5% | ⚠️ diverge |
| SP-342 / ESP. SANTO DO PINHAL (OSM: Espírito Santo do Pinhal - 1) | Passeio (car) | R$ 13,10 | R$ 10,45 | R$ 2,65 | 20.2% | ⚠️ diverge |
| SP-342 / ESP. SANTO DO PINHAL (OSM: Espírito Santo do Pinhal - 1) | Comercial por eixo (per-axle) | R$ 13,10 | R$ 10,45 | R$ 2,65 | 20.2% | ⚠️ diverge |
| SP-340 / Pórtico Santo Antônio de Posse (OSM: Santo Antônio do Amparo - 1) | Passeio (car) | R$ 8,80 | R$ 3,70 | R$ 5,10 | 58.0% | ⚠️ diverge |
| SP-340 / Pórtico Santo Antônio de Posse (OSM: Santo Antônio do Amparo - 1) | Comercial por eixo (per-axle) | R$ 8,80 | R$ 3,70 | R$ 5,10 | 58.0% | ⚠️ diverge |
| SP-332 / Pórtico Engº Coelho (PaP) (OSM: Engenheiro Coelho - 1) | Passeio (car) | R$ 7,90 | R$ 13,30 | R$ -5,40 | -68.4% | ⚠️ diverge |
| SP-332 / Pórtico Engº Coelho (PaP) (OSM: Engenheiro Coelho - 1) | Motos | R$ 3,95 | R$ 0,00 | R$ 3,95 | 100.0% | ⚠️ diverge |
| SP-332 / Pórtico Engº Coelho (PaP) (OSM: Engenheiro Coelho - 1) | Comercial por eixo (per-axle) | R$ 7,90 | R$ 13,30 | R$ -5,40 | -68.4% | ⚠️ diverge |
| SP-332 / Paulínia Jd. Betel (PaP) (OSM: Paulínia B - Sentido Externo) | Passeio (car) | R$ 5,50 | R$ 17,50 | R$ -12,00 | -218.2% | ⚠️ diverge |
| SP-332 / Paulínia Jd. Betel (PaP) (OSM: Paulínia B - Sentido Externo) | Motos | R$ 2,75 | R$ 8,75 | R$ -6,00 | -218.2% | ⚠️ diverge |
| SP-332 / Paulínia Jd. Betel (PaP) (OSM: Paulínia B - Sentido Externo) | Comercial por eixo (per-axle) | R$ 5,50 | R$ 17,50 | R$ -12,00 | -218.2% | ⚠️ diverge |
| SP-075 / Pórtico Bloqueio Indaiatuba (PaP) (OSM: Indiana - 1) | Passeio (car) | R$ 3,50 | R$ 7,20 | R$ -3,70 | -105.7% | ⚠️ diverge |
| SP-075 / Pórtico Bloqueio Indaiatuba (PaP) (OSM: Indiana - 1) | Comercial por eixo (per-axle) | R$ 3,50 | R$ 7,20 | R$ -3,70 | -105.7% | ⚠️ diverge |
| SP-075 / Pórtico Itu 1 (PaP) (OSM: Itu) | Passeio (car) | R$ 4,30 | R$ 13,20 | R$ -8,90 | -207.0% | ⚠️ diverge |
| SP-075 / Pórtico Itu 1 (PaP) (OSM: Itu) | Comercial por eixo (per-axle) | R$ 4,30 | R$ 13,20 | R$ -8,90 | -207.0% | ⚠️ diverge |
| SP-021 / PRAÇA 2 - TRECHO SUL / IMIGRANTES (Pista Externa) (OSM: Ecovias Imigrantes (OSM 656016287)) | Passeio (car) | R$ 5,40 | R$ 6,00 | R$ -0,60 | -11.1% | ⚠️ diverge |
| SP-021 / PRAÇA 2 - TRECHO SUL / IMIGRANTES (Pista Externa) (OSM: Ecovias Imigrantes (OSM 656016287)) | Motos | R$ 2,70 | R$ 0,00 | R$ 2,70 | 100.0% | ⚠️ diverge |
| SP-021 / PRAÇA 2 - TRECHO SUL / IMIGRANTES (Pista Externa) (OSM: Ecovias Imigrantes (OSM 656016287)) | Comercial por eixo (per-axle) | R$ 5,40 | R$ 6,00 | R$ -0,60 | -11.1% | ⚠️ diverge |
| SP-021 / PRAÇA 3 - TRECHO SUL / IMIGRANTES (Pista Externa) (OSM: Ecovias Imigrantes (OSM 3888668373)) | Passeio (car) | R$ 5,40 | R$ 9,60 | R$ -4,20 | -77.8% | ⚠️ diverge |
| SP-021 / PRAÇA 3 - TRECHO SUL / IMIGRANTES (Pista Externa) (OSM: Ecovias Imigrantes (OSM 3888668373)) | Motos | R$ 2,70 | R$ 0,00 | R$ 2,70 | 100.0% | ⚠️ diverge |
| SP-021 / PRAÇA 3 - TRECHO SUL / IMIGRANTES (Pista Externa) (OSM: Ecovias Imigrantes (OSM 3888668373)) | Comercial por eixo (per-axle) | R$ 5,40 | R$ 9,60 | R$ -4,20 | -77.8% | ⚠️ diverge |
| SP-360 / Pórtico Jundiaí (PaP) (OSM: Juquiá - 1) | Passeio (car) | R$ 2,30 | R$ 4,30 | R$ -2,00 | -87.0% | ⚠️ diverge |
| SP-360 / Pórtico Jundiaí (PaP) (OSM: Juquiá - 1) | Motos | R$ 1,15 | R$ 2,15 | R$ -1,00 | -87.0% | ⚠️ diverge |
| SP-360 / Pórtico Jundiaí (PaP) (OSM: Juquiá - 1) | Comercial por eixo (per-axle) | R$ 2,30 | R$ 4,30 | R$ -2,00 | -87.0% | ⚠️ diverge |

## Praças que batem

| Praça ARTESP | Categoria | ARTESP | OSM | Diferença | % | Status |
|---|---|---|---|---|---|---|
| SP-330 / PERUS (OSM: Pedágio Perus (sentido Sul)) | Passeio (car) | R$ 13,70 | R$ 14,50 | R$ -0,80 | -5.8% | ✅ bate |
| SP-330 / PERUS (OSM: Pedágio Perus (sentido Sul)) | Comercial por eixo (per-axle) | R$ 13,70 | R$ 14,50 | R$ -0,80 | -5.8% | ✅ bate |
| SP-330 / VALINHOS (OSM: Pedágio Valinhos (sentido Sul)) | Passeio (car) | R$ 13,60 | R$ 14,30 | R$ -0,70 | -5.1% | ✅ bate |
| SP-330 / VALINHOS (OSM: Pedágio Valinhos (sentido Sul)) | Comercial por eixo (per-axle) | R$ 13,60 | R$ 14,30 | R$ -0,70 | -5.1% | ✅ bate |
| SP-330 / VALINHOS (OSM: Pedágio Valinhos (sentido Norte)) | Passeio (car) | R$ 13,60 | R$ 14,30 | R$ -0,70 | -5.1% | ✅ bate |
| SP-330 / VALINHOS (OSM: Pedágio Valinhos (sentido Norte)) | Comercial por eixo (per-axle) | R$ 13,60 | R$ 14,30 | R$ -0,70 | -5.1% | ✅ bate |
| SP-330 / NOVA ODESSA (OSM: Pedágio Nova Odessa (sentido Norte)) | Passeio (car) | R$ 12,10 | R$ 12,80 | R$ -0,70 | -5.8% | ✅ bate |
| SP-330 / NOVA ODESSA (OSM: Pedágio Nova Odessa (sentido Norte)) | Comercial por eixo (per-axle) | R$ 12,10 | R$ 12,80 | R$ -0,70 | -5.8% | ✅ bate |
| SP-330 / LIMEIRA (OSM: Pedágio Limeira (sentido Sul)) | Passeio (car) | R$ 9,20 | R$ 9,70 | R$ -0,50 | -5.4% | ✅ bate |
| SP-330 / LIMEIRA (OSM: Pedágio Limeira (sentido Sul)) | Comercial por eixo (per-axle) | R$ 9,20 | R$ 9,70 | R$ -0,50 | -5.4% | ✅ bate |
| SP-348 / CAIEIRAS * (OSM: Pedágio Caieiras (sentido Capital/Sul)) | Passeio (car) | R$ 13,70 | R$ 14,50 | R$ -0,80 | -5.8% | ✅ bate |
| SP-348 / CAIEIRAS * (OSM: Pedágio Caieiras (sentido Capital/Sul)) | Comercial por eixo (per-axle) | R$ 13,70 | R$ 14,50 | R$ -0,80 | -5.8% | ✅ bate |
| SP-348 / CAMPO LIMPO * (OSM: Pedágio Campo Limpo (sentido interior)) | Passeio (car) | R$ 13,70 | R$ 14,50 | R$ -0,80 | -5.8% | ✅ bate |
| SP-348 / CAMPO LIMPO * (OSM: Pedágio Campo Limpo (sentido interior)) | Comercial por eixo (per-axle) | R$ 13,70 | R$ 14,50 | R$ -0,80 | -5.8% | ✅ bate |
| SP-348 / ITUPEVA (OSM: Pedágio Itupeva (sentido Norte)) | Passeio (car) | R$ 13,60 | R$ 14,30 | R$ -0,70 | -5.1% | ✅ bate |
| SP-348 / ITUPEVA (OSM: Pedágio Itupeva (sentido Norte)) | Comercial por eixo (per-axle) | R$ 13,60 | R$ 14,30 | R$ -0,70 | -5.1% | ✅ bate |
| SP-348 / SUMARÉ (OSM: Pedágio Sumaré (sentido Sul)) | Passeio (car) | R$ 12,10 | R$ 12,80 | R$ -0,70 | -5.8% | ✅ bate |
| SP-348 / SUMARÉ (OSM: Pedágio Sumaré (sentido Sul)) | Comercial por eixo (per-axle) | R$ 12,10 | R$ 12,80 | R$ -0,70 | -5.8% | ✅ bate |
| SP-348 / LIMEIRA (OSM: Pedágio Limeira (sentido Norte)) | Passeio (car) | R$ 9,20 | R$ 9,70 | R$ -0,50 | -5.4% | ✅ bate |
| SP-348 / LIMEIRA (OSM: Pedágio Limeira (sentido Norte)) | Comercial por eixo (per-axle) | R$ 9,20 | R$ 9,70 | R$ -0,50 | -5.4% | ✅ bate |
| SP-147 / MOGI MIRIM (OSM: Mogi Mirim - 2) | Passeio (car) | R$ 11,10 | R$ 11,70 | R$ -0,60 | -5.4% | ✅ bate |
| SP-147 / MOGI MIRIM (OSM: Mogi Mirim - 2) | Comercial por eixo (per-axle) | R$ 11,10 | R$ 11,70 | R$ -0,60 | -5.4% | ✅ bate |
| SP-147 / IRACEMÁPOLIS (OSM: Iracemápolis - 1) | Passeio (car) | R$ 8,60 | R$ 9,10 | R$ -0,50 | -5.8% | ✅ bate |
| SP-147 / IRACEMÁPOLIS (OSM: Iracemápolis - 1) | Comercial por eixo (per-axle) | R$ 8,60 | R$ 9,10 | R$ -0,50 | -5.8% | ✅ bate |
| SP-191 / ARARAS (OSM: Araras) | Passeio (car) | R$ 9,80 | R$ 10,40 | R$ -0,60 | -6.1% | ✅ bate |
| SP-191 / ARARAS (OSM: Araras) | Comercial por eixo (per-axle) | R$ 9,80 | R$ 10,40 | R$ -0,60 | -6.1% | ✅ bate |
| SP-215 / DESCALVADO (OSM: Descalvado) | Passeio (car) | R$ 9,20 | R$ 9,80 | R$ -0,60 | -6.5% | ✅ bate |
| SP-215 / DESCALVADO (OSM: Descalvado) | Comercial por eixo (per-axle) | R$ 9,20 | R$ 9,80 | R$ -0,60 | -6.5% | ✅ bate |
| SP-330 / LEME (OSM: Pedágio Leme (sentido Norte)) | Passeio (car) | R$ 11,20 | R$ 11,80 | R$ -0,60 | -5.4% | ✅ bate |
| SP-330 / LEME (OSM: Pedágio Leme (sentido Norte)) | Comercial por eixo (per-axle) | R$ 11,20 | R$ 11,80 | R$ -0,60 | -5.4% | ✅ bate |
| SP-330 / PIRASSUNUNGA (OSM: Pedágio Pirassununga (sentido Sul)) | Passeio (car) | R$ 11,20 | R$ 11,80 | R$ -0,60 | -5.4% | ✅ bate |
| SP-330 / PIRASSUNUNGA (OSM: Pedágio Pirassununga (sentido Sul)) | Comercial por eixo (per-axle) | R$ 11,20 | R$ 11,80 | R$ -0,60 | -5.4% | ✅ bate |
| SP-340 / MOCOCA (OSM: Mococa - 2) | Passeio (car) | R$ 8,90 | R$ 8,10 | R$ 0,80 | 9.0% | ✅ bate |
| SP-340 / MOCOCA (OSM: Mococa - 2) | Comercial por eixo (per-axle) | R$ 8,90 | R$ 8,10 | R$ 0,80 | 9.0% | ✅ bate |
| SP-342 / ÁGUAS DA PRATA (OSM: Águas da Prata - 1) | Passeio (car) | R$ 6,30 | R$ 6,30 | R$ 0,00 | 0.0% | ✅ bate |
| SP-342 / ÁGUAS DA PRATA (OSM: Águas da Prata - 1) | Comercial por eixo (per-axle) | R$ 6,30 | R$ 6,30 | R$ 0,00 | 0.0% | ✅ bate |
| SP-344 / AGUAÍ (OSM: Aguaí - 1) | Passeio (car) | R$ 6,60 | R$ 6,60 | R$ 0,00 | 0.0% | ✅ bate |
| SP-344 / AGUAÍ (OSM: Aguaí - 1) | Comercial por eixo (per-axle) | R$ 6,60 | R$ 6,60 | R$ 0,00 | 0.0% | ✅ bate |
| SP-075 / INDAIATUBA (OSM: Indaiatuba - 3) | Passeio (car) | R$ 19,40 | R$ 20,30 | R$ -0,90 | -4.6% | ✅ bate |
| SP-075 / INDAIATUBA (OSM: Indaiatuba - 3) | Comercial por eixo (per-axle) | R$ 19,40 | R$ 20,30 | R$ -0,90 | -4.6% | ✅ bate |
| SP-075 / INDAIATUBA (BLOQUEIO) (OSM: Indaiatuba) | Passeio (car) | R$ 19,40 | R$ 20,30 | R$ -0,90 | -4.6% | ✅ bate |
| SP-075 / INDAIATUBA (BLOQUEIO) (OSM: Indaiatuba) | Comercial por eixo (per-axle) | R$ 19,40 | R$ 20,30 | R$ -0,90 | -4.6% | ✅ bate |
| SP-280 / BOITUVA (BLOQUEIO) (OSM: Boituva - 3) | Passeio (car) | R$ 13,80 | R$ 14,50 | R$ -0,70 | -5.1% | ✅ bate |
| SP-280 / BOITUVA (BLOQUEIO) (OSM: Boituva - 3) | Comercial por eixo (per-axle) | R$ 13,80 | R$ 14,50 | R$ -0,70 | -5.1% | ✅ bate |
| SP-280 / BOITUVA (OSM: Boituva - 1) | Passeio (car) | R$ 13,80 | R$ 14,50 | R$ -0,70 | -5.1% | ✅ bate |
| SP-280 / BOITUVA (OSM: Boituva - 1) | Comercial por eixo (per-axle) | R$ 13,80 | R$ 14,50 | R$ -0,70 | -5.1% | ✅ bate |
| SP-300 / ITUPEVA (OSM: Itupeva - 2) | Passeio (car) | R$ 10,60 | R$ 11,10 | R$ -0,50 | -4.7% | ✅ bate |
| SP-300 / ITUPEVA (OSM: Itupeva - 2) | Comercial por eixo (per-axle) | R$ 10,60 | R$ 11,10 | R$ -0,50 | -4.7% | ✅ bate |
| SP-300 / PORTO FELIZ (OSM: Porto Feliz - 1) | Passeio (car) | R$ 11,00 | R$ 11,50 | R$ -0,50 | -4.5% | ✅ bate |
| SP-300 / PORTO FELIZ (OSM: Porto Feliz - 1) | Comercial por eixo (per-axle) | R$ 11,00 | R$ 11,50 | R$ -0,50 | -4.5% | ✅ bate |
| SP-127 / GRAMADÃO (OSM: Gramadão - 1) | Passeio (car) | R$ 14,30 | R$ 15,00 | R$ -0,70 | -4.9% | ✅ bate |
| SP-127 / GRAMADÃO (OSM: Gramadão - 1) | Comercial por eixo (per-axle) | R$ 14,30 | R$ 15,00 | R$ -0,70 | -4.9% | ✅ bate |
| SP-255 / AVARÉ (OSM: Avaré - 2) | Passeio (car) | R$ 10,80 | R$ 11,40 | R$ -0,60 | -5.6% | ✅ bate |
| SP-255 / AVARÉ (OSM: Avaré - 2) | Comercial por eixo (per-axle) | R$ 10,80 | R$ 11,40 | R$ -0,60 | -5.6% | ✅ bate |
| SP-258 / BURI (OSM: Buri - 1) | Passeio (car) | R$ 15,40 | R$ 16,20 | R$ -0,80 | -5.2% | ✅ bate |
| SP-258 / BURI (OSM: Buri - 1) | Comercial por eixo (per-axle) | R$ 15,40 | R$ 16,20 | R$ -0,80 | -5.2% | ✅ bate |
| SP-258 / ITARARÉ (OSM: Itararé) | Passeio (car) | R$ 9,90 | R$ 10,50 | R$ -0,60 | -6.1% | ✅ bate |
| SP-258 / ITARARÉ (OSM: Itararé) | Comercial por eixo (per-axle) | R$ 9,90 | R$ 10,50 | R$ -0,60 | -6.1% | ✅ bate |
| SP-270 / ALAMBARI (OSM: Alambari - 1) | Passeio (car) | R$ 12,10 | R$ 12,80 | R$ -0,70 | -5.8% | ✅ bate |
| SP-270 / ALAMBARI (OSM: Alambari - 1) | Comercial por eixo (per-axle) | R$ 12,10 | R$ 12,80 | R$ -0,70 | -5.8% | ✅ bate |
| SP-280 / QUADRA (OSM: Quadra - 2) | Passeio (car) | R$ 19,40 | R$ 20,40 | R$ -1,00 | -5.2% | ✅ bate |
| SP-280 / QUADRA (OSM: Quadra - 2) | Comercial por eixo (per-axle) | R$ 19,40 | R$ 20,40 | R$ -1,00 | -5.2% | ✅ bate |
| SP-280 / ITATINGA (OSM: Itatinga - 1) | Passeio (car) | R$ 19,40 | R$ 20,40 | R$ -1,00 | -5.2% | ✅ bate |
| SP-280 / ITATINGA (OSM: Itatinga - 1) | Comercial por eixo (per-axle) | R$ 19,40 | R$ 20,40 | R$ -1,00 | -5.2% | ✅ bate |
| SP-280 / IARAS (OSM: Iaras - 1) | Passeio (car) | R$ 13,20 | R$ 13,90 | R$ -0,70 | -5.3% | ✅ bate |
| SP-280 / IARAS (OSM: Iaras - 1) | Comercial por eixo (per-axle) | R$ 13,20 | R$ 13,90 | R$ -0,70 | -5.3% | ✅ bate |
| SP-055 / SANTOS (OSM: Santos sentido Capital) | Passeio (car) | R$ 18,30 | R$ 19,20 | R$ -0,90 | -4.9% | ✅ bate |
| SP-055 / SANTOS (OSM: Santos sentido Capital) | Comercial por eixo (per-axle) | R$ 18,30 | R$ 19,20 | R$ -0,90 | -4.9% | ✅ bate |
| SP-055 / SÃO VICENTE (OSM: São Vicente - Sentido Capital) | Passeio (car) | R$ 10,90 | R$ 11,40 | R$ -0,50 | -4.6% | ✅ bate |
| SP-055 / SÃO VICENTE (OSM: São Vicente - Sentido Capital) | Comercial por eixo (per-axle) | R$ 10,90 | R$ 11,40 | R$ -0,50 | -4.6% | ✅ bate |
| SP-160 / DIADEMA (BLOQUEIO) (OSM: Diadema) | Passeio (car) | R$ 3,10 | R$ 3,20 | R$ -0,10 | -3.2% | ✅ bate |
| SP-160 / DIADEMA (BLOQUEIO) (OSM: Diadema) | Comercial por eixo (per-axle) | R$ 3,10 | R$ 3,20 | R$ -0,10 | -3.2% | ✅ bate |
| SP-063 / LOUVEIRA (OSM: Louveira - 2) | Passeio (car) | R$ 3,90 | R$ 4,10 | R$ -0,20 | -5.1% | ✅ bate |
| SP-063 / LOUVEIRA (OSM: Louveira - 2) | Motos | R$ 1,95 | R$ 2,05 | R$ -0,10 | -5.1% | ✅ bate |
| SP-063 / LOUVEIRA (OSM: Louveira - 2) | Comercial por eixo (per-axle) | R$ 3,90 | R$ 4,10 | R$ -0,20 | -5.1% | ✅ bate |
| SP- 065 / IGARATÁ (OSM: Igaratá - 1) | Passeio (car) | R$ 13,30 | R$ 14,00 | R$ -0,70 | -5.3% | ✅ bate |
| SP- 065 / IGARATÁ (OSM: Igaratá - 1) | Motos | R$ 6,65 | R$ 7,00 | R$ -0,35 | -5.3% | ✅ bate |
| SP- 065 / IGARATÁ (OSM: Igaratá - 1) | Comercial por eixo (per-axle) | R$ 13,30 | R$ 13,30 | R$ 0,00 | 0.0% | ✅ bate |
| SP- 065 / ATIBAIA (OSM: Atibaia - 1) | Passeio (car) | R$ 10,60 | R$ 11,10 | R$ -0,50 | -4.7% | ✅ bate |
| SP- 065 / ATIBAIA (OSM: Atibaia - 1) | Motos | R$ 5,30 | R$ 5,55 | R$ -0,25 | -4.7% | ✅ bate |
| SP- 065 / ATIBAIA (OSM: Atibaia - 1) | Comercial por eixo (per-axle) | R$ 10,60 | R$ 11,10 | R$ -0,50 | -4.7% | ✅ bate |
| SP- 065 / ITATIBA (OSM: Itatiba - 1) | Passeio (car) | R$ 15,30 | R$ 16,10 | R$ -0,80 | -5.2% | ✅ bate |
| SP- 065 / ITATIBA (OSM: Itatiba - 1) | Motos | R$ 7,65 | R$ 8,05 | R$ -0,40 | -5.2% | ✅ bate |
| SP- 065 / ITATIBA (OSM: Itatiba - 1) | Comercial por eixo (per-axle) | R$ 15,30 | R$ 16,10 | R$ -0,80 | -5.2% | ✅ bate |
| SP-360 / JUNDIAÍ (OSM: Jundiaí - 2) | Passeio (car) | R$ 6,10 | R$ 6,40 | R$ -0,30 | -4.9% | ✅ bate |
| SP-360 / JUNDIAÍ (OSM: Jundiaí - 2) | Motos | R$ 3,05 | R$ 3,20 | R$ -0,15 | -4.9% | ✅ bate |
| SP-360 / JUNDIAÍ (OSM: Jundiaí - 2) | Comercial por eixo (per-axle) | R$ 6,10 | R$ 6,40 | R$ -0,30 | -4.9% | ✅ bate |
| SP-225 / PIRATININGA (OSM: Piratininga - 1) | Passeio (car) | R$ 10,20 | R$ 10,70 | R$ -0,50 | -4.9% | ✅ bate |
| SP-225 / PIRATININGA (OSM: Piratininga - 1) | Motos | R$ 5,10 | R$ 5,35 | R$ -0,25 | -4.9% | ✅ bate |
| SP-225 / PIRATININGA (OSM: Piratininga - 1) | Comercial por eixo (per-axle) | R$ 10,20 | R$ 10,70 | R$ -0,50 | -4.9% | ✅ bate |
| SP-270 / PALMITAL (OSM: Palmital - 2) | Passeio (car) | R$ 12,20 | R$ 12,80 | R$ -0,60 | -4.9% | ✅ bate |
| SP-270 / PALMITAL (OSM: Palmital - 2) | Motos | R$ 6,10 | R$ 6,40 | R$ -0,30 | -4.9% | ✅ bate |
| SP-270 / PALMITAL (OSM: Palmital - 2) | Comercial por eixo (per-axle) | R$ 12,20 | R$ 12,80 | R$ -0,60 | -4.9% | ✅ bate |
| SP-270 / ASSIS (OSM: Assis - 1) | Passeio (car) | R$ 12,70 | R$ 13,30 | R$ -0,60 | -4.7% | ✅ bate |
| SP-270 / ASSIS (OSM: Assis - 1) | Motos | R$ 6,35 | R$ 6,65 | R$ -0,30 | -4.7% | ✅ bate |
| SP-270 / ASSIS (OSM: Assis - 1) | Comercial por eixo (per-axle) | R$ 12,70 | R$ 13,30 | R$ -0,60 | -4.7% | ✅ bate |
| SP-270 / RANCHARIA (OSM: Rancharia - 2) | Passeio (car) | R$ 10,40 | R$ 10,90 | R$ -0,50 | -4.8% | ✅ bate |
| SP-270 / RANCHARIA (OSM: Rancharia - 2) | Motos | R$ 5,20 | R$ 5,45 | R$ -0,25 | -4.8% | ✅ bate |
| SP-270 / RANCHARIA (OSM: Rancharia - 2) | Comercial por eixo (per-axle) | R$ 10,40 | R$ 10,90 | R$ -0,50 | -4.8% | ✅ bate |
| SP-270 / REGENTE FEIJÓ (OSM: Regente Feijó - 1) | Passeio (car) | R$ 10,40 | R$ 10,90 | R$ -0,50 | -4.8% | ✅ bate |
| SP-270 / REGENTE FEIJÓ (OSM: Regente Feijó - 1) | Motos | R$ 5,20 | R$ 5,45 | R$ -0,25 | -4.8% | ✅ bate |
| SP-270 / REGENTE FEIJÓ (OSM: Regente Feijó - 1) | Comercial por eixo (per-axle) | R$ 10,40 | R$ 10,90 | R$ -0,50 | -4.8% | ✅ bate |
| SP-270 / CAIUÁ (OSM: Caiuá - 1) | Passeio (car) | R$ 10,30 | R$ 10,80 | R$ -0,50 | -4.9% | ✅ bate |
| SP-270 / CAIUÁ (OSM: Caiuá - 1) | Motos | R$ 5,15 | R$ 5,40 | R$ -0,25 | -4.9% | ✅ bate |
| SP-270 / CAIUÁ (OSM: Caiuá - 1) | Comercial por eixo (per-axle) | R$ 10,30 | R$ 10,80 | R$ -0,50 | -4.9% | ✅ bate |
| SP-327 / OURINHOS (OSM: Ourinhos - 1) | Passeio (car) | R$ 10,30 | R$ 10,80 | R$ -0,50 | -4.9% | ✅ bate |
| SP-327 / OURINHOS (OSM: Ourinhos - 1) | Motos | R$ 5,15 | R$ 5,40 | R$ -0,25 | -4.9% | ✅ bate |
| SP-327 / OURINHOS (OSM: Ourinhos - 1) | Comercial por eixo (per-axle) | R$ 10,30 | R$ 10,80 | R$ -0,50 | -4.9% | ✅ bate |
| SP-300 / AVAÍ (OSM: Avaí - 1) | Passeio (car) | R$ 8,50 | R$ 8,90 | R$ -0,40 | -4.7% | ✅ bate |
| SP-300 / AVAÍ (OSM: Avaí - 1) | Motos | R$ 4,25 | R$ 4,45 | R$ -0,20 | -4.7% | ✅ bate |
| SP-300 / AVAÍ (OSM: Avaí - 1) | Comercial por eixo (per-axle) | R$ 8,50 | R$ 8,90 | R$ -0,40 | -4.7% | ✅ bate |
| SP-300 / PIRAJUÍ (OSM: Pirajuí - 1) | Passeio (car) | R$ 8,00 | R$ 8,40 | R$ -0,40 | -5.0% | ✅ bate |
| SP-300 / PIRAJUÍ (OSM: Pirajuí - 1) | Motos | R$ 4,00 | R$ 4,20 | R$ -0,20 | -5.0% | ✅ bate |
| SP-300 / PIRAJUÍ (OSM: Pirajuí - 1) | Comercial por eixo (per-axle) | R$ 8,00 | R$ 8,40 | R$ -0,40 | -5.0% | ✅ bate |
| SP-300 / PROMISSÃO (OSM: Promissão - 1) | Passeio (car) | R$ 9,60 | R$ 10,00 | R$ -0,40 | -4.2% | ✅ bate |
| SP-300 / PROMISSÃO (OSM: Promissão - 1) | Motos | R$ 4,80 | R$ 5,00 | R$ -0,20 | -4.2% | ✅ bate |
| SP-300 / PROMISSÃO (OSM: Promissão - 1) | Comercial por eixo (per-axle) | R$ 9,60 | R$ 10,00 | R$ -0,40 | -4.2% | ✅ bate |
| SP-300 / GLICÉRIO (OSM: Glicério - 1) | Passeio (car) | R$ 10,60 | R$ 11,10 | R$ -0,50 | -4.7% | ✅ bate |
| SP-300 / GLICÉRIO (OSM: Glicério - 1) | Motos | R$ 5,30 | R$ 5,55 | R$ -0,25 | -4.7% | ✅ bate |
| SP-300 / GLICÉRIO (OSM: Glicério - 1) | Comercial por eixo (per-axle) | R$ 10,60 | R$ 11,10 | R$ -0,50 | -4.7% | ✅ bate |
| SP-300 / RUBIÁCEA (OSM: Rubiácea - 1) | Passeio (car) | R$ 9,10 | R$ 9,50 | R$ -0,40 | -4.4% | ✅ bate |
| SP-300 / RUBIÁCEA (OSM: Rubiácea - 1) | Motos | R$ 4,55 | R$ 4,75 | R$ -0,20 | -4.4% | ✅ bate |
| SP-300 / RUBIÁCEA (OSM: Rubiácea - 1) | Comercial por eixo (per-axle) | R$ 9,10 | R$ 9,50 | R$ -0,40 | -4.4% | ✅ bate |
| SP-300 / LAVÍNIA (OSM: Lavínia - 1) | Passeio (car) | R$ 7,20 | R$ 7,50 | R$ -0,30 | -4.2% | ✅ bate |
| SP-300 / LAVÍNIA (OSM: Lavínia - 1) | Motos | R$ 3,60 | R$ 3,75 | R$ -0,15 | -4.2% | ✅ bate |
| SP-300 / LAVÍNIA (OSM: Lavínia - 1) | Comercial por eixo (per-axle) | R$ 7,20 | R$ 7,50 | R$ -0,30 | -4.2% | ✅ bate |
| SP-300 / GUARAÇAÍ (OSM: Guaraçaí - 1) | Passeio (car) | R$ 7,00 | R$ 7,30 | R$ -0,30 | -4.3% | ✅ bate |
| SP-300 / GUARAÇAÍ (OSM: Guaraçaí - 1) | Motos | R$ 3,50 | R$ 3,65 | R$ -0,15 | -4.3% | ✅ bate |
| SP-300 / GUARAÇAÍ (OSM: Guaraçaí - 1) | Comercial por eixo (per-axle) | R$ 7,00 | R$ 7,30 | R$ -0,30 | -4.3% | ✅ bate |
| SP-101 / MONTE MOR (OSM: Monte Mor - 2) | Passeio (car) | R$ 10,10 | R$ 10,60 | R$ -0,50 | -5.0% | ✅ bate |
| SP-101 / MONTE MOR (OSM: Monte Mor - 2) | Motos | R$ 5,05 | R$ 5,30 | R$ -0,25 | -5.0% | ✅ bate |
| SP-101 / MONTE MOR (OSM: Monte Mor - 2) | Comercial por eixo (per-axle) | R$ 10,10 | R$ 10,60 | R$ -0,50 | -5.0% | ✅ bate |
| SP-101 / RAFARD (OSM: Rafard - 2) | Passeio (car) | R$ 7,20 | R$ 7,50 | R$ -0,30 | -4.2% | ✅ bate |
| SP-101 / RAFARD (OSM: Rafard - 2) | Motos | R$ 3,60 | R$ 3,75 | R$ -0,15 | -4.2% | ✅ bate |
| SP-101 / RAFARD (OSM: Rafard - 2) | Comercial por eixo (per-axle) | R$ 7,20 | R$ 7,50 | R$ -0,30 | -4.2% | ✅ bate |
| SP-300 / CONCHAS (OSM: Conchas - 2) | Passeio (car) | R$ 9,70 | R$ 10,20 | R$ -0,50 | -5.2% | ✅ bate |
| SP-300 / CONCHAS (OSM: Conchas - 2) | Motos | R$ 4,85 | R$ 5,10 | R$ -0,25 | -5.2% | ✅ bate |
| SP-300 / CONCHAS (OSM: Conchas - 2) | Comercial por eixo (per-axle) | R$ 9,70 | R$ 10,20 | R$ -0,50 | -5.2% | ✅ bate |
| SP-300 / ANHEMBI (OSM: Anhembi - 2) | Passeio (car) | R$ 11,00 | R$ 11,50 | R$ -0,50 | -4.5% | ✅ bate |
| SP-300 / ANHEMBI (OSM: Anhembi - 2) | Motos | R$ 5,50 | R$ 5,75 | R$ -0,25 | -4.5% | ✅ bate |
| SP-300 / ANHEMBI (OSM: Anhembi - 2) | Comercial por eixo (per-axle) | R$ 11,00 | R$ 11,50 | R$ -0,50 | -4.5% | ✅ bate |
| SP-300 / BOTUCATU (OSM: Botucatu - 1) | Passeio (car) | R$ 7,70 | R$ 8,00 | R$ -0,30 | -3.9% | ✅ bate |
| SP-300 / BOTUCATU (OSM: Botucatu - 1) | Motos | R$ 3,85 | R$ 4,00 | R$ -0,15 | -3.9% | ✅ bate |
| SP-300 / BOTUCATU (OSM: Botucatu - 1) | Comercial por eixo (per-axle) | R$ 7,70 | R$ 8,00 | R$ -0,30 | -3.9% | ✅ bate |
| SP-300 / AREIÓPOLIS (OSM: Areiópolis - 2) | Passeio (car) | R$ 8,60 | R$ 9,00 | R$ -0,40 | -4.7% | ✅ bate |
| SP-300 / AREIÓPOLIS (OSM: Areiópolis - 2) | Motos | R$ 4,30 | R$ 4,50 | R$ -0,20 | -4.7% | ✅ bate |
| SP-300 / AREIÓPOLIS (OSM: Areiópolis - 2) | Comercial por eixo (per-axle) | R$ 8,60 | R$ 9,00 | R$ -0,40 | -4.7% | ✅ bate |
| SP-300 / AGUDOS (OSM: Agudos - 1) | Passeio (car) | R$ 8,40 | R$ 8,80 | R$ -0,40 | -4.8% | ✅ bate |
| SP-300 / AGUDOS (OSM: Agudos - 1) | Motos | R$ 4,20 | R$ 4,40 | R$ -0,20 | -4.8% | ✅ bate |
| SP-300 / AGUDOS (OSM: Agudos - 1) | Comercial por eixo (per-axle) | R$ 8,40 | R$ 8,80 | R$ -0,40 | -4.8% | ✅ bate |
| SP-308 / SALTO (OSM: Salto - 1) | Passeio (car) | R$ 4,90 | R$ 5,20 | R$ -0,30 | -6.1% | ✅ bate |
| SP-308 / SALTO (OSM: Salto - 1) | Motos | R$ 2,45 | R$ 2,60 | R$ -0,15 | -6.1% | ✅ bate |
| SP-308 / SALTO (OSM: Salto - 1) | Comercial por eixo (per-axle) | R$ 4,90 | R$ 5,20 | R$ -0,30 | -6.1% | ✅ bate |
| SP-070 / ITAQUAQUECETUBA (OSM: Itaquaquecetuba - 1) | Passeio (car) | R$ 5,70 | R$ 6,10 | R$ -0,40 | -7.0% | ✅ bate |
| SP-070 / ITAQUAQUECETUBA (OSM: Itaquaquecetuba - 1) | Motos | R$ 2,85 | R$ 3,05 | R$ -0,20 | -7.0% | ✅ bate |
| SP-070 / ITAQUAQUECETUBA (OSM: Itaquaquecetuba - 1) | Comercial por eixo (per-axle) | R$ 5,70 | R$ 6,10 | R$ -0,40 | -7.0% | ✅ bate |
| SP-070 / GUARAREMA (OSM: Guararema - 2) | Passeio (car) | R$ 5,40 | R$ 5,70 | R$ -0,30 | -5.6% | ✅ bate |
| SP-070 / GUARAREMA (OSM: Guararema - 2) | Motos | R$ 2,70 | R$ 2,85 | R$ -0,15 | -5.6% | ✅ bate |
| SP-070 / GUARAREMA (OSM: Guararema - 2) | Comercial por eixo (per-axle) | R$ 5,40 | R$ 5,70 | R$ -0,30 | -5.6% | ✅ bate |
| SP-070 / SÃO JOSÉ DOS CAMPOS (OSM: São José dos Campos - 2) | Passeio (car) | R$ 5,40 | R$ 5,70 | R$ -0,30 | -5.6% | ✅ bate |
| SP-070 / SÃO JOSÉ DOS CAMPOS (OSM: São José dos Campos - 2) | Motos | R$ 2,70 | R$ 2,85 | R$ -0,15 | -5.6% | ✅ bate |
| SP-070 / SÃO JOSÉ DOS CAMPOS (OSM: São José dos Campos - 2) | Comercial por eixo (per-axle) | R$ 5,40 | R$ 5,70 | R$ -0,30 | -5.6% | ✅ bate |
| SP-070 / CAÇAPAVA (OSM: Caçapava - 1) | Passeio (car) | R$ 5,50 | R$ 5,80 | R$ -0,30 | -5.5% | ✅ bate |
| SP-070 / CAÇAPAVA (OSM: Caçapava - 1) | Motos | R$ 2,75 | R$ 2,90 | R$ -0,15 | -5.5% | ✅ bate |
| SP-070 / CAÇAPAVA (OSM: Caçapava - 1) | Comercial por eixo (per-axle) | R$ 5,50 | R$ 5,80 | R$ -0,30 | -5.5% | ✅ bate |
| SP-270 / PRESIDENTE BERNADES (OSM: Presidente Bernardes - 1) | Passeio (car) | R$ 13,70 | R$ 14,40 | R$ -0,70 | -5.1% | ✅ bate |
| SP-270 / PRESIDENTE BERNADES (OSM: Presidente Bernardes - 1) | Motos | R$ 6,85 | R$ 7,20 | R$ -0,35 | -5.1% | ✅ bate |
| SP-270 / PRESIDENTE BERNADES (OSM: Presidente Bernardes - 1) | Comercial por eixo (per-axle) | R$ 13,70 | R$ 14,40 | R$ -0,70 | -5.1% | ✅ bate |
| SP-225 / STA CRUZ DO RIO PARDO (OSM: Santa Cruz do Rio Pardo - 1) | Passeio (car) | R$ 9,90 | R$ 10,40 | R$ -0,50 | -5.1% | ✅ bate |
| SP-225 / STA CRUZ DO RIO PARDO (OSM: Santa Cruz do Rio Pardo - 1) | Motos | R$ 4,95 | R$ 5,20 | R$ -0,25 | -5.1% | ✅ bate |
| SP-225 / STA CRUZ DO RIO PARDO (OSM: Santa Cruz do Rio Pardo - 1) | Comercial por eixo (per-axle) | R$ 9,90 | R$ 10,40 | R$ -0,50 | -5.1% | ✅ bate |
| SP-127 / MORRO DO ALTO (TATUÍ) (OSM: Morro do Alto I) | Passeio (car) | R$ 15,90 | R$ 16,70 | R$ -0,80 | -5.0% | ✅ bate |
| SP-127 / MORRO DO ALTO (TATUÍ) (OSM: Morro do Alto I) | Comercial por eixo (per-axle) | R$ 15,90 | R$ 16,70 | R$ -0,80 | -5.0% | ✅ bate |
| SP-332 / PAULÍNIA A (OSM: Paulínia A 2) | Passeio (car) | R$ 12,00 | R$ 12,60 | R$ -0,60 | -5.0% | ✅ bate |
| SP-332 / PAULÍNIA A (OSM: Paulínia A 2) | Motos | R$ 6,00 | R$ 6,30 | R$ -0,30 | -5.0% | ✅ bate |
| SP-332 / PAULÍNIA A (OSM: Paulínia A 2) | Comercial por eixo (per-axle) | R$ 12,00 | R$ 12,60 | R$ -0,60 | -5.0% | ✅ bate |
| SP-127 / MORRO DO ALTO (ITAPETININGA) (OSM: Morro do Alto II) | Passeio (car) | R$ 15,90 | R$ 16,70 | R$ -0,80 | -5.0% | ✅ bate |
| SP-127 / MORRO DO ALTO (ITAPETININGA) (OSM: Morro do Alto II) | Comercial por eixo (per-axle) | R$ 15,90 | R$ 16,70 | R$ -0,80 | -5.0% | ✅ bate |
| SP-300 / CASTILHO (OSM: Castilho 2) | Passeio (car) | R$ 5,20 | R$ 5,40 | R$ -0,20 | -3.8% | ✅ bate |
| SP-300 / CASTILHO (OSM: Castilho 2) | Motos | R$ 2,60 | R$ 2,70 | R$ -0,10 | -3.8% | ✅ bate |
| SP-300 / CASTILHO (OSM: Castilho 2) | Comercial por eixo (per-axle) | R$ 5,20 | R$ 5,40 | R$ -0,20 | -3.8% | ✅ bate |
| SP-344 / S. J. DA BOA VISTA (OSM: São João da Boa Vista - Sentido interior) | Passeio (car) | R$ 7,40 | R$ 7,40 | R$ 0,00 | 0.0% | ✅ bate |
| SP-344 / S. J. DA BOA VISTA (OSM: São João da Boa Vista - Sentido interior) | Comercial por eixo (per-axle) | R$ 7,40 | R$ 7,40 | R$ 0,00 | 0.0% | ✅ bate |
| SP-215 / STA CRUZ PALMEIRAS (OSM: Santa Cruz das Palmeiras - 1) | Passeio (car) | R$ 9,00 | R$ 9,50 | R$ -0,50 | -5.6% | ✅ bate |
| SP-215 / STA CRUZ PALMEIRAS (OSM: Santa Cruz das Palmeiras - 1) | Comercial por eixo (per-axle) | R$ 9,00 | R$ 9,50 | R$ -0,50 | -5.6% | ✅ bate |
| SP-340 / Pórtico Jaguariúna (OSM: Jaguariaíva - 1) | Passeio (car) | R$ 8,80 | R$ 8,00 | R$ 0,80 | 9.1% | ✅ bate |
| SP-340 / Pórtico Jaguariúna (OSM: Jaguariaíva - 1) | Comercial por eixo (per-axle) | R$ 8,80 | R$ 8,00 | R$ 0,80 | 9.1% | ✅ bate |
| SP-099 / P1 - Jambeiro (OSM: Jambeiro - 1) | Passeio (car) | R$ 5,80 | R$ 6,10 | R$ -0,30 | -5.2% | ✅ bate |
| SP-099 / P1 - Jambeiro (OSM: Jambeiro - 1) | Motos | R$ 2,90 | R$ 3,05 | R$ -0,15 | -5.2% | ✅ bate |
| SP-099 / P1 - Jambeiro (OSM: Jambeiro - 1) | Comercial por eixo (per-axle) | R$ 5,80 | R$ 6,10 | R$ -0,30 | -5.2% | ✅ bate |
| SP-021 / PRAÇA 13 - OSASCO (E) - Régis Bittencourt (OSM: P13 - Régis Bittencourt Externa) | Passeio (car) | R$ 3,50 | R$ 3,65 | R$ -0,15 | -4.3% | ✅ bate |
| SP-021 / PRAÇA 13 - OSASCO (E) - Régis Bittencourt (OSM: P13 - Régis Bittencourt Externa) | Comercial por eixo (per-axle) | R$ 3,50 | R$ 3,65 | R$ -0,15 | -4.3% | ✅ bate |
| SP-021 / PRAÇA 11 - RAPOSO TAVARES (I) RAMO E (OSM: P11 - Raposo Tavares Interna) | Passeio (car) | R$ 3,50 | R$ 3,65 | R$ -0,15 | -4.3% | ✅ bate |
| SP-021 / PRAÇA 11 - RAPOSO TAVARES (I) RAMO E (OSM: P11 - Raposo Tavares Interna) | Comercial por eixo (per-axle) | R$ 3,50 | R$ 3,65 | R$ -0,15 | -4.3% | ✅ bate |
| SP-021 / PRAÇA 12 - RAPOSO TAVARES (E) RAMO A (OSM: P12 - Raposo Tavares Externa) | Passeio (car) | R$ 3,50 | R$ 3,65 | R$ -0,15 | -4.3% | ✅ bate |
| SP-021 / PRAÇA 12 - RAPOSO TAVARES (E) RAMO A (OSM: P12 - Raposo Tavares Externa) | Comercial por eixo (per-axle) | R$ 3,50 | R$ 3,65 | R$ -0,15 | -4.3% | ✅ bate |
| SP-021 / PRAÇA 2 - BANDEIRANTES (I) RAMO F (OSM: P2 - Bandeirantes (interna)) | Passeio (car) | R$ 3,50 | R$ 3,65 | R$ -0,15 | -4.3% | ✅ bate |
| SP-021 / PRAÇA 2 - BANDEIRANTES (I) RAMO F (OSM: P2 - Bandeirantes (interna)) | Comercial por eixo (per-axle) | R$ 3,50 | R$ 3,65 | R$ -0,15 | -4.3% | ✅ bate |
| SP-021 / PRAÇA 3 - BANDEIRANTES (E) RAMO A (OSM: P3 - Bandeirantes (externa)) | Passeio (car) | R$ 3,50 | R$ 3,65 | R$ -0,15 | -4.3% | ✅ bate |
| SP-021 / PRAÇA 3 - BANDEIRANTES (E) RAMO A (OSM: P3 - Bandeirantes (externa)) | Comercial por eixo (per-axle) | R$ 3,50 | R$ 3,65 | R$ -0,15 | -4.3% | ✅ bate |
| SP-021 / PRAÇA 7 - CASTELO BRANCO (I) RAMO E (OSM: P7 - Castello Branco Interna) | Passeio (car) | R$ 3,50 | R$ 3,65 | R$ -0,15 | -4.3% | ✅ bate |
| SP-021 / PRAÇA 7 - CASTELO BRANCO (I) RAMO E (OSM: P7 - Castello Branco Interna) | Comercial por eixo (per-axle) | R$ 3,50 | R$ 3,65 | R$ -0,15 | -4.3% | ✅ bate |
| SP-021 / PRAÇA 8 - CASTELO BRANCO (E) RAMO A (OSM: P8 - Castello Branco (externa)) | Passeio (car) | R$ 3,50 | R$ 3,65 | R$ -0,15 | -4.3% | ✅ bate |
| SP-021 / PRAÇA 8 - CASTELO BRANCO (E) RAMO A (OSM: P8 - Castello Branco (externa)) | Comercial por eixo (per-axle) | R$ 3,50 | R$ 3,65 | R$ -0,15 | -4.3% | ✅ bate |
| SP-099 / P2 - Paraibuna (OSM: Paraibuna 2) | Passeio (car) | R$ 12,30 | R$ 13,00 | R$ -0,70 | -5.7% | ✅ bate |
| SP-099 / P2 - Paraibuna (OSM: Paraibuna 2) | Motos | R$ 6,15 | R$ 6,50 | R$ -0,35 | -5.7% | ✅ bate |
| SP-099 / P2 - Paraibuna (OSM: Paraibuna 2) | Comercial por eixo (per-axle) | R$ 12,30 | R$ 13,00 | R$ -0,70 | -5.7% | ✅ bate |
| SP-021 / PRAÇA 4 - ANHANGUERA (I) RAMO F (OSM: P4 - Anhanguera Interna Sul) | Passeio (car) | R$ 3,50 | R$ 3,65 | R$ -0,15 | -4.3% | ✅ bate |
| SP-021 / PRAÇA 4 - ANHANGUERA (I) RAMO F (OSM: P4 - Anhanguera Interna Sul) | Comercial por eixo (per-axle) | R$ 3,50 | R$ 3,65 | R$ -0,15 | -4.3% | ✅ bate |
| SP-021 / PRAÇA 5 - ANHANGUERA (I) RAMO E (OSM: P5 - Anhanguera Interna Norte) | Passeio (car) | R$ 3,50 | R$ 3,65 | R$ -0,15 | -4.3% | ✅ bate |
| SP-021 / PRAÇA 5 - ANHANGUERA (I) RAMO E (OSM: P5 - Anhanguera Interna Norte) | Comercial por eixo (per-axle) | R$ 3,50 | R$ 3,65 | R$ -0,15 | -4.3% | ✅ bate |
| SP-021 / PRAÇA 6 - ANHANGUERA (E) RAMO A (OSM: P6 - Anhanguera externa) | Passeio (car) | R$ 3,50 | R$ 3,65 | R$ -0,15 | -4.3% | ✅ bate |
| SP-021 / PRAÇA 6 - ANHANGUERA (E) RAMO A (OSM: P6 - Anhanguera externa) | Comercial por eixo (per-axle) | R$ 3,50 | R$ 3,65 | R$ -0,15 | -4.3% | ✅ bate |
| SP-021 / PRAÇA 10 - PADROEIRA (E) RAMO A (OSM: P10 - Padroeira Externa) | Passeio (car) | R$ 3,50 | R$ 3,65 | R$ -0,15 | -4.3% | ✅ bate |
| SP-021 / PRAÇA 10 - PADROEIRA (E) RAMO A (OSM: P10 - Padroeira Externa) | Comercial por eixo (per-axle) | R$ 3,50 | R$ 3,65 | R$ -0,15 | -4.3% | ✅ bate |
| SP-021 / PRAÇA 9 - PADROEIRA (I) RAMO F (OSM: P9 - Padroeira Interna) | Passeio (car) | R$ 3,50 | R$ 3,65 | R$ -0,15 | -4.3% | ✅ bate |
| SP-021 / PRAÇA 9 - PADROEIRA (I) RAMO F (OSM: P9 - Padroeira Interna) | Comercial por eixo (per-axle) | R$ 3,50 | R$ 3,65 | R$ -0,15 | -4.3% | ✅ bate |

## Casados sem tarifa OSM para comparar

| Praça ARTESP | OSM (id) | Score do match |
|---|---|---|
| _nenhuma_ | | |

## ARTESP sem match OSM

| Rodovia | Praça | KM | Passeio | Comercial por eixo |
|---|---|---|---|---|
| SP-147 | LIMEIRA | 091+300 | R$ 12,60 | R$ 12,60 |
| SP-075 | Pórtico Aeroporto (PaP) | 66+700 | R$ 1,50 | R$ 1,50 |
| SP-075 | Pórtico Campinas (PaP) | 70+650 | R$ 2,70 | R$ 2,70 |
| SP-075 | Pórtico Itu 2 (PaP) | 32+100 | R$ 2,80 | R$ 2,80 |
| SP-075 | Pórtico Praça Indaiatuba (PaP) | 60+800 | R$ 3,50 | R$ 3,50 |
| SP-075 | Pórtico Salto 1 (PaP) | 33+150 | R$ 2,80 | R$ 2,80 |
| SP-075 | Pórtico Salto 2 (PaP) | 43+350 | R$ 4,30 | R$ 4,30 |
| SP-075 | Pórtico Salto 3 (PaP) | 44+400 | R$ 4,30 | R$ 4,30 |
| SP-160 | ELDORADO (BLOQUEIO) | 020+100 | R$ 5,70 | R$ 5,70 |
| SP-160 | BATISTINI (BLOQUEIO) | 025+579 | R$ 9,10 | R$ 9,10 |
| SP-332 | PAULÍNIA B | 132+550 | R$ 16,70 | R$ 16,70 |
| SP-360 | Pórtico km 74 (PaP) | 74+000 | R$ 3,80 | R$ 3,80 |
| SP-332 | Pórtico Cosmópolis (PaP) | 146+500 | R$ 1,30 | R$ 1,30 |
| SP-332 | Pórtico Paulínia A (PaP) | 135+500 | R$ 6,50 | R$ 6,50 |
| SP-332 | Pórtico Paulínia B (PaP) | 132+550 | R$ 5,70 | R$ 5,70 |
| SP-021 | PRAÇA 1 - RAIMUNDO PEREIRA DE MAGALHÃES | 000+360 | R$ 3,50 | R$ 3,50 |
| SP-021 | PRAÇA 1 - TRECHO SUL / TRECHO OESTE (Pista Interna) | 50+000 | R$ 5,40 | R$ 5,40 |
| SP-021 | PRAÇA 4 - TRECHO SUL / IMIGRANTES (Pista Interna) | 71+400 | R$ 5,40 | R$ 5,40 |
| SP-021 | PRAÇA 5 - TRECHO SUL / VIA ANCHIETA (Pista Interna) | 75+500 | R$ 5,40 | R$ 5,40 |
| SP-021 | INTERSECÇÃO TRECHO LESTE | 86+950 | R$ 5,40 | R$ 5,40 |
| SPA-086/021 | PRAÇA 7 - TRECHO SUL / AV. PAPA JOÃO XXIII (Mauá) | 0+300 | R$ 5,40 | R$ 5,40 |
| SP-021 | Praça Leste 1 (Alça de Ligação) / Trecho Leste - Papa João XXIII | 88+000 | R$ 4,10 | R$ 4,10 |
| SP-021 | Praça Leste 2 (Pista Interna) / Trecho Leste - Trecho Sul | 87+940 | R$ 4,10 | R$ 4,10 |
| SP-021 | Externa) / Trecho Leste - Ayrton | 124+740 | R$ 4,10 | R$ 4,10 |
| SP-021 | Intersecção Trecho Leste com Via | 127+485 | R$ 4,10 | R$ 4,10 |
| SPI 097/055 | P3 - Caraguatatuba | 13+500 | R$ 5,50 | R$ 5,50 |

## OSM (dentro da bbox de SP) sem match ARTESP

| Concessionária | Nome OSM | id |
|---|---|---|
| Ecovias Raposo Castello | Barueri - 2 | `osm-25937851` |
| Ecovias Raposo Castello | Osasco - 1 | `osm-25937871` |
| Motiva Minas SP | Mairiporã - 2 | `osm-26317263` |
| Motiva Minas SP | Mairiporã - 1 | `osm-26317302` |
| Ecovias Raposo Castello | Itapevi | `osm-32551122` |
| Autopista Régis Bittencourt | São Lourenço da Serra - 2 | `osm-32656714` |
| CCR Sorocabana | Sentido Sorocaba/Interior | `osm-249926339` |
| CCR RioSP | Jacareí - 3 | `osm-335655849` |
| CCR RioSP | Jacareí - 1 | `osm-335657070` |
| Nascentes das Gerais | Córrego das Colheres - 1 | `osm-353495673` |
| DERSA | Vinhedo - 1 | `osm-355746864` |
| DERSA | Balsa São Sebastião-Ilha Bela | `osm-529775011` |
| Autopista Régis Bittencourt | Campina Grande do Sul - 2 | `osm-603863154` |
| Via Araucária | Imbituva - 1 | `osm-657957789` |
| Via Campo | Mamborê | `osm-665039521` |
| Via Campo | Corbélia | `osm-665040066` |
| SPMar | Ribeirão Pires - P7 externa | `osm-681768391` |
| Eixo SP | Itirapina - 1 | `osm-703698334` |
| CCR RioSP | Arujá - 2 | `osm-705249264` |
| CCR PRVias | Tibagi - 2 | `osm-776474095` |
| EPR Paraná | Marialva - 2 | `osm-776474126` |
| Ecovias Noroeste Paulista | Araraquara - 2 | `osm-974480212` |
| Eixo SP | Dois Córregos - 1 | `osm-992312314` |
| CCR RioSP | Itatiaia - 1 | `osm-992743099` |
| SPMar | Anchieta - P5 | `osm-1028696676` |
| Entrevias | Sertãozinho 1 - Entrevias | `osm-1129994966` |
| Autopista Régis Bittencourt | Cajati - 2 | `osm-1139650097` |
| Autopista Régis Bittencourt | Barra do Turvo - 2 | `osm-1139650117` |
| Motiva Minas SP | Cambuí - 1 | `osm-1145903728` |
| EPR Paraná | Arapongas - 1 | `osm-1210281789` |
| EPR Paraná | Presidente Castelo Branco - 1 | `osm-1251736157` |
| SPMar | Parelheiros - P1 | `osm-1421270319` |
| Triunfo Transbrasiliana | Marília / Veracruz - 2 | `osm-1426267202` |
| Motiva Minas SP | São Gonçalo do Sapucaí - 1 | `osm-1541410114` |
| CCR Rodoanel Oeste | Praça 1 / Perus - 13 | `osm-1567912259` |
| Jotec | Elisiário - 2 | `osm-1612375475` |
| EPR Litoral Pioneiro | Jacarezinho - 4 | `osm-1648986689` |
| Eixo SP | Jaú - 1 | `osm-1666505393` |
| CCR RioSP | Moreira César - 1 | `osm-1669525121` |
| Nascentes das Gerais | Formiga - 1 | `osm-1727248088` |
| Ecovias Noroeste Paulista | Pirangi - P10-1 | `osm-1808954676` |
| Arteris ViaPaulista | Pedágio São Simão (sentido Norte) | `osm-1809980837` |
| Arteris ViaPaulista | Pedágio Santa Rita do Passa Quatro (sentido Norte) | `osm-1809987097` |
| Ecovias Noroeste Paulista | Jaboticabal | `osm-1825695862` |
| Arteris ViaPaulista | Guatapará - 1 | `osm-1833595221` |
| Via Colinas | Rio Claro - 1 | `osm-1844740880` |
| Via Campo | Floresta - 2 | `osm-1844747517` |
| Way-262 | Florestal - 1 | `osm-1894699071` |
| Triunfo Econorte | Cambará - 2 | `osm-1970885241` |
| EPR Litoral Pioneiro | PP 03 - Praça de Pedágio Jacarezinho - Km. 1,2 | `osm-1970908059` |
| Triunfo Transbrasiliana | José Bonifácio - 1 | `osm-2004755269` |
| Prefeitura de Itirapina | Rod. Domingos Innocentini - 1 | `osm-2036275835` |
| EPR Litoral Pioneiro | Sengés | `osm-2036732466` |
| Arteris ViaPaulista | Batatais - 2 | `osm-2037248149` |
| Arteris ViaPaulista | Restinga - 2 | `osm-2037347773` |
| Ecovias Noroeste Paulista | Agulha - 1 | `osm-2054945606` |
| Ecovias Noroeste Paulista | Catiguá - 1 | `osm-2055944933` |
| CCR PRVias | Sertaneja - 1 | `osm-2133574015` |
| Prefeitura de Pindamonhagaba | Prefeitura de Pindamonhagaba (OSM 2191768746) | `osm-2191768746` |
| Motiva Minas SP | Mairiporã - 3 | `osm-2282560723` |
| Prefeitura de Araraquara | Vicinal Graciano da Ressurreição Affonso - Sentido Matão | `osm-2297499636` |
| Nascentes das Gerais | Rio Conquista - 1 | `osm-2321925199` |
| Nascentes das Gerais | São Sebastião do Paraíso- 2 | `osm-2321925205` |
| Autopista Régis Bittencourt | Miracatu - 2 | `osm-2336533299` |
| CCR AutoBAn | Sumaré | `osm-2349449350` |
| Eixo SP | Rio Claro - 2 | `osm-2352610237` |
| Entrevias | Pedágio Sales Oliveira (sentido Sul) | `osm-2429753983` |
| Entrevias | Pitangueiras - 1 | `osm-2487486100` |
| Eixo SP | Brotas - 1 | `osm-2488971102` |
| Motiva Minas SP | Carmópolis de Minas - 1 | `osm-2580217688` |
| SPMar | Imigrantes - P4 | `osm-2583107959` |
| Ecopistas | Guararema 2 | `osm-2586950470` |
| Ecopistas | Itaquaquecetuba - 1 | `osm-2586950502` |
| Rota das Bandeiras | Igaratá - 2 | `osm-2629948618` |
| Ecovias Noroeste Paulista | Monte Alto - 1 | `osm-3064137208` |
| EPR Litoral Pioneiro | Carambeí - 1 | `osm-3072716952` |
| Motiva Minas SP | Itatiaiuçu - 1 | `osm-3257650628` |
| Entrevias | Pedágio Ituverava (sentido Sul) | `osm-3349922532` |
| Way-262 | Luz - 1 | `osm-3656885996` |
| SPMar | Arujá - P10 - Externo | `osm-3687539636` |
| Triunfo Transbrasiliana | Onda Verde - 1 | `osm-3782268053` |
| Way-153 | Fronteira - 2 | `osm-3796183779` |
| Way-262 | Campo Florido - 2 | `osm-3810449903` |
| Ecovias Minas Goiás | Delta - Norte | `osm-3921171309` |
| Triunfo Transbrasiliana | Lins - 2 | `osm-3987118828` |
| EPR Iguaçu | Cascavel - 2 | `osm-4007907140` |
| Entrevias | Marília 1 | `osm-4063414689` |
| SPMar | Imigrantes Capital - P3 | `osm-4340543319` |
| Departamento Hidroviário | Departamento Hidroviário (OSM 4615990776) | `osm-4615990776` |
| SPMar | Itaquaquecetuba - P9 - Externa | `osm-4689749593` |
| SPMar | Arujá - P10 - Externo | `osm-4691535046` |
| Prefeitura de Ilhabela | Pedágio Ambiental de Ilha Bela | `osm-4697667318` |
| Motiva Minas SP | Vargem - 2 | `osm-4745187383` |
| SPMar | Imigrantes Litoral - P2 | `osm-4787631119` |
| CCR RioSP | Guararema - 1 | `osm-4915932757` |
| Rota das Bandeiras | Itatiba - 3 | `osm-5018872418` |
| Nascentes das Gerais | Azurita - 1 | `osm-5034547204` |
| CCR PRVias | Imbaú | `osm-5120596110` |
| PEDAGIO - GUARUJÁ | Balsa Santos-Guarujá | `osm-5122408700` |
| Appia Via Nascentes | Capitólio - 1 | `osm-5662685893` |
| Entrevias | Pedágio Florínea 2 | `osm-6070498029` |
| Entrevias | Entrevias (OSM 6142598737) | `osm-6142598737` |
| Entrevias | Entrevias (OSM 6142599358) | `osm-6142599358` |
| Arteris ViaPaulista | Boa Esperança do Sul -2 | `osm-6177434594` |
| SPMar | Ribeirão Pires - P7 interna | `osm-6225424289` |
| Arteris ViaPaulista | Jaú - 2 | `osm-6298987414` |
| Arteris ViaPaulista | Botucatu 1 | `osm-6534310058` |
| Eixo SP | São Pedro II | `osm-7505864773` |
| Eixo SP | Rancharia | `osm-7673433728` |
| Eixo SP | Pacaembu | `osm-7686461858` |
| EPR Sul de Minas | Praça P1 – Caldas – km 40,5 | `osm-8086881777` |
| Eixo SP | Martinópolis | `osm-8952143565` |
| Eixo SP | Garça | `osm-8952195522` |
| Eixo SP | Oriente | `osm-8952207234` |
| Eixo SP | Parapuã | `osm-8952213794` |
| Eixo SP | Lucélia / Inúbia Paulista | `osm-8952235702` |
| Eixo SP | São Pedro I - 1 | `osm-8955056896` |
| Eixo SP | Torrinha | `osm-8957523154` |
| Eixo SP | Piracicaba | `osm-8957715088` |
| Eixo SP | Paraguaçu Paulista | `osm-8957819192` |
| Eixo SP | Piratininga | `osm-9010011892` |
| Eixo SP | Cabrália Paulista | `osm-9010149010` |
| EPR Sul de Minas | P3 - Santa Rita do Sapucaí | `osm-11304223203` |
| EPR Sul de Minas | Poços de Caldas -P1 | `osm-11800896502` |
| Way-112 | Aparecida do Taboado KM-118 | `osm-11897417590` |
| Way-112 | Aparecida do Tabuado KM-174 | `osm-11901440633` |
| Way-112 | Selvíria | `osm-11905207913` |
| EPR Sul de Minas | Gonçalves - P1 | `osm-11922534981` |
| EPR Sul de Minas | Ouro Fino - P1 | `osm-11922995008` |
| EPR Vias do Café | Muzambinho - P1 | `osm-12018775712` |
| Eixo SP | Santa Mercedes | `osm-12078716430` |
| EPR Vias do Café | PP 04 - Monte Santo de Minas | `osm-12124965956` |
| EPR Vias do Café | Nepomuceno - P1 | `osm-12143017371` |
| EPR Vias do Café | Boa Esperança - P2 | `osm-12144717444` |
| EPR Vias do Café | Alfenas - P5 | `osm-12144884521` |
| EPR Vias do Café | Três Corações - P6 | `osm-12144966309` |
| EPR Sul de Minas | Borda Da Mata | `osm-12922396153` |
| CCR RioSP | Guararema - 2 | `osm-705248692` |
| CCR Rodoanel Oeste | P13 - Regis Bittencourt Externa | `osm-1421983741` |
| Ecovias Noroeste Paulista | Dobrada | `osm-13505709099` |
| Arteris ViaPaulista | São Carlos - 2 | `osm-13992393816` |
| Centrovias Arteris | São Carlos - 1 | `osm-13992393818` |
| EPR Litoral Pioneiro | Siqueira Campos | `osm-14090031392` |
| Ecovias Noroeste Paulista | Colina - P8-2 | `osm-1561630602` |
| Prefeitura de Limeira | Pedágio Municipal Limeira (sentido Norte) | `osm-2476142222` |
| Motiva Minas SP | Carmo da Cachoeira - 1 | `osm-3731050215` |
| Motiva Paraná | Pedágio de Ortigueira - BR-376 Km 316 | `osm-5120596109` |
| Departamento Hidroviário | Departamento Hidroviário (OSM 6051804046) | `osm-6051804046` |
| Arteris ViaPaulista | Coronel Macedo | `osm-6216267393` |
| Arteris ViaPaulista | Arteris ViaPaulista (OSM 6534228374) | `osm-6534228374` |
| EPR Sul de Minas | Senador José Bento - P2 | `osm-11914354472` |
| Way-112 | Aparecida doTabuado | `osm-13312006467` |
