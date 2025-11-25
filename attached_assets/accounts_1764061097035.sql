-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Hôte : 127.0.0.1:3306
-- Généré le : mar. 25 nov. 2025 à 09:57
-- Version du serveur : 8.0.36-28
-- Version de PHP : 8.1.33

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de données : `betwntkoin`
--

-- --------------------------------------------------------

--
-- Structure de la table `accounts`
--

CREATE TABLE `accounts` (
  `id` bigint UNSIGNED NOT NULL,
  `uuid` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `currency_code` varchar(15) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'CREDIT',
  `user_id` bigint UNSIGNED NOT NULL,
  `balance` decimal(20,2) NOT NULL DEFAULT '0.00',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `accounts`
--

INSERT INTO `accounts` (`id`, `uuid`, `currency_code`, `user_id`, `balance`, `created_at`, `updated_at`) VALUES
(1, 'dc411724-4c5d-4fda-9a48-fc3c654ce1e5', 'CREDIT', 1, 1461.73, '2025-11-09 10:02:35', '2025-11-23 08:31:29'),
(2, '7bd5e605-2968-473f-9460-b548e961bfe0', 'CREDIT', 3, 12971.80, '2025-11-09 11:07:24', '2025-11-13 12:34:51'),
(3, '00baada8-f2d8-4d5a-a1b4-304cc4d81f7a', 'CREDIT', 4, 1070.37, '2025-11-10 14:27:29', '2025-11-11 06:43:02'),
(14, '8dc1a5f8-71df-455f-afe1-61716f8e23d5', 'CREDIT', 15, -125290.08, '2025-11-10 20:52:14', '2025-11-25 08:55:51'),
(15, '22d7762f-7fb5-49e2-a997-44d93a271fc0', 'CREDIT', 16, -124099.40, '2025-11-10 20:52:14', '2025-11-25 08:57:30'),
(16, '61b46341-d881-4380-a771-3b58a3f0b9af', 'CREDIT', 17, -119600.59, '2025-11-10 20:52:14', '2025-11-25 08:57:11'),
(17, '470ce622-7492-4799-bb23-833a384be556', 'CREDIT', 18, -124713.20, '2025-11-10 20:52:14', '2025-11-25 08:55:27'),
(18, 'b6063248-1af6-4a6a-aaa7-501e163ecace', 'CREDIT', 19, -122093.36, '2025-11-10 20:52:14', '2025-11-25 08:51:30'),
(19, 'ef592d92-b5ed-4736-9676-83b029fc5995', 'CREDIT', 20, -122645.19, '2025-11-10 20:52:14', '2025-11-25 08:56:37'),
(20, '10cb6a29-d899-4e8a-9444-4c7297ae88ee', 'CREDIT', 21, -115606.02, '2025-11-10 20:52:15', '2025-11-25 08:52:48'),
(21, 'ca36d773-715a-4be1-9f26-634d44f55e21', 'CREDIT', 22, -128120.73, '2025-11-10 20:52:15', '2025-11-25 08:53:47'),
(22, '5b012b22-8bd0-4715-9fdf-d7a9d53d3749', 'CREDIT', 23, -123396.97, '2025-11-10 20:52:15', '2025-11-25 08:53:35'),
(23, 'f3a626d7-040e-46eb-a2c7-45053bd5ecc1', 'CREDIT', 24, -121955.06, '2025-11-10 20:52:15', '2025-11-25 08:57:11'),
(24, 'c059fcae-d84d-49d4-a0ba-1cfa7ad86432', 'CREDIT', 25, -124489.62, '2025-11-10 20:52:15', '2025-11-25 08:57:02'),
(25, '29aab328-0304-4a50-9e5b-618aa687eb39', 'CREDIT', 26, -126620.37, '2025-11-10 20:52:15', '2025-11-25 08:57:02'),
(26, 'cb9c05f4-0cdf-4770-82a4-40af5aee5a83', 'CREDIT', 27, -126088.81, '2025-11-10 20:52:15', '2025-11-25 08:57:23'),
(27, '54aee4e5-7557-4a15-a0bc-e389f700f80e', 'CREDIT', 28, -121224.35, '2025-11-10 21:14:45', '2025-11-25 08:55:08'),
(28, '1e67fcec-1c19-4eab-8680-209d142bed46', 'CREDIT', 29, -121093.43, '2025-11-10 21:14:45', '2025-11-25 08:56:43'),
(29, 'efa1b17a-e12c-468c-a9aa-f9595539f69f', 'CREDIT', 30, -125750.41, '2025-11-10 21:14:45', '2025-11-25 08:55:27'),
(30, 'f55ffddb-d62b-489d-97ff-931c4ef78c7b', 'CREDIT', 31, -118647.04, '2025-11-10 21:14:45', '2025-11-25 08:56:40'),
(31, '006ee1c6-aef7-4114-ab47-6b88de37717b', 'CREDIT', 32, -118787.12, '2025-11-10 21:14:45', '2025-11-25 08:55:05'),
(32, 'b12b863e-a49f-4a83-92cb-778995602b07', 'CREDIT', 33, -122919.23, '2025-11-10 21:14:45', '2025-11-25 08:53:35'),
(33, '20317963-beb7-4f21-8c6d-3d65a7fbf6ab', 'CREDIT', 34, -128688.99, '2025-11-10 21:14:45', '2025-11-25 08:53:53'),
(34, '4516daeb-4849-4671-8363-2734cbc733b3', 'CREDIT', 35, -122611.78, '2025-11-10 21:14:45', '2025-11-25 08:52:23'),
(35, '029b314f-d80d-49c0-9280-3dd771392a19', 'CREDIT', 36, -124072.61, '2025-11-10 21:14:45', '2025-11-25 08:57:20'),
(36, 'f54f95e1-dc00-4f17-a4fe-eb11bfa24b7f', 'CREDIT', 37, -123870.93, '2025-11-10 21:14:45', '2025-11-25 08:53:44'),
(37, '507956ae-1e42-4204-ba30-efbbfb61b291', 'CREDIT', 38, 77.25, '2025-11-12 12:27:43', '2025-11-12 12:30:23');

--
-- Index pour les tables déchargées
--

--
-- Index pour la table `accounts`
--
ALTER TABLE `accounts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `accounts_user_id_currency_code_unique` (`user_id`,`currency_code`),
  ADD UNIQUE KEY `accounts_uuid_unique` (`uuid`),
  ADD KEY `accounts_currency_code_foreign` (`currency_code`);

--
-- AUTO_INCREMENT pour les tables déchargées
--

--
-- AUTO_INCREMENT pour la table `accounts`
--
ALTER TABLE `accounts`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=38;

--
-- Contraintes pour les tables déchargées
--

--
-- Contraintes pour la table `accounts`
--
ALTER TABLE `accounts`
  ADD CONSTRAINT `accounts_currency_code_foreign` FOREIGN KEY (`currency_code`) REFERENCES `currencies` (`code`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `accounts_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
