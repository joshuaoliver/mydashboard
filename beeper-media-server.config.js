module.exports = {
  apps: [
    {
      name: 'beeper-media-server',
      script: 'serve',
      args: [
        '/Users/joshuaoliver/Library/Application Support/BeeperTexts/media',
        '--listen',
        '47392',
        '--cors',
        '--no-clipboard',
        '--no-port-switching'
      ],
      cwd: '/Users/joshuaoliver',
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

