import { readFileSync, writeFileSync, existsSync } from "fs";
import type { RedisClientType } from "redis";

import type { Socket, Server } from "socket.io";

import { mType } from '../../../shared/schema';
import type { GameType } from "../../../shared/schema";
import { LeaderboardSchemaMap } from './game-schema'
import type { LeaderboardEntry, BlackjackEntry, DuelingEntry, FishingEntry, HorseEntry } from './game-schema'
import type { PublicOverallLeaderboard, PublicBlackjackLeaderboard, PublicDuelingLeaderboard, PublicFishingLeaderboard, PublicHorseLeaderboard } from "./game-schema";
import type { PrivateLeaderboard, PublicLeaderboard } from "./game-schema";


import { DispatchService } from "../dispatch";
import { StateService } from "../state";

import { getDisplayNick } from "../../utils/format";
import { handleError, AppError } from "../../utils/errors";
import { parseEntryArray } from "../../utils/parse";

//const REDIS_BLACKJACK_KEY = 'ratchat:blackjack';

export interface StateServiceDependencies{
	dispatchService: DispatchService;
	stateService: StateService;

	blackjackLeaderboardPath: string;
	duelingLeaderboardPath: string;
	fishingLeaderboardPath: string;
	horseLeaderboardPath: string;
	redisClient: RedisClientType | null;
	redisTTL: number;
	io: Server;
}

export class GameStateService {
	private leaderboard: LeaderboardEntry[] = [];
	private blackjackLeaderboard: BlackjackEntry[] = [];
	private duelingLeaderboard: DuelingEntry[] = [];
	private fishingLeaderboard: FishingEntry[] = [];
	private horseLeaderboard: HorseEntry[] = [];

	private deps: StateServiceDependencies;
	constructor(dependencies: StateServiceDependencies){
		this.deps = dependencies;

		try{
			this.loadLeaderboards();
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
		switch(label){
			case 'blackjack':
				return this.getPublicBlackjackLeaderboard();
			case 'dueling':
				return this.getPublicDuelingLeaderboard();
			case 'fishing':
				return this.getPublicFishingLeaderboard();
			case 'horse':
				return this.getPublicHorseLeaderboard();
			default:
				return this.getPublicOverallLeaderboard();
		}
	}

	private getPublicBlackjackLeaderboard(): PublicBlackjackLeaderboard{
		return this.blackjackLeaderboard.map((entry) => ({
			name: entry.name,
			winnings: entry.winnings,
			blackjacks: entry.blackjacks,
		}));
	}

	private getPublicDuelingLeaderboard(): PublicDuelingLeaderboard{
		return this.duelingLeaderboard.map((entry) => ({
			name: entry.name,
			wins: entry.wins,
			honor: entry.honor,
		}));
	}

	private getPublicFishingLeaderboard(): PublicFishingLeaderboard{
		return this.fishingLeaderboard.map((entry) => ({
			name: entry.name,
			fish: entry.fish,
			weight: entry.weight,
		}));
	}

	private getPublicHorseLeaderboard(): PublicHorseLeaderboard{
		return [...this.horseLeaderboard];
	}

	private getPublicOverallLeaderboard(): PublicOverallLeaderboard{
		return this.leaderboard.map((entry) => ({
			name: entry.name,
			points: entry.points,
		}));
	}

	private loadLeaderboards(){
		this.blackjackLeaderboard = this.loadLeaderboard(this.deps.blackjackLeaderboardPath, 'blackjack');
		this.duelingLeaderboard = this.loadLeaderboard(this.deps.duelingLeaderboardPath, 'dueling');
		this.fishingLeaderboard = this.loadLeaderboard(this.deps.fishingLeaderboardPath, 'fishing');
		this.horseLeaderboard = this.loadLeaderboard(this.deps.horseLeaderboardPath, 'horse');
	}

	private loadLeaderboard(path: string, label: 'blackjack'): BlackjackEntry[];
	private loadLeaderboard(path: string, label: 'dueling'): DuelingEntry[];
	private loadLeaderboard(path: string, label: 'fishing'): FishingEntry[];
	private loadLeaderboard(path: string, label: 'horse'): HorseEntry[];
	private loadLeaderboard(path: string, label: keyof typeof LeaderboardSchemaMap): PrivateLeaderboard {
		const raw = this.readLeaderboardFile(path, label);
		let parsed: unknown[] = [];
		try {
			const result: unknown = JSON.parse(raw);
			if (!Array.isArray(result)) {
				throw new AppError(`${label} leaderboard file did not contain an array`, 'internal', 'warn');
			}
			parsed = result;
		} catch (error: unknown) {
			handleError(error, `${label} Leaderboard Parse`);
		}

		let validEntries: PrivateLeaderboard;

		switch (label) {
			case 'blackjack':
			validEntries = parseEntryArray(parsed, LeaderboardSchemaMap.blackjack);
			break;
			case 'dueling':
			validEntries = parseEntryArray(parsed, LeaderboardSchemaMap.dueling);
			break;
			case 'fishing':
			validEntries = parseEntryArray(parsed, LeaderboardSchemaMap.fishing);
			break;
			case 'horse':
			validEntries = parseEntryArray(parsed, LeaderboardSchemaMap.horse);
			break;
			case 'overall':
			throw new AppError(`loadLeaderboard must not be called with 'overall'`, 'bug');
			default:
			throw new AppError(`loadLeaderboard received unsupported label: ${label}`, 'internal', 'warn');
		}

		console.log(`LOADED ${label.toUpperCase()} LEADERBOARD:`, validEntries.length, 'entries');
		return validEntries;
	}

	private readLeaderboardFile(path: string, label: string): string{
		if(!existsSync(path)){
			try{
				writeFileSync(path, JSON.stringify([], null, 4));
				console.log(`created default ${label} leaderboard file`);
			}
			catch(error: unknown){
				handleError(error, `Create Leaderboard ${label} Default File`);
			}
			return "[]";
		}

		try{
			return readFileSync(path, 'utf-8');
		}
		catch(error: unknown){
			handleError(error, `${label} Leaderboard Read`);
			return "[]";
		}
	}
}