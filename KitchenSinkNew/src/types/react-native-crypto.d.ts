declare module 'react-native-crypto' {
  export function createHash(algorithm: string): {
    update(data: string): {
      digest(encoding: string): string;
    };
  };
} 