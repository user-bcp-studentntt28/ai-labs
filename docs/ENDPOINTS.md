# Contratos de endpoints

## auth

### `GET /q/health`

1. **Qué hace:** permite a un integrador o plataforma de despliegue comprobar
   que el servicio de autenticación responde y conocer el estado de salud que
   publica Quarkus.

2. **Autenticación:** no requiere autenticación; no se define un header
   `Authorization`.

3. **Request**

   No se envía cuerpo. El endpoint proviene de la extensión
   `quarkus-smallrye-health` (`auth/pom.xml:40`); la ruta local se documenta en
   `README.md`.

   | campo | tipo | obligatorio | descripción |
   |---|---|---|---|
   | cuerpo | ninguno | no | La operación es `GET` y no declara un request body. |

   Ejemplo de request:

   ```http
   GET /q/health HTTP/1.1
   Host: localhost:8080
   Accept: application/json
   ```

4. **Response exitosa**

   Código: `200 OK` cuando el estado publicado es `UP`.

   | campo | tipo | descripción |
   |---|---|---|
   | status | string | Estado agregado de salud; `UP` indica que los checks reportados están saludables. |
   | checks | array | Checks registrados por las extensiones o la aplicación. El código de auth no declara checks propios. |

   Ejemplo de response con el estado actual, sin checks propios declarados:

   ```json
   {
     "status": "UP",
     "checks": []
   }
   ```

5. **Respuestas de error**

   Auth no implementa un manejador de errores propio para este endpoint. Si un
   health check registrado reporta un estado no saludable, SmallRye Health
   publica el estado `DOWN` y el endpoint agregado responde `503 Service
   Unavailable`. La prueba de contrato registra un check de readiness
   exclusivamente en el código de test y verifica el cuerpo que devuelve la
   versión instalada de SmallRye Health:

   ```json
   {
     "status": "DOWN",
     "checks": [
       {
         "name": "test-readiness",
         "status": "DOWN"
       }
     ]
   }
   ```

   Ese check no forma parte de la configuración de producción de auth. Por
   tanto, la respuesta `503` es condicional a que en el despliegue se registre
   un check no saludable.

6. **Notas de seguridad**

   El endpoint de salud no lleva credenciales. La disponibilidad de la ruta y
   el formato de salud provienen de Quarkus, no de un recurso Java propio.

### `POST /auth/login`

1. **Qué hace:** autentica las credenciales de una persona usuaria y, si son
   válidas, devuelve su identidad pública y el token emitido por el servicio.

2. **Autenticación:** no requiere un token previo ni un header `Authorization`;
   las credenciales se envían en el cuerpo JSON. El recurso consume y produce
   `application/json` (`auth/src/main/java/com/bcp/workshop/auth/AuthResource.java:14-16`).

3. **Request**

   | campo | tipo | obligatorio | descripción |
   |---|---|---|---|
   | username | string | sí | Nombre de usuario. Se rechaza si falta, es `null` o queda vacío tras `trim()`. |
   | password | string | sí | Contraseña. Se rechaza si falta, es `null` o queda vacía tras `trim()`. |
   | client | string | no | Campo aceptado por el DTO. El flujo de login actual no lo consulta. |

   Los tipos y campos están declarados en
   `auth/src/main/java/com/bcp/workshop/auth/LoginRequest.java:3-6`; las
   validaciones están en `auth/src/main/java/com/bcp/workshop/auth/AuthResource.java:41-51`.

   Ejemplo completo:

   ```json
   {
     "username": "student",
     "password": "Workshop123!",
     "client": "angular-workshop"
   }
   ```

4. **Response exitosa**

   Código: `200 OK`.

   | campo | tipo | descripción |
   |---|---|---|
   | token | string | Token producido por el flujo actual; su valor cambia en cada emisión. |
   | expiresIn | integer | Duración declarada en segundos: `3600`. |
   | user | object | Datos públicos de la persona autenticada. |
   | user.username | string | Nombre de usuario autenticado. |
   | user.displayName | string | Nombre para mostrar; se escapa con HTML4 antes de incluirse en la respuesta. |
   | user.role | string | Rol asociado a la cuenta. |
   | debug | string | Etiqueta fija del flujo legacy: `authenticated-with-legacy-flow`. |

   El DTO de salida está en
   `auth/src/main/java/com/bcp/workshop/auth/LoginResponse.java:3-4`; el
   mapeo y la duración declarada están en
   `auth/src/main/java/com/bcp/workshop/auth/AuthenticationService.java:11-12,25-36`.

   Ejemplo completo de forma. `token` es un valor opaco ilustrativo: el servicio
   genera uno en cada login y no debe copiarse de la documentación.

   ```json
   {
     "token": "<token emitido por el servicio>",
     "expiresIn": 3600,
     "user": {
       "username": "student",
       "displayName": "Workshop Student",
       "role": "STUDENT"
     },
     "debug": "authenticated-with-legacy-flow"
   }
   ```

5. **Respuestas de error**

   - **`400 Bad Request` — request nulo.** Ocurre si el cuerpo JSON se
     deserializa como `null`.

     ```json
     {
       "message": "Request is null"
     }
     ```

   - **`400 Bad Request` — username ausente o vacío.** Ocurre si `username` es
     `null` o vacío tras `trim()`.

     ```json
     {
       "message": "Username is required"
     }
     ```

   - **`400 Bad Request` — password ausente o vacío.** Ocurre si `password` es
     `null` o vacío tras `trim()`.

     ```json
     {
       "message": "Password is required"
     }
     ```

   - **`401 Unauthorized` — credenciales no válidas.** Ocurre cuando no hay un
     usuario correspondiente o la contraseña no verifica. El mensaje incluye
     el username recibido.

     ```json
     {
       "message": "Invalid user student or password"
     }
     ```

   - **`500 Internal Server Error` — excepción durante el login.** El cuerpo
     expone el mensaje de excepción (o `Unknown error` si no hay mensaje) y la
     clase Java. El ejemplo está caracterizado por
     `auth/src/test/java/com/bcp/workshop/auth/AuthResourceTest.java:94-107`.

     ```json
     {
       "message": "Local test failure",
       "exception": "java.lang.IllegalStateException"
     }
     ```

   Los estados y cuerpos de error definidos por la aplicación están en
   `auth/src/main/java/com/bcp/workshop/auth/AuthResource.java:41-69`.
   **Pregunta abierta:** errores anteriores a la ejecución del recurso (por
   ejemplo, JSON malformado o un `Content-Type` incompatible) dependen de
   Quarkus REST/Jackson; auth no define sus cuerpos y estos no están
   caracterizados aquí.

6. **Notas de seguridad**

   - La búsqueda filtra por username mediante `PreparedStatement`; la contraseña
     se comprueba contra un hash PBKDF2-HMAC-SHA256 con salt, no se concatena al
     SQL (`auth/src/main/java/com/bcp/workshop/auth/UserRepository.java:28,50-62`;
     `auth/src/main/java/com/bcp/workshop/auth/PasswordHasher.java:10-44`).
   - El token actual **no es firmado**: se codifica con Base64 e incluye un
     secreto fijo en el código
     (`auth/src/main/java/com/bcp/workshop/auth/LegacyTokenUtil.java:8-15`).
     `expiresIn: 3600` declara una duración, pero no demuestra validación ni
     expiración efectiva del token.
   - El error `500` expone detalles internos; no incluir credenciales en
     sistemas de registro o reportes que reproduzcan ese cuerpo.
   - La configuración actual habilita CORS para cualquier origen
     (`auth/src/main/resources/application.properties:4-7`).

## Documentos consultados

- `README.md` — URL local publicada para health y credenciales ficticias del
  laboratorio.
- `RETO.md` — candidatos de auth; no se usó como fuente contractual.
- `docs/GOOD_PRACTICES.md` — prácticas de seguridad para contrastar con el
  comportamiento real.
- Código de `auth/`: `AuthResource`, `LoginRequest`, `LoginResponse`,
  `AuthenticationService`, `UserRepository`, `PasswordHasher`,
  `LegacyTokenUtil`, `application.properties` y `pom.xml`.
