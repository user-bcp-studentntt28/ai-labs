# Hallazgos

Discovery de `auth/` basado en lectura estática. H-AUTH-01, H-AUTH-02 y
H-AUTH-07 se actualizaron después de su implementación local y pruebas;
H-AUTH-03 a H-AUTH-06 siguen pendientes. No se realizó una revisión de
advisories.

## auth

| id | componente | hallazgo | tipo | explicacion | evidencia (archivo:linea) | severidad | estado |
|---|---|---|---|---|---|---|---|
| H-AUTH-01 | auth | Credenciales concatenadas en SQL | Vulnerabilidad | `username` y `password` se insertaban directamente en la sentencia, permitiendo alterar la consulta de autenticación. | `auth/src/main/java/com/bcp/workshop/auth/AuthResource.java:31`; `auth/src/main/java/com/bcp/workshop/auth/UserRepository.java:28,50-55` | alta | Resuelto — la búsqueda usa SQL fijo y enlaza el username con `PreparedStatement`; la contraseña se verifica fuera de SQL. |
| H-AUTH-02 | auth | Contraseñas almacenadas y comparadas en texto plano | Vulnerabilidad | El esquema guardaba contraseñas legibles; una exposición de la base podía revelar las credenciales. | `auth/src/main/java/com/bcp/workshop/auth/UserRepository.java:21-47,77-129`; `auth/src/main/java/com/bcp/workshop/auth/PasswordHasher.java:11-86` | alta | Resuelto — se almacenan hashes PBKDF2-HMAC-SHA256 con salt aleatorio y se migran filas legacy de forma idempotente. |
| H-AUTH-03 | auth | Token codificado en Base64 con secreto embebido, sin firma criptográfica | Vulnerabilidad | El contenido, incluido el secreto fijo, solo se codifica con Base64; el formato no autentica su integridad y la expiración incluida es un dato, no una verificación demostrada. | `auth/src/main/java/com/bcp/workshop/auth/LegacyTokenUtil.java:8,13-15`; `auth/src/main/java/com/bcp/workshop/auth/AuthResource.java:40-42` | alta | Pendiente |
| H-AUTH-04 | auth | Respuesta de error expone detalles de excepción | Vulnerabilidad | En errores internos, la respuesta HTTP 500 incluye el mensaje y la clase de excepción, lo que puede revelar información de implementación o persistencia al cliente. | `auth/src/main/java/com/bcp/workshop/auth/AuthResource.java:54-58` | media | Pendiente |
| H-AUTH-05 | auth | Secreto codificado en clase y CORS con origen permisivo | Vulnerabilidad | El secreto está fijado en código y CORS está habilitado con una expresión de origen que admite cualquier origen; esto deja la configuración sensible sin externalizar y permite solicitudes cross-origin desde sitios no restringidos por origen. | `auth/src/main/java/com/bcp/workshop/auth/LegacyTokenUtil.java:8`; `auth/src/main/resources/application.properties:4-7` | media | Pendiente |
| H-AUTH-06 | auth | Versiones de dependencias requieren revisión SCA | Sugerencia | El proyecto fija Quarkus `3.27.4` y Commons Text `1.9`. La presencia de esas versiones está comprobada, pero sin consultar advisories no se confirma si hay vulnerabilidades aplicables ni su impacto. | `auth/pom.xml:13,48-50` | baja | Pendiente |
| H-AUTH-07 | auth | El recurso concentra validación, persistencia, token y respuesta HTTP | Refactor | `login` validaba entradas, invocaba directamente la base, decidía la autenticación, generaba el token y construía la respuesta; esto acoplaba responsabilidades y dificultaba probarlas o cambiarlas de forma aislada. | `auth/src/main/java/com/bcp/workshop/auth/AuthResource.java:23-68`; `auth/src/main/java/com/bcp/workshop/auth/AuthenticationService.java:10-35`; `auth/src/main/java/com/bcp/workshop/auth/UserRepository.java:19-67`; `auth/src/main/java/com/bcp/workshop/auth/LoginResponse.java:3-4` | baja | Resuelto — la frontera HTTP delega la autenticación al servicio; el repositorio persiste y la respuesta usa DTOs separados del modelo `UserRecord`. |

## Contrato observado de `POST /auth/login`

No se encontró `docs/ENDPOINTS.md`; por eso, lo siguiente se deriva del código y
es un contrato **observado**, no un contrato acordado:

- Ruta `POST /auth/login`, con request y response JSON.
- El request contiene los campos `username` y `password`; `client` también está
  declarado en el DTO. El recurso responde `400` cuando el cuerpo es nulo o
  falta username o password.
- La base usa `AUTH_DB_URL` si está definida y, de lo contrario,
  `jdbc:sqlite:./data/workshop.db`. Al inicializar crea la tabla `legacy_users`,
  migra contraseñas legadas y agrega cuentas ficticias `student` y `trainer`
  con hashes si no existen. `UserRepository` enlaza username como parámetro y
  verifica la contraseña contra el hash almacenado.
- Si no encuentra usuario, responde `401` con un mensaje que incluye el
  username recibido.
- Si autentica, responde `200` con `token`, `expiresIn` y `user` (`username`,
  `displayName`, `role`), además del campo `debug`.
- El token codifica en Base64 username, rol, expiración y el secreto fijo; el
  código leído no lo firma.
- Si ocurre una excepción en el recurso, responde `500` con `message` y
  `exception`.

Evidencia: `auth/src/main/java/com/bcp/workshop/auth/AuthResource.java:14-68`;
campos del request en `auth/src/main/java/com/bcp/workshop/auth/LoginRequest.java:3-6`;
servicio y DTOs en `auth/src/main/java/com/bcp/workshop/auth/AuthenticationService.java:10-35`
y `auth/src/main/java/com/bcp/workshop/auth/LoginResponse.java:3-4`;
inicialización y consulta en `auth/src/main/java/com/bcp/workshop/auth/UserRepository.java:19-129`;
hash y verificación de contraseña en `auth/src/main/java/com/bcp/workshop/auth/PasswordHasher.java:11-86`;
creación de token en `auth/src/main/java/com/bcp/workshop/auth/LegacyTokenUtil.java:8-15`.

## Pruebas

La suite de auth cubre login válido/inválido, campos requeridos, el manejo 500
observado, usuario con comilla, SQL parametrizado, hashing, migración idempotente
y servicio de autenticación.
`auth/src/test/java/com/bcp/workshop/auth/AuthResourceTest.java:15`;
`auth/src/test/java/com/bcp/workshop/auth/UserRepositoryTest.java:29`;
`auth/src/test/java/com/bcp/workshop/auth/AuthenticationServiceTest.java:12`;
`auth/src/test/java/com/bcp/workshop/auth/PasswordHasherTest.java:10`.
Resultado final: `mvn verify` desde `auth/`, con DB SQLite aislada,
16 pruebas aprobadas; cobertura de líneas `AuthResource` 26/26 (100%),
`AuthenticationService` 11/11 (100%), `UserRepository` 61/65 (93,8%) y
`PasswordHasher` 37/39 (94,9%). Ejecuciones por ID: `PLAN.md`, sección
«Ejecuciones de implementación (auth)».
