// eslint.config.mjs
import { defineConfig, globalIgnores } from 'eslint/config'
import nextConfig from 'eslint-config-next/core-web-vitals'

export default defineConfig([
  ...nextConfig,
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Prisma'nın ürettiği check-up client'ı (gitignore'da, build yeniden üretir)
    'src/lib/checkup/generated/**',
  ]),
])
