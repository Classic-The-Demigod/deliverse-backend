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

interface DriverInvitationEmailProps {
  operatorName: string;
  inviteToken: string;
}

export default function DriverInvitationEmail({ operatorName, inviteToken }: DriverInvitationEmailProps) {
  const inviteLink = `deliverse://invite?token=${inviteToken}`;

  return (
    <Html>
      <Head />
      <Tailwind>
        <Body className="bg-gray-50 font-sans">
          <Container className="mx-auto py-10 px-4">
            <Section className="bg-white rounded-2xl shadow-sm p-8 border border-gray-100 mt-8 mx-auto max-w-lg text-center">
              <Img src={LOGO_URL} width="150" height="40" alt="Deliverse Logo" className="mx-auto mb-6" />
              <Heading className="text-2xl font-bold text-gray-900 mb-4">
                You've been invited to drive!
              </Heading>
              <Text className="text-base text-gray-600 mb-8 leading-relaxed">
                {operatorName} has invited you to join their fleet on Deliverse. 
                As part of their fleet, you'll receive delivery assignments directly from them.
              </Text>
              
              <Section className="mb-8">
                <Button 
                  href={inviteLink}
                  className="bg-blue-600 text-white font-bold py-3 px-6 rounded-lg text-center w-full block"
                >
                  Accept Invitation
                </Button>
              </Section>
              
              <Text className="text-sm text-gray-500 mb-8">
                If the button doesn't work, you can enter this code in the app manually:
                <br /><br />
                <strong className="text-xl tracking-widest text-gray-900">{inviteToken.substring(0, 8).toUpperCase()}</strong>
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
