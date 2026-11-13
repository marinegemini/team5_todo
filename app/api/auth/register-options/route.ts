import { NextRequest, NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { challengeDB, userDB } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const username = typeof body.username === 'string' ? body.username.trim() : '';

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    if (userDB.findByUsername(username)) {
      return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
    }

    const rpName = process.env.RP_NAME || 'Todo App';
    const rpID = process.env.RP_ID || request.nextUrl.hostname;

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName: username,
      attestationType: 'none',
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    challengeDB.save(username, options.challenge);
    return NextResponse.json(options);
  } catch (err) {
    console.error('register-options error:', err);
    return NextResponse.json({ error: 'Failed to generate registration options' }, { status: 500 });
  }
}

