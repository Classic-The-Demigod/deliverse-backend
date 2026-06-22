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

interface OrderStatusEmailProps {
  orderNumber: string;
  statusText: string;
  recipientName: string;
}

export default function OrderStatusEmail({ orderNumber, statusText, recipientName }: OrderStatusEmailProps) {
  return (
    <Html>
      <Head />
      <Tailwind>
        <Body className="bg-gray-50 font-sans">
          <Container className="mx-auto py-10 px-4">
            <Section className="bg-white rounded-2xl shadow-sm p-8 border border-gray-100 mt-8 mx-auto max-w-lg text-center">
              <Heading className="text-2xl font-bold text-gray-900 mb-4">
                Order Update: {orderNumber}
              </Heading>
              <Text className="text-base text-gray-600 mb-8 leading-relaxed">
                Hi {recipientName},
              </Text>
              
              <Section className="bg-gray-50 rounded-xl p-6 mb-8 inline-block w-full">
                <Text className="text-xl font-bold text-blue-600 text-center m-0">
                  {statusText}
                </Text>
              </Section>
              
              <Text className="text-sm text-gray-500 mb-8">
                You can track your order in the Deliverse app for real-time updates on your delivery.
              </Text>
              
              <Hr className="border-gray-200 my-6" />
              
              <Text className="text-xs text-gray-400 text-center">
                © {new Date().getFullYear()} Deliverse. All rights reserved.<br/>
                Secure, fast, and reliable delivery network.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
