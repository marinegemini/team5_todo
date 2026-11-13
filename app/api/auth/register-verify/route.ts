import { NextRequest, NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { createSession } from '@/lib/auth';
import { authenticatorDB, challengeDB, userDB } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const response = body.response;

    if (!username || !response) {
      return NextResponse.json({ error: 'Username and response are required' }, { status: 400 });
    }

    if (userDB.findByUsername(username)) {
      return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
    }

    const expectedChallenge = challengeDB.consume(username);
    if (!expectedChallenge) {
      return NextResponse.json({ error: 'Challenge expired or not found' }, { status: 400 });
    }

    const expectedRPID = process.env.RP_ID || request.nextUrl.hostname;
    const expectedOrigin = process.env.RP_ORIGIN || request.nextUrl.origin;

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin,
      expectedRPID,
      requireUserVerification: false,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ error: 'Registration verification failed' }, { status: 400 });
    }

    const { credential } = verification.registrationInfo;
    const user = userDB.create(username);
    authenticatorDB.create({
      user_id: user.id,
      credential_id: credential.id,
      credential_public_key: Buffer.from(credential.publicKey),
      counter: credential.counter ?? 0,
    });

    await createSession(user);
    return NextResponse.json({ success: true, user: { id: user.id, username: user.username } });
  } catch (err) {
    console.error('register-verify error:', err);
    return NextResponse.json(
      { error: (err as Error).message || 'Registration failed' },
      { status: 400 }
    );
  }
}

