-- MySQL dump 10.13  Distrib 5.7.36, for Win64 (x86_64)
--
-- Host: localhost    Database: fayxzvov_inventory
-- ------------------------------------------------------
-- Server version	5.7.36

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `item`
--

DROP TABLE IF EXISTS `item`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `item` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(160) NOT NULL,
  `image` varchar(255) DEFAULT NULL,
  `price` double NOT NULL DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `active` tinyint(4) NOT NULL DEFAULT '1',
  `category_id` int(11) DEFAULT NULL,
  `branch_id` int(11) DEFAULT NULL,
  `companies_id` int(11) NOT NULL,
  `price_without_tax` double DEFAULT NULL,
  `tax` double DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_item_category` (`category_id`) USING BTREE,
  KEY `idx_item_subsidiary` (`branch_id`) USING BTREE,
  KEY `idx_item_company` (`companies_id`) USING BTREE,
  CONSTRAINT `fk_item_branch` FOREIGN KEY (`branch_id`) REFERENCES `fayxzvov_erp`.`branches` (`id`),
  CONSTRAINT `fk_item_category` FOREIGN KEY (`category_id`) REFERENCES `item_category` (`id`),
  CONSTRAINT `fk_item_company` FOREIGN KEY (`companies_id`) REFERENCES `fayxzvov_erp`.`companies` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=30 DEFAULT CHARSET=latin1 ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `item`
--

LOCK TABLES `item` WRITE;
/*!40000 ALTER TABLE `item` DISABLE KEYS */;
INSERT INTO `item` VALUES (11,'CARTON DORADO MEXICANO NO. 12','',10,'2026-06-08 22:48:56',1,23,1,1,8.6206896551724,16),(12,'CARTON DORADO MEXICANO NO. 14','',14.616,'2026-06-08 22:49:48',1,23,1,1,12.6,16),(13,'CARTON DORADO MEXICANO NO. 16','',17.226,'2026-06-09 03:25:07',1,23,1,1,14.85,16),(14,'CARTON DORADO MEXICANO NO. 18',NULL,24.012,'2026-06-09 03:25:37',1,23,1,1,20.7,16),(15,'COLOR VERDE HOJA 250 GRS GEL 2378 ENCO','',99.18,'2026-06-09 03:29:57',1,24,1,1,85.5,16),(16,'COLOR VERDE LIMON 250 GRS GEL 1545 ENCO','',81.432,'2026-06-09 03:30:52',1,24,1,1,70.2,16),(17,'COLOR NEGRO EN GEL 250 GRS 1130 ENCO',NULL,134.676,'2026-06-09 03:32:17',1,24,1,1,116.1,16),(18,'COLOR AMARILLO HUEVO 250 GRS GEL 1564 ENCO',NULL,81.432,'2026-06-09 03:46:29',1,24,1,1,70.2,16),(19,'COLOR ROSA FIUSHA 250 GRS GEL 1916 ENCO',NULL,161.82,'2026-06-09 03:48:50',1,24,1,1,139.5,16),(20,'COLOR ROJO 250 GRS GEL 1216 ENCO',NULL,134.676,'2026-06-09 03:50:20',1,24,1,1,116.1,16),(21,'COLOR SUPER ROJO LIQ 2565 250 GRS ENCO',NULL,121.104,'2026-06-09 03:52:53',1,25,1,1,104.4,16),(22,'QUESO CREMA SANTA CRUZ 8 KGS',NULL,980,'2026-06-09 03:56:04',1,23,1,1,980,0),(23,'BETTERCREME SUPREMO GALON 09730','',325.26,'2026-06-09 03:58:45',1,26,1,1,325.26,0),(24,'FLEX MARGARINA HOJALDRE ROJO 1 KG','',58,'2026-06-09 04:00:51',1,27,1,1,58,0),(25,'CAJETA UNTABLE NANTESANA CUB 24/KGS','',2218.48,'2026-06-09 04:02:42',1,27,1,1,2218.48,0),(26,'COLOR CORAZON DE AGUACATE EN GEL 3303 250 GRS ENCO','',81.432,'2026-06-09 04:07:06',1,24,1,1,70.2,16),(27,'cafe argovia 500 gr',NULL,250,'2026-06-17 03:49:40',1,27,1,1,231.48148148148,8),(28,'Queso doble crema',NULL,0,'2026-06-17 03:49:59',1,27,1,1,0,0),(29,'cafe argovia 250 gr',NULL,0,'2026-06-17 04:15:08',1,27,1,1,0,0);
/*!40000 ALTER TABLE `item` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `item_attribute`
--

DROP TABLE IF EXISTS `item_attribute`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `item_attribute` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `sku` varchar(40) DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  `shelf_life_days` int(11) DEFAULT NULL,
  `cost_unit` double NOT NULL DEFAULT '0',
  `stock_min` double NOT NULL DEFAULT '0',
  `stock_max` double DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `active` tinyint(4) NOT NULL DEFAULT '1',
  `warehouse_area_id` int(11) DEFAULT NULL,
  `unit_id` int(11) DEFAULT NULL,
  `item_id` int(11) NOT NULL,
  `companies_id` int(11) NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_item_attr_area` (`warehouse_area_id`) USING BTREE,
  KEY `idx_item_attr_unit` (`unit_id`) USING BTREE,
  KEY `idx_item_attr_item` (`item_id`) USING BTREE,
  KEY `idx_item_attr_company` (`companies_id`) USING BTREE,
  CONSTRAINT `fk_item_attr_area` FOREIGN KEY (`warehouse_area_id`) REFERENCES `warehouse_area` (`id`),
  CONSTRAINT `fk_item_attr_company` FOREIGN KEY (`companies_id`) REFERENCES `fayxzvov_erp`.`companies` (`id`),
  CONSTRAINT `fk_item_attr_item` FOREIGN KEY (`item_id`) REFERENCES `item` (`id`),
  CONSTRAINT `fk_item_attr_unit` FOREIGN KEY (`unit_id`) REFERENCES `unit` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=30 DEFAULT CHARSET=latin1 ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `item_attribute`
--

LOCK TABLES `item_attribute` WRITE;
/*!40000 ALTER TABLE `item_attribute` DISABLE KEYS */;
INSERT INTO `item_attribute` VALUES (11,'ITM-012','',NULL,9.918,0,0,'2026-06-08 22:48:56',1,NULL,3,11,1),(12,'ITM-013','',NULL,14.616,0,0,'2026-06-08 22:49:48',1,NULL,3,12,1),(13,'ITM-014','',NULL,17.226,0,0,'2026-06-09 03:25:07',1,NULL,3,13,1),(14,'ITM-015',NULL,NULL,24.012,0,NULL,'2026-06-09 03:25:37',1,NULL,3,14,1),(15,'ITM-016','',NULL,99.18,0,0,'2026-06-09 03:29:57',1,NULL,17,15,1),(16,'ITM-017','',NULL,81.432,0,0,'2026-06-09 03:30:52',1,NULL,17,16,1),(17,'ITM-018',NULL,NULL,134.676,0,NULL,'2026-06-09 03:32:17',1,NULL,17,17,1),(18,'ITM-019',NULL,NULL,81.432,0,NULL,'2026-06-09 03:46:29',1,NULL,17,18,1),(19,'ITM-020',NULL,NULL,161.82,0,NULL,'2026-06-09 03:48:50',1,NULL,17,19,1),(20,'ITM-021',NULL,NULL,134.676,0,NULL,'2026-06-09 03:50:20',1,NULL,17,20,1),(21,'ITM-022',NULL,NULL,121.104,0,NULL,'2026-06-09 03:52:53',1,NULL,17,21,1),(22,'ITM-023',NULL,NULL,980,0,NULL,'2026-06-09 03:56:04',1,NULL,6,22,1),(23,'ITM-024','',NULL,325.26,0,0,'2026-06-09 03:58:45',1,NULL,18,23,1),(24,'ITM-025','',NULL,58,0,0,'2026-06-09 04:00:51',1,NULL,6,24,1),(25,'ITM-026','',NULL,2218.48,0,0,'2026-06-09 04:02:42',1,NULL,6,25,1),(26,'ITM-027','',NULL,81.432,0,0,'2026-06-09 04:07:06',1,NULL,17,26,1),(27,'ITM-028',NULL,NULL,0,0,NULL,'2026-06-17 03:49:40',1,NULL,3,27,1),(28,'ITM-029',NULL,NULL,0,0,NULL,'2026-06-17 03:49:59',1,NULL,3,28,1),(29,'ITM-030',NULL,NULL,0,0,NULL,'2026-06-17 04:15:08',1,NULL,3,29,1);
/*!40000 ALTER TABLE `item_attribute` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `item_category`
--

DROP TABLE IF EXISTS `item_category`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `item_category` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `warehouse_id` int(11) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `active` tinyint(4) NOT NULL DEFAULT '1',
  `companies_id` int(11) NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_item_category_company` (`companies_id`) USING BTREE,
  KEY `idx_item_category_warehouse` (`warehouse_id`) USING BTREE,
  CONSTRAINT `fk_item_category_company` FOREIGN KEY (`companies_id`) REFERENCES `fayxzvov_erp`.`companies` (`id`),
  CONSTRAINT `fk_item_category_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouse` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=28 DEFAULT CHARSET=latin1 ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `item_category`
--

LOCK TABLES `item_category` WRITE;
/*!40000 ALTER TABLE `item_category` DISABLE KEYS */;
INSERT INTO `item_category` VALUES (23,'CARTONES',NULL,'2026-06-08 22:35:56',1,1),(24,'COLOR COMESTIBLE GEL',NULL,'2026-06-09 03:29:10',1,1),(25,'COLOR COMESTIBLE LIQUIDO',NULL,'2026-06-09 03:51:00',1,1),(26,'LACTEOS',NULL,'2026-06-09 03:55:01',1,1),(27,'ALIMENTOS',NULL,'2026-06-09 04:03:52',1,1);
/*!40000 ALTER TABLE `item_category` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `unit`
--

DROP TABLE IF EXISTS `unit`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `unit` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` varchar(20) NOT NULL,
  `name` varchar(80) NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `active` tinyint(4) NOT NULL DEFAULT '1',
  `companies_id` int(11) NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_unit_company` (`companies_id`) USING BTREE,
  CONSTRAINT `fk_unit_company` FOREIGN KEY (`companies_id`) REFERENCES `fayxzvov_erp`.`companies` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=latin1 ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `unit`
--

LOCK TABLES `unit` WRITE;
/*!40000 ALTER TABLE `unit` DISABLE KEYS */;
INSERT INTO `unit` VALUES (3,'PZA','Pieza','2026-06-05 07:44:01',1,1),(6,'KG','Kilogramo','2026-06-05 07:44:01',1,1),(9,'LT','Litros','2026-06-05 07:44:01',1,1),(17,'GRS','Gramos','2026-06-09 03:28:03',1,1),(18,'GL','Galon','2026-06-09 03:59:19',1,1);
/*!40000 ALTER TABLE `unit` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-06-17 10:05:00
