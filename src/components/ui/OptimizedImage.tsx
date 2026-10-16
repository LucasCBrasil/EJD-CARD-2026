import { useState, useEffect } from 'react';

type OptimizedContext = 'lojinha' | 'lanchonete'

interface OptimizedImageProps {
  src: string | null;
  alt: string;
  className?: string;
  context: OptimizedContext;
}

const OptimizedImage: React.FC<OptimizedImageProps> = ({ src, alt, className, context }) => {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  const getDefaultImage = (): string => {
    const rail = `
        <g opacity="0.55">
          <rect x="40" y="368" width="320" height="5" fill="#48240c"/>
          <rect x="40" y="384" width="320" height="5" fill="#48240c"/>
          <rect x="52" y="362" width="12" height="32" fill="#9c6048"/>
          <rect x="100" y="362" width="12" height="32" fill="#9c6048"/>
          <rect x="148" y="362" width="12" height="32" fill="#9c6048"/>
          <rect x="196" y="362" width="12" height="32" fill="#9c6048"/>
          <rect x="244" y="362" width="12" height="32" fill="#9c6048"/>
          <rect x="292" y="362" width="12" height="32" fill="#9c6048"/>
          <rect x="340" y="362" width="12" height="32" fill="#9c6048"/>
        </g>`

    const svg = context === 'lanchonete' 
      ? `
      <svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
        <rect width="400" height="400" fill="#fcf0d8"/>
        <circle cx="200" cy="170" r="110" fill="#fea72a" opacity="0.25"/>

        <!-- Copo -->
        <g transform="translate(130,110)">
          <rect x="0" y="0" width="44" height="76" rx="6" fill="#a83024" stroke="#48240c" stroke-width="3"/>
          <rect x="8" y="-12" width="28" height="12" rx="3" fill="#48240c"/>
          <rect x="19" y="-28" width="6" height="18" fill="#48240c"/>
          <rect x="8" y="28" width="28" height="10" rx="2" fill="#fcf0d8" opacity="0.8"/>
        </g>

        <!-- Hambúrguer -->
        <g transform="translate(230,200)">
          <ellipse cx="0" cy="30" rx="62" ry="16" fill="#9c6048" stroke="#48240c" stroke-width="3"/>
          <rect x="-62" y="8" width="124" height="16" rx="4" fill="#63341f"/>
          <ellipse cx="0" cy="-8" rx="62" ry="26" fill="#fc9000" stroke="#48240c" stroke-width="3"/>
        </g>

        <text x="200" y="308" font-size="22" text-anchor="middle" fill="#48240c" font-family="Arial" font-weight="bold">
          Item sem imagem
        </text>
        <text x="200" y="334" font-size="15" text-anchor="middle" fill="#9c6048" font-family="Arial">
          Vagão-restaurante · Lanchonete
        </text>
${rail}
      </svg>`
      : `
      <svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
        <rect width="400" height="400" fill="#fcf0d8"/>
        <circle cx="200" cy="170" r="110" fill="#004878" opacity="0.12"/>

        <!-- Mala de viagem -->
        <g transform="translate(200,180)">
          <path d="M -28 -45 L -28 -62 Q -28 -70 -20 -70 L 20 -70 Q 28 -70 28 -62 L 28 -45" fill="none" stroke="#48240c" stroke-width="6"/>
          <rect x="-75" y="-45" width="150" height="110" rx="12" fill="#9c6048" stroke="#48240c" stroke-width="4"/>
          <rect x="-75" y="0" width="150" height="8" fill="#48240c"/>
          <rect x="-45" y="-45" width="10" height="110" fill="#fc9000"/>
          <rect x="35" y="-45" width="10" height="110" fill="#fc9000"/>
        </g>

        <text x="200" y="308" font-size="20" text-anchor="middle" fill="#48240c" font-family="Arial" font-weight="bold">
          Produto sem imagem
        </text>
        <text x="200" y="334" font-size="15" text-anchor="middle" fill="#004878" font-family="Arial">
          Lojinha
        </text>
${rail}
      </svg>`
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  };

  useEffect(() => {
    if (!src) {
      setImageUrl(getDefaultImage());
      setIsLoading(false);
      return;
    }

    // Usar a URL diretamente - deixar o navegador lidar com o carregamento
    setImageUrl(src);
    setIsLoading(false);
  }, [src]);

  return (
    <div className={`relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-creme-200">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ferro-500" />
        </div>
      )}
      <img
        src={imageUrl}
        alt={alt}
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          isLoading ? 'opacity-0' : 'opacity-100'
        }`}
        loading="lazy"
        onError={(e) => {
          const target = e.target as HTMLImageElement;
          // Só trocar para fallback se não for já o fallback
          if (target.src !== getDefaultImage()) {
            target.onerror = null;
            target.src = getDefaultImage();
          }
        }}
        onLoad={() => setIsLoading(false)}
      />
    </div>
  );
};

export default OptimizedImage;