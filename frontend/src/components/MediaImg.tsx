export function MediaImg({
  image,
  gif,
  alt,
  className,
  preferGif = false,
}: {
  image?: string | null
  gif?: string | null
  alt: string
  className?: string
  preferGif?: boolean
}) {
  const primary = preferGif ? gif || image : image || gif
  const fallback = preferGif ? image : gif
  return (
    <img
      src={primary || ''}
      alt={alt}
      className={className}
      loading="lazy"
      onError={(e) => {
        const el = e.currentTarget
        if (fallback && el.src !== fallback && !el.dataset.fallback) {
          el.dataset.fallback = '1'
          el.src = fallback
        }
      }}
    />
  )
}
