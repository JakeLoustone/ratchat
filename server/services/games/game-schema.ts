import { z } from "zod";

const RecordIdentityEntrySchema = z.object({
	guid: z.string(),
	name: z.string(),
});
type RecordIdentityEntry = z.infer<typeof RecordIdentityEntrySchema>;

export const LeaderboardEntrySchema = z.object({
	...RecordIdentityEntrySchema.shape,
	points: z.number(),
});
export type LeaderboardEntry = z.infer<typeof LeaderboardEntrySchema>;
export const BlackjackEntrySchema = z.object({
	...RecordIdentityEntrySchema.shape,
	winnings: z.number(),
	blackjacks: z.number(),
});
export type BlackjackEntry = z.infer<typeof BlackjackEntrySchema>;
export const DuelingEntrySchema = z.object({
	...RecordIdentityEntrySchema.shape,
	wins: z.number(),
	honor: z.number().optional(),
});
export type DuelingEntry = z.infer<typeof DuelingEntrySchema>;
export const FishingEntrySchema = z.object({
	fish: z.string(),
	weight: z.number(),
	...RecordIdentityEntrySchema.shape,
});
export type FishingEntry = z.infer<typeof FishingEntrySchema>;
export const HorseEntrySchema = z.object({
	horseName: z.string(),
	wins: z.number(),
});
export type HorseEntry = z.infer<typeof HorseEntrySchema>;

export const LeaderboardSchemaMap = {
	overall: LeaderboardEntrySchema,
	blackjack: BlackjackEntrySchema,
	dueling: DuelingEntrySchema,
	fishing: FishingEntrySchema,
	horse: HorseEntrySchema,
} as const;

export type PublicLeaderboardEntry<Entry extends RecordIdentityEntry> = Omit<Entry, 'guid'>;
export type PublicOverallLeaderboard = PublicLeaderboardEntry<LeaderboardEntry>[];
export type PublicBlackjackLeaderboard = PublicLeaderboardEntry<BlackjackEntry>[];
export type PublicDuelingLeaderboard = PublicLeaderboardEntry<DuelingEntry>[];
export type PublicFishingLeaderboard = PublicLeaderboardEntry<FishingEntry>[];
export type PublicHorseLeaderboard = HorseEntry[];

export type PrivateLeaderboard = BlackjackEntry[] | DuelingEntry[] | FishingEntry[] | HorseEntry[];
export type PublicLeaderboard = PublicOverallLeaderboard | PublicBlackjackLeaderboard | PublicDuelingLeaderboard | PublicFishingLeaderboard | PublicHorseLeaderboard;
export type Leaderboard = PrivateLeaderboard | PublicLeaderboard;