# Cómo usar la API

Base: `http://localhost:3000/api`.

Salvo las rutas públicas, todas piden JWT:

```http
Authorization: Bearer <accessToken>
```

JSON en el cuerpo. Campos extra → `400`. `passwordHash` no se devuelve.

| Código | Significado |
|---|---|
| `200` / `201` / `204` | OK (lectura/alta/borrado) |
| `400` | Validación o regla de negocio |
| `401` | Sin token o credenciales inválidas |
| `403` | Rol o recurso ajeno |
| `404` | No existe |
| `409` | Conflicto (email, matrícula, plaza, solape, sesión abierta) |

## Roles

| Rol | Acceso |
|---|---|
| `client` | Sus vehículos y reservas |
| `employee` | Ocupación, sesiones, lectura de plazas y reservas |
| `admin` | Todo, más usuarios, plazas y logs |

## Endpoints

Públicos: `GET /`, `POST /auth/register`, `POST /auth/login`.

| Método | Ruta | Roles |
|---|---|---|
| `GET` | `/` | público |
| `POST` | `/auth/register` | público (siempre crea `client`) |
| `POST` | `/auth/login` | público → `{ accessToken, user }` |
| `GET` | `/auth/me` | autenticado |
| `POST` `GET` `PUT` `DELETE` | `/users`, `/users/:id` | `admin` |
| `POST` `GET` `PUT` `DELETE` | `/vehicles`, `/vehicles/:id` | `client`, `admin` |
| `POST` `PUT` `DELETE` | `/spots`, `/spots/:id` | `admin` |
| `GET` | `/spots`, `/spots/:id` | `admin`, `employee` |
| `POST` `PUT` | `/reservations`, `/reservations/:id` | `client`, `admin` |
| `GET` | `/reservations`, `/reservations/:id` | `client` (propias), `employee`, `admin` |
| `POST` | `/reservations/:id/cancel` | `client`, `admin` |
| `DELETE` | `/reservations/:id` | `client`, `admin` (cancela si está `confirmed`) |
| `POST` `GET` `PUT` `DELETE` | `/sessions`, `/sessions/:id` | `employee`, `admin` |
| `POST` | `/sessions/:id/close` | `employee`, `admin` |
| `GET` | `/occupancy` | `employee`, `admin` |
| `GET` | `/logs` | `admin` |

## Cuerpos

**Registro / login**

```json
{ "name": "Ana", "email": "ana@parking.test", "password": "Password123!", "phone": "600123123" }
{ "email": "admin@parking.test", "password": "Password123!" }
```

El admin inicial sale de `ADMIN_EMAIL` / `ADMIN_PASSWORD` en `.env`.

**Usuario** (admin): `name`, `email`, `password` (≥ 8), `phone?`, `role?` (`admin` \| `employee` \| `client`).

**Vehículo**: `licensePlate`, `brand?`, `model?`, `color?`. `ownerId` solo lo aplica un admin.

**Plaza**: `code`, `floor?`, `type?` (`standard` \| `disabled` \| `electric`).

**Reserva**: `vehicleId`, `startAt`, `endAt` (ISO 8601). `spotId` opcional: si falta, se asigna una plaza libre. Solape → `409`. Estados: `confirmed`, `cancelled`, `completed`, `expired` (no-show).

**Sesión**: `vehicleId`, `spotId`, `reservationId?`, `enteredAt?`. Cerrar: `POST /sessions/:id/close`.

**Ocupación**: cada plaza es `occupied` (sesión abierta), `reserved` (reserva vigente) o `free`.

**Logs**: `GET /logs?action=&actorId=&from=&to=`. Acciones: `reservation_created`, `reservation_cancelled`, `reservation_expired`, `vehicle_entry`, `vehicle_exit`, `user_updated`.

## Flujo

1. `POST /auth/login` con el admin de `.env` (ver [cómo ejecutar](getting-started.md#primer-admin)).
2. Guardar `accessToken`.
3. Admin: `POST /spots`. Cliente: `POST /vehicles` y `POST /reservations`.
4. Employee: `GET /occupancy`, `POST /sessions`, `POST /sessions/:id/close`.
5. Admin: `GET /logs`.

Colección Postman: [postman/Parking_API.postman_collection.json](../postman/Parking_API.postman_collection.json). Importa, haz **Auth → Login** (rellena `accessToken`) y llama al resto.
