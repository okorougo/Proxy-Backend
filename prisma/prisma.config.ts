import { defineConfig } from '@prisma/config';
import 'dotenv/config';

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL || 'postgresql://postgres.tepnbgfqhmwpnmzvpwdw:Bonkeysax45@aws-1-eu-central-1.pooler.supabase.com:5432/postgres',
  },
});
