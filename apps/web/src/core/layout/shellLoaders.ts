/**
 * Carregadores dos shells (um `import()` por layout, para virarem chunks).
 * Isolados num módulo para que `test/setup.ts` os troque por carregadores
 * síncronos: sem isso, todo teste existente que renderiza o app precisaria
 * esperar o `lazy` resolver antes da primeira consulta.
 */
export const shellLoaders = {
  a: () => import('../shell/layouts/a'),
  b: () => import('../shell/layouts/b'),
};
