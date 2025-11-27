// Serviço para gerenciar produtos - Agora usa Edge Functions via api-client
// ⚠️ Migrado para usar api-client.ts - queries diretas removidas

import { api } from '../lib/api-client'
import type { ProductCategory } from '../types'

export type Product = {
  id: string | null // alterado de number para string
  name: string
  price: number
  stock: number
  image?: string | null
  image_url?: string | null
  category?: string | null
  [key: string]: any
}

const TABLE_BY_CATEGORY: Record<ProductCategory, { table: string; hasCategoryColumn: boolean }> = {
  lojinha: { table: 'products', hasCategoryColumn: true },
  lanchonete: { table: 'products', hasCategoryColumn: true },
  sapatinho: { table: 'sapatinho_products', hasCategoryColumn: false }
}

export const productService = {
  // ✅ Agora usa Edge Function via api-client
  getProducts: async (category: ProductCategory): Promise<Product[]> => {
    try {
      const response = await api.listProducts(category)
      
      if (!response.success) {
        console.error('productService.getProducts error:', response.error)
        return []
      }

      // Transformar dados da Edge Function para formato esperado
      const products = (response.data || []).map((product: any) => ({
        id: product.id,
        name: product.name,
        price: parseFloat(product.price) || 0,
        category: product.category || category,
        description: product.description || null,
        stock: product.stock || 0,
        active: product.active !== false,
        createdAt: product.created_at,
        image_url: product.image_url || product.image || null,
        image: product.image_url || product.image || null,
      } as Product))

      // Ordenar por nome
      return products.sort((a, b) => a.name.localeCompare(b.name))
    } catch (err) {
      console.error('productService.getProducts unexpected error:', err)
      return []
    }
  },

  // ✅ Agora usa Edge Function via api-client
  deleteProduct: async (category: ProductCategory, id: string): Promise<boolean> => {
    try {
      const response = await api.manageProducts(
        {
          action: 'delete',
          id,
          category,
        },
        'DELETE'
      )

      if (!response.success) {
        console.error('productService.deleteProduct error:', response.error)
        return false
      }
      return true
    } catch (err) {
      console.error('productService.deleteProduct unexpected error:', err)
      return false
    }
  },

  // ✅ Agora usa Edge Function via api-client
  getProductById: async (id: string, category: ProductCategory = 'lojinha'): Promise<Product | null> => {
    try {
      const response = await api.listProducts(category)
      
      if (!response.success) {
        console.error('productService.getProductById error:', response.error)
        return null
      }

      // Buscar produto específico na lista
      const product = (response.data || []).find((p: any) => p.id === id)
      
      if (!product) return null

      return {
        id: product.id,
        name: product.name,
        price: parseFloat(product.price) || 0,
        category: product.category || category,
        description: product.description || null,
        stock: product.stock || 0,
        active: product.active !== false,
        createdAt: product.created_at,
        image_url: product.image_url || product.image || null,
        image: product.image_url || product.image || null,
      } as Product
    } catch (err) {
      console.error('productService.getProductById unexpected error:', err)
      return null
    }
  },

  // ⚠️ Upload de imagem - Storage do Supabase pode ser usado diretamente se RLS estiver configurado
  // Para maior segurança, considere criar uma Edge Function para uploads
  // ⚠️ NOTA: auth-client não tem storage - usar método alternativo ou criar Edge Function
  async uploadProductImage(file: File): Promise<string | null> {
    try {
      if (!file) {
        console.error('No file provided for upload');
        return null;
      }

      // TODO: Criar Edge Function 'upload-product-image' para uploads seguros
      // Por enquanto, usar cliente mínimo apenas para storage (storage tem políticas próprias)
      const { createClient } = await import('@supabase/supabase-js')
      const supabaseUrl = import.meta.env.DEV
        ? (import.meta.env.VITE_SUPABASE_LOCAL_URL || import.meta.env.VITE_SUPABASE_URL)
        : import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase não configurado')
      }

      const storageClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      })
      
      // Generate unique filename
      const fileExt = file.type.split('/').pop() || 'jpg';
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${fileName}`;

      // Upload file to Supabase Storage
      // ⚠️ Storage tem políticas próprias de RLS, mas idealmente deveria usar Edge Function
      const { error: uploadError } = await storageClient.storage
        .from('products')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = storageClient.storage
        .from('products')
        .getPublicUrl(filePath);
      return urlData.publicUrl;
    } catch (error) {
      console.error('Upload process failed:', error);
      return null;
    }
  },

  // ✅ Agora usa Edge Function via api-client
  async saveProduct(category: ProductCategory, product: Product, newImageFile: File | null, existingImageUrl: string | null | undefined): Promise<Product | null> {
    try {
      // Handle image upload if file exists
      let imageUrl = existingImageUrl;
      if (newImageFile instanceof File) {
        imageUrl = await this.uploadProductImage(newImageFile);
        if (!imageUrl) {
          throw new Error('Falha ao fazer upload da imagem. Por favor, tente novamente.');
        }
      }

      const productData = {
        name: product.name,
        price: product.price,
        stock: product.stock,
        description: product.description || null,
        image_url: imageUrl || product.image || null,
        category,
        active: product.id ? (typeof product.active === 'boolean' ? product.active : true) : true,
      }

      const method = product.id ? 'PUT' : 'POST'
      const actionData = product.id 
        ? { action: 'update', id: product.id, ...productData }
        : { action: 'create', ...productData }

      const response = await api.manageProducts(actionData, method)

      if (!response.success) {
        throw new Error(response.error || 'Erro ao salvar produto')
      }

      // Transformar resposta para formato esperado
      const savedProduct = response.data
      return {
        id: savedProduct.id,
        name: savedProduct.name,
        price: parseFloat(savedProduct.price) || 0,
        category: savedProduct.category || category,
        description: savedProduct.description || null,
        stock: savedProduct.stock || 0,
        active: savedProduct.active !== false,
        createdAt: savedProduct.created_at,
        image_url: savedProduct.image_url || savedProduct.image || null,
        image: savedProduct.image_url || savedProduct.image || null,
      } as Product
    } catch (error: any) {
      console.error('Product save failed:', error);
      throw error;
    }
  } 
}
