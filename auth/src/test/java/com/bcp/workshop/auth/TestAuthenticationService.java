package com.bcp.workshop.auth;

import jakarta.annotation.Priority;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Alternative;

@Alternative
@Priority(1)
@ApplicationScoped
public class TestAuthenticationService extends AuthenticationService {
    private static final String FORCE_AUTHENTICATION_ERROR_PROPERTY = "auth.test.force-error";

    @Override
    public java.util.Optional<LoginResponse> authenticate(String username, String password) {
        if (Boolean.getBoolean(FORCE_AUTHENTICATION_ERROR_PROPERTY)) {
            throw new IllegalStateException("Local test failure");
        }
        return super.authenticate(username, password);
    }
}
