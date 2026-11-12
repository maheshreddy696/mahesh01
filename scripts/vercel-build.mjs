import { execSync } from 'child_process';

const dbUrl = process.env.DATABASE_URL || '';
const usePostgres =
  dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://');

const schemaPath = usePostgres
  ? 'server/prisma/schema.postgres.prisma'
  : 'server/prisma/schema.prisma';

console.log(`Generating Prisma Client using ${schemaPath}...`);
execSync(`npx --prefix server prisma generate --schema=${schemaPath}`, {
  stdio: 'inherit',
});

console.log('Building frontend client...');
execSync('npm --prefix client run build', {
  stdio: 'inherit',
});

