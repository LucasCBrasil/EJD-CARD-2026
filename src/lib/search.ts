/**
 * Prepara texto para comparação em buscas. Aplique no termo digitado e no campo
 * pesquisado, senão "agua" não encontra "Água".
 */
export const normalizeSearch = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
