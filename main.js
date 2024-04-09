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
"speed" : 4,
"playbackSpeed" : 4,
"squareSize" : 10
}

// to track evolutionary tree globally. This is just an incrementing number used for generating creature fingerprint
var genotype = 0;

// Training or playback
var playback = 0;

// Classes

// Thw World class represents the world an its content
class World {
    constructor(worldType = "training") {
        // World properties
        // TODO: Set up dynamic population size (small initially, but growing as number of parameters grow)
        this.worldType = worldType;
        this.height = config.worldHeight;
        this.width = config.worldWidth;
        this.bestBrain = false;
        this.populationSize = 500;
        this.keepOtherBrains = 50;
        this.keepBestBrains = 5;
        this.population = [];
        this.bestBrains = [];
        this.populationNextGen = [];
        this.bestBrainsNextGen = [];
        this.selectedBestBrain = 1;
        this.populationRemaining = this.populationSize;
        this.state=Array.from(new Array(this.height), () => new Array(this.width).fill());
        this.grassPercentage = config.grassPercentange;
        this.regenerateWorld = false;
        
        // Stats
        this.life = 0;
        this.age = 0;
        this.maxAge = 0;
        this.avgBestBrainsAge = 0;
        this.avgBestBrainsConnectionCount = 0;
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
    generate(brain = false, generateEnvironment = true) {
        if (generateEnvironment == true) {            
            // Clear world
            this.clear();

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
        }

        // Generate actors
        //while (!this.addSquare(this.state, Robot, {"algorithm":"random"}));
        while (!this.addSquare(this.state, Creature, {"brain":brain}));
    }

    // Clear world state
    clear() {
        this.state=Array.from(new Array(this.height), () => new Array(this.width).fill())
    }

    // Calculate fingerprint difference / distance
    fingerprintDistance (a, b) {
        var counter = 0;
        length = Math.min(a.length, b.length);
        for (let i = 0; i < length; i++) {
            if (a[i] == b[i]) {
                counter++;
                }
            else {
                break;
            }
        }
        return a.length-counter + b.length-counter;
    }

    // Calculate population diversity
    diversity(population) {
        let sum = 0;
        for (let i = 0; i < population.length; i++) {
            for (let j = 0; j < population.length; j++) {
                if (i == j) { continue; }
                sum = sum + this.fingerprintDistance(JSON.parse(population[i]["brain"])["fingerprint"],JSON.parse(population[j]["brain"])["fingerprint"]);
            }
        }
        return sum / population.length;
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

                // If playback mode, just regenerate with currently selected brain, and ignore evolutionary steps below
                if (this.worldType == "playback") {
                    this.generate(brain, this.regenerateWorld);
                    continue;
                }

                // Key rules for evolution
                // 1. The fittest should always survive
                // 2. Diversity
                // 3. Improvement is not always immediate. Exploration is important.

                // Algorithm
                // We are keeping a list of overall best brains and a list of best brains from the separate cycle.
                // That way we ensure the overall best brains always survice, and we are also providing some room for exploration with the overall population.
                // The two lists are used to generated the population for a cycle.
                // The best brain list also enforces diversity by ensuring new brains are added only if diversity is maintained or increased
                // TODO: Eliminate one-hit wonders (doing multiple runs, and then maybe using median of max age, or take min age into account)
                // TODO: Move the evolutionary logic out into a separate method/function or even class
                // TODO: Make selection based on diversity, not just fitness

                // Add robot
                //while (!this.addSquare(this.state, Robot, {"algorithm":"random"}));

                // Generating population

                // Check if to add brain to bestBrains list or to general population

                let modifiedBestBrainList = false;

                // Add to bestBrains if empty spots available
                if (this.bestBrainsNextGen.length < this.keepBestBrains) {
                    this.bestBrainsNextGen.push({"brain":brain,"age":actions[i]["object"].age});
                    modifiedBestBrainList = true;
                }
                else {
                    // If bestBrains list full, check if to replace some member
                    for (let b = 0; b < this.bestBrainsNextGen.length; b++) {
                        if (actions[i]["object"].age >= this.bestBrainsNextGen[b].age) {
                            // Check for diversity
                            let tempBestBrainsNextGen = this.bestBrainsNextGen.slice();
                            tempBestBrainsNextGen[b]={"brain":brain,"age":actions[i]["object"].age};
                            if (this.diversity(this.bestBrainsNextGen) <= this.diversity(tempBestBrainsNextGen)) {
                                this.bestBrainsNextGen[b]={"brain":brain,"age":actions[i]["object"].age};
                                modifiedBestBrainList = true;
                                //console.log(this.diversity(this.bestBrainsNextGen));
                            }
                            else {
                                continue;
                            }
                        }
                        break;
                    }
                }

                // Add statistics to best brain list if list is modified
                let sortedBestBrainsNextGen = this.bestBrainsNextGen.sort((a, b) => parseFloat(a.age) - parseFloat(b.age));
                this.bestBrainsNextGen = sortedBestBrainsNextGen;
                if (modifiedBestBrainList == true) {

                    // Get average age in best brains array
                    this.avgBestBrainsAge = this.bestBrainsNextGen.reduce((total, next) => total + next.age, 0) / this.bestBrainsNextGen.length;

                    // Get brain stats
                    var connectionCounts = [];
                    for (var b = 0; b < this.bestBrainsNextGen.length; b++) {
                        let tempBrain = JSON.parse(this.bestBrainsNextGen[b].brain);
                        connectionCounts.push((this.bestBrainsNextGen[b]["brain"].match(/weight/g) || 0).length);
                        this.bestBrainsNextGen[b].connectionCount = connectionCounts[b];
                        this.bestBrainsNextGen[b].rank = b+1;
                        this.bestBrainsNextGen[b].generation = tempBrain.fingerprint.length;
                        this.bestBrainsNextGen[b].inputNeuronsCount = tempBrain.connectome.filter(neuron => neuron.type == "input").length;
                        this.bestBrainsNextGen[b].outputNeuronsCount = tempBrain.connectome.filter(neuron => neuron.type == "output").length;
                        // Instantiate brain to easier access rest of stats
                        tempBrain = new Brain(this.bestBrainsNextGen[b].brain, this.bestBrainsNextGen[b].inputNeuronsCount, this.bestBrainsNextGen[b].outputNeuronsCount);
                        this.bestBrainsNextGen[b].internalNeuronsCount = tempBrain.internalNeurons.length;
                        this.bestBrainsNextGen[b].unconnectedInputNeuronsCount = tempBrain.inputNeurons.filter(neuron => neuron.outputConnections.length == 0).length;
                        this.bestBrainsNextGen[b].unconnectedOutputNeuronsCount = tempBrain.outputNeurons.filter(neuron => neuron.inputConnections.length == 0).length;
                    }
                    this.avgBestBrainsConnectionCount = connectionCounts.reduce((a, b) => a + b) / connectionCounts.length;

                modifiedBestBrainList = false;
                }

                // Add to general population in any case
                this.populationNextGen.push({"brain":brain, "age":actions[i]["object"].age});

                // If population size reached, generate next generation
                if (this.populationNextGen.length == this.populationSize) {
                    // Sort next gen population by age
                    let sortedPopulationNextGen = this.populationNextGen.sort((a, b) => parseFloat(b.age) - parseFloat(a.age));
                    this.populationNextGen = sortedPopulationNextGen.slice(0, this.keepOtherBrains);

                    // Generate population for next round
                    this.population = this.populationNextGen.concat(this.bestBrainsNextGen); 
                    this.populationNextGen = [];

                    // Repeat random brains from population until full population size is reached
                    while (this.population.length < this.populationSize) {
                        this.population.push(this.population[Math.floor(Math.random()*this.population.length)]);
                    }
                }

                // Generate new world
                // If buiding initial population
                if (this.population.length == 0) {
                    this.generate(false, this.regenerateWorld);
                }
                else {
                // If not initial population
                    this.generate(this.population.pop().brain, this.regenerateWorld)
                }

                genotype++;
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
        var updateMaxAge = document.getElementById("max_age");
        var speed = document.getElementById("speed");
        var avgAge = document.getElementById("avg age");
        var avgConnCount = document.getElementById("avg conn count");
        let rank = document.getElementById('rank');
        var rankPlus = document.getElementById('rank_control_plus');
        var age_reached = document.getElementById('age_reached');
        var connection_count = document.getElementById('connection_count');
        var internalNeuronsCount = document.getElementById('internal_neuron_count');
        var ioCount = document.getElementById('io_count');
        var unconnectedCount = document.getElementById('unconnected_count');
        var generation = document.getElementById('generation');
        updateLife.innerHTML = this.life;
        updateAge.innerHTML = this.age;
        updateMaxAge.innerHTML = this.maxAge;
        speed.innerHTML = config.speed;
        avgAge.innerHTML = this.avgBestBrainsAge;
        avgConnCount.innerHTML = this.avgBestBrainsConnectionCount;
        rank.innerHTML = "rank " + this.selectedBestBrain;
        this.bestBrainsNextGen.length > this.selectedBestBrain ? rankPlus.classList.remove('disabled') : false;
        if (this.bestBrainsNextGen.length > 0) {
            let currentBrain = this.bestBrainsNextGen[this.bestBrainsNextGen.length - this.selectedBestBrain];// Inverse selection because array is sorted ascending
            age_reached.innerHTML = currentBrain.age; 
            connection_count.innerHTML = currentBrain.connectionCount;
            internalNeuronsCount.innerHTML = currentBrain.internalNeuronsCount;
            ioCount.innerHTML = currentBrain.inputNeuronsCount + "/" + currentBrain.outputNeuronsCount;
            unconnectedCount.innerHTML = currentBrain.unconnectedInputNeuronsCount + "/" + currentBrain.unconnectedOutputNeuronsCount;
            generation.innerHTML = currentBrain.generation;
        }
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
                    if (i < 0 || i > config.worldHeight-1 || j < 0 || j > config.worldWidth-1) {
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
        this.color="#2B303E";
        this.name = "rock";
    }
}

// The grass class represents an item that provides energy
class Grass {
    constructor() {
        this.type="item";
        this.width=config.squareSize;
        this.height=config.squareSize;
        this.z=1;
        this.color="#194D19";
        this.name = "grass";
    }
}

// The default terrain class
class Earth {
    constructor() {
        this.type="terrain";
        this.width=config.squareSize;
        this.height=config.squareSize;
        this.z=0;
        this.color="#776E52";
        this.name = "earth";
    }
}

class Water {
    constructor() {
        this.type="terrain";
        this.width=config.squareSize;
        this.height=config.squareSize;
        this.z=0;
        this.color="#6699CC";
        this.name = "water";
    }
}

class Lava {
    constructor() {
        this.type="terrain";
        this.width=config.squareSize;
        this.height=config.squareSize;
        this.z=0;
        this.color="#FE5F55";
        this.name = "lava";
    }
}

// Creature with a brain
class Creature {
    constructor(options={"brain":false}) {
        this.type = "actor";
        this.width = config.squareSize;
        this.height = config.squareSize;
        this.z = 2;
        this.color = "#6600CC";
        this.life = 100;
        this.age = 0;
        this.selected = true;
        this.vision = 1;
        this.visionElements = ["earth", "rock", "grass"]
        this.outputs = 4;
        this.brain = new Brain(options.brain, Math.pow(this.vision+this.vision+1, 2) * this.visionElements.length, this.outputs, true); 
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
        var inputs = []; 
        for (var i = x-this.vision; i <= x+this.vision; i++) {
            for (var j = y-this.vision; j <= y+this.vision; j++) {
                if (state?.[i]?.[j]) {
                    // Look for object on top
                    var onTop = state[i][j][0];
                    for (var k = 0; k < state[i][j].length; k++) {
                        if (state[i][j][k].z > onTop.z) {
                            onTop = state[i][j][k];
                        }
                    }
                    for (var v = 0; v < this.visionElements.length; v++) {
                        onTop.name == this.visionElements[v] ? inputs.push(1) : inputs.push(0);
                    }
                }
                else {
                    for (var n = 0; n < this.visionElements.length; n++) {
                        inputs.push(0);
                    }
                }
            }
        }
        
        // Calculate and return outputs
        var brainOutputs = this.brain.update(inputs);
        Object.keys(outputs).forEach(function(key,index) {
            // Comparing output with 0 because there is no output activation function. If sigmoid was used for example, then comparing with 0.5 would be needed.
            brainOutputs[index] >= 0.0 ? outputs[key] = 1 : outputs[key] = 0; 
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
            sigmoidActivationFunction: function sigmoid(z) { return 1 / (1 + Math.exp(-z)); },
            tanhActivationFunction: function tanh(z) {return Math.sinh(z) / Math.cosh(z)},
            reluActivationFunction: function relu(z) { return Math.max(0,z); }
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
        
        //if (this.type == "internal") {
        //    console.log(this.inputs)
        //   console.log(inputSum)
        //    console.log(output)
        //    console.log("--------------------")
        //}

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
    constructor(brain, inputs, outputs, mutate = false) {
        this.inputs = inputs;
        this.output = outputs;
        this.inputNeurons = [];
        this.internalNeurons=[];
        this.outputNeurons = [];
        this.fingerprint = [];

        // If building brain from scratch
        if (!brain) {
            // Create input neurons
            for (var i = 0; i < inputs; i++) {
                this.inputNeurons.push(new Neuron("noActivationFunction", "input"));
            }
            
            // Create output neurons
            for (var i = 0; i < outputs; i++) {
                this.outputNeurons.push(new Neuron("tanhActivationFunction", "output"));
            }
        }

        // If importing existing brain
        else {
            brain = JSON.parse(brain);

            this.fingerprint = brain.fingerprint;

            brain = brain["connectome"];

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
        if (mutate == true) {
            this.mutate();
        }

    }

    // Export brain
    export() {
        var brain = {"connectome":[], "fingerprint":[]};
        var neurons = this.inputNeurons.concat(this.outputNeurons, this.internalNeurons);
        this.fingerprint.push(genotype);
        brain["fingerprint"] = this.fingerprint;

        // Export neurons
        for (var i = 0; i < neurons.length; i++) {
            // Export neuron
            brain["connectome"].push({"activationFunctionName":neurons[i].activationFunctionName, "type":neurons[i].type, "connections":[]});

            // Export connections of neuron
            for (var j = 0; j < neurons[i].outputConnections.length; j++) {
                var weight = neurons[i].outputConnections[j].weight;
                var from = i;
                var to = neurons.findIndex(x => x === neurons[i].outputConnections[j].to);
                brain["connectome"][i]["connections"].push({"weight":weight, "from":from, "to":to });
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
            "addNeuron" : 0,
            "removeNeuron" : 0,
            "addConnection" : 1,
            "removeConnection" : 0,
            "updateWeight": 1
        }

        // Add internal neuron
        var random = Math.random();
        if (random < probabilities.addNeuron) {
            this.addNeuron("tanhActivationFunction", "internal");
        }

        // Remove internal neuron
        random = Math.random();
        if (random < probabilities.removeNeuron) {
            var randomNeuron = this.internalNeurons[Math.floor(Math.random()*this.internalNeurons.length)];
            if (randomNeuron !== undefined) {
                this.removeNeuron(randomNeuron);
            }
        }

        // Add connection - for now connections are added only between input and output neurons 
        // TODO: Add support for hidden layers
        // TODO: Add support for reccuring connections (from upper to lower layers... e.g. for feedback loops) 
        random = Math.random();
        if (random < probabilities.addConnection) {
            var weight = (Math.random() * 2) - 1; // random number between -1 and 1
            var alreadyExists = false;
            //var allNeurons = this.inputNeurons.concat(this.outputNeurons, this.internalNeurons);
            var randomFromNeuron = this.inputNeurons[Math.floor(Math.random()*this.inputNeurons.length)];
            var randomToNeuron = this.outputNeurons[Math.floor(Math.random()*this.outputNeurons.length)];
            
            // Check if connection already exists, and only update weight if yes
            for (let i=0; i < randomFromNeuron.outputConnections.length; i++) {
                if (randomFromNeuron.outputConnections[i].to == randomToNeuron) {
                    randomFromNeuron.outputConnections[i].weight += weight;
                    alreadyExists = true;
                    break;
                }
            }

            // Add connection if it does not already exist
            if (alreadyExists == false) {
            this.addConnection(weight, randomFromNeuron, randomToNeuron);
            }
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
            var weight = (Math.random() * 2); // random number between 0 and 2
            var inputAndInternalNeurons = this.inputNeurons.concat(this.internalNeurons);
            var randomNeuron = inputAndInternalNeurons[Math.floor(Math.random()*inputAndInternalNeurons.length)];
            var randomConnection = randomNeuron.outputConnections[Math.floor(Math.random()*randomNeuron.outputConnections.length)];
            // No weights will be updated if neuron has no connections
            if (randomConnection !== undefined) {
                randomConnection.weight *= weight;
            }
        }

    }

    update(inputs) {
        // TODO: Check if to update each neuron just once per update cycle, or to process whole input to output stream in one update cycle
        //console.log("inputs: "+inputs);
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
            //var activatedOutput = 1 / (1 + Math.exp(rawOutput)); // sigmoid activation function
            var activatedOutput = rawOutput; // No activation function
            outputs.push(activatedOutput);
            this.outputNeurons[i].inputs = [];
        }
        //console.log("outputs: "+outputs);
        //console.log("--------------------");
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
        var updateCountDiv = document.getElementById("elapsed");


        frameRateDiv.innerHTML = avgFrameRate.toFixed(2);
        updateRateDiv.innerHTML = avgUpdateRate.toFixed(2);
        updateCountDiv.innerHTML = this.updateCount;
    };
}

// Main

// Create world
var world = new World();
var playbackWorld = undefined;
world.generate();
world.draw();

// UI funcitons

// Speed control
function speed(control) {
    let minus = document.getElementById('speed_control_minus');
    let plus = document.getElementById('speed_control_plus');
    if (control == "minus") {
        plus.classList.remove('disabled')
        config.speed > 1 ? config.speed /= 2 : false;
        config.speed == 1 ? minus.classList.add('disabled') : false;
    }
    if (control == "plus") {
        minus.classList.remove('disabled')
        config.speed < 65536 ? config.speed *= 2 : false;
        config.speed == 65536 ? plus.classList.add('disabled') : false;
    }
}

// Rank control
function rank(control, world) {
    let minus = document.getElementById('rank_control_minus');
    let plus = document.getElementById('rank_control_plus');

    if (control == "minus") {
        world.bestBrainsNextGen.length > 1 ? plus.classList.remove('disabled') : false;
        world.selectedBestBrain  > 1 ? world.selectedBestBrain-- : false; // -2 because rank is is counted from 1 not 0
        world.selectedBestBrain == 1 ? minus.classList.add('disabled') : false;
    }
    if (control == "plus") {
        world.bestBrainsNextGen.length > 1 ? minus.classList.remove('disabled') : false;
        world.selectedBestBrain < world.bestBrainsNextGen.length ? world.selectedBestBrain++ : false;
        world.selectedBestBrain == world.bestBrainsNextGen.length ? plus.classList.add('disabled') : false;
    }
}

// Playback control
function playbackControl() {
    var button = document.getElementById('playback');
    playback == 0 ? playback = 1 : playback = 0;
    playback == 0 ? button.innerHTML = "playback" : button.innerHTML = "back";
}

// Add UI event listeners
document.getElementById('speed_control_minus').addEventListener("click", function(){speed("minus")});
document.getElementById('speed_control_plus').addEventListener("click", function(){speed("plus")});

document.getElementById('rank_control_minus').addEventListener("click", function(){rank("minus", world)});
document.getElementById('rank_control_plus').addEventListener("click", function(){rank("plus", world)});

document.getElementById('playback').addEventListener("click", function(){playbackControl()});

// Initiate logger
var logger = new Logger();

// Game loop
var lastDraw = 0;
var doUpdate = 0;
var lastUpdate = 0;
var lastUpdateCycle = 0;
var doUpdatePlayback = 0;
var lastUpdatePlayback = 0;
var lastUpdateCyclePlayback = 0;

// Update loop
// The world update function works via a web worker because requestAnimationFeame stops when tab is not in focus
var w = new Worker("webworker.js");
w.onmessage = function(event) {
    // Training update
    var speed = 1000 / config.speed;
    doUpdate += (performance.now()-lastUpdateCycle)/speed;
    while (Math.floor(doUpdate>0)) {
        world.update();
        logger.logUpdateTime(performance.now()-lastUpdate);
        logger.updateCount++;
        doUpdate--;
        lastUpdate = performance.now();
    }
    lastUpdateCycle = performance.now();
    
    // Playback update
    if (playback == 1) {
        if (playbackWorld == undefined) {
            playbackWorld = new World("playback");
            playbackWorld.generate(world.bestBrainsNextGen[world.selectedBestBrain-1].brain);
            playbackWorld.draw();
        }
        var playbackSpeed = 1000 / config.playbackSpeed;
        doUpdatePlayback += (performance.now()-lastUpdateCyclePlayback)/playbackSpeed;
        while (Math.floor(doUpdatePlayback>0)) {
            playbackWorld.update();
            logger.logUpdateTime(performance.now()-lastUpdatePlayback);
            logger.updateCount++;
            doUpdatePlayback--;
            lastUpdatePlayback = performance.now();
        }
        lastUpdateCyclePlayback = performance.now();
    }
    else {
        playbackWorld = undefined;
    }
  };

//Drawing loop
// The drawing loop works via requestAnimationFrame
function drawingLoop(timeStamp) {
    logger.logFrameTime(timeStamp-lastDraw);
    if (playback == 0) {
        world.draw();
    }
    else if (playbackWorld != undefined) {
        playbackWorld.draw();
    }
    logger.draw();
    lastDraw=timeStamp;
    window.requestAnimationFrame(drawingLoop);
}
window.requestAnimationFrame(drawingLoop);