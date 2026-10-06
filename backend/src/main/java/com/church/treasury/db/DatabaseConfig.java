package com.church.treasury.db;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.regex.Pattern;
import javax.sql.DataSource;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;

/**
 * Connects to PostgreSQL and creates the tables and starting items the first time it runs.
 */
@Configuration
@EnableConfigurationProperties(DatabaseProperties.class)
public class DatabaseConfig {

    private static final Pattern SCHEMA_NAME = Pattern.compile("[a-z_][a-z0-9_]{0,62}");

    @Bean(destroyMethod = "close")
    public HikariDataSource dataSource(DatabaseProperties props) throws SQLException {
        String schema = props.schema() == null ? "" : props.schema().trim();
        if (!schema.isEmpty()) {
            if (!SCHEMA_NAME.matcher(schema).matches()) {
                throw new IllegalStateException(
                    "treasury.db.schema may only use lower-case letters, digits and underscores: " + schema);
            }
            prepareSchema(props, schema);
        }

        HikariConfig cfg = new HikariConfig();
        cfg.setPoolName("treasury-postgres");
        cfg.setJdbcUrl(props.url());
        cfg.setUsername(props.username());
        cfg.setPassword(props.password());
        cfg.setMaximumPoolSize(5);
        if (!schema.isEmpty()) {
            cfg.setSchema(schema);   // every connection uses this schema
        }
        return new HikariDataSource(cfg);
    }

    /** Creates the schema if it is missing (and empties it first when freshSchema is on, for tests). */
    private static void prepareSchema(DatabaseProperties props, String schema) throws SQLException {
        try (Connection con = DriverManager.getConnection(props.url(), props.username(), props.password());
             Statement st = con.createStatement()) {
            if (props.freshSchema() && !schema.equals("public")) {
                st.execute("DROP SCHEMA IF EXISTS \"" + schema + "\" CASCADE");
            }
            st.execute("CREATE SCHEMA IF NOT EXISTS \"" + schema + "\"");
        }
    }

    /** Creates the tables and seeds funds and items if the database is new. */
    @Bean
    public ApplicationRunner schemaInitializer(DataSource ds) {
        return args -> {
            try (Connection con = ds.getConnection()) {
                boolean exists;
                try (Statement st = con.createStatement();
                     ResultSet rs = st.executeQuery("SELECT to_regclass('funds') IS NOT NULL")) {
                    rs.next();
                    exists = rs.getBoolean(1);
                }
                if (!exists) {
                    con.setAutoCommit(false);        // all or nothing: no half-built database
                    try {
                        ScriptUtils.executeSqlScript(con, new ClassPathResource("db/V1__schema.sql"));
                        con.commit();
                    } catch (RuntimeException e) {
                        con.rollback();
                        throw e;
                    } finally {
                        con.setAutoCommit(true);
                    }
                }
            }
        };
    }
}
