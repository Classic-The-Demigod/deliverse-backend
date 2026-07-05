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

interface AccountRejectionEmailProps {
  name: string;
  role: string;
  reason: string;
}

export default function AccountRejectionEmail({ name, role, reason }: AccountRejectionEmailProps) {
  return (
    <Html>
      <Head />
      <Tailwind>
        <Body className="bg-gray-50 font-sans">
          <Container className="mx-auto py-10 px-4">
            <Section className="bg-white rounded-2xl shadow-sm p-8 border border-gray-100 mt-8 mx-auto max-w-lg text-center">
              <Img src={LOGO_URL} width="150" height="40" alt="Deliverse Logo" className="mx-auto mb-6" />
              <Heading className="text-2xl font-bold text-red-600 mb-4">
                Action Required
              </Heading>
              <Text className="text-base text-gray-600 mb-4 leading-relaxed">
                Hi {name}, we have reviewed your onboarding application for your {role} account, and unfortunately, we cannot approve it at this time.
              </Text>
              
              <Section className="bg-red-50 border border-red-100 rounded-lg p-4 mb-8 text-left">
                <Text className="text-sm font-semibold text-red-800 m-0 mb-1">Reason for Rejection:</Text>
                <Text className="text-sm text-red-700 m-0">{reason}</Text>
              </Section>
              
              <Text className="text-base text-gray-600 mb-8 leading-relaxed">
                Please update your documents in the dashboard and resubmit your application.
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
