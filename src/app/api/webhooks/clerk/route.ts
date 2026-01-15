import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

import { AuditAction } from '@prisma/client';
import { Webhook } from 'svix';

import { prisma } from '@/lib/db';
import { createAuditLog } from '@/lib/services/audit';

type WebhookEvent = {
  data: {
    id: string;
    email_addresses: Array<{
      id: string;
      email_address: string;
    }>;
    primary_email_address_id: string;
    first_name: string | null;
    last_name: string | null;
    phone_numbers: Array<{
      id: string;
      phone_number: string;
    }>;
    primary_phone_number_id: string | null;
    created_at: number;
    updated_at: number;
  };
  object: string;
  type: string;
};

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    console.error('CLERK_WEBHOOK_SECRET is not set');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  // Get the headers
  const headerPayload = headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 });
  }

  // Get the body
  const payload: unknown = await req.json();
  const body = JSON.stringify(payload);

  // Create a new Svix instance with your secret
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Handle the webhook
  const eventType = evt.type;

  if (eventType === 'user.created') {
    const { id, email_addresses, primary_email_address_id, first_name, last_name, phone_numbers, primary_phone_number_id } =
      evt.data;

    const primaryEmail = email_addresses.find(
      (email) => email.id === primary_email_address_id
    );

    const primaryPhone = phone_numbers.find(
      (phone) => phone.id === primary_phone_number_id
    );

    if (!primaryEmail) {
      return NextResponse.json({ error: 'No primary email found' }, { status: 400 });
    }

    const name =
      first_name || last_name
        ? `${first_name ?? ''} ${last_name ?? ''}`.trim()
        : null;

    try {
      const user = await prisma.user.create({
        data: {
          clerkId: id,
          email: primaryEmail.email_address,
          name,
          phone: primaryPhone?.phone_number ?? null,
        },
      });

      await createAuditLog({
        action: AuditAction.USER_REGISTERED,
        userId: user.id,
        metadata: {
          email: primaryEmail.email_address,
          clerkId: id,
        },
      });

      return NextResponse.json({ success: true, userId: user.id });
    } catch (error) {
      console.error('Error creating user:', error);
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }
  }

  if (eventType === 'user.updated') {
    const { id, email_addresses, primary_email_address_id, first_name, last_name, phone_numbers, primary_phone_number_id } =
      evt.data;

    const primaryEmail = email_addresses.find(
      (email) => email.id === primary_email_address_id
    );

    const primaryPhone = phone_numbers.find(
      (phone) => phone.id === primary_phone_number_id
    );

    if (!primaryEmail) {
      return NextResponse.json({ error: 'No primary email found' }, { status: 400 });
    }

    const name =
      first_name || last_name
        ? `${first_name ?? ''} ${last_name ?? ''}`.trim()
        : null;

    try {
      const user = await prisma.user.update({
        where: { clerkId: id },
        data: {
          email: primaryEmail.email_address,
          name,
          phone: primaryPhone?.phone_number ?? null,
        },
      });

      await createAuditLog({
        action: AuditAction.USER_PROFILE_UPDATED,
        userId: user.id,
        metadata: {
          clerkId: id,
          updatedFields: ['email', 'name', 'phone'],
        },
      });

      return NextResponse.json({ success: true, userId: user.id });
    } catch (error) {
      console.error('Error updating user:', error);
      return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }
  }

  if (eventType === 'user.deleted') {
    const { id } = evt.data;

    try {
      // Soft delete - we keep the user record for audit purposes
      // but remove personal data
      const user = await prisma.user.update({
        where: { clerkId: id },
        data: {
          email: `deleted-${id}@deleted.settleright.ai`,
          name: null,
          phone: null,
          addressStreet: null,
          addressCity: null,
          addressState: null,
          addressPostalCode: null,
          addressCountry: null,
        },
      });

      await createAuditLog({
        action: AuditAction.USER_LOGOUT, // Using USER_LOGOUT for account deletion
        userId: user.id,
        metadata: {
          reason: 'account_deleted',
          clerkId: id,
        },
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Error deleting user:', error);
      return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
    }
  }

  if (eventType === 'session.created') {
    const { id } = evt.data;

    try {
      const user = await prisma.user.findUnique({
        where: { clerkId: id },
      });

      if (user) {
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        await createAuditLog({
          action: AuditAction.USER_LOGIN,
          userId: user.id,
          metadata: {
            clerkId: id,
          },
        });
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Error updating login timestamp:', error);
      return NextResponse.json({ error: 'Failed to update login' }, { status: 500 });
    }
  }

  // Return a 200 for unhandled events
  return NextResponse.json({ success: true, message: 'Event not handled' });
}
