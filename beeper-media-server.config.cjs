module.exports = {
  apps: [
    {
      name: 'beeper-media-server',
      script: '/Users/joshuaoliver/Projects/mydashboard/beeper-media-server.cjs',
      cwd: '/Users/joshuaoliver/Projects/mydashboard',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production'
      },
      error_file: '/Users/joshuaoliver/Projects/mydashboard/logs/beeper-media-error.log',
      out_file: '/Users/joshuaoliver/Projects/mydashboard/logs/beeper-media-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    }
  ]
};

