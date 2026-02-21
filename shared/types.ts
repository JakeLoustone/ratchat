import{Server, Socket} from 'socket.io';

export interface Identity {
	guid: string;
	nick: string;
	lastChanged: Date;
	status: string;
	isMod: boolean;
	lastMessage: Date;
	isAfk: boolean;
}

export const mType = {
	chat: "toClientChat",
	info: "toClientInfo",
	error: "toClientError",
	ann: "toClientAnnouncement",
	welcome: "toClientWelcome",
	identity: "identity",
	list: "userlist",
	schat: "toServerChat",
	delmsg: "deleteMsg",
	emote: "emote"
} as const;

export type MessageType = typeof mType[keyof typeof mType];

export interface ChatMessage {
	id: number;
	author: Identity['nick'];
	content: string;
	timestamp: number;
	type: MessageType;
}

export interface ServerConfig {
	welcomeMsg: string;
	slowMode: number;
	maxMsgLen: number;
	maxNickLen: number;
	msgArrayLen: number;
	stvurl: string;
	nickres: string[];
	PORT: number;
}

export interface Command {
	socket: Socket;
	io: Server;
	args: string[];
	fullArgs: string;
	commandUser: Identity | null;
}