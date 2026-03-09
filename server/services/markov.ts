import { existsSync } from 'fs';
import { DatabaseSync } from "node:sqlite";
import { Server } from 'socket.io';

import { mType, tType} from '../../shared/schema';

import { MessageService } from './message';
import { StateService } from './state';
import { ModerationService } from './moderation';
import { IdentityService } from './identity';

type Neuron = {
	table: string;
	word1: string;
	word2: string;
	word3: string | null;
}

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
	private db: DatabaseSync | null = null;
	private markovQ = Promise.resolve();

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
		if(!this.db){
			throw new Error("brain db not initialized");
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

				let letter = seedLow[0].toUpperCase();
				letter = letter.replace(/[^A-Z_]/g, "_");
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

			while(true){
				const prev = raw[raw.length - 2];
				const curr = raw[raw.length - 1];

				let letters = (prev[0] + curr[0]).toUpperCase();
				letters = letters.replace(/[^A-Z_]/g, "_");
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

			if(raw.length < 4){
				continue;
			}

			try{
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

	public async markovLearn(str: string){
		if(!this.deps.stateService.getMarkovConfig().learning){
			return;
		}

		if(!this.db){
			throw new Error("brain db not initialized");
		}

		const words =  str
			.split(/\s+/)
			.filter(w => {
				try{
					return !this.deps.identityService.getUserByNick(w);
				}
				catch(e:any){
					return true;
				}
			})
			.map(w => w.trim())
			.filter(Boolean);
		
		if(words.length < 2){
			return;
		}

		const entries: Neuron[] = [];

		const w0 = words[0];
		const w1 = words[1];

		const startLetter = (w0[0] || "_").toUpperCase().replace(/[^A-Z_]/g, "_");
		entries.push({table: `start_${startLetter}`, word1: w0, word2: w1, word3: null})

		if(!this.dictionary.has(w0.toLowerCase())){
			this.dictionary.add(w0.toLowerCase());
		}

		if(words.length === 2){
			const letters = (w0[0] + w1[0]).toUpperCase().replace(/[^A-Z_]/g, "_");
			entries.push({table: `gram_${letters}`, word1: w0, word2: w1, word3: '<END>'});
			this.saveQueue(entries);
			return;
		}

		for(let i = 0; i < words.length - 2; i++){
			const a = words[i];
			const b = words[i + 1];
			const c = words[i + 2];

			const letters = (a[0] + b[0]).toUpperCase().replace(/[^A-Z_]/g, "_");
			entries.push({table: `gram_${letters}`, word1: a, word2: b, word3: c});
		}

		const lastA = words[words.length - 2];
		const lastB = words[words.length - 1];
		const endLetters = (lastA[0] + lastB[0]).toUpperCase().replace(/[^A-Z_]/g, "_");
		entries.push({table: `gram_${endLetters}`, word1: lastA, word2: lastB, word3: '<END>'});

		this.saveQueue(entries);
		return;
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
	private saveQueue(entries: Neuron[]) {
		this.markovQ = this.markovQ.then(() => this.saveNeuron(entries));
	}

	private async saveNeuron(entries: Neuron[]){
		if(!this.db){
			return;
		}

		this.db.exec("BEGIN")

		try{
			for(const n of entries){
				if(n.table.startsWith("start_") && n.table.length === "start_".length + 1){
					this.db.prepare(`INSERT INTO ${n.table} (word1, word2, count) VALUES (?, ?, 1) ON CONFLICT(word1, word2) DO UPDATE SET count = count + 1;`).run(n.word1, n.word2);
				}
				else if(n.table.startsWith("gram_") && n.table.length === "gram_".length + 2){
					this.db.prepare(`INSERT INTO ${n.table} (word1, word2, word3, count) VALUES (?, ?, ?, 1) ON CONFLICT(word1, word2, word3) DO UPDATE SET count = count + 1;`).run(n.word1, n.word2, n.word3);
				}
				else{
					continue;
				}
			}

			this.db.exec("COMMIT");
		}
		catch(e: any){
			this.db.exec("ROLLBACK");
		}
	}

	private async loadNeuron(letters?: string, prev?: string, curr?: string){
		if(!this.db){
			throw new Error("brain db not initialized");
		}

		if(!letters){
			const results: any[] = [];

			const tables = this.db
				.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'start_%'`).all().map((r: any) => r.name);

			for(const table of tables){
				const rows = this.db.prepare(`SELECT word1, word2, count FROM ${table}`).all();
				for (const row of rows) {
					results.push({
						words: [row.word1, row.word2],
						count: row.count
					});
				}
			}

			return results;
		}

		if(letters.length === 1){
			const table = `start_${letters}`;

			let rows: any[];

			if(prev && !curr){
				rows = this.db.prepare(`SELECT word1, word2, count FROM ${table} WHERE LOWER(word1) = LOWER(?)`).all(prev);
			} else {
				rows = this.db.prepare(`SELECT word1, word2, count FROM ${table}`).all();
			}

			return rows.map(r => ({
				words: [r.word1, r.word2],
				count: r.count
			}));
		}

		if(letters.length === 2){
			const table = `gram_${letters}`;

			let rows: any[];

			if(prev && curr){
				rows = this.db.prepare(
					`SELECT word1, word2, word3, count 
					FROM ${table}
					WHERE LOWER(word1) = LOWER(?) AND LOWER(word2) = LOWER(?)`
				).all(prev, curr);
			} 
			else{
				rows = this.db.prepare(`SELECT word1, word2, word3, count FROM ${table}`).all();
			}

			return rows.map(r => ({
				words: [r.word1, r.word2, r.word3],
				count: r.count
			}));
		}
		throw new Error ('neuron load failure');
	}

	private loadBrain(brainPath: string){
		const brain = existsSync(brainPath)		
		this.db = new DatabaseSync(brainPath);
		
		if(!brain){
			const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ_";
			const startSchema = `CREATE TABLE IF NOT EXISTS %TABLE% (word1 TEXT, word2 TEXT, count INTEGER, PRIMARY KEY (word1, word2));`;
			const gramSchema = `CREATE TABLE IF NOT EXISTS %TABLE% (word1 TEXT,	word2 TEXT,	word3 TEXT, count INTEGER, PRIMARY KEY (word1, word2, word3));`;

			this.db.exec("PRAGMA journal_mode = MEMORY;");
			this.db.exec("BEGIN");
			for(const L of letters){
				const table = `start_${L}`;
				this.db.prepare(startSchema.replace("%TABLE%", table)).run();
			}

			for(const A of letters){
				for(const B of letters){
					const table = `gram_${A}${B}`;
					this.db.prepare(gramSchema.replace("%TABLE%", table)).run();
				}
			}
			this.db.exec("COMMIT");
			this.db.exec("PRAGMA journal_mode = DELETE;");
		}

		const tables = this.db.prepare(`SELECT name	FROM sqlite_master WHERE type='table' AND name LIKE 'start%';`).all().map((row: any) => row.name);

		let totalRows = 0;
		for(const table of tables){
			if(!/^[A-Za-z0-9_]+$/.test(table)){
				console.log("sus table:", table);
				continue;
			}

			try{
				const rows = this.db.prepare(`SELECT word1 FROM ${table}`).all();

				for(const row of rows){
					if(row.word1 && typeof row.word1 === "string"){
						this.dictionary.add(row.word1.toLowerCase());
					}
				}

				totalRows += rows.length;
			} 
			catch(e: any){
				console.log(`Error reading table ${table}:`, e.message);
			}
		}
	}
}