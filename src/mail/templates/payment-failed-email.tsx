import * as React from 'react';
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Heading,
  Tailwind,
  Hr,
  Img,
} from '@react-email/components';

const LOGO_URL = 'https://via.placeholder.com/150x40/111827/ffffff?text=DELIVERSE';

interface PaymentFailedEmailProps {
  orderNumber: string;
  amount: number;
}

export default function PaymentFailedEmail({ orderNumber, amount }: PaymentFailedEmailProps) {
  return (
    <Html>
      <Head />
      <Tailwind>
        <Body className="bg-gray-50 font-sans">
          <Container className="mx-auto py-10 px-4">
            <Section className="bg-white rounded-2xl shadow-sm p-8 border border-gray-100 mt-8 mx-auto max-w-lg text-center">
              <Img src={LOGO_URL} width="150" height="40" alt="Deliverse Logo" className="mx-auto mb-6" />
              <Heading className="text-2xl font-bold text-red-600 mb-4">
                Payment Failed
              </Heading>
              <Text className="text-base text-gray-600 mb-8 leading-relaxed">
                We couldn't process your payment of <strong>₦{amount.toLocaleString('en-NG')}</strong> for order <strong>#{orderNumber.substring(0,8)}</strong>.
              </Text>
              
              <Text className="text-sm text-gray-500 mb-8">
                Please check your saved card details or add a new payment method in the Deliverse app to retry the payment. Your delivery may be delayed until the payment is resolved.
              </Text>
              
              <Hr className="border-gray-200 my-6" />
              
              <Text className="text-xs text-gray-400 text-center">
                © {new Date().getFullYear()} Deliverse. All rights reserved.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
