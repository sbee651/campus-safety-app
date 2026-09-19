const useTrustedConnection = ['1', 'true', 'yes', 'on'].includes(
  String(process.env.DB_TRUSTED_CONNECTION ?? 'true').toLowerCase()
) && !process.env.DB_USER;

const sql = useTrustedConnection ? require('mssql/msnodesqlv8') : require('mssql');

const toBool = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const buildConfig = () => {
  if (process.env.DB_CONNECTION_STRING) {
    return process.env.DB_CONNECTION_STRING;
  }

  if (useTrustedConnection) {
    const server = process.env.DB_SERVER || '(localdb)\\MSSQLLocalDB';
    const database = process.env.DB_DATABASE || 'CampusSafetyApp';
    return {
      connectionString: `Driver={ODBC Driver 17 for SQL Server};Server=${server};Database=${database};Trusted_Connection=Yes;TrustServerCertificate=Yes;`,
      pool: {
        max: 5,
        min: 0,
        idleTimeoutMillis: 30000
      }
    };
  }

  const config = {
    server: process.env.DB_SERVER || '(localdb)\\MSSQLLocalDB',
    database: process.env.DB_DATABASE || 'CampusSafetyApp',
    options: {
      encrypt: toBool(process.env.DB_ENCRYPT, false),
      trustServerCertificate: toBool(process.env.DB_TRUST_SERVER_CERTIFICATE, true)
    },
    pool: {
      max: 5,
      min: 0,
      idleTimeoutMillis: 30000
    }
  };

  if (process.env.DB_PORT) {
    config.port = Number(process.env.DB_PORT);
  }

  if (process.env.DB_USER) {
    config.user = process.env.DB_USER;
    config.password = process.env.DB_PASSWORD || '';
    delete config.options.trustedConnection;
  }

  return config;
};

let poolPromise;

const getPool = () => {
  if (!poolPromise) {
    poolPromise = sql.connect(buildConfig()).catch((error) => {
      poolPromise = null;
      throw error;
    });
  }
  return poolPromise;
};

module.exports = {
  sql,
  getPool,
  buildConfig
};
