import type { GameIdentity } from '../../../shared/schema';
import type { LeaderboardEntry, BlackjackEntry, DuelingEntry, FishingEntry, HorseEntry, PrivateHorseRecordList, PrivateFishRecordList } from './game-schema'
import type { PublicOverallLeaderboard, PublicBlackjackLeaderboard, PublicDuelingLeaderboard, PublicFishingLeaderboard, PublicHorseLeaderboard } from "./game-schema";
import type { PrivateLeaderboard, PublicLeaderboard } from "./game-schema";


import { CacheService } from "../cache";
import { DispatchService } from "../dispatch";
import { StateService } from "../state";
import { GameIdentityService } from "./game-identity";
import { IdentityService } from "../identity";

import { handleError, AppError } from "../../utils/errors";
//import { parseEntryArray } from "../../utils/parse";



//const REDIS_BLACKJACK_KEY = 'ratchat:blackjack';
type StageOne = GameIdentity & {fullnick: string };
type StageTwo = StageOne & { fishingTypesCaught: number, fishingRecords: number };
type FullEntry = LeaderboardEntry & BlackjackEntry & DuelingEntry & FishingEntry & HorseEntry;
type FullLeaderboard = FullEntry[];

export interface StateServiceDependencies{
	cacheService: CacheService;
	dispatchService: DispatchService;
	stateService: StateService;
	gameIdentityService: GameIdentityService;
	identityService: IdentityService;

	fishingRecordsPath: string; 
	horseRecordsPath: string
}

export class GameStateService {
	private horseRecords: PrivateHorseRecordList = [];
	private fishRecords: PrivateFishRecordList = [];

	private deps: StateServiceDependencies;
	constructor(dependencies: StateServiceDependencies){
		this.deps = dependencies;

		try{
			this.loadRecords();
		}
		catch(error: unknown){
			handleError(error, 'Leaderboards Load');
		}	
	}

	public getLeaderboard(): PublicOverallLeaderboard;
	public getLeaderboard(label: 'blackjack'): PublicBlackjackLeaderboard;
	public getLeaderboard(label: 'dueling'): PublicDuelingLeaderboard;
	public getLeaderboard(label: 'fishing'): PublicFishingLeaderboard;
	public getLeaderboard(label: 'horse'): PublicHorseLeaderboard;
	public getLeaderboard(label?: 'blackjack' | 'dueling' | 'fishing' | 'horse'): PublicLeaderboard{
		const usersMap = this.deps.gameIdentityService.getGameUsersMap();
		const entriesArray = Array.from(usersMap.values());

		const withNicks = this.joinNicksToArray(entriesArray);
		const withFishingStats = this.joinFishingStatsToArray(withNicks);

		const fullEntries: FullEntry[] = withFishingStats;

		switch(label){
			case 'blackjack':
				return this.buildPublicLeaderboard(fullEntries, 'blackjack');
			case 'dueling':
				return this.buildPublicLeaderboard(fullEntries, 'dueling');
			case 'fishing':
				return this.buildPublicLeaderboard(fullEntries, 'fishing');
			case 'horse':
				return this.buildPublicLeaderboard(fullEntries, 'horse');
			default:
				return this.buildPublicLeaderboard(fullEntries);
		}
	}

	private joinNicksToArray(entries: GameIdentity[]): StageOne[]{
		const results: StageOne[] = [];

		for(const gameidentity of entries){
			try{
				const fullnick = this.deps.identityService.getFullNickByPlayerId(gameidentity.playerid);
				results.push({ ...gameidentity, fullnick });
			}
			catch(error: unknown){
				handleError(error, `Join Nicks To Array (playerid ${gameidentity.playerid})`);
				continue;
			}
		}

		return results;
	}

	private joinFishingStatsToArray(entries: StageOne[]): StageTwo[] {
		const recordCounts = new Map<string, number>();

		for(const record of this.fishRecords){
			const count = recordCounts.get(record.playerid) ?? 0;
			recordCounts.set(record.playerid, count + 1);
		}

		return entries.map((entry) => ({
			...entry,
			fishingTypesCaught: entry.fishingFishCaught.length,
			fishingRecords: recordCounts.get(entry.playerid) ?? 0,
		}));
	}
		
	private buildPublicLeaderboard(entries: FullLeaderboard): PublicOverallLeaderboard;
	private buildPublicLeaderboard(entries: FullLeaderboard, label: 'blackjack'): PublicBlackjackLeaderboard;
	private buildPublicLeaderboard(entries: FullLeaderboard, label: 'dueling'): PublicDuelingLeaderboard;
	private buildPublicLeaderboard(entries: FullLeaderboard, label: 'fishing'): PublicFishingLeaderboard;
	private buildPublicLeaderboard(entries: FullLeaderboard, label: 'horse'): PublicHorseLeaderboard;
	private buildPublicLeaderboard(entries: FullLeaderboard, label?: 'blackjack' | 'dueling' | 'fishing' | 'horse'): PublicLeaderboard {
		switch(label){
			case 'blackjack':
				return entries.map((entry) => ({
					fullnick: entry.fullnick,
					blackjackWinnings: entry.blackjackWinnings,
					blackjackBlackjacks: entry.blackjackBlackjacks,
				}));
			case 'dueling':
				return entries.map((entry) => ({
					fullnick: entry.fullnick,
					duelingWins: entry.duelingWins,
					duelingHonor: entry.duelingHonor,
				}));
			case 'fishing':
				return entries.map((entry) => ({
					fullnick: entry.fullnick,
					fishingCatches: entry.fishingCatches,
					fishingTypesCaught: entry.fishingTypesCaught,
					fishingWinnings: entry.fishingWinnings,
					fishingBestCatchValue: entry.fishingBestCatchValue,
					fishingRecords: entry.fishingRecords,
				}));
			case 'horse':
				return entries.map((entry) => ({
					fullnick: entry.fullnick,
					horseWinnings: entry.horseWinnings,
					horseBetWins: entry.horseBetWins,
				}));
			default:
				return entries.map((entry) => ({
					fullnick: entry.fullnick,
					gamePoints: entry.gamePoints,
				}));
		}
	}
	private loadRecords(){
		return;
	}
}
// 	private loadLeaderboards(){
// 		this.blackjackLeaderboard = this.loadLeaderboard(this.deps.blackjackLeaderboardPath, 'blackjack');
// 		this.duelingLeaderboard = this.loadLeaderboard(this.deps.duelingLeaderboardPath, 'dueling');
// 		this.fishingLeaderboard = this.loadLeaderboard(this.deps.fishingLeaderboardPath, 'fishing');
// 		this.horseLeaderboard = this.loadLeaderboard(this.deps.horseLeaderboardPath, 'horse');
// 	}

// 	private loadLeaderboard(path: string, label: 'blackjack'): BlackjackEntry[];
// 	private loadLeaderboard(path: string, label: 'dueling'): DuelingEntry[];
// 	private loadLeaderboard(path: string, label: 'fishing'): FishingEntry[];
// 	private loadLeaderboard(path: string, label: 'horse'): HorseEntry[];
// 	private loadLeaderboard(path: string, label: keyof typeof LeaderboardSchemaMap): PrivateLeaderboard {
// 		const raw = this.readLeaderboardFile(path, label);
// 		let parsed: unknown[] = [];
// 		try {
// 			const result: unknown = JSON.parse(raw);
// 			if (!Array.isArray(result)) {
// 				throw new AppError(`${label} leaderboard file did not contain an array`, 'internal', 'warn');
// 			}
// 			parsed = result;
// 		} catch (error: unknown) {
// 			handleError(error, `${label} Leaderboard Parse`);
// 		}

// 		let validEntries: PrivateLeaderboard;

// 		switch (label) {
// 			case 'blackjack':
// 			validEntries = parseEntryArray(parsed, LeaderboardSchemaMap.blackjack);
// 			break;
// 			case 'dueling':
// 			validEntries = parseEntryArray(parsed, LeaderboardSchemaMap.dueling);
// 			break;
// 			case 'fishing':
// 			validEntries = parseEntryArray(parsed, LeaderboardSchemaMap.fishing);
// 			break;
// 			case 'horse':
// 			validEntries = parseEntryArray(parsed, LeaderboardSchemaMap.horse);
// 			break;
// 			case 'overall':
// 			throw new AppError(`loadLeaderboard must not be called with 'overall'`, 'bug');
// 			default:
// 			throw new AppError(`loadLeaderboard received unsupported label: ${label}`, 'internal', 'warn');
// 		}

// 		console.log(`LOADED ${label.toUpperCase()} LEADERBOARD:`, validEntries.length, 'entries');
// 		return validEntries;
// 	}

// 	private readLeaderboardFile(path: string, label: string): string{
// 		if(!existsSync(path)){
// 			try{
// 				writeFileSync(path, JSON.stringify([], null, 4));
// 				console.log(`created default ${label} leaderboard file`);
// 			}
// 			catch(error: unknown){
// 				handleError(error, `Create Leaderboard ${label} Default File`);
// 			}
// 			return "[]";
// 		}

// 		try{
// 			return readFileSync(path, 'utf-8');
// 		}
// 		catch(error: unknown){
// 			handleError(error, `${label} Leaderboard Read`);
// 			return "[]";
// 		}
// 	}
// }