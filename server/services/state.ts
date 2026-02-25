import { readFileSync, writeFileSync, existsSync } from "fs";
import type { Server, Socket } from "socket.io";

import type { ServerConfig, Identity, UserSum } from "../../shared/schema.ts";
import { defaultServerConfig, mType } from '../../shared/schema.ts';

import { MessageService } from "./message.ts";

export interface StateServiceDependencies{
	messageService: MessageService;
	
	configPath: string;
}

export class StateService {
	private deps: StateServiceDependencies;
	
	private socketUsers = new Map<string, Identity>();
	private emotes = new Map<string, string>();
	private config: ServerConfig = {} as ServerConfig;
	private announcement: string = "";


	constructor(dependencies: StateServiceDependencies) {
		this.deps = dependencies;
		this.loadConfig();
	}

	public getConfig(): ServerConfig{
		return this.config;
	}

	public getAnnouncement(): string{
		return this.announcement;
	}

	public setAnnouncement(io: Server, str: string){
		if (this.announcement === str){
			throw Error("that's already the announcement")
		}

		  this.announcement = str;
		
		if(str){
		  	this.deps.messageService.sendSys(io, mType.ann,`announcement: ${str}`);
		}
	}

	public getEmotes(): Map<string, string>{
		return this.emotes;
	}

	public async updateEmotes(io: Server, url?: string){
		const targetUrl = url ?? this.config.stvurl;

		if(!targetUrl){
			throw new Error('no emote url in config')
		}

		try {
			const response = await fetch(`https://api.7tv.app/v3/emote-sets/${targetUrl}`);
			if (!response.ok){ 
				throw new Error(`7tv returned HTTP ${response.status}`); 
			} 

			const data = await response.json();
			if (!data.emotes || !Array.isArray(data.emotes)){ 
				throw new Error("invalid 7tv response structure"); 
			}
			
			data.emotes.forEach((emote: any) => {
				const name = emote.name;
				const hostUrl = emote.data.host.url; 
				this.emotes.set(name, `https:${hostUrl}/1x.webp`);
			});

			console.log(`cached ${this.emotes.size} global emotes.`);

			const emotePayload = Object.fromEntries(this.emotes);
			this.deps.messageService.send(io, mType.emote, emotePayload);
			} 
			catch (e: any) {
				throw new Error(`failed to fetch emotes: ${e.message}`);
			}
	}

	public getSocketUsers(): Map<string, Identity>{
		return this.socketUsers;
	}

	public updateSocketUser(io: Server, socketID: string, identity: Identity) {
		this.socketUsers.set(socketID, identity);

		for (const [sId, user] of this.socketUsers.entries()) {
			if (user.guid === identity.guid && sId !== socketID) {
				this.socketUsers.set(sId, identity); 
			}
		}

		this.broadcastUsers(io);
	}

	public deleteSocketUser(io: Server, socketID: string){
		this.socketUsers.delete(socketID);
		this.broadcastUsers(io);
	}

	public broadcastUsers(io: Server){		
		const userList: UserSum[] = Array.from(this.socketUsers.values())
			.map(({ nick, status, isAfk }) => ({ nick, status, isAfk }))
			.sort((a,b) =>{
				if(a.isAfk !== b.isAfk){
					return a.isAfk ? 1 : -1;
				}
				return a.nick.substring(7).localeCompare(b.nick.substring(7), 'en', {sensitivity: 'base'});
			});
		
		const lurkers = io.sockets.sockets.size - this.socketUsers.size;

		userList.push({
			nick: '#NONVALlurkers',
			status: `${lurkers}`,
			isAfk: true
		})

		this.deps.messageService.send(io, mType.list, userList);
	}

	private loadConfig(){
		if(!existsSync(this.deps.configPath)){
			writeFileSync(this.deps.configPath, JSON.stringify(defaultServerConfig, null, 4))
			Object.assign(this.config, defaultServerConfig);
			console.log("created default config.json file")
			return;
		}

		let loadedCfg: any;
		try{
			loadedCfg = JSON.parse(readFileSync(this.deps.configPath, 'utf-8'));
		}
 		catch(e: any){
			console.warn(`config load error: ${e.message}`);
			loadedCfg = {};
		}
		for (const key of Object.keys(defaultServerConfig) as Array<keyof ServerConfig>){
			const def = defaultServerConfig[key];
			const cfg = loadedCfg[key];
			if(cfg === undefined || cfg === null){
				(this.config as any)[key] = def;
				console.log(`${key} = ${JSON.stringify(def)} [DEFAULT]`);
				continue;
			} 
			if(typeof def === "number" && typeof cfg !== "number"){
				(this.config as any)[key] = def;
				console.log(`${key} = ${JSON.stringify(def)} [DEFAULT]`)
				continue; 
			} 
			if(typeof def === "string" && typeof cfg !== "string"){
				(this.config as any)[key] = def;
				console.log(`${key} = ${JSON.stringify(def)} [DEFAULT]`)
				continue; 
			} 
			if(Array.isArray(def)){
				if(!Array.isArray(cfg) || !cfg.every(v => typeof v === "string")){
					(this.config as any)[key] = def;
					console.log(`${key} = ${JSON.stringify(def)} [DEFAULT]`)
					continue; 
				} 
			} 
			(this.config as any)[key] = cfg;
			console.log(`${key} = ${JSON.stringify(cfg)}`);
		}
		Object.freeze(this.config);
	}
}