-- MySQL dump 10.13  Distrib 5.7.36, for Win64 (x86_64)
--
-- Host: localhost    Database: fayxzvov_reginas
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
-- Table structure for table `order_products`
--

DROP TABLE IF EXISTS `order_products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `order_products` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) DEFAULT NULL,
  `price` double DEFAULT NULL,
  `category_id` int(11) DEFAULT NULL,
  `date_creation` datetime DEFAULT NULL,
  `active` int(11) DEFAULT '1',
  `subsidiaries_id` int(11) DEFAULT NULL,
  `description` text,
  `image` text,
  `companies_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `classification_id` (`category_id`),
  KEY `subsidiaries_id` (`subsidiaries_id`),
  KEY `companies_id` (`companies_id`),
  CONSTRAINT `order_products_ibfk_1` FOREIGN KEY (`category_id`) REFERENCES `order_category` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `order_products_ibfk_2` FOREIGN KEY (`subsidiaries_id`) REFERENCES `fayxzvov_alpha`.`subsidiaries` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `order_products_ibfk_3` FOREIGN KEY (`companies_id`) REFERENCES `fayxzvov_admin`.`companies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=121 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `order_products`
--

LOCK TABLES `order_products` WRITE;
/*!40000 ALTER TABLE `order_products` DISABLE KEYS */;
INSERT INTO `order_products` VALUES (1,'Patel Tradicional de Mantequilla Relleno de Manjar',460,2,'2025-12-07 18:26:07',1,4,'10 Porciones','alpha_files/Reginas Pastelería/4/pedidos/6cb9caee.jpg',NULL),(2,'Tres Leches Manjar',240,2,'2025-12-07 18:27:21',1,4,'6 PORCIONES','alpha_files/Reginas Pastelería/4/pedidos/5af93929.jpg',NULL),(3,'Tres Leches Manjar 12',360,2,'2025-12-07 18:27:52',1,4,'12 PORCIONES','alpha_files/Reginas Pastelería/4/pedidos/c8eaaed0.jpg',NULL),(4,'Tres Leches Manjar 18',480,2,'2025-12-07 18:31:05',1,4,'18 PORCIONES','alpha_files/Reginas Pastelería/4/pedidos/c901a40c.jpg',NULL),(5,'Tres Leches Moka',240,2,'2025-12-07 18:31:42',1,4,'6 PORCIONES','alpha_files/Reginas Pastelería/4/pedidos/eb7b0087.jpg',NULL),(6,'Tres Leches Moka',360,2,'2025-12-07 18:32:47',1,4,'12 PORCIONES','alpha_files/Reginas Pastelería/4/pedidos/9118f1cb.jpg',NULL),(7,'Tres Leches Moka',480,2,'2025-12-07 18:33:18',1,4,'18 PORCIONES','alpha_files/Reginas Pastelería/4/pedidos/b44113c1.jpg',NULL),(8,'Tres Leches Fresas con Crema',240,2,'2025-12-07 18:33:52',1,4,'6 PORCIONES','alpha_files/Reginas Pastelería/4/pedidos/4e149faf.jpg',NULL),(98,'Carlota supremo',75,2,'2026-06-01 09:24:39',1,4,NULL,NULL,4),(99,'Chesecake de fresa',485,2,'2026-06-01 09:25:36',1,4,'',NULL,4),(100,'Pastel 3 Leches Premium Vainilla',360,4,'2026-06-01 09:26:30',1,4,'',NULL,4),(101,'Pastel 3L x Pedido',360,7,'2026-06-01 09:27:21',1,4,'',NULL,4),(102,'Mini Brownie',20,2,'2026-06-01 12:52:02',1,4,'',NULL,4),(103,'Pastel 3L Trad Aroma De Cafe',80,2,'2026-06-01 12:52:50',1,4,'',NULL,4),(104,'Pastel 3L Trad Dalmata',630,2,'2026-06-01 12:53:28',1,4,'',NULL,4),(105,'Pastel 3L Trad Frambuesa P28',465,10,'2026-06-02 13:00:58',1,4,NULL,NULL,4),(106,'Pastel 3L Trad Frambuesa P33',630,2,'2026-06-02 13:01:46',1,4,NULL,NULL,4),(107,'PASTEL 3L TRAD PIÑA COCO P33',630,2,'2026-06-02 13:05:13',1,4,'',NULL,4),(108,'PASTEL 3L TRAD PRIMAVERA P28',465,2,'2026-06-02 13:05:45',1,4,'',NULL,4),(109,'BAGUETTE NORMAL',9,5,'2026-06-02 13:08:11',1,4,'',NULL,4),(110,'BARRA REPOSADA GRANDE',19,10,'2026-06-02 13:08:47',1,4,'',NULL,4),(111,'BOLILLO',4.5,5,'2026-06-02 13:09:11',1,4,'',NULL,4),(112,'CAMPESINA DE LECHE NETEL',6,5,'2026-06-02 13:09:35',1,4,'',NULL,4),(113,'CAMPESINA DE LECHE SAEZ',8,5,'2026-06-02 13:09:58',1,4,'',NULL,4),(114,'Campesina',4.5,5,'2026-06-02 13:12:48',1,4,NULL,NULL,4),(115,'CEMA',4.5,5,'2026-06-02 13:13:11',1,4,'',NULL,4),(116,'CHAPATA DE AJO Y PEREJIL',9.5,5,'2026-06-02 13:13:41',1,4,'',NULL,4),(117,'PALITOS DE AJO',3.5,5,'2026-06-02 13:14:11',1,4,'',NULL,4),(118,'PEINETAS',22.5,5,'2026-06-02 13:14:37',1,4,'',NULL,4),(119,'PIZZA DE CHORIZO',30,5,'2026-06-02 13:15:02',1,4,'',NULL,4),(120,'TELERA',4.5,5,'2026-06-02 13:22:15',1,4,'',NULL,4);
/*!40000 ALTER TABLE `order_products` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `product_attribute`
--

DROP TABLE IF EXISTS `product_attribute`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `product_attribute` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `sku` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `shelf_life_days` int(11) DEFAULT NULL,
  `cost_unit` double NOT NULL DEFAULT '0',
  `stock_min` double NOT NULL DEFAULT '0',
  `stock_max` double NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `product_id` int(11) NOT NULL,
  `companies_id` int(11) NOT NULL,
  `warehouse_area_id` int(11) DEFAULT NULL,
  `unit_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_product_attribute_product` (`product_id`),
  UNIQUE KEY `uq_product_attribute_sku` (`sku`,`companies_id`),
  KEY `companies_id` (`companies_id`),
  KEY `warehouse_area_id` (`warehouse_area_id`),
  KEY `unit_id` (`unit_id`),
  CONSTRAINT `product_attribute_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `order_products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `product_attribute_ibfk_2` FOREIGN KEY (`companies_id`) REFERENCES `fayxzvov_admin`.`companies` (`id`),
  CONSTRAINT `product_attribute_ibfk_3` FOREIGN KEY (`warehouse_area_id`) REFERENCES `warehouse_area` (`id`) ON DELETE SET NULL,
  CONSTRAINT `product_attribute_ibfk_4` FOREIGN KEY (`unit_id`) REFERENCES `unit` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `product_attribute`
--

LOCK TABLES `product_attribute` WRITE;
/*!40000 ALTER TABLE `product_attribute` DISABLE KEYS */;
INSERT INTO `product_attribute` VALUES (1,'SKU-98','',3,75,10,10,'2026-06-01 09:24:39','2026-06-01 09:25:45',1,98,4,3,1),(2,'SKU-99','',3,485,3,5,'2026-06-01 09:25:36','2026-06-01 09:25:36',1,99,4,3,1),(3,'SKU-100','',3,360,2,3,'2026-06-01 09:26:30','2026-06-01 09:26:30',1,100,4,3,7),(4,'SKU-101','',5,360,3,2,'2026-06-01 09:27:21','2026-06-01 09:27:21',1,101,4,3,7),(5,'SKU-102','',2,20,10,15,'2026-06-01 12:52:02','2026-06-01 12:52:02',1,102,4,3,1),(6,'SKU-103','',4,80,3,3,'2026-06-01 12:52:50','2026-06-01 12:52:50',1,103,4,3,8),(7,'SKU-104','',2,630,2,2,'2026-06-01 12:53:28','2026-06-01 12:53:28',1,104,4,3,9),(8,'SKU-105','',NULL,465,1,1,'2026-06-02 13:00:58','2026-06-02 13:01:09',1,105,4,3,1),(9,'SKU-106','',NULL,630,1,1,'2026-06-02 13:01:46','2026-06-02 13:04:33',1,106,4,3,9),(10,'SKU-107','',NULL,630,1,1,'2026-06-02 13:05:13','2026-06-02 13:05:13',1,107,4,3,1),(11,'SKU-108','',NULL,465,1,1,'2026-06-02 13:05:45','2026-06-02 13:05:45',1,108,4,3,1),(12,'SKU-109','',NULL,9,12,12,'2026-06-02 13:08:11','2026-06-02 13:08:11',1,109,4,2,1),(13,'SKU-110','',NULL,19,1,1,'2026-06-02 13:08:47','2026-06-02 13:08:47',1,110,4,2,1),(14,'SKU-111','',NULL,4.5,1,1,'2026-06-02 13:09:11','2026-06-02 13:09:11',1,111,4,2,1),(15,'SKU-112','',NULL,6,0,0,'2026-06-02 13:09:35','2026-06-02 13:09:35',1,112,4,2,1),(16,'SKU-113','',NULL,8,1,1,'2026-06-02 13:09:58','2026-06-02 13:09:58',1,113,4,2,1),(17,'SKU-114','',NULL,4.5,1,1,'2026-06-02 13:12:48','2026-06-02 13:23:10',1,114,4,2,1),(18,'SKU-115','',NULL,4.5,1,1,'2026-06-02 13:13:11','2026-06-02 13:13:11',1,115,4,2,1),(19,'SKU-116','',NULL,9.5,1,1,'2026-06-02 13:13:41','2026-06-02 13:13:41',1,116,4,2,1),(20,'SKU-117','',NULL,9.5,1,1,'2026-06-02 13:14:11','2026-06-02 13:14:11',1,117,4,2,1),(21,'SKU-118','',NULL,22.5,1,1,'2026-06-02 13:14:37','2026-06-02 13:14:37',1,118,4,2,1),(22,'SKU-119','',NULL,30,0,0,'2026-06-02 13:15:02','2026-06-02 13:15:02',1,119,4,2,1),(23,'SKU-120','',NULL,4.5,1,1,'2026-06-02 13:22:15','2026-06-02 13:22:15',1,120,4,2,1);
/*!40000 ALTER TABLE `product_attribute` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `order_category`
--

DROP TABLE IF EXISTS `order_category`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `order_category` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `classification` varchar(255) DEFAULT NULL,
  `subsidiaries_id` int(11) DEFAULT NULL,
  `active` varchar(255) DEFAULT NULL,
  `date_creation` datetime DEFAULT NULL,
  `description` text,
  PRIMARY KEY (`id`),
  KEY `subsidiaries_id` (`subsidiaries_id`),
  CONSTRAINT `order_category_ibfk_1` FOREIGN KEY (`subsidiaries_id`) REFERENCES `fayxzvov_alpha`.`subsidiaries` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `order_category`
--

LOCK TABLES `order_category` WRITE;
/*!40000 ALTER TABLE `order_category` DISABLE KEYS */;
INSERT INTO `order_category` VALUES (1,'PASTELES ESPECIALIDADES',4,'1','2025-12-08 15:53:27',NULL),(2,'PASTELES TRADICIONALES',4,'1','2025-12-08 15:53:39',NULL),(3,'GALLETAS',4,'1','2025-12-08 15:53:51',NULL),(4,'PASTELES DE 3 LECHES',4,'1','2025-12-08 15:54:23',NULL),(5,'Pan blanco',4,'1','2025-12-15 18:42:09',NULL),(6,'Porción de Pastel',4,'1','2025-12-16 14:18:17','Precio de rebanada por persona de todos nuestros pasteles'),(7,'SOBRE PEDIDO',4,'1','2025-12-22 14:41:49',NULL),(8,'CHAROLAS ',4,'1','2026-01-20 11:57:50',NULL),(9,'POSTRES ',4,'1','2026-01-29 09:47:34',NULL),(10,'BOCADILLOS',4,'1','2026-01-29 09:47:45',NULL);
/*!40000 ALTER TABLE `order_category` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-06-03 13:27:07
