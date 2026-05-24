import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // The repo-init flow reads web/src/lib/templates/repo-readme.md at
  // runtime via fs.readFile. Next.js's tracing won't include raw assets
  // by default, so opt them in here for the standalone build.
  outputFileTracingIncludes: {
    "*": ["./src/lib/templates/**/*.md"],
  },
};

export default nextConfig;
