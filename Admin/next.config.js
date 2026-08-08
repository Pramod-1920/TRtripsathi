/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
    ],
  },
  async rewrites() {
    const apiUpstreamUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');

    if (!apiUpstreamUrl) {
      throw new Error('NEXT_PUBLIC_API_URL is required');
    }

    return [
      {
        source: '/backend-api/:path*',
        destination: `${apiUpstreamUrl}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
