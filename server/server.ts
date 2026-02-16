import { Server } from 'socket.io';
import express from 'express';
//import type { Identity } from './shared/types';
import { createServer } from 'http';
import { dirname, join } from 'path';
import { fileURLToPath } from 'node:url';
import { writeFileSync, readFileSync } from 'fs';
import type { ChatMessage } from '../shared/types.ts';

const config = JSON.parse(readFileSync('./config.json'));
const app = express();
const httpserver = createServer(app);
const io = new Server(httpserver, {
		     connectionStateRecovery: {}
});

const __dirname = dirname(fileURLToPath(import.meta.url));

app.get('/ratchat', (req, res) => {
    res.sendFile('www/ratchat.html', { root : __dirname });
});

let messageCounter = 0;

io.on('connection', (socket) => {
    //A new user has connected	
	console.log('a user connected');
	socket.emit("toClientWelcome", `Welcome: ${config.welcomeMsg}`)


	//When a message is recieved from a client
	socket.on('chat message', (msg) => {
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
    });


    socket.on('disconnect', () => {
	console.log('a user disconnected');
    });
});


httpserver.listen(config.PORT, () => {
    console.log(JSON.stringify(config));
    console.log(`server running at http://localhost:${config.PORT}`);
});
