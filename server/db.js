import 'dotenv/config'
import postgres from 'postgres'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('❌ DATABASE_URL is not set in the .env file');
  process.exit(1);
}
const sql = postgres(connectionString)

export default sql