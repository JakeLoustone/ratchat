import { cType, eType } from '../../defs/def-events';
import { allGames } from '../../defs/def-config';
import { fType } from '../../defs/def-games';
import { clearInput, keepInput } from '../../defs/def-input';
import type { GameCommand } from '../../defs/def-commands';
import type { GameType } from '../../defs/def-config';
import type { RatServer, RatSocket, GameEventType } from '../../defs/def-events';
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
		this.deps.gameIdentityService.setGamePoints(ctx.commandUser.playerid, points);
		const name = this.deps.configService.getGameConfig().pointName;
		this.deps.dispatchService.sendGamePayload(ctx.socket, `you've earned ${points} ${name}!`, event);
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
		let message: string;

		if(event === fType.bite){
			message = 'fish on! /catch it before it gets away!';
		}
		else if(event === fType.expired){
			message = 'damn, it got away...';
		}
		else{
			message = 'looks like nothing bit...';
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
				if(ctx.args[0]){
					target = ctx.args[0];
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
					this.deps.dispatchService.sendGamePayload(ctx.socket,`you carefully cast your line looking for ${target}...`, eType.fishing);
					return clearInput;
				}
				else{
					this.deps.dispatchService.sendGamePayload(ctx.socket, 'you cast out your line...', eType.fishing);
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
						this.deps.dispatchService.sendGamePayload(ctx.socket, "Your hook's empty...", eType.fishing);
						return clearInput;
					}
					else if(fishResult.record){
						this.deps.dispatchService.sendGamePayload(ctx.socket, `You caught a ${fishResult.name} weighing ${fishResult.weight} ounces. Wow! That's a server record!`, eType.fishing);
						const basenick = getBaseNick(ctx.commandUser.fullnick);
						this.deps.dispatchService.sendGamePayload(ctx.io,`${basenick} caught a new server record ${fishResult.name} weighing ${fishResult.weight} ounces!`, eType.fishing);
						const points = Math.ceil(fishResult.value);
						this.sendUserPoints(ctx, points, eType.fishing);
						return clearInput;
					}
					else if(fishResult.pb){
						this.deps.dispatchService.sendGamePayload(ctx.socket, `You caught a ${fishResult.name} weighing ${fishResult.weight} ounces. New personal best!`, eType.fishing);
						const points = Math.ceil(fishResult.value);
						this.sendUserPoints(ctx, points, eType.fishing);
						return clearInput;
					}
					else if(fishResult.big){
						this.deps.dispatchService.sendGamePayload(ctx.socket, `You caught a ${fishResult.name} weighing ${fishResult.weight} ounces. That's a biggun'`, eType.fishing);
						const points = Math.ceil(fishResult.value);
						this.sendUserPoints(ctx, points, eType.fishing);
						return clearInput;
					}
					else if (fishResult.small){
						this.deps.dispatchService.sendGamePayload(ctx.socket, `you caught a ${fishResult.name.toLowerCase()} weighing ${fishResult.weight} ounces. that's a smallun'`, eType.fishing);
						const points = Math.ceil(fishResult.value);
						this.sendUserPoints(ctx, points, eType.fishing);
						return clearInput;
					}
					this.deps.dispatchService.sendGamePayload(ctx.socket, `You caught a ${fishResult.name} weighing ${fishResult.weight} ounces.`, eType.fishing);
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
