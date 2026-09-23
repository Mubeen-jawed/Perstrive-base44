// PM2 process definition used on the VPS. `cwd` points at the `current` symlink,
// so a reload after each deploy picks up the new release.
const APP_DIR = process.env.APP_DIR || "/var/www/perstrive-dashboard";

module.exports = {
  apps: [
    {
      name: "perstrive-dashboard",
      cwd: `${APP_DIR}/current`,
      script: "node_modules/next/dist/bin/next",
      args: "start -p 7006 -H 127.0.0.1",
      env: { NODE_ENV: "production" },
      max_memory_restart: "700M",
      time: true,
    },
  ],
};
