package com.bcp.workshop.auth;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;

@QuarkusTest
class HealthEndpointTest {
    private static final String FORCE_HEALTH_DOWN_PROPERTY = "auth.test.health.down";

    @Test
    void reportsHealthyStatusWithoutAuthentication() {
        given()
                .accept("application/json")
                .when().get("/q/health")
                .then()
                .statusCode(200)
                .body("status", is("UP"))
                .body("checks[0].name", is(TestReadinessCheck.CHECK_NAME))
                .body("checks[0].status", is("UP"));
    }

    @Test
    void remainsPublicForRequestWithoutBodyOrAuthorizationHeader() {
        given()
                .when().get("/q/health")
                .then()
                .statusCode(200)
                .body("status", is("UP"));
    }

    @Test
    void respondsServiceUnavailableWhenReadinessCheckIsDown() {
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
    }
}
