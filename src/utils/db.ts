import { Pool } from "pg";
import dotenv from "dotenv";
import fs from "fs";  

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT) || 5432,
  ssl: {
    ca: fs.readFileSync("ca.pem"),
  },
});

pool
  .connect()
  .then(() => console.log("✅ PostgreSQL connected successfully"))
  .catch((err) => console.error("❌ PostgreSQL connection error:", err));

export default pool;