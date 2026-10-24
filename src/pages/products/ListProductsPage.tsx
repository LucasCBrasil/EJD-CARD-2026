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
  
  const context: ProductCategory = location.pathname.startsWith('/lanchonete')
    ? 'lanchonete'
    : 'lojinha'
  const basePath = `/${context}`
  
  const [products, setProducts] = useState<Product[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [productToDelete, setProductToDelete] = useState<Product | null>(null)
  const itemsPerPage = 6

  // Configurações específicas por contexto
  const config = {
    lojinha: {
      title: 'Produtos da Lojinha',
      subtitle: 'Gerencie os produtos da lojinha',
      emptyMessage: 'Nenhum produto cadastrado na lojinha',
      deleteTitle: 'Excluir Produto',
      deleteMessage: 'Deseja realmente excluir este produto?'
    },
    lanchonete: {
      title: 'Cardápio da Lanchonete',
      subtitle: 'Gerencie os itens do cardápio',
      emptyMessage: 'Nenhum item cadastrado no cardápio',
      deleteTitle: 'Excluir Item',
      deleteMessage: 'Deseja realmente excluir este item do cardápio?'
    }
  }
  
  const currentConfig = config[context]
  const itemSingular = context === 'lojinha' ? 'produto' : 'item'
  const itemSingularTitle = context === 'lojinha' ? 'Produto' : 'Item'

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
        setIsLoading(false)
        return
      }
      
      try {
        const success = await productService.deleteProduct(context, productId)
        if (success) {
          // Pequeno delay para garantir que a atualização no banco foi processada
          await new Promise(resolve => setTimeout(resolve, 300))
          
          // Forçar recarregamento dos produtos
          await loadProducts()
          
          // Remover o produto da lista localmente também (otimização)
          setProducts(prev => prev.filter(p => p.id !== productId))
          
          showSuccess('Sucesso', context === 'lojinha' ? 'Produto excluído com sucesso!' : 'Item excluído com sucesso!')
          setProductToDelete(null)
        } else {
          showError('Erro', 'Falha ao excluir item.')
        }
      } catch (error) {
        console.error('Erro ao excluir produto:', error)
        showError('Erro', 'Falha ao excluir item.')
      } finally {
        setIsLoading(false)
      }
    }
  }

  const handleCancelDelete = () => {
    setProductToDelete(null)
    showInfo('Cancelado', 'Exclusão cancelada.')
  }

  const formatPrice = (price: number): string => {
    return price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const getDefaultImage = (context: 'lojinha' | 'lanchonete'): string => {
    const labels = {
      lanchonete: { title: 'Item sem imagem', sub: 'Cardápio da Lanchonete', icon: '☕' },
      lojinha: { title: 'Produto sem imagem', sub: 'Lojinha', icon: '🚂' }
    }[context]
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
        <rect width="400" height="400" fill="#fcf0d8"/>
        <circle cx="200" cy="170" r="90" fill="#e6cdb0" opacity="0.6"/>
        <text x="200" y="200" font-size="80" text-anchor="middle">${labels.icon}</text>
        <rect x="40" y="282" width="320" height="4" fill="#48240c"/>
        <rect x="40" y="298" width="320" height="4" fill="#48240c"/>
        ${Array.from({ length: 12 }, (_, i) => `<rect x="${46 + i * 27}" y="280" width="9" height="24" fill="#9c6048"/>`).join('')}
        <text x="200" y="345" font-size="22" text-anchor="middle" fill="#48240c" font-family="Arial" font-weight="bold">${labels.title}</text>
        <text x="200" y="370" font-size="15" text-anchor="middle" fill="#a83024" font-family="Arial">${labels.sub}</text>
      </svg>`
    return `data:image/svg+xml,${encodeURIComponent(svg)}`
  }

  const navBtn = 'px-3 py-2 bg-creme-200 hover:bg-creme-300 text-ferro-800 border border-ferro-200 font-display text-sm rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors'

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
        <div className="painel p-8 md:p-12 text-center">
          <div className="text-5xl mb-3">🚉</div>
          <h3 className="text-xl md:text-2xl font-display font-semibold uppercase tracking-wide text-ferro-900 mb-2">
            {currentConfig.emptyMessage}
          </h3>
          <p className="text-ferro-600 mb-6">
            Comece cadastrando seu primeiro {itemSingular}!
          </p>
          <button
            onClick={() => navigate({ to: `${basePath}/products/create` as any, search: {} as any })}
            className="px-8 py-3 text-lg font-display font-semibold tracking-wide rounded-xl shadow-sm transition-colors bg-vagao-600 hover:bg-vagao-700 text-creme-50"
          >
            + Cadastrar {itemSingularTitle}
          </button>
        </div>
      ) : (
        <>
          {/* Grid de Produtos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {currentProducts.map((product, index) => {
              const productKey = product.id ?? `product-${index}`
              const src = product.image_url || (product as any).image || getDefaultImage(context)
              const stockColor = product.stock > 10 ? 'text-green-700' : product.stock > 5 ? 'text-latao-700' : 'text-vagao-600'
              return (
                <div
                  key={productKey}
                  className="bg-creme-50 rounded-xl border-2 border-ferro-800 overflow-hidden shadow-sm hover:shadow-bilhete transition-shadow duration-300"
                >
                  <OptimizedImage
                    src={src}
                    alt={product.name}
                    className="h-44 bg-creme-200"
                    context={context}
                  />
                  {/* Informações do Produto */}
                  <div className="picote-horizontal p-4">
                    <h3 className="text-lg font-display font-semibold text-ferro-900 mb-2 truncate" title={product.name}>
                      {product.name}
                    </h3>
                    
                    <div className="bg-creme-100 border border-ferro-200 rounded-xl px-3 py-2 space-y-1 mb-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-ferro-500">Preço</span>
                        <span className="font-slab text-lg text-vagao-600">
                          R$ {formatPrice(product.price)}
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-ferro-500">Quantidade</span>
                        <span className={`font-ticket font-bold ${stockColor}`}>
                          {product.stock}
                        </span>
                      </div>
                    </div>

                    {/* Botões de Ação */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(product)}
                        className="flex-1 px-3 py-2 rounded-lg font-display font-semibold tracking-wide transition-colors bg-ferro-800 hover:bg-ferro-700 text-creme-200"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDeleteClick(product)}
                        className="flex-1 px-3 py-2 rounded-lg font-display font-semibold tracking-wide transition-colors bg-creme-200 hover:bg-vagao-50 text-vagao-600 border-2 border-vagao-600"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex flex-wrap justify-center items-center gap-2 mt-8">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className={navBtn}
              >
                ← Anterior
              </button>

              <div className="flex gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    data-btn-type="page-number"
                    data-active={currentPage === page ? "true" : "false"}
                    className="w-10 h-10 !p-0 flex items-center justify-center rounded-lg font-display transition-colors border border-ferro-200"
                  >
                    {page}
                  </button>
                ))}
              </div>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className={navBtn}
              >
                Próximo →
              </button>
            </div>
          )}

          {/* Informações de Paginação */}
          <div className="text-center text-sm text-ferro-500">
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
