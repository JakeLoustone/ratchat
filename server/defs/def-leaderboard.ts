import {z} from 'zod';

import {GameIdentitySchema, IdentitySchema} from './def-identity';

export type Leaderboard = PrivateLeaderboard | PublicLeaderboard;

export type PrivateLeaderboard = PrivateOverallLeaderboard | PrivateHorseLeaderboard | PrivateDuelingLeaderboard | PrivateBlackjackLeaderboard | PrivateFishingLeaderboard;
export type PrivateOverallLeaderboard = LeaderboardEntry[];
export type PrivateHorseLeaderboard = HorseEntry[];
export type PrivateDuelingLeaderboard = DuelingEntry[];
export type PrivateBlackjackLeaderboard = BlackjackEntry[];
export type PrivateFishingLeaderboard = FishingEntry[];

export type PublicLeaderboard = PublicOverallLeaderboard | PublicHorseLeaderboard | PublicDuelingLeaderboard | PublicBlackjackLeaderboard | PublicFishingLeaderboard;
export type PublicOverallLeaderboard = PublicLeaderboardEntry[];
export type PublicHorseLeaderboard = PublicHorseEntry[];
export type PublicDuelingLeaderboard = PublicDuelingEntry[];
export type PublicBlackjackLeaderboard = PublicBlackjackEntry[];
export type PublicFishingLeaderboard = PublicFishingEntry[];

const LeaderboardIdentityEntrySchema = z.object({}).extend({
	playerid: GameIdentitySchema.shape.playerid,
	fullnick: IdentitySchema.shape.fullnick,
});

export type LeaderboardEntry = z.infer<typeof LeaderboardEntrySchema>;
export type PublicLeaderboardEntry = Omit<LeaderboardEntry, 'playerid'>;
export const LeaderboardEntrySchema = LeaderboardIdentityEntrySchema.extend({
	gamePoints: GameIdentitySchema.shape.gamePoints
});

export type HorseEntry = z.infer<typeof HorseEntrySchema>;
export type PublicHorseEntry = Omit<HorseEntry, 'playerid'>;
export const HorseEntrySchema = LeaderboardIdentityEntrySchema.extend({
	horseWinnings: GameIdentitySchema.shape.horseWinnings,
	horseBetWins: GameIdentitySchema.shape.horseBetWins
});

export type DuelingEntry = z.infer<typeof DuelingEntrySchema>;
export type PublicDuelingEntry = Omit<DuelingEntry, 'playerid'>;
export const DuelingEntrySchema = LeaderboardIdentityEntrySchema.extend({
	duelingWins: GameIdentitySchema.shape.duelingWins,
	duelingHonor: GameIdentitySchema.shape.duelingHonor
});

export type BlackjackEntry = z.infer<typeof BlackjackEntrySchema>;
export type PublicBlackjackEntry = Omit<BlackjackEntry, 'playerid'>;
export const BlackjackEntrySchema = LeaderboardIdentityEntrySchema.extend({
	blackjackWinnings: GameIdentitySchema.shape.blackjackWinnings,
	blackjackBlackjacks: GameIdentitySchema.shape.blackjackBlackjacks
});

export type FishingEntry = z.infer<typeof FishingEntrySchema>;
export type PublicFishingEntry = Omit<FishingEntry, 'playerid'>;
export const FishingEntrySchema = LeaderboardIdentityEntrySchema.extend({
	fishingCatches: GameIdentitySchema.shape.fishingCatches,
	fishingTypesCaught: z.number().int().min(0),
	fishingWinnings: GameIdentitySchema.shape.fishingWinnings,
	fishingBestCatchValue: GameIdentitySchema.shape.fishingBestCatchValue,
	fishingRecords: z.number().int().min(0)
});
