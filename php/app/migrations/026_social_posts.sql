-- Social media (October 2026): the posts the panel's AI writes, three every two days, with the
-- day and hour to post them, the text, the hashtags and the photo for the image.
CREATE TABLE IF NOT EXISTS social_posts (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  batch_date DATE NOT NULL,
  publish_at DATETIME NOT NULL,
  theme VARCHAR(60) NOT NULL,
  headline VARCHAR(140) NOT NULL,
  caption TEXT NOT NULL,
  hashtags VARCHAR(400) NOT NULL DEFAULT '',
  image VARCHAR(255) NULL,
  image_hint VARCHAR(255) NULL,
  status VARCHAR(12) NOT NULL DEFAULT 'propus',
  posted_at DATETIME NULL,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_social_batch (batch_date),
  KEY idx_social_publish (publish_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
