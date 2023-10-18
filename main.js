//classes
class World {
    constructor() {
        this.height = 30;
        this.width = 30;
        this.squares = [];
        this.state=Array.from(new Array(this.height), () => new Array(this.width).fill())
        this.nextState=[];
    }

    addSquare(square) {
        this.squares.push(square);
    };

    generate() {
        //generate terrain
        for (let i = 0; i < this.height; i++) {
            for (let j = 0; j < this.width; j++) {
                this.state[i][j] = new Array();
                this.state[i][j].push(new Earth());
            };
        };

        //generate border
        for (var i = 0; i < this.height; i++) {
            for (var j = 0; j < this.width; j++) {
                if (i == 0 || i == this.height-1 || j == 0 || j == this.width-1) {
                    this.state[i][j].push(new Rock());
                }
            }
        }

        //generate solids

        //generate grass
        
        var grassPercentage = 0.2;
        var grassNumber = this.height * this.width * grassPercentage;
        while (grassNumber > 0) {
            var i = Math.floor(Math.random() * this.height);
            var j = Math.floor(Math.random() * this.width);
            if (this.state[i][j].length > 1) {
                continue;
            }
            this.state[i][j].push(new Grass());
            grassNumber--;
        }
        

        //generate actors
        
        while (true) {
            var i = Math.floor(Math.random() * this.height);
            var j = Math.floor(Math.random() * this.width);
            if (this.state[i][j].length > 1) {
                continue;
            }
            this.state[i][j].push(new Robot());
            break;
        }
        
    }


    update() {
        for (var i = 0; i < this.squares.length; i++) {
            let outputs=this.squares[i].update();
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
    }

    draw() {
        const canvas = document.getElementById("flatland");
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (var i = 0; i < this.height; i++) {
            for (var j = 0; j < this.width; j++) {
                // determine which object to draw at top
                var max=-1;
                var objectToDraw;
                for (var x = 0; x < this.state[i][j].length; x++){
                    if (this.state[i][j][x].z > max) {
                        objectToDraw = this.state[i][j][x];
                    }
                }
                // draw object
                ctx.beginPath();
                ctx.rect(i * SQUARESIZE, j * SQUARESIZE, objectToDraw.width, objectToDraw.height);
                ctx.fillStyle = objectToDraw.color;
                ctx.fill();
                ctx.closePath();
            }
        }
    }
  }

class Robot {
    constructor(x,y) {
        this.type="actor";
        this.width=SQUARESIZE;
        this.height=SQUARESIZE;
        this.x=x;
        this.y=y;
        this.z=2;
        this.color="red";
    }
    getInputs() {};
    update() {
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
    }
}

class Rock {
    constructor() {
        this.type="solid";
        this.width=SQUARESIZE;
        this.height=SQUARESIZE;
        this.z=1;
        this.color="gray";
    }
}

class Grass {
    constructor(x,y) {
        this.type="item";
        this.width=SQUARESIZE;
        this.height=SQUARESIZE;
        this.x=x;
        this.y=y;
        this.z=1;
        this.color="green";
    }
}

class Earth {
    constructor(x,y) {
        this.type="terrain";
        this.width=SQUARESIZE;
        this.height=SQUARESIZE;
        this.x=x;
        this.y=y;
        this.z=0;
        this.color="brown";
    }
}

class Logger {
    constructor() {
        this.frameTimes = [];
        this.updateTimes= [];
        this.updateCount= [];
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
        var updateCountDiv = document.getElementById("updateCount");

        frameRateDiv.innerHTML = avgFrameRate;
        updateRateDiv.innerHTML = avgUpdateRate;
        updateCountDiv.innerHTML = this.updateCount;

    };
}

//main
const SQUARESIZE = 10;

//create world
var world = new World();
world.generate();
world.draw();
//world.addSquare(new Robot(50,50));

//create logger
var logger = new Logger();

//GAME LOOP
var lastDraw = 0;
var speed = 1000/1; //updates per 1000 miliseconds
var doUpdate = 0;
var lastUpdate = 0;
var lastUpdateCycle = 0;
//UPDATE LOOP // webworker - the world update function works via a web worker because requestAnimationFeame stops when tab is not in focus.
var w = new Worker("webworker.js");
w.onmessage = function(event) {
    doUpdate += (performance.now()-lastUpdateCycle)/speed;
    while (Math.floor(doUpdate>0)) {
        world.update();
        logger.logUpdateTime(performance.now()-lastUpdate);
        logger.updateCount++;
        lastUpdate = performance.now();
        doUpdate--;
    }
    lastUpdateCycle = performance.now();   
  };
//DRAWING LOOP // the drawing loop works via requestAnimationFrame
function drawingLoop(timeStamp) {
    logger.logFrameTime(timeStamp-lastDraw);
    world.draw();
    logger.draw();
    lastDraw=timeStamp;
    window.requestAnimationFrame(drawingLoop);
}
window.requestAnimationFrame(drawingLoop);