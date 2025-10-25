-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `username` VARCHAR(50) NOT NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `role` VARCHAR(20) NOT NULL DEFAULT 'admin',
    `failedLoginAttempts` INTEGER NOT NULL DEFAULT 0,
    `lockUntil` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `configuracoes` (
    `id` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(200) NULL,
    `endereco` VARCHAR(300) NULL,
    `telefone` VARCHAR(20) NULL,
    `email` VARCHAR(100) NULL,
    `cnpj` VARCHAR(20) NULL,
    `cep` VARCHAR(10) NULL,
    `logoDataUrl` LONGTEXT NULL,
    `logoPreset` VARCHAR(10) NULL,
    `selectedLogo` LONGTEXT NULL,
    `uploadedLogos` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `clientes` (
    `id` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(200) NOT NULL,
    `email` VARCHAR(100) NULL,
    `telefone` VARCHAR(20) NULL,
    `cidade` VARCHAR(100) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `clientes_nome_idx`(`nome`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pecas` (
    `id` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(200) NOT NULL,
    `descricao` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `pecas_nome_idx`(`nome`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `servicos` (
    `id` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(200) NOT NULL,
    `descricao` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `servicos_nome_idx`(`nome`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `orcamentos` (
    `id` VARCHAR(191) NOT NULL,
    `clienteId` VARCHAR(191) NOT NULL,
    `data` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `dataFinal` DATETIME(3) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'pendente',
    `total` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `carro` VARCHAR(200) NULL,
    `placa` VARCHAR(10) NULL,
    `incEst` VARCHAR(50) NULL,
    `observacao` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `orcamentos_clienteId_idx`(`clienteId`),
    INDEX `orcamentos_status_idx`(`status`),
    INDEX `orcamentos_data_idx`(`data`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `orcamento_items` (
    `id` VARCHAR(191) NOT NULL,
    `orcamentoId` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(200) NOT NULL,
    `quantidade` INTEGER NOT NULL,
    `preco` DECIMAL(10, 2) NOT NULL,
    `tipo` VARCHAR(20) NOT NULL,

    INDEX `orcamento_items_orcamentoId_idx`(`orcamentoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `orcamentos` ADD CONSTRAINT `orcamentos_clienteId_fkey` FOREIGN KEY (`clienteId`) REFERENCES `clientes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orcamento_items` ADD CONSTRAINT `orcamento_items_orcamentoId_fkey` FOREIGN KEY (`orcamentoId`) REFERENCES `orcamentos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
