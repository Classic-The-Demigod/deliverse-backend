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
  Button,
  Img,
} from '@react-email/components';

const LOGO_URL = 'https://via.placeholder.com/150x40/111827/ffffff?text=DELIVERSE';

interface PasswordResetEmailProps {
  code: string;
}

export default function PasswordResetEmail({ code }: PasswordResetEmailProps) {
  return (
    <Html>
      <Head />
      <Tailwind>
        <Body className="bg-gray-50 font-sans">
          <Container className="mx-auto py-10 px-4">
            <Section className="bg-white rounded-2xl shadow-sm p-8 border border-gray-100 mt-8 mx-auto max-w-lg text-center">
              <Img src={LOGO_URL} width="150" height="40" alt="Deliverse Logo" className="mx-auto mb-6" />
              <Heading className="text-2xl font-bold text-gray-900 mb-4">
                Reset Your Password
              </Heading>
              <Text className="text-base text-gray-600 mb-8 leading-relaxed">
                We received a request to reset your Deliverse password. Please use the code below to securely reset your password.
              </Text>
              
              <Section className="bg-gray-50 rounded-xl p-6 mb-8 inline-block w-full">
                <Text className="text-4xl font-bold tracking-[0.25em] text-gray-900 text-center m-0">
                  {code}
                </Text>
              </Section>
              
              <Text className="text-sm text-gray-500 mb-8">
                This code will expire in 5 minutes. If you did not request a password reset, you can safely ignore this email and your password will remain unchanged.
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
