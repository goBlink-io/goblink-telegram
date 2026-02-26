module.exports = {
  apps: [{
    name: 'goblink-bot',
    script: 'dist/index.js',
    env: {
      NODE_ENV: 'production',
    },
    max_memory_restart: '200M',
    exp_backoff_restart_delay: 100,
  }]
};
