import { NextResponse } from 'next/server';
import { createInitialAdmin } from '@/lib/users-repo';

export async function POST() {
  try {
    const admin = await createInitialAdmin();
    
    return NextResponse.json(
      { 
        message: 'Admin user initialized successfully',
        admin: {
          id: admin._id,
          email: admin.email,
          name: admin.name,
          role: admin.role
        }
      }, 
      { status: 200 }
    );
  } catch (error) {
    console.error('Error initializing admin:', error);
    return NextResponse.json(
      { message: 'Failed to initialize admin user' }, 
      { status: 500 }
    );
  }
}