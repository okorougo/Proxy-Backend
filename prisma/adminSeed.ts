// prisma/seed.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const email = "admin@proxy.com";
  const password = "Admin@123"; // you can change this
  const hashed = await bcrypt.hash(password, 10);

  const existingAdmin = await prisma.user.findUnique({
    where: { email },
  });

  if (!existingAdmin) {
    const admin = await prisma.user.create({
      data: {
        email,
        password: hashed,
        name: "Super Admin",
        role: "ADMIN",
        isEmailVerified: true,
      },
    });
    console.log(`✅ Admin created: ${admin.email}`);
  } else {
    console.log(`⚠️ Admin already exists: ${existingAdmin.email}`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
