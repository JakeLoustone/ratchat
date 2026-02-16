import { Server } from 'socket.io';
import express from 'express';
import { createServer } from 'http';
import { dirname, join } from 'path';
import { fileURLToPath } from 'node:url';
import { writeFileSync, readFileSync } from 'fs';
import type { Identity, ChatMessage } from '../shared/types.ts';
import { IdentityService } from './services/identity.ts'


const config = JSON.parse(readFileSync('./config.json'));
const app = express();
const httpserver = createServer(app);
const io = new Server(httpserver, {
		     connectionStateRecovery: {}
});

const __dirname = dirname(fileURLToPath(import.meta.url));

const identityService = new IdentityService();
const socketUsers = new Map<string, Identity>();



app.get('/ratchat', (req, res) => {
    res.sendFile('www/ratchat.html', { root : __dirname });
});

let messageCounter = 0;

io.on('connection', (socket) => {
	socket.emit("toClientWelcome", `Welcome: ${config.welcomeMsg}`)
	
	//identity service stuff
	const clientGUID = socket.handshake.auth.token;

	const returningUser = clientGUID ? identityService.getUser(clientGUID) : undefined;

	if (returningUser) {
	    socketUsers.set(socket.id, returningUser);
	    socket.emit('identity', returningUser);
	    socket.emit('toClientWelcome', `Welcome back ${returningUser.nick.substring(7)}`);
	} else {
	    socket.emit('toClientMsg', "system: please use the /chrat <nickname> to set a nickname");
	}

	//A new user has connected	
	console.log('a user connected');

	//When a message is recieved from a client
	socket.on('chat message', (msg, callback) => {
		// Set user context
		const user = socketUsers.get(socket.id);

		// Check if it's a command
		if (msg.startsWith('/')) {
		    


			// Split into command
			const args = msg.slice(1).trim().split(/ +/);
			const command = args.shift().toLowerCase(); // Get the first word and remove from args array
			const fullArgs = args.join(' '); // Rejoin the rest for messages/targets

			switch (command) {
				case 'nick':
				case 'chrat':
					if (args[0].length < 2 || args[0].length > 15) {
					    socket.emit('toClientMsg', "system: please provide a username with at least 2 but less than 15 characters");
					} else {
						try {
							const userGUID = user ? user.guid : (clientGUID || null);
							const oldNick = user ? user.nick: null;
							const updateUser = identityService.userResolve(userGUID, args[0]);
							socketUsers.set(socket.id, updateUser);
							socket.emit('identity', updateUser);
							if (oldNick) {
								io.emit('toClientAnnouncement', `system: ${oldNick.substring(7)} changed their username to ${updateUser.nick.substring(7)}`);
							} else {
								io.emit('toClientAnnouncement', `system: ${updateUser.nick.substring(7)} has joined teh ratchat`);
							}
						} catch (e: any) {
							socket.emit('toClientMsg', `system error: ${e.message}`);
						}
					}
					if (typeof callback === 'function') callback();
					return;

				case 'color':
					socket.emit("toClientMsg", "system: rainbow mode");
					if (typeof callback === 'function') callback();
					break;
				case 'ban':
					if (args.length === 0) return socket.emit("toClientMsg", "missing target");
					// TODO: Mod verification
					io.emit("toClientMsg", `system: ${fullArgs} has been banned.`);
					if (typeof callback === 'function') callback();
					break;
				case 'timeout':
					if (args.length === 0) return socket.emit("toClientMsg", "missing target");
					// TODO: Mod verification
					io.emit("toClientMsg", `system: ${fullArgs} has been timed out.`);
					if (typeof callback === 'function') callback();
					break;

				case 'delete':
					if (args.length === 0 || isNaN(Number(args[0]))) return socket.emit("toClientMsg", "please provide message id");
					// TODO: Mod verification
					socket.emit("toClientMsg", `system: deleting message ${fullArgs}`);
					if (typeof callback === 'function') callback();
					break;

				case 'announce':
					// TODO: Mod verification
					io.emit("toClientAnnouncement", `announcement: ${fullArgs}`);
					if (typeof callback === 'function') callback();
					break;

				default:
					socket.emit("toClientMsg", "system: that's not a command lol");
			}
			return; // Exit the function since we handled a command
		}

		if (!user) {
		    socket.emit('toClientMsg', "system: please set your nickname with /chrat <nickname> before chatting");
		    if (typeof callback === 'function') callback();
		    return;
		}

		//Check message length	
		if (msg.length > config.maxMsgLen) {
	    	socket.emit("toClientMsg", 'system: sorry your message is too long lmao');
	    	return;
		}
	
		console.log('message: ' + msg);
		
		//Build message JSON Object
		const chatmsg: ChatMessage = {
			id: messageCounter++,
			author: "#fc03baph",
			content: msg,
			timestamp: Date.now(),
			type: "chat message"
		};
		//Send message JSON object to all connected sockets
		io.emit('chat message', chatmsg);

		//Send callback for input clearing
		if (typeof callback === 'function') {
			callback();
		}
    });


    socket.on('disconnect', () => {
	console.log('a user disconnected');
	socketUsers.delete(socket.id);
	if (returningUser){
	io.emit('toClientAnnouncement', `${returningUser.nick.substring(7)} disconnected`);
	}
    });
});


httpserver.listen(config.PORT, () => {
    console.log(JSON.stringify(config));
    console.log(`server running at http://localhost:${config.PORT}`);
});
