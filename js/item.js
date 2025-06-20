var Rarity = {
	Normal: 0,
	Magic: 1,
	Rare: 2,
	Unique: 3,

	getName: function (i) {
		switch (i) {
			case 0: return "Normal";
			case 1: return "Magic";
			case 2: return "Rare";
			case 3: return "Unique";
			default: throw 'Invalid Rarity: ' + i
		}
	},

	isValid: function (i) {
	    return 0 <= i && i <= 3
	},

	parse: function (str) {
		switch (str.toLowerCase()) {
			case 'normal': return 0;
			case 'magic': return 1;
			case 'rare': return 2;
			case 'unique': return 3;
			default: throw "Invalid Rarity: " + str;
		}
	}
};

var Influence = {
    None: [],
    Shaper: ['Shaper'],
    Elder: ['Elder'],

    getName: function (influenceList) {
		if (Array.isArray(influenceList)) {
			return influenceList.join(' ');
		}
    },

    getIconUrl: function (influenceList) {
		for (var i=0; i < influenceList.length; i++) {
			var influence = influenceList[i];
			switch (influence) {
				case 'Shaper': return 'img/ShaperItemSymbol.png';
				case 'Elder': return 'img/ElderItemSymbol.png';
			}
		}
		return null;
    },

    parse: function (str) {
		if (str === '') {
			return [];
		}
		return str.split(' ');
    }
}

class SocketGroups extends Array {
	#value = null
	constructor(value){
		super()
		this.#value = value;
		for(let part of value){ this.push(part); }
	}
	
	static fromString(socketString){
		let result = socketString.split(' ').map(value => new SocketGroups(value));
		return new SocketGroups(result);
	}

	[Symbol.toPrimitive](hint = "default"){
		if(hint == "number"){
			console.log("toPrimitive")
			if(Array.isArray(this.#value)) { return this.reduce((prev, cur) => prev + Number(cur), 0); }
			else { return this.#value.length; }
		}

		if(Array.isArray(this.#value)){ return this.#value.join(' ') }
		else { return this.#value; }
	}

	toString(){ return this[Symbol.toPrimitive](); }
}

function ItemDefinition() {
}

ItemDefinition.validate = function (item) {
    function assertTrue (expr, msg) {
        if (!expr) {
            throw msg;
        }
    }

	function assertNotNullOrEmpty (str, msg) {
        if (!str || (str === '')) {
            throw msg;
        }
    }

    function assertInRange (value, min, max, msg) {
        if (isNaN(value) || value < min || value > max) {
            throw msg;
        }
    }

	function assertInArray (value, array, msg) {
		if (!ArrayUtils.contains(array, value)) {
			throw msg;
		}
	}

	assertNotNullOrEmpty( item.name, 'Item has no name' );
    assertInRange( item.itemLevel, 1, 100, 'Invalid ItemLevel' );
    assertInRange( item.dropLevel, 1, 100, 'Invalid DropLevel' );
    assertInRange( item.quality, 0, 20, 'Invalid Quality' );
	assertTrue( Rarity.isValid( item.rarity, 'Invalid Rarity' ));
    assertNotNullOrEmpty( item.itemClass, 'Item has no Class' );
    assertNotNullOrEmpty( item.baseType, 'Item has no BaseType' );
    assertInRange( item.width, 1, 3, 'Invalid width' );
    assertInRange( item.height, 1, 5, 'Invalid height' );
	assertInArray( item.identified, [true, false], 'Invalid Identified property' );
	assertInArray( item.corrupted, [true, false], 'Invalid Corrupted property' );
	assertInArray( item.fracturedItem, [true, false], 'Invalid FracturedItem property' );
	assertInArray( item.synthesisedItem, [true, false], 'Invalid SynthesisedItem property' );
	assertInArray( item.replica, [true, false], 'Invalid Replica property');
	assertInArray( item.shapedMap, [true, false], 'Invalid ShapedMap property' );
	assertInArray( item.blightedMap, [true, false], 'Invalid BlightedMap property' );
	item.mapTier = item.mapTier ? item.mapTier : 0;
	assertInRange( item.mapTier, 0, 20, 'Invalid MapTier' );
	item.gemLevel = item.gemLevel ? item.gemLevel : 0;
	assertInRange( item.gemLevel, 0, 23, 'Invalid Gem Level')
	var maxSockets = Math.min( 6, item.width * item.height );
	assertInRange( ItemDefinition.countSockets( item.sockets ), 0, maxSockets, 'Too many sockets for this item size' );
	assertTrue( 'explicitMods' in item, 'Item has no ExplicitMods list' );
}

ItemDefinition.areEqual = function (data, item) {
	return data.name === item.name
		&& data.itemLevel === item.itemLevel
		&& data.dropLevel === item.dropLevel
		&& data.quality === item.quality
		&& data.rarity === item.rarity
		&& data.itemClass === item.itemClass
		&& data.baseType === item.baseType
		&& data.width === item.width
		&& data.height === item.height
		&& data.identified === item.identified
		&& data.corrupted === item.corrupted
		&& data.fracturedItem === item.fracturedItem
		&& data.synthesisedItem === item.synthesisedItem
		&& data.replica === item.replica
		&& ArrayUtils.areEqual( data.influence, item.influence )
		&& data.enchantment === item.enchantment
		&& data.shapedMap === item.shapedMap
		&& data.blightedMap === item.blightedMap
		&& data.mapTier === item.mapTier
		&& data.gemLevel === item.gemLevel
		&& data.stackSize === item.stackSize
		&& ArrayUtils.areEqual( data.explicitMods, item.explicitMods )
		&& ArrayUtils.areEqual( data.sockets, item.sockets );
}

ItemDefinition.countSockets = function (sockets) {
	var result = 0;
	sockets.forEach( function(group) {
		result += group.length;
	});
	return result;
}

var DEFAULT_ITEM_PROPERTIES = {}
class Item {
	constructor(itemDefinition){
		Object.assign(this, DEFAULT_ITEM_PROPERTIES, itemDefinition);
	
		this.outerElement = null;
		this.domElement = null;
		this.beamElement = null;
		this.mapIconElement = null;
	
		this.matchingRule = null;
		this.previousMatchingRules = [];
	}

	getDisplayName() {
	    var prefix = '';
		if (this.replica) {
			prefix = 'Replica ';
		}
		else if (this.quality > 0) {
			prefix = 'Superior ';
		}
		
		var suffix = '';
	    if (this.stackSize > 1) {
	        suffix = ' (' + this.stackSize + ')';
	    }

		if (!this.identified) {
			return prefix + this.name + suffix;
		}
		else {
			return prefix + this.name + suffix + "<BR>" + this.baseType;
		}
	}

	get numSockets() {
		return ItemDefinition.countSockets( this.sockets );
	}

	hasExplicitMod(mod) {
	    this.explicitMods.includes( mod );
	}

	draw() {
		var outerDiv = document.createElement( 'div' );
		outerDiv.className = 'item-container';

		var itemDiv = document.createElement( 'div' );
		itemDiv.className = 'item';

		var influenceIcon = null;
		if (this.replica) {
			influenceIcon = 'img/ReplicaItemSymbol.png';
		}
		else {
			influenceIcon = Influence.getIconUrl( this.influence );
		}
        if (influenceIcon !== null) {
            var influenceImg = document.createElement( 'img' );
            influenceImg.src = influenceIcon;
            influenceImg.classList.add('influence');
            itemDiv.appendChild( influenceImg );
        }

		var itemName = document.createElement( 'span' );
		itemName.classList.add('name');
		itemName.innerHTML = this.getDisplayName();
		itemDiv.appendChild( itemName );

		if (this.numSockets > 0) {
			itemDiv.appendChild( drawSockets(this) );
		}

		outerDiv.appendChild( itemDiv );

		var itemsArea = document.getElementById( 'items-area' );
		itemsArea.appendChild( outerDiv );

		var self = this;
		outerDiv.addEventListener('mouseover', function() {
			if (self.onMouseOver) {
				self.onMouseOver( self );
			}
		});
		outerDiv.addEventListener('mouseout', function() {
			if (self.onMouseOut) {
				self.onMouseOut( self );
			}
		});
		outerDiv.addEventListener('contextmenu', function(ev) {
			if (self.onRightClick) {
				ev.preventDefault();
				self.onRightClick( self );
			}
		});

		this.outerElement = outerDiv;
		this.domElement = itemDiv;
	}

	setVisibility(visibility) {
		if (this.itemClass === 'Quest Items' || this.itemClass === 'Labyrinth Item' || this.itemClass === 'Labyrinth Trinket') {
			visibility = true;
		}
		this.outerElement.className = (visibility ? 'item-container' : 'hidden-item-container');
		this.domElement.style.visibility = (visibility ? 'visible' : 'hidden');
	}

	setTextColor(color) {
		getLabel( this ).style.color = buildCssColor( color );
	}

	removeBorder() {
		this.domElement.style.border = '';
	}

	setBorderColor(color) {
		this.domElement.style.border = '1px solid ' + buildCssColor( color );
	}

	setBackgroundColor(color) {
		this.domElement.style.backgroundColor = buildCssColor( color );
	}

	setFontSize(size) {
		var actualSize = MathUtils.remap( size, 18, 45, 8, 24 );
		getLabel( this ).style.fontSize = (actualSize).toString() + 'px';
	}

	setBeam(color, temp) {
	    this.removeBeam();
	    this.beamElement = createBeam(color);
	    this.domElement.appendChild(this.beamElement);
    }

    removeBeam() {
        if (this.beamElement !== null) {
            this.domElement.removeChild(this.beamElement);
            this.beamElement = null;
        }
    }

    setMapIcon(shape, color, size) {
        this.removeMapIcon();
        this.mapIconElement = createMapIcon(shape, color, size);
        this.domElement.appendChild(this.mapIconElement);
    }

    removeMapIcon() {
        if (this.mapIconElement !== null) {
            this.domElement.removeChild(this.mapIconElement);
            this.mapIconElement = null;
        }
    }
};

function buildCssColor (color) {
	var r = color.r;
	var g = color.g;
	var b = color.b;
	var a = 1;
	if (color.hasOwnProperty( 'a' )) {
		a = color.a / 255; // CSS wants its alpha value between 0 and 1
	}
	return 'rgba(' + r.toString() + ',' + g.toString() + ',' + b.toString() + ',' + a.toString() + ')';
}

function getLabel (self) {
	for (var i=0; i < self.domElement.children.length; i++) {
		var child = self.domElement.children[i];
		if ((child.tagName.toLowerCase() === 'span') && child.classList.contains('name')) {
			return child;
		}
	}
	return null;
}

function getSocketsDiv (self) {
	for (var i=0; i < self.domElement.children.length; i++) {
		var child = self.domElement.children[i];
		if (child.className === 'sockets') {
			return child;
		}
	}
}

function computeSocketPadding (numSockets) {

	// The height values as computed by the formula below:
	//	1: 4,
	//	2: 4,
	//	3: 10,
	//	4: 10,
	//	5: 16,
	//	6: 16

	var width = ( numSockets == 1 ) ? 4 : 10;
	var height = ( Math.ceil( numSockets / 2 ) - 1 ) * 6 + 4;

	var result = {};
	result.x = 2 + ( 10 - width ) / 2;
	result.y = 2 + ( 16 - height ) / 2;
	return result;
}

function computeSocketPaddingSingleColumn (numSockets) {
	// 1: 4
	// 2: 10
	// 3: 16

	var width = 4;
	var height = (numSockets - 1) * 6 + 4;

	var result = {};
	result.x = 2 + ( 10 - width ) / 2;
	result.y = 2 + ( 16 - height ) / 2;
	return result;
}

function drawSocket (socketColor) {
	var socket = document.createElement( 'div' );
	socket.className = 'socket';

	switch (socketColor) {
		case 'R':
			socket.style.backgroundColor = '#ff0000';
			break;
		case 'G':
			socket.style.backgroundColor = '#80ff33';
			break;
		case 'B':
			socket.style.backgroundColor = '#8888ff';
			break;
		case 'W':
			socket.style.backgroundColor = '#ffffff';
			break;
	}

	return socket;
}

function drawLink (x, y, padding) {
	var link = document.createElement( 'div' );

	// Doesn't have to be efficient, this is only run once during startup.
	var xy = x.toString() + '/' + y.toString();
	switch (xy) {
		// case '0/0' is not possible because link is created at the second socket!
		case '1/0':
		case '0/1':
		case '1/2':
			link.className = 'link-horizontal';
			link.style.left = (3 + padding.x).toString() + 'px';
			link.style.top = ((y * 6) + 1 + padding.y).toString() + 'px';
			break;
		case '1/1':
		case '0/2':
			link.className = 'link-vertical';
			link.style.left = ((x * 6) + 1 + padding.x).toString() + 'px';
			link.style.top = (((y-1) * 6) + 3 + padding.y).toString() + 'px';
			break;
	}

	return link;
}

function drawLinkSingleColumn (y, padding) {
	var link = document.createElement( 'div' );
	link.className = 'link-vertical';
	link.style.left = (1 + padding.x).toString() + 'px';
	link.style.top = (((y-1) * 6) + 3 + padding.y).toString() + 'px';
	return link;
}

function incrementSocketPos (x, y) {
	// x0 y0 -> x+1
	// x1 y0 -> y+1
	// x1 y1 -> x-1
	// x0 y1 -> y+1
	// x0 y2 -> x+1

	var xdir = (y % 2 == 1) ? -1 : 1;
	var xstop = (y % 2 == 1) ? 0 : 1;

	if (x != xstop) {
		x += xdir;
	}
	else {
		y += 1;
	}

	return { x:x, y:y };
}

function drawSockets (item) {
	if (item.width === 1) {
		return drawSocketsSingleColumn( item );
	} else {
		return drawSocketsTwoColumns( item );
	}
}

function drawSocketsTwoColumns (item) {
	var socketsDiv = document.createElement( 'div' );
	socketsDiv.className = 'sockets';

	var padding = computeSocketPadding( item.numSockets );

	var x = 0;
	var y = 0;
	var linked = false;

	item.sockets.forEach( function(group) {
		linked = false;
		var chars = group.split( '' );
		chars.forEach( function(socketColor) {
			var socket = drawSocket( socketColor );
			socket.style.left = (padding.x + (x * 6)).toString() + 'px';
			socket.style.top = (padding.y + (y * 6)).toString() + 'px';
			socketsDiv.appendChild( socket );

			if (linked) {
				var link = drawLink( x, y, padding );
				socketsDiv.appendChild( link );
			}

			newXY = incrementSocketPos( x, y );
			x = newXY.x;
			y = newXY.y;

			linked = true;
		});
	});

	return socketsDiv;
}

function drawSocketsSingleColumn (item) {
	var socketsDiv = document.createElement( 'div' );
	socketsDiv.className = 'sockets';

	var padding = computeSocketPaddingSingleColumn( item.numSockets );

	var y = 0;
	var linked = false;

	item.sockets.forEach( function (group) {
		linked = false;
		var chars = group.split('');
		chars.forEach( function(socketColor) {
			var socket = drawSocket( socketColor );
			socket.style.left = (padding.x).toString() + 'px';
			socket.style.top = (padding.y + (y * 6)).toString() + 'px';
			socketsDiv.appendChild( socket );

			if (linked) {
				var link = drawLinkSingleColumn( y, padding );
				socketsDiv.appendChild( link );
			}

			y += 1
			linked = true;
		});
	});

	return socketsDiv;
}
//};

function createRadialGradient(gradientId, color) {
		return createRadialGradient2Colors(gradientId, '50%', {r:color.r, g:color.g, b:color.b, a:1}, {r:color.r, g:color.g, b:color.b, a:0});
}

function createRadialGradient2Colors(gradientId, size, innerColor, outerColor) {
	var gradient = document.createElementNS('http://www.w3.org/2000/svg', 'radialGradient');
	gradient.id = gradientId;
	gradient.cx = size;
	gradient.cy = size;
	gradient.r = size;

	var innerColorElem = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
	innerColorElem.setAttributeNS(null, 'offset', '0%');
	innerColorElem.style = 'stop-color:rgb(' + innerColor.r + ',' + innerColor.g + ',' + innerColor.b + '); stop-opacity:' + innerColor.a;
	gradient.appendChild(innerColorElem);

	var outerColorElem = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
	outerColorElem.setAttributeNS(null, 'offset', '100%');
	outerColorElem.style = 'stop-color:rgb(' + outerColor.r + ',' + outerColor.g + ',' + outerColor.b + '); stop-opacity:' + outerColor.a;
	gradient.appendChild(outerColorElem);

	return gradient;
}

function createBeam(color) {
    var beamElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    beamElement.setAttributeNS(null, 'viewBox', '0 0 1 1');
    beamElement.setAttributeNS(null, 'width', 40);
    beamElement.setAttributeNS(null, 'height', 60);
    beamElement.setAttributeNS(null, 'class', 'beam');

    var baseGradient = createRadialGradient('baseGradient', color);
    beamElement.appendChild(baseGradient);

    var beamBase = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    beamBase.setAttributeNS(null, 'id', 'base');
    beamBase.setAttributeNS(null, 'cx', 0.5);
    beamBase.setAttributeNS(null, 'cy', 0.9);
    beamBase.setAttributeNS(null, 'rx', 0.5);
    beamBase.setAttributeNS(null, 'ry', 0.1);
    beamBase.setAttributeNS(null, 'fill', 'url(#baseGradient)');
    beamElement.appendChild(beamBase);

    var rayGradient = createRadialGradient('rayGradient', color);
    rayGradient.setAttributeNS(null, 'gradientTransform', 'scale(1, 3)');
    beamElement.appendChild(rayGradient);

    var ray = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
    ray.setAttributeNS(null, 'width', 0.25);
    ray.setAttributeNS(null, 'height', 0.9);
    ray.setAttributeNS(null, 'x', 0.5 - (0.33/2));
    ray.setAttributeNS(null, 'y', 0);
    ray.setAttributeNS(null, 'fill', 'url(#rayGradient)');
    beamElement.appendChild(ray);

    return beamElement;
}

function createMapIcon(shape, color, size) {
    var iconElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    iconElement.setAttributeNS(null, 'viewBox', '0 0 1 1');
    iconElement.setAttributeNS(null, 'width', 10 + 10 * (2 - size));
    iconElement.setAttributeNS(null, 'height', 10 + 10 * (2 - size));
    iconElement.setAttributeNS(null, 'class', 'mapIcon');

    var iconSVG = drawMapIcon(shape, color);
    iconElement.appendChild(iconSVG);
    return iconElement;
}

function drawMapIcon(shape, color) {
    switch (shape) {
        case 'Circle':
            return createCircle(color);
        case 'Square':
            return createSquare(color);
        case 'Triangle':
            return createTriangle(color);
        case 'Hexagon':
            return createHexagon(color);
        case 'Star':
            return createStar(color);
        case 'Diamond':
            return createDiamond(color);
		case 'Kite':
			  return createKite(color);
		case 'Pentagon':
				return createPentagon(color);
		case 'UpsideDownHouse':
				return createUpsideDownHouse(color);
		case 'Raindrop':
				return createRaindrop(color);
		case 'Moon':
				return createMoon(color);
		case 'Cross':
				return createCross(color);
    }
}

function createCircle(color) {
    var circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttributeNS(null, 'data-icon', 'Circle');
    circle.setAttributeNS(null, 'cx', 0.5);
    circle.setAttributeNS(null, 'cy', 0.5);
    circle.setAttributeNS(null, 'r', 0.35);
    circle.setAttributeNS(null, 'style', 'stroke:black; stroke-width:0.075; fill:rgb(' + color.r + ',' + color.g + ',' + color.b + ')');
    return circle;
}

function createSquare(color) {
    var square = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    square.setAttributeNS(null, 'data-icon', 'Square');
    square.setAttributeNS(null, 'points', '0.15,0.15 0.15,0.85 0.85,0.85 0.85,0.15')
    square.setAttributeNS(null, 'style', 'stroke:black; stroke-width:0.075; fill:rgb(' + color.r + ',' + color.g + ',' + color.b + ')');
    return square;
}

function createTriangle(color) {
    var group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttributeNS(null, 'data-icon', 'Triangle');

    var triangle = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    triangle.setAttributeNS(null, 'points', '0.1,0.9 0.5,0.1 0.9,0.9');
    triangle.setAttributeNS(null, 'style', 'stroke:black; stroke-width:0.075; fill:rgb(' + color.r + ',' + color.g + ',' + color.b + ')');
    group.appendChild(triangle);

    var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttributeNS(null, 'x1', 0.27);
    line.setAttributeNS(null, 'y1', 0.55);
    line.setAttributeNS(null, 'x2', 0.73);
    line.setAttributeNS(null, 'y2', 0.55);
    line.setAttributeNS(null, 'style', 'stroke:black; stroke-width:0.04;');
    group.appendChild(line);

    return group;
}

function createHexagon(color) {
    var hexagon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    hexagon.setAttributeNS(null, 'data-icon', 'Hexagon');
    hexagon.setAttributeNS(null, 'points', '0.5,0.08 0.14,0.29 0.14,0.71 0.5,0.92 0.86,0.71 0.86,0.29');
    hexagon.setAttributeNS(null, 'style', 'stroke:black; stroke-width:0.075; fill:rgb(' + color.r + ',' + color.g + ',' + color.b + ')');
    return hexagon;
}

function createStar(color) {
    var star = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    star.setAttributeNS(null, 'data-icon', 'Star');
    star.setAttributeNS(null, 'points', '0.5,0.12 0.4,0.42 0.09,0.42 0.34,0.6 0.24,0.9 0.5,0.72 0.75,0.9 0.66,0.6 0.91,0.42 0.6,0.42')
    star.setAttributeNS(null, 'style', 'stroke:black; stroke-width:0.075; fill:rgb(' + color.r + ',' + color.g + ',' + color.b + ')');
    return star;
}

function createDiamond(color) {
    var group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttributeNS(null, 'data-icon', 'Diamond');

    var top = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    top.setAttributeNS(null, 'points', '0.5,0.96 0.27,0.73 0.5,0.5 0.73,0.73');
    top.setAttributeNS(null, 'style', 'stroke:black; stroke-width:0.075; fill:rgb(' + color.r + ',' + color.g + ',' + color.b + ')');
    group.appendChild(top);

    var bottom = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    bottom.setAttributeNS(null, 'points', '0.5,0.5 0.27,0.27 0.5,0.04 0.73,0.27');
    bottom.setAttributeNS(null, 'style', 'stroke:black; stroke-width:0.075; fill:rgb(' + color.r + ',' + color.g + ',' + color.b + ')');
    group.appendChild(bottom);

    var left = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    left.setAttributeNS(null, 'points', '0.42,0.5 0.24,0.69 0.04,0.5 0.23,0.31');
    left.setAttributeNS(null, 'style', 'stroke:black; stroke-width:0.06; fill:rgb(' + color.r + ',' + color.g + ',' + color.b + ')');
    group.appendChild(left);

    var right = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    right.setAttributeNS(null, 'points', '0.58,0.5 0.77,0.31 0.96,0.5 0.77,0.69');
    right.setAttributeNS(null, 'style', 'stroke:black; stroke-width:0.06; fill:rgb(' + color.r + ',' + color.g + ',' + color.b + ')');
    group.appendChild(right);

    return group;
}

function createKite(color) {
		var fillColor = 'rgb(' + color.r + ',' + color.g + ',' + color.b + ')';
		var kite = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
		kite.setAttributeNS(null, 'points', '0.5,0.1 0.8,0.35 0.5,0.9 0.2,0.35');
		kite.setAttributeNS(null, 'style', 'stroke:black; stroke-width:0.06; fill:' + fillColor);
		return kite;
}

function createPentagon(color) {
		var fillColor = 'rgb(' + color.r + ',' + color.g + ',' + color.b + ')';
		var pentagon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
		pentagon.setAttributeNS(null, 'points', '0.5,0.1 0.85,0.4 0.7,0.8 0.3,0.8 0.15,0.4');
		pentagon.setAttributeNS(null, 'style', 'stroke:black; stroke-width:0.06; fill:' + fillColor);
		return pentagon;
}

function createUpsideDownHouse(color) {
		var fillColor = 'rgb(' + color.r + ',' + color.g + ',' + color.b + ')';
		var usdh = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
		usdh.setAttributeNS(null, 'points', '0.2,0.2 0.8,0.2 0.8,0.6 0.5,0.9 0.2,0.6');
		usdh.setAttributeNS(null, 'style', 'stroke:black; stroke-width:0.06; fill:' + fillColor);
		return usdh;
}

function createRaindrop(color) {
		var fillColor = 'rgb(' + color.r + ',' + color.g + ',' + color.b + ')';
		var raindrop = document.createElementNS('http://www.w3.org/2000/svg', 'path');
		raindrop.setAttributeNS(null, 'd', 'M 0.5 0.2  L 0.7 0.6  C 0.7,0.95 0.3,0.95 0.3,0.6  L 0.5 0.2  Z');
		raindrop.setAttributeNS(null, 'style', 'stroke:black; stroke-width:0.06; fill:' + fillColor);
		return raindrop;
}

function createMoon(color) {
		var fillColor = 'rgb(' + color.r + ',' + color.g + ',' + color.b + ')';
		var moon = document.createElementNS('http://www.w3.org/2000/svg', 'path');
		moon.setAttributeNS(null, 'd', 'M 0.1 0.3  C 0.4,0.55 0.6,0.55 0.9,0.3  C 0.95,0.9 0.05,0.9 0.1,0.3  Z');
		moon.setAttributeNS(null, 'style', 'stroke:black; stroke-width:0.06; fill:' + fillColor);
		return moon;
}

function createCross(color) {
		var fillColor = 'rgb(' + color.r + ',' + color.g + ',' + color.b + ')';
		var cross = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
		cross.setAttributeNS(null, 'points', '0.5,0.1 0.6,0.4 0.9,0.5 0.6,0.6 0.5,0.9 0.4,0.6 0.1,0.5 0.4,0.4 0.5,0.1');
		cross.setAttributeNS(null, 'style', 'stroke:black; stroke-width:0.06; fill:' + fillColor);
		return cross;
}
