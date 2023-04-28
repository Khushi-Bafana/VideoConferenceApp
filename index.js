/*
    File Name:- index.js
    Explanation:- This file is used to do every server stuff like RESTfull activities
    and data routing to database interaction to user authentication and is also 
    used as the main router for chat system and video streaming and managing calls.
*/

//will be chunking everything here for now will devide it in multiple files later

const express = require('express');
const path = require('path');
const cookieSession = require('cookie-session');
const bcrypt = require('bcrypt');
const dbConnection = require('./database');
const { body, validationResult } = require('express-validator');

const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);

const chatRooms = [];

app.use(express.urlencoded({ extended:false }));
app.use(express.static(path.join(__dirname, '/public')));

app.use('/scripts', express.static(`${__dirname}/node_modules/`));

//set views and view engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

//create a cookie
app.use(cookieSession({
    name: 'session',
    keys: ['key1', 'key2'],
    maxAge: 3600 * 1000 // 1 hour
}));

const ifNotLoggedIn = (req, res, next) => {
    if (!req.session.isLoggedIn) {
        return res.render('login_register');
    }
    next();
}

const ifLoggedIn = (req, res, next) => {
    if (req.session.isLoggedIn) {
        return res.redirect('/home');
    }
    next();
}

//root page
app.get('/', ifNotLoggedIn, (req, res, next) => {
    dbConnection.execute("SELECT `name` FROM `users` WHERE `id`=?", [req.session.userID])
    .then(([rows]) => {
        res.render('home', {
            name:rows[0].name
        })
    });
});

app.get('/vidChat', ifNotLoggedIn, (req, res, next) => {
    //const { room_id, room_password } = req.body;
    //console.log(req.query.room_id);
    const room_id = req.query.room_id;
    const room_password = req.query.room_password;
    dbConnection.execute("SELECT `name` FROM `users` WHERE `id`=?", [req.session.userID])
    .then(([rows]) => {
        res.render('videoChat', {
            name:rows[0].name,
            roomId: room_id,
            roomPassword: room_password
        })
    });
});

io.on('connection', socket => {
    socket.on('join-room', (roomId, userName) => {
        console.log("[NOTICE]: GOT A NEW ROOM JOIN AT ['" + roomId + "'] FROM USER ['" + userName + "'].");
        socket.join(roomId);
        socket.to(roomId).emit('user-connected', userName);

        socket.on('disconnect', () => {
            socket.to(roomId).emit('user-disconnected', userName);
            console.log("[NOTICE]: USER ['" + userName + "'] DISCONNECTED FROM ROOM ['" + roomId + "'].");
        });
    });
    //will use firebase if this does not work
    socket.on('create-chatRoom', (chatRoomName, chatUserName, RoomIdFC) => {
        var isGroupNotPresent = true;
        console.log("[NOTICE]: GOT A NEW CHAT ROOM JOIN AT ['" + chatRoomName + "'] FROM USER ['" + chatUserName + "'].");
        for (const chatRoomNameH of chatRooms) {
            if (chatRoomNameH === chatRoomName) {
                isGroupNotPresent = false;
                console.log("[FATAL]: CHAT ROOM NAME BY " + chatUserName + " NOT ALLOWED BECAUSE OF REPETATION.");
                break;
            }
        }
        if (isGroupNotPresent) {
            socket.to(RoomIdFC).emit('chatUser-connected', chatUserName, chatRoomName);
            chatRooms.push(chatRoomName);
        }
        socket.on('sendMessage', (message, chatUserName) => {
            socket.to(RoomIdFC).emit('messageHere', message, chatUserName, chatRoomName);
            console.log("[INFO]: GOT A NEW CHAT MESSAGE ['" + message.message + "'] FROM ['" + chatUserName + "'] FROM CHAT ROOM ['" + chatRoomName + "'].");
        });
        socket.on('chatUser-disconnected', () => {
            socket.to(RoomIdFC).emit('chatUser-disconnectedH', chatUserName, chatRoomName);
        });
    });
    socket.on('join-chatRoom', (chatRoomName, chatUserName, RoomIdFC) => {
        var isGroupPresent = false;
        console.log("[NOTICE]: GOT A NEW CHAT ROOM JOIN AT ['" + chatRoomName + "'] FROM USER ['" + chatUserName + "'].");
        for (const chatRoomNameH of chatRooms) {
            if (chatRoomNameH === chatRoomName) {
                isGroupPresent = true;
                break;
            }
        }
        if (isGroupPresent) {
            socket.to(RoomIdFC).emit('chatUser-connected', chatUserName, chatRoomName);
            chatRooms.push(chatRoomName);
        }
        socket.on('sendMessage', (message, chatUserName) => {
            socket.to(RoomIdFC).emit('messageHere', message, chatUserName, chatRoomName);
            console.log("[INFO]: GOT A NEW CHAT MESSAGE ['" + message.message + "'] FROM ['" + chatUserName + "'] FROM CHAT ROOM ['" + chatRoomName + "'].");
        });
        socket.on('chatUser-disconnected', () => {
            socket.to(RoomIdFC).emit('chatUser-disconnected', chatUserName, chatRoomName);
        });
    });
});

//register page
app.post('/register', ifLoggedIn,
//post data validation
[
    body('user_email', 'Invalid email').isEmail().custom((value) => {
        return dbConnection.execute('SELECT `email` FROM `users` WHERE `email`=?', [value])
        .then(([rows]) => {
            if (rows.length > 0) {
                return Promise.reject('This Email already in use');
            }
            return true;
        });
    }),
    body('user_name', 'Username is Empty').trim().not().isEmpty(),
    body('user_pass', 'The password must be minimum length 6 characters').trim().isLength({ min: 6 }),
],
(req, res, next) => {
    const validation_result = validationResult(req);
    const { user_name, user_pass, user_email } = req.body;
    //if no error
    if (validation_result.isEmpty()) {
        //create the hash pass
        bcrypt.hash(user_pass, 12).then((hash_pass) => {
            dbConnection.execute("INSERT INTO `users` (`name`, `email`, `password`) VALUES(?, ?, ?)", [user_name, user_email, hash_pass])
            .then(result => {
                res.send(`Your Account has been created succesfully, Now you can <a href="/">Login</a>`);
            }).catch(err => {
                if (err) throw err;
            });
        })
        .catch(err => {
            if (err) throw err;
        })
    } else {
        //collecting all the errors
        let allErrors = validation_result.errors.map((error) => {
            return error.msg;
        });
        //rendering the errors on the login page
        res.render('login_register', {
            register_error:allErrors,
            old_data:req.body
        });
    }
});

//Login Part
app.post('/', ifLoggedIn, [
    body('user_email').custom((value) => {
        return dbConnection.execute('SELECT `email` FROM `users` WHERE `email`=?', [value])
        .then(([rows]) => {
            if (rows.length == 1) {
                return true;
            }
            return Promise.reject('Invalid Email Address');
        })
    }),
    body('user_pass', 'Password is empty').trim().not().isEmpty(),
], (req, res) => {
    const validation_result = validationResult(req);
    const { user_pass, user_email } = req.body;
    if (validation_result.isEmpty()) {
        dbConnection.execute("SELECT * FROM `users` WHERE `email`=?", [user_email])
        .then(([rows]) => {
            bcrypt.compare(user_pass, rows[0].password).then(compare_result => {
                if (compare_result === true) {
                    req.session.isLoggedIn = true;
                    req.session.userID = rows[0].id;
                    res.redirect('/');
                } else {
                    res.render('login_register', {
                        login_errors:['Invalid Password!']
                    });
                }
            })
            .catch(err => {
                if (err) throw err;
            });
        }).catch(err => {
            if (err) throw err;
        });
    } else {
        let allErrors = validation_result.errors.map((error) => {
            return error.msg;
        });
        res.render('login_register', {
            login_errors:allErrors
        });
    }
});

//Logout
app.get('/logout', (req, res) => {
    //distroy the session
    req.session = null;
    res.redirect('/');
});

app.get('/getBack', (req, res) => {
    res.redirect('/');
});
//gotta have this lol
app.use('/', (req, res) => {
    res.status(404).send('<h1>404 Page Not Found!</h1>');
});

server.listen(3000, () => console.log("SERVER is RUNNING AT PORT 3000."));