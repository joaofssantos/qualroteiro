# Branches remotas removidas em 22/11/2026

Esta é a referência para restauração das branches `origin/aipe/*` removidas na
limpeza. Todas estavam alcançadas por `origin/main` e não tinham PR aberto no
momento da conferência (`gh pr list --state open`).

Resultado: 21 branches remotas removidas com segurança; os SHAs abaixo permitem
restaurá-las caso necessário.

Para restaurar uma branch, use o SHA correspondente, por exemplo:

```sh
git push origin <sha>:refs/heads/<branch>
```

| Branch | SHA |
| --- | --- |
| `aipe/j-20260908-yk/api--pete-campbell` | `af7f132446b16edaef9d42a007c03e35a0017e80` |
| `aipe/j-20260908-yk/root--lane-pryce` | `186f16d57ad55b15e38beae7600a5a7318fbc38b` |
| `aipe/j-20260908-yk/web--peggy-olson` | `9e7e4005344d918decc51843d5e2700e1265d3bd` |
| `aipe/j-20260909-ym/web--peggy-olson` | `a995b1d3ac69736acc45e4e454fae01ef0d936b0` |
| `aipe/j-20260910-hq/api--pete-campbell` | `9ef43e022322af0e28925f2fd2871f659909d26b` |
| `aipe/j-20260910-hq/root--lane-pryce` | `9c50c66f1ec7a3381a63ef6f455d969d3d0fccf9` |
| `aipe/j-20260914-bb/api--pete-campbell` | `a781616aca34a22df40b3820d40354ca99080d3b` |
| `aipe/j-20260914-bb/root--lane-pryce` | `836984a620dcd8d5cb97abafe86db26af726deb0` |
| `aipe/j-20260915-61/web--peggy-olson` | `acf7e5e64dc72f4125afe7a3a5b51928a01fb73d` |
| `aipe/j-20260915-er/api--pete-campbell` | `b59f4f259327b02bfb77faed8695adcbebc32e8c` |
| `aipe/j-20260915-kt/api--pete-campbell` | `2206128a65518e86863551e0a7cb7ec2cd720d8a` |
| `aipe/j-20260915-kt/root--lane-pryce` | `65c98fa6d161d1092744da8a6d7d110c90b72aab` |
| `aipe/j-20260915-tc/web--peggy-olson` | `50a064a24842abdaa4cb271a74398f393fd8dfd7` |
| `aipe/j-20260916-9p/api--pete-campbell` | `d57eb42f48b89d3bba493544b5973dcd805ad181` |
| `aipe/j-20260916-9p/web--peggy-olson` | `618febd9f0792d3cacb1344fadf951838524fbff` |
| `aipe/j-20260916-9y/api--pete-campbell` | `5e9ff92473d9bdd19780ab19cef7bf6b49ccb89b` |
| `aipe/j-20260916-9y/root--lane-pryce` | `3e3c10027e1d1b9893b3f43d1ead9d534cb77f66` |
| `aipe/j-20260916-gl/web--peggy-olson` | `9a368547281a12be79b2779d3064c125b93fb625` |
| `aipe/j-20260916-sw/api--pete-campbell` | `849c17be88438c3b17982cab1b3c06db5bad5761` |
| `aipe/j-20260916-w0/web--peggy-olson` | `64ddb3ec2b6274cbc27ff78e7c9ed727f3362005` |
| `aipe/j-20260916-y9/root--lane-pryce` | `194a37757ff750b4d50d68f94792f507bce84a14` |
