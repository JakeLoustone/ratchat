import { readFileSync } from "fs";
import type { Server, Socket } from "socket.io";

import type { ServerConfig } from "../../shared/types";
import { mType } from '../../shared/types.ts';

export interface ConfigServiceDependencies{
	configPath: string;
	config: ServerConfig;
	emotes: Map<string, string>;

	send: (to: Server | Socket, metype: any, msg: any) => void;
}

export class ConfigService {
	private deps: ConfigServiceDependencies;

	constructor(dependencies: ConfigServiceDependencies) {
		this.deps = dependencies;
		this.loadConfig();
	}

	
	private loadConfig(){
 		Object.assign(this.deps.config, JSON.parse(readFileSync(this.deps.configPath, 'utf-8')));
	}

	public setAnnouncement(str: string){


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