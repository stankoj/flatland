//classes
class World {
    constructor() {
        this.height = 30;
        this.width = 30;
        this.squares = [];
        this.state=Array.from(new Array(this.height), () => new Array(this.width).fill())
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
        
        var grassPercentage = 0.1;
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

        // collect objects that need to be updated and calculate next action on them
        var actions = [];
        for (let i = 0; i < this.height; i++) {
            for (let j = 0; j < this.width; j++) {
                for (let k = 0; k < this.state[i][j].length; k++)
                    if (typeof this.state[i][j][k].update == 'function') {
                        let outputs=this.state[i][j][k].update();
                        var x = i;
                        var y = j; 
                        if (outputs["right"]) {
                            x+=1;
                        }
                        if (outputs["left"]) {
                            x-=1;
                        }
                        if (outputs["up"]) {
                            y-=1;
                        }
                        if (outputs["down"]) {
                            y+=1;
                        }
                        actions.push({"object":this.state[i][j][k],"currentLocation":[i,j],"nextLocation":[x,y],"conflict":false});
                    }
            };
        };

        // resolve conflict on all objects and flag invalid actions
        var runConflictLoop = true;
        while (runConflictLoop) {
            runConflictLoop = false;
            for (let i = 0; i < actions.length; i++) {
                // do not check if action already marked as conflicting in previous loop iterations 
                if (actions[i]["conflict"]==true) {
                    continue;
                }
                // check if any other object is planning the move to same field
                for (let j = 0; j < actions.length; j++) {
                    if (i == j) {
                        continue;
                    }
                    if (JSON.stringify(actions[i]["nextLocation"]) == JSON.stringify(actions[j]["nextLocation"])) {
                        actions[i]["conflict"]=true;
                        actions[j]["conflict"]=true;
                        runConflictLoop = true;
                        break;
                    }
                }
                // check what is already present on that field
                var newField = this.state[actions[i]["nextLocation"][0]][actions[i]["nextLocation"][1]];
                for (let j = 0; j < newField.length; j++) {
                    if (newField[j].type == "actor" || newField[j].type == "solid") {
                        actions[i]["conflict"]=true;
                        runConflictLoop = true;
                        break;
                    }
                }
            }
        }

        // apply changes for all objects in world state
        for (let i = 0; i < actions.length; i++) {
            if (actions[i]["conflict"] == false) {
                var newField = this.state[actions[i]["nextLocation"][0]][actions[i]["nextLocation"][1]];
                newField.push(actions[i]["object"]);
                var oldField = this.state[actions[i]["currentLocation"][0]][actions[i]["currentLocation"][1]];
                this.state[actions[i]["currentLocation"][0]][actions[i]["currentLocation"][1]] = oldField.filter(e => e!=actions[i]["object"])
                //oldField.splice(actions[i]["object"],1);
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
    constructor() {
        this.type="actor";
        this.width=SQUARESIZE;
        this.height=SQUARESIZE;
        this.z=2;
        this.color="red";
        this.life=100;
        this.age=0;
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
    constructor() {
        this.type="item";
        this.width=SQUARESIZE;
        this.height=SQUARESIZE;
        this.z=1;
        this.color="green";
    }
}

class Earth {
    constructor() {
        this.type="terrain";
        this.width=SQUARESIZE;
        this.height=SQUARESIZE;
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
var speed = 1000/10; //updates per 1000 miliseconds
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