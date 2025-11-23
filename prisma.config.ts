import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Supabase Postgres URL
});

export const prismaConfig = {
  adapter: new PrismaPg(pool),
};
