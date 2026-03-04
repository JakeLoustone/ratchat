import { statSync, readSync, existsSync, openSync, closeSync} from 'fs';
import { Server } from 'socket.io';

import { mType, tType} from '../../shared/schema';

import { MessageService } from './message';
import { StateService } from './state';
import { ModerationService } from './moderation';

type BrainEntry = {
	offset: number;
	length: number;
	weight: number;
}

type BrainIndex = {
	start: BrainEntry[];
	gram: Map<string, BrainEntry[]>;
}

export interface MarkovServiceDependencies {
	messageService: MessageService;
	stateService: StateService;
	moderationService: ModerationService;

	brainPath: string;
	io: Server;
}

export class MarkovService{
	private dictionary: Set<string> = new Set();
	private brain: BrainIndex = {start:[], gram:new Map()};
	private deps: MarkovServiceDependencies;
	
	constructor(dependencies: MarkovServiceDependencies){
		this.deps = dependencies;
		try{
			this.loadBrain(this.deps.brainPath);
		}
		catch(e: any){
			console.log('markov load error:', e.message);
		}
		this.markovTimer(this.deps.io);
	}

	public markovGen(io: Server, seed?: string): string {
		const fd = openSync(this.deps.brainPath, 'r');
		try{
			if (!this.brain) {
				throw new Error("no markov generator loaded");
			}

			const markovUser = this.deps.stateService.markovUser;
			if (!markovUser) {
				throw new Error("no markov user");
			}

			for (let attempt = 0; attempt < 5; attempt++) {

				const raw: string[] = [];

				if(seed){
					const seedLow = seed.toLowerCase();
					if(!this.dictionary.has(seedLow)){
						throw new Error(`${markovUser.nick.substring(7)} don't know nothin about '${seed}'`);
					}

					const matches = this.brain.start.filter(s => {
						const data = this.loadNeuron(fd, s);
						return data.words[0].toLowerCase() === seedLow;
					});

					if(matches.length === 0){
						throw new Error(`${markovUser.nick.substring(7)} don't know nothin about '${seed}'`);
					}

					let total = 0;
					for(const e of matches) total += e.weight;

					let r = Math.random() * total;
					let chosen = matches[matches.length - 1];

					for(const e of matches){
						r -= e.weight;
						if(r <= 0){
							chosen = e;
							break;
						}
					}
					const startData = this.loadNeuron(fd, chosen);
					raw.push(startData.words[0], startData.words[1]);
				} 
				else{
					const starts = this.brain.start;
					if(starts.length === 0){
						throw new Error("no start entries in markov brain");
					}

					let total = 0;
					for(const e of starts) total += e.weight;

					let r = Math.random() * total;
					let chosen = starts[starts.length - 1];

					for(const e of starts){
						r -= e.weight;
						if (r <= 0) {
							chosen = e;
							break;
						}
					}

					const startData = this.loadNeuron(fd, chosen);
					raw.push(startData.words[0], startData.words[1]);
				}

				while(true){
					const prev = raw[raw.length - 2];
					const curr = raw[raw.length - 1];

					const key = `${prev} ${curr}`;
					const candidates = this.brain.gram.get(key) || [];

					if(candidates.length === 0){
						break;
					}

					let total = 0;
					for(const e of candidates) total += e.weight;

					let r = Math.random() * total;
					let chosen = candidates[candidates.length - 1];

					for(const e of candidates){
						r -= e.weight;
						if(r <= 0){
							chosen = e;
							break;
						}
					}
					const nextData = this.loadNeuron(fd, chosen);
					const next = nextData.words[2];
					if(next === "<END>"){
						break;
					}

					raw.push(next);
					if(raw.join(' ').length > this.deps.stateService.getConfig().maxMsgLen){
						break;
					}
				}

				try {
					const safe = this.deps.moderationService.textCheck(
						raw.join(" "),
						markovUser,
						tType.chat
					);
					return safe;
				} 
				catch(e: any){
					if (e.message === "watch your profamity"){
						this.deps.messageService.sendSys(io, mType.ann, `${markovUser.nick.substring(7)} tried to say something naughty`);
					}
					continue;
				}
			}
			throw new Error("no valid text generated after 5 attempts");
		} 
		finally{ 
			closeSync(fd);
		}
	}

	private markovTimer(io: Server){
		setInterval(() =>{
			try{
				const gentext = this.markovGen(io);
				if(this.deps.stateService.markovUser){
					this.deps.messageService.sendChat(this.deps.io, this.deps.stateService.markovUser, gentext, -1)
				}
			}
			catch(e: any){

			}
		}, this.deps.stateService.getMarkovConfig().timer*1000);
	}

	private loadNeuron(fd: number, entry: BrainEntry): any{
		const buffer = Buffer.alloc(entry.length); 
		readSync(fd, buffer, 0, entry.length, entry.offset);
		const json = JSON.parse(buffer.toString("utf8")); 
		return json; 
	}

	private loadBrain(brainPath: string) {
		if (!existsSync(brainPath)) {
			throw new Error("no brains for the markov");
		}

		this.brain = {
			start: [],
			gram: new Map()
		};

		const fd = openSync(brainPath, "r");

		const bufferSize = 1024 * 1024;
		const buffer = Buffer.alloc(bufferSize);

		let fileOffset = 0;
		let leftover = "";

		while (true) {
			const bytesRead = readSync(fd, buffer, 0, bufferSize, fileOffset);
			if (bytesRead === 0) break;

			const chunk = leftover + buffer.toString("utf8", 0, bytesRead);
			const lines = chunk.split("\n");

			for (const line of lines) {
				const trimmed = line.trim();
				const byteLength = Buffer.byteLength(line) + 1;

				if (!trimmed) {
					fileOffset += byteLength;
					continue;
				}

				let data;
				try {
					data = JSON.parse(trimmed);
				} catch (err) {
					fileOffset += byteLength;
					continue;
				}

				const entry: BrainEntry = {
					offset: fileOffset,
					length: byteLength,
					weight: data.count
				};

				if (data.type === "start") {
					if (Array.isArray(data.words) && data.words.length > 0) {
						this.brain.start.push(entry);
						this.dictionary.add(data.words[0].toLowerCase());
					}
				} else {
					if (Array.isArray(data.words) && data.words.length >= 2) {
						const key = `${data.words[0]} ${data.words[1]}`;
						const arr = this.brain.gram.get(key) || [];
						arr.push(entry);
						this.brain.gram.set(key, arr);
					}
				}

				fileOffset += byteLength;
			}

			fileOffset += leftover.length;
		}
		console.log("Start entries:", this.brain.start.length); 
		console.log("Gram entries:", this.brain.gram.size);
		console.log("Dictionary entries:", this.dictionary.size);
		closeSync(fd);
	}

}