-- ERP Grupo Varoch — esquema de acceso (ver docs/tabla-usuarios.md)
-- BD local WAMP: rfwsmqex_gv_erp

CREATE DATABASE IF NOT EXISTS rfwsmqex_gv_erp
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE rfwsmqex_gv_erp;

CREATE TABLE IF NOT EXISTS companies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS branches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    ubication VARCHAR(200) NULL,
    logo VARCHAR(255) NULL,
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    company_id INT NOT NULL,
    CONSTRAINT fk_branches_company FOREIGN KEY (company_id) REFERENCES companies(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    photo VARCHAR(255) NULL,
    is_owner TINYINT(1) NOT NULL DEFAULT 0,
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    company_id INT NOT NULL,
    branch_id INT NULL,
    CONSTRAINT fk_users_company FOREIGN KEY (company_id) REFERENCES companies(id),
    CONSTRAINT fk_users_branch FOREIGN KEY (branch_id) REFERENCES branches(id)
) ENGINE=InnoDB;

-- Seed minimo para probar el login (password: admin123, cambiar en cuanto haya alta real de usuarios)
INSERT INTO companies (name)
SELECT 'Grupo Varoch' WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = 'Grupo Varoch');

INSERT INTO branches (name, ubication, company_id)
SELECT 'Corporativo', NULL, (SELECT id FROM companies WHERE name = 'Grupo Varoch')
WHERE NOT EXISTS (SELECT 1 FROM branches WHERE name = 'Corporativo');

INSERT INTO users (name, last_name, email, password, is_owner, company_id, branch_id)
SELECT 'Admin', 'GV', 'admin@grupovaroch.com',
       '$2y$10$h3v4/RAw4ypZiFFgecOsROzbAPzJmOm5JFzVItFT.25xrdr95STRi',
       1,
       (SELECT id FROM companies WHERE name = 'Grupo Varoch'),
       (SELECT id FROM branches  WHERE name = 'Corporativo')
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@grupovaroch.com');
