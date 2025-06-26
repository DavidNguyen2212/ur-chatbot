import Redis from "ioredis";

const redisClient = new Redis(
  Number(process.env.REDIS_PORT) || 6379,
  process.env.REDIS_HOST || "localhost",
)

export default redisClient