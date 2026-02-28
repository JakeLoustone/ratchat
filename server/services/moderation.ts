import { readFileSync } from "fs";

import type { Identity, TimeType, TextType } from "../../shared/schema.ts";

import { StateService } from "./state";

export type SafeString = string & {__brand: 'SafeString'};

export interface ModerationServiceDependencies{
	stateService: StateService;

	nickFilterPath: string;
	profFilterPath: string;
}


export class ModerationService {
	private deps: ModerationServiceDependencies;
	private profFilter: RegExp[] = [];
	private nickFilter: RegExp[] = [];


	constructor(dependencies: ModerationServiceDependencies) {
		this.deps = dependencies;
		this.loadFilters(); 
	}

	public textCheck(raw: string, user: Identity, type: TextType): SafeString{
		const clean = this.sanitize(raw).trim();
		if(type === 'chat'){
			if(clean.length > this.deps.stateService.getConfig().maxMsgLen){
				throw new Error('sorry your message is too long lmao')
			}
			try{
				this.profCheck(clean);
				this.timeCheck(user, 'chat')
			}
			catch(e: any){
				throw new Error(e.message);
			}
			const safe = this.toSafeString(clean)
			return safe;
		}
		else if(type === 'status'){
			if(clean.length > 31){
				throw new Error('tl;dr - set something shorter')
			}
			try{
				this.profCheck(clean);
				this.timeCheck(user, 'other')
			}
			catch(e: any){
				throw new Error(e.message);
			}
			const safe = this.toSafeString(clean)
			return safe;
		}
		else if(type === 'nick'){
			if(clean.length > this.deps.stateService.getConfig().maxNickLen || clean.length < 2){
				throw new Error(`nickname must be between 2 and ${this.deps.stateService.getConfig().maxNickLen} characters`);
			}
			if (/\s/.test(clean)) {
				throw new Error('no spaces in usernames');
			}
			try{
				this.nickCheck(clean);
				this.timeCheck(user, 'nick')
			}
			catch(e: any){
				throw new Error(e.message);
			}
			const safe = this.toSafeString(clean)
			return safe;
		}
		else if(type === 'color'){
			if(!/^#[0-9A-F]{6}$/i.test(clean)){
				throw new Error('invalid hex code. please use format #RRGGBB');
			}
			try{
				this.timeCheck(user, 'other')
			}
			catch(e: any){
				throw new Error(e.message);
			}
			const safe = this.toSafeString(clean)
			return safe;
		}
		else{
			throw new Error('text type error');
		}		
	}

	public textCheckNewUser(raw: string, type: TextType): SafeString{
		const clean = this.sanitize(raw).trim();
		if(type === 'nick'){
			if(clean.length > this.deps.stateService.getConfig().maxNickLen || clean.length < 2){
				throw new Error(`nickname must be between 2 and ${this.deps.stateService.getConfig().maxNickLen} characters`);
			}
			if (/\s/.test(clean)) {
				throw new Error('no spaces in usernames');
			}
			try{
				this.nickCheck(clean);
			}
			catch(e: any){
				throw new Error(e.message);
			}
			const safe = this.toSafeString(clean)
			return safe;
		}
		else{
			throw new Error('text type error');
		}		
	}
		
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
		const waitTime = ((last + limits[type]) - now) /1000

		if (waitTime > 0){
			throw new Error(`you're doing that too fast, wait ${Math.ceil(waitTime)} seconds.`)
		};

		return;

	}
	
	private toSafeString(str: string): SafeString{
		return str as SafeString
	}
	
	private sanitize(str: string): string{
		if(typeof str !== "string"){
			return "";
		}
		try{
			let s = str;

			s = s.normalize("NFKC");
			s = s.replace(/<[^>]*>/g, "");
			s = s.replace(/[^\x20-\x7E]/g, "");
			
			return s;
		}
		catch{
			return "";
		}
	}

	private nickCheck(nick: string){
		
		const matched = this.nickFilter.find(regex => regex.test(nick));
		if (matched){
			console.log(`nick filter "${nick}" because it matched pattern: ${matched}`);
			throw new Error(`can't be named that`);
		}

		return;
	}

	private profCheck(str: string){
		
		const matched = this.profFilter.find(regex => regex.test(str));
		if (matched){
			console.log(`prof filter "${str}" because it matched pattern: ${matched}`)
			throw new Error('watch your profamity')
		}
		
		return;
	}

	private loadFilters() {
		try {
			const nickLoad = JSON.parse(readFileSync(this.deps.nickFilterPath, 'utf-8')).usernames || [];
			const profLoad = JSON.parse(readFileSync(this.deps.profFilterPath, 'utf-8'));
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
}