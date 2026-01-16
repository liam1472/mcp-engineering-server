/**
 * Sample file with hardcoded secrets for testing security scanner
 * DO NOT USE IN PRODUCTION - These are fake test values
 */

// AWS credentials (fake)
const AWS_ACCESS_KEY_ID = 'AKIAIOSFODNN7EXAMPLE';
const AWS_SECRET_ACCESS_KEY = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';

// API keys (fake)
const OPENAI_API_KEY = 'sk-proj-abcdefghijklmnopqrstuvwxyz123456789012345678901234567890';
const ANTHROPIC_API_KEY = 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz-1234567890abcdefghijklmnop';

// Database connection strings (fake)
const DATABASE_URL = 'postgresql://admin:secretpassword123@localhost:5432/mydb';
const MONGODB_URI = 'mongodb://user:password@localhost:27017/database';
const REDIS_URL = 'redis://default:mysecretpassword@localhost:6379';

// Private key (fake - truncated)
const PRIVATE_KEY = `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0Z3VS5JJcds3xfn/ygWyf8lDwWJMzhMp1Jd0TpAX5gFJ7J0h
abc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abc1
-----END RSA PRIVATE KEY-----`;

// JWT secret (fake)
const JWT_SECRET = 'super-secret-jwt-key-that-should-not-be-hardcoded';

// GitHub token (fake)
const GITHUB_TOKEN = 'ghp_abcdefghijklmnopqrstuvwxyz1234567890';

// Stripe key (fake - using test prefix to avoid GitHub scanner)
const STRIPE_SECRET_KEY = 'sk_test_FAKE_KEY_FOR_TESTING_ONLY_1234567890';

// Slack webhook (fake - modified URL to avoid GitHub scanner)
const SLACK_WEBHOOK = 'https://hooks.example.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX';

// Firebase config (fake)
const firebaseConfig = {
  apiKey: 'AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ123456',
  authDomain: 'example-project.firebaseapp.com',
  projectId: 'example-project',
};

// Azure connection string (fake)
const AZURE_STORAGE_CONNECTION_STRING =
  'DefaultEndpointsProtocol=https;AccountName=mystorageaccount;AccountKey=abc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abc123==;EndpointSuffix=core.windows.net';

// GCP service account (fake - partial)
const GCP_SERVICE_ACCOUNT = {
  type: 'service_account',
  project_id: 'my-project',
  private_key_id: 'abc123abc123abc123abc123abc123abc123abc1',
  private_key: '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBg...\n-----END PRIVATE KEY-----\n',
  client_email: 'my-service@my-project.iam.gserviceaccount.com',
};

export {
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  OPENAI_API_KEY,
  ANTHROPIC_API_KEY,
  DATABASE_URL,
  JWT_SECRET,
};
