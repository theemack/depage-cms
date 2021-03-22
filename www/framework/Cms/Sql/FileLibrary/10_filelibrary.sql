/*
    FileLibray Files Table
    -----------------------------------

    @tablename _proj_PROJECTNAME_filelibrary_files
    @version 2.2.0
*/
CREATE TABLE _proj_PROJECTNAME_filelibrary_files (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `path` text NOT NULL DEFAULT '',
  `filename` text NOT NULL DEFAULT '',
  `mime` varchar(255) NOT NULL DEFAULT '',
  `hash` varchar(64) NOT NULL DEFAULT '',
  `filesize` int(10) unsigned NOT NULL DEFAULT 0,
  `lastmod` datetime NOT NULL DEFAULT '0000-00-00 00:00:00',
  `width` int(10) unsigned DEFAULT NULL,
  `height` int(10) unsigned DEFAULT NULL,
  `displayAspectRatio` float unsigned DEFAULT NULL,
  `duration` int(10) unsigned DEFAULT NULL,
  `copyright` text DEFAULT '',
  `description` text DEFAULT '',
  `keywords` text DEFAULT '',
  PRIMARY KEY (`id`),
  UNIQUE KEY `filename`(`path`,`filename`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4;
