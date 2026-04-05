import { Leftover } from '../types/Leftover';
import {
  recordLeftover,
  getActiveLeftovers,
  consumeLeftover,
  expireStaleLeftovers,
} from '../services/leftoverService';

// ---------------------------------------------------------------------------
// Mock AsyncStorage
// ---------------------------------------------------------------------------
let storageMap: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(storageMap[key] ?? null)),
  setItem: jest.fn((key: string, value: string) => {
    storageMap[key] = value;
    return Promise.resolve();
  }),
}));

// Stub Firebase modules so the service module loads without native bindings
const mockFirestoreSet = jest.fn().mockResolvedValue(undefined);
const mockFirestoreUpdate = jest.fn().mockResolvedValue(undefined);

jest.mock('@react-native-firebase/firestore', () => {
  const mockFirestore: Record<string, unknown> = {
    __esModule: true,
    default: () => ({
      collection: () => ({
        doc: () => ({
          collection: () => ({
            doc: () => ({
              set: mockFirestoreSet,
              update: mockFirestoreUpdate,
            }),
          }),
        }),
      }),
    }),
  };
  mockFirestore.FirebaseFirestoreTypes = {};
  (mockFirestore.default as Record<string, unknown>).FieldValue = {
    serverTimestamp: () => 'mock-timestamp',
  };
  return mockFirestore;
});

let mockCurrentUser: { uid: string } | null = null;

jest.mock('@react-native-firebase/auth', () => ({
  __esModule: true,
  default: () => ({ get currentUser() { return mockCurrentUser; } }),
}));

jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return formatLocalDate(d);
}

function todayISO(): string {
  return formatLocalDate(new Date());
}

function makeLeftover(overrides: Partial<Leftover> = {}): Leftover {
  return {
    id: 'test-id',
    recipeId: 'recipe-1',
    recipeName: 'Pasta',
    originalServings: 4,
    remainingServings: 2,
    cookedDate: todayISO(),
    estimatedExpiryDate: daysFromNow(3),
    mealType: 'dinner',
    status: 'available',
    ...overrides,
  };
}

function seedStorage(leftovers: Leftover[]): void {
  storageMap['@leftovers'] = JSON.stringify(leftovers);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
beforeEach(() => {
  storageMap = {};
  mockCurrentUser = null;
  jest.clearAllMocks();
});

describe('recordLeftover', () => {

  it('creates a leftover with correct remaining servings', async () => {
    const result = await recordLeftover('r1', 'Tacos', 6, 2, 'dinner');

    expect(result).not.toBeNull();
    expect(result!.recipeId).toBe('r1');
    expect(result!.recipeName).toBe('Tacos');
    expect(result!.originalServings).toBe(6);
    expect(result!.remainingServings).toBe(4);
    expect(result!.mealType).toBe('dinner');
    expect(result!.status).toBe('available');
    expect(result!.cookedDate).toBe(todayISO());
    expect(result!.estimatedExpiryDate).toBe(daysFromNow(3));
  });

  it('returns null when all portions are eaten', async () => {
    const result = await recordLeftover('r1', 'Tacos', 4, 4, 'lunch');

    expect(result).toBeNull();
  });

  it('returns null when more portions eaten than original servings', async () => {
    const result = await recordLeftover('r1', 'Tacos', 3, 5, 'lunch');

    expect(result).toBeNull();
  });

  it('persists the leftover to storage', async () => {
    await recordLeftover('r1', 'Soup', 4, 1, 'dinner');

    const stored = JSON.parse(storageMap['@leftovers']) as Leftover[];

    expect(stored).toHaveLength(1);
    expect(stored[0].recipeName).toBe('Soup');
    expect(stored[0].remainingServings).toBe(3);
  });

  it('appends to existing leftovers', async () => {
    seedStorage([makeLeftover({ id: 'existing' })]);

    await recordLeftover('r2', 'Rice', 3, 1, 'lunch');

    const stored = JSON.parse(storageMap['@leftovers']) as Leftover[];

    expect(stored).toHaveLength(2);
    expect(stored[0].id).toBe('existing');
    expect(stored[1].recipeName).toBe('Rice');
  });

  it('returns null when originalServings is zero', async () => {
    const result = await recordLeftover('r1', 'Tacos', 0, 0, 'dinner');

    expect(result).toBeNull();
  });

  it('returns null when originalServings is negative', async () => {
    const result = await recordLeftover('r1', 'Tacos', -2, 0, 'dinner');

    expect(result).toBeNull();
  });

  it('returns null when portionsEaten is negative', async () => {
    const result = await recordLeftover('r1', 'Tacos', 4, -1, 'dinner');

    expect(result).toBeNull();
  });

  it('writes to Firestore when user is authenticated', async () => {
    mockCurrentUser = { uid: 'test-user' };

    await recordLeftover('r1', 'Tacos', 6, 2, 'dinner');

    expect(mockFirestoreSet).toHaveBeenCalledTimes(1);
    expect(mockFirestoreSet).toHaveBeenCalledWith(
      expect.objectContaining({
        recipeId: 'r1',
        recipeName: 'Tacos',
        originalServings: 6,
        remainingServings: 4,
        mealType: 'dinner',
        status: 'available',
        createdAt: 'mock-timestamp',
        updatedAt: 'mock-timestamp',
      }),
    );
  });
});

describe('getActiveLeftovers', () => {

  it('returns only available leftovers', async () => {
    seedStorage([
      makeLeftover({ id: '1', status: 'available' }),
      makeLeftover({ id: '2', status: 'used' }),
      makeLeftover({ id: '3', status: 'expired' }),
    ]);

    const result = await getActiveLeftovers();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('filters out leftovers past their expiry date', async () => {
    seedStorage([
      makeLeftover({ id: '1', estimatedExpiryDate: daysFromNow(2) }),
      makeLeftover({ id: '2', estimatedExpiryDate: daysFromNow(-1) }),
    ]);

    const result = await getActiveLeftovers();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('returns empty array when no leftovers exist', async () => {
    const result = await getActiveLeftovers();

    expect(result).toEqual([]);
  });
});

describe('consumeLeftover', () => {

  it('decrements remaining servings', async () => {
    seedStorage([makeLeftover({ id: 'c1', remainingServings: 3 })]);

    await consumeLeftover('c1', 1);

    const stored = JSON.parse(storageMap['@leftovers']) as Leftover[];

    expect(stored[0].remainingServings).toBe(2);
    expect(stored[0].status).toBe('available');
  });

  it('marks status as used when remaining reaches zero', async () => {
    seedStorage([makeLeftover({ id: 'c1', remainingServings: 2 })]);

    await consumeLeftover('c1', 2);

    const stored = JSON.parse(storageMap['@leftovers']) as Leftover[];

    expect(stored[0].remainingServings).toBe(0);
    expect(stored[0].status).toBe('used');
  });

  it('marks status as used when consuming more than remaining', async () => {
    seedStorage([makeLeftover({ id: 'c1', remainingServings: 1 })]);

    await consumeLeftover('c1', 5);

    const stored = JSON.parse(storageMap['@leftovers']) as Leftover[];

    expect(stored[0].remainingServings).toBe(0);
    expect(stored[0].status).toBe('used');
  });

  it('does nothing for a non-existent leftover id', async () => {
    seedStorage([makeLeftover({ id: 'c1', remainingServings: 3 })]);

    await consumeLeftover('non-existent', 1);

    const stored = JSON.parse(storageMap['@leftovers']) as Leftover[];

    expect(stored[0].remainingServings).toBe(3);
  });

  it('does nothing when portions is zero', async () => {
    seedStorage([makeLeftover({ id: 'c1', remainingServings: 3 })]);

    await consumeLeftover('c1', 0);

    const stored = JSON.parse(storageMap['@leftovers']) as Leftover[];

    expect(stored[0].remainingServings).toBe(3);
  });

  it('does nothing when portions is negative', async () => {
    seedStorage([makeLeftover({ id: 'c1', remainingServings: 3 })]);

    await consumeLeftover('c1', -2);

    const stored = JSON.parse(storageMap['@leftovers']) as Leftover[];

    expect(stored[0].remainingServings).toBe(3);
  });
});

describe('expireStaleLeftovers', () => {

  it('marks past-expiry leftovers as expired', async () => {
    seedStorage([
      makeLeftover({ id: 'e1', estimatedExpiryDate: daysFromNow(-1), status: 'available' }),
      makeLeftover({ id: 'e2', estimatedExpiryDate: daysFromNow(-3), status: 'available' }),
    ]);

    await expireStaleLeftovers();

    const stored = JSON.parse(storageMap['@leftovers']) as Leftover[];

    expect(stored[0].status).toBe('expired');
    expect(stored[1].status).toBe('expired');
  });

  it('does not change leftovers that are not yet expired', async () => {
    seedStorage([
      makeLeftover({ id: 'e1', estimatedExpiryDate: daysFromNow(2), status: 'available' }),
    ]);

    await expireStaleLeftovers();

    const stored = JSON.parse(storageMap['@leftovers']) as Leftover[];

    expect(stored[0].status).toBe('available');
  });

  it('does not re-expire already used leftovers', async () => {
    seedStorage([
      makeLeftover({ id: 'e1', estimatedExpiryDate: daysFromNow(-1), status: 'used' }),
    ]);

    await expireStaleLeftovers();

    const stored = JSON.parse(storageMap['@leftovers']) as Leftover[];

    expect(stored[0].status).toBe('used');
  });

  it('handles empty storage gracefully', async () => {
    await expireStaleLeftovers();

    const stored = JSON.parse(storageMap['@leftovers']) as Leftover[];

    expect(stored).toEqual([]);
  });
});
