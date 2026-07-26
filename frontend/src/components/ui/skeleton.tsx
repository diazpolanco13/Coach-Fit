import * as React from "react"

import { cn } from "@/lib/utils"

/** Bloque de carga. Se dibuja con la forma del contenido que va a sustituir:
 *  un rectángulo genérico avisa de que algo carga, pero uno con la silueta real
 *  evita el salto de layout cuando llegan los datos. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }
