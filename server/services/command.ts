import { Server, Socket } from 'socket.io';
import { type Command, type Identity, mType } from '../../shared/types.ts';
import { IdentityService } from '../services/identity.ts';

export interface CommandServiceDependencies {
    identityService: IdentityService;
    send: (to: Server | Socket, metype: any, msg: any) => void;
    sendSys: (to: Server | Socket, type: any, text: string) => void;
    updateSocketUser: (socketID: string, identity: Identity, updateType: 'update' | 'delete') => void;
    setAnnouncement: (text: string) => void;
}

export class CommandService {
    private commands: Record<string, (ctx: Command) => void> = {};
    private deps: CommandServiceDependencies;

    constructor(dependencies: CommandServiceDependencies) {
        this.deps = dependencies;
        this.registerCommands();
    }

    private registerCommands() {
        
        // ------------------------------------------------------------------
        // STANDARD COMMANDS
        // ------------------------------------------------------------------
        
        this.commands['help'] = (ctx) => {
            const helpMessages = [
                '/help, /h, or /commands : View this list.',
                '/chrat or /nick <nickname> : Change your nickname to <nickname>.',
                "/color <#RRGGBB> : Change your nickname's color to hex #RRGGBB.",
                '/clear or /clr : removes all visible messsages on your screen. (others can still see them)',
                "/export : returns your GUID for later importing on other devices. if you like your name don't share it :)",
                '/import : import a GUID exported earlier to reclaim your nickname. must match exactly!',
                '/afk : toggle AFK status in the user listing',
                '/status or /me : set your status in the user listing',
                '/gdpr <flag> : <info> for more information, <export> for a copy of your data, and <delete> to wipe your data.'
            ];
            
            if (ctx.commandUser?.isMod) {
                helpMessages.push(
                    '--- Moderator Commands ---',
                    '/ban <user> : Permanently bans a user with nickname "user"',
                    '/timeout or /to <user> : Mutes nickname "user" for 5 min.',
                    '/delete <1> : Delete a message with ID 1.',
                    '/announce or /announcement <text> : Send an announcement to all users.'
                );
            }
            helpMessages.forEach(msg => this.deps.sendSys(ctx.socket, mType.info, msg));
        };

        this.commands['nick'] = (ctx) => {
            const newNick = ctx.args[0];
            if (!newNick || newNick.length < 2 || newNick.length > 15) {
                return this.deps.sendSys(ctx.socket, mType.error, 'system: please provide a username with at least 2 but less than 15 characters');
            }
            try {
                // If they have no commandUser, extract the GUID from the handshake token directly
                const guid = ctx.commandUser?.guid || ctx.socket.handshake.auth.token;
                const oldNick = ctx.commandUser?.nick;
                
                const updatedUser = this.deps.identityService.userResolve(guid, newNick);
                this.deps.updateSocketUser(ctx.socket.id, updatedUser, 'update');
                this.deps.send(ctx.socket, mType.identity, updatedUser);
                
                if (oldNick) {
                    this.deps.sendSys(ctx.io, mType.ann, `${oldNick.substring(7)} changed their username to ${updatedUser.nick.substring(7)}`);
                } else {
                    this.deps.sendSys(ctx.io, mType.ann, `${updatedUser.nick.substring(7)} has joined teh ratchat`);
                }
            } catch (e: any) {
                this.deps.sendSys(ctx.socket, mType.error, `system error: ${e.message}`);
            }
        };

        this.commands['color'] = (ctx) => {
            if (!ctx.commandUser) return this.deps.sendSys(ctx.socket, mType.error, "system: please use /chrat <nickname> before trying to set a color");
            const hex = ctx.args[0];            
            try {
                const trimNick = ctx.commandUser.nick.substring(7);
                const updatedUser = this.deps.identityService.userResolve(ctx.commandUser.guid, trimNick, hex);
                this.deps.updateSocketUser(ctx.socket.id, updatedUser, 'update');
                this.deps.send(ctx.socket, mType.identity, updatedUser);
                this.deps.sendSys(ctx.socket, mType.info, `system: your color has been updated to ${hex}`);
            } catch (e: any) {
                this.deps.sendSys(ctx.socket, mType.error, `system error: ${e.message}`);
            }
        };

        this.commands['colour'] = (ctx) => this.deps.sendSys(ctx.socket, mType.error, "system: lern to speak american");

        this.commands['import'] = (ctx) => {
            const newGUID = ctx.args[0];
            const GUIDregex = new RegExp("^[{]?[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}[}]?$");
            
            if (!GUIDregex.test(newGUID)) {
                return this.deps.sendSys(ctx.socket, mType.error, "system: not a valid GUID");
            }
            try {
                const updatedUser = this.deps.identityService.getUser(newGUID);
                this.deps.updateSocketUser(ctx.socket.id, updatedUser, 'update');
                this.deps.send(ctx.socket, mType.identity, updatedUser);
                this.deps.sendSys(ctx.socket, mType.info, `system: identity changed to ${updatedUser.nick.substring(7)}`);

                if (ctx.commandUser) {
                    this.deps.sendSys(ctx.io, mType.ann, `${ctx.commandUser.nick.substring(7)} disconnected`);
                }
                this.deps.sendSys(ctx.io, mType.ann, `${updatedUser.nick.substring(7)} connected`);
            } catch (e: any) {
                this.deps.sendSys(ctx.socket, mType.error, `system error: ${e.message}`);
            }
        };

        this.commands['afk'] = (ctx) => {
            if (!ctx.commandUser) return this.deps.sendSys(ctx.socket, mType.error, "system: please use /chrat <nickname> before trying to go afk lmao");
            try {
                const afkUser = this.deps.identityService.toggleAfk(ctx.commandUser.guid);
                this.deps.updateSocketUser(ctx.socket.id, afkUser, 'update');
                this.deps.sendSys(ctx.socket, mType.info, afkUser.isAfk ? "you've gone afk" : `welcome back, ${afkUser.nick.substring(7)}`);
            } catch (e: any) {
                this.deps.sendSys(ctx.socket, mType.error, `system error: ${e.message}`);
            }
        };

        this.commands['status'] = (ctx) => {
            if (!ctx.commandUser) return this.deps.sendSys(ctx.socket, mType.error, "system: please use /chrat <nickname> before trying to facebook post");
            
            //Sanitize
            const noHtml = ctx.fullArgs.replace(/<[^>]*>?/gm, '');
            const newStatus = noHtml.replace(/[^\x20-\x7E]/g, '');
            
            if (newStatus.length > 32) return this.deps.sendSys(ctx.socket, mType.error, 'system: tl;dr - set something shorter');
            
            try {
                const updatedUser = this.deps.identityService.setStatus(ctx.commandUser.guid, newStatus);
                this.deps.updateSocketUser(ctx.socket.id, updatedUser, "update");
                this.deps.sendSys(ctx.socket, mType.info, `your status is now: ${updatedUser.status}`);
            } catch (e: any) {
                this.deps.sendSys(ctx.socket, mType.error, `system error: ${e.message}`);
            }
        };

        this.commands['gdpr'] = (ctx) => {
            const subComm = ctx.args[0];
            switch (subComm) {
                case 'info':
                    const infoMsgs = [
                        '---------------------------------------------------------------------------------------------',
                        'We store the following data server side:',
                        'guid           |   Unique identifier and allows multiple sessions to have the same nickname',
                        'nick           |   Chosen nickname and color set by the /nick and /color commands',
                        'status         |   Chosen status displayed in user listing set by /status command',
                        'isMod          |   Flag for allowing moderator actions',
                        'lastMessage    |   Timestamp of last message sent for timeout enforcement and nickname cleanup',
                        'isAfk          |   AFK flag for user listing set by /afk command',
                        'ip             |   Last known ip address for ban enforcement if necessary',
                        '---------------------------------------------------------------------------------------------',
                        'We store the following information locally:',
                        'ratGUID        |   a local copy of the GUID for message construction',
                        '---------------------------------------------------------------------------------------------',
                        'Use /gdpr export to see a copy of your data stored on the server, if any.',
                        'Use /gdpr delete to permanently remove your data from the server. this will prevent you from utilizing the application.'
                    ];
                    infoMsgs.forEach(msg => this.deps.sendSys(ctx.socket, mType.info, msg));
                    break;
                case 'export':
                    if (!ctx.commandUser) return this.deps.sendSys(ctx.socket, mType.error, "system: no server stored data");
                    this.deps.sendSys(ctx.socket, mType.info, `Server stored info: ${JSON.stringify(ctx.commandUser, null, 4)}`);
                    break;
                case 'delete':
                    if (!ctx.commandUser) return this.deps.sendSys(ctx.socket, mType.error, "system: no server stored data");
                    try {
                        this.deps.identityService.deleteUser(ctx.commandUser.guid);
                        this.deps.updateSocketUser(ctx.socket.id, ctx.commandUser, 'delete');
                        
                        // Local deletion ID
                        const sentinelId = { guid: 'RESET_IDENTITY' } as Identity;
                        this.deps.send(ctx.socket, mType.identity, sentinelId);
                        
                        this.deps.sendSys(ctx.socket, mType.info, 'goodbye is ur data');
                        this.deps.sendSys(ctx.io, mType.ann, `${ctx.commandUser.nick.substring(7)} disconnected`);
                    } catch (e: any) {
                        this.deps.sendSys(ctx.socket, mType.error, `system error: ${e.message}`);
                    }
                    break;
                default:
                    this.deps.sendSys(ctx.socket, mType.error, "system: please use with 'info', 'export' or 'delete' after /gdpr");
            }
        };

        // ------------------------------------------------------------------
        // MODERATOR COMMANDS
        // ------------------------------------------------------------------

        this.commands['announce'] = (ctx) => {
            if (!ctx.commandUser?.isMod) return this.deps.sendSys(ctx.socket, mType.error, "naughty naughty");
            const noHtml = ctx.fullArgs.replace(/<[^>]*>?/gm, '');
            const newAnnounce = noHtml.replace(/[^\x20-\x7E]/g, '');
            if (newAnnounce.trim().length > 0) {
                this.deps.setAnnouncement(newAnnounce);
                this.deps.sendSys(ctx.io, mType.ann, `announcement: ${newAnnounce}`);
            } else {
                // Clear announcement
                this.deps.setAnnouncement('');
                this.deps.sendSys(ctx.socket, mType.info, 'announcement cleared');
            }
        };
        this.commands['ban'] = (ctx) => {
            if (!ctx.commandUser?.isMod) return this.deps.sendSys(ctx.socket, mType.error, "naughty naughty");
            if (!ctx.args[0]) return this.deps.sendSys(ctx.socket, mType.error, "missing target");
            this.deps.sendSys(ctx.io, mType.info, `${ctx.fullArgs} has been banned.`);
        };

        this.commands['timeout'] = (ctx) => {
            if (!ctx.commandUser?.isMod) return this.deps.sendSys(ctx.socket, mType.error, "naughty naughty");
            if (!ctx.args[0]) return this.deps.sendSys(ctx.socket, mType.error, "missing target");
            this.deps.sendSys(ctx.io, mType.info, `${ctx.fullArgs} has been timed out.`);
        };

        this.commands['delete'] = (ctx) => {
            if (!ctx.commandUser?.isMod) return this.deps.sendSys(ctx.socket, mType.error, "naughty naughty");
            if (!ctx.args[0] || isNaN(Number(ctx.args[0]))) return this.deps.sendSys(ctx.socket, mType.error, "please provide message id");
            this.deps.sendSys(ctx.socket, mType.info, `deleted message ID ${ctx.fullArgs}`);
        };

        // ------------------------------------------------------------------
        // ALIASES
        // ------------------------------------------------------------------
        this.commands['h'] = this.commands['commands'] = this.commands['help'];
        this.commands['chrat'] = this.commands['nick'];
        this.commands['me'] = this.commands['status'];
        this.commands['to'] = this.commands['timeout'];
        this.commands['announcement'] = this.commands['announce'];
    }

    public execute(name: string, ctx: Command) {
        const handler = this.commands[name];
        if (handler) {
            handler(ctx);
        } else {
            this.deps.sendSys(ctx.socket, mType.error, "system: that's not a command lol");
        }
    }
}