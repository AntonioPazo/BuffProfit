-- Crear la base de datos si no existe
CREATE DATABASE IF NOT EXISTS buffprofit;

-- Usar la base de datos recién creada o existente
USE buffprofit;

-- Crear la tabla user
CREATE TABLE IF NOT EXISTS user (
    id_user INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    summoner VARCHAR(255),
    id_summoner VARCHAR(255) UNIQUE,
    reputation INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    creditos FLOAT DEFAULT 100.00
);

-- Crear la tabla game con campos adicionales
CREATE TABLE IF NOT EXISTS game (
    id_game INT AUTO_INCREMENT PRIMARY KEY,
    idGameLol VARCHAR(255),
    id_summoner_blue VARCHAR(255),
    id_summoner_red VARCHAR(255),
    mode ENUM('1vs1', '2vs2', '3vs3', '5vs5') NOT NULL,
    map ENUM('ARAM', 'Grieta del Invocador') NOT NULL,
    format ENUM('Mejor de 3', 'Partida completa') NOT NULL,
    creditos INT DEFAULT 0,
    region ENUM('euw', 'eune', 'na', 'kr', 'japan', 'br', 'lan', 'las', 'oce', 'ru', 'tr') NOT NULL,
    skill_level ENUM('Unranked', 'Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Emerald', 'Diamond', 'Master', 'Grand Master', 'Challenger') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    winner VARCHAR(255) NULL,
    reported_by_blue BOOLEAN DEFAULT FALSE,
    reported_by_red BOOLEAN DEFAULT FALSE,
    blue_reported_winner VARCHAR(255) NULL,
    red_reported_winner VARCHAR(255) NULL,
    blue_proof_images TEXT NULL,
    red_proof_images TEXT NULL,
    dispute BOOLEAN DEFAULT FALSE,
    blue_rated_red BOOLEAN DEFAULT FALSE,
    red_rated_blue BOOLEAN DEFAULT FALSE,
    credits_transferred BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (id_summoner_blue) REFERENCES user(id_summoner),
    FOREIGN KEY (id_summoner_red) REFERENCES user(id_summoner)
);


-- Usuarios de ejemplo 

INSERT INTO user (id_user, username, email, password, summoner, id_summoner, reputation, created_at, creditos)
VALUES
(1, 'admin', 'admin@gmail.com', '$2b$10$3pgwAObNk/3/tXMdmNVm.e.xU/OGx4pLJhNsFp8pU7cI/7T1jPznK', 'admin', 'admin#euw', 0, '2025-05-10 12:04:09', 100.00),
(2, 'a', 'a@gmail.com', '$2b$10$VgxVmyKrndzYfNf0jRTTreqbdhszkjlzP4ulMCw0erUGsOWv1dyNC', 'a', 'a#euw', 0, '2025-05-10 12:01:52', 100.00),
(3, 'b', 'b@gmail.com', '$2b$10$y1qOKTL/s0rf/aMIbwvSxu82pkq73e94/dUSSAbWyu5JAbUBaj5.C', 'b', 'b#euw', 0, '2025-05-10 12:02:03', 100.00),
(4, 'c', 'c@gmail.com', '$2b$10$iQwQML7QfoZMt9vLNYoKreQA2h8.s9e7mmcLiTQK5W.GwtXbpPGJa', 'c', 'c#euw', 0, '2025-05-10 12:04:09', 100.00);

-- Crear tabla para torneos
CREATE TABLE IF NOT EXISTS tournament (
  id_tournament INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  start_date DATETIME NOT NULL,
  entry_fee FLOAT DEFAULT 0.00,
  prize_pool FLOAT DEFAULT 0.00,
  team_size VARCHAR(50) NOT NULL,
  format VARCHAR(50) NOT NULL,
  map VARCHAR(50) NOT NULL,
  region VARCHAR(50) NOT NULL,
  skill_level VARCHAR(50) NOT NULL,
  max_participants INT DEFAULT 16,
  current_participants INT DEFAULT 0,
  status VARCHAR(50) DEFAULT 'upcoming',
  image_path VARCHAR(255),
  created_by VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- Crear tabla para equipos
CREATE TABLE IF NOT EXISTS team (
  id_team INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  tag VARCHAR(10) NOT NULL,
  logo_path VARCHAR(255),
  description TEXT,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES user(id_summoner) ON DELETE CASCADE
);

-- Crear tabla para miembros de equipos
CREATE TABLE IF NOT EXISTS team_member (
  id_team_member INT AUTO_INCREMENT PRIMARY KEY,
  id_team INT NOT NULL,
  id_summoner VARCHAR(255) NOT NULL,
  role VARCHAR(50),
  is_captain BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_team) REFERENCES team(id_team) ON DELETE CASCADE,
  FOREIGN KEY (id_summoner) REFERENCES user(id_summoner) ON DELETE CASCADE
);

-- Crear tabla para inscripciones de equipos en torneos
CREATE TABLE IF NOT EXISTS tournament_team (
  id_tournament_team INT AUTO_INCREMENT PRIMARY KEY,
  id_tournament INT NOT NULL,
  id_team INT NOT NULL,
  registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_tournament) REFERENCES tournament(id_tournament) ON DELETE CASCADE,
  FOREIGN KEY (id_team) REFERENCES team(id_team) ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS team_invitation (
  id_invitation INT AUTO_INCREMENT PRIMARY KEY,
  id_team INT NOT NULL,
  id_summoner VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  invited_by VARCHAR(255) NOT NULL,
  invitation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
  FOREIGN KEY (id_team) REFERENCES team(id_team) ON DELETE CASCADE,
  FOREIGN KEY (id_summoner) REFERENCES user(id_summoner) ON DELETE CASCADE,
  FOREIGN KEY (invited_by) REFERENCES user(id_summoner) ON DELETE CASCADE
);

-- Crear tabla para notificaciones
CREATE TABLE IF NOT EXISTS notification (
  id_notification INT AUTO_INCREMENT PRIMARY KEY,
  id_summoner VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  related_id INT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_summoner) REFERENCES user(id_summoner) ON DELETE CASCADE
);

-- === añadido


-- Crear tabla para transacciones PayPal
CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    type ENUM('credit_purchase', 'match_entry', 'match_win', 'refund') NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    credits INT NOT NULL,
    paypal_order_id VARCHAR(255),
    status ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'pending',
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_type (type),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
);
