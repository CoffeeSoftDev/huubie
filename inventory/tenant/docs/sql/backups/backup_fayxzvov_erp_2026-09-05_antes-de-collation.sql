-- MySQL dump 10.13  Distrib 8.0.31, for Win64 (x86_64)
--
-- Host: localhost    Database: fayxzvov_erp
-- ------------------------------------------------------
-- Server version	8.0.31

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `branches`
--

DROP TABLE IF EXISTS `branches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `branches` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  `ubication` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  `created_at` datetime DEFAULT NULL,
  `logo` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  `is_active` smallint DEFAULT '1',
  `company_id` int DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `company_id` (`company_id`) USING BTREE,
  CONSTRAINT `branches_ibfk_1` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `branches`
--

LOCK TABLES `branches` WRITE;
/*!40000 ALTER TABLE `branches` DISABLE KEYS */;
INSERT INTO `branches` VALUES (1,'Coffee Central','av.','2026-06-06 22:02:45',NULL,1,1),(2,'Coffee franquicia','En cafeto','2026-06-07 09:41:36',NULL,1,1);
/*!40000 ALTER TABLE `branches` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `companies`
--

DROP TABLE IF EXISTS `companies`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `companies` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` text,
  `database_name` text,
  `ubication` text,
  `created_at` datetime DEFAULT NULL,
  `rfc` text,
  `logo` text,
  `status` enum('pending','active','suspendend','cancelled') DEFAULT 'pending',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `companies`
--

LOCK TABLES `companies` WRITE;
/*!40000 ALTER TABLE `companies` DISABLE KEYS */;
INSERT INTO `companies` VALUES (1,'CoffeeSoft S.A.',NULL,NULL,'2026-06-06 21:13:07',NULL,NULL,'active'),(2,'Reginas Pasteleria',NULL,'Central','2026-06-13 18:30:17',NULL,NULL,'active');
/*!40000 ALTER TABLE `companies` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `coupon_redemptions`
--

DROP TABLE IF EXISTS `coupon_redemptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `coupon_redemptions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `redeemed_at` datetime DEFAULT NULL,
  `coupon_id` int DEFAULT NULL,
  `company_id` int DEFAULT NULL,
  `subscription_id` int DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `coupon_id` (`coupon_id`) USING BTREE,
  KEY `company_id` (`company_id`) USING BTREE,
  KEY `subscription_id` (`subscription_id`) USING BTREE,
  CONSTRAINT `coupon_redemptions_ibfk_1` FOREIGN KEY (`coupon_id`) REFERENCES `coupons` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `coupon_redemptions_ibfk_2` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `coupon_redemptions_ibfk_3` FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `coupon_redemptions`
--

LOCK TABLES `coupon_redemptions` WRITE;
/*!40000 ALTER TABLE `coupon_redemptions` DISABLE KEYS */;
INSERT INTO `coupon_redemptions` VALUES (1,'2026-01-02 11:00:00',1,1,1),(2,'2026-06-02 16:30:00',2,1,2);
/*!40000 ALTER TABLE `coupon_redemptions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `coupons`
--

DROP TABLE IF EXISTS `coupons`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `coupons` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` text,
  `description` text,
  `discount_type` enum('percent','fixed') DEFAULT 'percent',
  `discount_value` decimal(11,0) DEFAULT NULL,
  `max_redemptions` int DEFAULT '1',
  `times_redeemed` int DEFAULT '0',
  `valid_from` datetime DEFAULT NULL,
  `valid_to` datetime DEFAULT NULL,
  `is_active` tinyint DEFAULT '1',
  `created_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `coupons`
--

LOCK TABLES `coupons` WRITE;
/*!40000 ALTER TABLE `coupons` DISABLE KEYS */;
INSERT INTO `coupons` VALUES (1,'BIENVENIDA20','Descuento de bienvenida','percent',20,100,1,'2026-01-01 00:00:00','2026-12-31 00:00:00',1,'2026-06-13 18:24:56'),(2,'VERANO150','Promoción de verano monto fijo','fixed',150,50,1,'2026-06-01 00:00:00','2026-08-31 00:00:00',1,'2026-06-13 18:24:56'),(3,'ANUAL10','Descuento por pago anual','percent',10,200,0,'2026-01-01 00:00:00','2026-12-31 00:00:00',1,'2026-06-13 18:24:56');
/*!40000 ALTER TABLE `coupons` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `modules`
--

DROP TABLE IF EXISTS `modules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `modules` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` text,
  `code` text,
  `icon` text,
  `description` text,
  `created_at` datetime DEFAULT NULL,
  `orden` smallint DEFAULT NULL,
  `route` text,
  `is_active` smallint DEFAULT '1',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `modules`
--

LOCK TABLES `modules` WRITE;
/*!40000 ALTER TABLE `modules` DISABLE KEYS */;
INSERT INTO `modules` VALUES (1,'Inventario','inventario','package','Control de entradas, salidas y stock','2026-06-13 20:14:06',1,'operacion/almacen',1),(2,'Finanzas','Fin','dollar-sign','Ingresos, egresos y reportes','2026-06-14 01:05:43',2,'finanzas',0),(3,'Tenant','tenant','layout-grid','Gestión de clientes','2026-06-14 07:55:46',1,'tenant',1),(4,'Capital Humano','capital-humano','user','Sistema para capturar datos humanos','2026-06-15 15:57:39',1,'admin',1);
/*!40000 ALTER TABLE `modules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payment_history`
--

DROP TABLE IF EXISTS `payment_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `amount` decimal(10,2) DEFAULT NULL,
  `currency` text,
  `status` enum('paid','pending','failed','refunded') DEFAULT 'pending',
  `gateway` text,
  `transaction_id` int DEFAULT NULL,
  `paid_at` datetime DEFAULT NULL,
  `invoice_url` text,
  `created_at` datetime DEFAULT NULL,
  `subscription_id` int DEFAULT NULL,
  `company_id` int DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `company_id` (`company_id`) USING BTREE,
  KEY `subscription_id` (`subscription_id`) USING BTREE,
  CONSTRAINT `payment_history_ibfk_1` FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `payment_history_ibfk_2` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payment_history`
--

LOCK TABLES `payment_history` WRITE;
/*!40000 ALTER TABLE `payment_history` DISABLE KEYS */;
INSERT INTO `payment_history` VALUES (1,899.00,'MXN','paid','stripe',100231,'2026-06-01 10:15:00','https://huubie.com.mx/facturas/INV-0001.pdf','2026-06-13 18:24:56',1,1),(2,899.00,'MXN','paid','stripe',100190,'2026-05-01 09:40:00','https://huubie.com.mx/facturas/INV-0002.pdf','2026-06-13 18:24:56',1,1),(3,899.00,'MXN','pending','mercadopago',NULL,NULL,NULL,'2026-06-13 18:24:56',2,1),(4,899.00,'MXN','failed','stripe',100255,NULL,NULL,'2026-06-13 18:24:56',1,1);
/*!40000 ALTER TABLE `payment_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `perfiles`
--

DROP TABLE IF EXISTS `perfiles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `perfiles` (
  `idPerfil` int NOT NULL AUTO_INCREMENT,
  `perfil` varchar(100) DEFAULT NULL,
  `perfil_estado` smallint DEFAULT '1',
  `f_creacion` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`idPerfil`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `perfiles`
--

LOCK TABLES `perfiles` WRITE;
/*!40000 ALTER TABLE `perfiles` DISABLE KEYS */;
INSERT INTO `perfiles` VALUES (1,'root',1,'2023-09-23 01:49:35'),(6,'Finanzas',1,'2024-04-20 18:25:25'),(7,'Gerente',1,'2024-05-13 21:06:32'),(8,'Auxiliar finanzas',1,'2024-06-10 16:49:52'),(9,'Flores',1,'2024-08-02 20:58:05'),(10,'Cuilco',1,'2024-08-02 21:06:12');
/*!40000 ALTER TABLE `perfiles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `permissions`
--

DROP TABLE IF EXISTS `permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `permissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `created_at` datetime DEFAULT NULL,
  `type_permission_id` int DEFAULT NULL,
  `role_id` int DEFAULT NULL,
  `section_id` int DEFAULT NULL,
  `is_active` smallint DEFAULT '1',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `role_id` (`role_id`) USING BTREE,
  KEY `section_id` (`section_id`) USING BTREE,
  KEY `type_permission_id` (`type_permission_id`) USING BTREE,
  CONSTRAINT `permissions_ibfk_3` FOREIGN KEY (`type_permission_id`) REFERENCES `type_permissions` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `permissions_ibfk_4` FOREIGN KEY (`section_id`) REFERENCES `sections` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `permissions_ibfk_5` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=58 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `permissions`
--

LOCK TABLES `permissions` WRITE;
/*!40000 ALTER TABLE `permissions` DISABLE KEYS */;
INSERT INTO `permissions` VALUES (1,'2026-06-13 21:19:50',1,1,1,1),(2,'2026-06-13 21:19:50',1,1,2,1),(3,'2026-06-13 21:19:50',1,1,3,1),(4,'2026-06-13 21:19:50',1,1,4,1),(5,'2026-06-13 21:19:50',1,1,5,1),(6,'2026-06-13 21:19:50',1,1,6,1),(7,'2026-06-13 21:19:50',1,1,7,1),(8,'2026-06-13 21:19:50',1,1,8,1),(9,'2026-06-13 21:19:50',1,1,9,1),(10,'2026-06-13 21:19:50',1,1,10,1),(16,'2026-06-13 21:19:50',1,2,1,1),(17,'2026-06-13 21:19:50',1,2,2,1),(18,'2026-06-13 21:19:50',1,2,3,1),(19,'2026-06-13 21:19:50',1,2,4,1),(20,'2026-06-13 21:19:50',1,2,5,1),(21,'2026-06-13 21:19:50',1,2,6,1),(22,'2026-06-13 21:19:50',1,2,7,1),(23,'2026-06-13 21:19:50',1,2,8,1),(24,'2026-06-13 21:19:50',1,2,9,1),(25,'2026-06-13 21:19:50',1,2,10,1),(31,'2026-06-13 21:19:50',1,3,1,1),(32,'2026-06-13 21:19:50',1,3,2,1),(33,'2026-06-13 21:19:50',1,3,3,1),(34,'2026-06-13 21:19:50',1,3,4,1),(35,'2026-06-13 21:19:50',1,3,5,1),(36,'2026-06-13 21:19:50',1,3,6,1),(37,'2026-06-13 21:19:50',1,3,7,1),(38,'2026-06-13 21:19:50',1,4,4,1),(39,'2026-06-13 21:19:50',1,4,5,1),(42,'2026-06-14 01:00:36',1,4,1,1),(43,'2026-06-14 01:00:37',1,4,2,0),(44,'2026-06-14 01:00:37',1,4,3,1),(46,'2026-06-14 07:45:01',1,2,24,1),(47,'2026-06-14 07:58:07',1,4,25,1),(48,'2026-06-14 19:51:43',1,3,8,1),(49,'2026-06-14 19:51:43',1,3,9,1),(50,'2026-06-15 06:50:36',1,2,23,1),(51,'2026-06-15 06:52:57',1,3,23,1),(52,'2026-06-15 15:40:42',2,2,1,1),(53,'2026-06-15 15:40:42',3,2,1,1),(54,'2026-06-15 16:57:03',1,3,25,1),(55,'2026-06-15 16:57:03',2,3,25,1),(56,'2026-06-15 16:57:03',4,3,25,1),(57,'2026-06-15 16:57:03',3,3,25,1);
/*!40000 ALTER TABLE `permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `plans`
--

DROP TABLE IF EXISTS `plans`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `plans` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` text,
  `name` text,
  `price` decimal(10,2) DEFAULT NULL,
  `currency` text,
  `billing_cycle` enum('monthly','yearly','lifetime') DEFAULT 'monthly',
  `max_users` int DEFAULT NULL,
  `max_branches` int DEFAULT NULL,
  `features` json DEFAULT NULL,
  `trial_days` int DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `update_at` datetime DEFAULT NULL,
  `is_active` smallint DEFAULT '1',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `plans`
--

LOCK TABLES `plans` WRITE;
/*!40000 ALTER TABLE `plans` DISABLE KEYS */;
INSERT INTO `plans` VALUES (1,'PRO','Profesional',899.00,'MXN','monthly',25,5,NULL,14,'2026-06-13 18:24:56',NULL,1);
/*!40000 ALTER TABLE `plans` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` text,
  `name` text,
  `is_system` smallint DEFAULT '0',
  `created_at` datetime DEFAULT NULL,
  `is_active` smallint DEFAULT '1',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `roles`
--

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` VALUES (1,'superadmin','Super Admin',1,'2026-06-06 22:15:48',1),(2,'admin','Administrador',0,'2026-06-13 21:19:50',1),(3,'operador','Operador',0,'2026-06-13 21:19:50',1),(4,'consulta','Consulta',0,'2026-06-13 21:19:50',1);
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sections`
--

DROP TABLE IF EXISTS `sections`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sections` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` text,
  `code` text,
  `icon` text,
  `created_at` datetime DEFAULT NULL,
  `orden` smallint DEFAULT NULL,
  `route` text,
  `is_active` smallint DEFAULT '1',
  `module_id` int DEFAULT NULL,
  `submodule_id` int DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `module_id` (`module_id`) USING BTREE,
  KEY `submodule_id` (`submodule_id`) USING BTREE,
  CONSTRAINT `sections_ibfk_1` FOREIGN KEY (`module_id`) REFERENCES `modules` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `sections_ibfk_2` FOREIGN KEY (`submodule_id`) REFERENCES `submodules` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=29 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sections`
--

LOCK TABLES `sections` WRITE;
/*!40000 ALTER TABLE `sections` DISABLE KEYS */;
INSERT INTO `sections` VALUES (1,'Entradas','entradas','arrow-down-to-line','2026-06-13 20:14:06',1,'operacion/almacen/entradas.php',1,1,NULL),(2,'Salidas','salidas','arrow-up-from-line','2026-06-13 20:14:06',2,'operacion/almacen/salidas.php',1,1,NULL),(3,'Traspasos','traspasos','arrow-right-left','2026-06-13 20:14:06',3,'operacion/almacen/traspasos.php',1,1,NULL),(4,'Stock','stock','boxes','2026-06-13 20:14:06',4,'operacion/almacen/stock.php',1,1,NULL),(5,'Movimientos','movimientos','history','2026-06-13 20:14:06',5,'operacion/almacen/movimientos.php',1,1,NULL),(6,'Ordenes','ordenes','shopping-cart','2026-06-13 20:14:06',6,'operacion/almacen/ordenes.php',1,1,NULL),(7,'Solicitudes','solicitudes','clipboard-list','2026-06-13 20:14:06',7,'operacion/almacen/solicitudes.php',1,1,NULL),(8,'Admin','admin','house','2026-06-13 20:14:06',8,'operacion/almacen/',1,1,NULL),(9,'Accesos','accesos','shield-user','2026-06-13 20:14:06',9,'admin/accesos/',1,1,NULL),(10,'UI Kit','ui-kit','palette','2026-06-13 20:14:06',10,'operacion/almacen/ui-kit.php',1,1,NULL),(23,'Contabilidad','conta',NULL,'2026-06-14 07:42:47',1,'coffee/contabilidad',0,1,NULL),(24,'Administrador','admin',NULL,'2026-06-14 07:44:50',2,'conta',1,2,3),(25,'administrador','administrador','house','2026-06-14 07:56:30',1,'tenant',1,3,NULL),(26,'Matriz','matriz','user','2026-06-15 15:58:58',1,'admin',1,4,5),(27,'Tabulacion','tabulacion','user','2026-06-15 15:59:14',12,'admin',1,4,5),(28,'Colaboradores','colaboradores','box','2026-06-15 15:59:29',1,'admin',1,4,NULL);
/*!40000 ALTER TABLE `sections` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `submodules`
--

DROP TABLE IF EXISTS `submodules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `submodules` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` text,
  `code` text,
  `icon` text,
  `description` text,
  `created_at` datetime DEFAULT NULL,
  `orden` smallint DEFAULT NULL,
  `route` text,
  `is_active` smallint DEFAULT '1',
  `module_id` int DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `module_id` (`module_id`) USING BTREE,
  CONSTRAINT `submodules_ibfk_1` FOREIGN KEY (`module_id`) REFERENCES `modules` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `submodules`
--

LOCK TABLES `submodules` WRITE;
/*!40000 ALTER TABLE `submodules` DISABLE KEYS */;
INSERT INTO `submodules` VALUES (1,'Inventarios Productos','inventarios-productos','folder-tree','Inventario de productos terminados','2026-06-13 20:14:06',1,'inventory/products',0,1),(2,'Inventarios Insumos','inventarios-insumos','folder-tree','Inventario de insumos y materias','2026-06-13 20:14:06',2,'inventory/supplies',0,1),(3,'Contabilidad','conta','folder-tree',NULL,'2026-06-14 07:29:31',3,'coffee/conta',1,2),(5,'Valores','valores','user','modulo','2026-06-15 15:58:17',1,'admin',1,4);
/*!40000 ALTER TABLE `submodules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `subscriptions`
--

DROP TABLE IF EXISTS `subscriptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `subscriptions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `starts_at` datetime DEFAULT NULL,
  `ends_at` datetime DEFAULT NULL,
  `next_billing_date` datetime DEFAULT NULL,
  `external_reference` text,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  `status` enum('trial','active','past_due','cancelled','expired') DEFAULT 'trial',
  `company_id` int DEFAULT NULL,
  `plan_id` int DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `company_id` (`company_id`) USING BTREE,
  KEY `plan_id` (`plan_id`) USING BTREE,
  CONSTRAINT `subscriptions_ibfk_1` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `subscriptions_ibfk_2` FOREIGN KEY (`plan_id`) REFERENCES `plans` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `subscriptions`
--

LOCK TABLES `subscriptions` WRITE;
/*!40000 ALTER TABLE `subscriptions` DISABLE KEYS */;
INSERT INTO `subscriptions` VALUES (1,'2026-01-01 00:00:00',NULL,'2026-07-01 00:00:00','SUB-PRO-0001','2026-06-13 18:24:56',NULL,'active',1,1),(2,'2026-06-01 00:00:00','2026-06-15 00:00:00','2026-06-15 00:00:00','SUB-TRIAL-0002','2026-06-13 18:24:56',NULL,'trial',1,1),(3,'2026-03-01 00:00:00',NULL,'2026-06-01 00:00:00','SUB-PD-0003','2026-06-13 18:24:56',NULL,'past_due',1,1);
/*!40000 ALTER TABLE `subscriptions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `subsidiaries`
--

DROP TABLE IF EXISTS `subsidiaries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `subsidiaries` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(160) NOT NULL,
  `address` varchar(255) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `is_main` tinyint NOT NULL DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `active` tinyint NOT NULL DEFAULT '1',
  `companies_id` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_subsidiaries_company` (`companies_id`),
  CONSTRAINT `fk_subsidiaries_company` FOREIGN KEY (`companies_id`) REFERENCES `companies` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `subsidiaries`
--

LOCK TABLES `subsidiaries` WRITE;
/*!40000 ALTER TABLE `subsidiaries` DISABLE KEYS */;
INSERT INTO `subsidiaries` VALUES (1,'Reginas Matriz',NULL,NULL,1,'2026-06-05 07:44:01',0,1),(2,'Marinis Matriz',NULL,NULL,1,'2026-06-05 07:44:01',0,1),(3,'CoffeeSoft','Col Centro','9621501886',1,'2026-06-05 07:44:01',1,1),(4,'Rosys Sucursal','av','962571113',1,'2026-06-06 22:00:33',1,1);
/*!40000 ALTER TABLE `subsidiaries` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `type_permissions`
--

DROP TABLE IF EXISTS `type_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `type_permissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` text,
  `created_at` datetime DEFAULT NULL,
  `is_active` smallint DEFAULT '1',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `type_permissions`
--

LOCK TABLES `type_permissions` WRITE;
/*!40000 ALTER TABLE `type_permissions` DISABLE KEYS */;
INSERT INTO `type_permissions` VALUES (1,'Acceso','2026-06-13 20:31:42',1),(2,'Editar','2026-06-15 15:40:27',1),(3,'Eliminar','2026-06-15 15:40:33',1),(4,'Tabular','2026-06-15 15:56:28',1);
/*!40000 ALTER TABLE `type_permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `udn`
--

DROP TABLE IF EXISTS `udn`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `udn` (
  `idUDN` int NOT NULL AUTO_INCREMENT,
  `UDN` varchar(50) DEFAULT NULL,
  `Abreviatura` varchar(5) DEFAULT NULL,
  `Stado` int DEFAULT '1',
  `Antiguedad` int DEFAULT NULL,
  PRIMARY KEY (`idUDN`) USING BTREE,
  KEY `UDN` (`UDN`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `udn`
--

LOCK TABLES `udn` WRITE;
/*!40000 ALTER TABLE `udn` DISABLE KEYS */;
INSERT INTO `udn` VALUES (1,'Reginas','',1,1),(2,'Marinis','',1,1),(3,'CoffeeSoft',NULL,1,1);
/*!40000 ALTER TABLE `udn` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_sessions`
--

DROP TABLE IF EXISTS `user_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_sessions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ip_address` text,
  `user_agent` text,
  `last_activity` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `user_id` int DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `user_id` (`user_id`) USING BTREE,
  CONSTRAINT `user_sessions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_sessions`
--

LOCK TABLES `user_sessions` WRITE;
/*!40000 ALTER TABLE `user_sessions` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `is_owner` smallint DEFAULT NULL,
  `email` text,
  `password` text,
  `name` text,
  `last_name` text,
  `status` enum('active','inactive','pending') DEFAULT 'pending',
  `setup_token` text,
  `token_expires` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  `photo` text,
  `color` varchar(7) DEFAULT NULL,
  `company_id` int DEFAULT NULL,
  `key` text,
  `branch_id` int DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `company_id` (`company_id`) USING BTREE,
  KEY `branch_id` (`branch_id`),
  CONSTRAINT `users_ibfk_1` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `users_ibfk_2` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,NULL,'rosaangelica500@gmail.com',NULL,'Rosy','Velasquez','active',NULL,NULL,'2026-06-06 21:35:22','2026-06-14 17:11:41',NULL,NULL,1,'21232f297a57a5a743894a0e4a801fc3',2),(2,NULL,'coffee@gmail.com','$2y$10$TSjBH7Fs.MBE5WKVfStwcuGXcoYCXhfSgEiQIYDKqIZ7PrpLyS5Ii','Sergio','Osorio','active',NULL,NULL,'2026-06-07 09:38:13','2026-06-07 11:24:27',NULL,NULL,1,'21232f297a57a5a743894a0e4a801fc3',1),(4,0,'demo.bridge@test.local','$2y$10$5Jig.fNxupJ.s0Ij.E54UeWCymddN.2PYzXWU8bs3NE4MyrAxvY76','Demo','Puente','active',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users_braches`
--

DROP TABLE IF EXISTS `users_braches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users_braches` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `branch_id` int DEFAULT NULL,
  `role_id` int DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `user_id` (`user_id`) USING BTREE,
  KEY `branch_id` (`branch_id`) USING BTREE,
  KEY `role_id` (`role_id`) USING BTREE,
  CONSTRAINT `users_braches_ibfk_4` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `users_braches_ibfk_5` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `users_braches_ibfk_6` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users_braches`
--

LOCK TABLES `users_braches` WRITE;
/*!40000 ALTER TABLE `users_braches` DISABLE KEYS */;
INSERT INTO `users_braches` VALUES (1,1,1,2),(2,1,2,4),(3,2,1,3),(4,2,2,3);
/*!40000 ALTER TABLE `users_braches` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `usuarios`
--

DROP TABLE IF EXISTS `usuarios`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `usuarios` (
  `idUser` int NOT NULL AUTO_INCREMENT,
  `usser` varchar(50) DEFAULT NULL,
  `keey` text,
  `keey2` text,
  `usr_Colaborador` int DEFAULT NULL,
  `creacion` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `usr_estado` smallint DEFAULT '1',
  `usr_perfil` int DEFAULT NULL,
  `usr_udn` int DEFAULT '1',
  `usr_intentos` int DEFAULT '0',
  `activacion` timestamp NULL DEFAULT NULL,
  `usr_photo` text,
  `usr_empleado` int DEFAULT NULL,
  PRIMARY KEY (`idUser`) USING BTREE,
  KEY `usr_empleado` (`usr_empleado`),
  KEY `usr_udn` (`usr_udn`),
  KEY `usr_perfil` (`usr_perfil`),
  CONSTRAINT `usuarios_ibfk_1` FOREIGN KEY (`usr_udn`) REFERENCES `udn` (`idUDN`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `usuarios_ibfk_2` FOREIGN KEY (`usr_perfil`) REFERENCES `perfiles` (`idPerfil`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `usuarios`
--

LOCK TABLES `usuarios` WRITE;
/*!40000 ALTER TABLE `usuarios` DISABLE KEYS */;
INSERT INTO `usuarios` VALUES (1,'root','81dc9bdb52d04dc20036dbd8313ed055',NULL,NULL,'2023-09-23 17:23:52',1,1,3,0,NULL,NULL,NULL),(6,'reginas','81dc9bdb52d04dc20036dbd8313ed055',NULL,NULL,'2024-04-20 22:48:28',1,1,1,0,NULL,NULL,NULL),(7,'marinis','81dc9bdb52d04dc20036dbd8313ed055',NULL,NULL,'2024-05-13 21:06:05',1,1,2,0,NULL,NULL,NULL);
/*!40000 ALTER TABLE `usuarios` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'fayxzvov_erp'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-09-05 11:34:01
