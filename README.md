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

PostgreSQL se publica en el puerto **5433** del host (el 5432 suele estar ocupado por una instalación local). MongoDB usa el **27017**.

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

Necesitan PostgreSQL y MongoDB en marcha. Usan la base `parking_e2e` (la crea el test si no existe) y Mongo `parking_logs_e2e`.

```bash
npm run test:e2e
```

Cubren los cuatro casos de uso del enunciado (reservar plaza, ocupación, actualizar usuario, consultar logs), incluyendo denegaciones por rol.

## Postman

Importa [postman/Parking_API.postman_collection.json](postman/Parking_API.postman_collection.json). Variables de colección: `baseUrl` (`http://localhost:3000/api`) y `accessToken` (se rellena al hacer login).

## Scripts

| Script | Descripción |
|---|---|
| `npm run start:dev` | API en modo watch |
| `npm run build` | Compilar |
| `npm run start:prod` | Ejecutar `dist/main` |
| `npm run test:e2e` | Pruebas e2e |
