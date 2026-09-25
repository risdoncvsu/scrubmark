-- ScrubMark MySQL Database Schema for InfinityFree
-- Import this file into phpMyAdmin on your InfinityFree vPanel account

SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `videos` (
  `id` VARCHAR(64) NOT NULL,
  `youtube_video_id` VARCHAR(255) NOT NULL,
  `source_type` VARCHAR(32) DEFAULT 'youtube',
  `project_name` VARCHAR(255) NOT NULL,
  `user_id` VARCHAR(64) NOT NULL,
  `owner_name` VARCHAR(191) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_videos_user_id` (`user_id`),
  CONSTRAINT `fk_videos_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `comments` (
  `id` VARCHAR(64) NOT NULL,
  `video_id` VARCHAR(64) NOT NULL,
  `user_id` VARCHAR(64) NOT NULL,
  `author_name` VARCHAR(191) NOT NULL,
  `content` TEXT NOT NULL,
  `drawing_data` MEDIUMTEXT NULL,
  `timestamp_seconds` DECIMAL(10, 2) NOT NULL,
  `is_resolved` TINYINT(1) DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_comments_video_id` (`video_id`),
  KEY `idx_comments_user_id` (`user_id`),
  CONSTRAINT `fk_comments_video` FOREIGN KEY (`video_id`) REFERENCES `videos` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
