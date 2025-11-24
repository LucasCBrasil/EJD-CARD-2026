/**
 * API de Cartões - Usando Supabase direto
 * (APIs serverless removidas por limite do Vercel Hobby - máximo 12 funções)
 */

import { Card } from '../types'
import { supabase } from '../lib/supabase'

function mapToCard(data: any): Card {
  return {
    id: data.id,
    userId: data.user_id,
    userName: data.user_name,
    cardNumber: data.card_number,
    phoneNumber: data.phone_number,
    balance: data.balance,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  }
}

export const cardsApi = {
  // Queries
  getAll: async (): Promise<Card[]> => {
    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw new Error(error.message)
    return (data || []).map(mapToCard)
  },

  getByNumber: async (cardNumber: string): Promise<Card | null> => {
    try {
      const { data, error } = await supabase
        .from('cards')
        .select('*')
        .eq('card_number', cardNumber)
        .single()
      
      if (error) throw new Error(error.message)
      return data ? mapToCard(data) : null
    } catch (error) {
      console.error('Erro ao buscar cartão por número:', error)
      return null
    }
  },

  getByUserId: async (userId: string): Promise<Card | null> => {
    try {
      const { data, error } = await supabase
        .from('cards')
        .select('*')
        .eq('user_id', userId)
        .eq('is_associated', true)
        .maybeSingle()
      
      if (error) {
        // Se for erro de "nenhum resultado", retornar null normalmente
        if (error.code === 'PGRST116' || error.message.includes('No rows')) {
          return null
        }
        throw new Error(error.message)
      }
      return data ? mapToCard(data) : null
    } catch (error: any) {
      // Ignorar erros de "nenhum resultado encontrado"
      if (error?.code === 'PGRST116' || error?.message?.includes('No rows') || error?.message?.includes('Cannot coerce')) {
        return null
      }
      console.error('Erro ao buscar cartão do usuário:', error)
      return null
    }
  },

  // Mutations
  create: async (params: { name: string; cardNumber: string; cardCode: string; phoneNumber: string; initialBalance?: number }): Promise<Card> => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Usuário não autenticado')
    
    const { data, error } = await supabase
      .from('cards')
      .insert({
        user_id: user.id,
        user_name: params.name,
        card_number: params.cardNumber,
        phone_number: params.phoneNumber,
        balance: params.initialBalance || 0,
        card_code: params.cardCode
      })
      .select()
      .single()
    
    if (error) throw new Error(error.message)
    return mapToCard(data)
  },

  associate: async (params: { cardNumber: string; cardCode: string }): Promise<Card> => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Usuário não autenticado')
    
    const { data: card, error: findError } = await supabase
      .from('cards')
      .select('*')
      .eq('card_number', params.cardNumber)
      .eq('card_code', params.cardCode)
      .single()
    
    if (findError || !card) throw new Error('Cartão não encontrado ou código incorreto')
    
    const { data, error } = await supabase
      .from('cards')
      .update({ user_id: user.id })
      .eq('id', card.id)
      .select()
      .single()
    
    if (error) throw new Error(error.message)
    return mapToCard(data)
  },

  updateBalance: async (params: { cardId: string; amount: number; type: 'credit' | 'debit'; description?: string }): Promise<void> => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Usuário não autenticado')
    
    const { data: card, error: findError } = await supabase
      .from('cards')
      .select('balance')
      .eq('id', params.cardId)
      .single()
    
    if (findError || !card) throw new Error('Cartão não encontrado')
    
    const newBalance = params.type === 'credit' 
      ? card.balance + params.amount 
      : card.balance - params.amount
    
    if (newBalance < 0) throw new Error('Saldo insuficiente')
    
    const { error: updateError } = await supabase
      .from('cards')
      .update({ balance: newBalance })
      .eq('id', params.cardId)
    
    if (updateError) throw new Error(updateError.message)
    
    await supabase
      .from('transactions')
      .insert({
        card_id: params.cardId,
        amount: params.amount,
        type: params.type,
        description: params.description || '',
        created_by: user.id
      })
  },
}
