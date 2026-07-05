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

interface CounterOfferEmailProps {
  userName: string;
  orderNumber: string;
  price: number;
  note?: string;
  operatorName: string;
}

export default function CounterOfferEmail({ userName, orderNumber, price, note, operatorName }: CounterOfferEmailProps) {
  return (
    <Html>
      <Head />
      <Tailwind>
        <Body className="bg-gray-50 font-sans">
          <Container className="mx-auto py-10 px-4">
            <Section className="bg-white rounded-2xl shadow-sm p-8 border border-gray-100 mt-8 mx-auto max-w-lg">
              <Img src={LOGO_URL} width="150" height="40" alt="Deliverse Logo" className="mx-auto mb-6" />
              <Heading className="text-2xl font-bold text-gray-900 mb-4 text-center">
                New Price Offer
              </Heading>
              <Text className="text-base text-gray-600 mb-6 leading-relaxed">
                Hi {userName}, {operatorName} has made a counter-offer for your order (<strong>#{orderNumber.substring(0,8)}</strong>).
              </Text>
              
              <Section className="bg-green-50 rounded-xl p-6 mb-6 text-center border border-green-100">
                <Text className="text-sm font-semibold text-green-900 mb-1 uppercase tracking-wider">Offered Price</Text>
                <Text className="text-3xl font-bold text-green-700 m-0">${price.toFixed(2)}</Text>
              </Section>
              
              {note && (
                <Section className="bg-gray-50 rounded-xl p-4 mb-8 text-left border border-gray-200">
                  <Text className="text-sm font-semibold text-gray-700 mb-1">Message from {operatorName}:</Text>
                  <Text className="text-sm text-gray-600 italic m-0">"{note}"</Text>
                </Section>
              )}
              
              <Text className="text-sm text-gray-500 mb-8">
                Open the Deliverse app to accept or decline this offer.
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
