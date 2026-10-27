package com.bcp.workshop.auth;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.nullValue;

@QuarkusTest
class CorsConfigurationTest {
    private static final String WORKSHOP_FRONTEND_ORIGIN = "http://localhost:4200";
    private static final String EXTERNAL_ORIGIN = "https://sitio-externo.example";

    @Test
    void allowsWorkshopFrontendOrigin() {
        given()
                .header("Origin", WORKSHOP_FRONTEND_ORIGIN)
                .header("Access-Control-Request-Method", "POST")
                .when().options("/auth/login")
                .then()
                .header("Access-Control-Allow-Origin", WORKSHOP_FRONTEND_ORIGIN);
    }

    @Test
    void doesNotAllowExternalOrigin() {
        given()
                .header("Origin", EXTERNAL_ORIGIN)
                .header("Access-Control-Request-Method", "POST")
                .when().options("/auth/login")
                .then()
                .header("Access-Control-Allow-Origin", nullValue());
    }
}
