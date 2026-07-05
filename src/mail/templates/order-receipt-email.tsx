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

interface OrderReceiptEmailProps {
  userName: string;
  orderNumber: string;
  amount: number;
}

export default function OrderReceiptEmail({ userName, orderNumber, amount }: OrderReceiptEmailProps) {
  return (
    <Html>
      <Head />
      <Tailwind>
        <Body className="bg-gray-50 font-sans">
          <Container className="mx-auto py-10 px-4">
            <Section className="bg-white rounded-2xl shadow-sm p-8 border border-gray-100 mt-8 mx-auto max-w-lg text-center">
              <Img src={LOGO_URL} width="150" height="40" alt="Deliverse Logo" className="mx-auto mb-6" />
              <Heading className="text-2xl font-bold text-gray-900 mb-4">
                Payment Successful!
              </Heading>
              <Text className="text-base text-gray-600 mb-8 leading-relaxed">
                Hi {userName}, your payment for order <strong>#{orderNumber.substring(0,8)}</strong> was successful.
              </Text>
              
              <Section className="bg-gray-50 rounded-xl p-6 mb-8 inline-block w-full">
                <Text className="text-sm text-gray-500 mb-1 m-0">Total Amount</Text>
                <Text className="text-3xl font-bold text-gray-900 m-0">
                  ₦{amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                </Text>
              </Section>
              
              <Text className="text-sm text-gray-500 mb-8">
                You can track your delivery directly in the Deliverse App.
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
