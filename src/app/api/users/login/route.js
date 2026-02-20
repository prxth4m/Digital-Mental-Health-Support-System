import { NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { getUserByEmail, updateUserLastLogin } from '@/lib/users-repo';
import { signJwt, cookieName, cookieMaxAge } from '@/lib/auth';

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export async function POST(req) {
  try {
    const body = await req.json();
    const { email, password } = schema.parse(body);

    // Find user by email
    const user = await getUserByEmail(email);
    if (!user) {
      return NextResponse.json(
        { message: 'Invalid credentials' }, 
        { status: 401 }
      );
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash ?? '');
    if (!isPasswordValid) {
      return NextResponse.json(
        { message: 'Invalid credentials' }, 
        { status: 401 }
      );
    }

    // Create JWT token
    const token = signJwt({ 
      sub: user._id, 
      email: user.email, 
      role: user.role 
    });

    // Update last login time
    if (user._id) {
      await updateUserLastLogin(user._id);
    }

    // Create response with user data
    const response = NextResponse.json(
      { 
        id: user._id, 
        email: user.email, 
        name: user.name, 
        role: user.role 
      }, 
      { status: 200 }
    );

    // Set HTTP-only cookie
    response.cookies.set({
      name: cookieName,
      value: token,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: cookieMaxAge,
    });

    return response;
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { 
          message: 'Invalid input', 
          errors: err.errors 
        }, 
        { status: 400 }
      );
    }
    
    console.error('Login error:', err);
    return NextResponse.json(
      { message: 'Internal server error' }, 
      { status: 500 }
    );
  }
}