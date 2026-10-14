import { useNavigate, useLocation } from '@tanstack/react-router'
import { Card, Header } from '../../components/shared'
import type { ProductCategory } from '../../types'

const ProductsPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  
  const context: ProductCategory = location.pathname.startsWith('/sapatinho-veloz')
    ? 'sapatinho'
    : location.pathname.startsWith('/lanchonete')
      ? 'lanchonete'
      : 'lojinha'
  const basePath = context === 'sapatinho' ? '/sapatinho-veloz' : `/${context}`
  
  // Configurações específicas por contexto
  const config = {
    lojinha: {
      title: 'Produtos da Lojinha',
      createLabel: 'Cadastrar Produto',
      listLabel: 'Listar Produtos',
      createDescription: 'Adicione novos produtos da lojinha',
      listDescription: 'Visualize todos os produtos da lojinha',
      selectDescription: 'Cadastre, edite e visualize produtos da lojinha'
    },
    lanchonete: {
      title: 'Cardápio da Lanchonete',
      createLabel: 'Cadastrar Item',
      listLabel: 'Listar Cardápio',
      createDescription: 'Adicione novos itens ao cardápio',
      listDescription: 'Visualize todos os itens do cardápio',
      selectDescription: 'Cadastre, edite e visualize itens da lanchonete'
    },
    sapatinho: {
      title: 'Itens do Sapatinho Veloz',
      createLabel: 'Cadastrar Item',
      listLabel: 'Listar Itens',
      createDescription: 'Adicione novos itens especiais ao Sapatinho Veloz',
      listDescription: 'Visualize os itens disponíveis',
      selectDescription: 'Gerencie os itens do Sapatinho Veloz'
    }
  }
  
  const currentConfig = config[context]

  const options = [
    {
      icon: '📦',
      label: currentConfig.createLabel,
      description: currentConfig.createDescription,
      path: `${basePath}/products/create`,
      buttonClass: 'bg-vagao-600 hover:bg-vagao-700 text-creme-50'
    },
    {
      icon: '📋',
      label: currentConfig.listLabel,
      description: currentConfig.listDescription,
      path: `${basePath}/products`,
      buttonClass: 'bg-ferro-800 hover:bg-ferro-700 text-creme-200'
    }
  ]
 
  return (
    <div className="space-y-6">
      <Header 
        title={currentConfig.title}
        subtitle={currentConfig.selectDescription}
        showLogo={false}
      />
      {/* Cards de Funcionalidades de Produtos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
        {options.map(option => (
          <Card
            key={option.path}
            className="hover:shadow-bilhete-hover hover:-translate-y-0.5 transition-all duration-300"
            onClick={() => navigate({ to: option.path as any, search: {} as any })}
          >
            <div className="text-center">
              <div className="text-5xl mb-3">{option.icon}</div>
              <h3 className="text-xl font-display font-semibold uppercase tracking-wide text-ferro-900 mb-2">
                {option.label}
              </h3>
              <p className="text-ferro-700 mb-5">
                {option.description}
              </p>
              <button
                type="button"
                className={`${option.buttonClass} w-full sm:w-auto font-display font-semibold tracking-wide px-8 py-3 rounded-xl shadow-sm transition-colors`}
                onClick={(event) => {
                  event.stopPropagation()
                  navigate({ to: option.path as any, search: {} as any })
                }}
              >
                {option.label} →
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

export default ProductsPage
