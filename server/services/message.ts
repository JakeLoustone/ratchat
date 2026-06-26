import { Server } from 'socket.io';
import type { RedisClientType } from 'redis';

import { mType } from '../../shared/schema';
import type { MessageType, UserSum, Identity, ChatMessage } from '../../shared/schema';

import { getDisplayNick } from '../utils/format';

type Target = { emit: Server['emit'] };
type TextPayload = typeof mType.chat | typeof mType.ann | typeof mType.error | typeof mType.info | typeof mType.welcome | typeof mType.markov;
type EmotePayload = Record<string, string>;
type MessagePayloadMap = {
	[T in MessageType]: 
		T extends typeof mType.identity ? Identity :
		T extends typeof mType.ulist ? UserSum[] :
		T extends typeof mType.delmsg ? number[] :
		T extends typeof mType.emote ? EmotePayload :
		ChatMessage;
};

export interface MessageServiceDependencies {
	redisClient: RedisClientType | null;
}

export class MessageService{
	private deps: MessageServiceDependencies;
	private messageCounter = 0; 
	private chatHistory = new Map<number, ChatMessage>();

	constructor(dependencies: MessageServiceDependencies){
		  this.deps = dependencies;
	}

	public sendChat(to: Target, author: Identity, content:string, configSize: number){
		const msg = this.createMessage(false, author, content, mType.chat);
		this.sendPayload(to, mType.chat, msg);
		if(configSize > 0){
			this.chatHistory.set(msg.id, msg);
			this.updateChatHistory(configSize);
		}
	}

	public sendSystemChat(to: Target, type: TextPayload, text: string){
		this.sendPayload(to, type, this.createMessage(true,'system',text, type));
	}

	public sendMarkovChat(to: Target, text: string, markov: Identity, user: Identity, seed?: string){
		const payload = `${getDisplayNick(user.nick)}|${seed}|${text}`;
		this.sendPayload(to, mType.markov, this.createMessage(false,markov, payload, mType.markov))
	}

	public sendChatHistory(to: Target){
		for (const [, msg] of this.chatHistory){
			this.sendPayload(to, mType.chat, msg);
		}
	}

	public sendIdentity(to: Target, identity: Identity){
		this.sendPayload(to, mType.identity, identity);
	}

	public sendEmoteList(to: Target, emotes: EmotePayload){
		this.sendPayload(to, mType.emote, emotes);
	}

	public sendUserList(to: Target, users: UserSum[]){
		this.sendPayload(to, mType.ulist, users);
	}
	
	public deleteMessage(io: Server, msgArray: number[]): number[] {
		const deleted: number[] = [];

		this.sendPayload(io, mType.delmsg, msgArray);

		msgArray.forEach(id => { 
			if(this.chatHistory.delete(id)){
				deleted.push(id);
			}
		});

		return deleted;
	}

	public getChatHistory(): Map<number, ChatMessage>{
		return this.chatHistory;
	}
	

	public startPruneTimer(msgArrayTimeout: number){
		this.pruneTimer(msgArrayTimeout);
	}

	public redisFallback(){
		return;
	}

	private sendPayload<T extends MessageType>(to: Target, metype: T, msg: MessagePayloadMap[T]){
		to.emit(metype, msg);
	}

	private createMessage(sys: false, author: Identity, content: string, metype: TextPayload): ChatMessage;
	private createMessage(sys: true, author: string, content: string, metype: TextPayload): ChatMessage;
	private createMessage(sys: boolean = false, author: Identity | string = 'system', content: string, metype: TextPayload): ChatMessage {
		return {
			id: sys? -1: this.messageCounter++,
			author: typeof author === 'string' ? author : author.nick,
			content: content,
			timestamp: Date.now(),
			type: metype
		};
	}

	private updateChatHistory(configSize: number){
		while (this.chatHistory.size > configSize){
			const oldestMessage = this.chatHistory.keys().next().value;
			if(oldestMessage !== undefined){
				this.chatHistory.delete(oldestMessage);
			}
		}

	}

	private pruneTimer(timeout: number){
		setInterval(() => {
			const now = Date.now();
			const pruneTime = (timeout - 60) * 1000;

			for(const [id, msg] of this.chatHistory){
				if(msg.timestamp + pruneTime < now){
					this.chatHistory.delete(id);
				}
			}

		}, 60000);	

	}
}
