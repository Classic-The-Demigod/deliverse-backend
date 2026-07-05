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

interface WebhookFailureEmailProps {
  endpointUrl: string;
}

export default function WebhookFailureEmail({ endpointUrl }: WebhookFailureEmailProps) {
  return (
    <Html>
      <Head />
      <Tailwind>
        <Body className="bg-gray-50 font-sans">
          <Container className="mx-auto py-10 px-4">
            <Section className="bg-white rounded-2xl shadow-sm p-8 border border-gray-100 mt-8 mx-auto max-w-lg text-center">
              <Img src={LOGO_URL} width="150" height="40" alt="Deliverse Logo" className="mx-auto mb-6" />
              <Heading className="text-2xl font-bold text-gray-900 mb-4">
                Webhook Delivery Failing
              </Heading>
              <Text className="text-base text-gray-600 mb-8 leading-relaxed">
                We've noticed that your webhook endpoint is consistently failing to receive payloads from Deliverse API.
              </Text>
              
              <Section className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 text-left">
                <Text className="text-sm font-semibold text-gray-800 m-0 mb-1">Failing Endpoint:</Text>
                <Text className="text-sm text-gray-700 m-0 font-mono break-all">{endpointUrl}</Text>
              </Section>
              
              <Text className="text-sm text-gray-500 mb-8">
                Please check your server logs and ensure your endpoint is responding with a 2xx status code. If the endpoint continues to fail, it may be automatically disabled.
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
