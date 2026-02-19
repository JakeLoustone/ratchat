export interface Identity {
    guid: string;
    nick: string;
    status: string;
    isMod: boolean;
    lastMessage: Date;
    isAfk: boolean;
}

export const messageTypeObj = {
    chat: "chat message",
    info: "toClientInfo",
    error: "toClientError",
    announcement: "toClientAnnouncement",
    welcome: "toClientWelcome",
    identity: "identity",
    list: "userlist"
} as const;

export type messageType = typeof messageTypeObj[keyof typeof messageTypeObj];

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

