package com.bcp.workshop.auth;

import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.health.HealthCheck;
import org.eclipse.microprofile.health.HealthCheckResponse;
import org.eclipse.microprofile.health.Readiness;

@Readiness
@ApplicationScoped
public class TestReadinessCheck implements HealthCheck {
    static final String CHECK_NAME = "test-readiness";
    private static final String FORCE_HEALTH_DOWN_PROPERTY = "auth.test.health.down";

    @Override
    public HealthCheckResponse call() {
        return HealthCheckResponse.named(CHECK_NAME)
                .status(!Boolean.getBoolean(FORCE_HEALTH_DOWN_PROPERTY))
                .build();
    }
}
