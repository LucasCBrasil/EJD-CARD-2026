// Fica só neste aparelho para o CPF/CNPJ não ir para o nosso banco. A chave por conta evita
// preencher o documento de uma pessoa para outra que entre no mesmo celular.
const storageKey = (userId: string) => `ejd-pix-documento:${userId}`

// O localStorage pode lançar erro (navegação privada, dados bloqueados). A recarga segue sem a lembrança.
export function loadPayerDocument(userId: string): string {
  try { return localStorage.getItem(storageKey(userId)) || '' }
  catch { return '' }
}

export function savePayerDocument(userId: string, document: string): void {
  try { localStorage.setItem(storageKey(userId), document) }
  catch { /* sem armazenamento, a pessoa digita de novo na próxima vez */ }
}
