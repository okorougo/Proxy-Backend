import { PrismaClient } from '@prisma/client';
const { adapter } = require('../../prisma.config'); // adjust path

const prisma = new PrismaClient({ adapter });
export default prisma;
