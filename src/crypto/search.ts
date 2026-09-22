/**
 * Phase 1 Crypto Boundary - Encrypted Search (Blind Indexing) Contract
 */

export interface BlindIndexToken {
  hash: string;
  bloomFilterBit?: number;
}

export interface EncryptedSearchQuery {
  trapdoors: string[];
  scopeSpaceId?: string;
}

export interface IEncryptedSearchService {
  /**
   * Generates blind index trapdoors for client-side search without leaking plaintext terms.
   */
  generateTrapdoors(queryTerms: string[], searchKey: CryptoKey): Promise<EncryptedSearchQuery>;

  /**
   * Builds an encrypted blind index token for note tokens on write.
   */
  indexToken(term: string, searchKey: CryptoKey): Promise<BlindIndexToken>;
}
