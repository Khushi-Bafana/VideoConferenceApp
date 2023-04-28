const socket = io('/');
const videoContainer = document.getElementById('local-video');
const remoteVideoGrid = document.getElementById('remoteVideos');
var isVideoOn = true; var isAudioOn = true; var idCounter = 1;
var modal = document.getElementById("videoModal");
var span = document.getElementsByClassName("close")[0];
var create_button = document.getElementById("create-btn");
var join_button = document.getElementById("join-btn");
var chatUserName, chatRoomName;
const myPeer = new Peer(userName, {
    host: '/',
    port: '3001'
});

const localVideo = document.createElement("video");
localVideo.muted = true;

const peers = {};
var audioFunc = true;
var videoFunc = true;

navigator.mediaDevices.getUserMedia({
    video: videoFunc,
    audio: audioFunc
}).then(stream => {
    addVideoStream(localVideo, stream);

    myPeer.on('call', call => {
        call.answer(stream);
        const video = document.createElement('video');
        call.on('stream', userVideoStream => {
            addRemoteVideos(video, userVideoStream);
        });
    });

    socket.on('user-connected', userName => {
        connectToNewUser(userName, stream);
        console.log("user-connected: " + userName);
        showSnackMessage(userName + " connected!!!");
    });
});

socket.on('user-disconnected', userName => {
    if (peers[userName])
        peers[userName].close();
    console.log("user " + userName + " disconnected");
    showSnackMessage(userName + " disconnected!!!");
});

const switchCameraOff = (option) => { 
    var vButton = document.getElementById("videoStat");
    if (isVideoOn) {
        vButton.value = "Video Off";
        vButton.className = "btn btn-danger";
        isVideoOn = false; videoFunc = false;
    } else {
        vButton.value = "Video On";
        vButton.className = "btn btn-success";
        isVideoOn = true; videoFunc = true;
    }
};

const switchAudioOff = (option) => { 
    var aButton = document.getElementById("audioStat");
    if (isAudioOn) {
        aButton.value = "Audio Off";
        aButton.className = "btn btn-danger";
        isAudioOn = false; audioFunc = false;
        //stream_extra.getAudioTracks()[0].enabled = false;
    } else {
        aButton.value = "Audio On";
        aButton.className = "btn btn-success";
        isAudioOn = true; audioFunc = true;
        //stream_extra.getAudioTracks()[0].enabled = true;
    }
};

const formEl = $('.form');
const chatEl = $('#chat');
const chatTemplate = Handlebars.compile($('#chat-template').html());
const chatContentTemplate = Handlebars.compile($('#chat-content-template').html());
const chatLocalMessages = [];
var postMessageS = document.getElementById("post-btn");
let username;

socket.on('chatUser-connected', (chatUserName, chatRoomNameS) => {
    //console.log(chatRoomName);
    if (chatRoomName === chatRoomNameS) {
        //console.log("GOT HERE CON");
        console.log("user of chat connected" + chatUserName);
    }
});

socket.on('messageHere', (message, chatUserName, chatRoomNameS) => {
    if (chatRoomName === chatRoomNameS) {
        //console.log(chatRoomName);
        console.log(chatUserName + ": " + message.message);
        chatLocalMessages.push(message);
        updateChatMessages();
    }
});

socket.on('chatUser-disconnectedH', (chatUserName, chatRoomNameS) => {
    if (chatRoomName === chatRoomNameS) {
        console.log("chat user disconnected" + chatUserName);
    }
});

const nulifyShit = (shitArray) => {
    for (const shits of shitArray) {
        shits.value = null;
    }
};

const updateChatMessages = () => {
    //console.log(chatLocalMessages);
    console.log("GOT HERE" + chatLocalMessages.message);
    const html = chatContentTemplate({ chatLocalMessages });
    const chatContentEl = $('#chat-content');
    chatContentEl.html(html);
    const scrollHeight = chatContentEl.prop('scrollHeight');
    chatContentEl.animate({ scrollTop: scrollHeight }, 'slow');
};

const postMessage = (message) => {
    username = $("#username").val();
    const chatMessage = {
        username,
        message,
        postedOn: new Date().toLocaleString('en-GB'),
    };
    console.log(chatMessage.username);
    socket.emit('sendMessage', chatMessage, chatUserName);
    chatLocalMessages.push(chatMessage);
    updateChatMessages();
    $('#post-message').val('');
    //nulifyShit([document.getElementById('post-message')]);
};

const showChatRoom = (user, room) => {
    formEl.hide();
    const html = chatTemplate({ room });
    chatEl.html(html);
    const postForm = $('form');
    $('#post-btn').on('click', () => {
        const message = $('#post-message').val();
        postMessage(message);
    });
};

create_button.onclick = function() {
    chatUserName = document.getElementById("username").value;
    chatRoomName = document.getElementById("roomName").value;
    socket.emit('create-chatRoom', chatRoomName, chatUserName, RoomId);
    showChatRoom(chatUserName, chatRoomName);
    postMessage(`${ chatUserName } created chatroom!`);
    //nulifyShit([document.getElementById("username"), document.getElementById("roomName")]);
    $('username').val(''); $('roomName').val('');
}

join_button.onclick = function() {
    chatUserName = document.getElementById("username").value;
    chatRoomName = document.getElementById("roomName").value;
    socket.emit('join-chatRoom', chatRoomName, chatUserName, RoomId);
    showChatRoom(chatUserName, chatRoomName);
    postMessage(`${ chatUserName } joined chatroom`);
    nulifyShit([document.getElementById("username"), document.getElementById("roomName")]);
}

myPeer.on('open', userName1 => {
    socket.emit('join-room', RoomId, userName);
});

function showSnackMessage(messageHere) {
    var sMessage = document.getElementById("snackbar");
    sMessage.innerHTML = messageHere;
    sMessage.className = "show";
    setTimeout(function () {
        sMessage.className = sMessage.className.replace("show", "");
    }, 1700);
}

function connectToNewUser(userName, stream) {
    const call = myPeer.call(userName, stream);
    const video = document.createElement('video');
    call.on('stream', userVideoStream => {
        addRemoteVideos(video, userVideoStream);
    });
    call.on('close', () => {
        video.remove();
    });
    peers[userName] = call;
}

function addRemoteVideos(video, stream) {
    const largeVideo = document.getElementById('enlargeVideo');
    const video_extra = document.createElement('video');
    var stream_extra = stream;
    video.srcObject = stream;
    video_extra.srcObject = stream;
    video.addEventListener('loadedmetadata', () => {
        video.play();
    });
    video_extra.addEventListener('loadedmetadata', () => {
        video_extra.play();
        stream_extra.getAudioTracks()[0].enabled = false;
    });
    video.setAttribute("id", "vidio" + idCounter);
    //This is onclicked and should work i think
    video.onclick = function() {
        modal.style.display = "block";
        largeVideo.replaceWith(video_extra);
    }
    remoteVideoGrid.append(video);
    idCounter += 1;
}

function addVideoStream(video, stream) {
    const largeVideo = document.getElementById('enlargeVideo');
    const video_extra = document.createElement('video');
    var stream_extra = stream;
    video.srcObject = stream;
    video_extra.srcObject = stream;
    video.addEventListener('loadedmetadata', () => {
        video.play();
    });
    //This is onclicked and should work i think
    video_extra.addEventListener('loadedmetadata', () => {
        video_extra.play();
        stream_extra.getAudioTracks()[0].enabled = false;
    });
    video.onclick = function() {
        modal.style.display = "block";
        largeVideo.replaceWith(video_extra);
    }
    videoContainer.append(video);
}

//Modal interaction code here
span.onclick = function() {
    modal.style.display = "none";
}

window.onclick = function(event) {
    if (event.target == modal) {
        this.modal.style.display = "none";
    }
}
