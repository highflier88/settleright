import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

import Stripe from 'stripe';

import { handlePaymentSuccess, handlePaymentFailure } from '@/lib/payments';
import { processVerificationUpdate } from '@/lib/services/stripe-identity';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '');
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: Request) {
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not set');
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    );
  }

  const body = await request.text();
  const headersList = headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  // Handle the event
  try {
    switch (event.type) {
      // Identity verification events
      case 'identity.verification_session.verified': {
        const session = event.data.object;
        console.log('Verification session verified:', session.id);
        await processVerificationUpdate(session.id, 'verified');
        break;
      }

      case 'identity.verification_session.requires_input': {
        const session = event.data.object;
        console.log('Verification session requires input:', session.id);
        await processVerificationUpdate(session.id, 'requires_input');
        break;
      }

      case 'identity.verification_session.canceled': {
        const session = event.data.object;
        console.log('Verification session canceled:', session.id);
        await processVerificationUpdate(session.id, 'canceled');
        break;
      }

      case 'identity.verification_session.processing': {
        const session = event.data.object;
        console.log('Verification session processing:', session.id);
        await processVerificationUpdate(session.id, 'processing');
        break;
      }

      // Payment events
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        console.log('PaymentIntent succeeded:', paymentIntent.id);
        // Payment success is handled via checkout.session.completed
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        console.log('PaymentIntent failed:', paymentIntent.id);
        // Get session ID from metadata if available
        const sessionId = paymentIntent.metadata?.sessionId;
        if (sessionId) {
          const failureMessage = paymentIntent.last_payment_error?.message;
          await handlePaymentFailure(sessionId, failureMessage);
        }
        break;
      }

      case 'checkout.session.completed': {
        const session = event.data.object;
        console.log('Checkout session completed:', session.id);
        if (session.payment_status === 'paid' && session.payment_intent) {
          await handlePaymentSuccess(
            session.id,
            typeof session.payment_intent === 'string'
              ? session.payment_intent
              : session.payment_intent.id
          );
        }
        break;
      }

      case 'checkout.session.expired': {
        const session = event.data.object;
        console.log('Checkout session expired:', session.id);
        await handlePaymentFailure(session.id, 'Session expired');
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}
