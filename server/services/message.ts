import { Server, Socket } from 'socket.io';

import type { MessageType, UserSum, Identity, ChatMessage } from '../../shared/schema';
import { mType } from '../../shared/schema';

type Target = Server | Socket;
type TextPayload = typeof mType.chat | typeof mType.ann | typeof mType.error | typeof mType.info | typeof mType.welcome;
type MessagePayloadMap = {
[T in MessageType]: 
	T extends typeof mType.identity ? Identity :
	T extends typeof mType.list ? UserSum[] :
	T extends typeof mType.delmsg ? number[] :
	T extends typeof mType.emote ? Record<string, string> :
	ChatMessage;
};

export interface MessageServiceDependencies {

};

export class MessageService{
	private deps: MessageServiceDependencies;
	private messageCounter = 0; 
	private chatHistory = new Map<number, ChatMessage>();

	constructor(dependencies: MessageServiceDependencies){
		  this.deps = dependencies;
	}

	public send<T extends MessageType>(to: Target, metype: T, msg: MessagePayloadMap[T]) {
		//double check target
		if (!(to instanceof Server) && !(to instanceof Socket)){
			throw new Error('Invalid emit target');
		}
		
		//Fire it off
		to.emit(metype, msg);
	}

	public sendSys(to: Target, type: TextPayload, text: string) {
		this.send(to, type, this.createMessage(true,'system',text, type));
	}

	public sendChat(to: Target, author: Identity, content:string, configSize: number){
		const msg = this.createMessage(false, author, content, mType.chat);
		this.send(to, mType.chat, msg);
		this.chatHistory.set(msg.id, msg);
		this.updateChatHistory(configSize);
	}
	
	public getChatHistory(): Map<number, ChatMessage>{
		return this.chatHistory;
	}
	
	public deleteMessage(io: Server, msgArray: number[]): number[] {
		const deleted: number[] = [];

		this.send(io, mType.delmsg, msgArray);

		msgArray.forEach(id => { 
			if(this.chatHistory.delete(id)){
				deleted.push(id);
			}
		});

		return deleted;
	}

	private updateChatHistory(configSize: number){
		while (this.chatHistory.size > configSize){
			const oldestMessage = this.chatHistory.keys().next().value;
			if (oldestMessage !== undefined) {
				this.chatHistory.delete(oldestMessage);
			}
		}

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

}
