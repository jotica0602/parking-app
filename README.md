# Parking API

API RESTful de parking: NestJS, PostgreSQL y MongoDB.

| Documento | Contenido |
|---|---|
| [Cómo ejecutar](docs/getting-started.md) | Arranque local, entorno y primer admin |
| [Cómo usar la API](docs/api.md) | Roles, endpoints y cuerpos |
| [Colección Postman](postman/Parking_API.postman_collection.json) | Todas las rutas, listas para importar |

## Arranque

Requisitos: Node.js 22+, Docker.

```bash
cp .env.example .env          # configura JWT_SECRET
docker compose up -d          # Postgres y Mongo
npm install
npm run migration:run         # crea las tablas
npm run start:dev
```

API: `http://localhost:3000/api` (`curl` → `I'm alive!`).

## Migraciones

La primera vez, o si cambias una entidad: genera y luego corre.

```bash
npm run migration:generate -- src/migrations/NombreDelCambio
npm run migration:run
```

Si ya existen archivos en `src/migrations/`, basta con `migration:run`. `start:dev` aplica las pendientes al arrancar.

Más detalle: [Cómo ejecutar](docs/getting-started.md).
