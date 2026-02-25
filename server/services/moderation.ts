import { readFileSync } from "fs";

import type { Identity, TimeType } from "../../shared/schema.ts";

import { StateService } from "./state.ts";

export interface ModerationServiceDependencies{
	stateService: StateService;
}

export class ModerationService {
	private deps: ModerationServiceDependencies;
	private profFilter: RegExp[] = [];
	private nickFilter: RegExp[] = [];


	constructor(dependencies: ModerationServiceDependencies) {
		this.deps = dependencies;
		this.loadFilters(); 
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
			const configLoad = this.deps.stateService.getConfig().nickres || [];
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

	public timeCheck(user: Identity, type: TimeType){
		const now = Date.now();
		const lastMessage = new Date(user.lastMessage).getTime();
		const lastChanged = new Date(user.lastChanged).getTime();

		if(lastMessage > now){
			throw new Error ('ur in timeout rn');
		};
		const config = this.deps.stateService.getConfig();
		const limits: Record<TimeType, number> = {
			chat: config.slowMode * 1000,
			nick: config.nickSlow * 1000,
			other: config.otherSlow * 1000
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
