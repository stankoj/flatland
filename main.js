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
            if (this.squares[i].isConnected) {

            }
            else {
                document.body.appendChild(this.squares[i].graphic);
            }
        }
    };
  }

class Being {
    constructor() {
        this.graphic = document.createElement('div');
        this.graphic.style.width=squareSize+"px";
        this.graphic.style.height=squareSize+"px";
        this.graphic.style.backgroundColor="red";
    }
    getInputs() {};
    calculateOutputs() {};
}

//main

const squareSize = 10;

world = new World();
world.addSquare(new Being());

while (true) {
    world.update();
    break;
}