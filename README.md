# Parking API

API RESTful para la gestión de un parking. Construida con **NestJS** (Express), **PostgreSQL** (entidades de negocio) y **MongoDB** (logs de actividad).

Documentación de diseño: [docs/objetivos.md](docs/objetivos.md), [docs/arquitectura.md](docs/arquitectura.md), [docs/entidades.md](docs/entidades.md).

## Requisitos

- Node.js 22+
- Docker y Docker Compose (para PostgreSQL y MongoDB)

## Cómo ejecutar

```bash
cp .env.example .env
docker compose up -d
npm install
npm run start:dev
```

La API queda en `http://localhost:3000/api`.

Docker levanta **dos pares de bases**, para que desarrollo y tests no se pisen:

| Entorno | PostgreSQL | MongoDB |
|---|---|---|
| Desarrollo (`.env`) | `localhost:5433` / `parking` | `localhost:27017` / `parking_logs` |
| Tests (`.env.test`) | `localhost:5434` / `parking_test` | `localhost:27018` / `parking_logs_test` |

El 5432 del host suele estar ocupado por una instalación local de PostgreSQL; por eso el contenedor de desarrollo usa **5433**.

### Primer administrador

El registro público (`POST /api/auth/register`) siempre crea usuarios con rol `client`. Para promover el primer admin:

```bash
docker exec parking-postgres psql -U parking -d parking \
  -c "UPDATE users SET role = 'admin' WHERE email = 'tu-email@test.com';"
```

A partir de ahí, un admin puede crear empleados y otros admins con `POST /api/users`.

## Roles

| Rol | Capacidad principal |
|---|---|
| `client` | Registrar/login, CRUD de sus vehículos, crear/cancelar/ver sus reservas |
| `employee` | Consultar ocupación, registrar entradas/salidas, leer plazas y reservas |
| `admin` | Todo lo anterior, más CRUD de usuarios y plazas, y lectura de logs |

Autenticación: JWT en el header `Authorization: Bearer <token>`.

## API

Prefijo global: `/api`.

### Auth

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| POST | `/auth/register` | público | Alta de cliente |
| POST | `/auth/login` | público | Devuelve `{ accessToken, user }` |
| GET | `/auth/me` | autenticado | Identidad del token |

### Users

CRUD restringido a `admin`. `PUT /users/:id` es el caso de uso de actualización de usuario y deja un log `user_updated`.

### Vehicles

CRUD para `client` (solo los suyos) y `admin` (todos).

### Spots

- `POST/PUT/DELETE /spots`: `admin`
- `GET /spots`, `GET /spots/:id`: `admin` y `employee`

El estado de la plaza **no se persiste**: se calcula en ocupación.

### Reservations

Caso de uso de reserva. Si no se envía `spotId`, la API asigna una plaza libre. Rechaza solapes (HTTP 409). Si `endAt` ya pasó y no hubo sesión, la reserva pasa a `expired` (no-show) y deja de bloquear la plaza.

| Método | Ruta | Acceso |
|---|---|---|
| POST | `/reservations` | `client`, `admin` |
| GET | `/reservations` | `client` (propias), `employee`, `admin` |
| GET | `/reservations/:id` | igual |
| PUT | `/reservations/:id` | `client`, `admin` |
| POST | `/reservations/:id/cancel` | `client`, `admin` |
| DELETE | `/reservations/:id` | `client`, `admin` (cancela si está confirmada) |

Ejemplo de reserva:

```json
{
  "vehicleId": "uuid-del-vehiculo",
  "startAt": "2026-09-14T18:00:00.000Z",
  "endAt": "2026-09-14T20:00:00.000Z"
}
```

### Sessions (entradas / salidas)

Solo `employee` y `admin`.

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/sessions` | Registrar entrada |
| POST | `/sessions/:id/exit` | Registrar salida (completa la reserva asociada si aplica) |
| GET | `/sessions` | Listar |
| GET | `/sessions/:id` | Detalle |
| PUT | `/sessions/:id` | Actualizar |
| DELETE | `/sessions/:id` | Eliminar |

### Occupancy

`GET /occupancy` (`employee`, `admin`) devuelve totales y el estado de cada plaza: `occupied`, `reserved` o `free`.

### Logs

`GET /logs` (`admin`) consulta MongoDB. Filtros opcionales: `action`, `actorId`, `from`, `to`.

Acciones registradas: `reservation_created`, `reservation_cancelled`, `reservation_expired`, `vehicle_entry`, `vehicle_exit`, `user_updated`.

## Tests e2e

Un spec por módulo, junto al código (`src/<módulo>/<módulo>.e2e-spec.ts`). `npm run test:e2e` usa `.env.test` y las bases de los contenedores `*-test`.

```bash
docker compose up -d
npm run test:e2e
```

Helpers compartidos: `test/support/app.ts` (`createTestApp`, `get`/`post`/`put`/`delete`, `reset`) y `test/support/factories.ts`.

## Postman

Importa [postman/Parking_API.postman_collection.json](postman/Parking_API.postman_collection.json). Variables de colección: `baseUrl` (`http://localhost:3000/api`) y `accessToken` (se rellena al hacer login).

## Scripts

| Script | Descripción |
|---|---|
| `npm run start:dev` | API en modo watch (`NODE_ENV=development`) |
| `npm run build` | Compilar |
| `npm run start:prod` | Ejecutar `dist/main` (`NODE_ENV=production`) |
| `npm run test:e2e` | Pruebas e2e (`NODE_ENV=test`, `.env.test`) |
