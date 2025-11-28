// Webhook handler para PIX (preparado para implementação futura)
// Este arquivo contém a estrutura para receber webhooks da API PIX
// 
// ⚠️ NOTA: Webhooks geralmente rodam no SERVIDOR, não no frontend.
// Se este código rodar no frontend, precisa ser migrado para Edge Function.
// Se rodar no servidor (Express.js), as queries diretas são aceitáveis.

// ⚠️ IMPORTANTE: Verificar onde este código é executado!
// Se executar no frontend: MIGRAR para Edge Function 'pix-webhook'
// Se executar no servidor: OK (mas idealmente usar Edge Function também)

import { supabase } from '../../lib/supabase'

// Interface para dados do webhook PIX
interface PixWebhookData {
  event: string
  data: {
    id: string
    status: 'confirmed' | 'cancelled' | 'expired' | 'failed'
    confirmedAt?: string
    errorMessage?: string
    txid?: string
  }
  signature?: string
  timestamp: string
}

// Função para processar webhook PIX
export async function handlePixWebhook(payload: PixWebhookData): Promise<void> {
  try {
    // TODO: Validar assinatura em produção
    // if (!validateWebhookSignature(JSON.stringify(payload.data), payload.signature)) {
    //   throw new Error('Assinatura inválida')
    // }

    const { data } = payload
    
    // Atualizar status do pagamento no Supabase
    const { error } = await (supabase as any)
      .from('pix_payments')
      .update({
        status: data.status,
        confirmed_at: data.confirmedAt ? new Date(data.confirmedAt).toISOString() : null,
        error_message: data.errorMessage || null,
        txid: data.txid || null,
        webhook_data: payload,
        updated_at: new Date().toISOString()
      })
      .eq('external_id', data.id)

    if (error) {
      console.error('Erro ao atualizar pagamento PIX:', error)
      throw error
    }

    // Se o pagamento foi confirmado, adicionar saldo ao cartão
    if (data.status === 'confirmed') {
      const { data: payment, error: paymentError } = await (supabase as any)
        .from('pix_payments')
        .select('card_id, amount')
        .eq('external_id', data.id)
        .single()

      if (paymentError) {
        console.error('Erro ao buscar dados do pagamento:', paymentError)
        return
      }

      // Adicionar saldo ao cartão
      const { error: balanceError } = await (supabase as any)
        .from('cards')
        .update({
          balance: payment.amount, // TODO: Implementar incremento correto
          updated_at: new Date().toISOString()
        })
        .eq('id', payment.card_id)

      if (balanceError) {
        console.error('Erro ao atualizar saldo do cartão:', balanceError)
        return
      }

      // Criar transação de crédito
      const { error: transactionError } = await (supabase as any)
        .from('transactions')
        .insert({
          card_id: payment.card_id,
          amount: payment.amount,
          type: 'credit',
          description: 'Abastecimento via PIX',
          created_by: 'pix_system'
        })

      if (transactionError) {
        console.error('Erro ao criar transação:', transactionError)
      }
    }

    console.log(`Webhook PIX processado: ${data.id} - ${data.status}`)
  } catch (error) {
    console.error('Erro ao processar webhook PIX:', error)
    throw error
  }
}

// Endpoint para receber webhooks (estrutura para Express.js)
export function createPixWebhookEndpoint() {
  return async (req: any, res: any) => {
    try {
      const payload: PixWebhookData = req.body
      
      await handlePixWebhook(payload)
      
      res.status(200).json({ success: true })
    } catch (error) {
      console.error('Erro no webhook PIX:', error)
      res.status(500).json({ error: 'Erro interno do servidor' })
    }
  }
}

// Exemplo de uso com Express.js:
/*
import express from 'express'
import { createPixWebhookEndpoint } from './api/webhooks/pix'

const app = express()
app.use(express.json())

// Endpoint para webhook PIX
app.post('/webhooks/pix', createPixWebhookEndpoint())

app.listen(3001, () => {
  console.log('Servidor de webhooks rodando na porta 3001')
})
*/
