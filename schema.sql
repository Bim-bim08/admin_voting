-- ============================================
-- Database Schema for E-Election OSIS
-- Database: db_e_election
-- ============================================

CREATE DATABASE IF NOT EXISTS db_e_election;
USE db_e_election;

-- ============================================
-- Tabel Admins (untuk login admin)
-- ============================================
CREATE TABLE IF NOT EXISTS admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Default admin: username=admin, password=admin123 (bcrypt hashed)
INSERT INTO admins (username, password) VALUES ('admin', '$2b$10$zFJOZAEFc/CmS/1OUeAUs.z30HQg8xnpZcLSLOhopNKg8SB9FBoqm')
ON DUPLICATE KEY UPDATE username=username;

-- ============================================
-- Tabel Voting Settings (status pemilihan)
-- status: 'Belum Dimulai' | 'Berlangsung' | 'Ditutup'
-- ============================================
CREATE TABLE IF NOT EXISTS voting_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(50) NOT NULL UNIQUE,
  setting_value VARCHAR(50) NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Default status: Belum Dimulai
INSERT INTO voting_settings (setting_key, setting_value)
VALUES ('voting_status', 'Belum Dimulai')
ON DUPLICATE KEY UPDATE setting_key=setting_key;

-- ============================================
-- Tabel Candidates (Kandidat / Paslon)
-- chairman_name   = nama ketua
-- vice_chairman_name = nama wakil ketua
-- ============================================
CREATE TABLE IF NOT EXISTS candidates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  candidate_number INT NOT NULL UNIQUE,
  chairman_name VARCHAR(100) NOT NULL,
  vice_chairman_name VARCHAR(100) NOT NULL,
  vision_mission TEXT NOT NULL,
  photo_url VARCHAR(500) DEFAULT NULL,
  vote_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================
-- Tabel Voters (DPT — Daftar Pemilih Tetap)
-- identifier = NIS / NISN siswa
-- full_name  = nama lengkap
-- role       = voter | admin
-- is_voted   = 0 (belum) | 1 (sudah)
-- ============================================
CREATE TABLE IF NOT EXISTS voters (
  id INT AUTO_INCREMENT PRIMARY KEY,
  identifier VARCHAR(50) NOT NULL UNIQUE COMMENT 'NIS / NISN',
  full_name VARCHAR(100) NOT NULL,
  role VARCHAR(20) DEFAULT 'voter',
  is_voted TINYINT(1) DEFAULT 0,
  voted_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
