import express from 'express';
import {
  UserService,
  RegisterUserData,
  LoginUserData,
} from '../services/authService';

const router = express.Router();

// Validation middleware
const validateRegistration = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const { email, username, password } = req.body;

  if (!email || !username || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email, username, and password are required',
    });
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: 'Please enter a valid email address',
    });
  }

  // Password strength validation
  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 6 characters long',
    });
  }

  // Username validation
  if (username.length < 3) {
    return res.status(400).json({
      success: false,
      message: 'Username must be at least 3 characters long',
    });
  }

  return next();
};

const validateLogin = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required',
    });
  }

  return next();
};

// Register endpoint
router.post('/register', validateRegistration, async (req, res) => {
  try {
    const userData: RegisterUserData = {
      email: req.body.email.toLowerCase().trim(),
      username: req.body.username.trim(),
      password: req.body.password,
      phone_number: req.body.phone_number?.trim() || undefined,
    };

    const result = await UserService.registerUser(userData);

    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Registration route error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Login endpoint
router.post('/login', validateLogin, async (req, res) => {
  try {
    const loginData: LoginUserData = {
      email: req.body.email.toLowerCase().trim(),
      password: req.body.password,
    };

    const result = await UserService.loginUser(loginData);

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(401).json(result);
    }
  } catch (error) {
    console.error('Login route error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Token verification endpoint (for protected routes)
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided',
      });
    }

    const verification = await UserService.verifyToken(token);

    if (verification.valid) {
      return res.status(200).json({
        success: true,
        message: 'Token is valid',
        userId: verification.userId,
      });
    } else {
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
      });
    }
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

export default router;
