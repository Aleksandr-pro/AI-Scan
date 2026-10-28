/* eslint-env jest */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('react-native-document-picker', () => ({
  pickSingle: jest.fn(async () => {
    throw { message: 'cancelled' };
  }),
  pick: jest.fn(async () => []),
  isCancel: jest.fn(() => false),
  types: { allFiles: '*/*', images: 'image/*', video: 'video/*', audio: 'audio/*' },
}));

jest.mock('react-native-fs', () => ({
  readFile: jest.fn(async () => ''),
  read: jest.fn(async () => ''),
  stat: jest.fn(async () => ({ size: 0 })),
  unlink: jest.fn(async () => undefined),
  exists: jest.fn(async () => false),
  CachesDirectoryPath: '/cache',
}));
