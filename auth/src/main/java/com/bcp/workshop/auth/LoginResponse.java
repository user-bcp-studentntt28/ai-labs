package com.bcp.workshop.auth;

public record LoginResponse(String token, int expiresIn, UserResponse user, String debug) {
    public record UserResponse(String username, String displayName, String role) {}
}
