import { Request, Response, NextFunction } from 'express';
import { ctx } from '../routes';

// Extend Request interface to include userId
declare global {
  namespace Express {
    interface Request {
      userId?: number;
    }
  }
}

async function verifyAndAttachUser(
  req: Request,
  res: Response,
  next: NextFunction,
  token: string | undefined
): Promise<void> {
  if (!token) {
    res.status(401).json({
      success: false,
      message: 'Access token required',
    });
    return;
  }

  try {
    const verification = await ctx.authService.verifyToken(ctx, token);
    if (!verification.valid) {
      res.status(403).json({
        success: false,
        message: 'Invalid or expired token',
      });
      return;
    }

    if (verification.userId) {
      req.userId = verification.userId;
    }

    next();
  } catch (error) {
    res.status(403).json({
      success: false,
      message: 'Invalid token',
    });
    return;
  }
}

/**
 * Authentication middleware to verify JWT tokens
 * Adds userId to the request object if token is valid
 */
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  await verifyAndAttachUser(req, res, next, token);
};

/**
 * MCP auth: JWT from query param ?token= (not Authorization header)
 */
export const authenticateMcpQueryToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const raw = req.query['token'];
  const token = typeof raw === 'string' ? raw : undefined;
  await verifyAndAttachUser(req, res, next, token);
};

/**
 * Middleware to ensure user is authenticated
 * Should be used after authenticateToken middleware
 */
export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.userId) {
    res.status(401).json({
      success: false,
      message: 'User not authenticated',
    });
    return;
  }

  next();
};

/**
 * Combined middleware that does both token verification and user requirement
 * This is the most commonly used middleware for protected routes
 */
export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  await authenticateToken(req, res, (error?: any) => {
    if (error) {
      return next(error);
    }
    requireAuth(req, res, next);
  });
};
