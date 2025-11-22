-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Hôte : 127.0.0.1:3306
-- Généré le : sam. 22 nov. 2025 à 10:25
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
-- Structure de la table `users`
--

CREATE TABLE `users` (
  `id` bigint UNSIGNED NOT NULL,
  `referrer_id` bigint UNSIGNED DEFAULT NULL,
  `rank_id` bigint UNSIGNED DEFAULT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `code` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` tinyint UNSIGNED NOT NULL,
  `status` tinyint UNSIGNED NOT NULL,
  `kyc_status` tinyint UNSIGNED NOT NULL DEFAULT '0',
  `fields` json DEFAULT NULL,
  `flags` json DEFAULT NULL,
  `banned_from_chat` tinyint(1) NOT NULL DEFAULT '0',
  `avatar` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `permissions` text COLLATE utf8mb4_unicode_ci,
  `affiliate_commissions` text COLLATE utf8mb4_unicode_ci,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `remember_token` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `totp_secret` varchar(300) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pap_visitor_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_seen_at` timestamp NULL DEFAULT NULL,
  `email_verified_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `users`
--

INSERT INTO `users` (`id`, `referrer_id`, `rank_id`, `name`, `email`, `code`, `role`, `status`, `kyc_status`, `fields`, `flags`, `banned_from_chat`, `avatar`, `permissions`, `affiliate_commissions`, `notes`, `password`, `remember_token`, `totp_secret`, `pap_visitor_id`, `last_seen_at`, `email_verified_at`, `created_at`, `updated_at`) VALUES
(1, NULL, NULL, 'Betwin Admin', 'chainoocom@gmail.com', '2149cb17-2830-43ad-91f2-c4639c54b4a6', 2, 0, 0, NULL, NULL, 0, '1762682555_74ca1856b655.svg', NULL, NULL, NULL, '$2y$10$SyVReX9R/tVhxzQpVd98POGisycwDfbjFl4lkigpI31besB4YhTF2', '7k1ju8kXW6Js2pzA2667welept2zJ1aN6XzpmCKaLvf42BwHQa4BHcdu9HAm', NULL, NULL, '2025-11-22 09:25:30', '2025-11-09 10:02:35', '2025-11-09 10:02:35', '2025-11-22 09:25:30'),
(3, NULL, NULL, 'darkeningtracery759', 'jadzalla@venmyglobal.com', '617fc53b-313e-4d7b-81df-81814d170b45', 1, 0, 0, '[]', NULL, 0, '1762686444_c59f929e6956.svg', NULL, NULL, NULL, '$2y$10$wD9oNgEsOgMPNXUfCofxauz7SuUs4p8RrrmqMmDjeqyVgvhj95202', 'cXksiJIQfektcYrvnA2RXNGyJaBf6zOz9DcS8v0LKnZTQo3mbW1Xdk5APH0C', NULL, NULL, '2025-11-21 12:37:46', NULL, '2025-11-09 11:07:24', '2025-11-21 12:37:46'),
(4, NULL, NULL, 'support', 'support@1stake.app', 'a76c43d4-bfde-404a-a27e-a6b4ed5f890f', 2, 0, 0, NULL, NULL, 0, '1762784849_dba5007970dd.svg', NULL, NULL, NULL, '$2y$10$VmHmTPOJwj95RM0U9PB1B.iG6F0.RKO3NvRxug.5gIxP1DqQIp6BS', NULL, NULL, NULL, '2025-11-11 06:43:02', NULL, '2025-11-10 14:27:29', '2025-11-11 06:43:02'),
(15, NULL, NULL, 'Dolores Tremblay', 'jocelyn56@example.com', '04a614d8-40de-48a2-b595-b436e883daeb', 4, 0, 0, NULL, NULL, 0, '1762807934_34f6c08eee00.svg', NULL, NULL, NULL, '$2y$10$DMjncuimJqgByVsfIB7EEOvB3XuZGz.pTkpRue2wDnsW8rEIXHmRu', NULL, NULL, NULL, '2025-11-22 09:25:36', NULL, '2025-11-10 20:52:14', '2025-11-22 09:25:36'),
(16, NULL, NULL, 'Dr. Jarrell Hill DDS', 'uhand@example.org', '313977cb-f82e-4efd-826b-c572be2b6acc', 4, 0, 0, NULL, NULL, 0, '1762807934_2b54d0bed7e4.svg', NULL, NULL, NULL, '$2y$10$obGLTZTRsHEi.ABFrJLLCOgGqVNLp4NjZR9N83U4FswRQ73cfEh7e', NULL, NULL, NULL, '2025-11-22 09:23:02', NULL, '2025-11-10 20:52:14', '2025-11-22 09:23:02'),
(17, NULL, NULL, 'Katherine Grady', 'joshua.fritsch@example.org', '9fdae683-3387-4755-b7f7-d3de849d8cea', 4, 0, 0, NULL, NULL, 0, '1762807934_f06d3227bdc7.svg', NULL, NULL, NULL, '$2y$10$q3lANJx18aJwPm8Dsnb1y.TjZeMcrInNzi2Ub4O1qk4YQ7W4/eHoy', NULL, NULL, NULL, '2025-11-22 09:24:25', NULL, '2025-11-10 20:52:14', '2025-11-22 09:24:25'),
(18, NULL, NULL, 'Prof. Lillian Spencer', 'bednar.shirley@example.net', '77068329-fe08-4a86-a5c3-6b78d002e819', 4, 0, 0, NULL, NULL, 0, '1762807934_c3760e0b0544.svg', NULL, NULL, NULL, '$2y$10$aIjX7VcY7spkQ7aOOZAlX.6lSNIzZYsqnnv.OZP/sSYJxTuy/2N5q', NULL, NULL, NULL, '2025-11-22 09:25:30', NULL, '2025-11-10 20:52:14', '2025-11-22 09:25:30'),
(19, NULL, NULL, 'Miss Destinee Tillman I', 'eschowalter@example.org', '5aa17d62-f39e-468e-adab-db43ecd6fc83', 4, 0, 0, NULL, NULL, 0, '1762807934_e18a58d19fd3.svg', NULL, NULL, NULL, '$2y$10$SsVl4w3l1sVavSD.sfnJHOychphLtSV/Wr6U8Hh8oxFe5SPO0LESm', NULL, NULL, NULL, '2025-11-22 09:23:53', NULL, '2025-11-10 20:52:14', '2025-11-22 09:23:53'),
(20, NULL, NULL, 'Carmel Koss DDS', 'ufritsch@example.org', '016c38e2-f179-42e3-8e20-63aeb5d37728', 4, 0, 0, NULL, NULL, 0, '1762807934_d97a44df6c42.svg', NULL, NULL, NULL, '$2y$10$Y9NlQvSFizOxZiGvAKuHuew6xSM4/aFeXNtmvVL6pi9lvhcJZClKi', NULL, NULL, NULL, '2025-11-22 09:24:00', NULL, '2025-11-10 20:52:14', '2025-11-22 09:24:00'),
(21, NULL, NULL, 'Elmira O\'Connell II', 'maddison.wuckert@example.com', '95cc6102-71b4-4d5f-a431-f2876a47cf7b', 4, 0, 0, NULL, NULL, 0, '1762807935_4258411abc27.svg', NULL, NULL, NULL, '$2y$10$kqSG0YqoXmvyuiWAs11GSew9TbSPGlIgMTqF.xkB8euhbRjyHV8GO', NULL, NULL, NULL, '2025-11-22 09:24:25', NULL, '2025-11-10 20:52:15', '2025-11-22 09:24:25'),
(22, NULL, NULL, 'Dr. Sheila Howell Sr.', 'sage.muller@example.org', '5ba1c6dc-06f0-43bf-9064-1508f36aeea9', 4, 0, 0, NULL, NULL, 0, '1762807935_3c0ee584f12c.svg', NULL, NULL, NULL, '$2y$10$0Qq.jlVS0/ueV7sZOGYode8I0vRAT1Xb9q2kqVv2fbH7H2nyPGd/i', NULL, NULL, NULL, '2025-11-22 09:21:46', NULL, '2025-11-10 20:52:15', '2025-11-22 09:21:46'),
(23, NULL, NULL, 'Dr. Christian Sawayn V', 'okeefe.eldred@example.net', 'bdf68891-323b-4460-bdef-20732f20e44a', 4, 0, 0, NULL, NULL, 0, '1762807935_aadcf65fab42.svg', NULL, NULL, NULL, '$2y$10$HIHgGdijFdXAu0fa6GfDceGLdalsp1hBduNyN37mRdRKfqltgjg5S', NULL, NULL, NULL, '2025-11-22 09:25:30', NULL, '2025-11-10 20:52:15', '2025-11-22 09:25:30'),
(24, NULL, NULL, 'Emory Christiansen', 'shania.farrell@example.net', '3b1e739c-1e85-4931-8935-0ac12ac5977a', 4, 0, 0, NULL, NULL, 0, '1762807935_fb71075ff4d0.svg', NULL, NULL, NULL, '$2y$10$eSMxR82/lS49RQs//jaDxuJcsKH7AoT1repf6BABg2AZ189Zu78yy', NULL, NULL, NULL, '2025-11-22 09:25:05', NULL, '2025-11-10 20:52:15', '2025-11-22 09:25:05'),
(25, NULL, NULL, 'Dr. Tyra Hartmann PhD', 'sbrekke@example.com', '0e46bf21-51c4-49f6-9633-fddb2f198ea1', 4, 0, 0, NULL, NULL, 0, '1762807935_b6dfd5fd85d5.svg', NULL, NULL, NULL, '$2y$10$tTq/HTSzzcnwog.kIyCGuu6szLW9e7v2ZXYn23NL7.ow9XDLWMrGS', NULL, NULL, NULL, '2025-11-22 09:24:22', NULL, '2025-11-10 20:52:15', '2025-11-22 09:24:22'),
(26, NULL, NULL, 'Zachary Halvorson MD', 'wolf.jamaal@example.org', '31307ec7-7088-433e-b0c9-e116d8b89033', 4, 0, 0, NULL, NULL, 0, '1762807935_1d05f683e8f1.svg', NULL, NULL, NULL, '$2y$10$OT8xcWjEnUmFfG1jPiydxukqCcZPXVyxbXN6SzvcP7kPz7zuK5AS6', NULL, NULL, NULL, '2025-11-22 09:23:59', NULL, '2025-11-10 20:52:15', '2025-11-22 09:23:59'),
(27, NULL, NULL, 'Stacey Lubowitz', 'nico09@example.org', 'aee14ac2-e98c-46d1-a7da-c956d3c32725', 4, 0, 0, NULL, NULL, 0, '1762807935_e3324d726533.svg', NULL, NULL, NULL, '$2y$10$5Uw8HhGnU7ZeJ6zYzpKz2OIRXGAdFiKjfrQrv5m81gWRe3cv2MRP.', NULL, NULL, NULL, '2025-11-22 09:25:30', NULL, '2025-11-10 20:52:15', '2025-11-22 09:25:30'),
(28, NULL, NULL, 'Rusty Grant', 'baron65@example.org', 'b9778024-ecba-44e0-bcdb-e9e9abc48af4', 4, 0, 0, NULL, NULL, 0, '1762809285_ccf9ff7d7b98.svg', NULL, NULL, NULL, '$2y$10$smpLddri84GZtOl9KkuTHOlfm.tnnuxqGCidcKLwIYgiTf3cKacNS', NULL, NULL, NULL, '2025-11-22 09:24:15', NULL, '2025-11-10 21:14:45', '2025-11-22 09:24:15'),
(29, NULL, NULL, 'Ms. Bailee Hilpert DDS', 'kuhlman.kamryn@example.com', '70d9094c-feaf-4432-8d0a-164b97638171', 4, 0, 0, NULL, NULL, 0, '1762809285_5ace8eb7cf19.svg', NULL, NULL, NULL, '$2y$10$hAl0cNPNWA8OaLacRlGPVep.D76OpZtxQ.fPsjjgb5OlVzfoUvLEK', NULL, NULL, NULL, '2025-11-22 09:24:19', NULL, '2025-11-10 21:14:45', '2025-11-22 09:24:19'),
(30, NULL, NULL, 'Damion Klocko IV', 'norma77@example.org', '06ae5dc5-920a-47f4-ac75-901bf89129dc', 4, 0, 0, NULL, NULL, 0, '1762809285_07a629a55099.svg', NULL, NULL, NULL, '$2y$10$kAirzf5hkWdtIPSO7gZH/eSk5NtqHiRGY/ODLRjjo3n.CBYmyFCXK', NULL, NULL, NULL, '2025-11-22 09:23:56', NULL, '2025-11-10 21:14:45', '2025-11-22 09:23:56'),
(31, NULL, NULL, 'Baby Schmeler', 'vance.glover@example.com', '7adf4353-19db-40ee-aa79-fb08c31c3a7b', 4, 0, 0, NULL, NULL, 0, '1762809285_432d080e9827.svg', NULL, NULL, NULL, '$2y$10$kPrhjTVJgsyBDMhBld0RGeSnR69sLuEGe06H.KhHaHe0BCFI8pi9O', NULL, NULL, NULL, '2025-11-22 09:25:27', NULL, '2025-11-10 21:14:45', '2025-11-22 09:25:27'),
(32, NULL, NULL, 'Mr. Dale Marvin', 'sydnee.labadie@example.org', '5dcfcb6e-e8b1-4aa7-b4fd-be5e4d8e0118', 4, 0, 0, NULL, NULL, 0, '1762809285_3dd61cd1fb94.svg', NULL, NULL, NULL, '$2y$10$Cpw/zQ8wJ5wI51P5b1LjW.yPUExlBH96pIO7Et5RrHgEI0Qqe1Gz2', NULL, NULL, NULL, '2025-11-22 09:23:01', NULL, '2025-11-10 21:14:45', '2025-11-22 09:23:01'),
(33, NULL, NULL, 'Vincenzo Carter', 'jones.julius@example.com', '4af5a7b9-db7f-4332-946c-22e6aa76ba97', 4, 0, 0, NULL, NULL, 0, '1762809285_acb2cedf4767.svg', NULL, NULL, NULL, '$2y$10$tdVSNdp6LFL3IVG8ieAV4OsTDoszRDZ4GCucr7zlDXee2ORh2ArYy', NULL, NULL, NULL, '2025-11-22 09:23:27', NULL, '2025-11-10 21:14:45', '2025-11-22 09:23:27'),
(34, NULL, NULL, 'Prof. Leonora Fisher MD', 'keven12@example.net', '0310177e-9440-4d9d-b24a-9a159c066131', 4, 0, 0, NULL, NULL, 0, '1762809285_e49c36e404e7.svg', NULL, NULL, NULL, '$2y$10$duxR5JtZ8SF/phKUzhhPxuhk.zS6VfnZUyp7eSyn7v/QFdxAGum9O', NULL, NULL, NULL, '2025-11-22 09:25:02', NULL, '2025-11-10 21:14:45', '2025-11-22 09:25:02'),
(35, NULL, NULL, 'Jeremy Mante', 'dickinson.lea@example.net', 'c0eba0e1-09e6-4427-8f4b-ff1489344ab4', 4, 0, 0, NULL, NULL, 0, '1762809285_43ab2f52cf9e.svg', NULL, NULL, NULL, '$2y$10$t3ooPI32HmQjTO8S/113cu.TI.ozgnNppKKv4GExe89Ts5WgmLcdm', NULL, NULL, NULL, '2025-11-22 09:23:01', NULL, '2025-11-10 21:14:45', '2025-11-22 09:23:01'),
(36, NULL, NULL, 'Sigurd McCullough', 'christiansen.hilario@example.net', '0f92261f-c453-4912-87f3-e1bf9b75a2e7', 4, 0, 0, NULL, NULL, 0, '1762809285_07896cb852bc.svg', NULL, NULL, NULL, '$2y$10$hS//q2fIhvmwiK.nPfjIPe93S7QDzprRPwOSUBqFz7OngYQTl2pge', NULL, NULL, NULL, '2025-11-22 09:25:02', NULL, '2025-11-10 21:14:45', '2025-11-22 09:25:02'),
(37, NULL, NULL, 'Johann Ledner V', 'joan35@example.net', '0835305f-53ab-4ea6-ad58-c1043d2a1478', 4, 0, 0, NULL, NULL, 0, '1762809285_63bbfb59ba3d.svg', NULL, NULL, NULL, '$2y$10$Oh9H7O6OiWxzuUEAQ5MBN.Mom0B1iBuRlfdmwDee1L7729revUvUy', NULL, NULL, NULL, '2025-11-22 09:24:00', NULL, '2025-11-10 21:14:45', '2025-11-22 09:24:00'),
(38, NULL, NULL, '953CKYH169xXxaNKVwLT9z9s38TEg1d2pQsY7d1Lv6dD', NULL, '680ed707-761b-4c80-beea-bbf7d0dd5cad', 1, 0, 0, NULL, NULL, 0, '1762950463_854f5af53226.svg', NULL, NULL, NULL, '$2y$10$WQYpn1VCOzpdEH5l6rGbjO.VMS/3flDXUy2fkynNVc7azuc1sRHw2', '8tYDrP8FyIGhoLeRC2oqH58LBXA7S783tOHUH9YoRm8xu9IqRUtq8p5CGhFu', NULL, NULL, '2025-11-12 12:30:23', '2025-11-12 12:27:43', '2025-11-12 12:27:43', '2025-11-12 12:30:23');

--
-- Index pour les tables déchargées
--

--
-- Index pour la table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `users_name_unique` (`name`),
  ADD UNIQUE KEY `users_code_unique` (`code`),
  ADD KEY `users_role_index` (`role`),
  ADD KEY `users_status_index` (`status`),
  ADD KEY `users_last_seen_at_index` (`last_seen_at`),
  ADD KEY `users_referrer_id_foreign` (`referrer_id`),
  ADD KEY `users_pap_visitor_id_index` (`pap_visitor_id`),
  ADD KEY `users_rank_id_foreign` (`rank_id`);

--
-- AUTO_INCREMENT pour les tables déchargées
--

--
-- AUTO_INCREMENT pour la table `users`
--
ALTER TABLE `users`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=39;

--
-- Contraintes pour les tables déchargées
--

--
-- Contraintes pour la table `users`
--
ALTER TABLE `users`
  ADD CONSTRAINT `users_rank_id_foreign` FOREIGN KEY (`rank_id`) REFERENCES `ranks` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `users_referrer_id_foreign` FOREIGN KEY (`referrer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
