package com.bcp.workshop.auth;

import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

@ApplicationScoped
public class UserRepository {
    private static final String DEFAULT_DB_URL = "jdbc:sqlite:./data/workshop.db";
    private static final String CREATE_USERS_TABLE_SQL =
            "CREATE TABLE IF NOT EXISTS legacy_users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT NOT NULL, display_name TEXT NOT NULL, role TEXT NOT NULL)";
    private static final String SELECT_ALL_PASSWORDS_SQL = "SELECT id, password FROM legacy_users";
    private static final String UPDATE_PASSWORD_SQL = "UPDATE legacy_users SET password=? WHERE id=?";
    private static final String SELECT_USER_SQL = "SELECT 1 FROM legacy_users WHERE username=?";
    private static final String INSERT_USER_SQL =
            "INSERT OR IGNORE INTO legacy_users(username,password,display_name,role) VALUES (?,?,?,?)";
    private static final String SELECT_CREDENTIALS_SQL =
            "SELECT id, username, password, display_name, role FROM legacy_users WHERE username=?";
    private static final List<SeedUser> DEFAULT_USERS = List.of(
            new SeedUser("student", "Workshop123!", "Workshop Student", "STUDENT"),
            new SeedUser("trainer", "Trainer123!", "Workshop Trainer", "TRAINER")
    );
    private static final PasswordHasher PASSWORD_HASHER = new PasswordHasher();
    private final String databaseUrl;

    public UserRepository() {
        this(System.getenv().getOrDefault("AUTH_DB_URL", DEFAULT_DB_URL));
    }

    UserRepository(String databaseUrl) {
        this.databaseUrl = databaseUrl;
    }

    @PostConstruct
    void initialize() {
        try {
            Files.createDirectories(Path.of("data"));
            try (Connection connection = DriverManager.getConnection(databaseUrl)) {
                createUsersTable(connection);
                migrateLegacyPasswords(connection);
                seedDefaultUsers(connection);
            }
        } catch (IOException | SQLException error) {
            throw new IllegalStateException("Unable to initialize the authentication database", error);
        }
    }

    public UserRecord findByCredentials(String username, String password) {
        try (Connection connection = DriverManager.getConnection(databaseUrl);
             PreparedStatement statement = connection.prepareStatement(SELECT_CREDENTIALS_SQL)) {
            statement.setString(1, username);
            try (ResultSet result = statement.executeQuery()) {
                if (!result.next() || !PASSWORD_HASHER.verify(password, result.getString("password"))) {
                    return null;
                }
                return new UserRecord(
                        result.getLong("id"),
                        result.getString("username"),
                        result.getString("display_name"),
                        result.getString("role")
                );
            }
        } catch (SQLException error) {
            error.printStackTrace();
            return null;
        }
    }

    private void createUsersTable(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.executeUpdate(CREATE_USERS_TABLE_SQL);
        }
    }

    private void migrateLegacyPasswords(Connection connection) throws SQLException {
        List<StoredPassword> legacyPasswords = findLegacyPasswords(connection);
        try (PreparedStatement statement = connection.prepareStatement(UPDATE_PASSWORD_SQL)) {
            for (StoredPassword storedPassword : legacyPasswords) {
                statement.setString(1, PASSWORD_HASHER.hash(storedPassword.password()));
                statement.setLong(2, storedPassword.id());
                statement.addBatch();
            }
            statement.executeBatch();
        }
    }

    private List<StoredPassword> findLegacyPasswords(Connection connection) throws SQLException {
        List<StoredPassword> legacyPasswords = new ArrayList<>();
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery(SELECT_ALL_PASSWORDS_SQL)) {
            while (result.next()) {
                String password = result.getString("password");
                if (!PasswordHasher.isEncoded(password)) {
                    legacyPasswords.add(new StoredPassword(result.getLong("id"), password));
                }
            }
        }
        return legacyPasswords;
    }

    private void seedDefaultUsers(Connection connection) throws SQLException {
        for (SeedUser user : DEFAULT_USERS) {
            if (!userExists(connection, user.username())) {
                insertUser(connection, user);
            }
        }
    }

    private boolean userExists(Connection connection, String username) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(SELECT_USER_SQL)) {
            statement.setString(1, username);
            try (ResultSet result = statement.executeQuery()) {
                return result.next();
            }
        }
    }

    private void insertUser(Connection connection, SeedUser user) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(INSERT_USER_SQL)) {
            statement.setString(1, user.username());
            statement.setString(2, PASSWORD_HASHER.hash(user.password()));
            statement.setString(3, user.displayName());
            statement.setString(4, user.role());
            statement.executeUpdate();
        }
    }

    private record SeedUser(String username, String password, String displayName, String role) {}

    private record StoredPassword(long id, String password) {}
}
