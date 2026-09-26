const express=require("express"),http=require("http"),{Server}=require("socket.io"),fs=require("fs"),path=require("path");
const app=express(),server=http.createServer(app),io=new Server(server);
const questions=JSON.parse(fs.readFileSync(path.join(__dirname,"questions.json"),"utf8"));
app.use(express.static(path.join(__dirname,"public")));
const rooms=new Map();
function code(){let s="";for(let i=0;i<5;i++)s+=Math.floor(Math.random()*10);return s}
function norm(s){return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").replace(/[^a-z0-9 ]/g,"").replace(/\s+/g," ").trim()}
function publicPlayers(r){return [...r.players.values()].map(p=>({id:p.id,name:p.name,score:p.score,host:p.host})).sort((a,b)=>b.score-a.score)}
io.on("connection",socket=>{
 socket.on("createRoom",({name},cb)=>{let c=code();while(rooms.has(c))c=code();let r={host:socket.id,index:-1,active:false,players:new Map(),answered:new Set(),timer:null};r.players.set(socket.id,{id:socket.id,name:String(name||"Host").slice(0,20),score:0,host:true});rooms.set(c,r);socket.join(c);socket.data.room=c;cb({ok:true,code:c,host:true});io.to(c).emit("players",publicPlayers(r));});
 socket.on("joinRoom",({code,name},cb)=>{let r=rooms.get(String(code||""));if(!r)return cb({ok:false,msg:"Không tìm thấy phòng"});if(r.active)return cb({ok:false,msg:"Ván chơi đã bắt đầu"});r.players.set(socket.id,{id:socket.id,name:String(name||"Người chơi").slice(0,20),score:0,host:false});socket.join(code);socket.data.room=code;cb({ok:true,code});io.to(code).emit("players",publicPlayers(r));});
 socket.on("start",()=>{let r=rooms.get(socket.data.room);if(!r||r.host!==socket.id)return;if(r.players.size<1)return;r.active=true;r.index=0;sendQuestion(socket.data.room)});
 socket.on("answer",({text})=>{let c=socket.data.room,r=rooms.get(c);if(!r||!r.active||r.answered.has(socket.id))return;let q=questions[r.index];if(norm(text||"")===norm(q.a)){r.answered.add(socket.id);let p=r.players.get(socket.id);p.score+=Math.max(1,Math.ceil((r.deadline-Date.now())/1000));io.to(c).emit("answered",{name:p.name,correct:true});if(r.answered.size===r.players.size)next(c)}});
 socket.on("next",()=>{let c=socket.data.room,r=rooms.get(c);if(r&&r.host===socket.id)next(c)});
 socket.on("disconnect",()=>{let c=socket.data.room,r=rooms.get(c);if(!r)return;r.players.delete(socket.id);if(r.host===socket.id){r.host=[...r.players.keys()][0]||null;if(r.host)r.players.get(r.host).host=true}io.to(c).emit("players",publicPlayers(r));if(!r.players.size){clearTimeout(r.timer);rooms.delete(c)}})
});
function sendQuestion(c){let r=rooms.get(c);if(!r)return;if(r.index>=questions.length){r.active=false;io.to(c).emit("finished",publicPlayers(r));return}r.answered.clear();r.deadline=Date.now()+20000;io.to(c).emit("question",{index:r.index,total:questions.length,cat:questions[r.index].cat,q:questions[r.index].q,endsAt:r.deadline});clearTimeout(r.timer);r.timer=setTimeout(()=>next(c),20500)}
function next(c){let r=rooms.get(c);if(!r)return;r.index++;sendQuestion(c)}
const port=process.env.PORT||3000;server.listen(port,()=>console.log("Listening on "+port));
