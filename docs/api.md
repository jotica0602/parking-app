# Cómo usar la API

Base: `http://localhost:3000/api`

Casi todo pide JWT:

```http
Authorization: Bearer <accessToken>
```

Cuerpo en JSON. Un campo de más → `400`. `passwordHash` no se devuelve nunca.

Públicas (sin token): `GET /`, `POST /auth/register`, `POST /auth/login`.

| | Significado |
|---|---|
| `200` `201` `204` | Lectura, creación, eliminación |
| `400` | Validación o regla de negocio |
| `401` | Sin token o login incorrecto |
| `403` | Rol o recurso ajeno |
| `404` | No existe |
| `409` | Conflicto (email, matrícula, plaza, solape, sesión abierta) |

## Quién hace qué

| Rol | Alcance |
|---|---|
| `client` | Sus vehículos y reservas |
| `employee` | Ocupación, sesiones, lectura de plazas y reservas |
| `admin` | Todo: usuarios, plazas y logs |

El primer admin sale de `ADMIN_EMAIL` / `ADMIN_PASSWORD` en `.env`. El registro público solo crea `client`. Un admin crea empleados y otros admins.

## Recorrido

1. `POST /auth/login` con el admin de `.env` → guarda `accessToken`.
2. Admin: `POST /spots` (hace falta al menos una plaza).
3. Cliente: `POST /vehicles` y `POST /reservations`.
4. Employee: `GET /occupancy`, `POST /sessions`, `POST /sessions/:id/close`.
5. Admin: `GET /logs`.

En Postman: importa [Parking_API.postman_collection.json](../postman/Parking_API.postman_collection.json), ejecuta **Auth → Login** (rellena `accessToken`) y sigue el resto.

---

## Auth

| | Ruta | Quién |
|---|---|---|
| `POST` | `/auth/register` | público → siempre `client` |
| `POST` | `/auth/login` | público → `{ accessToken, user }` |
| `GET` | `/auth/me` | autenticado |

Registro:

```json
{
  "name": "Ana",
  "email": "ana@parking.test",
  "password": "Password123!",
  "phone": "600123123"
}
```

`phone` es opcional. `password` mínimo 8 caracteres.

Login:

```json
{
  "email": "admin@parking.test",
  "password": "Password123!"
}
```

## Usuarios

Solo `admin`. CRUD en `/users` y `/users/:id`.

```json
{
  "name": "Luis",
  "email": "empleado@parking.test",
  "password": "Password123!",
  "role": "employee"
}
```

Campos: `name`, `email`, `password` (≥ 8). Opcionales: `phone`, `role` (`admin` \| `employee` \| `client`).

## Vehículos

`client` (los suyos) y `admin`. CRUD en `/vehicles` y `/vehicles/:id`.

```json
{
  "licensePlate": "1234ABC",
  "brand": "Seat",
  "model": "Ibiza",
  "color": "blue"
}
```

Obligatorio: `licensePlate`. Opcionales: `brand`, `model`, `color`. `ownerId` solo lo aplica un admin.

## Plazas

Escribir: `admin`. Leer: `admin`, `employee`.

| | Ruta |
|---|---|
| `POST` `PUT` `DELETE` | `/spots`, `/spots/:id` |
| `GET` | `/spots`, `/spots/:id` |

```json
{
  "code": "A-1",
  "floor": 0,
  "type": "standard"
}
```

Obligatorio: `code`. Opcionales: `floor` (≥ 0), `type` (`standard` \| `disabled` \| `electric`).

## Reservas

Crear, cambiar y cancelar: `client`, `admin`. Leer: esos más `employee`. Un cliente solo ve las suyas.

| | Ruta |
|---|---|
| `POST` | `/reservations` |
| `GET` | `/reservations`, `/reservations/:id` |
| `PUT` | `/reservations/:id` |
| `POST` | `/reservations/:id/cancel` |
| `DELETE` | `/reservations/:id` (cancela si está `confirmed`) |

```json
{
  "vehicleId": "<uuid>",
  "startAt": "2026-09-20T10:00:00.000Z",
  "endAt": "2026-09-20T12:00:00.000Z"
}
```

`spotId` es opcional: si falta, se asigna una plaza libre. Fechas en ISO 8601. Solape → `409`.

Estados: `confirmed`, `cancelled`, `completed`, `expired` (no-show).

## Sesiones

`employee` y `admin`. Entrada y salida de vehículos.

| | Ruta |
|---|---|
| `POST` | `/sessions` |
| `GET` | `/sessions`, `/sessions/:id` |
| `PUT` | `/sessions/:id` |
| `POST` | `/sessions/:id/close` |
| `DELETE` | `/sessions/:id` |

```json
{
  "vehicleId": "<uuid>",
  "spotId": "<uuid>",
  "reservationId": "<uuid>"
}
```

Obligatorios: `vehicleId`, `spotId`. Opcionales: `reservationId`, `enteredAt`.

## Ocupación

`GET /occupancy` — `employee`, `admin`.

Cada plaza: `occupied` (sesión abierta), `reserved` (reserva vigente) o `free`.

## Logs

`GET /logs` — solo `admin`.

Filtros: `?action=&actorId=&from=&to=`.

Acciones: `reservation_created`, `reservation_cancelled`, `reservation_expired`, `vehicle_entry`, `vehicle_exit`, `user_updated`.
