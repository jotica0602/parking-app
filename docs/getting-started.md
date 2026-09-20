# Cómo ejecutar

## Requisitos

- Node.js 22+
- Docker y Docker Compose

## Arranque

```bash
cp .env.example .env
docker compose up -d
npm install
npm run migration:run
npm run start:dev
```

La API queda en `http://localhost:3000/api`. Comprueba con `curl http://localhost:3000/api` (`I'm alive!`).

Copia [`.env.example`](../.env.example) a `.env` y cambia `JWT_SECRET`.

| | PostgreSQL | MongoDB (logs) |
|---|---|---|
| Desarrollo | `parking_db` en el puerto **5433** | `parking_logs` en el puerto **27017** |
| Tests | `parking_db_test` en **5434** | `parking_logs_test` en **27018** |

El esquema de PostgreSQL va por migraciones. `start:dev` aplica las pendientes al arrancar.

## Primer admin

Al arrancar, la API crea (o actualiza) el administrador definido en `.env`:

```
ADMIN_NAME=Admin
ADMIN_EMAIL=admin@parking.test
ADMIN_PASSWORD=Password123!
```

Entra con `POST /api/auth/login` usando ese email y contraseña. Si cambias `ADMIN_PASSWORD` y reinicias, el login usa la nueva clave.

`POST /api/auth/register` sigue creando solo `client`. Un admin crea empleados y otros admins con `POST /api/users`.

## Scripts

| Script | Uso |
|---|---|
| `npm run start:dev` | API en modo watch |
| `npm run migration:run` | Aplicar migraciones (`.env`) |
| `npm run test:e2e` | Tests (`.env.test`) |

Cómo llamar a la API: [Referencia](api.md). Colección Postman: [postman/Parking_API.postman_collection.json](../postman/Parking_API.postman_collection.json).
