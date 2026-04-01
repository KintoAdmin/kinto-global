/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable experimental features that can cause build failures on Vercel
  // typedRoutes removed — causes issues with some Next 15 versions on Vercel
  
  // Increase serverless function timeout for report generation


  // Production headers
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },
};

export default nextConfig;
