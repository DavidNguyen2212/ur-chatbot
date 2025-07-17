// src/utils/logger.ts
import winston from 'winston';
import path from 'path';
import fs from 'fs';

const { combine, timestamp, printf, colorize, errors, json, splat } = winston.format;

// Tạo logs directory nếu chưa có
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Format cho file - JSON để dễ parse
const fileFormat = combine(
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  json(),
  splat() // Hỗ trợ string formatting như printf
);

// Tạo transports khác nhau cho dev và production
const createTransports = () => {
  const transports: winston.transport[] = [];

  // Console transport - chỉ trong development
  if (process.env.NODE_ENV !== 'production') {
    const consoleFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
      const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
      return `${timestamp} [${level}]: ${stack || message} ${metaStr}`;
    });

    transports.push(
      new winston.transports.Console({
        format: combine(
          colorize(),
          timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          errors({ stack: true }),
          consoleFormat
        ),
      })
    );
  }

  // File transports
  transports.push(
    // Combined log - tất cả logs
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      format: fileFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    
    // Error log - chỉ errors
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    
    // Warning log - warnings và errors
    new winston.transports.File({
      filename: path.join(logsDir, 'warning.log'),
      level: 'warn',
      format: fileFormat,
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 3,
      tailable: true
    })
  );

  return transports;
};

// Tạo logger
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    splat()
  ),
  transports: createTransports(),
  // Xử lý uncaught exceptions
  exceptionHandlers: [
    new winston.transports.File({ 
      filename: path.join(logsDir, 'exceptions.log'),
      format: fileFormat
    })
  ],
  // Xử lý unhandled promise rejections
  rejectionHandlers: [
    new winston.transports.File({ 
      filename: path.join(logsDir, 'rejections.log'),
      format: fileFormat
    })
  ],
  exitOnError: false
});


// Request logger middleware (nếu dùng Express)
// export const requestLogger = (req: any, res: any, next: any) => {
//   const start = Date.now();
  
//   res.on('finish', () => {
//     const duration = Date.now() - start;
//     const logData = {
//       method: req.method,
//       url: req.url,
//       status: res.statusCode,
//       duration: `${duration}ms`,
//       ip: req.ip,
//       userAgent: req.get('user-agent')
//     };
    
//     if (res.statusCode >= 400) {
//       logger.warn('HTTP Request', logData);
//     } else {
//       logger.info('HTTP Request', logData);
//     }
//   });
  
//   next();
// };
