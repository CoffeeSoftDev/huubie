
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
DROP TABLE IF EXISTS `permisos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `permisos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_Perfil` int(11) NOT NULL,
  `id_Directorio` int(11) DEFAULT NULL,
  `ver` smallint(6) DEFAULT '0',
  `escribir` smallint(6) DEFAULT '0',
  `editar` smallint(6) DEFAULT '0',
  `imprimir` smallint(6) DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `permisos_ibfk_1` (`id_Perfil`),
  KEY `id_Directorio` (`id_Directorio`),
  CONSTRAINT `permisos_ibfk_1` FOREIGN KEY (`id_Perfil`) REFERENCES `perfiles` (`idPerfil`),
  CONSTRAINT `permisos_ibfk_2` FOREIGN KEY (`id_Directorio`) REFERENCES `directorios` (`idDirectorio`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `permisos` WRITE;
/*!40000 ALTER TABLE `permisos` DISABLE KEYS */;
/*!40000 ALTER TABLE `permisos` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `directorios`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `directorios` (
  `idDirectorio` int(11) NOT NULL AUTO_INCREMENT,
  `directorio` varchar(255) DEFAULT NULL,
  `dir_ruta` varchar(255) DEFAULT NULL,
  `dir_modulo` int(11) DEFAULT NULL,
  `dir_submodulo` int(11) DEFAULT NULL,
  `dir_estado` smallint(6) DEFAULT '1',
  `dir_block` smallint(6) DEFAULT '0',
  `dir_visible` smallint(6) DEFAULT '1',
  `dir_orden` int(11) DEFAULT '99',
  PRIMARY KEY (`idDirectorio`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=68 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `directorios` WRITE;
/*!40000 ALTER TABLE `directorios` DISABLE KEYS */;
INSERT INTO `directorios` VALUES (1,'Directorios','tics/directorios.php',1,NULL,1,0,1,1),(2,'Perfiles','tics/perfiles.php',1,NULL,1,0,1,2),(3,'Usuarios','tics/usuarios.php',1,NULL,1,0,1,3),(4,'Fontello icons','tics/fontello-icon.php',1,NULL,1,0,1,4),(22,'Pedidos de matenimiento','compras/pedidos/pedidos-mtto.php',19,6,1,0,0,1),(23,'Pedido de flores','flores/pedido-de-flores/pedido-flores.php',20,7,0,0,1,1),(39,'Colores','tics/colores.php',1,NULL,1,0,1,5),(40,'Reclutamiento','recursos-humanos/reclutamiento.php',21,NULL,1,0,1,1),(41,'Lista de colaboradores','recursos-humanos/lista-de-colaboradores.php',21,NULL,1,0,1,1),(42,'Editar colaborador','recursos-humanos/editar-colaborador.php',21,NULL,1,0,0,1),(43,'Anticipos','recursos-humanos/anticipos.php',21,NULL,1,0,0,1),(44,'Control de Incidencias','recursos-humanos/control-de-incidencias.php',21,NULL,1,0,0,1),(45,'Creditos','recursos-humanos/creditos.php',21,NULL,1,0,0,1),(46,'Análisis de ingresos','finanzas/analisis-de-ingresos.php',22,NULL,1,0,1,1),(47,'REMISIONES','flores/pedido-de-flores/remisiones.php',20,7,1,0,1,1),(49,'Mantenimiento almacen','mantenimiento/almacen/mantenimiento-almacen.php',23,9,1,0,1,1),(50,'Reportes ingreso','direccion/reportes/reportes-ingreso.php',24,10,1,0,1,1),(51,'Disponibilidad','flores/pedido-de-flores/disponibilidad.php',20,7,1,0,1,1),(52,'Prueba','pruebas/prueba.php',25,NULL,1,0,0,1),(53,'Ingreso diarios','direccion/reportes/ingreso-diarios.php',24,10,1,0,1,1),(54,'Pedido flores','flores/pedido-de-flores/pedido-flores.php',20,7,0,0,1,1),(55,'Punto de venta','flores/pedido-de-flores/punto-de-venta.php',20,7,1,0,1,1),(56,'Flores','flores/administracion/flores.php',20,11,1,0,1,1),(57,'Clientes','flores/administracion/clientes.php',20,11,1,0,1,1),(58,'Movimientos diarios','finanzas/movimientos-diarios.php',22,NULL,1,0,1,1),(59,'Contabilidad','finanzas/contabilidad.php',22,NULL,1,0,1,1),(60,'Administracion','finanzas/administracion.php',22,NULL,1,0,1,1),(64,'Administracion','rio-cuilco/almacen/administracion.php',26,13,1,0,1,1),(65,'Inventarios','rio-cuilco/almacen/inventarios.php',26,13,1,0,1,99),(66,'Pedidos','rio-cuilco/punto-de-venta/pedidos.php',26,15,1,0,1,99),(67,'Punto de venta','diversificados/punto-de-venta.php',27,NULL,1,0,1,99);
/*!40000 ALTER TABLE `directorios` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `modulos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `modulos` (
  `idModulo` int(11) NOT NULL AUTO_INCREMENT,
  `modulo` varchar(100) DEFAULT NULL,
  `mod_ruta` varchar(100) DEFAULT NULL,
  `mod_estado` smallint(6) DEFAULT '1',
  `mod_orden` int(11) DEFAULT '99',
  PRIMARY KEY (`idModulo`) USING BTREE
) ENGINE=MyISAM AUTO_INCREMENT=28 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `modulos` WRITE;
/*!40000 ALTER TABLE `modulos` DISABLE KEYS */;
INSERT INTO `modulos` VALUES (1,'TICS','tics',1,9),(19,'COMPRAS','compras',1,6),(20,'FLORES','flores',1,5),(21,'RECURSOS HUMANOS','recursos-humanos',1,2),(22,'FINANZAS','finanzas',1,3),(23,'MANTENIMIENTO','mantenimiento',1,4),(24,'DIRECCION','direccion',1,1),(25,'PRUEBAS','pruebas',1,7),(26,'RIO CUILCO','rio-cuilco',1,8),(27,'DIVERSIFICADOS','diversificados',1,10);
/*!40000 ALTER TABLE `modulos` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `submodulos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `submodulos` (
  `idSubmodulo` int(11) NOT NULL AUTO_INCREMENT,
  `submodulo` varchar(100) DEFAULT NULL,
  `sub_ruta` varchar(100) DEFAULT NULL,
  `sub_estado` smallint(6) DEFAULT '1',
  `sub_idModulo` int(11) NOT NULL,
  `sub_orden` int(11) DEFAULT '99',
  PRIMARY KEY (`idSubmodulo`) USING BTREE
) ENGINE=MyISAM AUTO_INCREMENT=17 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `submodulos` WRITE;
/*!40000 ALTER TABLE `submodulos` DISABLE KEYS */;
INSERT INTO `submodulos` VALUES (6,'PEDIDOS','pedidos',1,19,1),(7,'PEDIDOS','pedido-de-flores',1,20,1),(9,'ALMACEN','almacen',1,23,1),(10,'REPORTES','reportes',1,24,1),(11,'ADMINISTRACION','administracion',1,20,1),(12,'ADMINISTRACION','administracion',1,22,1),(13,'ALMACEN','almacen',1,26,1),(14,'PUNTO DE VENTA','punto-de-venta',1,24,99),(15,'PUNTO DE VENTA','punto-de-venta',1,26,99),(16,'PUNTO DE VENTA','punto-de-venta',1,27,99);
/*!40000 ALTER TABLE `submodulos` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `subsidiaries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `subsidiaries` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(160) NOT NULL,
  `address` varchar(255) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `is_main` tinyint(4) NOT NULL DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `active` tinyint(4) NOT NULL DEFAULT '1',
  `companies_id` int(11) NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_subsidiaries_company` (`companies_id`) USING BTREE,
  CONSTRAINT `fk_subsidiaries_company` FOREIGN KEY (`companies_id`) REFERENCES `companies` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=latin1 ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `subsidiaries` WRITE;
/*!40000 ALTER TABLE `subsidiaries` DISABLE KEYS */;
INSERT INTO `subsidiaries` VALUES (1,'Reginas Matriz',NULL,NULL,1,'2026-06-05 07:44:01',0,1),(2,'Marinis Matriz',NULL,NULL,1,'2026-06-05 07:44:01',0,1),(3,'CoffeeSoft','Col Centro','9621501886',1,'2026-06-05 07:44:01',1,1),(4,'Rosys Sucursal','av','962571113',1,'2026-06-06 22:00:33',1,1);
/*!40000 ALTER TABLE `subsidiaries` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `user_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_sessions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `ip_address` text,
  `user_agent` text,
  `last_activity` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `user_id` (`user_id`) USING BTREE,
  CONSTRAINT `user_sessions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `user_sessions` WRITE;
/*!40000 ALTER TABLE `user_sessions` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_sessions` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `ch_colaboradores`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ch_colaboradores` (
  `idColaborador` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) DEFAULT NULL,
  `apaterno` varchar(100) DEFAULT NULL,
  `amaterno` varchar(100) DEFAULT NULL,
  `f_nacimiento` date DEFAULT NULL,
  `f_alta` date DEFAULT NULL,
  `id_UDN` int(11) DEFAULT NULL,
  `col_estado` smallint(6) DEFAULT '1',
  PRIMARY KEY (`idColaborador`) USING BTREE
) ENGINE=MyISAM AUTO_INCREMENT=6 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `ch_colaboradores` WRITE;
/*!40000 ALTER TABLE `ch_colaboradores` DISABLE KEYS */;
INSERT INTO `ch_colaboradores` VALUES (1,'Usuario','Prueba','','2023-05-20','2023-04-02',8,1);
/*!40000 ALTER TABLE `ch_colaboradores` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

