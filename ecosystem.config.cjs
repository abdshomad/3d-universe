/**
 * pm2 service definition.
 *
 * The port and host come from `.env`, read by scripts/serve.js — the same file
 * a human runs locally, so there is one source of truth for the address.
 *
 *   pm2 start ecosystem.config.cjs
 *   pm2 save
 */

module.exports = {
  apps: [
    {
      name: '3d-universe',
      script: 'scripts/serve.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '300M',
      // Only `.env` is watched: editing the port restarts the service on the
      // new address without anyone touching pm2.
      watch: ['.env'],
      time: true,
      env: {
        NODE_ENV: 'production',
      },
      out_file: 'logs/out.log',
      error_file: 'logs/error.log',
      merge_logs: true,
    },
  ],
};