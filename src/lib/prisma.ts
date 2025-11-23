import { PrismaClient } from '@prisma/client';
import { prismaConfig } from '../../prisma.config'; // adjust path if needed

const prisma = new PrismaClient(prismaConfig);

export default prisma;
