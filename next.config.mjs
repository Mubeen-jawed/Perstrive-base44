import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

/** @type {(phase: string) => import('next').NextConfig} */
export default function nextConfig(phase) {
  return {
    serverExternalPackages: ["pg"],
    // `next dev` and `next build` get separate output folders, so running a build
    // never corrupts a dev server that's already running.
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
  };
}
