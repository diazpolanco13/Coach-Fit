import { useEffect, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/** Imagen del catálogo. Con `preferGif` muestra el still al instante y cambia
 *  al GIF cuando termina de bajar —sin hueco vacío entre skeleton y media. */
export function MediaImg({
  image,
  gif,
  alt,
  className,
  preferGif = false,
  /** Reserva sitio (p. ej. `min-h-56 w-full`) mientras llega el primer frame. */
  pendingClassName,
}: {
  image?: string | null
  gif?: string | null
  alt: string
  className?: string
  preferGif?: boolean
  pendingClassName?: string
}) {
  const still = image || null
  const animated = gif || null
  const bootstrap = preferGif ? still || animated : still || animated

  const [src, setSrc] = useState(bootstrap || '')
  const [painted, setPainted] = useState(false)

  useEffect(() => {
    const next = preferGif ? still || animated : still || animated
    setSrc(next || '')
    setPainted(false)
  }, [still, animated, preferGif])

  // Precarga el GIF en segundo plano; cuando esté, sustituye el still.
  useEffect(() => {
    if (!preferGif || !animated || !still) return
    let cancelled = false
    const pre = new window.Image()
    pre.onload = () => {
      if (cancelled) return
      setSrc(animated)
    }
    pre.src = animated
    return () => {
      cancelled = true
    }
  }, [preferGif, animated, still])

  if (!bootstrap) {
    return pendingClassName ? (
      <div className={cn('bg-muted', pendingClassName)} aria-hidden />
    ) : null
  }

  return (
    <span className={cn('relative block', pendingClassName)}>
      {!painted && (
        <Skeleton className="absolute inset-0 z-0 rounded-[inherit]" aria-hidden />
      )}
      <img
        src={src}
        alt={alt}
        className={cn(
          className,
          'relative z-[1] transition-opacity duration-200',
          painted ? 'opacity-100' : 'opacity-0',
        )}
        loading={preferGif ? 'eager' : 'lazy'}
        onLoad={() => setPainted(true)}
        onError={(e) => {
          const el = e.currentTarget
          const fallback = src === animated ? still : animated
          if (fallback && el.dataset.fallback !== '1') {
            el.dataset.fallback = '1'
            setPainted(false)
            setSrc(fallback)
          }
        }}
      />
    </span>
  )
}
