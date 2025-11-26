// Serviço para gerenciar produtos no Supabase

import { supabase } from '../lib/supabase'
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
  // Retorna array de produtos (nunca undefined)
  getProducts: async (category: ProductCategory): Promise<Product[]> => {
    try {
      const { table, hasCategoryColumn } = TABLE_BY_CATEGORY[category]
      let query = supabase
        .from(table)
        .select('*')
        .eq('active', true)

      if (hasCategoryColumn) {
        query = query.eq('category', category)
      }

      const { data, error } = await query.order('name', { ascending: true })

      if (error) {
        console.error('productService.getProducts error:', error)
        return []
      }

      // garante retorno consistente
      return data ?? []
    } catch (err) {
      console.error('productService.getProducts unexpected error:', err)
      return []
    }
  },

  // Deleta produto e retorna boolean indicando sucesso
  deleteProduct: async (category: ProductCategory, id: string): Promise<boolean> => {
    try {
      const { table } = TABLE_BY_CATEGORY[category]
      const { error } = await supabase
        .from(table)
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq('id', id)

      if (error) {
        console.error('productService.deleteProduct error:', error)
        return false
      }
      return true
    } catch (err) {
      console.error('productService.deleteProduct unexpected error:', err)
      return false
    }
  },

  // Opcional: buscar um produto por id (útil para edição)
  getProductById: async (id: string, category: ProductCategory = 'lojinha'): Promise<Product | null> => {
    try {
      const { table, hasCategoryColumn } = TABLE_BY_CATEGORY[category]
      let query = supabase
        .from(table)
        .select('*')
        .eq('id', id)

      if (hasCategoryColumn) {
        query = query.eq('category', category)
      }

      const { data, error } = await query.single()

      if (error) {
        console.error('productService.getProductById error:', error)
        return null
      }
      return data ?? null
    } catch (err) {
      console.error('productService.getProductById unexpected error:', err)
      return null
    }
  },

  //Salva imagem do produto no storage do supabase
  async uploadProductImage(file: File): Promise<string | null> {
    try {
      if (!file) {
        console.error('No file provided for upload');
        return null;
      }

      // Generate unique filename
      const fileExt = file.type.split('/').pop() || 'jpg';
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${fileName}`;

      // Upload file to Supabase Storage
      // O Supabase já gerencia timeout automaticamente (geralmente 30-60s)
      const { error: uploadError } = await supabase.storage
        .from('products')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('products')
        .getPublicUrl(filePath);
      return urlData.publicUrl;
    } catch (error) {
      console.error('Upload process failed:', error);
      return null;
    }
  },

  async saveProduct(category: ProductCategory, product: Product, newImageFile: File | null, existingImageUrl: string | null | undefined): Promise<Product | null> {
    try {      
      const { table, hasCategoryColumn } = TABLE_BY_CATEGORY[category]
      // Handle image upload if file exists
      let imageUrl = existingImageUrl;
      if (newImageFile instanceof File) {
        imageUrl = await this.uploadProductImage(newImageFile);
        if (!imageUrl) {
          console.error('Image upload failed');
          throw new Error('Falha ao fazer upload da imagem. Por favor, tente novamente.');
        }
      }
      const baseData = {
        name: product.name,
        price: product.price,
        stock: product.stock,
        description: product.description || null,
        image_url: imageUrl || product.image,
        ...(hasCategoryColumn ? { category } : {})
      };
      const productData = product.id
        ? {
            ...baseData,
            ...(typeof product.active === 'boolean' ? { active: product.active } : {})
          }
        : {
            ...baseData,
            active: true
          }

      let savedProduct: Product | null = null;

      if (product.id) {
        // Update existing product
        const { data, error } = await supabase
          .from(table)
          .update(productData)
          .eq('id', product.id)
          .select()
          .single();

        if (error) {
          console.error('Update product error:', error);
          throw error;
        }
        
        if (!data) {
          throw new Error('Produto não foi atualizado. Nenhum dado retornado.');
        }
        
        savedProduct = data;
      } else {
        // Create new product
        const { data, error } = await supabase
          .from(table)
          .insert([productData])
          .select()
          .single();

        if (error) {
          console.error('Create product error:', error);
          throw error;
        }
        
        if (!data) {
          throw new Error('Produto não foi criado. Nenhum dado retornado.');
        }
        
        savedProduct = data;
      }

      // Retornar produto salvo
      // Não precisamos verificação adicional - se o Supabase retornou dados, está salvo
      return savedProduct;
    } catch (error) {
      console.error('Product save failed:', error);
      // Re-throw para que o frontend possa tratar o erro
      throw error;
    }
  } 
}
