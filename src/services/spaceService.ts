import { Space } from '../types/note';
import { INITIAL_SPACES } from '../data/spaces';

class SpaceService {
  private spaces: Space[] = [...INITIAL_SPACES];

  async getSpaces(): Promise<Space[]> {
    return [...this.spaces];
  }

  async getSpaceById(id: string): Promise<Space | null> {
    const found = this.spaces.find(s => s.id === id);
    return found ? { ...found } : null;
  }

  async createSpace(payload: Omit<Space, 'id' | 'noteCount'>): Promise<Space> {
    const newSpace: Space = {
      ...payload,
      id: payload.name.toLowerCase().replace(/\s+/g, '-'),
      noteCount: 0,
    };
    this.spaces.push(newSpace);
    return newSpace;
  }
}

export const spaceService = new SpaceService();
