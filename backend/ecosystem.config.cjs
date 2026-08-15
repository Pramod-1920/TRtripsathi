const { mkdirSync } = require('node:fs');
const { join } = require('node:path');

const logDirectory = join(__dirname, 'logs');
const combinedLogFile = join(logDirectory, 'backend.log');

mkdirSync(logDirectory, { recursive: true });

module.exports = {
  apps: [
    {
      name: 'tripsathi-backend',
      cwd: __dirname,
      script: 'dist/src/main.js',
      node_args: '--enable-source-maps',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      merge_logs: true,
      combine_logs: true,
      out_file: combinedLogFile,
      error_file: combinedLogFile,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
