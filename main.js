/////////////////////////////////////////////////////////////////////
//    ______ _            _______ _               _   _ _____      //
//   |  ____| |        /\|__   __| |        /\   | \ | |  __ \     //
//   | |__  | |       /  \  | |  | |       /  \  |  \| | |  | |    //
//   |  __| | |      / /\ \ | |  | |      / /\ \ | . ` | |  | |    //
//   | |    | |____ / ____ \| |  | |____ / ____ \| |\  | |__| |    //
//   |_|    |______/_/    \_\_|  |______/_/    \_\_| \_|_____/     //
//                                                                 //
//   stanko.jankovic@live.com                                      //
//                                                                 //
/////////////////////////////////////////////////////////////////////


// Globsl config

var config = {
"worldHeight" : 30,
"worldWidth" : 30,
"grassPercentange" : 0.1,
"speed" : 1000/2,
"squareSize" : 10
}


// Classes

// Thw World class represents the world an its content
class World {
    constructor() {
        // World properties
        this.height = config.worldHeight;
        this.width = config.worldWidth;
        this.state=Array.from(new Array(this.height), () => new Array(this.width).fill())

        // Stats
        this.life = 0;
        this.age = 0;
        this.maxAge = 0;
        this.grassPercentage = config.grassPercentange;
    }

    // Function to add a new element to the world
    addSquare(state, Class, x = "random", y = "random") {
        if (x == "random" || y == "random") {
            x = Math.floor(Math.random() * this.width);
            y = Math.floor(Math.random() * this.height);
        }
        if (state[x][y].length > 1) {
            return false;
        }
        state[x][y].push(new Class());
        return true;
    }

    // Function to generate the world
    generate() {
        // Generate terrain
        for (let i = 0; i < this.height; i++) {
            for (let j = 0; j < this.width; j++) {
                this.state[i][j] = new Array();
                this.state[i][j].push(new Earth());
            };
        };

        // Generate border
        for (var i = 0; i < this.height; i++) {
            for (var j = 0; j < this.width; j++) {
                if (i == 0 || i == this.height-1 || j == 0 || j == this.width-1) {
                    this.state[i][j].push(new Rock());
                }
            }
        }

        // Generate grass
        var grassNumber = this.height * this.width * this.grassPercentage;
        while (grassNumber > 0) {
            while (!this.addSquare(this.state, Grass));
            grassNumber--;
        }

        // Generate actors
        while (!this.addSquare(this.state, Robot));
    }

    // Function to update the world state for one timestep
    update() {
        // Collect objects that need to be updated and calculate next action on them
        var actions = [];
        for (let i = 0; i < this.height; i++) {
            for (let j = 0; j < this.width; j++) {
                for (let k = 0; k < this.state[i][j].length; k++)
                    if (this.state[i][j][k].type == "actor") {
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
                        actions.push({"object":this.state[i][j][k],"currentLocation":[i,j],"newLocation":[x,y],"conflict":false});
                    }
            };
        };

        // Resolve conflict on all objects and flag invalid actions
        var runConflictLoop = true;
        while (runConflictLoop) {
            runConflictLoop = false;
            for (let i = 0; i < actions.length; i++) {
                // Do not check if action already marked as conflicting in previous loop iterations 
                if (actions[i]["conflict"]==true) {
                    continue;
                }
                // Check if any other object is planning the move to same field
                for (let j = 0; j < actions.length; j++) {
                    if (i == j) {
                        continue;
                    }
                    if (JSON.stringify(actions[i]["newLocation"]) == JSON.stringify(actions[j]["newLocation"])) {
                        actions[i]["conflict"]=true;
                        actions[j]["conflict"]=true;
                        runConflictLoop = true;
                        break;
                    }
                }
                // Check what is already present on that field
                var newField = this.state[actions[i]["newLocation"][0]][actions[i]["newLocation"][1]];
                for (let j = 0; j < newField.length; j++) {
                    if (newField[j].type == "actor" || newField[j].type == "solid") {
                        actions[i]["conflict"]=true;
                        runConflictLoop = true;
                        break;
                    }
                }
            }
        }

        // Apply changes for all objects in world state
        for (let i = 0; i < actions.length; i++) {
            if (actions[i]["conflict"] == false) {
                // Add actor to new field
                var newLocation = actions[i]["newLocation"];
                var newField = this.state[newLocation[0]][newLocation[1]];
                newField.push(actions[i]["object"]);

                // Remove actor from old filed
                var oldLocation = actions[i]["currentLocation"];
                var oldField = this.state[oldLocation[0]][oldLocation[1]];
                this.state[oldLocation[0]][oldLocation[1]] = oldField.filter(e => e!=actions[i]["object"])
            }
        }

        // Process items
        //TODO: move thins into the actor calss - pass item to actor method and make it update itself. But removing the item from the world still needs to be done here
        for (let i = 0; i < actions.length; i++) {
            if (actions[i]["conflict"] == false) {
                var location = actions[i]["newLocation"];
                var currentField = this.state[location[0]][location[1]];
                for (var j = 0; j < currentField.length; j++) {
                    if (currentField[j].type == "item") {
                        //Update actor stats
                        actions[i]["object"].processItem(currentField[j]);

                        //Remove item
                        this.state[location[0]][location[1]] = currentField.filter(e => e!=currentField[j])
                        
                        //Add new item
                        var x = Math.floor(Math.random() * this.height);
                        var y = Math.floor(Math.random() * this.width);
                        while (!this.addSquare(this.state, Grass));
                    }
                }
            }
        }

        // Remove dead actors and add new ones
        for (let i = 0; i < actions.length; i++) {
            if (actions[i]["conflict"] == false) {
                var location = actions[i]["newLocation"];
                var currentField = this.state[location[0]][location[1]];
                if (actions[i]["object"].life <= 0) {
                    // Remove actor
                    this.state[location[0]][location[1]] = currentField.filter(e => e!=actions[i]["object"]);
                    
                    // Add new one
                    while (!this.addSquare(this.state, Robot));
                }
            }
        }

        // Update stats
        for (var i = 0; i < actions.length; i++) {
            if (actions[i]["object"].selected) {
                this.life = actions[i]["object"].life;
                this.age = actions[i]["object"].age;
                if (this.age > this.maxAge) {
                    this.maxAge = this.age;
                }
            }
        }

    }

    // Function to draw the world
    draw() {
        const canvas = document.getElementById("flatland");
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (var i = 0; i < this.height; i++) {
            for (var j = 0; j < this.width; j++) {
                // Determine which object to draw at top
                var max=-1;
                var objectToDraw;
                for (var x = 0; x < this.state[i][j].length; x++){
                    if (this.state[i][j][x].z > max) {
                        objectToDraw = this.state[i][j][x];
                    }
                }

                // Draw object
                ctx.beginPath();
                ctx.rect(i * config.squareSize, j * config.squareSize, objectToDraw.width, objectToDraw.height);
                ctx.fillStyle = objectToDraw.color;
                ctx.fill();
                ctx.closePath();
            }
        }

        // Draw UI
        var updateLife = document.getElementById("life");
        var updateAge = document.getElementById("age");
        var updateMaxAge = document.getElementById("maxAge");
        updateLife.innerHTML = this.life;
        updateAge.innerHTML = this.age;
        updateMaxAge.innerHTML = this.maxAge;
    }
  }

// The robot class that represents an actor with a hardcoded behavior algorithm
class Robot {
    constructor() {
        this.type = "actor";
        this.width = config.squareSize;
        this.height = config.squareSize;
        this.z = 2;
        this.color = "red";
        this.life = 100;
        this.age = 0;
        this.selected = true;
    }

    getInputs() {};

    update() {
        this.life--;
        this.age++;
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

    processItem(Item) {
        if (Item.constructor.name == "Grass") {
            this.life = Math.min(100, this.life += 10);
        }
    }
}

// Just a solid rock
class Rock {
    constructor() {
        this.type="solid";
        this.width=config.squareSize;
        this.height=config.squareSize;
        this.z=1;
        this.color="gray";
    }
}

// The grass class represents an item that provides energy
class Grass {
    constructor() {
        this.type="item";
        this.width=config.squareSize;
        this.height=config.squareSize;
        this.z=1;
        this.color="green";
    }
}

// The default terrain class
class Earth {
    constructor() {
        this.type="terrain";
        this.width=config.squareSize;
        this.height=config.squareSize;
        this.z=0;
        this.color="brown";
    }
}

// The logger class takes care of logging metadata stats like framerate or update speed
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

// Main

// Create world
var world = new World();
world.generate();
world.draw();

// Initiate logger
var logger = new Logger();

// Game loop
var lastDraw = 0;
var speed = config.speed;
var doUpdate = 0;
var lastUpdate = 0;
var lastUpdateCycle = 0;

// Update loop
// The world update function works via a web worker because requestAnimationFeame stops when tab is not in focus
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

//Drawing loop
// The drawing loop works via requestAnimationFrame
function drawingLoop(timeStamp) {
    logger.logFrameTime(timeStamp-lastDraw);
    world.draw();
    logger.draw();
    lastDraw=timeStamp;
    window.requestAnimationFrame(drawingLoop);
}
window.requestAnimationFrame(drawingLoop);