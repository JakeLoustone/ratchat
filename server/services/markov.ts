import { existsSync } from 'fs';
import { open, FileHandle } from "fs/promises";

import { createReadStream } from "fs";
import * as readline from "readline";

import { Server } from 'socket.io';

import { mType, tType} from '../../shared/schema';

import { MessageService } from './message';
import { StateService } from './state';
import { ModerationService } from './moderation';
import { IdentityService } from './identity';

export interface MarkovServiceDependencies {
	messageService: MessageService;
	stateService: StateService;
	moderationService: ModerationService;
	identityService: IdentityService;

	brainPath: string;
	io: Server;
}

export class MarkovService{
	private dictionary: Set<string> = new Set();

	private startBlocks: Record<string, { start: number; end: number }> = {};
	private gramBlocks: Record<string, { start: number; end: number }> = {};

	private fdPromise: Promise<FileHandle> | null = null;

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

	public async markovGen(io: Server, seed?: string): Promise<string> {
		if(!this.startBlocks || !this.gramBlocks){
			throw new Error("markov brain not loaded");
		}

		const markovUser = this.deps.stateService.markovUser;
		if(!markovUser){
			throw new Error("no markov user");
		}

		for(let attempt = 0; attempt < 5; attempt++){
			const raw: string[] = [];

			if(seed){
				const seedLow = seed.toLowerCase();

				if(!this.dictionary.has(seedLow)){
					throw new Error(`${markovUser.nick.substring(7)} don't know nothin about '${seed}'`);
				}

				const letter = seedLow[0].toUpperCase();
				const candidates = await this.loadNeuron(letter, seedLow);

				if(candidates.length === 0){
					throw new Error(`${markovUser.nick.substring(7)} don't know nothin about '${seed}'`);
				}

				let total = 0;
				for(const c of candidates){
					total += c.count;
				}

				let r = Math.random() * total;
				let chosen = candidates[candidates.length - 1];

				for(const c of candidates){
					r -= c.count;
					if(r <= 0){
						chosen = c;
						break;
					}
				}

				raw.push(chosen.words[0], chosen.words[1]);
			}
			else{
				const allStarts = await this.loadNeuron();

				if(allStarts.length === 0){
					throw new Error("no start entries in markov brain");
				}

				let total = 0;
				for(const c of allStarts){
					total += c.count;
				}

				let r = Math.random() * total;
				let chosen = allStarts[allStarts.length - 1];

				for(const c of allStarts){
					r -= c.count;
					if (r <= 0) {
						chosen = c;
						break;
					}
				}

				raw.push(chosen.words[0], chosen.words[1]);
			}

			while (true) {
				const prev = raw[raw.length - 2];
				const curr = raw[raw.length - 1];

				const letters = (prev[0] + curr[0]).toUpperCase();
				const candidates = await this.loadNeuron(letters, prev, curr);

				if(candidates.length === 0){
					break;
				}

				let total = 0;
				for(const c of candidates){
					total += c.count;
				}

				let r = Math.random() * total;
				let chosen = candidates[candidates.length - 1];

				for(const c of candidates){
					r -= c.count;
					if (r <= 0) {
						chosen = c;
						break;
					}
				}

				const next = chosen.words[2];

				if(next === "<END>"){
					break;
				}

				raw.push(next);

				if(raw.join(" ").length > this.deps.stateService.getConfig().maxMsgLen){
					raw.pop();
					break;
				}
			}

			if (raw.length < 4) {
				continue;
			}

			try {
				const safe = this.deps.moderationService.textCheck(raw.join(" "), markovUser, tType.chat);
				return safe;
			}
			catch(e: any){
				if(e.message === "watch your profamity"){
					this.deps.messageService.sendSys(io, mType.ann, `${markovUser.nick.substring(7)} tried to say something naughty`);
				}
				continue;
			}
		}

		throw new Error("no valid text generated after 5 attempts");
	}

	private markovTimer(io: Server){
		setInterval(async () =>{
			if(this.deps.stateService.markovSleep){
				return;
			}
			try{
				const gentext = await this.markovGen(io);
				if(this.deps.stateService.markovUser){
					this.deps.messageService.sendMarkov(this.deps.io, gentext, this.deps.stateService.markovUser, this.deps.stateService.markovUser, '');
				}
			}
			catch(e: any){

			}
		}, this.deps.stateService.getMarkovConfig().timer*1000);
	}

	private async loadNeuron(letters?: string, prev?: string, curr?: string){
		if(!this.fdPromise){
			this.fdPromise = open(this.deps.brainPath, "r");
		}

		const fd = await this.fdPromise;

		if(!letters){
			const allResults = [];

			for (const [ltr, block] of Object.entries(this.startBlocks)){
				const size = block.end - block.start;
				if (size <= 0) continue;

				const buffer = Buffer.alloc(size);
				await fd.read(buffer, 0, size, block.start);

				const lines = buffer.toString("utf8").split("\n");

				for (const line of lines) {
					const trimmed = line.trim();
					if(!trimmed){
						continue;
					}

					try {
						const data = JSON.parse(trimmed);
						allResults.push(data);
					} 
					catch(e:any){

					}
				}
			}
			return allResults;
		}

		const block =
			letters.length === 1
				? this.startBlocks[letters]
				: this.gramBlocks[letters];

		if(!block){
			return [];
		}

		const size = block.end - block.start;
		if(size <= 0){
			return [];
		}

		const buffer = Buffer.alloc(size);
		await fd.read(buffer, 0, size, block.start);

		const lines = buffer.toString("utf8").split("\n").filter(l => l.length > 0);
		const results = [];

		for(const line of lines){
			const trimmed = line.trim();
			if(!trimmed){
				continue;
			}

			let data;
			try {
				data = JSON.parse(trimmed);
			} 
			catch(e:any){
				continue;
			}

			if(letters.length === 1 && prev && !curr){
			if (data.words?.[0]?.toLowerCase() === prev.toLowerCase()) {
				results.push(data);
			}
				continue;
			}

			if(letters.length === 2 && prev && curr){
				if(data.words?.[0]?.toLowerCase() === prev.toLowerCase() &&	data.words?.[1]?.toLowerCase() === curr.toLowerCase()){
					results.push(data);
				}
			}
		}

		return results;
	}

	private loadBrain(brainPath: string) {
		if (!existsSync(brainPath)) {
			throw new Error("no brains for the markov");
		}

		const stream = createReadStream(brainPath, { encoding: "utf8" });
		const rl = readline.createInterface({ input: stream });

		let offset = 0;
		let currentLetters: string | null = null;
		let currentType: "start" | "gram" | null = null;

		rl.on("line", (line) => {
			const trimmed = line.trim();
			const byteLength = Buffer.byteLength(line) + 1;
			const currentLineStart = offset;

			if (!trimmed) {
				offset += byteLength;
				return;
			}

			let data;
			try {
				data = JSON.parse(trimmed);
			} catch {
				offset += byteLength;
				return;
			}

			const { type, letters, words } = data;

			// dictionary
			if (type === "start" && Array.isArray(words) && words.length > 0) {
				this.dictionary.add(words[0].toLowerCase());
			}

			// block switching
			if (typeof letters === "string" && (type === "start" || type === "gram")) {
				if (letters !== currentLetters || type !== currentType) {

					// close previous block
					if (currentLetters && currentType) {
						if (currentType === "start") {
							this.startBlocks[currentLetters].end = currentLineStart;
						} else {
							this.gramBlocks[currentLetters].end = currentLineStart;
						}
					}

					// start new block
					if (type === "start") {
						this.startBlocks[letters] = { start: currentLineStart, end: 0 };
					} else {
						this.gramBlocks[letters] = { start: currentLineStart, end: 0 };
					}

					currentLetters = letters;
					currentType = type;
				}
			}

			offset += byteLength;
		});

		rl.on("close", () => {
			// close final block at EOF
			if (currentLetters && currentType) {
				if (currentType === "start") {
					this.startBlocks[currentLetters].end = offset;
				} else {
					this.gramBlocks[currentLetters].end = offset;
				}
			}
		});
	}
}