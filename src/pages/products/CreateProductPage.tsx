import { useState, useEffect } from 'react'
import { useNavigate, useLocation, useParams } from '@tanstack/react-router'

import { Button, Header } from '../../components/shared'
import { useToastContext } from '../../contexts/ToastContext'
import { productService } from '../../services'
import type { ProductCategory } from '../../types'

const CreateProductPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams({ strict: false }) as { id?: string }
  const { showSuccess, showError, showWarning } = useToastContext()
  
  const context: ProductCategory = location.pathname.startsWith('/sapatinho-veloz')
    ? 'sapatinho'
    : location.pathname.startsWith('/lanchonete')
      ? 'lanchonete'
      : 'lojinha'
  const basePath = context === 'sapatinho' ? '/sapatinho-veloz' : `/${context}`
  const isEditing = !!id // mantenha esta linha
  const [existingUrl, setExistingUrl] = useState<string | null>(null)
  
  const safeNavigate = (path: string) => navigate({ to: path as any, search: {} as any })
  
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    stock: '',
    image: null as File | string | null
  })
  
  const getSelectedImageName = () => {
    if (formData.image instanceof File) {
      return formData.image.name
    }
    if (typeof formData.image === 'string') {
      const parts = formData.image.split('/')
      return parts[parts.length - 1] || formData.image
    }
    return ''
  }
  
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Carregar produto para edição
  useEffect(() => {
    if (isEditing && id) {
      const fetchProduct = async () => {
        try {
          setIsLoading(true)
          
          const data = await productService.getProductById(id, context)

          if (!data) {
            showError('Erro', 'Produto não encontrado!')
            safeNavigate(`${basePath}/products/list`)
            return
          }

          setFormData({
            name: data.name ?? '',
            price: (Number(data.price) || 0).toFixed(2).replace('.', ','),
            stock: String(data.stock ?? 0),
            image: (data as any).image_url ?? data.image ?? null
          })
          const imageUrl = (data as any).image_url ?? data.image ?? null
          setExistingUrl(imageUrl)
          setImagePreview(imageUrl)
        } catch (err) {
          console.error(err)
          showError('Erro', 'Erro ao carregar produto.')
          safeNavigate(`${basePath}/products/list`)
        } finally {
          setIsLoading(false)
        }
      }

      fetchProduct()
    }
  }, [isEditing, id, context, navigate, showError])

  // Configurações específicas por contexto
  const config = {
    lojinha: {
      title: isEditing ? '✏️ Editar Produto' : '📦 Cadastrar Produto',
      subtitle: isEditing ? 'Atualize as informações do produto' : 'Adicione um novo produto à lojinha',
      nameLabel: 'Nome do Produto',
      namePlaceholder: 'Ex: Camiseta Mágica',
      successMessage: isEditing ? 'Produto atualizado com sucesso!' : 'Produto cadastrado com sucesso!'
    },
    lanchonete: {
      title: isEditing ? '✏️ Editar Item' : '🍔 Cadastrar Item',
      subtitle: isEditing ? 'Atualize as informações do item' : 'Adicione um novo item ao cardápio',
      nameLabel: 'Nome do Item',
      namePlaceholder: 'Ex: Hambúrguer de Esmeralda',
      successMessage: isEditing ? 'Item atualizado com sucesso!' : 'Item cadastrado com sucesso!'
    },
    sapatinho: {
      title: isEditing ? '✏️ Editar Item do Sapatinho' : '👠 Cadastrar Item do Sapatinho',
      subtitle: isEditing ? 'Atualize as informações do item mágico' : 'Adicione um novo item especial para o Sapatinho velOz',
      nameLabel: 'Nome do Item Mágico',
      namePlaceholder: 'Ex: Bilhete Encantado',
      successMessage: isEditing ? 'Item do Sapatinho atualizado!' : 'Item do Sapatinho cadastrado!'
    }
  }
  
  const currentConfig = config[context]

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const formatCurrency = (value: string): string => {
    const numbers = value.replace(/\D/g, '')
    if (!numbers) return ''
    
    const cents = parseInt(numbers)
    const reais = (cents / 100).toFixed(2)
    return reais.replace('.', ',')
  }

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCurrency(e.target.value)
    handleInputChange('price', formatted)
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validar tipo de arquivo
      if (!file.type.startsWith('image/')) {
        showWarning('Arquivo inválido', 'Por favor, selecione apenas arquivos de imagem.')
        return
      }
      
      // Validar tamanho (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        showWarning('Imagem muito grande', 'A imagem deve ter no máximo 5MB.')
        return
      }
      
      setFormData(prev => ({ ...prev, image: file }))
      
      // Criar preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRemoveImage = () => {
    setFormData(prev => ({ ...prev, image: null }))
    setImagePreview(null)
    // Limpar o input file
    const fileInput = document.getElementById('image') as HTMLInputElement
    if (fileInput) fileInput.value = ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validações
    if (!formData.name.trim()) {
      showWarning('Campo obrigatório', 'Por favor, preencha o nome do produto.')
      return
    }
    
    if (!formData.price) {
      showWarning('Campo obrigatório', 'Por favor, preencha o valor.')
      return
    }
    
    if (!formData.stock || parseInt(formData.stock) <= 0) {
      showWarning('Quantidade inválida', 'Por favor, preencha uma quantidade válida.')
      return
    }
    
    setIsLoading(true)

    try {
      await productService.saveProduct(
        context,
        {
          id: id ? id : null,
          name: formData.name,
          price: parseFloat(formData.price.replace(',', '.')),
          stock: parseInt(formData.stock, 10),
          category: context,
          description: formData.name,
        },
        formData.image instanceof File ? formData.image : null,
        existingUrl
      )

      showSuccess('Sucesso', currentConfig.successMessage)
      safeNavigate(`${basePath}/products`)
    } catch (error) {
      console.error('Erro ao salvar produto:', error)
      showError('Erro', 'Erro ao salvar produto. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    safeNavigate(`${basePath}/select`)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Header 
        title={currentConfig.title}
        subtitle={currentConfig.subtitle}
        showLogo={false}
      />

      {/* Formulário */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-yellow-200 p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Nome do Produto */}
          <div>
            <label htmlFor="name" className="block text-sm font-semibold text-black mb-2 font-cardinal">
              🏷️ {currentConfig.nameLabel}
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              required
              className="w-full px-4 py-3 border-2 border-emerald-200 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-colors duration-200 bg-white/90 font-farmhand"
              placeholder={currentConfig.namePlaceholder}
            />
          </div>

          {/* Valor, Quantidade e Imagem */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Coluna da esquerda: Upload de Imagem */}
            <div>
              <label htmlFor="image" className="block text-sm font-semibold text-black mb-2 font-cardinal">
                📸 Imagem do Produto <span className="text-gray-500 font-normal text-xs">(opcional)</span>
              </label>
              
              {!imagePreview ? (
                <div className="border-2 border-dashed border-emerald-300 rounded-lg p-4 text-center hover:border-emerald-500 transition-colors duration-200" style={{ height: '155px' }}>
                  <input
                    type="file"
                    id="image"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                  <label 
                    htmlFor="image" 
                    className="cursor-pointer flex flex-col items-center justify-center h-full"
                  >
                    <div className="text-4xl mb-2">📷</div>
                    <p className="text-black font-semibold mb-1 font-cardinal text-sm">
                      Clique para selecionar
                    </p>
                    <p className="text-xs text-gray-600 font-farmhand">
                      PNG, JPG ou WEBP
                    </p>
                  </label>
                </div>
              ) : (
                <div className="relative rounded-lg border-2 border-emerald-200 overflow-hidden" style={{ height: '155px' }}>
                  <img 
                    src={imagePreview} 
                    alt="Preview" 
                    className="w-full h-full object-contain"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="absolute top-2 right-2 bg-white hover:bg-red-50 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 border-2 border-red-500 hover:border-red-600 group"
                    style={{ 
                      width: '18px', 
                      height: '18px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      padding: 0
                    }}
                    title="Remover imagem"
                  >
                    <span className="text-red-500 group-hover:text-red-600 font-bold" style={{ fontSize: '14px', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      ✕
                    </span>
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 bg-white/90 px-2 py-1">
                    <p className="text-xs text-gray-600 font-farmhand truncate">
                      {getSelectedImageName()}
                    </p>
                  </div>
                </div>
              )}
            </div>
            {/* Coluna da direita: Valor e Quantidade */}
            <div className="space-y-6">
              <div>
                <label htmlFor="price" className="block text-sm font-semibold text-black mb-2 font-cardinal">
                  💰 Valor (R$)
                </label>
                <input
                  type="text"
                  id="price"
                  value={formData.price}
                  onChange={handlePriceChange}
                  required
                  className="w-full px-4 py-3 border-2 border-emerald-200 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-colors duration-200 bg-white/90 font-farmhand"
                  placeholder="0,00"
                />
              </div>

              <div>
                <label htmlFor="quantity" className="block text-sm font-semibold text-black mb-2 font-cardinal">
                  📦 Quantidade
                </label>
                <input
                  type="number"
                  id="stock"
                  value={formData.stock}
                  onChange={(e) => handleInputChange('stock', e.target.value)}
                  min="1"
                  required
                  className="w-full px-4 py-3 border-2 border-emerald-200 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-colors duration-200 bg-white/90 font-farmhand [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          {/* Botões */}
          <div className="flex space-x-4 pt-4">
            <Button
              type="button"
              onClick={handleCancel}
              variant="outline"
              size="lg"
              className="!text-black flex-1 bg-gradient-to-r from-ruby-600 to-ruby-700 hover:from-ruby-700 hover:to-ruby-800 font-cardinal"
              disabled={isLoading}
            >
              ❌ Cancelar
            </Button>
            <Button
              type="submit"
              size="lg"
              className="flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg hover:shadow-emerald-200 font-semibold font-cardinal"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="animate-spin mr-2">✨</span>
                  {isEditing ? 'Atualizando...' : 'Salvando...'}
                </>
              ) : (
                <>
                  {isEditing ? '💾 Atualizar' : '💾 Salvar'} {context === 'lojinha' ? 'Produto' : 'Item'}
                </>
              )}
            </Button>
          </div>
        </form>
      </div>

      {/* Dicas */}
      <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-4">
        <p className="text-black text-sm font-farmhand">
          💡 <strong>Dica:</strong> A imagem é opcional - se você não adicionar uma, será usada uma imagem padrão. 
          O valor será formatado automaticamente conforme você digita.
        </p>
      </div>
    </div>
  )
}

export default CreateProductPage

