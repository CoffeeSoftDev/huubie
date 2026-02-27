-- =====================================================
-- CONVERTIR BASE DE DATOS EXISTENTE A UTF8MB4
-- Usar este script si ya tienes una base de datos
-- =====================================================

-- IMPORTANTE: Reemplaza 'tu_base_datos' con el nombre real

-- 1. CONVERTIR LA BASE DE DATOS
ALTER DATABASE `tu_base_datos` 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

-- 2. CONVERTIR LA TABLA PROJECTS (si ya existe)
ALTER TABLE `projects` 
CONVERT TO CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

-- 3. CONVERTIR CAMPOS ESPECÍFICOS (si es necesario)
ALTER TABLE `projects` 
MODIFY `name` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
MODIFY `size` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL;

-- 4. VERIFICAR LA CONVERSIÓN
SHOW CREATE TABLE `projects`;

-- 5. PROBAR CON EMOJIS
SELECT * FROM `projects` WHERE `name` LIKE '%🚀%';
