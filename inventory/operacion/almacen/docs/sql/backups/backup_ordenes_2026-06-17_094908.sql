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
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=latin1 ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `purchase_order`
--

LOCK TABLES `purchase_order` WRITE;
/*!40000 ALTER TABLE `purchase_order` DISABLE KEYS */;
INSERT INTO `purchase_order` VALUES (2,'OC-0001','2026-06-15',NULL,'',1,1,325.26,325.26,'Recibida','2026-06-17 06:56:25',NULL,1,'2026-06-15 21:48:29','2026-06-17 07:12:26',3,1,2,2,1,NULL,1),(4,'OC-0002','2026-06-16',NULL,'',4,5,0,0,'Solicitada',NULL,NULL,1,'2026-06-16 06:44:32','2026-06-16 06:44:32',NULL,NULL,2,NULL,2,NULL,1),(5,'OC-0003','2026-06-16',NULL,'',1,1,0,0,'Solicitada',NULL,NULL,1,'2026-06-16 20:26:18','2026-06-16 20:26:18',NULL,NULL,2,NULL,2,NULL,1),(6,'OC-0004','2026-06-16',NULL,'',1,10,0,0,'Aprobada','2026-06-17 00:12:32',NULL,1,'2026-06-16 20:30:57','2026-06-17 00:12:32',NULL,NULL,2,2,2,NULL,1),(7,'OC-0005','2026-06-16',NULL,'',1,10,0,0,'Cancelada',NULL,NULL,1,'2026-06-16 20:31:17','2026-06-16 20:31:25',NULL,NULL,2,NULL,2,NULL,1),(8,'OC-0006','2026-06-16',NULL,'',2,12,0,0,'Aprobada','2026-06-16 23:29:14',NULL,1,'2026-06-16 21:50:11','2026-06-16 23:29:14',NULL,NULL,2,2,2,NULL,1),(9,'OC-0007','2026-06-16',NULL,'',3,2.5,0,0,'Cancelada','2026-06-16 23:15:15',NULL,1,'2026-06-16 22:08:41','2026-06-16 23:16:02',NULL,NULL,2,2,2,NULL,1),(10,'OC-0008','2026-06-16',NULL,'',2,2,0,0,'Cancelada',NULL,NULL,1,'2026-06-16 22:16:51','2026-06-16 23:06:16',NULL,NULL,2,NULL,2,NULL,1),(11,'REAB-0001','2026-06-17',NULL,'Reabasto por surtido de la solicitud OC-0001',1,1,325.26,325.26,'Recibida',NULL,NULL,1,'2026-06-17 07:12:26','2026-06-17 07:13:15',NULL,1,2,NULL,1,NULL,1),(12,'OC-0009','2026-06-17',NULL,'',1,10,0,0,'Cancelada','2026-06-17 07:16:57',NULL,1,'2026-06-17 07:15:04','2026-06-17 09:44:02',NULL,1,2,2,1,NULL,1),(13,'OC-0010','2026-06-17',NULL,'',1,5,0,0,'Cancelada',NULL,NULL,1,'2026-06-17 07:44:56','2026-06-17 09:43:58',NULL,NULL,2,NULL,1,NULL,1),(14,'OC-0011','2026-06-17',NULL,'',1,10,0,0,'Cancelada',NULL,NULL,1,'2026-06-17 09:41:54','2026-06-17 09:43:54',NULL,NULL,2,NULL,1,NULL,1);
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
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=latin1 ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `detail_purchase_order`
--

LOCK TABLES `detail_purchase_order` WRITE;
/*!40000 ALTER TABLE `detail_purchase_order` DISABLE KEYS */;
INSERT INTO `detail_purchase_order` VALUES (2,1,1,325.26,0,325.26,325.26,1,'2026-06-15 21:48:29',2,23,NULL),(3,1,0,NULL,0,NULL,0,1,'2026-06-16 06:44:32',4,23,NULL),(4,2,0,NULL,0,NULL,0,1,'2026-06-16 06:44:32',4,12,NULL),(5,1,0,NULL,0,NULL,0,1,'2026-06-16 06:44:32',4,11,NULL),(6,1,0,NULL,0,NULL,0,1,'2026-06-16 06:44:32',4,24,NULL),(7,1,0,NULL,0,NULL,0,1,'2026-06-16 20:26:18',5,23,NULL),(8,10,0,NULL,0,NULL,0,1,'2026-06-16 20:30:57',6,23,NULL),(9,10,0,NULL,0,NULL,0,1,'2026-06-16 20:31:17',7,23,NULL),(10,10,0,NULL,0,NULL,0,1,'2026-06-16 21:50:11',8,27,NULL),(11,2,0,NULL,0,NULL,0,1,'2026-06-16 21:50:11',8,28,NULL),(12,1,0,NULL,0,NULL,0,0,'2026-06-16 22:08:41',9,23,NULL),(13,1,0,NULL,0,NULL,0,1,'2026-06-16 22:16:51',10,27,NULL),(14,1,0,NULL,0,NULL,0,1,'2026-06-16 22:16:51',10,29,NULL),(15,1,0,NULL,0,NULL,0,0,'2026-06-16 23:08:33',9,23,NULL),(16,1,0,NULL,0,NULL,0,0,'2026-06-16 23:08:33',9,22,NULL),(17,1,0,NULL,0,NULL,0,1,'2026-06-16 23:09:05',9,23,NULL),(18,1,0,NULL,0,NULL,0,1,'2026-06-16 23:09:05',9,22,NULL),(19,0.5,0,NULL,0,NULL,0,1,'2026-06-16 23:09:05',9,25,NULL),(20,1,1,325.26,0,325.26,325.26,1,'2026-06-17 07:12:26',11,23,NULL),(21,10,5,NULL,0,NULL,0,1,'2026-06-17 07:15:04',12,27,NULL),(22,5,0,NULL,0,NULL,0,1,'2026-06-17 07:44:56',13,27,NULL),(23,10,0,NULL,0,NULL,0,1,'2026-06-17 09:41:54',14,27,NULL);
/*!40000 ALTER TABLE `detail_purchase_order` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-06-17  9:49:08
