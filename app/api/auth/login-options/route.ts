import { NextRequest, NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { authenticatorDB, challengeDB, userDB } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const username = typeof body.username === 'string' ? body.username.trim() : '';

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    const user = userDB.findByUsername(username);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const authenticators = authenticatorDB.findByUserId(user.id);
    if (authenticators.length === 0) {
      return NextResponse.json({ error: 'No authenticators registered' }, { status: 404 });
    }

    const rpID = process.env.RP_ID || request.nextUrl.hostname;
    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: authenticators.map((auth) => ({
        id: auth.credential_id,
      })),
      userVerification: 'preferred',
    });

    challengeDB.save(username, options.challenge);
    return NextResponse.json(options);
  } catch (err) {
    console.error('login-options error:', err);
    return NextResponse.json({ error: 'Failed to generate login options' }, { status: 500 });
  }
}

