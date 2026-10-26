package com.bcp.workshop.auth;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PasswordHasherTest {
    private static final String PASSWORD = "LocalTestPassword123!";
    private final PasswordHasher passwordHasher = new PasswordHasher();

    @Test
    void hashesPasswordsWithDistinctSaltsAndVerifiesThem() {
        String firstHash = passwordHasher.hash(PASSWORD);
        String secondHash = passwordHasher.hash(PASSWORD);

        assertNotEquals(firstHash, secondHash);
        assertTrue(PasswordHasher.isEncoded(firstHash));
        assertTrue(passwordHasher.verify(PASSWORD, firstHash));
        assertFalse(passwordHasher.verify("IncorrectPassword123!", firstHash));
    }

    @Test
    void rejectsMalformedOrUnsupportedHashes() {
        List<String> malformedHashes = List.of(
                "unknown$600000$AA==$AA==",
                "pbkdf2-sha256$invalid$AA==$AA==",
                "pbkdf2-sha256$1$AA==$AA==",
                "pbkdf2-sha256$600000$!$!",
                "pbkdf2-sha256$600000$AA==$AA==",
                "pbkdf2-sha256$600000$AA==$AA==$extra"
        );

        assertFalse(passwordHasher.verify(null, malformedHashes.get(0)));
        assertFalse(passwordHasher.verify(PASSWORD, null));
        for (String malformedHash : malformedHashes) {
            assertFalse(passwordHasher.verify(PASSWORD, malformedHash));
        }
    }
}
