import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

/** @type {(phase: string) => import('next').NextConfig} */
export default function nextConfig(phase) {
  return {
    serverExternalPackages: ["pg"],
    // `next dev` gets its own folder so a build never corrupts a running dev server.
    // update.sh builds into NEXT_DIST_DIR=.next-build and swaps it in once it succeeds.
    distDir:
      phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : process.env.NEXT_DIST_DIR || ".next",
  };
}
