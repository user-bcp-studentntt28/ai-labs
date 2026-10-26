package com.bcp.workshop.auth;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

final class PasswordHasher {
    private static final String HASH_SCHEME = "pbkdf2-sha256";
    private static final String KEY_DERIVATION_ALGORITHM = "PBKDF2WithHmacSHA256";
    private static final int ITERATION_COUNT = 600_000;
    private static final int SALT_LENGTH_BYTES = 16;
    private static final int HASH_LENGTH_BITS = 256;
    private static final int HASH_LENGTH_BYTES = HASH_LENGTH_BITS / Byte.SIZE;
    private static final int HASH_FIELD_COUNT = 4;
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    String hash(String password) {
        byte[] salt = new byte[SALT_LENGTH_BYTES];
        SECURE_RANDOM.nextBytes(salt);
        byte[] derivedKey = deriveKey(password, salt);
        return String.join(
                "$",
                HASH_SCHEME,
                Integer.toString(ITERATION_COUNT),
                Base64.getEncoder().encodeToString(salt),
                Base64.getEncoder().encodeToString(derivedKey)
        );
    }

    boolean verify(String password, String encodedPassword) {
        if (password == null) {
            return false;
        }
        EncodedPassword parsedPassword = parseEncodedPassword(encodedPassword);
        if (parsedPassword == null) {
            return false;
        }
        return MessageDigest.isEqual(
                parsedPassword.hash(),
                deriveKey(password, parsedPassword.salt())
        );
    }

    static boolean isEncoded(String value) {
        return parseEncodedPassword(value) != null;
    }

    private static EncodedPassword parseEncodedPassword(String encodedPassword) {
        if (encodedPassword == null) {
            return null;
        }

        String[] fields = encodedPassword.split("\\$", -1);
        if (fields.length != HASH_FIELD_COUNT || !HASH_SCHEME.equals(fields[0])) {
            return null;
        }

        try {
            if (Integer.parseInt(fields[1]) != ITERATION_COUNT) {
                return null;
            }
            byte[] salt = Base64.getDecoder().decode(fields[2]);
            byte[] hash = Base64.getDecoder().decode(fields[3]);
            if (salt.length != SALT_LENGTH_BYTES || hash.length != HASH_LENGTH_BYTES) {
                return null;
            }
            return new EncodedPassword(salt, hash);
        } catch (IllegalArgumentException error) {
            return null;
        }
    }

    private byte[] deriveKey(String password, byte[] salt) {
        PBEKeySpec keySpec = new PBEKeySpec(password.toCharArray(), salt, ITERATION_COUNT, HASH_LENGTH_BITS);
        try {
            return SecretKeyFactory.getInstance(KEY_DERIVATION_ALGORITHM)
                    .generateSecret(keySpec)
                    .getEncoded();
        } catch (GeneralSecurityException error) {
            throw new IllegalStateException("PBKDF2 password hashing is unavailable", error);
        } finally {
            keySpec.clearPassword();
        }
    }

    private record EncodedPassword(byte[] salt, byte[] hash) {}
}
