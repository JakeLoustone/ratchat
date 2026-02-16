export interface Identity {
    guid: string;
    nick: string;
    color: string;
    status: string;
    isMod: boolean;
    lastMessage: Date;
}

export interface ChatMessage {
    id: number;
    author: Identity['nick'];
    content: string;
    timestamp: number;
    type: enum;
}

export interface ServerConfig {
    welcomeMessage: string;
    slowMode: number;
    maxMsgLen: number;
    maxNickLen: number;

}

