
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
) ENGINE=InnoDB AUTO_INCREMENT=35 DEFAULT CHARSET=latin1 ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `inventory_shrinkage` WRITE;
/*!40000 ALTER TABLE `inventory_shrinkage` DISABLE KEYS */;
INSERT INTO `inventory_shrinkage` VALUES (34,'S-0001',NULL,NULL,1,3,0,NULL,'2026-10-16 21:48:27','2026-10-16 21:48:27','Aplicada',1,8,9,2,1,1);
/*!40000 ALTER TABLE `inventory_shrinkage` ENABLE KEYS */;
UNLOCK TABLES;
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
) ENGINE=InnoDB AUTO_INCREMENT=111 DEFAULT CHARSET=latin1 ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `detail_inventory_shrinkage` WRITE;
/*!40000 ALTER TABLE `detail_inventory_shrinkage` DISABLE KEYS */;
INSERT INTO `detail_inventory_shrinkage` VALUES (110,3,0,0,4,1,'2026-10-16 21:48:27',1,562,34);
/*!40000 ALTER TABLE `detail_inventory_shrinkage` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

