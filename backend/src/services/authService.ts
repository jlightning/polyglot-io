import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from './index';

export interface RegisterUserData {
  email: string;
  username: string;
  password: string;
  phone_number?: string;
}

export interface LoginUserData {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  user?: {
    id: number;
    email: string;
    username: string;
    phone_number?: string;
  };
  token?: string;
}

const JWT_SECRET = process.env['JWT_SECRET'] || 'your-secret-key';
const SALT_ROUNDS = 12;

export class UserService {
  static async registerUser(userData: RegisterUserData): Promise<AuthResponse> {
    try {
      // Check if user already exists
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [{ email: userData.email }, { username: userData.username }],
        },
      });

      if (existingUser) {
        return {
          success: false,
          message:
            existingUser.email === userData.email
              ? 'Email already registered'
              : 'Username already taken',
        };
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, SALT_ROUNDS);

      // Create user
      const newUser = await prisma.user.create({
        data: {
          email: userData.email,
          username: userData.username,
          password: hashedPassword,
          phone_number: userData.phone_number || null,
        },
      });

      // Generate JWT token
      const token = jwt.sign(
        {
          userId: newUser.id,
          email: newUser.email,
          username: newUser.username,
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      return {
        success: true,
        message: 'User registered successfully',
        user: {
          id: newUser.id,
          email: newUser.email,
          username: newUser.username,
          ...(newUser.phone_number && { phone_number: newUser.phone_number }),
        },
        token,
      };
    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        message: 'Registration failed. Please try again.',
      };
    }
  }

  static async loginUser(loginData: LoginUserData): Promise<AuthResponse> {
    try {
      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email: loginData.email },
      });

      if (!user) {
        return {
          success: false,
          message: 'Invalid email or password',
        };
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(
        loginData.password,
        user.password
      );

      if (!isPasswordValid) {
        return {
          success: false,
          message: 'Invalid email or password',
        };
      }

      // Generate JWT token
      const token = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          username: user.username,
        },
        JWT_SECRET
      );

      return {
        success: true,
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          ...(user.phone_number && { phone_number: user.phone_number }),
        },
        token,
      };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        message: 'Login failed. Please try again.',
      };
    }
  }

  static async verifyToken(
    token: string
  ): Promise<{ valid: boolean; userId?: number }> {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      return { valid: true, userId: decoded.userId };
    } catch (error) {
      return { valid: false };
    }
  }
}
