export interface Identity {
    guid: string;
    nick: string;
    status: string;
    isMod: boolean;
    lastMessage: Date;
    isAfk: boolean;
}

export enum messageType{
    chat = "chat message",
    info = "toClientInfo",
    error = "toClientError",
    announcement = "toClientAnnouncement",
    welcome = "toClientWelcome",
    identity = "identity",
    list = "userlist"
}

export interface ChatMessage {
    id: number;
    author: Identity['nick'];
    content: string;
    timestamp: number;
    type: messageType;
}

export interface ServerConfig {
    welcomeMsg: string;
    slowMode: number;
    maxMsgLen: number;
    maxNickLen: number;
    msgArrayLen: number;
    PORT: number;
}

