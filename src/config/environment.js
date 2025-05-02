const dotenv = require('dotenv');
const path = require('path');

class EnvironmentConfig {
  constructor() {
    const envFile = process.env.NODE_ENV === 'production' 
      ? '.env.production' 
      : '.env.development';
    
    const envPath = path.resolve(process.cwd(), `./${envFile}`);
    dotenv.config({ path: envPath });
  }

  get(key, defaultValue = null) {
    return process.env[key] || defaultValue;
  }

  isProduction() {
    return this.get('NODE_ENV') === 'production';
  }
}

module.exports = new EnvironmentConfig();
