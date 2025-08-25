import React, { useState } from 'react';
import * as Form from '@radix-ui/react-form';
import * as Label from '@radix-ui/react-label';
import * as Tabs from '@radix-ui/react-tabs';
import { Card, Button, Text, Heading, TextField } from '@radix-ui/themes';
import axios from 'axios';

interface AuthResponse {
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

const AuthForm: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    type: 'success' | 'error';
  } | null>(null);

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
    isLogin: boolean
  ) => {
    event.preventDefault();
    setIsLoading(true);
    setMessage(null);

    const formData = new FormData(event.currentTarget);
    const data = Object.fromEntries(formData.entries());

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const backendUrl = import.meta.env.VITE_BACKEND_URL;
      const response = await axios.post<AuthResponse>(
        `${backendUrl}${endpoint}`,
        data,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const result: AuthResponse = response.data;

      if (result.success) {
        setMessage({ text: result.message, type: 'success' });
        if (result.token) {
          localStorage.setItem('authToken', result.token);
          localStorage.setItem('user', JSON.stringify(result.user));
          // Here you would typically redirect to the main app
          console.log('Authentication successful:', result.user);
        }
      } else {
        setMessage({ text: result.message, type: 'error' });
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        setMessage({ text: error.response.data.message, type: 'error' });
      } else {
        setMessage({ text: 'Network error. Please try again.', type: 'error' });
      }
      console.error('Auth error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <Heading size="8">Welcome to polyglotio</Heading>
          <Text size="4" className="mt-2">
            Sign in to your account or create a new one
          </Text>
        </div>

        <Card className="p-8">
          <Tabs.Root defaultValue="login" className="w-full">
            <Tabs.List className="grid w-full grid-cols-2 mb-6">
              <Tabs.Trigger
                value="login"
                className="px-4 py-2 text-sm font-medium text-center border-b-2 border-transparent hover:border-current focus:border-current focus:outline-none data-[state=active]:border-current"
              >
                Sign In
              </Tabs.Trigger>
              <Tabs.Trigger
                value="register"
                className="px-4 py-2 text-sm font-medium text-center border-b-2 border-transparent hover:border-current focus:border-current focus:outline-none data-[state=active]:border-current"
              >
                Sign Up
              </Tabs.Trigger>
            </Tabs.List>

            {message && (
              <div
                className={`mb-4 p-3 rounded-md border ${
                  message.type === 'success'
                    ? 'bg-green-50 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800'
                    : 'bg-red-50 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800'
                }`}
              >
                <Text size="2">{message.text}</Text>
              </div>
            )}

            <Tabs.Content value="login">
              <Form.Root onSubmit={e => handleSubmit(e, true)}>
                <div className="space-y-4">
                  <Form.Field name="email">
                    <div className="flex items-baseline justify-between">
                      <Form.Label asChild>
                        <Label.Root className="text-sm font-medium">
                          Email address
                        </Label.Root>
                      </Form.Label>
                      <Form.Message
                        className="text-xs text-red-600 dark:text-red-400"
                        match="valueMissing"
                      >
                        Please enter your email
                      </Form.Message>
                      <Form.Message
                        className="text-xs text-red-600 dark:text-red-400"
                        match="typeMismatch"
                      >
                        Please provide a valid email
                      </Form.Message>
                    </div>
                    <Form.Control asChild>
                      <TextField.Root
                        type="email"
                        required
                        className="mt-1"
                        placeholder="Enter your email"
                      />
                    </Form.Control>
                  </Form.Field>

                  <Form.Field name="password">
                    <div className="flex items-baseline justify-between">
                      <Form.Label asChild>
                        <Label.Root className="text-sm font-medium">
                          Password
                        </Label.Root>
                      </Form.Label>
                      <Form.Message
                        className="text-xs text-red-600 dark:text-red-400"
                        match="valueMissing"
                      >
                        Please enter your password
                      </Form.Message>
                    </div>
                    <Form.Control asChild>
                      <TextField.Root
                        type="password"
                        required
                        className="mt-1"
                        placeholder="Enter your password"
                      />
                    </Form.Control>
                  </Form.Field>

                  <Form.Submit asChild>
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="w-full"
                      size="3"
                    >
                      {isLoading ? 'Signing in...' : 'Sign in'}
                    </Button>
                  </Form.Submit>
                </div>
              </Form.Root>
            </Tabs.Content>

            <Tabs.Content value="register">
              <Form.Root onSubmit={e => handleSubmit(e, false)}>
                <div className="space-y-4">
                  <Form.Field name="username">
                    <div className="flex items-baseline justify-between">
                      <Form.Label asChild>
                        <Label.Root className="text-sm font-medium">
                          Username
                        </Label.Root>
                      </Form.Label>
                      <Form.Message
                        className="text-xs text-red-600 dark:text-red-400"
                        match="valueMissing"
                      >
                        Please enter a username
                      </Form.Message>
                    </div>
                    <Form.Control asChild>
                      <TextField.Root
                        type="text"
                        required
                        className="mt-1"
                        placeholder="Choose a username"
                      />
                    </Form.Control>
                  </Form.Field>

                  <Form.Field name="email">
                    <div className="flex items-baseline justify-between">
                      <Form.Label asChild>
                        <Label.Root className="text-sm font-medium">
                          Email address
                        </Label.Root>
                      </Form.Label>
                      <Form.Message
                        className="text-xs text-red-600 dark:text-red-400"
                        match="valueMissing"
                      >
                        Please enter your email
                      </Form.Message>
                      <Form.Message
                        className="text-xs text-red-600 dark:text-red-400"
                        match="typeMismatch"
                      >
                        Please provide a valid email
                      </Form.Message>
                    </div>
                    <Form.Control asChild>
                      <TextField.Root
                        type="email"
                        required
                        className="mt-1"
                        placeholder="Enter your email"
                      />
                    </Form.Control>
                  </Form.Field>

                  <Form.Field name="password">
                    <div className="flex items-baseline justify-between">
                      <Form.Label asChild>
                        <Label.Root className="text-sm font-medium">
                          Password
                        </Label.Root>
                      </Form.Label>
                      <Form.Message
                        className="text-xs text-red-600 dark:text-red-400"
                        match="valueMissing"
                      >
                        Please enter a password
                      </Form.Message>
                    </div>
                    <Form.Control asChild>
                      <TextField.Root
                        type="password"
                        required
                        className="mt-1"
                        placeholder="Choose a password (min 6 characters)"
                      />
                    </Form.Control>
                  </Form.Field>

                  <Form.Field name="phone_number">
                    <div className="flex items-baseline justify-between">
                      <Form.Label asChild>
                        <Label.Root className="text-sm font-medium">
                          Phone Number (optional)
                        </Label.Root>
                      </Form.Label>
                    </div>
                    <Form.Control asChild>
                      <TextField.Root
                        type="tel"
                        className="mt-1"
                        placeholder="Enter your phone number"
                      />
                    </Form.Control>
                  </Form.Field>

                  <Form.Submit asChild>
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="w-full"
                      size="3"
                    >
                      {isLoading ? 'Creating account...' : 'Create account'}
                    </Button>
                  </Form.Submit>
                </div>
              </Form.Root>
            </Tabs.Content>
          </Tabs.Root>
        </Card>
      </div>
    </div>
  );
};

export default AuthForm;
