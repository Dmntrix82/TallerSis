# Microservicio: Gestion de Pagos (RePay)

## 1. Resumen de la Implementación

Se desarrolló el microservicio **`gestion_pagos`** para el módulo **RePay** del ERP. Su función principal es recibir, validar y registrar los métodos de pago seleccionados por los cajeros (pago simple y pago mixto), almacenándolos en un historial de transacciones.

### Tareas completadas (Jira)

- **TDSI-85:** Creación del servicio web para registrar el método de pago.
- **TDSI-262:** Guardado del método de pago en el historial del servicio.
- **TDSI-271:** Validación estricta de métodos permitidos (solo Efectivo, Tarjeta o QR).
- **TDSI-272:** Registro estructurado de cada operación en el historial de transacciones.
- **TDSI-87:** Servicio web (WS) para calcular y dividir el pago entre dos métodos (pago mixto).
- **TDSI-275:** Validación de que la suma de los dos montos coincida con el total de la venta.
- **TDSI-276:** Guardado del detalle del pago mixto (montos y métodos).
- **TDSI-277:** Registro del pago mixto en el historial de transacciones de la caja.

## 2. Estructura del proyecto

```text
src/
├── index.js                      # rutas simples de pago (TDSI-85/262/271/272)
├── data/memoria.js                # almacén en memoria compartido
├── utils/money.js                 # cálculo en centavos, evita errores de redondeo
├── utils/AppError.js              # errores controlados con código HTTP
├── middlewares/errorHandler.js
├── services/pagoMixtoService.js   # lógica de pago mixto (TDSI-87/275/276/277)
├── routes/pagoMixtoRoutes.js
└── tests/pagoMixto.test.js
```

## 3. Modificaciones en Docker

Para integrar y levantar el servicio en el entorno local, se modificó el archivo **`docker-compose.yml`**.

### Cambios realizados

- Se añadió la configuración del contenedor para `gestion_pagos`.
- Se expuso y mapeó el puerto **4005**:

```yaml
4005:4005
```

- Se aseguró su ejecución junto a los demás microservicios, como `cajeros` en el puerto **4004**.
- El servicio puede levantarse mediante:

```bash
docker compose up --build
```

### Nota de arquitectura

Actualmente, el servicio utiliza **persistencia en memoria**, por lo que los datos almacenados se eliminan al reiniciar el contenedor.
La conexión definitiva a **PostgreSQL** requerirá futuras modificaciones en el archivo `docker-compose.yml` para inyectar las credenciales y configuración necesarias para conectarse a la base de datos centralizada.

## 4. Endpoints

### Registrar método de pago (simple)

**Endpoint:**

```http
POST /api/pagos/registrar
```

#### Ejemplo de petición

```json
{
  "id_transaccion": 101,
  "metodo": "Tarjeta",
  "monto": 150.5
}
```

#### Métodos permitidos

- `Efectivo`
- `Tarjeta`
- `QR`

### Consultar historial de pagos

```http
GET /api/pagos/historial
```

### Calcular división de pago mixto (TDSI-87 / TDSI-275)

```http
POST /api/pagos/mixto/calcular
```

Calcula y valida cómo se divide el total entre dos métodos. No guarda nada; solo hace el cálculo.

#### Ejemplo de petición

```json
{
  "total": 250,
  "metodos": [
    { "metodo": "Efectivo", "monto": 100 },
    { "metodo": "QR" }
  ]
}
```

Si la suma de los montos no coincide con el total, responde **422** con el detalle de la diferencia (TDSI-275).

### Registrar pago mixto (TDSI-276 / TDSI-277)

```http
POST /api/pagos/mixto
```

Calcula, valida, guarda el detalle del pago mixto y registra cada método en el historial de transacciones de la caja.

#### Ejemplo de petición

```json
{
  "id_transaccion": "TX-200",
  "cajaId": "CAJA-01",
  "turnoId": "T-01",
  "total": 250,
  "metodos": [
    { "metodo": "Efectivo", "monto": 100 },
    { "metodo": "QR", "monto": 150 }
  ]
}
```

### Consultar pago mixto por transacción

```http
GET /api/pagos/mixto/:id_transaccion
```

## 5. Pruebas Realizadas

| Escenario                          | Endpoint                    | Método | Resultado esperado  |
| ----------------------------------- | ---------------------------- | ------ | -------------------- |
| Registro exitoso (pago simple)      | `/api/pagos/registrar`       | `POST` | **200 OK**            |
| Método inválido                     | `/api/pagos/registrar`       | `POST` | **400 Bad Request**   |
| Datos incompletos                   | `/api/pagos/registrar`       | `POST` | **400 Bad Request**   |
| Consulta del historial               | `/api/pagos/historial`       | `GET`  | **200 OK**            |
| Dividir pago mixto (montos exactos) | `/api/pagos/mixto/calcular`  | `POST` | **200 OK**            |
| Suma no coincide con el total       | `/api/pagos/mixto/calcular`  | `POST` | **422 Unprocessable** |
| Registrar pago mixto                | `/api/pagos/mixto`           | `POST` | **201 Created**       |
| Transacción duplicada               | `/api/pagos/mixto`           | `POST` | **409 Conflict**      |

Pruebas automatizadas: `npm test` (usa el test runner nativo de Node, sin dependencias extra).

## 6. Ejecución del Servicio

```bash
docker compose up --build
```

El microservicio **Gestión de Pagos (RePay)** estará disponible en:

```text
http://localhost:4005
```

### Endpoints disponibles

| Método | Endpoint                        | Descripción                                  |
| ------ | -------------------------------- | --------------------------------------------- |
| `POST` | `/api/pagos/registrar`           | Registra un método de pago (simple)           |
| `GET`  | `/api/pagos/historial`           | Consulta el historial de pagos                |
| `POST` | `/api/pagos/mixto/calcular`      | Calcula la división de un pago mixto          |
| `POST` | `/api/pagos/mixto`               | Registra un pago mixto completo               |
| `GET`  | `/api/pagos/mixto/:id_transaccion` | Consulta un pago mixto por transacción      |

**Ramas:** `TDSI-2`, `TDSI-3`