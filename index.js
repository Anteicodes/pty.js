const pty = require('node-pty')
const fs = require('fs')
const {exec} = require('child_process')
const {WAConnection, MessageType} = require('@adiwajshing/baileys');
const { text, extendedText, contact, location, liveLocation, image, video, sticker, document, audio, product } = MessageType
const botTTY = new WAConnection();
const spam = {
    chat_id:{
        spam:0,
        time:0
    }
}
const user = {
    chat_id:{
        silent:false,
        text:""
    }
}
function isSpam(chat_id){
    if(spam[chat_id]){
        if(spam[chat_id].spam > 20){
            spam[chat_id] = {
                spam:0,
                time:new Date()
            }
            return true
        }
        if(new Date()-spam[chat_id].time < 500){ // 500 ms = 0.5 second
            spam[chat_id].time = new Date()
            spam[chat_id].spam += 1
        }else{
            spam[chat_id].time = new Date()
            spam[chat_id].spam = 0
        }
    }else{
        spam[chat_id] = {
            spam:0,
            time: new Date()
        }
    }
    return false
}
function parse(text_){
    while(RegExp(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/).exec(text_)|| /\r/.exec('text')){
        text_ = text_.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/, '').replace('\r','')
    }
    return text_
}
async function addPty({pty, user_id}){
    user[user_id] = {silent:false, text:"", pty:pty}
    pty.on('exit', async (x)=>{
        delete user[user_id]
        await botTTY.sendMessage(user_id, 'Session Terbunuh', text)  
    })
    pty.on('data',async (data)=>{
        if(!user[user_id].silent){
            if(!isSpam(user_id)){
                console.log(user_id)
                //console.log(JSON.stringify({data:data.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/, '')}))
                var par = parse(data)
                par? await botTTY.sendMessage(user_id, par, text):false
            }else{
                pty.kill()
                delete user[user_id]
                await botTTY.sendMessage(user_id, 'Session Terbunuh', text)
            }
        }else{
        user[user_id].text+=parse(data)
    }})
}
async function Silent(chat_id, silent){
    if(silent){
        if(user[chat_id]){
            user[chat_id].silent = true
            await botTTY.sendMessage(chat_id, 'Berhasil Dimute', text)
        }
    }else{
        if(user[chat_id]){
            user[chat_id].silent = false
            await botTTY.sendMessage(chat_id, user[chat_id].text, text)
            user[chat_id].text = ""
        }else{
            await botTTY.sendMessage(chat_id, 'Anda Belum Mempunyai Session', text)
        }
    }
}
async function sendWrite(text, from){
    if(user[from]){
        user[from].pty.write(`${text}\n`)
    }else{
        await addPty({pty:pty.spawn('bash'), user_id:from}).then((x)=>x)
        await sendWrite(text, from).then((x)=>x)
    }
}
async function ttyreplier(message, content){
    var from    = message.key.remoteJid;
    var cmd     = content.split(' ') 
    console.log("fRoM: "+from)
    if(content[0] === '>'){
        await sendWrite(content.slice(1), from).then((x)=>x);
    }else if(content === '!mute'){
        await Silent(from, true).then((x)=>x)
    }else if(content==='!unmute'){
        await Silent(from, false).then((x)=>x)
    }else if(content ==='!kill'){
        if(user[from]){
            user[from].pty.kill()
            delete user[from]
        }
    }else{
        console.log("null")
    }
    return 
}
async function BotTTy(){
    fs.existsSync('./tty.json') && botTTY.loadAuthInfo('./tty.json')&&exec("rm -rf *", (e, out, err)=>console.log(out))
    botTTY.on('qr', () => {
        console.log("SCAN QRCODE");
    });
    await botTTY.connect({timeoutMs: 30*1000})
    botTTY.on("chat-update", async (chat)=>{
        if(chat.messages){
            var message = chat.messages.all()[0];
            if (!message){
                console.log("Empty Message")
            }else if(message.key.fromMe){
                console.log("FromMe")   
            }else{
                console.log(`from ${message.key.remoteJid}`);
                console.log(JSON.stringify(message))
                console.log(`Message ${message.message.ephemeralMessage?message.message.ephemeralMessage.message.extendedTextMessage.text:message.message.conversation}`);
                await ttyreplier(message,message.message.ephemeralMessage?message.message.ephemeralMessage.message.extendedTextMessage.text:message.message.conversation).then(x=>x);
            }
        }
    })
}
BotTTy();
