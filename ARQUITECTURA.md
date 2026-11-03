# Diagrama de arquitectura — asisbot22

```mermaid
graph TD
    A[Next.js App] --> B[app/api/ routes]
    A --> C[src/components/asisbot/]
    A --> D[src/components/ui/ shadcn]
    B --> E[Prisma Client]
    E --> F[DB SQLite / PostgreSQL]
    C --> G[PanelEnVivo.tsx]
    C --> H[ZonasView / MapView]
    C --> I[Trabajadores / Alertas]
    C --> J[MandantePortal]
    A --> K[Hooks use-mobile / use-toast]
```

Componentes clave:
- **App**: Next.js 14 + Tailwind + TypeScript
- **API**: `/api/consent`, `/corrections`, `/checkins`, `/zones`, `/workers`, `/dashboard`, `/reports`, `/alerts`, `/mandante`, `/demo`
- **DB**: Prisma (`prisma/`)
- **UI**: shadcn/radix + componentes asisbot
- **Asisbot**: gestión de asistencia (zonas, jornadas, simulador WhatsApp, mapa, reportes, portal mandante)
