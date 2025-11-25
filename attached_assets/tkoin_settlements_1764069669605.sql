-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Hôte : 127.0.0.1:3306
-- Généré le : mar. 25 nov. 2025 à 12:20
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
-- Structure de la table `tkoin_settlements`
--

CREATE TABLE `tkoin_settlements` (
  `id` bigint UNSIGNED NOT NULL,
  `user_id` bigint UNSIGNED NOT NULL,
  `account_id` bigint UNSIGNED NOT NULL,
  `type` enum('deposit','withdrawal') COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('pending','processing','completed','failed','cancelled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `amount` decimal(20,2) NOT NULL,
  `solana_signature` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `tkoin_settlements`
--

INSERT INTO `tkoin_settlements` (`id`, `user_id`, `account_id`, `type`, `status`, `amount`, `solana_signature`, `metadata`, `completed_at`, `created_at`, `updated_at`) VALUES
(1, 1, 1, 'deposit', 'processing', 10.50, NULL, '{\"platform\": \"betwin\", \"user_name\": \"Betwin Admin\", \"initiated_at\": \"2025-11-21T15:50:43+00:00\"}', NULL, '2025-11-21 15:50:43', '2025-11-21 15:50:43'),
(2, 1, 1, 'withdrawal', 'processing', 5.00, NULL, '{\"platform\": \"betwin\", \"user_name\": \"Betwin Admin\", \"initiated_at\": \"2025-11-21T15:50:54+00:00\", \"solana_address\": \"953CKYH169xXxaNKVwLT9z9s38TEg1d2pQsY7d1Lv6dD\"}', NULL, '2025-11-21 15:50:54', '2025-11-21 15:50:54'),
(3, 1, 1, 'deposit', 'processing', 100.00, NULL, '{\"platform\": \"betwin\", \"user_name\": \"Betwin Admin\", \"initiated_at\": \"2025-11-21T17:21:48+00:00\"}', NULL, '2025-11-21 17:21:48', '2025-11-21 17:21:48'),
(4, 3, 2, 'deposit', 'failed', 5000.00, NULL, '{\"platform\": \"betwin\", \"failed_at\": \"2025-11-22T09:29:57+00:00\", \"user_name\": \"darkeningtracery759\", \"initiated_at\": \"2025-11-22T09:29:57+00:00\", \"failure_reason\": \"cURL error 6: Could not resolve host: tkoin.replit.dev (see https://curl.haxx.se/libcurl/c/libcurl-errors.html) for https://tkoin.replit.dev/platforms/platform_betwin/deposits\"}', NULL, '2025-11-22 09:29:57', '2025-11-22 09:29:57'),
(5, 3, 2, 'withdrawal', 'failed', 2500.00, NULL, '{\"platform\": \"betwin\", \"failed_at\": \"2025-11-22T09:29:58+00:00\", \"user_name\": \"darkeningtracery759\", \"initiated_at\": \"2025-11-22T09:29:58+00:00\", \"failure_reason\": \"cURL error 6: Could not resolve host: tkoin.replit.dev (see https://curl.haxx.se/libcurl/c/libcurl-errors.html) for https://tkoin.replit.dev/platforms/platform_betwin/withdrawals\", \"solana_address\": null}', NULL, '2025-11-22 09:29:58', '2025-11-22 09:29:58'),
(6, 3, 2, 'deposit', 'failed', 5000.00, NULL, '{\"platform\": \"betwin\", \"failed_at\": \"2025-11-22T09:32:30+00:00\", \"user_name\": \"darkeningtracery759\", \"initiated_at\": \"2025-11-22T09:32:30+00:00\", \"failure_reason\": \"cURL error 6: Could not resolve host: db20a8d62333.replit.dev (see https://curl.haxx.se/libcurl/c/libcurl-errors.html) for https://db20a8d62333.replit.dev/platforms/platform_betwin/deposits\"}', NULL, '2025-11-22 09:32:30', '2025-11-22 09:32:30'),
(7, 3, 2, 'withdrawal', 'failed', 2500.00, NULL, '{\"platform\": \"betwin\", \"failed_at\": \"2025-11-22T09:32:31+00:00\", \"user_name\": \"darkeningtracery759\", \"initiated_at\": \"2025-11-22T09:32:31+00:00\", \"failure_reason\": \"cURL error 6: Could not resolve host: db20a8d62333.replit.dev (see https://curl.haxx.se/libcurl/c/libcurl-errors.html) for https://db20a8d62333.replit.dev/platforms/platform_betwin/withdrawals\", \"solana_address\": null}', NULL, '2025-11-22 09:32:31', '2025-11-22 09:32:31'),
(8, 3, 2, 'deposit', 'processing', 5000.00, NULL, '{\"platform\": \"betwin\", \"user_name\": \"darkeningtracery759\", \"initiated_at\": \"2025-11-22T09:47:24+00:00\"}', NULL, '2025-11-22 09:47:24', '2025-11-22 09:47:24'),
(9, 3, 2, 'withdrawal', 'processing', 2500.00, NULL, '{\"platform\": \"betwin\", \"user_name\": \"darkeningtracery759\", \"initiated_at\": \"2025-11-22T09:47:25+00:00\", \"solana_address\": null}', NULL, '2025-11-22 09:47:25', '2025-11-22 09:47:25'),
(10, 3, 2, 'deposit', 'processing', 5000.00, NULL, '{\"platform\": \"betwin\", \"user_name\": \"darkeningtracery759\", \"initiated_at\": \"2025-11-22T09:48:51+00:00\"}', NULL, '2025-11-22 09:48:51', '2025-11-22 09:48:51'),
(11, 3, 2, 'withdrawal', 'processing', 2500.00, NULL, '{\"platform\": \"betwin\", \"user_name\": \"darkeningtracery759\", \"initiated_at\": \"2025-11-22T09:48:52+00:00\", \"solana_address\": null}', NULL, '2025-11-22 09:48:52', '2025-11-22 09:48:52'),
(12, 3, 2, 'deposit', 'processing', 5000.00, NULL, '{\"platform\": \"betwin\", \"user_name\": \"darkeningtracery759\", \"initiated_at\": \"2025-11-22T09:50:28+00:00\"}', NULL, '2025-11-22 09:50:28', '2025-11-22 09:50:28'),
(13, 3, 2, 'withdrawal', 'processing', 2500.00, NULL, '{\"platform\": \"betwin\", \"user_name\": \"darkeningtracery759\", \"initiated_at\": \"2025-11-22T09:50:29+00:00\", \"solana_address\": null}', NULL, '2025-11-22 09:50:29', '2025-11-22 09:50:29'),
(14, 3, 2, 'deposit', 'processing', 5000.00, NULL, '{\"platform\": \"betwin\", \"user_name\": \"darkeningtracery759\", \"initiated_at\": \"2025-11-22T09:51:41+00:00\"}', NULL, '2025-11-22 09:51:41', '2025-11-22 09:51:41'),
(15, 3, 2, 'withdrawal', 'processing', 2500.00, NULL, '{\"platform\": \"betwin\", \"user_name\": \"darkeningtracery759\", \"initiated_at\": \"2025-11-22T09:51:43+00:00\", \"solana_address\": null}', NULL, '2025-11-22 09:51:43', '2025-11-22 09:51:43'),
(16, 3, 2, 'deposit', 'processing', 5000.00, NULL, '{\"platform\": \"betwin\", \"user_name\": \"darkeningtracery759\", \"initiated_at\": \"2025-11-22T09:58:47+00:00\"}', NULL, '2025-11-22 09:58:47', '2025-11-22 09:58:47'),
(17, 3, 2, 'withdrawal', 'processing', 2500.00, NULL, '{\"platform\": \"betwin\", \"user_name\": \"darkeningtracery759\", \"initiated_at\": \"2025-11-22T09:58:49+00:00\", \"solana_address\": null}', NULL, '2025-11-22 09:58:49', '2025-11-22 09:58:49'),
(18, 3, 2, 'deposit', 'processing', 5000.00, NULL, '{\"platform\": \"betwin\", \"user_name\": \"darkeningtracery759\", \"initiated_at\": \"2025-11-22T10:00:05+00:00\"}', NULL, '2025-11-22 10:00:05', '2025-11-22 10:00:05'),
(19, 3, 2, 'withdrawal', 'processing', 2500.00, NULL, '{\"platform\": \"betwin\", \"user_name\": \"darkeningtracery759\", \"initiated_at\": \"2025-11-22T10:00:07+00:00\", \"solana_address\": null}', NULL, '2025-11-22 10:00:07', '2025-11-22 10:00:07'),
(20, 3, 2, 'deposit', 'processing', 5000.00, NULL, '{\"platform\": \"betwin\", \"user_name\": \"darkeningtracery759\", \"initiated_at\": \"2025-11-22T10:03:32+00:00\"}', NULL, '2025-11-22 10:03:32', '2025-11-22 10:03:32'),
(21, 3, 2, 'withdrawal', 'processing', 2500.00, NULL, '{\"platform\": \"betwin\", \"user_name\": \"darkeningtracery759\", \"initiated_at\": \"2025-11-22T10:03:34+00:00\", \"solana_address\": null}', NULL, '2025-11-22 10:03:34', '2025-11-22 10:03:34'),
(22, 3, 2, 'deposit', 'processing', 5000.00, NULL, '{\"platform\": \"betwin\", \"user_name\": \"darkeningtracery759\", \"initiated_at\": \"2025-11-22T10:08:58+00:00\"}', NULL, '2025-11-22 10:08:58', '2025-11-22 10:08:58'),
(23, 3, 2, 'withdrawal', 'processing', 2500.00, NULL, '{\"platform\": \"betwin\", \"user_name\": \"darkeningtracery759\", \"initiated_at\": \"2025-11-22T10:09:00+00:00\", \"solana_address\": null}', NULL, '2025-11-22 10:09:00', '2025-11-22 10:09:00'),
(24, 3, 2, 'deposit', 'processing', 5000.00, NULL, '{\"platform\": \"betwin\", \"user_name\": \"darkeningtracery759\", \"initiated_at\": \"2025-11-22T11:04:44+00:00\"}', NULL, '2025-11-22 11:04:44', '2025-11-22 11:04:44'),
(25, 3, 2, 'withdrawal', 'processing', 2500.00, NULL, '{\"platform\": \"betwin\", \"user_name\": \"darkeningtracery759\", \"initiated_at\": \"2025-11-22T11:04:45+00:00\", \"solana_address\": null}', NULL, '2025-11-22 11:04:45', '2025-11-22 11:04:45'),
(26, 3, 2, 'deposit', 'processing', 5000.00, NULL, '{\"platform\": \"betwin\", \"user_name\": \"darkeningtracery759\", \"initiated_at\": \"2025-11-22T11:25:47+00:00\"}', NULL, '2025-11-22 11:25:47', '2025-11-22 11:25:47'),
(27, 3, 2, 'withdrawal', 'processing', 2500.00, NULL, '{\"platform\": \"betwin\", \"user_name\": \"darkeningtracery759\", \"initiated_at\": \"2025-11-22T11:25:48+00:00\", \"solana_address\": null}', NULL, '2025-11-22 11:25:48', '2025-11-22 11:25:48'),
(28, 3, 2, 'deposit', 'processing', 5000.00, NULL, '{\"platform\": \"betwin\", \"user_name\": \"darkeningtracery759\", \"initiated_at\": \"2025-11-22T11:38:47+00:00\"}', NULL, '2025-11-22 11:38:47', '2025-11-22 11:38:47'),
(29, 3, 2, 'withdrawal', 'processing', 2500.00, NULL, '{\"platform\": \"betwin\", \"user_name\": \"darkeningtracery759\", \"initiated_at\": \"2025-11-22T11:38:48+00:00\", \"solana_address\": null}', NULL, '2025-11-22 11:38:48', '2025-11-22 11:38:48');

--
-- Index pour les tables déchargées
--

--
-- Index pour la table `tkoin_settlements`
--
ALTER TABLE `tkoin_settlements`
  ADD PRIMARY KEY (`id`),
  ADD KEY `tkoin_settlements_user_id_index` (`user_id`),
  ADD KEY `tkoin_settlements_account_id_index` (`account_id`),
  ADD KEY `tkoin_settlements_user_id_status_index` (`user_id`,`status`),
  ADD KEY `tkoin_settlements_user_id_type_index` (`user_id`,`type`),
  ADD KEY `tkoin_settlements_status_index` (`status`),
  ADD KEY `tkoin_settlements_type_index` (`type`),
  ADD KEY `tkoin_settlements_created_at_index` (`created_at`),
  ADD KEY `tkoin_settlements_solana_signature_index` (`solana_signature`);

--
-- AUTO_INCREMENT pour les tables déchargées
--

--
-- AUTO_INCREMENT pour la table `tkoin_settlements`
--
ALTER TABLE `tkoin_settlements`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=30;

--
-- Contraintes pour les tables déchargées
--

--
-- Contraintes pour la table `tkoin_settlements`
--
ALTER TABLE `tkoin_settlements`
  ADD CONSTRAINT `tkoin_settlements_account_id_foreign` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `tkoin_settlements_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
