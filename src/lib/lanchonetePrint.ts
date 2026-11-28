import type { LanchoneteOrder } from './api-client'

/** Prepara a janela durante o clique para evitar o bloqueio de pop-ups. */
export function openOrderPrintWindow(): Window | null {
  const printWindow = window.open('', '_blank', 'width=420,height=600')
  if (printWindow) {
    printWindow.document.title = 'Comanda'
    printWindow.document.body.textContent = 'Aguardando confirmação do pedido...'
  }
  return printWindow
}

export function printLanchoneteOrder(printWindow: Window, order: LanchoneteOrder): void {
  const doc = printWindow.document
  doc.head.innerHTML = '<meta charset="utf-8"><title>Comanda</title><style>@page{size:80mm auto;margin:4mm}body{font:14px monospace;color:#000;margin:0}h1{font-size:21px;margin:0 0 8px}p{margin:5px 0}ul{list-style:none;padding:8px 0;border-top:1px dashed;border-bottom:1px dashed}li{margin:6px 0;overflow-wrap:anywhere}.total{font-weight:bold}</style>'
  doc.body.replaceChildren()
  const add = (tag: string, value: string, parent: HTMLElement = doc.body) => {
    const element = doc.createElement(tag)
    element.textContent = value
    parent.appendChild(element)
    return element
  }
  add('h1', `PEDIDO Nº ${order.saleNumber}`)
  add('p', `Cliente: ${order.customerName || 'Não informado'}`)
  add('p', `Pedido em: ${new Date(order.createdAt).toLocaleString('pt-BR')}`)
  const items = add('ul', '')
  order.items.forEach(item => add('li', `${item.quantity} x ${item.productName}`, items))
  add('p', `Total: R$ ${order.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`).className = 'total'
  add('p', 'Pago com saldo')
  printWindow.addEventListener('afterprint', () => printWindow.close(), { once: true })
  printWindow.focus()
  printWindow.print()
}
