package com.bcp.workshop.auth;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeAll;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.sql.Connection;
import java.sql.Driver;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.logging.Logger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class UserRepositoryTest {
    private static final String SQLITE_URL = System.getenv().getOrDefault(
            "AUTH_DB_URL",
            "jdbc:sqlite:./target/auth-characterization.db"
    );
    private static final String EXPECTED_LOOKUP_SQL =
            "SELECT id, username, password, display_name, role FROM legacy_users WHERE username=?";
    private static final String LEGACY_USERNAME = "migration-fixture";
    private static final String LEGACY_PASSWORD = "LocalFixturePassword123!";

    @BeforeAll
    static void loadSqliteDriver() throws ClassNotFoundException {
        Class.forName("org.sqlite.JDBC");
    }

    @Test
    void credentialsLookupUsesBoundParameters() throws SQLException {
        Driver sqliteDriver = DriverManager.getDriver(SQLITE_URL);
        DriverManager.deregisterDriver(sqliteDriver);
        RecordingSqliteDriver recordingDriver = new RecordingSqliteDriver(sqliteDriver);
        DriverManager.registerDriver(recordingDriver);

        try {
            UserRepository database = new UserRepository(SQLITE_URL);
            assertNull(database.findByCredentials("missing'user", "wrong-password"));
            assertEquals(EXPECTED_LOOKUP_SQL, recordingDriver.preparedSql);
            assertEquals(Map.of(1, "missing'user"), recordingDriver.boundParameters);
            assertNull(recordingDriver.statementSql);
        } finally {
            DriverManager.deregisterDriver(recordingDriver);
            DriverManager.registerDriver(sqliteDriver);
        }
    }

    @Test
    void initializationPreservesExistingCredentialBehavior() {
        UserRepository database = new UserRepository(SQLITE_URL);

        database.initialize();
        UserRecord initialLogin = database.findByCredentials("student", "Workshop123!");
        assertNotNull(initialLogin);
        assertNull(database.findByCredentials("student", "IncorrectPassword123!"));

        database.initialize();
        UserRecord repeatedLogin = database.findByCredentials("student", "Workshop123!");
        assertNotNull(repeatedLogin);
        assertEquals(initialLogin.username(), repeatedLogin.username());
    }

    @Test
    void seedPasswordsAreStoredAsHashes() throws SQLException {
        new UserRepository(SQLITE_URL).initialize();

        String storedPassword = readStoredPassword("student");

        assertNotEquals("Workshop123!", storedPassword);
        assertTrue(storedPassword.startsWith("pbkdf2-sha256$"));
    }

    @Test
    void initializationMigratesLegacyPasswordsAndIsIdempotent() throws SQLException {
        UserRepository database = new UserRepository(SQLITE_URL);
        database.initialize();
        insertLegacyCredential(LEGACY_USERNAME, LEGACY_PASSWORD);

        database.initialize();

        String storedPassword = readStoredPassword(LEGACY_USERNAME);
        assertNotEquals(LEGACY_PASSWORD, storedPassword);
        assertTrue(storedPassword.startsWith("pbkdf2-sha256$"));
        assertNotNull(database.findByCredentials(LEGACY_USERNAME, LEGACY_PASSWORD));

        database.initialize();

        assertEquals(storedPassword, readStoredPassword(LEGACY_USERNAME));
        assertNotNull(database.findByCredentials(LEGACY_USERNAME, LEGACY_PASSWORD));
    }

    private static void insertLegacyCredential(String username, String password) throws SQLException {
        try (Connection connection = DriverManager.getConnection(SQLITE_URL);
             PreparedStatement statement = connection.prepareStatement(
                     "INSERT OR IGNORE INTO legacy_users(username,password,display_name,role) VALUES (?,?,?,?)")) {
            statement.setString(1, username);
            statement.setString(2, password);
            statement.setString(3, "Migration Fixture");
            statement.setString(4, "TEST");
            statement.executeUpdate();
        }
    }

    private static String readStoredPassword(String username) throws SQLException {
        try (Connection connection = DriverManager.getConnection(SQLITE_URL);
             PreparedStatement statement = connection.prepareStatement(
                     "SELECT password FROM legacy_users WHERE username=?")) {
            statement.setString(1, username);
            try (ResultSet result = statement.executeQuery()) {
                assertTrue(result.next());
                return result.getString("password");
            }
        }
    }

    private static final class RecordingSqliteDriver implements Driver {
        private final Driver delegate;
        private final ConcurrentMap<Integer, String> boundParameters = new ConcurrentHashMap<>();
        private String preparedSql;
        private String statementSql;

        private RecordingSqliteDriver(Driver delegate) {
            this.delegate = delegate;
        }

        @Override
        public Connection connect(String url, Properties info) throws SQLException {
            Connection connection = delegate.connect(url, info);
            if (connection == null) {
                return null;
            }
            return proxy(Connection.class, connection, (method, arguments, target) -> {
                if (method.getName().equals("prepareStatement") && arguments[0] instanceof String sql) {
                    preparedSql = sql;
                    PreparedStatement statement = (PreparedStatement) invoke(method, target, arguments);
                    return recordingPreparedStatement(statement);
                }
                if (method.getName().equals("createStatement")) {
                    Statement statement = (Statement) invoke(method, target, arguments);
                    return recordingStatement(statement);
                }
                return invoke(method, target, arguments);
            });
        }

        private PreparedStatement recordingPreparedStatement(PreparedStatement statement) {
            return proxy(PreparedStatement.class, statement, (method, arguments, target) -> {
                if (method.getName().equals("setString") && arguments[0] instanceof Integer index) {
                    boundParameters.put(index, (String) arguments[1]);
                }
                return invoke(method, target, arguments);
            });
        }

        private Statement recordingStatement(Statement statement) {
            return proxy(Statement.class, statement, (method, arguments, target) -> {
                if (method.getName().equals("executeQuery") && arguments != null && arguments.length == 1) {
                    statementSql = (String) arguments[0];
                }
                return invoke(method, target, arguments);
            });
        }

        @Override
        public boolean acceptsURL(String url) throws SQLException {
            return delegate.acceptsURL(url);
        }

        @Override
        public java.sql.DriverPropertyInfo[] getPropertyInfo(String url, Properties info) throws SQLException {
            return delegate.getPropertyInfo(url, info);
        }

        @Override
        public int getMajorVersion() {
            return delegate.getMajorVersion();
        }

        @Override
        public int getMinorVersion() {
            return delegate.getMinorVersion();
        }

        @Override
        public boolean jdbcCompliant() {
            return delegate.jdbcCompliant();
        }

        @Override
        public Logger getParentLogger() {
            return Logger.getLogger(RecordingSqliteDriver.class.getName());
        }
    }

    @FunctionalInterface
    private interface JdbcInvocation {
        Object invoke(Method method, Object[] arguments, Object target) throws Throwable;
    }

    private static <T> T proxy(Class<T> type, Object target, JdbcInvocation invocation) {
        Object proxy = Proxy.newProxyInstance(
                type.getClassLoader(),
                new Class<?>[]{type},
                (ignored, method, arguments) -> invocation.invoke(method, arguments, target));
        return type.cast(proxy);
    }

    private static Object invoke(Method method, Object target, Object[] arguments) throws Throwable {
        try {
            return method.invoke(target, arguments);
        } catch (InvocationTargetException error) {
            throw error.getCause();
        }
    }
}
