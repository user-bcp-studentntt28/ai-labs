package com.bcp.workshop.auth;

import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.util.Map;
import java.util.Optional;

@Path("/auth")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
public class AuthResource {
    @Inject
    AuthenticationService authenticationService;

    @POST
    @Path("/login")
    public Response login(LoginRequest request) {
        Optional<String> validationError = validateRequest(request);
        if (validationError.isPresent()) {
            return badRequest(validationError.get());
        }

        try {
            Optional<LoginResponse> loginResponse =
                    authenticationService.authenticate(request.username, request.password);
            if (loginResponse.isEmpty()) {
                return unauthorized(request.username);
            }
            return Response.ok(loginResponse.get()).build();
        } catch (Exception error) {
            return internalServerError(error);
        }
    }

    private Optional<String> validateRequest(LoginRequest request) {
        if (request == null) {
            return Optional.of("Request is null");
        }
        if (request.username == null || request.username.trim().isEmpty()) {
            return Optional.of("Username is required");
        }
        if (request.password == null || request.password.trim().isEmpty()) {
            return Optional.of("Password is required");
        }
        return Optional.empty();
    }

    private Response badRequest(String message) {
        return Response.status(Response.Status.BAD_REQUEST).entity(Map.of("message", message)).build();
    }

    private Response unauthorized(String username) {
        return Response.status(Response.Status.UNAUTHORIZED)
                .entity(Map.of("message", "Invalid user " + username + " or password"))
                .build();
    }

    private Response internalServerError(Exception error) {
        return Response.status(Response.Status.INTERNAL_SERVER_ERROR).entity(Map.of(
                "message", error.getMessage() == null ? "Unknown error" : error.getMessage(),
                "exception", error.getClass().getName()
        )).build();
    }
}
