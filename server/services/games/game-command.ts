import { cType, eType, hType } from '../../defs/def-events';
import { allGames } from '../../defs/def-config';
import { fType } from '../../defs/def-games';
import { clearInput, keepInput } from '../../defs/def-input';
import type { GameCommand } from '../../defs/def-commands';
import type { GameType } from '../../defs/def-config';
import type { RatServer, RatSocket, GameEventType, GameText } from '../../defs/def-events';
import type { FishingEventType } from '../../defs/def-games';
import type { Identity, GameIdentity } from '../../defs/def-identity';
import type { InputStatus } from '../../defs/def-input';

import { ConfigService } from '../config';
import { DispatchService } from '../dispatch';
import { GameIdentityService } from './game-identity';
import { IdentityService } from '../identity';
import { GameStateService } from './game-state';
import { StateService } from '../state';

import { getBaseNick } from '../../utils/format';

type GameCommandEntry = {
	enabledFor: GameType[];
	handler: (ctx: GameCommand) => InputStatus | Promise<InputStatus>;
}

export interface GameCommandServiceDependencies {
	dispatchService: DispatchService;
	configService: ConfigService;
	gameIdentityService: GameIdentityService;
	identityService: IdentityService;
	gameStateService: GameStateService;
	stateService: StateService;
}

export class GameCommandService {
	private gameCommands: Record<string, GameCommandEntry> = {};
	private activeGameCommands: Map<RatSocket['id'], boolean> = new Map();

	private deps: GameCommandServiceDependencies;
	constructor(dependencies: GameCommandServiceDependencies){
		this.deps = dependencies;
		this.init();
	}

	private init(): void {
		this.initializeGameCommands();
	}

	public async handleGameCommand(msg: string, socket: RatSocket, io: RatServer, caller: Identity): Promise<InputStatus>{
		const args = msg.slice(1).trim().split(/ +/);
		const commandName = args.shift()?.toLowerCase() || '';

		if(!this.deps.configService.getGameConfig().enabled){
			return this.sendNotCommand(socket);
		}

		if(this.activeGameCommands.get(socket.id)){
			return keepInput;
		}

		this.activeGameCommands.set(socket.id, true);

		try{
			const result = await this.executeGameCommand(commandName, {
				socket,
				io,
				args,
				fullArgs: args.join(' '),
				commandUser: caller
			});

			return result;
		}
		catch(error: unknown){
			this.deps.dispatchService.sendUserErrorMessage(socket, error, `Handle Game Command: ${commandName}`);
			return keepInput;
		}
		finally{
			this.activeGameCommands.delete(socket.id);
		}
	}

	public getGameCommands(): string[]{
		return Object.keys(this.gameCommands);
	}

	private sendNotCommand(socket: RatSocket): InputStatus {
		this.deps.dispatchService.sendSystemChatPayload(socket, cType.error, "system: that's not a command lol");
		return keepInput;
	}

	private sendUserPoints(ctx: GameCommand, points: number, event: GameEventType): void {
		if(event === eType.fishing){
			this.deps.gameIdentityService.addFishingWinnings(ctx.commandUser.playerid, points);
		}
		this.deps.gameIdentityService.addGamePoints(ctx.commandUser.playerid, points);
		const nicepoints = points.toLocaleString('en-US');
		const name = this.deps.configService.getGameConfig().pointsName;
		const message: GameText[] = [
			{ text: "you've earned ", color: hType.normal },
			{ text: `${nicepoints} `, color: hType.normal },
			{ text: name, color: hType.normal },
			{ text: ", don't spend it all in one place", color: hType.normal }
		];
		this.deps.dispatchService.sendGamePayload(ctx.socket, message, event);
	}

	private async executeGameCommand(name: string, ctx: GameCommand): Promise<InputStatus> {
		const entry = this.gameCommands[name];

		if(!entry){
			return this.sendNotCommand(ctx.socket);
		}

		if(!entry.enabledFor.some(game => this.deps.configService.getGameConfig()[game])){
			return this.sendNotCommand(ctx.socket);
		}

		return await entry.handler(ctx);
	}

	private handleFishingEvent(playerid: GameIdentity['playerid'], event: FishingEventType, io: RatServer): void {
		let message: GameText[];

		switch(event){
			case fType.bite:{
				message = [{ text: 'fish on! /catch it before it gets away!', color: hType.normal }];
				break;
			}
			case fType.expired:{
				message = [{ text: 'damn, it got away...', color: hType.normal }];
				break;
			}
			case fType.nothing:{
				message = [{ text: 'looks like nothing bit...', color: hType.normal }];
				break;
			}
			default:{
				message = [{ text: 'looks like nothing bit...', color: hType.normal }];
			}
		}

		for(const [socketID, identity] of this.deps.stateService.getSocketUsersMap()){
			if(identity.playerid !== playerid){
				continue;
			}

			const targetSocket = io.sockets.sockets.get(socketID);
			if(targetSocket){
				this.deps.dispatchService.sendGamePayload(targetSocket, message, eType.fishing);
			}
		}
	}

	private initializeGameCommands(): void {
		this.registerGameCommands();
		//this.registerHorseCommands
		//this.registerDuelingCommands
		//this.registerBlackjackCommands
		this.registerFishingCommands();

		this.gameCommands['cast'] = this.gameCommands['fish'];
	}

	private registerGameCommands(): void {
		this.gameCommands['gamehelp'] = {
			enabledFor: allGames,
			handler: (ctx): InputStatus => {
				const config = this.deps.configService.getGameConfig();
				const helpMessages = [
					'/gamehelp  : View this list.',
				];
				if(config.fishing){
					helpMessages.push(
						'/fish to fish'
					);
				}

				const formatTable = helpMessages.join('\n');
				this.deps.dispatchService.sendSystemChatPayload(ctx.socket, cType.info, formatTable);
				return clearInput;
			}
		};
		this.gameCommands['testcolors'] = {
			enabledFor: allGames,
			handler: (ctx): InputStatus => {
				const colors = Object.values(hType);

				for(const color of colors){
					const message: GameText[] = [
						{ text: `[${color}]: The quick brown fox jumped over the lazy dog. 1234567890.`, color: color }
					];
					this.deps.dispatchService.sendGamePayload(ctx.socket, message, eType.horse);
				}

				return clearInput;
			}
		};
	}

	private registerFishingCommands(): void {
		this.gameCommands['fish'] = {
			enabledFor: ['fishing'],
			handler: (ctx): InputStatus => {
				if(this.deps.gameStateService.existsFishingSession(ctx.commandUser.playerid)){
					this.deps.dispatchService.sendSystemChatPayload(ctx.socket, cType.error, 'system: you already have a line in the water');
					return clearInput;
				}
				let target = null;
				if(ctx.fullArgs){
					target = ctx.fullArgs;
				}

				try{
					const callback = (playerid: GameIdentity['playerid'], event: FishingEventType): void => {
						this.handleFishingEvent(playerid, event, ctx.io);
					};
					this.deps.gameStateService.createFishingSession(ctx.commandUser.playerid, target, callback);
				}
				catch(error: unknown){
					this.deps.dispatchService.sendUserErrorMessage(ctx.socket, error, 'Fish Command');
					return keepInput;
				}

				if(target){
					const message: GameText[] = [
						{ text: 'you carefully cast your line looking for ', color: hType.normal },
						{ text: `"${target}"`, color: hType.normal },
						{ text: '...', color: hType.normal }
					];
					this.deps.dispatchService.sendGamePayload(ctx.socket, message, eType.fishing);
					return clearInput;
				}
				else{
					const message: GameText[] = [{ text: 'you cast out your line...', color: hType.normal }];
					this.deps.dispatchService.sendGamePayload(ctx.socket, message, eType.fishing);
					return clearInput;
				}
			}
		};

		this.gameCommands['catch'] = {
			enabledFor: ['fishing'],
			handler: (ctx): InputStatus =>{
				if(!this.deps.gameStateService.existsFishingSession(ctx.commandUser.playerid)){
					this.deps.dispatchService.sendSystemChatPayload(ctx.socket, cType.error, "system: you ain't got a line in the wooter. /fish to cast it out");
					return clearInput;
				}
				try{
					const fishResult = this.deps.gameStateService.catchFishingSession(ctx.commandUser.playerid);
					if(!fishResult){
						const message: GameText[] = [{ text: "your hook's empty...", color: hType.normal }];
						this.deps.dispatchService.sendGamePayload(ctx.socket, message, eType.fishing);
						return clearInput;
					}

					const weight = fishResult.weight.toLocaleString('en-US', { maximumFractionDigits: 2 });

					const message: GameText[] = [
						{ text: 'you caught a [', color: hType.normal },
						{ text: fishResult.name.toLowerCase(), color: fishResult.color },
						{ text: `] weighing ${weight} ounces. `, color: hType.normal }
					];

					if(fishResult.record){
						message.push({ text: 'new server fish record! ', color: hType.normal });
					}
					if(fishResult.pb){
						message.push({ text: 'new personal best catch! ', color: hType.normal });
					}
					if(fishResult.newcatch){
						message.push({ text: "you've never seen one of those before. ", color: hType.normal });
					}
					if(fishResult.big){
						message.push({ text: "that's a biggun' ", color: hType.normal });
					}
					if(fishResult.small){
						message.push({ text: "that's a smallun' ", color: hType.normal });
					}

					this.deps.dispatchService.sendGamePayload(ctx.socket, message, eType.fishing);
					this.deps.dispatchService.sendSystemChatPayload(ctx.socket, cType.info, fishResult.flavor);
					if(fishResult.record){
						const basenick = getBaseNick(ctx.commandUser.fullnick);
						const announcement: GameText[] = [
							{ text: basenick, color: hType.normal },
							{ text: ' caught a new server record [', color: hType.normal },
							{ text: fishResult.name.toLowerCase(), color: fishResult.color },
							{ text: `] weighing ${weight} ounces!`, color: hType.normal }
						];
						this.deps.dispatchService.sendGamePayload(ctx.io, announcement, eType.fishing);
					}
					const points = Math.ceil(fishResult.value);
					this.sendUserPoints(ctx, points, eType.fishing);
					return clearInput;
				}
				catch(error: unknown){
					this.deps.dispatchService.sendUserErrorMessage(ctx.socket, error, 'Catch Command');
					return keepInput;
				}
			}
		};
	}
}
