-- Create shadow database for Prisma migrations
CREATE DATABASE IF NOT EXISTS polyglotio_shadow;
GRANT ALL PRIVILEGES ON polyglotio_shadow.* TO 'polyglotio_user'@'%';
FLUSH PRIVILEGES;
