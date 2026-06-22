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
  Button,
} from '@react-email/components';

interface DriverAssignedEmailProps {
  driverName: string;
  orderNumber: string;
  pickupAddress: string;
  dropoffAddress: string;
}

export default function DriverAssignedEmail({ driverName, orderNumber, pickupAddress, dropoffAddress }: DriverAssignedEmailProps) {
  return (
    <Html>
      <Head />
      <Tailwind>
        <Body className="bg-gray-50 font-sans">
          <Container className="mx-auto py-10 px-4">
            <Section className="bg-white rounded-2xl shadow-sm p-8 border border-gray-100 mt-8 mx-auto max-w-lg text-center">
              <Img 
                src="https://deliverse.app/logo-dark.png" 
                alt="Deliverse" 
                className="w-32 mx-auto mb-8"
              />
              <Heading className="text-2xl font-bold text-gray-900 mb-4">
                New Delivery Assigned!
              </Heading>
              <Text className="text-base text-gray-600 mb-6 leading-relaxed">
                Hi {driverName}, you have been assigned to a new delivery order (<strong>#{orderNumber.substring(0,8)}</strong>).
              </Text>
              
              <Section className="bg-blue-50 rounded-xl p-6 mb-8 text-left border border-blue-100">
                <Text className="text-sm font-semibold text-blue-900 mb-1 uppercase tracking-wider">Pickup</Text>
                <Text className="text-base text-blue-800 mb-4">{pickupAddress}</Text>
                
                <Text className="text-sm font-semibold text-blue-900 mb-1 uppercase tracking-wider">Dropoff</Text>
                <Text className="text-base text-blue-800 m-0">{dropoffAddress}</Text>
              </Section>
              
              <Text className="text-sm text-gray-500 mb-8">
                Please open the Deliverse Driver app to view full details and begin navigation.
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
