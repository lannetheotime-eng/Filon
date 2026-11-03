/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  // Radar « Vendu loué » : page autonome servie depuis public/
  async rewrites() {
    return [{ source: "/loue", destination: "/vendu-loue.html" }];
  },
};
