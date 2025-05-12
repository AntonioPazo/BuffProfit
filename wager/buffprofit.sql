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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    FOREIGN KEY (id_summoner_blue) REFERENCES user(id_summoner),
    FOREIGN KEY (id_summoner_red) REFERENCES user(id_summoner)
);

-- Actualizar la tabla game para añadir campos para el reporte de resultados
ALTER TABLE game
ADD COLUMN winner VARCHAR(255) NULL,
ADD COLUMN reported_by_blue BOOLEAN DEFAULT FALSE,
ADD COLUMN reported_by_red BOOLEAN DEFAULT FALSE,
ADD COLUMN blue_reported_winner VARCHAR(255) NULL,
ADD COLUMN red_reported_winner VARCHAR(255) NULL,
ADD COLUMN blue_proof_images TEXT NULL,
ADD COLUMN red_proof_images TEXT NULL,
ADD COLUMN dispute BOOLEAN DEFAULT FALSE;

-- Añadir columna creditos a la tabla user con formato float (0.00)
ALTER TABLE user
ADD COLUMN creditos FLOAT DEFAULT 100.00;

-- Añadir columnas para el sistema de reputación en la tabla game
ALTER TABLE game
ADD COLUMN blue_rated BOOLEAN DEFAULT FALSE,
ADD COLUMN red_rated BOOLEAN DEFAULT FALSE,
ADD COLUMN blue_rating_to_red INT NULL,
ADD COLUMN red_rating_to_blue INT NULL;

-- Usuarios de ejemplo 

INSERT INTO user (id_user, username, email, password, summoner, id_summoner, reputation, created_at, creditos)
VALUES
(1, 'a', 'a@gmail.com', '$2b$10$VgxVmyKrndzYfNf0jRTTreqbdhszkjlzP4ulMCw0erUGsOWv1dyNC', 'a', 'a#euw', 0, '2025-05-10 12:01:52', 100.00),
(2, 'b', 'b@gmail.com', '$2b$10$y1qOKTL/s0rf/aMIbwvSxu82pkq73e94/dUSSAbWyu5JAbUBaj5.C', 'b', 'b#euw', 0, '2025-05-10 12:02:03', 100.00),
(3, 'c', 'c@gmail.com', '$2b$10$iQwQML7QfoZMt9vLNYoKreQA2h8.s9e7mmcLiTQK5W.GwtXbpPGJa', 'c', 'c#euw', 0, '2025-05-10 12:04:09', 100.00);

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

-- Crear tabla para participantes de torneos
CREATE TABLE IF NOT EXISTS tournament_participant (
  id_participant INT AUTO_INCREMENT PRIMARY KEY,
  id_tournament INT NOT NULL,
  id_summoner VARCHAR(255) NOT NULL,
  registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_tournament) REFERENCES tournament(id_tournament) ON DELETE CASCADE,
  FOREIGN KEY (id_summoner) REFERENCES user(id_summoner) ON DELETE CASCADE
);

-- Crear tabla para partidas de torneos
CREATE TABLE IF NOT EXISTS tournament_match (
  id_tournament_match INT AUTO_INCREMENT PRIMARY KEY,
  id_tournament INT NOT NULL,
  id_summoner_blue VARCHAR(255) NOT NULL,
  id_summoner_red VARCHAR(255) NOT NULL,
  round INT NOT NULL,
  match_number INT NOT NULL,
  winner INT,
  match_date TIMESTAMP,
  status VARCHAR(50) DEFAULT 'pending',
  FOREIGN KEY (id_tournament) REFERENCES tournament(id_tournament) ON DELETE CASCADE,
  FOREIGN KEY (id_summoner_blue) REFERENCES user(id_summoner) ON DELETE CASCADE,
  FOREIGN KEY (id_summoner_red) REFERENCES user(id_summoner) ON DELETE CASCADE
);
