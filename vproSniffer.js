/*
__ __  ____  ____   ___   _____ ____   ____  _____  _____  ___  ____  
|  |  ||    \|    \ /   \ / ___/|    \ |    ||     ||     |/  _]|    \ 
|  |  ||  o  )  D  )     (   \_ |  _  | |  | |   __||   __/  [_ |  D  )
|  |  ||   _/|    /|  O  |\__  ||  |  | |  | |  |_  |  |_|    _]|    / 
|  :  ||  |  |    \|     |/  \ ||  |  | |  | |   _] |   _]   [_ |    \ 
 \   / |  |  |  .  \     |\    ||  |  | |  | |  |   |  | |     ||  .  \
  \_/  |__|  |__|\_|\___/  \___||__|__||____||__|   |__| |_____||__|\_|
                                                                       
*/


const { sign } = require('crypto');
const fs = require('fs');
const WebSocket = require('ws');

const express = require('express');
const bodyParser = require('body-parser');
var cors = require('cors');
const { response, request, query } = require('express');

//Import Config
let configBuffer = fs.readFileSync('config.json');
let configFile = JSON.parse(configBuffer);
var settings = configFile.settings;

//Setup WebServer
var webServer = express();
webServer.use(bodyParser.json({ extended: true }));
webServer.options('*', cors()) //CORS Security Option
webServer.use(express.static('./'));
webServer.listen(settings.webPort, () => {
    //console.log("WebServer running on port " + settings.webPort);
    console.log("Open a web browser to http://127.0.0.1:" + settings.webPort + "/web/live.html?signal=1");
    console.log("Replace the 'signal=1' with whatever signal you want to monitor.");
});

if (settings.devMode) {
    var wsUrl = ("ws://" + "127.0.0.1:1880" + "/socketJpgBinary");
} else {
    var wsUrl = ("ws://" + settings.vProIp + "/socketJpgBinary");
}

var jpgWeb = {
    CV: "1",
    CT: "EV",
    OBA: {
        OBC: "JpgGen",
        OBI: "0",
        OPA: {
            OPC: "subscribe",
            PAA: ""
        }
    }
};

if (settings.wsOnStart && (settings.frameDiscardInterval > 9)) {
    console.log("Starting WS..");
    var socket = new WebSocket(wsUrl);
    var signal = 0;
    var recieved = 0;
    var pictureBuffer = [];

    socket.onerror = function (event) {
        console.error("WebSocket error observed:", event);
    };

    socket.onopen = function (event) {
        console.log("WebSocket is open");
        if (settings.debugging) {
            console.log("Sending Subscribe msg...")
        }
        socket.send(JSON.stringify(jpgWeb));
        console.log("Running! Your pip images are in the 'output' folder.");
        console.log("Capturing every " + settings.frameDiscardInterval + "th frame.");
    };

    socket.onclose = function (event) {
        console.log("WebSocket is closed");
    };

    socket.onmessage = function (event) {
        recieved++;
        let payload = event.data.toString('hex');

        let filename;

        if (payload.length < 3) {
            signal = event.data.charCodeAt(1);
            //console.log("Signal: " + signal);
        }

        if (payload.length > 3) {
            if (typeof signal == 'number') {
                if (pictureBuffer[signal] == undefined) {
                    pictureBuffer[signal] = {};
                }
                pictureBuffer[signal].data = event.data;

                if (pictureBuffer[signal].count == undefined) {
                    pictureBuffer[signal].count = 0;
                } else {
                    pictureBuffer[signal].count++;
                }

                let x = (pictureBuffer[signal].count / settings.frameDiscardInterval);

                if (Number.isInteger(x)) {
                    filename = (settings.dumpDirectory + "Signal-" + signal + ".jpg");
                    fs.writeFile(filename, pictureBuffer[signal].data, 'base64', (err) => {
                        if (err) throw err;
                    });
                }


            }
            if (settings.debugging) {
                console.log("Received Msg " + recieved);
            }
        }
    }
}
