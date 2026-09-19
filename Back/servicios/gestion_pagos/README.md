# Microservicio: Gestion de Pagos (RePay)

## 1. Resumen de la Implementación

Se desarrolló el microservicio **`gestion_pagos`** para el módulo **RePay** del ERP. Su función principal es recibir, validar y registrar los métodos de pago seleccionados por los cajeros, almacenándolos temporalmente en un historial de transacciones.

### Tareas completadas (Jira)

- **TDSI-85:** Creación del servicio web para registrar el método de pago.
- **TDSI-262:** Guardado del método de pago en el historial del servicio.
- **TDSI-271:** Validación estricta de métodos permitidos (solo Efectivo, Tarjeta o QR).
- **TDSI-272:** Registro estructurado de cada operación en el historial de transacciones.

## 2. Modificaciones en Docker

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

## 3. Endpoints

### Registrar método de pago

**Endpoint:**

```http
POST /api/pagos/registrar
```

Permite registrar un método de pago asociado a una transacción.

#### Ejemplo de petición

```json
{
  "id_transaccion": 101,
  "metodo": "Tarjeta",
  "monto": 150.5
}
```

#### Métodos permitidos

El servicio acepta únicamente los siguientes métodos de pago:

- `Efectivo`
- `Tarjeta`
- `QR`

### Consultar historial de pagos

**Endpoint:**

```http
GET /api/pagos/historial
```

Devuelve el historial de pagos registrados durante la ejecución del servicio.

#### Ejemplo de respuesta

```json
[
  {
    "id_transaccion": 101,
    "metodo": "Tarjeta",
    "monto": 150.5
  }
]
```

## 4. Pruebas Realizadas

Se ejecutaron pruebas exhaustivas de los endpoints utilizando **Thunder Client**, con el objetivo de verificar tanto las respuestas exitosas como el correcto manejo de errores y validaciones.

| Escenario                  | Endpoint               | Método | Datos enviados      | Resultado           |
| -------------------------- | ---------------------- | ------ | ------------------- | ------------------- |
| **Registro exitoso**       | `/api/pagos/registrar` | `POST` | Tarjeta, Bs. 150.50 | **200 OK**          |
| **Método inválido**        | `/api/pagos/registrar` | `POST` | Cheque, Bs. 50.00   | **400 Bad Request** |
| **Datos incompletos**      | `/api/pagos/registrar` | `POST` | QR, sin monto       | **400 Bad Request** |
| **Consulta del historial** | `/api/pagos/historial` | `GET`  | No requiere datos   | **200 OK**          |

## 5. Ejecución del Servicio

Para construir y levantar todos los microservicios mediante Docker, ejecutar:

```bash
docker compose up --build
```

El microservicio **Gestión de Pagos (RePay)** estará disponible en:

```text
http://localhost:4005
```

### Endpoints disponibles

| Método | Endpoint               | Descripción                    |
| ------ | ---------------------- | ------------------------------ |
| `POST` | `/api/pagos/registrar` | Registra un método de pago     |
| `GET`  | `/api/pagos/historial` | Consulta el historial de pagos |

**Rama:** `TDSI-2`
