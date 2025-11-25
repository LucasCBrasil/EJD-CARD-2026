import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from '@tanstack/react-router'
import { Header, ConfirmationModal } from '../../components/shared'
import { useToastContext } from '../../contexts/ToastContext'
import { productService, type Product } from '../../services/productService'
import OptimizedImage from '../../components/ui/OptimizedImage';
import type { ProductCategory } from '../../types'

const ListProductsPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { showSuccess, showError, showInfo } = useToastContext()
  
  const context: ProductCategory = location.pathname.startsWith('/sapatinho-veloz')
    ? 'sapatinho'
    : location.pathname.startsWith('/lanchonete')
      ? 'lanchonete'
      : 'lojinha'
  const basePath = context === 'sapatinho' ? '/sapatinho-veloz' : `/${context}`
  
  const [products, setProducts] = useState<Product[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [productToDelete, setProductToDelete] = useState<Product | null>(null)
  const itemsPerPage = 6

  // Configurações específicas por contexto
  const config = {
    lojinha: {
      title: '📋 Listar Produtos',
      subtitle: 'Gerencie os produtos da lojinha',
      emptyMessage: 'Nenhum produto cadastrado na lojinha',
      deleteTitle: 'Excluir Produto',
      deleteMessage: 'Deseja realmente excluir este produto?'
    },
    lanchonete: {
      title: '📋 Listar Cardápio',
      subtitle: 'Gerencie os itens do cardápio',
      emptyMessage: 'Nenhum item cadastrado no cardápio',
      deleteTitle: 'Excluir Item',
      deleteMessage: 'Deseja realmente excluir este item do cardápio?'
    },
    sapatinho: {
      title: '👠 Itens do Sapatinho velOz',
      subtitle: 'Gerencie os itens mágicos disponíveis',
      emptyMessage: 'Nenhum item cadastrado para o Sapatinho',
      deleteTitle: 'Excluir Item',
      deleteMessage: 'Deseja realmente excluir este item do Sapatinho?'
    }
  }
  
  const currentConfig = config[context]
  const itemSingular = context === 'lojinha' ? 'produto' : context === 'sapatinho' ? 'item' : 'item'
  const itemSingularTitle = context === 'lojinha' ? 'Produto' : context === 'sapatinho' ? 'Item' : 'Item'

  // Carregar produtos
  useEffect(() => {
    loadProducts()
    // Resetar para a primeira página ao mudar de contexto
    setCurrentPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context])

  const loadProducts = async () => {
    // Inicializar produtos mock se não houver produtos
    const loadedProducts = await productService.getProducts(context)
    setProducts(loadedProducts ?? [])
    // Resetar para a primeira página ao recarregar produtos
    setCurrentPage(1)
  }

  // Calcular paginação
  const totalPages = Math.ceil(products.length / itemsPerPage)
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentProducts = products.slice(indexOfFirstItem, indexOfLastItem)

  // Verificar se a página atual é válida
  useEffect(() => {
    if (products.length > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [products.length, currentPage, totalPages])

  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleEdit = (product: Product) => {
    if (product.id) {
      navigate({ to: `${basePath}/products/${product.id}/edit` as any, search: {} as any })
    } else {
      showError('Erro', 'ID do produto não encontrado')
    }
  }

  const handleDeleteClick = (product: Product) => {
    setProductToDelete(product)
  }

  const handleConfirmDelete = async () => {
    setIsLoading(true)
    if (productToDelete) {
      const productId = productToDelete.id
      if (!productId) {
        showError('Erro', 'ID do produto não encontrado')
        setProductToDelete(null)
        return
      }
      const success = await productService.deleteProduct(context, productId)
      if (success) {
        await loadProducts()
        showSuccess('Sucesso', context === 'lojinha' ? 'Produto excluído com sucesso!' : 'Item excluído com sucesso!')
        setProductToDelete(null)
      } else {
        showError('Erro', 'Falha ao excluir item.')
      }
      setIsLoading(false)
    }
  }

  const handleCancelDelete = () => {
    setProductToDelete(null)
    showInfo('Cancelado', 'Exclusão cancelada.')
  }

  const formatPrice = (price: number): string => {
    return price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const getDefaultImage = (context: 'lojinha' | 'lanchonete' | 'sapatinho'): string => {
    let svg: string
    switch (context) {
      case 'lanchonete':
      svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
          <rect width="400" height="400" fill="#fef9c3"/>
          <circle cx="200" cy="180" r="110" fill="#fde047" opacity="0.6"/>

          <!-- Copo de refrigerante -->
          <g transform="translate(140,120)">
            <rect x="0" y="0" width="40" height="70" rx="5" fill="#60a5fa" stroke="#1e3a8a" stroke-width="3"/>
            <rect x="8" y="-12" width="24" height="12" rx="3" fill="#1e3a8a"/>
            <rect x="17" y="-25" width="6" height="15" fill="#1e3a8a"/>
            <circle cx="20" cy="35" r="5" fill="#bfdbfe" opacity="0.8"/>
          </g>

          <!-- Hambúrguer -->
          <g transform="translate(210,200)">
            <ellipse cx="0" cy="35" rx="65" ry="18" fill="#78350f"/>
            <rect x="-65" y="10" width="130" height="20" fill="#22c55e"/>
            <ellipse cx="0" cy="5" rx="65" ry="18" fill="#facc15"/>
            <ellipse cx="0" cy="-10" rx="65" ry="18" fill="#fcd34d"/>
          </g>

          <!-- Batata -->
          <g transform="translate(280,150) rotate(10)">
            <rect x="-20" y="0" width="40" height="50" rx="5" fill="#f87171"/>
            <rect x="-12" y="-20" width="24" height="20" fill="#fbbf24" rx="2"/>
            <rect x="-10" y="-25" width="4" height="25" fill="#fde68a"/>
            <rect x="0" y="-25" width="4" height="25" fill="#fde68a"/>
            <rect x="10" y="-25" width="4" height="25" fill="#fde68a"/>
          </g>

          <text x="200" y="320" font-size="22" text-anchor="middle" fill="#78350f" font-family="Arial" font-weight="bold">
            Item sem imagem
          </text>
          <text x="200" y="345" font-size="16" text-anchor="middle" fill="#92400e" font-family="Arial">
            Cardápio da Lanchonete
          </text>
        </svg>`
      break

      case 'sapatinho':
        svg = `
          <svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
            <defs>
              <linearGradient id="gradSapatinho1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#fbcfe8;stop-opacity:0.3" />
                <stop offset="100%" style="stop-color:#f472b6;stop-opacity:0.4" />
              </linearGradient>
              <linearGradient id="gradSapatinho2" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:#ec4899;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#db2777;stop-opacity:1" />
              </linearGradient>
            </defs>
            <rect width="400" height="400" fill="url(#gradSapatinho1)"/>
            <g transform="translate(200,210) rotate(-10)">
              <path d="M -90 30 C -60 -10, -20 -30, 40 -20 C 80 -10, 110 20, 90 50 C 60 90, 0 120, -40 110 C -80 100, -110 70, -90 30 Z" fill="url(#gradSapatinho2)"/>
            </g>
            <text x="200" y="320" font-size="18" text-anchor="middle" fill="#db2777" font-family="Arial" font-weight="600">
              Item especial do Sapatinho
            </text>
            <text x="200" y="345" font-size="14" text-anchor="middle" fill="#6b7280" font-family="Arial">
              Imagem não disponível
            </text>
          </svg>`
        break

      default:
        svg = `
          <svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
            <rect width="400" height="400" fill="#f0f9ff"/>
            <circle cx="200" cy="200" r="100" fill="#38bdf8" opacity="0.3"/>
            <text x="200" y="215" font-size="20" text-anchor="middle" fill="#0369a1" font-family="Arial" font-weight="bold">
              Produto sem imagem
            </text>
            <text x="200" y="245" font-size="14" text-anchor="middle" fill="#0284c7" font-family="Arial">
              Lojinha
            </text>
          </svg>`
        break
    }
    return `data:image/svg+xml,${encodeURIComponent(svg)}`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Header 
        title={currentConfig.title}
        subtitle={currentConfig.subtitle}
        showLogo={false}
      />

      {/* Lista de Produtos */}
      {products.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-yellow-200 p-12 text-center">
          <div className="text-6xl mb-4">📦</div>
          <h3 className="text-2xl font-bold text-gray-600 mb-4 font-cardinal">
            {currentConfig.emptyMessage}
          </h3>
          <p className="text-gray-500 mb-6 font-farmhand">
            Comece cadastrando seu primeiro {itemSingular}!
          </p>
          <button
            onClick={() => navigate({ to: `${basePath}/products/create` as any, search: {} as any })}
            className="px-8 py-4 text-lg font-semibold rounded-lg shadow-lg transition-all duration-200 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-black hover:shadow-xl"
          >
            ➕ Cadastrar {itemSingularTitle}
          </button>
        </div>
      ) : (
        <>
          {/* Grid de Produtos */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {currentProducts.map((product, index) => {
              const productKey = product.id ?? `product-${index}`
              const src = product.image_url || (product as any).image || getDefaultImage(context)
              return (
                <div
                  key={productKey}
                  className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-yellow-200 overflow-hidden hover:shadow-2xl transition-shadow duration-300"
                >
                  <OptimizedImage
                    src={src}
                    alt={product.name}
                    className="h-48 bg-gradient-to-br from-gray-100 to-gray-200"
                    context={context}
                  />
                  {/* Informações do Produto */}
                  <div className="p-4">
                    <h3 className="text-lg font-bold text-emerald-600 mb-2 font-cardinal truncate" title={product.name}>
                      {product.name}
                    </h3>
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 font-farmhand">💰 Preço:</span>
                        <span className="text-lg font-bold text-sky-900 font-cardinal">
                          R$ {formatPrice(product.price)}
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 font-farmhand">📦 Quantidade:</span>
                        <span className={`font-bold font-cardinal ${product.stock > 10 ? 'text-emerald-600' : product.stock > 5 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {product.stock}
                        </span>
                      </div>
                    </div>

                    {/* Botões de Ação */}
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEdit(product)}
                        className="flex-1 px-4 py-2 rounded-lg font-semibold shadow-lg transition-all duration-200 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white hover:shadow-xl"
                      >
                        ✏️ Editar
                      </button>
                      <button
                        onClick={() => handleDeleteClick(product)}
                        className="flex-1 px-4 py-2 rounded-lg font-semibold shadow-lg transition-all duration-200 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white hover:shadow-xl"
                      >
                        🗑️ Excluir
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
              <div 
                className="
                  flex justify-center items-center gap-2 pt-4 
                  max-[413px]:gap-1    /* gaps menores no mobile */
                "
              >
                {/* Botão Anterior */}
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className={`
                    px-4 py-2 
                    ${context === 'lojinha' 
                      ? 'bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300' 
                      : 'bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300'
                    } 
                    text-white font-semibold rounded-lg disabled:cursor-not-allowed transition-colors

                    /* 👇 Estilos mobile */
                    max-[413px]:!px-2
                    max-[413px]:!py-2
                    max-[413px]:!text-xs
                    max-[413px]:!rounded-md
                  `}
                >
                  ← Anterior
                </button>

                {/* Botões de página */}
                <div className="flex gap-1 max-[413px]:gap-0.5">
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const page = i + 1
                    const isActive = currentPage === page

                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`
                          w-10 h-10 rounded-lg font-bold transition-colors
                          ${isActive
                            ? context === 'lojinha'
                              ? 'bg-blue-500 text-white'
                              : 'bg-orange-500 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }
                          max-[413px]:!w-7
                          max-[413px]:!h-9
                          max-[413px]:!text-xs
                          max-[413px]:!rounded
                        `}
                      >
                        {page}
                      </button>
                    )
                  })}
                </div>

                {/* Botão Próximo */}
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className={`
                    px-4 py-2
                    ${context === 'lojinha' 
                      ? 'bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300' 
                      : 'bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300'
                    }
                    text-white font-semibold rounded-lg disabled:cursor-not-allowed transition-colors

                    /* 👇 Estilos mobile */
                    max-[413px]:!px-2
                    max-[413px]:!py-2
                    max-[413px]:!text-xs
                    max-[413px]:!rounded-md
                  `}
                >
                  Próximo →
                </button>
              </div>
            )}
            
          {/* Informações de Paginação */}
          <div className="text-center text-gray-600 font-farmhand">
            Mostrando {indexOfFirstItem + 1} - {Math.min(indexOfLastItem, products.length)} de {products.length} {context === 'lojinha' ? 'produtos' : 'itens'}
          </div>
        </>
      )}

      {/* Modal de Confirmação de Exclusão */}
      <ConfirmationModal
        isOpen={!!productToDelete}
        onClose={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        title={currentConfig.deleteTitle}
        icon="⚠️"
        message={currentConfig.deleteMessage}
        variant="delete-product"
        product={productToDelete ? {
          id: String(productToDelete.id),
          name: productToDelete.name,
          price: productToDelete.price,
          stock: productToDelete.stock,
          description: productToDelete.description,
          image_url: productToDelete.image_url || null
        } : null}
        isLoading={isLoading}
      />
    </div>
  )
}

export default ListProductsPage

