//classes
class World {
    constructor() {
        this.height = 30;
        this.width = 30;
        this.squares = [];
    }

    addSquare(square) {
        this.squares.push(square);
    };

    update() {
        for (var i = 0; i < this.squares.length; i++) {
            let outputs=this.squares[i].calculateOutputs();
            if (outputs["right"]) {
                this.squares[i].x+=SQUARESIZE;
            }
            if (outputs["left"]) {
                this.squares[i].x-=SQUARESIZE;
            }
            if (outputs["up"]) {
                this.squares[i].y+=SQUARESIZE;
            }
            if (outputs["down"]) {
                this.squares[i].y-=SQUARESIZE;
            }
        }
    };

    draw() {
        const canvas = document.getElementById("flatland");
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (var i = 0; i < this.squares.length; i++) {
            ctx.beginPath();
            ctx.rect(this.squares[i].x, this.squares[i].y, this.squares[i].width, this.squares[i].height);
            ctx.fillStyle = this.squares[i].color;
            ctx.fill();
            ctx.closePath();
        }
    };
  }

class Being {
    constructor() {
        this.width=SQUARESIZE;
        this.height=SQUARESIZE;
        this.x=50;
        this.y=50;
        this.color="red";
    }
    getInputs() {};
    calculateOutputs() {
        var outputs = {
            "up": null,
            "down": null,
            "left":null,
            "right":null
          };
        for(var key in outputs) {
            outputs[key] = Math.random() < 0.5;
          }
        return outputs;
    };
}

class Logger {
    constructor() {
        this.frameTimes = [];
        this.updateTimes= [];
    }

    logFrameTime(time) {
        this.frameTimes.push(time);
        this.frameTimes = this.frameTimes.slice("-100");
    }

    logUpdateTime(time) {
        this.updateTimes.push(time);
        this.updateTimes = this.updateTimes.slice("-100");
    }

    draw () {
        let avgFrameRate = 1000/(this.frameTimes.reduce((partialSum, a) => partialSum + a, 0)/this.frameTimes.length);
        let avgUpdateRate = 1000/(this.updateTimes.reduce((partialSum, a) => partialSum + a, 0)/this.updateTimes.length);

        var frameRateDiv = document.getElementById("frameRate");
        var updateRateDiv = document.getElementById("updateRate");

        frameRateDiv.innerHTML = avgFrameRate;
        updateRateDiv.innerHTML = avgUpdateRate;

    };
}

//main
const SQUARESIZE = 10;
var frameRate = Math.floor(1000/60);

//create world
var world = new World();
world.addSquare(new Being());

//create logger
var logger = new Logger();

//webworker
var w;

function startWorker() {
  if (typeof(Worker) !== "undefined") {
    if (typeof(w) == "undefined") {
      w = new Worker("webworker.js");
    }
    w.onmessage = function(event) {
      console.log(event.data);
    };
  } else {
    document.getElementById("result").innerHTML = "Sorry! No Web Worker support.";
  }
}

function stopWorker() {
  w.terminate();
  w = undefined;
}

startWorker();


//game loop
var lastUpdate=0;
var lastDraw=0;
var waitTime=500;
function gameLoop(timeStamp) {
    //update loop - run withing one frame time of 1/60s
    while (performance.now()-timeStamp<frameRate) {
        //run if waitTime threshold reached
        if (performance.now()-lastUpdate>waitTime) {
            world.update();
            logger.logUpdateTime(performance.now()-lastUpdate);
            lastUpdate=performance.now();
        }
    }
    //draw
    logger.logFrameTime(timeStamp-lastDraw);
    world.draw();
    logger.draw();
    lastDraw=timeStamp;
    window.requestAnimationFrame(gameLoop);
}

window.requestAnimationFrame(gameLoop);