import api from '../lib/api';

// Friends
export const sendFriendRequest = (identifier: string) =>
  api.post('/social/friends', { identifier }).then(({ data }) => data);

export const respondFriendRequest = (id: string, accept: boolean) =>
  api.patch(`/social/friends/${id}`, { accept }).then(({ data }) => data);

export const getFriends = (): Promise<unknown[]> =>
  api.get('/social/friends').then(({ data }) => data);

export const getPendingRequests = (): Promise<unknown[]> =>
  api.get('/social/friends/pending').then(({ data }) => data);

export const removeFriend = (id: string) => api.delete(`/social/friends/${id}`);

export const getPublicProfile = (username: string): Promise<unknown> =>
  api.get(`/social/profile/${username}`).then(({ data }) => data);

// Leaderboard
export const getLeaderboard = (category = 'xp', friendsOnly = false): Promise<unknown[]> =>
  api.get('/social/leaderboard', { params: { category, friendsOnly } }).then(({ data }) => data);

// Challenges
export const getChallenges = (): Promise<unknown[]> =>
  api.get('/social/challenges').then(({ data }) => data);

export const createChallenge = (data: unknown): Promise<unknown> =>
  api.post('/social/challenges', data).then(({ data: d }) => d);

export const joinChallenge = (id: string): Promise<unknown> =>
  api.post(`/social/challenges/${id}/join`).then(({ data }) => data);

// Guild
export const getMyGuild = (): Promise<unknown> =>
  api.get('/social/guilds/mine').then(({ data }) => data);

export const createGuild = (data: unknown): Promise<unknown> =>
  api.post('/social/guilds', data).then(({ data: d }) => d);

/** Cambia o quita (null) la foto del gremio. Solo quien lo lidera. */
export const updateGuild = (guildId: string, data: { photoUrl: string | null }): Promise<{ id: string; photoUrl: string | null }> =>
  api.patch(`/social/guilds/${guildId}`, data).then(({ data: d }) => d);

export const joinGuild = (inviteCode: string): Promise<unknown> =>
  api.post('/social/guilds/join', { inviteCode }).then(({ data }) => data);

export const getGuildMessages = (guildId: string): Promise<unknown[]> =>
  api.get(`/social/guilds/${guildId}/messages`).then(({ data }) => data);

export const postGuildMessage = (guildId: string, content: string): Promise<unknown> =>
  api.post(`/social/guilds/${guildId}/messages`, { content }).then(({ data }) => data);

export const leaveGuild = (guildId: string) =>
  api.delete(`/social/guilds/${guildId}/leave`);
