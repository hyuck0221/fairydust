CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  github_id BIGINT UNSIGNED NOT NULL,
  github_login VARCHAR(255) NOT NULL,
  github_name VARCHAR(255) NULL,
  github_avatar_url VARCHAR(1024) NULL,
  github_access_token_enc TEXT NOT NULL,
  webhook_token CHAR(32) NOT NULL,
  fairy_webhook_secret_enc TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY users_github_id_unique (github_id),
  UNIQUE KEY users_webhook_token_unique (webhook_token)
);

CREATE TABLE IF NOT EXISTS webhook_mappings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  repo_owner VARCHAR(255) NOT NULL,
  repo_name VARCHAR(255) NOT NULL,
  project_name VARCHAR(255) NOT NULL,
  target_file VARCHAR(1024) NOT NULL DEFAULT 'README.md',
  show_name BOOLEAN NOT NULL DEFAULT TRUE,
  show_amount BOOLEAN NOT NULL DEFAULT FALSE,
  show_message BOOLEAN NOT NULL DEFAULT FALSE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY webhook_mappings_project_repo_unique (user_id, repo_owner, repo_name, project_name),
  CONSTRAINT webhook_mappings_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  mapping_id BIGINT UNSIGNED NOT NULL,
  payment_id VARCHAR(255) NOT NULL,
  event VARCHAR(255) NOT NULL,
  amount BIGINT NULL,
  fairy_name VARCHAR(255) NULL,
  fairy_email VARCHAR(255) NULL,
  fairy_message TEXT NULL,
  project_name VARCHAR(255) NOT NULL,
  source VARCHAR(255) NULL,
  raw_payload JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY payments_payment_id_unique (payment_id),
  CONSTRAINT payments_mapping_fk FOREIGN KEY (mapping_id) REFERENCES webhook_mappings (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  mapping_id BIGINT UNSIGNED NULL,
  status VARCHAR(32) NOT NULL,
  status_detail TEXT NULL,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  event_name VARCHAR(255) NULL,
  event_timestamp VARCHAR(255) NULL,
  payment_id VARCHAR(255) NULL,
  amount BIGINT NULL,
  fairy_name VARCHAR(255) NULL,
  fairy_message TEXT NULL,
  project_name VARCHAR(255) NULL,
  source VARCHAR(255) NULL,
  raw_payload JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY webhook_events_user_created_idx (user_id, created_at),
  KEY webhook_events_project_idx (user_id, project_name, created_at),
  CONSTRAINT webhook_events_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT webhook_events_mapping_fk FOREIGN KEY (mapping_id) REFERENCES webhook_mappings (id) ON DELETE SET NULL
);
