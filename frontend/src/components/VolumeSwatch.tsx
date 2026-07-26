import { cn } from '@/lib/utils'

/** Muestra de dos tonos para las leyendas: enseña de una vez el color (el
 *  estado) y el corte sólido/claro (directo frente a indirecto). */
export function TwoTone({ fill, soft }: { fill: string; soft: string }) {
  return (
    <span aria-hidden className="flex h-1.5 w-4 overflow-hidden rounded-full">
      <span className={cn('h-full w-1/2', fill)} />
      <span className={cn('h-full w-1/2', soft)} />
    </span>
  )
}
