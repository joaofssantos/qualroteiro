-- PostgreSQL ALTER TYPE ... ADD VALUE cannot be reversed by a transactional
-- down migration. Rolling this release back must keep the enum value.
ALTER TYPE "TollPlazaSource" ADD VALUE IF NOT EXISTS 'artesp';
