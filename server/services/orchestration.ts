import { readFileSync } from "fs";
import type { Server, Socket } from "socket.io";

import type { ServerConfig, Identity, TimeType } from "../../shared/types";
import { mType } from '../../shared/types.ts';

export interface OrchestrationServiceDependencies{
	configPath: string;
	config: ServerConfig;
	emotes: Map<string, string>;

	send: (to: Server | Socket, metype: any, msg: any) => void;
}

export class OrchestrationService {
	private deps: OrchestrationServiceDependencies;
	private profFilter: RegExp[] = [];
	private nickFilter: RegExp[] = [];


	constructor(dependencies: OrchestrationServiceDependencies) {
		this.deps = dependencies;
		this.loadConfig();
		this.loadFilters(); 
	}

	
	private loadConfig(){
 		Object.assign(this.deps.config, JSON.parse(readFileSync(this.deps.configPath, 'utf-8')));
	}

	private loadFilters() {
		try {
			const nickLoad = JSON.parse(readFileSync('./nickfilter.json', 'utf-8')).usernames || [];
			const profLoad = JSON.parse(readFileSync('./profanityfilter.json', 'utf-8'));
			this.profFilter = Array.isArray(profLoad) 
				? profLoad
					.filter((item: any) => item.tags?.includes('racial') && item.severity > 2)
					.map((item: any) => 
						`\\b${(item.match.includes('|') ? `(?:${item.match})` : item.match)
							.replace(/\*/g, '.*')
							.replace(/([a-zA-Z0-9.])(?=[a-zA-Z0-9.])/g, '$1[\\s\\-_.]*')
						}\\b`
					)
					.map(pattern => new RegExp(pattern, 'i'))
				: [];
			const configLoad = this.deps.config.nickres || [];
			const nickFilter = [...nickLoad, ...configLoad].filter(Boolean);

			this.nickFilter = [
				...nickFilter.map(pattern => new RegExp(pattern, 'i')),
				...this.profFilter
			];
		} catch (e) {
			console.error('nick filter load issue');
			this.nickFilter = [];
		}
	};

	public async emoteLoad(io: Server, url: string): Promise<boolean>{
		try {;
				if(url === '0'|| !url){
					console.log('no emote URL')
					return false;
				}
				const response = await fetch(`https://api.7tv.app/v3/emote-sets/${url}`);
				const data = await response.json();
				
				data.emotes.forEach((e: any) => {
					const name = e.name;
					const hostUrl = e.data.host.url; 
					this.deps.emotes.set(name, `https:${hostUrl}/1x.webp`);
				});

				console.log(`cached ${this.deps.emotes.size} global emotes.`);
				const emotePayload = Object.fromEntries(this.deps.emotes);
				this.deps.send(io, mType.emote, emotePayload);
				return true;
			} catch (err) {
				console.error('failed to fetch emotes:', err);
				return false;
			}
	}

	public timeCheck(user: Identity, type: TimeType){
		const now = Date.now();
		const lastMessage = new Date(user.lastMessage).getTime();
		const lastChanged = new Date(user.lastChanged).getTime();

		if(lastMessage > now){
			throw new Error ('ur in timeout rn');
		};

		const limits: Record<TimeType, number> = {
			chat: this.deps.config.slowMode * 1000,
			nick: this.deps.config.nickSlow * 1000,
			other: this.deps.config.otherSlow * 1000
		};

		const last = type === "chat"? lastMessage : lastChanged;
		const waitTime = last - (now + limits[type]);

		if (waitTime > 0){
			throw new Error(`you're doing that too fast, wait ${Math.ceil(waitTime)} seconds.`)
		};

		return;

	}

	public nickCheck(nick: string){
		
		const matched = this.nickFilter.find(regex => regex.test(nick));
		if (matched){
			console.log(`nick filter "${nick}" because it matched pattern: ${matched}`);
			throw new Error(`can't be named that`);
		}

		return;
	}

	public profCheck(str: string){
		
		const matched = this.profFilter.find(regex => regex.test(str));
		if (matched){
			console.log(`prof filter "${str}" because it matched pattern: ${matched}`)
			throw new Error('watch your profamity')
		}
		
		return;
	}
}
