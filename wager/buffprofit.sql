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

-- Crear la tabla game
CREATE TABLE IF NOT EXISTS game (
    id_game INT AUTO_INCREMENT PRIMARY KEY,
    idGameLol VARCHAR(255) NOT NULL
);