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
) ENGINE=InnoDB AUTO_INCREMENT=34 DEFAULT CHARSET=latin1 ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventory_inflow`
--

LOCK TABLES `inventory_inflow` WRITE;
/*!40000 ALTER TABLE `inventory_inflow` DISABLE KEYS */;
INSERT INTO `inventory_inflow` VALUES (12,'ENT-0001',NULL,1,5,50,43.103448275862,NULL,'2026-06-09',NULL,'2026-06-09 06:38:16','2026-06-09 06:51:44','Cancelada',1,1,1,3,2,NULL,1,1,NULL),(13,'ENT-0002',NULL,1,10,100,86.206896551724,NULL,'2026-06-09',NULL,'2026-06-09 06:42:18','2026-06-09 06:51:40','Cancelada',1,1,1,3,2,NULL,1,1,NULL),(14,'ENT-0003',NULL,1,1,2300,2300,NULL,'2026-06-09',NULL,'2026-06-09 06:53:30','2026-06-13 00:18:11','Cancelada',1,1,1,3,2,NULL,1,1,NULL),(15,'ENT-0004',NULL,1,1,2218.48,2218.48,NULL,'2026-06-09',NULL,'2026-06-09 06:54:31','2026-06-13 00:18:07','Cancelada',1,1,1,3,2,NULL,1,1,NULL),(16,'ENT-0005',NULL,1,2,650.52,650.52,NULL,'2026-06-12',NULL,'2026-06-12 21:29:44','2026-06-13 00:18:04','Cancelada',1,1,1,2,2,NULL,1,1,NULL),(17,'ENT-0006',NULL,1,20,44369.6,44369.6,NULL,'2026-06-12',NULL,'2026-06-12 21:32:26','2026-06-13 00:17:59','Cancelada',1,1,1,2,2,NULL,1,1,NULL),(18,'ENT-0007',NULL,1,1,2218.48,2218.48,NULL,'2026-06-13',NULL,'2026-06-13 00:17:35','2026-06-13 00:17:55','Cancelada',1,1,1,2,2,NULL,1,1,NULL),(19,'ENT-0008',NULL,1,5,1626.3,1626.3,NULL,'2026-06-13',NULL,'2026-06-13 00:18:50','2026-06-13 00:37:45','Cancelada',1,1,1,2,2,NULL,1,1,NULL),(20,'ENT-0009',NULL,1,5,11092.4,11092.4,NULL,'2026-06-13',NULL,'2026-06-13 00:24:10','2026-06-13 00:37:48','Cancelada',1,1,1,2,2,NULL,1,1,NULL),(21,'ENT-0010',NULL,1,1,325.26,325.26,NULL,'2026-06-13',NULL,'2026-06-13 00:36:46','2026-06-13 00:37:52','Cancelada',1,1,1,2,2,NULL,1,1,NULL),(22,'ENT-0011',NULL,1,1,325.26,325.26,NULL,'2026-06-13',NULL,'2026-06-13 00:37:39','2026-06-13 00:37:55','Cancelada',1,1,1,2,2,NULL,1,1,NULL),(23,'ENT-0012',NULL,1,10,22184.8,22184.8,NULL,'2026-06-13',NULL,'2026-06-13 00:38:27','2026-06-13 00:57:56','Cancelada',1,1,1,2,2,NULL,1,1,NULL),(24,'ENT-0013',NULL,1,1,2218.48,2218.48,NULL,'2026-06-13',NULL,'2026-06-13 00:58:09','2026-06-13 00:58:34','Cancelada',1,1,1,2,2,NULL,1,1,NULL),(25,'ENT-0014',NULL,1,5,1626.3,1626.3,NULL,'2026-06-13',NULL,'2026-06-13 01:07:36','2026-06-13 01:08:19','Cancelada',1,1,1,2,2,NULL,1,1,NULL),(26,'ENT-0015',NULL,1,5,1626.3,1626.3,NULL,'2026-06-13',NULL,'2026-06-13 01:08:43','2026-06-13 06:26:37','Cancelada',1,1,1,2,2,NULL,1,1,NULL),(27,'ENT-0016',NULL,1,10,22184.8,22184.8,NULL,'2026-06-13',NULL,'2026-06-13 06:27:24','2026-06-13 06:27:24','Aplicada',1,1,1,2,2,NULL,1,1,NULL),(28,'ENT-0017',NULL,1,10,22184.8,22184.8,NULL,'2026-06-14',NULL,'2026-06-14 16:38:44','2026-06-14 18:42:21','Cancelada',1,1,1,2,2,NULL,1,1,NULL),(29,'ENT-0018',NULL,1,1,325.26,325.26,NULL,'2026-06-15',NULL,'2026-06-15 23:47:47','2026-06-15 23:47:47','Aplicada',1,1,5,2,2,NULL,2,1,NULL),(32,'ENT-0019','Recepcion de OC REAB-0001',1,1,325.26,325.26,NULL,'2026-06-17',NULL,'2026-06-17 07:13:15','2026-06-17 07:13:15','Aplicada',1,1,1,NULL,2,NULL,1,1,11),(33,'ENT-0020',NULL,1,8,2000,1851.8518518519,NULL,'2026-06-17',NULL,'2026-06-17 07:14:35','2026-06-17 07:14:35','Aplicada',1,1,1,2,2,NULL,1,1,NULL);
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
) ENGINE=InnoDB AUTO_INCREMENT=38 DEFAULT CHARSET=latin1 ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `detail_inventory_inflow`
--

LOCK TABLES `detail_inventory_inflow` WRITE;
/*!40000 ALTER TABLE `detail_inventory_inflow` DISABLE KEYS */;
INSERT INTO `detail_inventory_inflow` VALUES (17,NULL,12,5,10,50,8.6206896551724,16,12,5,NULL,'2026-06-09 06:38:16',1,11,12,NULL),(18,NULL,10,NULL,10,100,8.6206896551724,16,5,15,NULL,'2026-06-09 06:42:20',1,11,13,NULL),(19,NULL,1,NULL,2300,2300,2300,0,0,1,NULL,'2026-06-09 06:53:30',1,25,14,NULL),(20,NULL,1,NULL,2218.48,2218.48,2218.48,0,1,2,NULL,'2026-06-09 06:54:31',1,25,15,NULL),(21,NULL,2,NULL,325.26,650.52,325.26,0,0,2,NULL,'2026-06-12 21:29:44',1,23,16,NULL),(22,NULL,20,NULL,2218.48,44369.6,2218.48,0,2,22,NULL,'2026-06-12 21:32:26',1,25,17,NULL),(23,NULL,1,NULL,2218.48,2218.48,2218.48,0,22,23,NULL,'2026-06-13 00:17:35',1,25,18,NULL),(24,NULL,5,NULL,325.26,1626.3,325.26,0,0,5,NULL,'2026-06-13 00:18:50',1,23,19,NULL),(25,NULL,5,NULL,2218.48,11092.4,2218.48,0,0,5,NULL,'2026-06-13 00:24:10',1,25,20,NULL),(26,NULL,1,NULL,325.26,325.26,325.26,0,5,6,NULL,'2026-06-13 00:36:46',1,23,21,NULL),(27,NULL,1,NULL,325.26,325.26,325.26,0,6,7,NULL,'2026-06-13 00:37:39',1,23,22,NULL),(28,NULL,10,NULL,2218.48,22184.8,2218.48,0,0,10,NULL,'2026-06-13 00:38:27',1,25,23,NULL),(29,NULL,1,NULL,2218.48,2218.48,2218.48,0,0,1,NULL,'2026-06-13 00:58:09',1,25,24,NULL),(30,NULL,5,5,325.26,1626.3,325.26,0,5,5,NULL,'2026-06-13 01:07:36',1,23,25,NULL),(31,NULL,5,5,325.26,1626.3,325.26,0,5,5,NULL,'2026-06-13 01:08:43',1,23,26,NULL),(32,NULL,10,NULL,2218.48,22184.8,2218.48,0,0,10,NULL,'2026-06-13 06:27:24',1,25,27,NULL),(33,NULL,10,NULL,2218.48,22184.8,2218.48,0,0,10,NULL,'2026-06-14 16:38:44',1,25,28,NULL),(34,NULL,1,NULL,325.26,325.26,325.26,0,0,1,NULL,'2026-06-15 23:47:47',1,23,29,NULL),(36,NULL,1,NULL,325.26,325.26,325.26,0,-1,0,NULL,'2026-06-17 07:13:15',1,23,32,NULL),(37,NULL,8,NULL,250,2000,231.48148148148,8,0,8,NULL,'2026-06-17 07:14:35',1,27,33,NULL);
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
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=latin1 ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventory_shrinkage`
--

LOCK TABLES `inventory_shrinkage` WRITE;
/*!40000 ALTER TABLE `inventory_shrinkage` DISABLE KEYS */;
INSERT INTO `inventory_shrinkage` VALUES (11,'M-0001',NULL,NULL,1,10,22184.8,NULL,'2026-06-14 13:47:43','2026-06-14 18:42:30','Cancelada',1,1,1,2,1,1),(12,'M-0002',NULL,NULL,1,5,11092.4,NULL,'2026-06-14 18:45:39','2026-06-14 18:45:48','Cancelada',1,1,1,2,1,1),(13,'M-0003',NULL,NULL,1,2,4436.96,NULL,'2026-06-14 19:11:54','2026-06-14 19:17:44','Cancelada',1,1,1,2,1,1),(14,'M-0004',NULL,NULL,1,1,2218.48,NULL,'2026-06-14 19:21:08','2026-06-14 19:49:35','Cancelada',1,1,1,2,1,1),(15,'M-0005',NULL,NULL,1,1,2218.48,NULL,'2026-06-14 19:49:56','2026-06-14 19:49:56','Aplicada',1,8,1,2,1,1),(16,'M-0006','Agrega este pedido',NULL,1,2,4436.96,NULL,'2026-06-14 21:01:51','2026-06-14 21:01:51','Aplicada',1,9,1,2,1,1),(17,'M-0007','Agrega este pedido',NULL,1,2,4436.96,NULL,'2026-06-14 21:02:07','2026-06-14 21:02:07','Aplicada',1,3,1,2,1,1),(18,'M-0008','Agrega este pedido',NULL,1,1,2218.48,NULL,'2026-06-14 21:02:18','2026-06-14 21:02:18','Aplicada',1,4,1,2,1,1),(19,'M-0009','Agrega este pedido',NULL,1,1,2218.48,NULL,'2026-06-14 21:02:31','2026-06-14 21:02:31','Aplicada',1,1,1,2,1,1),(20,'M-0010',NULL,NULL,1,1,2218.48,NULL,'2026-06-14 21:57:30','2026-06-14 21:57:58','Aplicada',1,8,1,2,1,1),(22,'SI-0001','Surtido de solicitud OC-0001',NULL,1,1,325.26,'2026-06-17','2026-06-17 07:12:26','2026-06-17 07:12:26','Aplicada',1,8,1,2,1,1),(23,'SI-0002','Surtido de solicitud OC-0009',NULL,1,5,0,'2026-06-17','2026-06-17 07:41:22','2026-06-17 07:41:22','Aplicada',1,8,1,2,1,1);
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
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=latin1 ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `detail_inventory_shrinkage`
--

LOCK TABLES `detail_inventory_shrinkage` WRITE;
/*!40000 ALTER TABLE `detail_inventory_shrinkage` DISABLE KEYS */;
INSERT INTO `detail_inventory_shrinkage` VALUES (14,10,2218.48,22184.8,10,0,'2026-06-14 13:47:43',1,25,11),(15,5,2218.48,11092.4,10,5,'2026-06-14 18:45:39',1,25,12),(16,2,2218.48,4436.96,10,8,'2026-06-14 19:11:54',1,25,13),(17,1,2218.48,2218.48,10,9,'2026-06-14 19:21:08',1,25,14),(18,1,2218.48,2218.48,10,9,'2026-06-14 19:49:56',1,25,15),(19,2,2218.48,4436.96,9,7,'2026-06-14 21:01:51',1,25,16),(20,2,2218.48,4436.96,7,5,'2026-06-14 21:02:07',1,25,17),(21,1,2218.48,2218.48,5,4,'2026-06-14 21:02:19',1,25,18),(22,1,2218.48,2218.48,4,3,'2026-06-14 21:02:31',1,25,19),(23,1,2218.48,2218.48,3,2,'2026-06-14 21:57:30',1,25,20),(25,1,325.26,325.26,0,-1,'2026-06-17 07:12:26',1,23,22),(26,5,0,0,8,3,'2026-06-17 07:41:22',1,27,23);
/*!40000 ALTER TABLE `detail_inventory_shrinkage` ENABLE KEYS */;
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
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=latin1 ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventory_transfer`
--

LOCK TABLES `inventory_transfer` WRITE;
/*!40000 ALTER TABLE `inventory_transfer` DISABLE KEYS */;
INSERT INTO `inventory_transfer` VALUES (3,'TRA-0001',NULL,1,NULL,5,11092.4,'2026-06-14 16:39:47',NULL,NULL,NULL,'2026-06-14 16:39:47','2026-06-14 16:44:15',1,5,1,5,1,2,2,NULL,NULL,1),(4,'TRA-0002',NULL,1,'Rosa Angelica P.',5,11092.4,'2026-06-14 17:12:56',NULL,NULL,'2026-06-14 17:13:20','2026-06-14 17:12:56','2026-06-14 17:13:20',1,4,1,5,1,2,2,NULL,1,1),(5,'TRA-0003',NULL,1,'Somx',2,4436.96,'2026-06-14 22:19:02',NULL,NULL,'2026-06-14 23:04:03','2026-06-14 22:19:02','2026-06-14 23:04:03',1,4,5,1,2,1,2,NULL,2,1),(6,'TRA-0004',NULL,1,'SomxD',3,6655.44,'2026-06-15 19:40:00',NULL,NULL,'2026-06-15 19:40:54','2026-06-15 19:40:00','2026-06-15 19:40:54',1,4,1,5,1,2,2,NULL,2,1),(7,'TRA-0005',NULL,1,NULL,1,2218.48,'2026-06-15 19:54:42',NULL,NULL,NULL,'2026-06-15 19:54:42','2026-06-15 19:54:42',1,1,1,5,1,2,2,NULL,NULL,1),(8,'TRA-0006',NULL,1,'SomxD',3,6655.44,'2026-06-15 20:16:30',NULL,NULL,'2026-06-15 20:16:49','2026-06-15 20:16:30','2026-06-15 20:16:49',1,4,5,1,2,1,2,NULL,2,1);
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
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=latin1 ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `detail_inventory_transfer`
--

LOCK TABLES `detail_inventory_transfer` WRITE;
/*!40000 ALTER TABLE `detail_inventory_transfer` DISABLE KEYS */;
INSERT INTO `detail_inventory_transfer` VALUES (3,5,2218.48,11092.4,10,5,NULL,NULL,'2026-06-14 16:39:47',1,25,3),(4,5,2218.48,11092.4,10,5,0,5,'2026-06-14 17:12:56',1,25,4),(5,2,2218.48,4436.96,5,3,2,4,'2026-06-14 22:19:02',1,25,5),(6,3,2218.48,6655.44,4,1,3,6,'2026-06-15 19:40:00',1,25,6),(7,1,2218.48,2218.48,1,0,NULL,NULL,'2026-06-15 19:54:42',1,25,7),(8,3,2218.48,6655.44,6,3,1,4,'2026-06-15 20:16:30',1,25,8);
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
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=latin1 ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventory_transfer_history`
--

LOCK TABLES `inventory_transfer_history` WRITE;
/*!40000 ALTER TABLE `inventory_transfer_history` DISABLE KEYS */;
INSERT INTO `inventory_transfer_history` VALUES (5,'Traspaso solicitado','2026-06-14 16:39:47',1,1,2,3),(6,'Traspaso cancelado por el solicitante','2026-06-14 16:44:15',1,5,2,3),(7,'Traspaso solicitado','2026-06-14 17:12:56',1,1,2,4),(8,'Traspaso recibido · Recibe: Rosa Angelica P.','2026-06-14 17:13:20',1,4,1,4),(9,'Traspaso solicitado','2026-06-14 22:19:02',1,1,2,5),(10,'Traspaso recibido · Recibe: Somx','2026-06-14 23:04:03',1,4,2,5),(11,'Traspaso solicitado','2026-06-15 19:40:00',1,1,2,6),(12,'Traspaso recibido · Recibe: SomxD','2026-06-15 19:40:54',1,4,2,6),(13,'Traspaso solicitado','2026-06-15 19:54:42',1,1,2,7),(14,'Traspaso solicitado','2026-06-15 20:16:30',1,1,2,8),(15,'Traspaso recibido · Recibe: SomxD','2026-06-15 20:16:49',1,4,2,8);
/*!40000 ALTER TABLE `inventory_transfer_history` ENABLE KEYS */;
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
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=latin1 ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stock`
--

LOCK TABLES `stock` WRITE;
/*!40000 ALTER TABLE `stock` DISABLE KEYS */;
INSERT INTO `stock` VALUES (11,0,'2026-06-09 06:51:44',NULL,'2026-06-09 06:38:16','2026-06-09 06:51:44',1,1,11,1),(12,4,'2026-06-15 20:16:49',NULL,'2026-06-09 06:53:30','2026-06-15 20:16:49',1,1,25,1),(14,0,'2026-06-17 07:13:15',NULL,'2026-06-12 21:29:44','2026-06-17 07:13:15',1,1,23,1),(15,3,'2026-06-15 20:16:49',NULL,'2026-06-14 17:13:20','2026-06-15 20:16:49',1,5,25,1),(16,1,'2026-06-15 23:47:47',NULL,'2026-06-15 23:47:47','2026-06-15 23:47:47',1,5,23,1),(17,3,'2026-06-17 07:41:22',NULL,'2026-06-17 07:14:35','2026-06-17 07:41:22',1,1,27,1);
/*!40000 ALTER TABLE `stock` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-06-17  9:47:23
