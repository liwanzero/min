module.exports = {
  apps: [
    {
      name: 'minecraft-ai',
      script: './src/orchestrator.js',
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',
      max_memory_restart: '1G',
      watch: false,
      ignore_watch: ['node_modules', 'data', 'logs'],
      args: '',
      cron_restart: '',
      shutdown_delay: 3000,
    },
  ],
};
