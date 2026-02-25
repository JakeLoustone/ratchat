import { readFileSync, writeFileSync, existsSync } from "fs";
import type { Server, Socket } from "socket.io";

import type { ServerConfig } from "../../shared/schema.ts";
import { defaultServerConfig, mType } from '../../shared/schema.ts';

export interface StateServiceDependencies{
	configPath: string;
	config: ServerConfig;
	emotes: Map<string, string>;
    announcement: {val: string}

	send: (to: Server | Socket, metype: any, msg: any) => void;
	sendSys: (to: Server | Socket, type: any, text: string) => void;
}

export class StateService {
	private deps: StateServiceDependencies;

	constructor(dependencies: StateServiceDependencies) {
		this.deps = dependencies;
		this.loadConfig();
	}

	
	private loadConfig(){
		if(!existsSync(this.deps.configPath)){
			writeFileSync(this.deps.configPath, JSON.stringify(defaultServerConfig, null, 4))
			Object.assign(this.deps.config, defaultServerConfig);
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
				(this.deps.config as any)[key] = def;
				console.log(`${key} = ${JSON.stringify(def)} [DEFAULT]`);
				continue;
			} 
			if(typeof def === "number" && typeof cfg !== "number"){
				(this.deps.config as any)[key] = def;
				console.log(`${key} = ${JSON.stringify(def)} [DEFAULT]`)
				continue; 
			} 
			if(typeof def === "string" && typeof cfg !== "string"){
				(this.deps.config as any)[key] = def;
				console.log(`${key} = ${JSON.stringify(def)} [DEFAULT]`)
				continue; 
			} 
			if(Array.isArray(def)){
				if(!Array.isArray(cfg) || !cfg.every(v => typeof v === "string")){
					(this.deps.config as any)[key] = def;
					console.log(`${key} = ${JSON.stringify(def)} [DEFAULT]`)
					continue; 
				} 
			} 
			(this.deps.config as any)[key] = cfg;
			console.log(`${key} = ${JSON.stringify(cfg)}`);
		}
	}

	public setAnnouncement(io: Server, str: string){
		if (this.deps.announcement.val === str){
			throw Error("that's already the announcement")
		}

        this.deps.announcement.val = str;
		if(str){
        	this.deps.sendSys(io, mType.ann,`announcement: ${str}`);
		}
	}
	
	public async emoteLoad(io: Server, url?: string){
		const targetUrl = url ?? this.deps.config.stvurl;

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
				this.deps.emotes.set(name, `https:${hostUrl}/1x.webp`);
			});

			console.log(`cached ${this.deps.emotes.size} global emotes.`);

			const emotePayload = Object.fromEntries(this.deps.emotes);
			this.deps.send(io, mType.emote, emotePayload);
			} 
			catch (e: any) {
				throw new Error(`failed to fetch emotes: ${e.message}`);
			}
	}
}