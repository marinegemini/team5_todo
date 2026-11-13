import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { createSession } from '@/lib/auth';
import { authenticatorDB, challengeDB, userDB } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const response = body.response;

    if (!username || !response?.id) {
      return NextResponse.json({ error: 'Username and response are required' }, { status: 400 });
    }

    const authenticator = authenticatorDB.findByCredentialId(response.id);
    if (!authenticator) {
      return NextResponse.json({ error: 'Authenticator not recognized' }, { status: 401 });
    }

    const expectedChallenge = challengeDB.consume(username);
    if (!expectedChallenge) {
      return NextResponse.json({ error: 'Challenge expired or not found' }, { status: 400 });
    }

    const expectedRPID = process.env.RP_ID || request.nextUrl.hostname;
    const expectedOrigin = process.env.RP_ORIGIN || request.nextUrl.origin;

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin,
      expectedRPID,
      requireUserVerification: false,
      credential: {
        id: authenticator.credential_id,
        publicKey: new Uint8Array(authenticator.credential_public_key),
        counter: authenticator.counter ?? 0,
      },
    });

    if (!verification.verified) {
      return NextResponse.json({ error: 'Verification failed' }, { status: 401 });
    }

    authenticatorDB.updateCounter(
      authenticator.id,
      verification.authenticationInfo.newCounter ?? 0
    );

    const user = userDB.findById(authenticator.user_id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    await createSession(user);
    return NextResponse.json({ success: true, user: { id: user.id, username: user.username } });
  } catch (err) {
    console.error('login-verify error:', err);
    return NextResponse.json(
      { error: (err as Error).message || 'Authentication failed' },
      { status: 401 }
    );
  }
}

