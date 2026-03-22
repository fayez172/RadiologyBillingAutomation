/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['mssql', 'tedious'],
  },
};

module.exports = nextConfig;
