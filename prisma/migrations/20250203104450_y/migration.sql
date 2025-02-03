/*
  Warnings:

  - You are about to drop the column `is_trial_package` on the `Package` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Package" DROP COLUMN "is_trial_package";
