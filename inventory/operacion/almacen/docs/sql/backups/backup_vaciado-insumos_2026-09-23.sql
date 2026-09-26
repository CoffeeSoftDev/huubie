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
) ENGINE=InnoDB AUTO_INCREMENT=127 DEFAULT CHARSET=latin1 ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `item`
--

LOCK TABLES `item` WRITE;
/*!40000 ALTER TABLE `item` DISABLE KEYS */;
INSERT INTO `item` VALUES (1,'FECULA DE MAIZ',NULL,0,'2026-06-17 10:05:00',1,22,1,1,NULL,NULL),(2,'POLVO PARA HORNEAR',NULL,0,'2026-06-17 10:05:00',1,23,1,1,NULL,NULL),(3,'CANELA EN POLVO',NULL,0,'2026-06-17 10:05:00',1,23,1,1,NULL,NULL),(4,'GLASSE DE FRESA',NULL,0,'2026-06-17 10:05:00',1,25,1,1,NULL,NULL),(5,'MANGA DE PIÑA',NULL,0,'2026-06-17 10:05:00',1,25,1,1,NULL,NULL),(6,'MANGA DE FRESA',NULL,0,'2026-06-17 10:05:00',1,25,1,1,NULL,NULL),(7,'MANGA DE ZARZAMORA',NULL,0,'2026-06-17 10:05:00',1,25,1,1,NULL,NULL),(8,'GANASHE BLANCO',NULL,0,'2026-06-17 10:05:00',1,24,1,1,NULL,NULL),(9,'GANASHE OSCURO',NULL,0,'2026-06-17 10:05:00',1,24,1,1,NULL,NULL),(10,'MANGA DE VAINILLA',NULL,0,'2026-06-17 10:05:00',1,25,1,1,NULL,NULL),(11,'CHOCOLATE CARAT',NULL,0,'2026-06-17 10:05:00',1,24,1,1,NULL,NULL),(12,'COCOA',NULL,0,'2026-06-17 10:05:00',1,24,1,1,NULL,NULL),(13,'NUEZ PICADA','',200,'2026-06-17 10:05:00',1,28,1,1,200,0),(14,'AJONJOLI',NULL,0,'2026-06-17 10:05:00',1,28,1,1,NULL,NULL),(15,'ALMENDRA FILETEADA',NULL,0,'2026-06-17 10:05:00',1,28,1,1,NULL,NULL),(16,'COCO',NULL,0,'2026-06-17 10:05:00',1,28,1,1,NULL,NULL),(17,'CACAHUATE',NULL,0,'2026-06-17 10:05:00',1,28,1,1,NULL,NULL),(18,'GALLETA MARIAS',NULL,0,'2026-06-17 10:05:00',1,29,1,1,NULL,NULL),(19,'LECHE PRADEL',NULL,0,'2026-06-17 10:05:00',1,26,1,1,NULL,NULL),(20,'JARABE 3 LECHES',NULL,0,'2026-06-17 10:05:00',1,27,1,1,NULL,NULL),(21,'AMBIANTE',NULL,0,'2026-06-17 10:05:00',1,27,1,1,NULL,NULL),(22,'GALLETA RITZ',NULL,0,'2026-06-17 10:05:00',1,29,1,1,NULL,NULL),(23,'GALLETA OREO',NULL,0,'2026-06-17 10:05:00',1,29,1,1,NULL,NULL),(24,'GALLETA LOTUS',NULL,0,'2026-06-17 10:05:00',1,29,1,1,NULL,NULL),(25,'MIEL',NULL,0,'2026-06-17 10:05:00',1,25,1,1,NULL,NULL),(26,'BOTE DE CANELA',NULL,0,'2026-06-17 10:05:00',1,23,1,1,NULL,NULL),(27,'CREMA LOTUS',NULL,0,'2026-06-17 10:05:00',1,25,1,1,NULL,NULL),(28,'HARINA DE ALMENDRAS',NULL,0,'2026-06-17 10:05:00',1,22,1,1,NULL,NULL),(29,'TEQUILA',NULL,0,'2026-06-17 10:05:00',1,30,1,1,NULL,NULL),(30,'ROMPOPE',NULL,0,'2026-06-17 10:05:00',1,30,1,1,NULL,NULL),(31,'BRANDY',NULL,0,'2026-06-17 10:05:00',1,30,1,1,NULL,NULL),(32,'LICOR DE BAILEYS',NULL,0,'2026-06-17 10:05:00',1,30,1,1,NULL,NULL),(33,'OSTIONES AHUMADOS',NULL,0,'2026-06-17 10:05:00',1,31,1,1,NULL,NULL),(34,'MERMELADA DE FRESA',NULL,0,'2026-06-17 10:05:00',1,25,1,1,NULL,NULL),(35,'MERMELADA DE ZARZAMORA',NULL,0,'2026-06-17 10:05:00',1,25,1,1,NULL,NULL),(36,'CREMA DE AVELLANAS',NULL,0,'2026-06-17 10:05:00',1,25,1,1,NULL,NULL),(37,'EXTRACTO DE VAINILLA',NULL,0,'2026-06-17 10:05:00',1,23,1,1,NULL,NULL),(38,'LECHE LALA DESLACTOSADA',NULL,0,'2026-06-17 10:05:00',1,26,1,1,NULL,NULL),(39,'DULCE DE LECHE',NULL,0,'2026-06-17 10:05:00',1,25,1,1,NULL,NULL),(40,'LECHERA',NULL,0,'2026-06-17 10:05:00',1,26,1,1,NULL,NULL),(41,'CARNETION',NULL,0,'2026-06-17 10:05:00',1,26,1,1,NULL,NULL),(42,'LEVADURA',NULL,0,'2026-06-17 10:05:00',1,23,1,1,NULL,NULL),(43,'CHOCOLATE PARA DONA',NULL,0,'2026-06-17 10:05:00',1,24,1,1,NULL,NULL),(44,'COBERTURA PARA DONA MAPLE',NULL,0,'2026-06-17 10:05:00',1,24,1,1,NULL,NULL),(45,'GELATINAS',NULL,0,'2026-06-17 10:05:00',1,23,1,1,NULL,NULL),(46,'MEJORAMIX',NULL,0,'2026-06-17 10:05:00',1,23,1,1,NULL,NULL),(47,'SALSA PARA PIZZA',NULL,0,'2026-06-17 10:05:00',1,31,1,1,NULL,NULL),(48,'CAFE',NULL,0,'2026-06-17 10:05:00',1,32,1,1,NULL,NULL),(49,'MAYONESA MEMBER`S MARK',NULL,0,'2026-06-17 10:05:00',1,31,1,1,NULL,NULL),(50,'MAYONESA MCCORMICK',NULL,0,'2026-06-17 10:05:00',1,31,1,1,NULL,NULL),(51,'SAL',NULL,0,'2026-06-17 10:05:00',1,31,1,1,NULL,NULL),(52,'ACEITE',NULL,0,'2026-06-17 10:05:00',1,31,1,1,0,0),(53,'VAINILLA',NULL,0,'2026-06-17 10:05:00',1,23,1,1,NULL,NULL),(54,'CEREZAS',NULL,0,'2026-06-17 10:05:00',1,28,1,1,NULL,NULL),(55,'DURAZNO MITADES',NULL,0,'2026-06-17 10:05:00',1,28,1,1,NULL,NULL),(56,'PIÑA TROZOS',NULL,0,'2026-06-17 10:05:00',1,28,1,1,NULL,NULL),(57,'PIÑA RODAJAS',NULL,0,'2026-06-17 10:05:00',1,28,1,1,NULL,NULL),(58,'GRANILLO DE COLORES',NULL,0,'2026-06-17 10:05:00',1,23,1,1,NULL,NULL),(59,'AZUCAR REFINADA',NULL,0,'2026-06-17 10:05:00',1,22,1,1,NULL,NULL),(60,'AZUCAR MASCABADO',NULL,0,'2026-06-17 10:05:00',1,22,1,1,NULL,NULL),(61,'AZUCAR GLASS',NULL,0,'2026-06-17 10:05:00',1,22,1,1,NULL,NULL),(62,'AZUCAR ESTANDAR',NULL,0,'2026-06-17 10:05:00',1,22,1,1,NULL,NULL),(63,'HARINA MAYRAN',NULL,0,'2026-06-17 10:05:00',1,22,1,1,NULL,NULL),(64,'HUEVO',NULL,0,'2026-06-17 10:05:00',1,26,1,1,NULL,NULL),(65,'MANTEQUILLA AZTURIAS',NULL,0,'2026-06-17 10:05:00',1,26,1,1,NULL,NULL),(66,'MARGARINA BIZCOCHO',NULL,0,'2026-06-17 10:05:00',1,26,1,1,NULL,NULL),(67,'FEITE DANES',NULL,0,'2026-06-17 10:05:00',1,26,1,1,NULL,NULL),(68,'CAJETA',NULL,0,'2026-06-17 10:05:00',1,25,1,1,NULL,NULL),(69,'SELECTA',NULL,0,'2026-06-17 10:05:00',1,26,1,1,NULL,NULL),(70,'QUESO CREMA SANTA CRUZ',NULL,0,'2026-06-17 10:05:00',1,26,1,1,NULL,NULL),(71,'QUESO PHILADELPHIA',NULL,0,'2026-06-17 10:05:00',1,26,1,1,NULL,NULL),(72,'CHOCOLATE BLANCO',NULL,0,'2026-06-17 10:05:00',1,24,1,1,NULL,NULL),(73,'YOGURT',NULL,0,'2026-06-17 10:05:00',1,26,1,1,NULL,NULL),(74,'FERREROS',NULL,0,'2026-06-17 10:05:00',1,29,1,1,NULL,NULL),(75,'CREMA DE BAILYES',NULL,0,'2026-06-17 10:05:00',1,27,1,1,NULL,NULL),(76,'GRANILLO DE CHOCOLATE',NULL,0,'2026-06-17 10:05:00',1,23,1,1,NULL,NULL),(77,'JAMON',NULL,0,'2026-06-17 10:05:00',1,31,1,1,NULL,NULL),(78,'SALCHICHA',NULL,0,'2026-06-17 10:05:00',1,31,1,1,NULL,NULL),(79,'QUESO AMARILLO',NULL,0,'2026-06-17 10:05:00',1,26,1,1,NULL,NULL),(80,'QUESO MOZZARELLA',NULL,0,'2026-06-17 10:05:00',1,26,1,1,NULL,NULL),(81,'CREMA PARA BATIR BETTERCREAM',NULL,0,'2026-06-17 10:05:00',1,27,1,1,NULL,NULL),(82,'DOBLE CHOCOLATE',NULL,0,'2026-06-17 10:05:00',1,27,1,1,NULL,NULL),(83,'JARABE 3 LECHES RICHES',NULL,0,'2026-06-17 10:05:00',1,27,1,1,NULL,NULL),(84,'JARABE DE BAILYES',NULL,0,'2026-06-17 10:05:00',1,27,1,1,NULL,NULL),(85,'FRUTOS ROJOS CONGELADOS',NULL,0,'2026-06-17 10:05:00',1,28,1,1,NULL,NULL),(86,'FRESAS CONGELADAS',NULL,0,'2026-06-17 10:05:00',1,28,1,1,NULL,NULL),(87,'MANGO EN CUBITOS',NULL,0,'2026-06-17 10:05:00',1,28,1,1,NULL,NULL),(88,'PULPA DE MANGO',NULL,0,'2026-06-17 10:05:00',1,28,1,1,NULL,NULL),(89,'PEPERONI',NULL,0,'2026-06-17 10:05:00',1,31,1,1,NULL,NULL),(90,'ELOTE EN GRANO',NULL,0,'2026-06-17 10:05:00',1,31,1,1,NULL,NULL),(91,'CHOCOLANTE OSCURO',NULL,0,'2026-06-17 10:05:00',1,24,1,1,NULL,NULL),(92,'CHOCOLANTE LECHE',NULL,0,'2026-06-17 10:05:00',1,24,1,1,NULL,NULL),(93,'RAJAS',NULL,0,'2026-06-17 10:05:00',1,31,1,1,NULL,NULL),(94,'QUESO DOBLE CREMA',NULL,0,'2026-06-17 10:05:00',1,26,1,1,NULL,NULL),(95,'CHISPA DE CHOCOLATE',NULL,0,'2026-06-17 10:05:00',1,24,1,1,NULL,NULL),(96,'CONCENTRADO DE JARABE 3 LECHES',NULL,0,'2026-06-17 10:05:00',1,27,1,1,NULL,NULL),(97,'DOMO C-85',NULL,0,'2026-06-17 10:05:00',1,33,1,1,NULL,NULL),(98,'DOMO C-95',NULL,0,'2026-06-17 10:05:00',1,33,1,1,NULL,NULL),(99,'DOMO C-105',NULL,0,'2026-06-17 10:05:00',1,33,1,1,NULL,NULL),(100,'DOMO P-32AN',NULL,0,'2026-06-17 10:05:00',1,33,1,1,NULL,NULL),(101,'DOMO P-20AN',NULL,0,'2026-06-17 10:05:00',1,33,1,1,NULL,NULL),(102,'DOMO C-15N',NULL,0,'2026-06-17 10:05:00',1,33,1,1,NULL,NULL),(103,'DOMO REBANADAS',NULL,0,'2026-06-17 10:05:00',1,33,1,1,NULL,NULL),(104,'DOMO LASAÑA',NULL,0,'2026-06-17 10:05:00',1,33,1,1,NULL,NULL),(105,'DOMO 1/4 DE PLANCHA',NULL,0,'2026-06-17 10:05:00',1,33,1,1,NULL,NULL),(106,'DOMO 1/2 PLANCHA',NULL,0,'2026-06-17 10:05:00',1,33,1,1,NULL,NULL),(107,'DOMO CUPCAKE',NULL,0,'2026-06-17 10:05:00',1,33,1,1,NULL,NULL),(108,'DOMO BOCADILLO GD',NULL,0,'2026-06-17 10:05:00',1,33,1,1,NULL,NULL),(109,'DOMO BOCADILLO CH',NULL,0,'2026-06-17 10:05:00',1,33,1,1,NULL,NULL),(110,'DOMO ROSCA MED',NULL,0,'2026-06-17 10:05:00',1,33,1,1,NULL,NULL),(111,'DOMO ROSCA GD',NULL,0,'2026-06-17 10:05:00',1,33,1,1,NULL,NULL),(112,'DOMO ROSCA FAMILIAR',NULL,0,'2026-06-17 10:05:00',1,33,1,1,NULL,NULL),(113,'BASE 15CM',NULL,0,'2026-06-17 10:05:00',1,33,1,1,NULL,NULL),(114,'BASE 20 CM',NULL,0,'2026-06-17 10:05:00',1,33,1,1,NULL,NULL),(115,'BASE 25 CM',NULL,0,'2026-06-17 10:05:00',1,33,1,1,NULL,NULL),(116,'BASE 30 CM',NULL,0,'2026-06-17 10:05:00',1,33,1,1,NULL,NULL),(117,'BASE 35 CM',NULL,0,'2026-06-17 10:05:00',1,33,1,1,NULL,NULL),(118,'BASE 40 CM',NULL,0,'2026-06-17 10:05:00',1,33,1,1,NULL,NULL),(119,'BASE 45 CM',NULL,0,'2026-06-17 10:05:00',1,33,1,1,NULL,NULL),(120,'DOMO CHUNCAKE',NULL,0,'2026-06-17 10:05:00',1,33,1,1,NULL,NULL),(121,'CAJAS DE GALLETA',NULL,0,'2026-06-17 10:05:00',1,33,1,1,NULL,NULL),(122,'BASE DORADA','',270,'2026-06-17 10:05:00',1,33,1,1,250,8),(123,'cafe nimbuz 500 gr','',250.0032,'2026-06-17 16:11:24',1,32,1,1,215.52,16),(124,'ARRACHERA',NULL,349,'2026-09-23 14:40:07',1,37,1,1,349,0),(125,'Chistorra',NULL,152,'2026-09-23 14:41:05',1,37,1,1,152,0),(126,'Chorizo','',15,'2026-09-23 14:41:26',1,37,1,1,15,0);
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
) ENGINE=InnoDB AUTO_INCREMENT=127 DEFAULT CHARSET=latin1 ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `item_attribute`
--

LOCK TABLES `item_attribute` WRITE;
/*!40000 ALTER TABLE `item_attribute` DISABLE KEYS */;
INSERT INTO `item_attribute` VALUES (1,'22001',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,11,24,1,1),(2,'23001',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,11,24,2,1),(3,'23002',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,11,33,3,1),(4,'25001',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,11,33,4,1),(5,'25002',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,11,33,5,1),(6,'25003',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,11,33,6,1),(7,'25004',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,11,33,7,1),(8,'24001',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,11,33,8,1),(9,'24002',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,11,33,9,1),(10,'25005',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,11,33,10,1),(11,'24003',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,11,33,11,1),(12,'24004',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,12,24,12,1),(13,'28001','',7,0,NULL,0,0,'2026-06-17 10:05:00',1,12,24,13,1),(14,'28002',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,12,24,14,1),(15,'28003',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,12,24,15,1),(16,'28004',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,12,24,16,1),(17,'28005',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,12,24,17,1),(18,'29001',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,12,38,18,1),(19,'26001',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,12,35,19,1),(20,'27001',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,12,35,20,1),(21,'27002',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,12,35,21,1),(22,'29002',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,13,38,22,1),(23,'29003',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,13,36,23,1),(24,'29004',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,13,36,24,1),(25,'25006',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,13,27,25,1),(26,'23003',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,13,27,26,1),(27,'25007',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,13,27,27,1),(28,'22002',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,13,33,28,1),(29,'30001',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,13,28,29,1),(30,'30002',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,13,28,30,1),(31,'30003',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,13,28,31,1),(32,'30004',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,13,28,32,1),(33,'31001',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,13,30,33,1),(34,'25008',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,13,32,34,1),(35,'25009',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,13,32,35,1),(36,'25010',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,13,32,36,1),(37,'23004',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,13,35,37,1),(38,'26002',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,13,35,38,1),(39,'25011',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,13,34,39,1),(40,'26003',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,13,34,40,1),(41,'26004',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,13,34,41,1),(42,'23005',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,13,37,42,1),(43,'24005',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,13,33,43,1),(44,'24006',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,13,33,44,1),(45,'23006',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,13,37,45,1),(46,'23007',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,13,26,46,1),(47,'31002',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,13,26,47,1),(48,'32001',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,13,27,48,1),(49,'31003',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,13,22,49,1),(50,'31004',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,13,22,50,1),(51,'31005',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,13,33,51,1),(52,'31006',NULL,NULL,25,0,0,NULL,'2026-06-17 10:05:00',1,13,35,52,1),(53,'23008',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,13,23,53,1),(54,'28006',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,13,22,54,1),(55,'28007',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,13,22,55,1),(56,'28008',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,13,22,56,1),(57,'28009',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,13,22,57,1),(58,'23009',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,13,26,58,1),(59,'22003',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,13,33,59,1),(60,'22004',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,13,19,60,1),(61,'22005',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,13,37,61,1),(62,'22006',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,13,20,62,1),(63,'22007',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,13,20,63,1),(64,'26005',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,13,31,64,1),(65,'26006',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,14,33,65,1),(66,'26007',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,14,33,66,1),(67,'26008',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,14,33,67,1),(68,'25012',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,14,33,68,1),(69,'26009',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,14,33,69,1),(70,'26010',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,14,33,70,1),(71,'26011',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,14,33,71,1),(72,'24007',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,14,24,72,1),(73,'26012',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,14,35,73,1),(74,'29005',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,14,29,74,1),(75,'27003',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,14,37,75,1),(76,'23010',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,14,37,76,1),(77,'31007',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,14,37,77,1),(78,'31008',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,14,37,78,1),(79,'26013',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,14,37,79,1),(80,'26014',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,14,37,80,1),(81,'27004',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,15,29,81,1),(82,'27005',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,15,29,82,1),(83,'27006',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,15,29,83,1),(84,'27007',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,15,29,84,1),(85,'28010',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,15,21,85,1),(86,'28011',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,15,21,86,1),(87,'28012',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,15,21,87,1),(88,'28013',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,15,33,88,1),(89,'31009',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,15,21,89,1),(90,'31010',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,15,21,90,1),(91,'24008',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,15,25,91,1),(92,'24009',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,15,25,92,1),(93,'31011',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,15,21,93,1),(94,'26015',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,15,37,94,1),(95,'24010',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,15,37,95,1),(96,'27008',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,15,29,96,1),(97,'33001',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,16,37,97,1),(98,'33002',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,16,37,98,1),(99,'33003',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,16,37,99,1),(100,'33004',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,16,37,100,1),(101,'33005',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,16,37,101,1),(102,'33006',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,16,37,102,1),(103,'33007',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,16,37,103,1),(104,'33008',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,16,37,104,1),(105,'33009',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,16,37,105,1),(106,'33010',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,16,37,106,1),(107,'33011',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,16,37,107,1),(108,'33012',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,16,37,108,1),(109,'33013',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,16,37,109,1),(110,'33014',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,16,37,110,1),(111,'33015',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,16,37,111,1),(112,'33016',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,16,37,112,1),(113,'33017',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,16,37,113,1),(114,'33018',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,16,37,114,1),(115,'33019',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,16,37,115,1),(116,'33020',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,16,37,116,1),(117,'33021',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,16,37,117,1),(118,'33022',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,16,37,118,1),(119,'33023',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,16,37,119,1),(120,'33024',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,16,37,120,1),(121,'33025',NULL,NULL,0,NULL,0,NULL,'2026-06-17 10:05:00',1,16,37,121,1),(122,'33026','',NULL,0,NULL,15,0,'2026-06-17 10:05:00',1,16,37,122,1),(123,'32002','',NULL,0,NULL,0,0,'2026-06-17 16:11:24',1,11,3,123,1),(124,'37001',NULL,4,349,0,12,15,'2026-09-23 14:40:07',1,15,33,124,1),(125,'37002',NULL,NULL,152,0,1,2,'2026-09-23 14:41:05',1,NULL,33,125,1),(126,'23011','',NULL,0,NULL,0,0,'2026-09-23 14:41:26',1,NULL,19,126,1);
/*!40000 ALTER TABLE `item_attribute` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stock`
--

DROP TABLE IF EXISTS `stock`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `stock` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `quantity` double NOT NULL DEFAULT '0',
  `last_movement_at` datetime DEFAULT NULL,
  `last_inventory_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `active` tinyint(4) NOT NULL DEFAULT '1',
  `warehouse_id` int(11) NOT NULL,
  `item_id` int(11) NOT NULL,
  `companies_id` int(11) NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_stock` (`item_id`,`warehouse_id`) USING BTREE,
  KEY `idx_stock_warehouse` (`warehouse_id`) USING BTREE,
  KEY `idx_stock_company` (`companies_id`) USING BTREE,
  CONSTRAINT `fk_stock_company` FOREIGN KEY (`companies_id`) REFERENCES `fayxzvov_erp`.`companies` (`id`),
  CONSTRAINT `fk_stock_item` FOREIGN KEY (`item_id`) REFERENCES `item` (`id`),
  CONSTRAINT `fk_stock_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouse` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=latin1 ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stock`
--

LOCK TABLES `stock` WRITE;
/*!40000 ALTER TABLE `stock` DISABLE KEYS */;
INSERT INTO `stock` VALUES (1,10,'2026-06-17 10:17:42',NULL,'2026-06-17 10:17:42','2026-06-17 10:17:42',1,5,52,1),(2,0,'2026-09-23 08:41:50',NULL,'2026-06-17 10:33:03','2026-09-23 08:41:50',1,1,52,1),(3,0,'2026-09-23 08:41:50',NULL,'2026-09-23 08:34:11','2026-09-23 08:41:50',1,1,21,1),(4,8.4,'2026-09-23 08:43:34',NULL,'2026-09-23 08:43:34','2026-09-23 08:43:34',1,1,124,1),(5,1.68,'2026-09-23 08:43:34',NULL,'2026-09-23 08:43:34','2026-09-23 08:43:34',1,1,125,1),(6,0.6,'2026-09-23 08:43:34',NULL,'2026-09-23 08:43:34','2026-09-23 08:43:34',1,1,126,1);
/*!40000 ALTER TABLE `stock` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inventory_inflow`
--

DROP TABLE IF EXISTS `inventory_inflow`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `inventory_inflow` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `folio` varchar(20) NOT NULL,
  `note` varchar(255) DEFAULT NULL,
  `total_products` int(11) DEFAULT '0',
  `total_units` double DEFAULT '0',
  `total_cost` double DEFAULT '0',
  `total_price_without_tax` double DEFAULT NULL,
  `tax` int(11) DEFAULT NULL,
  `date_inflow` date DEFAULT NULL,
  `confirmed_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `status` varchar(20) DEFAULT 'Pendiente',
  `active` tinyint(4) DEFAULT '1',
  `inflow_origin_id` int(11) DEFAULT NULL,
  `warehouse_id` int(11) DEFAULT NULL,
  `supplier_id` int(11) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `confirmed_user_id` int(11) DEFAULT NULL,
  `branch_id` int(11) DEFAULT NULL,
  `companies_id` int(11) DEFAULT NULL,
  `purchase_order_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_inflow_origin` (`inflow_origin_id`) USING BTREE,
  KEY `idx_inflow_warehouse` (`warehouse_id`) USING BTREE,
  KEY `idx_inflow_supplier` (`supplier_id`) USING BTREE,
  KEY `idx_inflow_user` (`user_id`) USING BTREE,
  KEY `idx_inflow_cuser` (`confirmed_user_id`) USING BTREE,
  KEY `idx_inflow_subsidiary` (`branch_id`) USING BTREE,
  KEY `idx_inflow_company` (`companies_id`) USING BTREE,
  KEY `idx_inflow_po` (`purchase_order_id`) USING BTREE,
  CONSTRAINT `fk_inflow_branch` FOREIGN KEY (`branch_id`) REFERENCES `fayxzvov_erp`.`branches` (`id`),
  CONSTRAINT `fk_inflow_company` FOREIGN KEY (`companies_id`) REFERENCES `fayxzvov_erp`.`companies` (`id`),
  CONSTRAINT `fk_inflow_cuser` FOREIGN KEY (`confirmed_user_id`) REFERENCES `fayxzvov_erp`.`users` (`id`),
  CONSTRAINT `fk_inflow_origin` FOREIGN KEY (`inflow_origin_id`) REFERENCES `inflow_origin` (`id`),
  CONSTRAINT `fk_inflow_po` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_order` (`id`),
  CONSTRAINT `fk_inflow_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `supplier` (`id`),
  CONSTRAINT `fk_inflow_user` FOREIGN KEY (`user_id`) REFERENCES `fayxzvov_erp`.`users` (`id`),
  CONSTRAINT `fk_inflow_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouse` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=latin1 ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventory_inflow`
--

LOCK TABLES `inventory_inflow` WRITE;
/*!40000 ALTER TABLE `inventory_inflow` DISABLE KEYS */;
INSERT INTO `inventory_inflow` VALUES (1,'ENT-0001',NULL,1,10,250,250,NULL,'2026-06-17',NULL,'2026-06-17 10:17:42','2026-06-17 10:17:42','Aplicada',1,1,5,2,2,NULL,2,1,NULL),(2,'ENT-0002','Recepcion de OC REAB-0001',1,10,0,0,NULL,'2026-06-17',NULL,'2026-06-17 10:36:58','2026-06-17 10:36:58','Aplicada',1,1,1,NULL,2,NULL,1,1,3),(3,'ENT-0003',NULL,2,17,125,125,NULL,'2026-09-23',NULL,'2026-09-23 08:34:11','2026-09-23 08:41:50','Cancelada',1,1,1,2,2,NULL,1,1,NULL),(4,'ENT-0004',NULL,3,10.68,3186.96,3186.96,NULL,'2026-09-23',NULL,'2026-09-23 08:43:33','2026-09-23 08:43:33','Aplicada',1,1,1,2,2,NULL,1,1,NULL);
/*!40000 ALTER TABLE `inventory_inflow` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `detail_inventory_inflow`
--

DROP TABLE IF EXISTS `detail_inventory_inflow`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `detail_inventory_inflow` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `batch_code` varchar(40) DEFAULT NULL,
  `quantity` double NOT NULL DEFAULT '0',
  `confirmed_quantity` double DEFAULT NULL,
  `cost` double NOT NULL DEFAULT '0',
  `subtotal` double NOT NULL DEFAULT '0',
  `price_without_tax` double DEFAULT NULL,
  `tax` int(11) DEFAULT NULL,
  `previous_stock` double NOT NULL DEFAULT '0',
  `resulting_stock` double NOT NULL DEFAULT '0',
  `expires_at` date DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `active` tinyint(4) NOT NULL DEFAULT '1',
  `item_id` int(11) NOT NULL,
  `inventory_inflow_id` int(11) NOT NULL,
  `unit_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_dinflow_item` (`item_id`) USING BTREE,
  KEY `idx_dinflow_header` (`inventory_inflow_id`) USING BTREE,
  KEY `idx_dinflow_unit` (`unit_id`) USING BTREE,
  CONSTRAINT `fk_dinflow_header` FOREIGN KEY (`inventory_inflow_id`) REFERENCES `inventory_inflow` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_dinflow_item` FOREIGN KEY (`item_id`) REFERENCES `item` (`id`),
  CONSTRAINT `fk_dinflow_unit` FOREIGN KEY (`unit_id`) REFERENCES `unit` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=latin1 ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `detail_inventory_inflow`
--

LOCK TABLES `detail_inventory_inflow` WRITE;
/*!40000 ALTER TABLE `detail_inventory_inflow` DISABLE KEYS */;
INSERT INTO `detail_inventory_inflow` VALUES (1,NULL,10,NULL,25,250,25,0,0,10,NULL,'2026-06-17 10:17:42',1,52,1,NULL),(2,NULL,10,NULL,0,0,0,0,-10,0,NULL,'2026-06-17 10:36:58',1,52,2,NULL),(3,NULL,1,5,25,125,25,0,1,5,NULL,'2026-09-23 08:34:11',1,52,3,NULL),(4,NULL,1,12,0,0,0,0,1,12,NULL,'2026-09-23 08:34:11',1,21,3,NULL),(5,NULL,8.4,NULL,349,2931.6,349,0,0,8.4,NULL,'2026-09-23 08:43:34',1,124,4,NULL),(6,NULL,1.68,NULL,152,255.36,152,0,0,1.68,NULL,'2026-09-23 08:43:34',1,125,4,NULL),(7,NULL,0.6,NULL,0,0,0,0,0,0.6,NULL,'2026-09-23 08:43:34',1,126,4,NULL);
/*!40000 ALTER TABLE `detail_inventory_inflow` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inventory_shrinkage`
--

DROP TABLE IF EXISTS `inventory_shrinkage`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `inventory_shrinkage` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `folio` varchar(20) NOT NULL,
  `note` varchar(255) DEFAULT NULL,
  `evidence_url` varchar(255) DEFAULT NULL,
  `total_products` int(11) NOT NULL DEFAULT '0',
  `total_units` double NOT NULL DEFAULT '0',
  `total_cost` double NOT NULL DEFAULT '0',
  `date_shrinkage` date DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `status` varchar(20) NOT NULL DEFAULT 'Aplicada',
  `active` tinyint(4) NOT NULL DEFAULT '1',
  `shrinkage_reason_id` int(11) DEFAULT NULL,
  `warehouse_id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `branch_id` int(11) NOT NULL,
  `companies_id` int(11) NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_shrink_reason` (`shrinkage_reason_id`) USING BTREE,
  KEY `idx_shrink_warehouse` (`warehouse_id`) USING BTREE,
  KEY `idx_shrink_user` (`user_id`) USING BTREE,
  KEY `idx_shrink_subsidiary` (`branch_id`) USING BTREE,
  KEY `idx_shrink_company` (`companies_id`) USING BTREE,
  CONSTRAINT `fk_shrink_branch` FOREIGN KEY (`branch_id`) REFERENCES `fayxzvov_erp`.`branches` (`id`),
  CONSTRAINT `fk_shrink_company` FOREIGN KEY (`companies_id`) REFERENCES `fayxzvov_erp`.`companies` (`id`),
  CONSTRAINT `fk_shrink_reason` FOREIGN KEY (`shrinkage_reason_id`) REFERENCES `shrinkage_reason` (`id`),
  CONSTRAINT `fk_shrink_user` FOREIGN KEY (`user_id`) REFERENCES `fayxzvov_erp`.`users` (`id`),
  CONSTRAINT `fk_shrink_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouse` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=latin1 ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventory_shrinkage`
--

LOCK TABLES `inventory_shrinkage` WRITE;
/*!40000 ALTER TABLE `inventory_shrinkage` DISABLE KEYS */;
INSERT INTO `inventory_shrinkage` VALUES (4,'SI-0001','Surtido de solicitud OC-0002',NULL,1,10,0,'2026-06-17','2026-06-17 10:33:03','2026-06-17 10:33:03','Aplicada',1,8,1,2,1,1);
/*!40000 ALTER TABLE `inventory_shrinkage` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `detail_inventory_shrinkage`
--

DROP TABLE IF EXISTS `detail_inventory_shrinkage`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `detail_inventory_shrinkage` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `quantity` double NOT NULL DEFAULT '0',
  `cost` double NOT NULL DEFAULT '0',
  `subtotal` double NOT NULL DEFAULT '0',
  `previous_stock` double NOT NULL DEFAULT '0',
  `resulting_stock` double NOT NULL DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `active` tinyint(4) NOT NULL DEFAULT '1',
  `item_id` int(11) NOT NULL,
  `inventory_shrinkage_id` int(11) NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_dshrink_item` (`item_id`) USING BTREE,
  KEY `idx_dshrink_header` (`inventory_shrinkage_id`) USING BTREE,
  CONSTRAINT `fk_dshrink_header` FOREIGN KEY (`inventory_shrinkage_id`) REFERENCES `inventory_shrinkage` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_dshrink_item` FOREIGN KEY (`item_id`) REFERENCES `item` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=latin1 ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `detail_inventory_shrinkage`
--

LOCK TABLES `detail_inventory_shrinkage` WRITE;
/*!40000 ALTER TABLE `detail_inventory_shrinkage` DISABLE KEYS */;
INSERT INTO `detail_inventory_shrinkage` VALUES (4,10,0,0,0,-10,'2026-06-17 10:33:03',1,52,4);
/*!40000 ALTER TABLE `detail_inventory_shrinkage` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `purchase_order`
--

DROP TABLE IF EXISTS `purchase_order`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `purchase_order` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `folio` varchar(20) NOT NULL,
  `date_order` date DEFAULT NULL,
  `expected_date` date DEFAULT NULL,
  `note` varchar(255) DEFAULT NULL,
  `total_products` int(11) DEFAULT '0',
  `total_units` double DEFAULT '0',
  `total_cost` double DEFAULT '0',
  `total_price_without_tax` double DEFAULT NULL,
  `status` varchar(20) DEFAULT 'Borrador',
  `approved_at` datetime DEFAULT NULL,
  `reject_reason` varchar(255) DEFAULT NULL,
  `active` tinyint(4) DEFAULT '1',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `supplier_id` int(11) DEFAULT NULL,
  `warehouse_id` int(11) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `approved_user_id` int(11) DEFAULT NULL,
  `branch_id` int(11) DEFAULT NULL,
  `destination_branch_id` int(11) DEFAULT NULL,
  `companies_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_po_supplier` (`supplier_id`) USING BTREE,
  KEY `idx_po_warehouse` (`warehouse_id`) USING BTREE,
  KEY `idx_po_user` (`user_id`) USING BTREE,
  KEY `idx_po_auser` (`approved_user_id`) USING BTREE,
  KEY `idx_po_branch` (`branch_id`) USING BTREE,
  KEY `idx_po_company` (`companies_id`) USING BTREE,
  KEY `idx_po_dest_branch` (`destination_branch_id`) USING BTREE,
  CONSTRAINT `fk_po_auser` FOREIGN KEY (`approved_user_id`) REFERENCES `fayxzvov_erp`.`users` (`id`),
  CONSTRAINT `fk_po_branch` FOREIGN KEY (`branch_id`) REFERENCES `fayxzvov_erp`.`branches` (`id`),
  CONSTRAINT `fk_po_company` FOREIGN KEY (`companies_id`) REFERENCES `fayxzvov_erp`.`companies` (`id`),
  CONSTRAINT `fk_po_dest_branch` FOREIGN KEY (`destination_branch_id`) REFERENCES `fayxzvov_erp`.`branches` (`id`),
  CONSTRAINT `fk_po_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `supplier` (`id`),
  CONSTRAINT `fk_po_user` FOREIGN KEY (`user_id`) REFERENCES `fayxzvov_erp`.`users` (`id`),
  CONSTRAINT `fk_po_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouse` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=latin1 ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `purchase_order`
--

LOCK TABLES `purchase_order` WRITE;
/*!40000 ALTER TABLE `purchase_order` DISABLE KEYS */;
INSERT INTO `purchase_order` VALUES (1,'OC-0001','2026-06-17',NULL,'',2,6,0,0,'Cancelada',NULL,NULL,1,'2026-06-17 10:12:01','2026-06-17 10:13:39',NULL,NULL,2,NULL,2,NULL,1),(2,'OC-0002','2026-06-17',NULL,'',1,10,0,0,'Recibida','2026-06-17 10:19:57',NULL,1,'2026-06-17 10:14:08','2026-06-17 10:33:03',NULL,1,2,2,1,NULL,1),(3,'REAB-0001','2026-06-17',NULL,'Reabasto por surtido de la solicitud OC-0002',1,10,0,0,'Recibida',NULL,NULL,1,'2026-06-17 10:33:03','2026-06-17 10:36:58',NULL,1,2,NULL,1,NULL,1);
/*!40000 ALTER TABLE `purchase_order` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `detail_purchase_order`
--

DROP TABLE IF EXISTS `detail_purchase_order`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `detail_purchase_order` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `quantity_ordered` double NOT NULL DEFAULT '0',
  `quantity_received` double NOT NULL DEFAULT '0',
  `price_without_tax` double DEFAULT NULL,
  `tax` int(11) DEFAULT NULL,
  `cost` double DEFAULT NULL,
  `subtotal` double NOT NULL DEFAULT '0',
  `active` tinyint(4) NOT NULL DEFAULT '1',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `purchase_order_id` int(11) NOT NULL,
  `item_id` int(11) NOT NULL,
  `unit_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_dpo_header` (`purchase_order_id`) USING BTREE,
  KEY `idx_dpo_item` (`item_id`) USING BTREE,
  KEY `idx_dpo_unit` (`unit_id`) USING BTREE,
  CONSTRAINT `fk_dpo_header` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_order` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_dpo_item` FOREIGN KEY (`item_id`) REFERENCES `item` (`id`),
  CONSTRAINT `fk_dpo_unit` FOREIGN KEY (`unit_id`) REFERENCES `unit` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=latin1 ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `detail_purchase_order`
--

LOCK TABLES `detail_purchase_order` WRITE;
/*!40000 ALTER TABLE `detail_purchase_order` DISABLE KEYS */;
INSERT INTO `detail_purchase_order` VALUES (1,5,0,NULL,0,NULL,0,1,'2026-06-17 10:12:01',1,52,NULL),(2,1,0,NULL,0,NULL,0,1,'2026-06-17 10:12:01',1,123,NULL),(3,10,10,NULL,0,NULL,0,1,'2026-06-17 10:14:08',2,52,NULL),(4,10,10,NULL,0,NULL,0,1,'2026-06-17 10:33:03',3,52,NULL);
/*!40000 ALTER TABLE `detail_purchase_order` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inflow_format`
--

DROP TABLE IF EXISTS `inflow_format`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `inflow_format` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(80) NOT NULL,
  `scope` varchar(20) NOT NULL DEFAULT 'user',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `active` tinyint(4) NOT NULL DEFAULT '1',
  `user_id` int(11) NOT NULL,
  `branch_id` int(11) NOT NULL,
  `companies_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_inflow_format_user` (`user_id`),
  KEY `idx_inflow_format_branch` (`branch_id`),
  KEY `idx_inflow_format_company` (`companies_id`),
  CONSTRAINT `fk_inflow_format_branch` FOREIGN KEY (`branch_id`) REFERENCES `fayxzvov_erp`.`branches` (`id`),
  CONSTRAINT `fk_inflow_format_company` FOREIGN KEY (`companies_id`) REFERENCES `fayxzvov_erp`.`companies` (`id`),
  CONSTRAINT `fk_inflow_format_user` FOREIGN KEY (`user_id`) REFERENCES `fayxzvov_erp`.`users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inflow_format`
--

LOCK TABLES `inflow_format` WRITE;
/*!40000 ALTER TABLE `inflow_format` DISABLE KEYS */;
INSERT INTO `inflow_format` VALUES (2,'COMPRAS LUNES','user','2026-06-09 07:46:47','2026-06-09 07:46:47',1,2,1,1),(3,'compras martes','user','2026-06-09 07:47:28','2026-06-09 07:47:28',1,2,1,1);
/*!40000 ALTER TABLE `inflow_format` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inflow_format_item`
--

DROP TABLE IF EXISTS `inflow_format_item`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `inflow_format_item` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `quantity` double NOT NULL DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `active` tinyint(4) NOT NULL DEFAULT '1',
  `item_id` int(11) NOT NULL,
  `inflow_format_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_inflow_format_item_item` (`item_id`),
  KEY `idx_inflow_format_item_header` (`inflow_format_id`),
  CONSTRAINT `fk_inflow_format_item_header` FOREIGN KEY (`inflow_format_id`) REFERENCES `inflow_format` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_inflow_format_item_item` FOREIGN KEY (`item_id`) REFERENCES `item` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inflow_format_item`
--

LOCK TABLES `inflow_format_item` WRITE;
/*!40000 ALTER TABLE `inflow_format_item` DISABLE KEYS */;
INSERT INTO `inflow_format_item` VALUES (3,1,'2026-06-09 07:46:47',1,23,2),(4,1,'2026-06-09 07:46:47',1,11,2),(5,1,'2026-06-09 07:47:28',1,11,3);
/*!40000 ALTER TABLE `inflow_format_item` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inventory_transfer`
--

DROP TABLE IF EXISTS `inventory_transfer`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `inventory_transfer` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `folio` varchar(20) NOT NULL,
  `note` varchar(255) DEFAULT NULL,
  `total_products` int(11) DEFAULT '0',
  `received_by_name` varchar(120) DEFAULT NULL,
  `total_units` double DEFAULT '0',
  `total_cost` double DEFAULT '0',
  `date_request` datetime DEFAULT NULL,
  `date_authorized` datetime DEFAULT NULL,
  `date_sent` datetime DEFAULT NULL,
  `date_received` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `active` tinyint(4) NOT NULL DEFAULT '1',
  `status_id` int(11) NOT NULL,
  `origin_warehouse_id` int(11) NOT NULL,
  `destination_warehouse_id` int(11) NOT NULL,
  `origin_branch_id` int(11) NOT NULL,
  `destination_branch_id` int(11) NOT NULL,
  `requested_user_id` int(11) DEFAULT NULL,
  `authorized_user_id` int(11) DEFAULT NULL,
  `received_user_id` int(11) DEFAULT NULL,
  `companies_id` int(11) NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_transfer_status` (`status_id`) USING BTREE,
  KEY `idx_transfer_origin_wh` (`origin_warehouse_id`) USING BTREE,
  KEY `idx_transfer_dest_wh` (`destination_warehouse_id`) USING BTREE,
  KEY `idx_transfer_origin_br` (`origin_branch_id`) USING BTREE,
  KEY `idx_transfer_dest_br` (`destination_branch_id`) USING BTREE,
  KEY `idx_transfer_company` (`companies_id`) USING BTREE,
  KEY `idx_transfer_folio` (`folio`,`companies_id`) USING BTREE,
  KEY `fk_transfer_req_user` (`requested_user_id`),
  KEY `fk_transfer_auth_user` (`authorized_user_id`),
  KEY `fk_transfer_recv_user` (`received_user_id`),
  CONSTRAINT `fk_transfer_auth_user` FOREIGN KEY (`authorized_user_id`) REFERENCES `fayxzvov_erp`.`users` (`id`),
  CONSTRAINT `fk_transfer_company` FOREIGN KEY (`companies_id`) REFERENCES `fayxzvov_erp`.`companies` (`id`),
  CONSTRAINT `fk_transfer_dest_br` FOREIGN KEY (`destination_branch_id`) REFERENCES `fayxzvov_erp`.`branches` (`id`),
  CONSTRAINT `fk_transfer_dest_wh` FOREIGN KEY (`destination_warehouse_id`) REFERENCES `warehouse` (`id`),
  CONSTRAINT `fk_transfer_origin_br` FOREIGN KEY (`origin_branch_id`) REFERENCES `fayxzvov_erp`.`branches` (`id`),
  CONSTRAINT `fk_transfer_origin_wh` FOREIGN KEY (`origin_warehouse_id`) REFERENCES `warehouse` (`id`),
  CONSTRAINT `fk_transfer_recv_user` FOREIGN KEY (`received_user_id`) REFERENCES `fayxzvov_erp`.`users` (`id`),
  CONSTRAINT `fk_transfer_req_user` FOREIGN KEY (`requested_user_id`) REFERENCES `fayxzvov_erp`.`users` (`id`),
  CONSTRAINT `fk_transfer_status` FOREIGN KEY (`status_id`) REFERENCES `transfer_status` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventory_transfer`
--

LOCK TABLES `inventory_transfer` WRITE;
/*!40000 ALTER TABLE `inventory_transfer` DISABLE KEYS */;
/*!40000 ALTER TABLE `inventory_transfer` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `detail_inventory_transfer`
--

DROP TABLE IF EXISTS `detail_inventory_transfer`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `detail_inventory_transfer` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `quantity` double NOT NULL DEFAULT '0',
  `cost` double NOT NULL DEFAULT '0',
  `subtotal` double NOT NULL DEFAULT '0',
  `origin_stock_prev` double DEFAULT NULL,
  `origin_stock_post` double DEFAULT NULL,
  `destination_stock_prev` double DEFAULT NULL,
  `destination_stock_post` double DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `active` tinyint(4) NOT NULL DEFAULT '1',
  `item_id` int(11) NOT NULL,
  `inventory_transfer_id` int(11) NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_dtransfer_item` (`item_id`) USING BTREE,
  KEY `idx_dtransfer_header` (`inventory_transfer_id`) USING BTREE,
  CONSTRAINT `fk_dtransfer_header` FOREIGN KEY (`inventory_transfer_id`) REFERENCES `inventory_transfer` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_dtransfer_item` FOREIGN KEY (`item_id`) REFERENCES `item` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `detail_inventory_transfer`
--

LOCK TABLES `detail_inventory_transfer` WRITE;
/*!40000 ALTER TABLE `detail_inventory_transfer` DISABLE KEYS */;
/*!40000 ALTER TABLE `detail_inventory_transfer` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inventory_transfer_history`
--

DROP TABLE IF EXISTS `inventory_transfer_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `inventory_transfer_history` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `note` varchar(255) DEFAULT NULL,
  `transitioned_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `active` tinyint(4) NOT NULL DEFAULT '1',
  `status_id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `inventory_transfer_id` int(11) NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_thistory_status` (`status_id`) USING BTREE,
  KEY `idx_thistory_header` (`inventory_transfer_id`) USING BTREE,
  KEY `fk_thistory_user` (`user_id`),
  CONSTRAINT `fk_thistory_header` FOREIGN KEY (`inventory_transfer_id`) REFERENCES `inventory_transfer` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_thistory_status` FOREIGN KEY (`status_id`) REFERENCES `transfer_status` (`id`),
  CONSTRAINT `fk_thistory_user` FOREIGN KEY (`user_id`) REFERENCES `fayxzvov_erp`.`users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventory_transfer_history`
--

LOCK TABLES `inventory_transfer_history` WRITE;
/*!40000 ALTER TABLE `inventory_transfer_history` DISABLE KEYS */;
/*!40000 ALTER TABLE `inventory_transfer_history` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-09-23 19:48:33
