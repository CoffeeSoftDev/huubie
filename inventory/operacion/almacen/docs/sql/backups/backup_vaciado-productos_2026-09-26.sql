-- MySQL dump 10.13  Distrib 5.7.36, for Win64 (x86_64)
--
-- Host: localhost    Database: fayxzvov_inventory
-- ------------------------------------------------------
-- Server version	5.7.36

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
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=latin1 ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `item`
--

LOCK TABLES `item` WRITE;
/*!40000 ALTER TABLE `item` DISABLE KEYS */;
INSERT INTO `item` VALUES (1,'ARRACHERA',NULL,349,'2026-09-24 01:54:22',1,NULL,1,1,349,0),(2,'CHISTORRA',NULL,152,'2026-09-24 01:54:22',1,NULL,1,1,152,0),(3,'CHORIZO',NULL,15,'2026-09-24 01:54:22',1,NULL,1,1,15,0),(4,'CHORIZO ARGENTINO',NULL,149,'2026-09-24 01:54:22',1,NULL,1,1,149,0),(5,'COSTILLA CARGADA',NULL,175,'2026-09-24 01:54:22',1,NULL,1,1,175,0),(6,'FILETE',NULL,300,'2026-09-24 01:54:22',1,NULL,1,1,300,0),(7,'NEW YORK',NULL,300,'2026-09-24 01:54:22',1,NULL,1,1,300,0),(8,'PICAÑA',NULL,330,'2026-09-24 01:54:22',1,NULL,1,1,330,0),(9,'RIB EYE',NULL,510,'2026-09-24 01:54:22',1,NULL,1,1,510,0),(10,'RIB EYE SELECTO',NULL,369,'2026-09-24 01:54:22',1,NULL,1,1,369,0),(11,'TOP SIRLON',NULL,270,'2026-09-24 01:54:22',1,NULL,1,1,270,0),(12,'TUETANO','',37.84,'2026-09-24 01:54:22',1,37,1,1,37.84,0);
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
  `cost_tax` double DEFAULT NULL,
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
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=latin1 ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `item_attribute`
--

LOCK TABLES `item_attribute` WRITE;
/*!40000 ALTER TABLE `item_attribute` DISABLE KEYS */;
INSERT INTO `item_attribute` VALUES (1,'00001',NULL,NULL,0,NULL,0,NULL,'2026-09-24 01:54:22',1,NULL,NULL,1,1),(2,'00002',NULL,NULL,0,NULL,0,NULL,'2026-09-24 01:54:22',1,NULL,NULL,2,1),(3,'00003',NULL,NULL,0,NULL,0,NULL,'2026-09-24 01:54:22',1,NULL,NULL,3,1),(4,'00004',NULL,NULL,0,NULL,0,NULL,'2026-09-24 01:54:22',1,NULL,NULL,4,1),(5,'00005',NULL,NULL,0,NULL,0,NULL,'2026-09-24 01:54:22',1,NULL,NULL,5,1),(6,'00006',NULL,NULL,0,NULL,0,NULL,'2026-09-24 01:54:22',1,NULL,NULL,6,1),(7,'00007',NULL,NULL,0,NULL,0,NULL,'2026-09-24 01:54:22',1,NULL,NULL,7,1),(8,'00008',NULL,NULL,0,NULL,0,NULL,'2026-09-24 01:54:22',1,NULL,NULL,8,1),(9,'00009',NULL,NULL,0,NULL,0,NULL,'2026-09-24 01:54:22',1,NULL,NULL,9,1),(10,'00010',NULL,NULL,0,NULL,0,NULL,'2026-09-24 01:54:22',1,NULL,NULL,10,1),(11,'00011',NULL,NULL,0,NULL,0,NULL,'2026-09-24 01:54:22',1,NULL,NULL,11,1),(12,'00012','',NULL,0,NULL,0,0,'2026-09-24 01:54:22',1,14,33,12,1);
/*!40000 ALTER TABLE `item_attribute` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-09-26 11:28:16
