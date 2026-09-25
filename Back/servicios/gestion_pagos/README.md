# Microservicio: Gestión de Pagos (RePay)

## 1. Resumen de la Implementación

Se desarrolló el microservicio **`gestion_pagos`** para el módulo **RePay** del ERP. Su función principal es recibir, validar y registrar los métodos de pago seleccionados por los cajeros, incluyendo **pago simple, pago mixto y gestión de clientes frecuentes**.

Actualmente, el microservicio permite:

- Registrar pagos simples.
- Validar métodos de pago permitidos.
- Consultar el historial de transacciones.
- Calcular y registrar pagos mixtos.
- Consultar pagos mixtos por transacción.
- Buscar clientes frecuentes mediante NIT.
- Generar sugerencias para autocompletado de clientes.
- Registrar automáticamente nuevos clientes al realizar una facturación.
- Optimizar las búsquedas frecuentes mediante índices en memoria y caché.

### Tareas completadas (Jira)

#### Gestión de pagos

- **TDSI-85:** Creación del servicio web para registrar el método de pago.
- **TDSI-262:** Guardado del método de pago en el historial del servicio.
- **TDSI-271:** Validación estricta de métodos permitidos (solo Efectivo, Tarjeta o QR).
- **TDSI-272:** Registro estructurado de cada operación en el historial de transacciones.
- **TDSI-87:** Servicio web (WS) para calcular y dividir el pago entre dos métodos (pago mixto).
- **TDSI-275:** Validación de que la suma de los dos montos coincida con el total de la venta.
- **TDSI-276:** Guardado del detalle del pago mixto (montos y métodos).
- **TDSI-277:** Registro del pago mixto en el historial de transacciones de la caja.

#### Clientes frecuentes

- **TDSI-91:** Búsqueda de clientes frecuentes por NIT con autocompletado.
- **TDSI-287:** Implementación de tabla en memoria para clientes frecuentes.
- **TDSI-288:** Servicio de búsqueda de clientes por NIT.
- **TDSI-289:** Guardado automático de clientes nuevos al realizar una facturación.
- **TDSI-290:** Optimización de búsquedas mediante índices en memoria y caché.

---

## 2. Estructura del proyecto

```text
src/
├── index.js
├── data/
│   └── memoria.js                    # Almacén en memoria compartido
├── utils/
│   ├── money.js                      # Cálculo en centavos
│   └── AppError.js                   # Errores controlados
├── middlewares/
│   └── errorHandler.js               # Manejo centralizado de errores
├── services/
│   ├── pagoMixtoService.js           # Lógica de pago mixto
│   └── clientesService.js            # Gestión de clientes frecuentes
├── routes/
│   ├── pagoMixtoRoutes.js            # Rutas de pagos mixtos
│   └── clientesRoutes.js             # Rutas de clientes frecuentes
└── tests/
    ├── pagoMixto.test.js             # Pruebas de pagos mixtos
    └── clientes.test.js              # Pruebas de clientes frecuentes
```

### Archivos relacionados con clientes frecuentes

```text
src/
├── data/
│   └── memoria.js
│       └── clientesFrecuentes
│
├── services/
│   └── clientesService.js
│       ├── búsqueda por NIT
│       ├── sugerencias
│       ├── guardado de clientes
│       └── caché de consultas
│
├── routes/
│   └── clientesRoutes.js
│
└── tests/
    └── clientes.test.js
```

---

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

Los clientes frecuentes también se almacenan actualmente en memoria mediante estructuras de datos de JavaScript. Esta implementación permite desarrollar y probar la funcionalidad antes de realizar la migración a **PostgreSQL**.

La conexión definitiva a PostgreSQL requerirá futuras modificaciones en el archivo `docker-compose.yml` para inyectar las credenciales y configuración necesarias para conectarse a la base de datos correspondiente.

---

# 4. Endpoints

## 4.1. Registrar método de pago simple

**Endpoint:**

```http
POST /api/pagos/registrar
```

Registra un método de pago individual.

### Ejemplo de petición

```json
{
  "id_transaccion": 101,
  "metodo": "Tarjeta",
  "monto": 150.5
}
```

### Métodos permitidos

- `Efectivo`
- `Tarjeta`
- `QR`

---

## 4.2. Consultar historial de pagos

```http
GET /api/pagos/historial
```

Permite consultar el historial de pagos registrados por el microservicio.

---

## 4.3. Calcular división de pago mixto

**TDSI-87 / TDSI-275**

```http
POST /api/pagos/mixto/calcular
```

Calcula y valida cómo se divide el total entre dos métodos de pago.

Este endpoint realiza únicamente el cálculo y validación; **no guarda la transacción**.

### Ejemplo de petición

```json
{
  "total": 250,
  "metodos": [{ "metodo": "Efectivo", "monto": 100 }, { "metodo": "QR" }]
}
```

Si la suma de los montos no coincide con el total, responde **422 Unprocessable Entity**, indicando la diferencia correspondiente.

---

## 4.4. Registrar pago mixto

**TDSI-276 / TDSI-277**

```http
POST /api/pagos/mixto
```

Calcula, valida, guarda el detalle del pago mixto y registra cada método en el historial de transacciones de la caja.

### Ejemplo de petición

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

---

## 4.5. Consultar pago mixto por transacción

```http
GET /api/pagos/mixto/:id_transaccion
```

Permite consultar el detalle de un pago mixto utilizando el identificador de la transacción.

---

# 5. Módulo de Clientes Frecuentes

El módulo de clientes frecuentes permite identificar y reutilizar los datos de clientes mediante su **NIT**, facilitando el proceso de facturación y evitando que el cajero tenga que ingresar nuevamente la información de un cliente recurrente.

## 5.1. Funcionalidades

El módulo permite:

- Buscar un cliente por NIT.
- Buscar clientes mediante coincidencias parciales.
- Autocompletar información del cliente.
- Registrar clientes nuevos.
- Evitar duplicados mediante el NIT.
- Guardar automáticamente un cliente cuando realiza su primera facturación.
- Optimizar las búsquedas mediante estructuras indexadas y caché.

---

## 5.2. Buscar cliente por NIT

```http
GET /api/clientes/:nit
```

Busca un cliente frecuente utilizando su NIT.

### Ejemplo

```bash
curl http://localhost:4005/api/clientes/123456789
```

### Respuesta exitosa

```json
{
  "ok": true,
  "data": {
    "nit": "123456789",
    "razon_social": "Juan Pérez",
    "email": "juan@example.com"
  }
}
```

### Cliente no encontrado

```json
{
  "ok": false,
  "mensaje": "Cliente no encontrado",
  "detalle": {
    "nit": "000000000"
  }
}
```

### NIT inválido

```json
{
  "ok": false,
  "mensaje": "El NIT debe tener entre 6 y 15 dígitos numéricos",
  "detalle": {
    "nit": "abc"
  }
}
```

---

## 5.3. Sugerencias para autocompletado

```http
GET /api/clientes?q=texto&limite=10
```

Permite buscar coincidencias parciales por:

- NIT.
- Razón social.

### Ejemplo

```bash
curl "http://localhost:4005/api/clientes?q=juan"
```

### Respuesta

```json
{
  "ok": true,
  "total": 1,
  "data": [
    {
      "nit": "123456789",
      "razon_social": "Juan Pérez",
      "email": "juan@example.com"
    }
  ]
}
```

---

## 5.4. Guardar cliente

```http
POST /api/clientes
```

Permite registrar un cliente nuevo o actualizar la información de uno existente.

### Ejemplo

```bash
curl -X POST http://localhost:4005/api/clientes \
-H "Content-Type: application/json" \
-d '{
  "nit": "111111111",
  "razon_social": "Cliente Nuevo",
  "email": "nuevo@example.com"
}'
```

### Respuesta

```json
{
  "ok": true,
  "mensaje": "Cliente guardado",
  "data": {
    "nit": "111111111",
    "razon_social": "Cliente Nuevo",
    "email": "nuevo@example.com"
  }
}
```

---

## 5.5. Guardado automático al facturar

**TDSI-289**

El endpoint:

```http
POST /api/pagos/registrar
```

acepta información opcional del cliente:

```json
{
  "id_transaccion": "TX-100",
  "metodo": "Efectivo",
  "monto": 100,
  "nit": "555444333",
  "razon_social": "Cliente Nuevo"
}
```

Si el NIT no existe, el cliente se guarda automáticamente.

### Comportamiento

| Caso          | `clienteGuardado` | `cliente`          |
| ------------- | ----------------- | ------------------ |
| NIT nuevo     | `true`            | Objeto del cliente |
| NIT existente | `false`           | Cliente existente  |
| Sin NIT       | `false`           | `null`             |

De esta manera, el proceso de facturación contribuye automáticamente al registro de clientes frecuentes.

---

## 5.6. Optimizaciones

**TDSI-290**

Para mejorar el rendimiento de las consultas se implementaron mecanismos de optimización en memoria.

### Índice por NIT

Se utiliza una estructura:

```text
Map<nit, cliente>
```

Esto permite realizar búsquedas exactas por NIT de forma eficiente, evitando recorrer todos los clientes almacenados.

### Caché de sugerencias

Se utiliza un caché **LRU** con un máximo de 50 entradas para almacenar temporalmente consultas repetidas de autocompletado.

### Invalidación del caché

Cuando se registra o modifica un cliente, se invalida la información relacionada del caché para evitar devolver resultados desactualizados.

### Migración futura

Cuando el módulo sea migrado a PostgreSQL, se podrán utilizar índices especializados, incluyendo:

- Índices sobre el NIT.
- `pg_trgm` para búsquedas textuales.
- Índices GIN para mejorar búsquedas por coincidencias.

---

# 6. Pruebas Realizadas

## 6.1. Pruebas de pagos

| Escenario                      | Endpoint                    | Método | Resultado esperado    |
| ------------------------------ | --------------------------- | ------ | --------------------- |
| Registro exitoso (pago simple) | `/api/pagos/registrar`      | `POST` | **200 OK**            |
| Método inválido                | `/api/pagos/registrar`      | `POST` | **400 Bad Request**   |
| Datos incompletos              | `/api/pagos/registrar`      | `POST` | **400 Bad Request**   |
| Consulta del historial         | `/api/pagos/historial`      | `GET`  | **200 OK**            |
| Dividir pago mixto             | `/api/pagos/mixto/calcular` | `POST` | **200 OK**            |
| Suma no coincide con el total  | `/api/pagos/mixto/calcular` | `POST` | **422 Unprocessable** |
| Registrar pago mixto           | `/api/pagos/mixto`          | `POST` | **201 Created**       |
| Transacción duplicada          | `/api/pagos/mixto`          | `POST` | **409 Conflict**      |

## 6.2. Pruebas de clientes frecuentes

| Escenario                           | Endpoint                | Resultado esperado    |
| ----------------------------------- | ----------------------- | --------------------- |
| Buscar cliente existente por NIT    | `/api/clientes/:nit`    | **200 OK**            |
| Cliente inexistente                 | `/api/clientes/:nit`    | **404 Not Found**     |
| NIT inválido                        | `/api/clientes/:nit`    | **400 Bad Request**   |
| Sugerencias por texto               | `/api/clientes?q=texto` | **200 OK**            |
| Registrar cliente                   | `/api/clientes`         | **201 Created**       |
| Guardar cliente durante facturación | `/api/pagos/registrar`  | Cliente guardado      |
| Consulta repetida                   | `/api/clientes?q=texto` | Resultado desde caché |

### Ejecución de pruebas

```bash
npm test
```

Las pruebas utilizan el **test runner nativo de Node.js**, sin dependencias adicionales para el framework de pruebas.

---

# 7. Ejemplos de uso desde el frontend

El frontend puede consumir los endpoints de clientes mediante funciones como:

```javascript
// Frontend/src/api/clientes.js

import { apiFetch } from "./client.js";

export function buscarClientePorNit(nit) {
  return apiFetch(`/api/clientes/${nit}`);
}

export function sugerirClientes(query) {
  return apiFetch(`/api/clientes?q=${encodeURIComponent(query)}`);
}
```

### Flujo esperado en el frontend

1. El cajero ingresa el NIT.
2. El frontend consulta `/api/clientes/:nit`.
3. Si el cliente existe, se autocompleta la Razón Social.
4. Si no existe, se permite ingresar los datos manualmente.
5. Al registrar el pago, los datos del cliente pueden enviarse junto con la transacción.
6. Si es un cliente nuevo, el backend lo registra automáticamente.
7. En futuras compras, el cliente puede aparecer mediante autocompletado.

---

# 8. Ejecución del Servicio

Para levantar el microservicio:

```bash
docker compose up --build
```

El microservicio **Gestión de Pagos (RePay)** estará disponible en:

```text
http://localhost:4005
```

### Endpoints disponibles

| Método | Endpoint                           | Descripción                            |
| ------ | ---------------------------------- | -------------------------------------- |
| `POST` | `/api/pagos/registrar`             | Registra un método de pago simple      |
| `GET`  | `/api/pagos/historial`             | Consulta el historial de pagos         |
| `POST` | `/api/pagos/mixto/calcular`        | Calcula la división de un pago mixto   |
| `POST` | `/api/pagos/mixto`                 | Registra un pago mixto completo        |
| `GET`  | `/api/pagos/mixto/:id_transaccion` | Consulta un pago mixto por transacción |
| `GET`  | `/api/clientes/:nit`               | Busca un cliente por NIT               |
| `GET`  | `/api/clientes?q=texto`            | Busca sugerencias para autocompletado  |
| `POST` | `/api/clientes`                    | Registra o actualiza un cliente        |
