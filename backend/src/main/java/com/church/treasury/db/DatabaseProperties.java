package com.church.treasury.db;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Settings under "treasury.db" in application.yml. */
@ConfigurationProperties(prefix = "treasury.db")
public record DatabaseProperties(String url, String username, String password, String schema, boolean freshSchema) {}
