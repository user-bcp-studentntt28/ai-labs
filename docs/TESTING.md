# Pruebas de contratos — auth

## Matriz por endpoint

| endpoint | caso | tipo | resultado esperado |
|---|---|---|---|
| `GET /q/health` | Estado saludable | Camino feliz | `200`; JSON con `status: "UP"` y un check de readiness en estado `UP` en el entorno de test. |
| `GET /q/health` | GET sin body ni `Authorization` | Borde | `200`; el endpoint público no requiere credenciales ni request body. |
| `GET /q/health` | Check de readiness de test en estado no saludable | Error documentado `503` | `503`; JSON con `status: "DOWN"` y el check `test-readiness` en `DOWN`. El check existe solo en pruebas. |
| `POST /auth/login` | Credenciales ficticias válidas y campo opcional `client` | Camino feliz | `200`; `token` no nulo, `expiresIn: 3600`, usuario `student` y etiqueta `debug` legacy. |
| `POST /auth/login` | Username con comilla tratado como dato | Borde | `401`; no autentica y conserva el mensaje para el username recibido. |
| `POST /auth/login` | Username o password con espacios | Borde | `400`; mensaje `Username is required` o `Password is required`, respectivamente. |
| `POST /auth/login` | Cuerpo JSON `null` | Error documentado `400` | `{"message":"Request is null"}`. |
| `POST /auth/login` | Campo `username` ausente | Error documentado `400` | `{"message":"Username is required"}`. |
| `POST /auth/login` | Campo `password` ausente | Error documentado `400` | `{"message":"Password is required"}`. |
| `POST /auth/login` | Credenciales incorrectas | Error documentado `401` | `{"message":"Invalid user student or password"}`. |
| `POST /auth/login` | Fallo ficticio del servicio de autenticación | Error documentado `500` | `message` y `exception` reflejan la excepción de test, conforme al contrato actual. |

Los tests de auth no caracterizan errores del parser JSON anteriores al recurso;
`docs/ENDPOINTS.md` los deja como pregunta abierta. No se inventa un resultado
esperado para ellos. El check de readiness que permite verificar `503` y el
servicio alternativo que permite verificar `500` son fixtures de test, no
configuración de producción.

## Código de los tests

El código completo y ejecutable está en las clases enlazadas. Fragmentos
representativos de las comprobaciones HTTP:

### `GET /q/health`

`HealthEndpointTest`:

```java
given()
        .accept("application/json")
        .when().get("/q/health")
        .then()
        .statusCode(200)
        .body("status", is("UP"));
```

El caso `503` activa el check solamente durante la petición y limpia la
propiedad en `finally`:

```java
System.setProperty(FORCE_HEALTH_DOWN_PROPERTY, "true");
try {
    given()
            .accept("application/json")
            .when().get("/q/health")
            .then()
            .statusCode(503)
            .body("status", is("DOWN"))
            .body("checks[0].name", is(TestReadinessCheck.CHECK_NAME))
            .body("checks[0].status", is("DOWN"));
} finally {
    System.clearProperty(FORCE_HEALTH_DOWN_PROPERTY);
}
```

Fuentes: [`HealthEndpointTest.java`](../auth/src/test/java/com/bcp/workshop/auth/HealthEndpointTest.java)
y [`TestReadinessCheck.java`](../auth/src/test/java/com/bcp/workshop/auth/TestReadinessCheck.java).

### `POST /auth/login`

Camino feliz y errores HTTP, en [`AuthResourceTest.java`](../auth/src/test/java/com/bcp/workshop/auth/AuthResourceTest.java):

```java
given()
        .contentType("application/json")
        .body("{\"username\":\"student\",\"password\":\"Workshop123!\",\"client\":\"angular-workshop\"}")
        .when().post("/auth/login")
        .then()
        .statusCode(200)
        .body("user.username", is("student"))
        .body("expiresIn", is(3600))
        .body("token", notNullValue());
```

La misma clase cubre cuerpo nulo, cada campo requerido ausente, credenciales
inválidas y la respuesta `500` a través de HTTP. El fallo es controlado por la
alternativa exclusiva de test
[`TestAuthenticationService.java`](../auth/src/test/java/com/bcp/workshop/auth/TestAuthenticationService.java).

## Ejecuciones y cobertura

Componente: **auth**. Las ejecuciones se realizaron desde `auth/`. Los tests
del repositorio usan explícitamente una base SQLite aislada dentro de
`auth/target/`, sin depender de que `AUTH_DB_URL` esté definida.

| Componente / IDs | Comando | Directorio | Código de salida | Resultado |
|---|---|---|---:|---|
| auth — contratos `GET /q/health` y `POST /auth/login` | `$env:AUTH_DB_URL='jdbc:sqlite:./target/auth-endpoints-test.db'; mvn '-Dtest=AuthResourceTest,HealthEndpointTest' test` | `auth/` | 0 | BUILD SUCCESS; 11 pruebas aprobadas, 0 fallidas. |
| auth — regresión completa antes de independizar la URL del test | `$env:AUTH_DB_URL='jdbc:sqlite:./target/auth-endpoints-final.db'; mvn verify` | `auth/` | 0 | BUILD SUCCESS; 19 pruebas aprobadas, 0 fallidas, 0 omitidas. JaCoCo generó el reporte en `auth/target/site/jacoco/index.html`. |
| auth — H-AUTH-02, reproducción del fallo local | `mvn '-Dtest=UserRepositoryTest' test` con `AUTH_DB_URL` sin definir | `auth/` | 1 | BUILD FAILURE; 4 pruebas, 2 errores por `no such table: legacy_users`, 0 fallidas. |
| auth — suite completa tras corregir la URL de test | `mvn verify` con `AUTH_DB_URL` sin definir | `auth/` | 0 | BUILD SUCCESS; 19 pruebas aprobadas, 0 fallidas, 0 omitidas. JaCoCo generó el reporte en `auth/target/site/jacoco/index.html`. |

Método de cobertura: JaCoCo 0.8.12 instrumenta la ejecución de `mvn verify`;
se leyeron los contadores `LINE` por clase del XML
`auth/target/site/jacoco/jacoco.xml`. Cobertura de líneas en clases de auth:

| clase | líneas cubiertas / totales | cobertura |
|---|---:|---:|
| `AuthResource` | 26 / 26 | 100% |
| `AuthenticationService` | 11 / 11 | 100% |
| `UserRepository` | 64 / 68 | 94,1% |
| `PasswordHasher` | 37 / 39 | 94,9% |

La métrica cubre código de producción, no cuenta líneas de los tests Java. La
clase `HealthEndpointTest` valida la extensión SmallRye Health; JaCoCo no
atribuye su implementación externa a las clases de auth.

## Fallos, pendientes y pruebas propuestas

- **Fallos:** la reproducción previa a la corrección del harness falló como se
  describe en la tabla. La ejecución completa posterior pasó.
- **Corrección de harness:** `UserRepositoryTest` originalmente abría
  `target/auth-characterization.db` para preparar/leer fixtures, mientras que
  `UserRepository` inicializaba `data/workshop.db` cuando no existía
  `AUTH_DB_URL`. Reproducido con `mvn '-Dtest=UserRepositoryTest' test` sin esa
  variable: 2 errores por `no such table: legacy_users`. El repositorio ahora
  admite una URL de construcción package-private y las pruebas pasan la URL
  aislada explícitamente. Confirmado con el `mvn verify` completo posterior,
  también sin definir `AUTH_DB_URL`.
- **Pendiente:** no se probaron errores de JSON malformado ni de `Content-Type`
  incompatible porque el contrato los deja sin especificar y son manejados por
  Quarkus REST/Jackson.
- **Pruebas propuestas:** si auth registra checks de salud propios en el
  futuro, agregar casos de esos checks y actualizar `docs/ENDPOINTS.md` con
  sus estados y cuerpos verificados.

## Documentos consultados

- `README.md` — dirección local del servicio, credenciales ficticias y comando
  de pruebas documentado.
- `RETO.md` — inventario de candidatos auth; no se tomó como contrato.
- `docs/GOOD_PRACTICES.md` — referencias de pruebas y calidad para auth.
- `docs/ENDPOINTS.md` — endpoints, campos y respuestas a cubrir.
- Código y pruebas de `auth/`: `AuthResource`, `LoginRequest`,
  `LoginResponse`, `AuthenticationService`, `UserRepository`,
  `TestAuthenticationService`, `TestReadinessCheck`, `AuthResourceTest` y
  `HealthEndpointTest`.
