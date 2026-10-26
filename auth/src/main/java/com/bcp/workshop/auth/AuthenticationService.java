package com.bcp.workshop.auth;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.apache.commons.text.StringEscapeUtils;

import java.util.Optional;

@ApplicationScoped
public class AuthenticationService {
    private static final int TOKEN_EXPIRATION_SECONDS = 3600;
    private static final String LEGACY_FLOW_DEBUG_LABEL = "authenticated-with-legacy-flow";

    @Inject
    UserRepository userRepository;

    public Optional<LoginResponse> authenticate(String username, String password) {
        UserRecord user = userRepository.findByCredentials(username, password);
        if (user == null) {
            return Optional.empty();
        }
        return Optional.of(createLoginResponse(user));
    }

    private LoginResponse createLoginResponse(UserRecord user) {
        LoginResponse.UserResponse userResponse = new LoginResponse.UserResponse(
                user.username(),
                StringEscapeUtils.escapeHtml4(user.displayName()),
                user.role()
        );
        return new LoginResponse(
                LegacyTokenUtil.create(user.username(), user.role()),
                TOKEN_EXPIRATION_SECONDS,
                userResponse,
                LEGACY_FLOW_DEBUG_LABEL
        );
    }
}
