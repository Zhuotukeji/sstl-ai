-- SSTL V1 search arbitrage distribution schema.
-- Dialect: MySQL 8.x compatible.

CREATE TABLE IF NOT EXISTS sstl_platform (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(128) NOT NULL,
  pixel_param_name VARCHAR(128) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sstl_offer (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  platform_id BIGINT NULL,
  landing_page_url TEXT NOT NULL,
  external_campaign_id VARCHAR(255) NULL,
  inject_pixel TINYINT(1) NOT NULL DEFAULT 0,
  pixel_id BIGINT NULL,
  pixel_param_name VARCHAR(128) NULL,
  tag_id BIGINT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  created_by BIGINT NULL,
  updated_by BIGINT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_offer_platform (platform_id),
  INDEX idx_offer_tag (tag_id),
  INDEX idx_offer_status (status)
);

CREATE TABLE IF NOT EXISTS sstl_internal_campaign (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  campaign_id VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  domain_id BIGINT NULL,
  tracking_domain VARCHAR(255) NULL,
  tracking_url TEXT NULL,
  tag_id BIGINT NULL,
  target_countries JSON NULL,
  check_params JSON NULL,
  macro_params JSON NULL,
  fallback_url TEXT NULL,
  fallback_page_id BIGINT NULL,
  enable_anti_tracking TINYINT(1) NOT NULL DEFAULT 1,
  enhanced_display_enabled TINYINT(1) NOT NULL DEFAULT 0,
  enhanced_template_id BIGINT NULL,
  enhanced_target_countries JSON NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  created_by BIGINT NULL,
  updated_by BIGINT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_internal_campaign_domain (domain_id),
  INDEX idx_internal_campaign_tag (tag_id),
  INDEX idx_internal_campaign_status (status)
);

CREATE TABLE IF NOT EXISTS sstl_campaign_offer_binding (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  internal_campaign_id BIGINT NOT NULL,
  offer_id BIGINT NOT NULL,
  weight INT NOT NULL DEFAULT 100,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_campaign_offer (internal_campaign_id, offer_id),
  INDEX idx_binding_campaign (internal_campaign_id),
  INDEX idx_binding_offer (offer_id),
  INDEX idx_binding_status (status)
);

CREATE TABLE IF NOT EXISTS sstl_redirect_log (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  hit_id VARCHAR(64) NOT NULL UNIQUE,
  visitor_id VARCHAR(64) NULL,
  campaign_id VARCHAR(64) NULL,
  internal_campaign_id BIGINT NULL,
  offer_id BIGINT NULL,
  redirect_type VARCHAR(32) NOT NULL,
  suspicious_reason VARCHAR(255) NULL,
  country VARCHAR(16) NULL,
  ip_hash VARCHAR(128) NULL,
  user_agent_hash VARCHAR(128) NULL,
  referer TEXT NULL,
  origin VARCHAR(255) NULL,
  request_query JSON NULL,
  target_url TEXT NULL,
  redirected_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_redirect_campaign_time (campaign_id, redirected_at),
  INDEX idx_redirect_offer_time (offer_id, redirected_at),
  INDEX idx_redirect_type_time (redirect_type, redirected_at),
  INDEX idx_redirect_country_time (country, redirected_at)
);

CREATE TABLE IF NOT EXISTS sstl_automation_plan (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  dimension_type VARCHAR(64) NOT NULL,
  dimension_id VARCHAR(128) NULL,
  trigger_type VARCHAR(64) NOT NULL,
  trigger_config JSON NULL,
  cooldown_minutes INT NOT NULL DEFAULT 60,
  is_enabled TINYINT(1) NOT NULL DEFAULT 0,
  created_by BIGINT NULL,
  updated_by BIGINT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_automation_plan_dimension (dimension_type, dimension_id),
  INDEX idx_automation_plan_enabled (is_enabled)
);

CREATE TABLE IF NOT EXISTS sstl_automation_rule (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  plan_id BIGINT NOT NULL,
  name VARCHAR(255) NOT NULL,
  conditions_json JSON NOT NULL,
  actions_json JSON NOT NULL,
  priority INT NOT NULL DEFAULT 100,
  is_enabled TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_automation_rule_plan (plan_id),
  INDEX idx_automation_rule_enabled (is_enabled)
);

CREATE TABLE IF NOT EXISTS sstl_automation_execution_log (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  plan_id BIGINT NULL,
  rule_id BIGINT NULL,
  target_type VARCHAR(64) NOT NULL,
  target_id VARCHAR(128) NULL,
  dry_run TINYINT(1) NOT NULL DEFAULT 1,
  matched_conditions JSON NULL,
  actions JSON NULL,
  result VARCHAR(32) NOT NULL,
  error_message TEXT NULL,
  executed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_exec_rule_time (rule_id, executed_at),
  INDEX idx_exec_target_time (target_type, target_id, executed_at),
  INDEX idx_exec_result_time (result, executed_at)
);

CREATE TABLE IF NOT EXISTS sstl_service_credential (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  service_type VARCHAR(64) NOT NULL,
  service_code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  encrypted_config TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  last_test_at DATETIME NULL,
  created_by BIGINT NULL,
  updated_by BIGINT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_service_code_name (service_type, service_code, name),
  INDEX idx_service_status (service_type, status)
);

CREATE TABLE IF NOT EXISTS sstl_compliance_report (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  platform VARCHAR(64) NOT NULL,
  campaign_id VARCHAR(64) NULL,
  offer_id BIGINT NULL,
  keyword VARCHAR(255) NULL,
  status VARCHAR(32) NOT NULL,
  reason TEXT NULL,
  raw_payload JSON NULL,
  last_update DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_compliance_campaign (platform, campaign_id),
  INDEX idx_compliance_offer (platform, offer_id),
  INDEX idx_compliance_status (platform, status)
);

CREATE TABLE IF NOT EXISTS sstl_material_ai_analysis (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  material_id BIGINT NOT NULL,
  ai_score DECIMAL(6,2) NULL,
  visual_language VARCHAR(64) NULL,
  audio_language VARCHAR(64) NULL,
  scene_tags JSON NULL,
  risk_tags JSON NULL,
  suggestion TEXT NULL,
  input_tokens INT NOT NULL DEFAULT 0,
  output_tokens INT NOT NULL DEFAULT 0,
  estimated_cost DECIMAL(12,6) NOT NULL DEFAULT 0,
  analyzed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_material_analysis (material_id),
  INDEX idx_material_ai_score (ai_score)
);
