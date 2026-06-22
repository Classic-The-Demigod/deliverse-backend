import { Test, TestingModule } from '@nestjs/testing';
import { DeliveryStateMachineService } from './delivery-state-machine.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus, Role } from '@prisma/client';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('DeliveryStateMachineService', () => {
  let service: DeliveryStateMachineService;
  let prismaService: PrismaService;

  const mockPrisma = {
    $transaction: jest.fn((callback) => callback(mockPrisma)),
    order: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    orderStatusEvent: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeliveryStateMachineService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<DeliveryStateMachineService>(DeliveryStateMachineService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('canTransition', () => {
    it('should allow CREATED -> ACCEPTED', () => {
      expect(service.canTransition(OrderStatus.CREATED, OrderStatus.ACCEPTED)).toBe(true);
    });

    it('should not allow CREATED -> DELIVERED', () => {
      expect(service.canTransition(OrderStatus.CREATED, OrderStatus.DELIVERED)).toBe(false);
    });

    it('should not allow transitions from terminal states', () => {
      expect(service.canTransition(OrderStatus.DELIVERED, OrderStatus.RETURNED)).toBe(false);
      expect(service.canTransition(OrderStatus.CANCELLED, OrderStatus.CREATED)).toBe(false);
    });
  });

  describe('transitionOrderState', () => {
    const context = { actorId: 'user1', actorRole: Role.OPERATOR };

    it('should throw NotFoundException if order does not exist', async () => {
      mockPrisma.order.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.transitionOrderState('order1', OrderStatus.ACCEPTED, context),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if transition is invalid', async () => {
      mockPrisma.order.findUnique.mockResolvedValueOnce({
        id: 'order1',
        status: OrderStatus.CREATED,
      });

      await expect(
        service.transitionOrderState('order1', OrderStatus.IN_TRANSIT, context),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update order and log event on valid transition', async () => {
      mockPrisma.order.findUnique.mockResolvedValueOnce({
        id: 'order1',
        status: OrderStatus.CREATED,
      });

      mockPrisma.order.update.mockResolvedValueOnce({
        id: 'order1',
        status: OrderStatus.ACCEPTED,
      });

      const result = await service.transitionOrderState(
        'order1',
        OrderStatus.ACCEPTED,
        context,
      );

      expect(mockPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order1' },
          data: expect.objectContaining({
            status: OrderStatus.ACCEPTED,
            acceptedAt: expect.any(Date),
          }),
        }),
      );

      expect(mockPrisma.orderStatusEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orderId: 'order1',
            fromStatus: OrderStatus.CREATED,
            toStatus: OrderStatus.ACCEPTED,
            actorId: 'user1',
            actorRole: Role.OPERATOR,
          }),
        }),
      );

      expect(result.status).toBe(OrderStatus.ACCEPTED);
    });
  });
});
