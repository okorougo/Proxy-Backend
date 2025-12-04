/*
  Warnings:

  - A unique constraint covering the columns `[name,categoryId]` on the table `SubCategory` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "SubCategory_name_categoryId_key" ON "SubCategory"("name", "categoryId");
