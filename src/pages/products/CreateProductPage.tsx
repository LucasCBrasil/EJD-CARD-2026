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
  
  const context: ProductCategory = location.pathname.startsWith('/lanchonete')
    ? 'lanchonete'
    : 'lojinha'
  const basePath = `/${context}`
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
      title: isEditing ? 'Editar Produto' : 'Cadastrar Produto',
      subtitle: isEditing ? 'Atualize as informações do produto' : 'Adicione um novo produto à lojinha',
      nameLabel: 'Nome do Produto',
      namePlaceholder: 'Ex: Camiseta EJD 25 Anos',
      successMessage: isEditing ? 'Produto atualizado com sucesso!' : 'Produto cadastrado com sucesso!'
    },
    lanchonete: {
      title: isEditing ? 'Editar Item' : 'Cadastrar Item',
      subtitle: isEditing ? 'Atualize as informações do item' : 'Adicione um novo item ao cardápio',
      nameLabel: 'Nome do Item',
      namePlaceholder: 'Ex: Hambúrguer da Estação',
      successMessage: isEditing ? 'Item atualizado com sucesso!' : 'Item cadastrado com sucesso!'
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
      const savedProduct = await productService.saveProduct(
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

      // Verificar se realmente foi salvo
      if (!savedProduct || !savedProduct.id) {
        throw new Error('Produto não foi salvo. Por favor, tente novamente.')
      }

      // Aguardar um pouco para garantir que o banco processou tudo
      await new Promise(resolve => setTimeout(resolve, 500))

      showSuccess('Sucesso', currentConfig.successMessage)
      safeNavigate(`${basePath}/products`)
    } catch (error: any) {
      console.error('Erro ao salvar produto:', error)
      const errorMessage = error?.message || 'Erro ao salvar produto. Por favor, verifique se o produto foi salvo e tente novamente se necessário.'
      showError('Erro', errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    safeNavigate(`${basePath}/select`)
  }

  const labelClass = 'block text-sm font-display font-semibold uppercase tracking-wide text-ferro-800 mb-2'

  return (
    <div className="space-y-6">
      {/* Header */}
      <Header 
        title={currentConfig.title}
        subtitle={currentConfig.subtitle}
        showLogo={false}
      />

      {/* Formulário */}
      <div className="painel p-5 md:p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Nome do Produto */}
          <div>
            <label htmlFor="name" className={labelClass}>
              {currentConfig.nameLabel}
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              required
              className="w-full"
              placeholder={currentConfig.namePlaceholder}
            />
          </div>

          {/* Valor, Quantidade e Imagem */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Coluna da esquerda: Upload de Imagem */}
            <div>
              <label htmlFor="image" className={labelClass}>
                Imagem do Produto <span className="text-ferro-500 font-body font-normal normal-case tracking-normal text-xs">(opcional)</span>
              </label>
              
              {!imagePreview ? (
                <div className="bg-creme-100 border-2 border-dashed border-ferro-300 rounded-xl p-4 text-center hover:border-ferro-500 hover:bg-creme-200 transition-colors duration-200" style={{ height: '155px' }}>
                  <input
                    type="file"
                    id="image"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                  <label 
                    htmlFor="image" 
                    className="cursor-pointer flex flex-col items-center justify-center h-full !m-0"
                  >
                    <div className="text-4xl mb-2">📷</div>
                    <p className="text-ferro-900 font-semibold mb-1 font-display text-sm">
                      Clique para selecionar
                    </p>
                    <p className="text-xs text-ferro-500 font-normal">
                      PNG, JPG ou WEBP
                    </p>
                  </label>
                </div>
              ) : (
                <div className="relative rounded-xl border-2 border-ferro-200 bg-creme-100 overflow-hidden" style={{ height: '155px' }}>
                  <img 
                    src={imagePreview} 
                    alt="Preview" 
                    className="w-full h-full object-contain"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="absolute top-2 right-2 w-8 h-8 !p-0 flex items-center justify-center rounded-full bg-creme-50 hover:bg-vagao-50 border-2 border-vagao-600 text-vagao-600 text-sm font-bold shadow-sm transition-colors"
                    title="Remover imagem"
                    aria-label="Remover imagem"
                  >
                    ✕
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 bg-creme-50/90 px-2 py-1">
                    <p className="text-xs text-ferro-700 truncate">
                      {getSelectedImageName()}
                    </p>
                  </div>
                </div>
              )}
            </div>
            {/* Coluna da direita: Valor e Quantidade */}
            <div className="space-y-6">
              <div>
                <label htmlFor="price" className={labelClass}>
                  Valor (R$)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  id="price"
                  value={formData.price}
                  onChange={handlePriceChange}
                  required
                  className="w-full font-slab"
                  placeholder="0,00"
                />
              </div>

              <div>
                <label htmlFor="quantity" className={labelClass}>
                  Quantidade
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  id="stock"
                  value={formData.stock}
                  onChange={(e) => handleInputChange('stock', e.target.value)}
                  min="1"
                  required
                  className="w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-3 pt-4 picote-horizontal">
            <Button
              type="button"
              onClick={handleCancel}
              variant="secondary"
              size="lg"
              className="flex-1 !px-3"
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="lg"
              className="flex-1 !px-3 !bg-vagao-600 hover:!bg-vagao-700 !border-vagao-600 !text-creme-50"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="inline-block animate-roda mr-2">⚙️</span>
                  {isEditing ? 'Atualizando...' : 'Salvando...'}
                </>
              ) : (
                <>
                  {isEditing ? 'Atualizar' : 'Salvar'} {context === 'lojinha' ? 'Produto' : 'Item'}
                </>
              )}
            </Button>
          </div>
        </form>
      </div>

      {/* Dicas */}
      <div className="bg-latao-50 border border-latao-300 rounded-xl p-4">
        <p className="text-ferro-800 text-sm">
          💡 <strong>Dica:</strong> A imagem é opcional - se você não adicionar uma, será usada uma imagem padrão. 
          O valor será formatado automaticamente conforme você digita.
        </p>
      </div>
    </div>
  )
}

export default CreateProductPage
