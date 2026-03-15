# Correction — Exercice 43 : CDN & image pipeline

## Pipeline de processing

```typescript
// image-processor.service.ts
import sharp from 'sharp';

interface ImageVariant {
  size: 'thumbnail' | 'medium' | 'large' | 'original';
  width: number | null;
  formats: Array<'jpeg' | 'webp' | 'avif'>;
}

const VARIANTS: ImageVariant[] = [
  { size: 'thumbnail', width: 150, formats: ['jpeg', 'webp', 'avif'] },
  { size: 'medium', width: 600, formats: ['jpeg', 'webp', 'avif'] },
  { size: 'large', width: 1200, formats: ['jpeg', 'webp', 'avif'] },
  { size: 'original', width: null, formats: ['jpeg'] },
];

@Processor('image-processing')
export class ImageProcessor {
  @Process('resize')
  async process(job: Job<{ tenantId: string; productId: string; s3Key: string }>) {
    const { tenantId, productId, s3Key } = job.data;

    // Telecharger l'original depuis S3
    const original = await this.s3.getObject(s3Key);
    const buffer = Buffer.from(await original.Body!.transformToByteArray());

    // Generer le blur hash
    const blurHash = await this.generateBlurHash(buffer);

    const results: Array<{ size: string; format: string; key: string; bytes: number }> = [];

    for (const variant of VARIANTS) {
      for (const format of variant.formats) {
        let pipeline = sharp(buffer);

        if (variant.width) {
          pipeline = pipeline.resize(variant.width, null, {
            fit: 'inside',
            withoutEnlargement: true,
          });
        }

        // Conversion format
        if (format === 'webp') pipeline = pipeline.webp({ quality: 80 });
        else if (format === 'avif') pipeline = pipeline.avif({ quality: 65 });
        else pipeline = pipeline.jpeg({ quality: 85, progressive: true });

        const output = await pipeline.toBuffer();
        const key = `${tenantId}/products/${productId}/${variant.size}.${format}`;

        await this.s3.putObject({
          Key: key,
          Body: output,
          ContentType: `image/${format}`,
          CacheControl: 'public, max-age=31536000, immutable',
        });

        results.push({ size: variant.size, format, key, bytes: output.byteLength });

        job.progress((results.length / (VARIANTS.length * 3)) * 100);
      }
    }

    // Sauvegarder les metadonnees
    await this.imageRepo.update(
      { productId, tenantId },
      { variants: results, blurHash, processingStatus: 'completed' },
    );
  }

  private async generateBlurHash(buffer: Buffer): Promise<string> {
    const { data, info } = await sharp(buffer)
      .resize(32, 32, { fit: 'inside' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Encode en base83 (blurhash format)
    return encode(new Uint8ClampedArray(data), info.width, info.height, 4, 3);
  }
}
```

## Upload avec presigned URL

```typescript
// image-upload.controller.ts
@Post('products/:productId/images/presign')
async getPresignedUrl(
  @Param('productId', ParseUUIDPipe) productId: string,
  @TenantId() tenantId: string,
  @Body() dto: PresignUploadDto,
) {
  // Valider le content-type
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  if (!ALLOWED_TYPES.includes(dto.contentType)) {
    throw new BadRequestException('Format non supporte');
  }

  const key = `${tenantId}/products/${productId}/original-${randomUUID()}`;

  const presigned = await this.s3.createPresignedPost({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Conditions: [
      ['content-length-range', 0, 20 * 1024 * 1024], // Max 20 MB
      ['eq', '$Content-Type', dto.contentType],
    ],
    Expires: 300, // 5 min
  });

  // Creer le job de processing (sera execute apres l'upload)
  await this.imageQueue.add('resize', {
    tenantId, productId, s3Key: key,
  }, { delay: 5000 }); // attendre que l'upload soit termine

  return { presigned, key };
}
```

## Composant responsive images

```tsx
// ProductImage.tsx
import { useState, useMemo, type CSSProperties } from 'react';

interface ProductImageProps {
  productId: string;
  alt: string;
  blurHash?: string;
  priority?: boolean; // true pour LCP image
  sizes?: string;
}

const CDN_BASE = 'https://cdn.shoparch.com/img';

export function ProductImage({
  productId,
  alt,
  blurHash,
  priority = false,
  sizes,
}: ProductImageProps) {
  const [loaded, setLoaded] = useState(false);

  const defaultSizes = sizes ?? '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw';

  const srcset = (format: string) =>
    [150, 600, 1200]
      .map((w) => {
        const size = w <= 150 ? 'thumbnail' : w <= 600 ? 'medium' : 'large';
        return `${CDN_BASE}/${productId}/${size}.${format} ${w}w`;
      })
      .join(', ');

  // LQIP via CSS blur sur un tiny placeholder
  const blurStyle = useMemo<CSSProperties>(() => {
    if (!blurHash) return {};
    return {
      backgroundImage: `url(data:image/svg+xml;base64,${btoa(blurHashToSvg(blurHash))})`,
      backgroundSize: 'cover',
    };
  }, [blurHash]);

  return (
    <div className="product-image" style={blurStyle}>
      <picture>
        {/* AVIF (le plus petit, support moderne) */}
        <source type="image/avif" srcSet={srcset('avif')} sizes={defaultSizes} />
        {/* WebP (bon support, plus petit que JPEG) */}
        <source type="image/webp" srcSet={srcset('webp')} sizes={defaultSizes} />
        {/* JPEG fallback */}
        <img
          src={`${CDN_BASE}/${productId}/medium.jpeg`}
          srcSet={srcset('jpeg')}
          sizes={defaultSizes}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding={priority ? 'sync' : 'async'}
          width={600}
          height={600}
          onLoad={() => setLoaded(true)}
          className={loaded ? 'product-image__img--loaded' : undefined}
        />
      </picture>
    </div>
  );
}
```

```css
/* product-image.module.css (ou CSS global) */
.product-image {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
}
.product-image__img--loaded {
  animation: fadeIn 0.3s ease-in;
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

## Validation MIME réelle

```typescript
// mime-validator.ts
import { fileTypeFromBuffer } from 'file-type';

async function validateImageMime(buffer: Buffer): Promise<string> {
  const type = await fileTypeFromBuffer(buffer);

  if (!type || !['image/jpeg', 'image/png', 'image/webp'].includes(type.mime)) {
    throw new BadRequestException('Type de fichier non autorise');
  }

  return type.mime;
}
```

## Ce que tu aurais pu oublier

### 1. Resize synchrone dans la requête HTTP
```
FAUX — sharp.resize() dans le controller (bloque la requete pendant 5-10s)
CORRECT — upload vers S3 + job queue pour le processing asynchrone
         Retourner un statut "processing" et notifier quand c'est pret
```

### 2. Pas de width/height sur <img>
```
FAUX — <img> sans dimensions (cause du CLS quand l'image charge)
CORRECT — width et height fixes + aspect-ratio CSS
         Le navigateur reserve l'espace avant le chargement
```

### 3. LCP image en lazy loading
```
FAUX — loading="lazy" sur l'image hero (le LCP attend l'intersection observer)
CORRECT — loading="eager" + fetchpriority="high" pour l'image LCP
         Lazy loading uniquement pour les images below the fold
```

### 4. Un seul format
```
FAUX — servir uniquement du JPEG (3x plus lourd que AVIF)
CORRECT — <picture> avec AVIF > WebP > JPEG fallback
         Economie de 50-70% de bande passante
```
