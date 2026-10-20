const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');
const { characters } = require('./rosters');
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true }, maxHttpBufferSize: 1e6 });
app.use(express.static('public'));
app.get('/health', (_req,res)=>res.json({ok:true}));
app.get('/api/roster-counts', (_req,res)=>res.json({total:characters.length,marvel:characters.filter(c=>c.pack==='Marvel Rivals').length,league:characters.filter(c=>c.pack==='League of Legends').length}));
const rooms = new Map();
const norm = s => String(s||'').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g,'');
const clean = (s,max=20) => String(s||'').trim().slice(0,max).replace(/[<>]/g,'');
function code(){let c; do { c=crypto.randomBytes(3).toString('hex').toUpperCase(); } while(rooms.has(c)); return c;}
function shuffle(arr){const a=[...arr];for(let i=a.length-1;i>0;i--){const j=crypto.randomInt(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
function roomBySocket(socket){const r=socket.data.roomCode; return r && rooms.get(r);}
function publicPlayer(p, viewerId, room){
 const isOwn=p.id===viewerId;
 return {id:p.id,name:p.name,host:p.host,connected:p.connected,hasGuessed:!!p.won,character:(!isOwn || p.won) && room.started && p.character ? {name:p.character.name,pack:p.character.pack,page:p.character.page,img:p.character.img,search:p.character.search,slug:p.character.slug}:null, isYou:isOwn};
}
function emitState(room){
 for(const p of room.players){if(!p.connected)continue;const s=io.sockets.sockets.get(p.id);if(!s)continue;
  s.emit('state',{code:room.code,pack:room.pack,started:room.started,hostId:room.hostId,players:room.players.map(x=>publicPlayer(x,p.id,room)),own:room.started&&p.character?{name:p.won?p.character.name:null,pack:p.won?p.character.pack:null,won:p.won}:null,activity:room.activity.slice(-12),rosterCount:room.pool.length});
 }
}
function say(room,msg){room.activity.push({id:crypto.randomBytes(4).toString('hex'),text:msg,at:Date.now()});room.activity=room.activity.slice(-30);}
function leaveRoom(socket){const room=roomBySocket(socket);if(!room)return;const p=room.players.find(x=>x.id===socket.id);if(p){p.connected=false;say(room,`${p.name} disconnected.`);}socket.data.roomCode=null;
 room.players=room.players.filter(x=>x.connected || (room.started&&x.character));
 if(!room.players.length){rooms.delete(room.code);return;}
 if(room.hostId===socket.id){const next=room.players.find(x=>x.connected);room.hostId=next?.id||null;if(next)next.host=true;}
 emitState(room);
}
io.on('connection', socket=>{
 socket.on('createRoom',(data={},cb=()=>{})=>{
  const name=clean(data.name);const pass=String(data.password||'');const pack=['Marvel Rivals','League of Legends','Mixed'].includes(data.pack)?data.pack:'Mixed';
  if(!name)return cb({ok:false,error:'Enter a username.'});if(pass.length>64)return cb({ok:false,error:'Password is too long.'});
  const roomCode=code();const pool=characters.filter(c=>pack==='Mixed'||c.pack===pack);
  const room={code:roomCode,password:pass,pack,hostId:socket.id,players:[],started:false,pool,activity:[]};rooms.set(roomCode,room);
  room.players.push({id:socket.id,name,host:true,connected:true,character:null,won:false});socket.data.roomCode=roomCode;say(room,`${name} created the room.`);emitState(room);cb({ok:true,code:roomCode});
 });
 socket.on('joinRoom',(data={},cb=()=>{})=>{
  const name=clean(data.name);const roomCode=clean(data.code,8).toUpperCase();const room=rooms.get(roomCode);
  if(!name)return cb({ok:false,error:'Enter a username.'});if(!room)return cb({ok:false,error:'Room not found. Check the code and try again.'});if(room.password!==String(data.password||''))return cb({ok:false,error:'Wrong room password.'});if(room.started)return cb({ok:false,error:'This round has already started. Ask the host to create a new room.'});if(room.players.some(p=>p.connected&&norm(p.name)===norm(name)))return cb({ok:false,error:'That username is already in this room.'});
  if(room.players.length>=room.pool.length)return cb({ok:false,error:'This room has reached the character limit.'});
  room.players.push({id:socket.id,name,host:false,connected:true,character:null,won:false});socket.data.roomCode=roomCode;say(room,`${name} joined the room.`);emitState(room);cb({ok:true,code:roomCode});
 });
 socket.on('startGame',(cb=()=>{})=>{
  const room=roomBySocket(socket);if(!room)return cb({ok:false,error:'Join a room first.'});if(socket.id!==room.hostId)return cb({ok:false,error:'Only the host can start the game.'});if(room.started)return cb({ok:false,error:'The round has already started.'});const active=room.players.filter(p=>p.connected);if(active.length<2)return cb({ok:false,error:'At least two real players are needed to start.'});
  const deck=shuffle(room.pool);active.forEach((p,i)=>{p.character=deck[i];p.won=false;});room.started=true;say(room,`The host started the round. ${active.length} unique characters assigned.`);emitState(room);cb({ok:true});
 });
 socket.on('guess',(raw,cb=()=>{})=>{
  const room=roomBySocket(socket);const p=room?.players.find(x=>x.id===socket.id);if(!room||!p||!room.started||!p.character)return cb({ok:false,error:'The round has not started.'});if(p.won)return cb({ok:false,error:'You have already guessed correctly.'});
  const guess=norm(raw);if(!guess)return cb({ok:false,error:'Type a character name first.'});const correct=guess===norm(p.character.name)||guess===norm(p.character.name.replace(/^The /,''));
  if(correct){p.won=true;say(room,`${p.name} guessed correctly!`);emitState(room);cb({ok:true,correct:true,message:`Correct! You are ${p.character.name}.`});}
  else {say(room,`${p.name} made a guess.`);emitState(room);cb({ok:true,correct:false,message:'Not quite — try another name.'});}
 });
 socket.on('restartRound',(cb=()=>{})=>{const room=roomBySocket(socket);if(!room)return cb({ok:false,error:'Join a room first.'});if(socket.id!==room.hostId)return cb({ok:false,error:'Only the host can start a new round.'});room.started=false;room.players.forEach(p=>{p.character=null;p.won=false;});say(room,'The host reset the room for a new round.');emitState(room);cb({ok:true});});
 socket.on('leaveRoom',()=>{leaveRoom(socket);socket.disconnect(true);});
 socket.on('disconnect',()=>leaveRoom(socket));
});
const port=process.env.PORT||3000;server.listen(port,'0.0.0.0',()=>console.log(`Forehead online listening on ${port}; ${characters.length} characters loaded.`));
