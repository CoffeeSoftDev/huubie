
/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
DROP TABLE IF EXISTS `modules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `modules` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` text,
  `code` text,
  `icon` text,
  `description` text,
  `created_at` datetime DEFAULT NULL,
  `orden` smallint(6) DEFAULT NULL,
  `route` text,
  `is_active` smallint(6) DEFAULT '1',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `modules` WRITE;
/*!40000 ALTER TABLE `modules` DISABLE KEYS */;
INSERT INTO `modules` VALUES (1,'Inventario','inventario','boxes','Control de entradas, salidas y stock.','2026-06-13 20:14:06',3,'operacion/almacen',1),(2,'Finanzas','Fin','dollar-sign','Ingresos, egresos y reportes','2026-06-14 01:05:43',2,'finanzas',0),(3,'Tenant','tenant','layout-grid','Gestión de clientes','2026-06-14 07:55:46',1,'tenant',0),(4,'Capital Humano','capital-humano','user','Sistema para capturar datos humanos','2026-06-15 15:57:39',1,'admin',0),(5,'Root','root','shield-user','Exclusivo para devs.','2026-06-16 14:55:21',2,'root',0),(6,'Configuracion','configuracion','cog','Agrega usuarios, sucursales y más!','2026-06-16 14:57:39',1,'configuracion',0),(7,'dev','dev','terminal','Roles, secciones y tipos de permiso.','2026-09-20 06:51:33',4,'tenant',1),(8,'Configuracion','configuracion','user-round','Apartado de configuracion','2026-09-22 20:59:04',5,'configuracion',0),(9,'Configuración','configuracion','settings','Da de alta usuarios, agrega sucursales y otorga permisos','2026-10-03 13:26:41',6,'admin/accesos',1);
/*!40000 ALTER TABLE `modules` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `submodules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `submodules` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` text,
  `code` text,
  `icon` text,
  `description` text,
  `created_at` datetime DEFAULT NULL,
  `orden` smallint(6) DEFAULT NULL,
  `route` text,
  `is_active` smallint(6) DEFAULT '1',
  `module_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `module_id` (`module_id`) USING BTREE,
  CONSTRAINT `submodules_ibfk_1` FOREIGN KEY (`module_id`) REFERENCES `modules` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `submodules` WRITE;
/*!40000 ALTER TABLE `submodules` DISABLE KEYS */;
INSERT INTO `submodules` VALUES (1,'Inventarios Productos','inventarios-productos','folder-tree','Inventario de productos terminados','2026-06-13 20:14:06',1,'inventory/products',0,1),(2,'Inventarios Insumos','inventarios-insumos','folder-tree','Inventario de insumos y materias','2026-06-13 20:14:06',2,'inventory/supplies',0,1),(3,'Contabilidad','conta','folder-tree',NULL,'2026-06-14 07:29:31',3,'coffee/conta',0,2),(5,'Valores','valores','user','modulo','2026-06-15 15:58:17',1,'admin',0,4);
/*!40000 ALTER TABLE `submodules` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `sections`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sections` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` text,
  `code` text,
  `icon` text,
  `created_at` datetime DEFAULT NULL,
  `orden` smallint(6) DEFAULT NULL,
  `route` text,
  `is_active` smallint(6) DEFAULT '1',
  `module_id` int(11) DEFAULT NULL,
  `submodule_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `module_id` (`module_id`) USING BTREE,
  KEY `submodule_id` (`submodule_id`) USING BTREE,
  CONSTRAINT `sections_ibfk_1` FOREIGN KEY (`module_id`) REFERENCES `modules` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `sections_ibfk_2` FOREIGN KEY (`submodule_id`) REFERENCES `submodules` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=34 DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `sections` WRITE;
/*!40000 ALTER TABLE `sections` DISABLE KEYS */;
INSERT INTO `sections` VALUES (1,'Entradas','entradas','arrow-down-to-line','2026-06-13 20:14:06',2,'operacion/almacen/entradas.php',1,1,NULL),(2,'Salidas','salidas','arrow-up-from-line','2026-06-13 20:14:06',3,'operacion/almacen/salidas.php',1,1,NULL),(3,'Traspasos','traspasos','arrow-right-left','2026-06-13 20:14:06',5,'operacion/almacen/traspasos.php',0,1,NULL),(4,'Stock','stock','boxes','2026-06-13 20:14:06',4,'operacion/almacen/stock.php',1,1,NULL),(5,'Movimientos','movimientos','history','2026-06-13 20:14:06',6,'operacion/almacen/movimientos.php',0,1,NULL),(6,'Compras','ordenes','shopping-cart','2026-06-13 20:14:06',7,'operacion/almacen/ordenes.php',1,1,NULL),(7,'Solicitudes','solicitudes','clipboard-list','2026-06-13 20:14:06',8,'operacion/almacen/solicitudes.php',0,1,NULL),(8,'Admin','admin','settings','2026-06-13 20:14:06',8,'admin/accesos/',1,7,NULL),(9,'Accesos','accesos','shield-user','2026-06-13 20:14:06',9,NULL,1,1,NULL),(24,'Catalogo','administrador','package','2026-06-14 07:44:50',1,'operacion/almacen',1,1,NULL),(26,'Matriz','matriz','user','2026-06-15 15:58:58',1,'admin',1,4,5),(27,'Tabulacion','tabulacion','user','2026-06-15 15:59:14',12,'admin',1,4,5),(28,'Colaboradores','colaboradores','box','2026-06-15 15:59:29',1,'admin',1,4,NULL),(29,'Permisos','permisos-editor','users-round','2026-09-20 06:51:33',1,NULL,1,7,NULL),(31,'Accesos','configuracion-accesos','shield-user','2026-10-06 23:58:40',1,'admin/accesos/',1,9,NULL),(32,'reportes','reportes','clipboard-pen-line','2026-10-07 09:38:38',15,'operacion/almacen/reportes.php',1,1,NULL),(33,'Programadas','programadas','clipboard-clock','2026-10-07 09:40:19',14,'operacion/almacen/compras.php',1,1,NULL);
/*!40000 ALTER TABLE `sections` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `type_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `type_permissions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` text,
  `order` int(11) DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `is_active` smallint(6) DEFAULT '1',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `type_permissions` WRITE;
/*!40000 ALTER TABLE `type_permissions` DISABLE KEYS */;
INSERT INTO `type_permissions` VALUES (1,'Ver',1,'2026-06-13 20:31:42',1),(2,'Editar',3,'2026-06-15 15:40:27',1),(3,'Eliminar',5,'2026-06-15 15:40:33',1),(4,'Tabular',6,'2026-06-15 15:56:28',0),(5,'Cancelar',4,'2026-10-16 19:46:40',1),(6,'Agregar',2,'2026-10-16 19:46:52',1);
/*!40000 ALTER TABLE `type_permissions` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `roles` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` text,
  `name` text,
  `is_system` smallint(6) DEFAULT '0',
  `created_at` datetime DEFAULT NULL,
  `is_active` smallint(6) DEFAULT '1',
  `company_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` VALUES (1,'superadmin','Super Admin',1,'2026-06-06 22:15:48',1,NULL),(2,'admin','Administrador',0,'2026-06-13 21:19:50',1,1),(3,'operador','Operador',0,'2026-06-13 21:19:50',1,1),(4,'consulta','Consulta',0,'2026-06-13 21:19:50',1,1);
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `permissions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `created_at` datetime DEFAULT NULL,
  `type_permission_id` int(11) DEFAULT NULL,
  `role_id` int(11) DEFAULT NULL,
  `section_id` int(11) DEFAULT NULL,
  `is_active` smallint(6) DEFAULT '1',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `role_id` (`role_id`) USING BTREE,
  KEY `section_id` (`section_id`) USING BTREE,
  KEY `type_permission_id` (`type_permission_id`) USING BTREE,
  CONSTRAINT `permissions_ibfk_3` FOREIGN KEY (`type_permission_id`) REFERENCES `type_permissions` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `permissions_ibfk_4` FOREIGN KEY (`section_id`) REFERENCES `sections` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `permissions_ibfk_5` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=65 DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `permissions` WRITE;
/*!40000 ALTER TABLE `permissions` DISABLE KEYS */;
INSERT INTO `permissions` VALUES (1,'2026-06-13 21:19:50',1,1,1,1),(2,'2026-06-13 21:19:50',1,1,2,1),(3,'2026-06-13 21:19:50',1,1,3,1),(4,'2026-06-13 21:19:50',1,1,4,1),(5,'2026-06-13 21:19:50',1,1,5,1),(6,'2026-06-13 21:19:50',1,1,6,1),(7,'2026-06-13 21:19:50',1,1,7,1),(8,'2026-06-13 21:19:50',1,1,8,1),(9,'2026-06-13 21:19:50',1,1,9,1),(16,'2026-06-13 21:19:50',1,2,1,1),(17,'2026-06-13 21:19:50',1,2,2,1),(18,'2026-06-13 21:19:50',1,2,3,0),(19,'2026-06-13 21:19:50',1,2,4,1),(20,'2026-06-13 21:19:50',1,2,5,0),(21,'2026-06-13 21:19:50',1,2,6,0),(22,'2026-06-13 21:19:50',1,2,7,0),(23,'2026-06-13 21:19:50',1,2,8,0),(24,'2026-06-13 21:19:50',1,2,9,0),(31,'2026-06-13 21:19:50',1,3,1,1),(32,'2026-06-13 21:19:50',1,3,2,1),(33,'2026-06-13 21:19:50',1,3,3,0),(34,'2026-06-13 21:19:50',1,3,4,1),(35,'2026-06-13 21:19:50',1,3,5,0),(36,'2026-06-13 21:19:50',1,3,6,0),(37,'2026-06-13 21:19:50',1,3,7,0),(38,'2026-06-13 21:19:50',1,4,4,1),(39,'2026-06-13 21:19:50',1,4,5,0),(42,'2026-06-14 01:00:36',1,4,1,1),(43,'2026-06-14 01:00:37',1,4,2,0),(44,'2026-06-14 01:00:37',1,4,3,0),(46,'2026-06-14 07:45:01',1,2,24,1),(48,'2026-06-14 19:51:43',1,3,8,0),(49,'2026-06-14 19:51:43',1,3,9,0),(52,'2026-06-15 15:40:42',2,2,1,1),(53,'2026-06-15 15:40:42',3,2,1,1),(58,'2026-09-20 06:51:33',1,1,29,1),(59,'2026-09-20 06:51:33',1,2,29,0),(60,'2026-09-20 06:51:33',2,1,29,1),(61,'2026-09-20 06:51:33',2,2,29,0),(63,'2026-10-06 23:58:40',1,1,31,1),(64,'2026-10-07 00:11:07',1,2,31,1);
/*!40000 ALTER TABLE `permissions` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `permissions_roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `permissions_roles` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `permission_id` int(11) DEFAULT NULL,
  `role_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `permission_id` (`permission_id`),
  KEY `role_id` (`role_id`),
  CONSTRAINT `permissions_roles_ibfk_1` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `permissions_roles_ibfk_2` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `permissions_roles` WRITE;
/*!40000 ALTER TABLE `permissions_roles` DISABLE KEYS */;
/*!40000 ALTER TABLE `permissions_roles` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `users_braches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `users_braches` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) DEFAULT NULL,
  `branch_id` int(11) DEFAULT NULL,
  `role_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `user_id` (`user_id`) USING BTREE,
  KEY `branch_id` (`branch_id`) USING BTREE,
  KEY `role_id` (`role_id`) USING BTREE,
  CONSTRAINT `users_braches_ibfk_4` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `users_braches_ibfk_5` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `users_braches_ibfk_6` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=52 DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `users_braches` WRITE;
/*!40000 ALTER TABLE `users_braches` DISABLE KEYS */;
INSERT INTO `users_braches` VALUES (15,3,1,3),(16,3,2,3),(21,1,1,2),(22,1,2,2),(40,5,1,2),(41,5,2,2),(42,5,4,2),(47,2,1,1),(48,2,2,1),(49,4,1,2),(50,4,2,2),(51,4,4,2);
/*!40000 ALTER TABLE `users_braches` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

