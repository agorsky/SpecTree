import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the db module
vi.mock('../../src/lib/db.js', () => ({
  prisma: {
    epicRequest: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    personalScope: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    epicRequestReaction: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    epicRequestComment: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { prisma } from '../../src/lib/db.js';
import {
  createEpicRequest,
  listEpicRequests,
  getEpicRequestById,
  transferEpicRequestScope,
} from '../../src/services/epicRequestService.js';

describe('epicRequestService - Personal Scope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==================== createEpicRequest ====================

  describe('createEpicRequest', () => {
    it('should auto-approve when personalScopeId is provided', async () => {
      const mockCreated = {
        id: 'req-1',
        title: 'Personal Request',
        description: null,
        structuredDesc: null,
        status: 'approved',
        requestedById: 'user-1',
        personalScopeId: 'scope-1',
        convertedEpicId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.mocked(prisma.epicRequest.create).mockResolvedValue(mockCreated as any);

      const result = await createEpicRequest(
        { title: 'Personal Request', personalScopeId: 'scope-1' },
        'user-1'
      );

      expect(result.status).toBe('approved');
      expect(prisma.epicRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'Personal Request',
          requestedById: 'user-1',
          personalScopeId: 'scope-1',
          status: 'approved',
        }),
      });
    });

    it('should default to pending status when personalScopeId is not provided', async () => {
      const mockCreated = {
        id: 'req-2',
        title: 'Team Request',
        description: null,
        structuredDesc: null,
        status: 'pending',
        requestedById: 'user-1',
        personalScopeId: null,
        convertedEpicId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.mocked(prisma.epicRequest.create).mockResolvedValue(mockCreated as any);

      const result = await createEpicRequest(
        { title: 'Team Request' },
        'user-1'
      );

      expect(result.status).toBe('pending');
      // Verify personalScopeId and status are NOT in the data
      expect(prisma.epicRequest.create).toHaveBeenCalledWith({
        data: {
          title: 'Team Request',
          requestedById: 'user-1',
        },
      });
    });

    it('should include description and structuredDesc with personalScopeId', async () => {
      const mockCreated = {
        id: 'req-3',
        title: 'Full Personal Request',
        description: 'A description',
        structuredDesc: '{"problemStatement":"test","proposedSolution":"test","impactAssessment":"test"}',
        status: 'approved',
        requestedById: 'user-1',
        personalScopeId: 'scope-1',
        convertedEpicId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.mocked(prisma.epicRequest.create).mockResolvedValue(mockCreated as any);

      const result = await createEpicRequest(
        {
          title: 'Full Personal Request',
          description: 'A description',
          structuredDesc: {
            problemStatement: 'test',
            proposedSolution: 'test',
            impactAssessment: 'test',
          },
          personalScopeId: 'scope-1',
        },
        'user-1'
      );

      expect(result.status).toBe('approved');
      expect(prisma.epicRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'Full Personal Request',
          description: 'A description',
          personalScopeId: 'scope-1',
          status: 'approved',
        }),
      });
    });
  });

  // ==================== listEpicRequests ====================

  describe('listEpicRequests', () => {
    const makeRequest = (overrides: Record<string, any> = {}) => ({
      id: 'req-1',
      title: 'Test Request',
      description: null,
      structuredDesc: null,
      status: 'pending',
      requestedById: 'user-1',
      personalScopeId: null,
      convertedEpicId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      reactions: [],
      requestedBy: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
      ...overrides,
    });

    it('should include team/global requests for all users', async () => {
      const teamRequest = makeRequest({ id: 'team-req', personalScopeId: null });
      vi.mocked(prisma.personalScope.findUnique).mockResolvedValue({ id: 'scope-1', userId: 'user-1' } as any);
      vi.mocked(prisma.epicRequest.findMany).mockResolvedValue([teamRequest] as any);

      const result = await listEpicRequests({}, 'user-1');

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('team-req');
    });

    it('should include personal requests owned by the calling user', async () => {
      const personalRequest = makeRequest({ id: 'personal-req', personalScopeId: 'scope-1' });
      vi.mocked(prisma.personalScope.findUnique).mockResolvedValue({ id: 'scope-1', userId: 'user-1' } as any);
      vi.mocked(prisma.epicRequest.findMany).mockResolvedValue([personalRequest] as any);

      const result = await listEpicRequests({}, 'user-1');

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('personal-req');
    });

    it('should filter with OR clause when user has a personal scope', async () => {
      vi.mocked(prisma.personalScope.findUnique).mockResolvedValue({ id: 'scope-1', userId: 'user-1' } as any);
      vi.mocked(prisma.epicRequest.findMany).mockResolvedValue([]);

      await listEpicRequests({}, 'user-1');

      // Verify the where clause includes OR condition
      expect(prisma.epicRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { personalScopeId: null },
              { personalScopeId: 'scope-1' },
            ],
          }),
        })
      );
    });

    it('should only show non-personal requests when user has no personal scope', async () => {
      vi.mocked(prisma.personalScope.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.epicRequest.findMany).mockResolvedValue([]);

      await listEpicRequests({}, 'user-2');

      // Verify the where clause filters to only null personalScopeId
      expect(prisma.epicRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            personalScopeId: null,
          }),
        })
      );
    });

    it('should not apply visibility filtering when userId is not provided', async () => {
      vi.mocked(prisma.epicRequest.findMany).mockResolvedValue([]);

      await listEpicRequests({});

      // Verify no personalScope lookup was made
      expect(prisma.personalScope.findUnique).not.toHaveBeenCalled();
      // Verify no OR/personalScopeId filtering
      expect(prisma.epicRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        })
      );
    });
  });

  // ==================== getEpicRequestById ====================

  describe('getEpicRequestById', () => {
    const makeRequest = (overrides: Record<string, any> = {}) => ({
      id: 'req-1',
      title: 'Test Request',
      description: null,
      structuredDesc: null,
      status: 'pending',
      requestedById: 'user-1',
      personalScopeId: null,
      convertedEpicId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      reactions: [],
      requestedBy: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
      personalScope: null,
      ...overrides,
    });

    it('should return a non-personal request for any user', async () => {
      const teamRequest = makeRequest({ personalScopeId: null, personalScope: null });
      vi.mocked(prisma.epicRequest.findUnique).mockResolvedValue(teamRequest as any);

      const result = await getEpicRequestById('req-1', 'any-user');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('req-1');
    });

    it('should return a personal request when called by the owner', async () => {
      const personalRequest = makeRequest({
        id: 'personal-req',
        personalScopeId: 'scope-1',
        personalScope: { userId: 'user-1' },
      });
      vi.mocked(prisma.epicRequest.findUnique).mockResolvedValue(personalRequest as any);

      const result = await getEpicRequestById('personal-req', 'user-1');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('personal-req');
    });

    it('should return null for a personal request when called by a non-owner', async () => {
      const personalRequest = makeRequest({
        id: 'personal-req',
        personalScopeId: 'scope-1',
        personalScope: { userId: 'user-1' },
      });
      vi.mocked(prisma.epicRequest.findUnique).mockResolvedValue(personalRequest as any);

      const result = await getEpicRequestById('personal-req', 'user-2');

      expect(result).toBeNull();
    });

    it('should return null for a personal request when no userId is provided', async () => {
      const personalRequest = makeRequest({
        id: 'personal-req',
        personalScopeId: 'scope-1',
        personalScope: { userId: 'user-1' },
      });
      vi.mocked(prisma.epicRequest.findUnique).mockResolvedValue(personalRequest as any);

      const result = await getEpicRequestById('personal-req');

      expect(result).toBeNull();
    });

    it('should return null when the request does not exist', async () => {
      vi.mocked(prisma.epicRequest.findUnique).mockResolvedValue(null);

      const result = await getEpicRequestById('nonexistent', 'user-1');

      expect(result).toBeNull();
    });

    it('should include personalScope in the query', async () => {
      vi.mocked(prisma.epicRequest.findUnique).mockResolvedValue(null);

      await getEpicRequestById('req-1', 'user-1');

      expect(prisma.epicRequest.findUnique).toHaveBeenCalledWith({
        where: { id: 'req-1' },
        include: expect.objectContaining({
          personalScope: {
            select: { userId: true },
          },
        }),
      });
    });
  });

  // ==================== transferEpicRequestScope ====================

  describe('transferEpicRequestScope', () => {
    const makeRequest = (overrides: Record<string, any> = {}) => ({
      id: 'req-1',
      title: 'Test Request',
      description: null,
      structuredDesc: null,
      status: 'approved',
      requestedById: 'user-1',
      personalScopeId: 'scope-1',
      convertedEpicId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    });

    it('should transfer personal→team: clears personalScopeId and sets status to pending', async () => {
      const personalRequest = makeRequest({ personalScopeId: 'scope-1', status: 'approved' });
      vi.mocked(prisma.epicRequest.findUnique).mockResolvedValue(personalRequest as any);

      const updatedRequest = makeRequest({ personalScopeId: null, status: 'pending' });
      vi.mocked(prisma.epicRequest.update).mockResolvedValue(updatedRequest as any);

      const result = await transferEpicRequestScope('req-1', 'user-1', 'personal-to-team');

      expect(result.personalScopeId).toBeNull();
      expect(result.status).toBe('pending');
      expect(prisma.epicRequest.update).toHaveBeenCalledWith({
        where: { id: 'req-1' },
        data: {
          personalScopeId: null,
          status: 'pending',
        },
      });
    });

    it('should transfer team→personal: sets personalScopeId and auto-approves', async () => {
      const teamRequest = makeRequest({ personalScopeId: null, status: 'pending' });
      vi.mocked(prisma.epicRequest.findUnique).mockResolvedValue(teamRequest as any);
      vi.mocked(prisma.personalScope.findUnique).mockResolvedValue({ id: 'scope-1', userId: 'user-1' } as any);

      const updatedRequest = makeRequest({ personalScopeId: 'scope-1', status: 'approved' });
      vi.mocked(prisma.epicRequest.update).mockResolvedValue(updatedRequest as any);

      const result = await transferEpicRequestScope('req-1', 'user-1', 'team-to-personal');

      expect(result.personalScopeId).toBe('scope-1');
      expect(result.status).toBe('approved');
      expect(prisma.epicRequest.update).toHaveBeenCalledWith({
        where: { id: 'req-1' },
        data: {
          personalScopeId: 'scope-1',
          status: 'approved',
        },
      });
    });

    it('should transfer rejected→personal: sets status to approved', async () => {
      const rejectedRequest = makeRequest({ personalScopeId: null, status: 'rejected' });
      vi.mocked(prisma.epicRequest.findUnique).mockResolvedValue(rejectedRequest as any);
      vi.mocked(prisma.personalScope.findUnique).mockResolvedValue({ id: 'scope-1', userId: 'user-1' } as any);

      const updatedRequest = makeRequest({ personalScopeId: 'scope-1', status: 'approved' });
      vi.mocked(prisma.epicRequest.update).mockResolvedValue(updatedRequest as any);

      const result = await transferEpicRequestScope('req-1', 'user-1', 'team-to-personal');

      expect(result.status).toBe('approved');
    });

    it('should throw ValidationError when transferring a converted request', async () => {
      const convertedRequest = makeRequest({ personalScopeId: null, status: 'converted' });
      vi.mocked(prisma.epicRequest.findUnique).mockResolvedValue(convertedRequest as any);

      await expect(
        transferEpicRequestScope('req-1', 'user-1', 'team-to-personal')
      ).rejects.toThrow('Cannot transfer a converted epic request');
    });

    it('should throw ValidationError when transferring personal→team but request is not in personal scope', async () => {
      const teamRequest = makeRequest({ personalScopeId: null, status: 'pending' });
      vi.mocked(prisma.epicRequest.findUnique).mockResolvedValue(teamRequest as any);

      await expect(
        transferEpicRequestScope('req-1', 'user-1', 'personal-to-team')
      ).rejects.toThrow('Epic request is not in a personal scope');
    });

    it('should throw ValidationError when transferring team→personal but request is already in personal scope', async () => {
      const personalRequest = makeRequest({ personalScopeId: 'scope-1', status: 'approved' });
      vi.mocked(prisma.epicRequest.findUnique).mockResolvedValue(personalRequest as any);

      await expect(
        transferEpicRequestScope('req-1', 'user-1', 'team-to-personal')
      ).rejects.toThrow('Epic request is already in a personal scope');
    });

    it('should throw ForbiddenError when non-creator tries to transfer', async () => {
      const request = makeRequest({ requestedById: 'other-user' });
      vi.mocked(prisma.epicRequest.findUnique).mockResolvedValue(request as any);

      await expect(
        transferEpicRequestScope('req-1', 'user-1', 'personal-to-team')
      ).rejects.toThrow('Only the creator can transfer this epic request');
    });

    it('should throw NotFoundError when request does not exist', async () => {
      vi.mocked(prisma.epicRequest.findUnique).mockResolvedValue(null);

      await expect(
        transferEpicRequestScope('req-1', 'user-1', 'personal-to-team')
      ).rejects.toThrow("Epic request with id 'req-1' not found");
    });

    it('should lazily create personal scope when user has none for team→personal', async () => {
      const teamRequest = makeRequest({ personalScopeId: null, status: 'pending' });
      vi.mocked(prisma.epicRequest.findUnique).mockResolvedValue(teamRequest as any);
      vi.mocked(prisma.personalScope.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.personalScope.create).mockResolvedValue({ id: 'new-scope-1', userId: 'user-1' } as any);

      const updatedRequest = makeRequest({ personalScopeId: 'new-scope-1', status: 'approved' });
      vi.mocked(prisma.epicRequest.update).mockResolvedValue(updatedRequest as any);

      const result = await transferEpicRequestScope('req-1', 'user-1', 'team-to-personal');

      expect(prisma.personalScope.create).toHaveBeenCalledWith({
        data: { userId: 'user-1' },
        select: { id: true },
      });
      expect(result.personalScopeId).toBe('new-scope-1');
      expect(result.status).toBe('approved');
    });
  });
});
