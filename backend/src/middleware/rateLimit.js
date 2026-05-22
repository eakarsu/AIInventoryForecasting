import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

// General rate limit: 100 requests per 15 minutes
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

// Auth rate limit: 10 requests per 15 minutes (for login/register/password)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later.' },
});

// AI endpoints rate limit: 20 AI calls per 15 minutes per IP (LLM calls are expensive)
export const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'AI rate limit reached. Please wait before making more AI analysis requests.' },
  skip: (req) => req.method === 'GET',
});

// Strict AI analyze rate limiter: 20 calls per hour, for all /analyze/:id endpoints
export const aiAnalyzeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'AI rate limit reached. Maximum 20 AI analysis requests per hour.' },
  keyGenerator: (req, res) => {
    // Key by user id (from JWT) if available, else IP (IPv6-safe)
    return req.user?.id ? String(req.user.id) : ipKeyGenerator(req, res);
  },
});
