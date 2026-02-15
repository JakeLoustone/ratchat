import { Server } from 'socket.io';
import express from 'express';
//import { Identity } from './services/identity';
import { createServer } from 'http';
import { dirname, join } from 'path';
import { fileURLToPath } from 'node:url';
import { writeFileSync, readFileSync } from 'fs';

const config = JSON.parse(readFileSync('./config.json'))
const app = express();
const httpserver = createServer(app);
const io = new Server(httpserver, {
		     connectionStateRecovery: {}
});

const __dirname = dirname(fileURLToPath(import.meta.url));

app.get('/ratchat', (req, res) => {
    res.sendFile('www/ratchat.html', { root : __dirname });
});

io.on('connection', (socket) => {
    console.log('a user connected');
    socket.on('chat message', (msg) => {
	console.log('message: ' + msg);
	io.emit('chat message', msg)
    });
    socket.on('disconnect', () => {
	console.log('a user disconnected');
    });
});


httpserver.listen(config.PORT, () => {
    console.log(`server running at http://localhost:${config.PORT}`);
});
