package com.bcp.workshop.auth;

import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AuthenticationServiceTest {
    @Test
    void returnsLoginResponseForAuthenticatedUser() {
        AuthenticationService service = new AuthenticationService();
        service.userRepository = repositoryReturning(new UserRecord(
                1,
                "student",
                "Workshop <Student>",
                "STUDENT"
        ));

        Optional<LoginResponse> result = service.authenticate("student", "Workshop123!");

        assertTrue(result.isPresent());
        LoginResponse response = result.orElseThrow();
        assertNotNull(response.token());
        assertEquals(3600, response.expiresIn());
        assertEquals(
                new LoginResponse.UserResponse("student", "Workshop &lt;Student&gt;", "STUDENT"),
                response.user()
        );
        assertEquals("authenticated-with-legacy-flow", response.debug());
    }

    @Test
    void returnsEmptyWhenCredentialsAreInvalid() {
        AuthenticationService service = new AuthenticationService();
        service.userRepository = repositoryReturning(null);

        assertFalse(service.authenticate("student", "wrong").isPresent());
    }

    private UserRepository repositoryReturning(UserRecord user) {
        return new UserRepository() {
            @Override
            public UserRecord findByCredentials(String username, String password) {
                return user;
            }
        };
    }
}
