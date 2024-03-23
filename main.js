/////////////////////////////////////////////////////////////////////
//    ______ _            _______ _               _   _ _____      //
//   |  ____| |        /\|__   __| |        /\   | \ | |  __ \     //
//   | |__  | |       /  \  | |  | |       /  \  |  \| | |  | |    //
//   |  __| | |      / /\ \ | |  | |      / /\ \ | . ` | |  | |    //
//   | |    | |____ / ____ \| |  | |____ / ____ \| |\  | |__| |    //
//   |_|    |______/_/    \_\_|  |______/_/    \_\_| \_|_____/     //
//                                                                 //
//   github.com/stankoj/flatland           twitter.com/stankoja    //
//                                                                 //
/////////////////////////////////////////////////////////////////////


// Global config

var config = {
"worldHeight" : 40,
"worldWidth" : 70,
"grassPercentange" : 0.1,
"speed" : 1000/1,
"squareSize" : 10
}


// Classes

// Thw World class represents the world an its content
class World {
    constructor() {
        // World properties
        this.height = config.worldHeight;
        this.width = config.worldWidth;
        this.bestBrain = false;
        this.population = [];
        this.keepBestBrains = 1;
        this.populationSize = 100;
        this.populationRemaining = this.populationSize;
        this.state=Array.from(new Array(this.height), () => new Array(this.width).fill());
        
        // Stats
        this.life = 0;
        this.age = 0;
        this.maxAge = 0;
        this.grassPercentage = config.grassPercentange;
    }

    // Function to add a new element to the world
    addSquare(state, Class, options, x = "random", y = "random") {
        if (x == "random" || y == "random") {
            x = Math.floor(Math.random() * this.height);
            y = Math.floor(Math.random() * this.width);
        }

        // Check if something is already present there except terrain
        if (state[x][y].length > 1) {
            return false;
        }

        // Create square
        state[x][y].push(new Class(options));
        return true;
    }

    // Function to generate the world
    generate(brain = false) {
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
        //while (!this.addSquare(this.state, Robot, {"algorithm":"random"}));
        while (!this.addSquare(this.state, Creature, {"brain":brain}));
    }

    // Clear world state
    clear() {
        this.state=Array.from(new Array(this.height), () => new Array(this.width).fill())
    }

    // Function to update the world state for one timestep
    update() {
        // Collect objects that need to be updated and calculate next action on them
        var actions = [];
        for (let i = 0; i < this.height; i++) {
            for (let j = 0; j < this.width; j++) {
                for (let k = 0; k < this.state[i][j].length; k++)
                    if (this.state[i][j][k].type == "actor") {
                        let outputs=this.state[i][j][k].update(i, j, this.state);
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
                this.state[oldLocation[0]][oldLocation[1]] = oldField.filter(e => e!==actions[i]["object"]);
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
            }
            else {
                var location = actions[i]["currentLocation"];
            }
            var currentField = this.state[location[0]][location[1]];
            if (actions[i]["object"].life <= 0) {
                // Remove actor
                var brain = actions[i]["object"].brain.export();
                this.state[location[0]][location[1]] = currentField.filter(e => e!=actions[i]["object"]);

                // Check if brain is better than previous brains
                /*
                if (this.bestBrains.length < this.keepBestBrains) {
                    this.bestBrains.push({"brain":brain,"age":actions[i]["object"].age});
                }
                else {
                    var worstAge = this.bestBrains.reduce((prev, current) => (prev.y < current.y) ? prev : current, 0);
                    if (actions[i]["object"].age >= worstAge) {
                        var worstIndex = this.bestBrains.findIndex(x => x.age == worstAge);
                        bestBrains[worstIndex]={"brain":brain,"age":actions[i]["object"].age};
                    }
                }
                */

                // Add new one

                // Add robot
                //while (!this.addSquare(this.state, Robot, {"algorithm":"random"}));

                // Select random brain from bestBrains array
                //brain = this.bestBrains[Math.floor(Math.random()*this.bestBrains.length)].brain;

                // Generate population by evolving and testing best brain from last cycle
                if (this.populationRemaining > 0) {
                    this.population.push({"brain":brain, "age":actions[i]["object"].age});
                    this.populationRemaining--;
                }

                // Clear world and generate new one
                this.clear;
                this.generate(this.bestBrain.brain);

                // Add creatrure
                //while (!this.addSquare(this.state, Creature, {"brain":this.bestBrain.brain}));

                // If population fully generated, pick best brain and proceed to next cycle
                if (this.populationRemaining == 0) {
                    this.bestBrain = false;
                    for (var p = 0; p < this.population.length; p++) {
                        if (this.bestBrain == false) {
                            this.bestBrain = this.population[p];
                        }
                        else if (this.bestBrain.age < this.population[p].age) {
                            this.bestBrain = this.population[p];
                        }
                    }
                    this.population = [];
                    this.populationRemaining = this.populationSize;     
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
        // Draw world
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
                ctx.rect(j * config.squareSize, i * config.squareSize, objectToDraw.width, objectToDraw.height);
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
    constructor(options={"algorithm":"random"}) {
        this.type = "actor";
        this.width = config.squareSize;
        this.height = config.squareSize;
        this.z = 2;
        this.color = "#FF0000";
        this.life = 100;
        this.age = 0;
        this.selected = true;
        this.algorithm = options.algorithm;
        this.vision = 5;
    }

    getInputs() {};

    update(x, y, state) {
        this.life--;
        this.age++;
        var outputs = {
            "up": 0,
            "down": 0,
            "left": 0,
            "right": 0
          };

        if (this.algorithm == "random") {
            for(var key in outputs) {
                outputs[key] = Math.random() < 0.5;
            }
            return outputs;
        }
        if (this.algorithm == "smart") {
            // Check in which direction there are most grass blocks
            for (var i = x-this.vision; i <= x+this.vision; i++) {
                for (var j = y-this.vision; j <= y+this.vision; j++) {
                    if (i < 0 || i > config.worldWidth-1 || j < 0 || j > config.worldHeight-1) {
                        continue;
                    }
                    for (var k = 0; k < state[i][j].length; k++) {
                        if (state[i][j][k].constructor.name == "Grass") {
                            if (i < x) {
                                outputs.left++;
                            }
                            if (i > x) {
                                outputs.right++;
                            }
                            if (j < y) {
                                outputs.up++;
                            }
                            if (j > y) {
                                outputs.down++;
                            }
                        }
                    }
                }
            }

            // Decide which direction to go
            var decision = false;
            for(var key in outputs) {
                for (var otherKey in outputs) {
                    decision = key;
                    if (key == otherKey) {
                        continue;
                    }
                    if (outputs[key] <= outputs[otherKey]) {
                        decision = false;
                        break
                    }
                }
                if (decision) {
                    break;
                }
            }

            // Set direction
            for(var key in outputs) {
                if (decision) {
                    if (decision == key) {
                        outputs[key] = 1;
                    }
                    else {
                        outputs[key] = 0;
                    }
                }
                else {
                    outputs[key] = Math.random() < 0.5;
                }
            }
            return outputs;
        }        
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
        this.color="#666666";
    }
}

// The grass class represents an item that provides energy
class Grass {
    constructor() {
        this.type="item";
        this.width=config.squareSize;
        this.height=config.squareSize;
        this.z=1;
        this.color="#009900";
    }
}

// The default terrain class
class Earth {
    constructor() {
        this.type="terrain";
        this.width=config.squareSize;
        this.height=config.squareSize;
        this.z=0;
        this.color="#991111";
    }
}

// Creature with a brain
class Creature {
    constructor(options={"brain":false}) {
        this.type = "actor";
        this.width = config.squareSize;
        this.height = config.squareSize;
        this.z = 2;
        this.color = "#660066";
        this.life = 100;
        this.age = 0;
        this.selected = true;
        this.vision = 5;
        this.outputs = 4;
        this.brain = new Brain(options.brain, this.vision*this.vision, this.outputs); // If vision is changed to 3 colors, the input tensor should be vision*vision*3
    }

    // Update creature
    update(x, y, state) {
        this.life--;
        this.age++;
        var outputs = {
            "up": 0,
            "down": 0,
            "left": 0,
            "right": 0
          };

        // Obtain input values from vision and normalize values
        var inputs = []; // ToDo: consider building input using one-hot encoded square types instead of one dimensional color values 
        for (var i = x-this.vision; i <= x+this.vision; i++) {
            for (var j = y-this.vision; j <= y+this.vision; j++) {
                if (i < 0 || i > config.worldWidth-1 || j < 0 || j > config.worldHeight-1) {
                    continue;
                }
                // Look for object on top
                var onTop = state[i][j][0];
                for (var k = 0; k < state[i][j].length; k++) {
                    if (state[i][j][k].z > onTop.z) {
                        onTop = state[i][j][k];
                    }
                }
                inputs.push(onTop.color.replace("#", "0x"));
            }
        }
        // Normalize input vsalues
        var ratio = "0xFFFFFF";  
        inputs = inputs.map(v => (v / ratio));

        // Calculate and return outputs
        var brainOutputs = this.brain.update(inputs);
        Object.keys(outputs).forEach(function(key,index) {
            brainOutputs[index] >= 0.5 ? outputs[key] = 1 : outputs[key] = 0; 
        });

        return outputs;
        
    }

    processItem(Item) {
        if (Item.constructor.name == "Grass") {
            this.life = Math.min(100, this.life += 10);
        }
    }

}

// Neuron class
class Neuron {
    constructor(activationFunctionName, type) {
        this.activationFunctions = { 
            noActivationFunction: function (a) {return a;},
            sigmoidActivationFunction: function sigmoid(z) { return 1 / (1 + Math.exp(-z)); }
        }
        this.activationFunction = this.activationFunctions[activationFunctionName]; // Activation function code
        this.activationFunctionName = activationFunctionName; // Name of activation function, used for export/import
        this.inputs = []; // Array of primitive input values
        this.inputConnections = []; // Input links from other neurons
        this.outputConnections = []; // Output links to other neurons
        this.type = type; // input, output, internal
    }

    update() {
        // Calculate output
        var inputSum = this.inputs.reduce((a,b)=>a+b,0);
        var output = this.activationFunction(inputSum);

        // Clear own inputs
        this.inputs = [];

        // Set inputs of connected neurons
        for (var i = 0; i < this.outputConnections.length; i++) {
            this.outputConnections[i].to.inputs.push(output*this.outputConnections[i].weight);
        }
    }
}

// Neuron connection
class Connection {
    constructor(weight, from, to) {
        this.weight = weight;
        this.from = from;
        this.to = to;
    }
}

// The Brain
class Brain {
    constructor(brain, inputs, outputs) {
        this.inputs = inputs;
        this.output = outputs;
        this.inputNeurons = [];
        this.internalNeurons=[];
        this.outputNeurons = [];

        // If building brain from scratch
        if (!brain) {
            // Create input neurons
            for (var i = 0; i < inputs; i++) {
                this.inputNeurons.push(new Neuron("noActivationFunction", "input"));
            }
            
            // Create output neurons
            for (var i = 0; i < outputs; i++) {
                this.outputNeurons.push(new Neuron("sigmoidActivationFunction", "output"));
            }
        }

        // If importing existing brain
        else {
            brain = JSON.parse(brain);

            var allNeurons = [];

            // Import neurons
            for (var i = 0; i < brain.length; i++) {
                allNeurons.push(new Neuron(brain[i].activationFunctionName, brain[i].type));

                if (allNeurons[i].type == "input") {
                    this.inputNeurons.push(allNeurons[i]);
                }
                else if (allNeurons[i].type == "output") {
                    this.outputNeurons.push(allNeurons[i]);
                }
                else if (allNeurons[i].type == "internal") {
                    this.internalNeurons.push(allNeurons[i]);
                }
            }

            // Import connections
            for (var i = 0; i < brain.length; i++) {
                for (var j = 0; j < brain[i]["connections"].length; j++) {
                    // Import output connections to current neruon
                    //allNeurons[i]["outputConnections"].push(new Connection(brain[i]["connections"][j].weight, allNeurons[i], allNeurons[brain[i]["connections"][j].to]));
                    
                    this.addConnection(brain[i]["connections"][j].weight, allNeurons[i], allNeurons[brain[i]["connections"][j].to]);
                }
            }
        }
        
        // Mutate brain after import
        this.mutate();

    }

    // Export brain
    export() {
        var brain = [];
        var neurons = this.inputNeurons.concat(this.outputNeurons, this.internalNeurons);

        // Export neurons
        for (var i = 0; i < neurons.length; i++) {
            // Export neuron
            brain.push({"activationFunctionName":neurons[i].activationFunctionName, "type":neurons[i].type, "connections":[]});

            // Export connections of neuron
            for (var j = 0; j < neurons[i].outputConnections.length; j++) {
                var weight = neurons[i].outputConnections[j].weight;
                var from = i;
                var to = neurons.findIndex(x => x === neurons[i].outputConnections[j].to);
                brain[i]["connections"].push({"weight":weight, "from":from, "to":to });
            }
        }

        return JSON.stringify(brain);
    
    }

    // Add neuron to brain
    addNeuron(activationFunctionName, type) {
        var neuron = new Neuron(activationFunctionName, type);
        if (type == "input") {
            this.inputNeurons.push(neuron);
        }
        else if (type == "output") {
            this.outputNeurons.push(neuron);
        }
        else if (type == "internal") {
            this.internalNeurons.push(neuron);
        }
        return neuron;
    }

    // Add connection to neuron(s)
    addConnection(weight, from, to) {
        var conn = new Connection(weight, from, to);
        to.inputConnections.push(conn);
        from.outputConnections.push(conn);
        return conn;
    }

    // Delete neron and all input and output connections touching it
    removeNeuron(neuron) {

        // Remove output connections
        while (neuron.outputConnections.length > 0) {
            this.removeConnection(neuron.outputConnections[0]);
        } 

        // Remove input connections
        while (neuron.inputConnections.length > 0) {
            this.removeConnection(neuron.inputConnections[0]);
        } 

        // Remove neuron
        if (neuron.type == "input") {
            this.inputNeurons = this.inputNeurons.filter(e => e!==neuron);
        }
        else if (neuron.type == "output") {
            this.outputNeurons = this.outputNeurons.filter(e => e!==neuron);
        }
        else if (neuron.type == "internal") {
            this.internalNeurons = this.internalNeurons.filter(e => e!==neuron);
        }
    }

    // Remove connection from neuron
    removeConnection(connection) {
        // Remove from source neuron
        connection.from.outputConnections = connection.from.outputConnections.filter(e => e!==connection);

        // Remove from target neuron
        connection.to.inputConnections = connection.to.inputConnections.filter(e => e!==connection);
    }

    // Mutate brain
    mutate() {
        var probabilities = {
            "addNeuron" : 0.1,
            "removeNeuron" : 0.0,
            "addConnection" : 0.9,
            "removeConnection" : 0.1,
            "updateWeight": 0.9
        }

        // Add internal neuron
        var random = Math.random();
        if (random < probabilities.addNeuron) {
            this.addNeuron("sigmoidActivationFunction", "internal");
        }

        // Remove internal neuron
        random = Math.random();
        if (random < probabilities.removeNeuron) {
            var randomNeuron = this.internalNeurons[Math.floor(Math.random()*this.internalNeurons.length)];
            if (randomNeuron !== undefined) {
                this.removeNeuron(randomNeuron);
            }
        }

        // Add output connection to either input or internal neurons. TODO: add output connections to output neurons too, e.g. feedback loops
        random = Math.random();
        if (random < probabilities.addConnection) {
            var weight = (Math.random() * 2) - 1; // random number between -1 and 1
            var allNeurons = this.inputNeurons.concat(this.outputNeurons, this.internalNeurons);
            var randomFromNeuron = allNeurons[Math.floor(Math.random()*allNeurons.length)];
            var randomToNeuron = allNeurons[Math.floor(Math.random()*allNeurons.length)];
            this.addConnection(weight, randomFromNeuron, randomToNeuron);
        }

        // Remove output connection from either input or internal neurons
        random = Math.random();
        if (random < probabilities.removeConnection) {
            var allNeurons = this.inputNeurons.concat(this.outputNeurons, this.internalNeurons);
            var randomNeuron = allNeurons[Math.floor(Math.random()*allNeurons.length)];
            var randomConnection = randomNeuron.outputConnections[Math.floor(Math.random()*randomNeuron.outputConnections.length)];
            // No connection to remove if neuron has no connections
            if (randomConnection !== undefined) {
                this.removeConnection(randomConnection);
            }
        }

        // Update weight on random connection on random neuron
        random = Math.random();
        if (random < probabilities.updateWeight) {
            var weight = (Math.random() * 2) - 1; // random number between -1 and 1
            var inputAndInternalNeurons = this.inputNeurons.concat(this.internalNeurons);
            var randomNeuron = inputAndInternalNeurons[Math.floor(Math.random()*inputAndInternalNeurons.length)];
            var randomConnection = randomNeuron.outputConnections[Math.floor(Math.random()*randomNeuron.outputConnections.length)];
            // No weights will be updated if neuron has no connections
            if (randomConnection !== undefined) {
                randomConnection.weight = weight;
            }
        }

    }

    update(inputs) {
        // Add inputs to input enurons
        for (var i=0; i < this.inputNeurons.length; i++) {
            this.inputNeurons[i].inputs.push(inputs[i]);
            this.inputNeurons[i].update();
        }

        // Update each internal neuron
        for (var i=0; i < this.internalNeurons.length; i++) {
            this.internalNeurons[i].update();
        }

        // Calculate outputs
        var outputs = [];
        for (var i=0; i < this.outputNeurons.length; i++) {
            var rawOutput = this.outputNeurons[i].inputs.reduce((a,b)=>a+b, 0); 
            var activatedOutput = 1 / (1 + Math.exp(rawOutput)); // sigmoid activation function
            //var activatedOutput = rawOutput; // No activation function
            outputs.push(activatedOutput);
            this.outputNeurons[i].inputs = [];
        }

        return outputs;
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
var doUpdate = 0;
var lastUpdate = 0;
var lastUpdateCycle = 0;

// Update loop
// The world update function works via a web worker because requestAnimationFeame stops when tab is not in focus
var w = new Worker("webworker.js");
w.onmessage = function(event) {
    var speed = config.speed;
    doUpdate += (performance.now()-lastUpdateCycle)/speed;
    while (Math.floor(doUpdate>0)) {
        world.update();
        logger.logUpdateTime(performance.now()-lastUpdate);
        logger.updateCount++;
        doUpdate--;
        lastUpdate = performance.now();
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