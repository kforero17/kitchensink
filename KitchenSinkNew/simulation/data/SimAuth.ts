import * as admin from 'firebase-admin';

interface SimulationProfileRef {
  id: string;
  name: string;
}

export class SimAuth {
  private auth: admin.auth.Auth;

  constructor(app: admin.app.App) {
    this.auth = app.auth();
  }

  async createUser(profile: SimulationProfileRef): Promise<string> {
    const userRecord = await this.auth.createUser({
      displayName: profile.name,
      email: `${profile.id}@simulation.local`,
      password: 'sim-password-123',
    });
    return userRecord.uid;
  }

  async deleteUser(uid: string): Promise<void> {
    try {
      await this.auth.deleteUser(uid);
    } catch (err: any) {
      if (err.code !== 'auth/user-not-found') throw err;
    }
  }

  async deleteAllUsers(): Promise<void> {
    const listResult = await this.auth.listUsers(1000);
    const uids = listResult.users.map(u => u.uid);
    if (uids.length > 0) {
      await this.auth.deleteUsers(uids);
    }
  }
}
