
function Rule(visibility) {
	this.show = visibility;
	this.filters = [];
	this.modifiers = [];
	this.codeLines = [];
	this.continues = false;

	this.match = function(item) {
		return this.filters.every(function(filter) { return filter.match(item); });
	}

	this.applyTo = function(item) {
		item.setVisibility(this.show);
		this.modifiers.forEach(function(modifier) { modifier.applyTo(item); });
	}
}


// -------------------- Filters ---------------------
/**
* Expected config format:
{
	<FilterName>: { //as in POE item filter file
		comp: <subclassNameOf(ItemFilter) minus 'Filter'>,
		prop: <name of property in Item>, //optional, will be <filterName> by default
		converter: <key from CONVERTER>, //optional, only needed if item[prop] needs none-default type conversion or data extraction to work with the filter type
		config: <object> //filter-specific configuration data, like constants contained in an enum
	}
}
This is the external config format which could also be imported from json.

It will be translated into a slightly different format for internal use, containing classes and other non-json compatible entities
*/
function buildFilterDefinitionsFromConfig(filterConfig) {
	let definitions = {}
	for (let [name, def] of Object.entries(filterConfig)) {
		let filterClass = FILTER_CLASSES[def.comp + 'Filter'];
		if (typeof filterClass == "undefined") {
			console.error("Invalid filter class type:", def.comp)
			continue;
		}
		definitions[name] = {
			propertyName: def.prop || name,
			config: def.config || {},
			converter: CONVERTER[def.converter] || CONVERTER.NoChange,
			factory: filterClass
		}
	}
	return {
		listNames: function() { return Object.keys(definitions) },
		getMeta: function(filterName) { return definitions[filterName] },

		createInstance: function(parser, filterName, arguments) {
			let meta = this.getMeta(filterName);
			if (typeof meta == "undefined") { return null }
			let filterInstance = meta.factory(parser, meta.propertyName, arguments);
			if (filterInstance != null) {
				filterInstance.config = meta.config;
				filterInstance.converter = meta.converter;
			}
			return filterInstance;
		},
	}
}

/** Marker and Base class for all filters */
var FILTER_CLASSES = {}
FILTER_CLASSES.ItemFilter = class ItemFilter {
	constructor(parser, propertyName, comparator, filterValue) {
		this.parser = parser;
		//make sure the property starts with a lower case letter
		this.propertyName = propertyName.charAt(0).toLowerCase() + propertyName.slice(1);
		this.value = filterValue;
		this.comparator = comparator || OPERATORS.get('=');
		console.log(`L${parser.uiLineNumber()}:`, "Generate", this.toString())
	}
	match(item) {
		this.converter ||= CONVERTER.NoChange;
		let actualItemValue = this.converter(item[this.propertyName]);
		// easy variant first
		if (!Array.isArray(this.value)) {
			return this.comparator(actualItemValue, this.value);
		}

		let testFunction = this.comparator.bind(null, actualItemValue);
		let itemFound = this.value.some(testFunction);

		// operator is NOT Equal, so it must return True only if NONE of the items match
		if (this.comparator.isNegation) { return !itemFound; }

		//positive equality means that the operator must return true for one entry of the list
		return itemFound;
	}
	toString() {
		return `${this.constructor.name}{${this.propertyName} ${this.comparator.asString} ${this.value}}`;
	}
}

FILTER_CLASSES.NumericComparisonFilter = class NumericComparisonFilter extends ItemFilter {
	static create(parser, propertyName, argumentLine) {
		let parseResult = parser.parseOperatorAndValue(argumentLine);
		if (parseResult == null) {
			return null;
		}

		if (isNaN(parseResult.value)) {
			parser.reportTokenError(parseResult.value, 'number');
			return null;
		}
		return new NumericComparisonFilter(parser, propertyName, parseResult.comparer, parseResult.value);
	}
}

FILTER_CLASSES.BooleanComparisonFilter = class BooleanComparisonFilter extends ItemFilter {
	static create(parser, propertyName, argumentLine) {
		let result = parser.parseStringArguments(argumentLine);
		if (result.comparer != null) {
			parser.reportTokenError(result.comparer.asString, 'no operator')
		}
		if (result === null || result.value.length != 1) {
			parser.reportUnexpectedEndOfLine('expected True or False (without operator)');
			return null;
		}

		let value = BOOL_TOKENS[result.value[0]];
		if (typeof value != "undefined") {
			return new BooleanComparisonFilter(parser, propertyName, undefined, value)
		}

		parser.reportTokenError(result.value[0], 'True or False');
		return null;
	}
}

/**
 * Tested with 3.25 with Rarity filter (the only enum so far):<br>
 * Syntax is <code>FilterName [operator] [constant]+</code>
 * <p>
 * Works with ALL operators, even in lists. 
 * Operator is applied against every entry.
 * If one entry returns true, the filter applies.
 * This theoretically can be used for stuff like
 * 
 * <code>
 * Show
 *     Rarity > Normal Rare
 * </code>
 * 
 * Which will show everything > Normal. The second condition doesn't change the outcome,
 * but the syntax is accepted by PoE.
 * </p>
 */
FILTER_CLASSES.EnumComparisonFilter = class EnumComparisonFilter extends ItemFilter {
	/** enumDefinition: Array of strings, order is important for comparisons */
	constructor(parser, enumDefinition, propertyName, comparator, value) {
		super(parser, propertyName, comparator, value);
		this.enum = enumDefinition;
	}
	match(item) {
		let property = item[this.propertyName];
		if (isFinite(property)) { return super.match(item); }

		let index = this.enum.indexOf(property);
		// delegate to generic match with customized item copy
		// done so that all generic handling for operators and lists apply
		return super.match({ [this.propertyName]: index })
	}
	static create(parser, propertyName, argumentLine, enumDefinition) {
		let result = parser.parseStringArguments(argumentLine);

		if (result.value.length == 0) {
			parser.reportTokenError("", `at least one of [${enumDefinition.join(', ')}]`);
			return null;
		}

		let values = []
		for (let token of result.value) {
			let index = enumDefinition.indexOf(token);
			if (index < 0) {
				parser.reportTokenError(token, `at least one of [${enumDefinition.join(', ')}]`);
				return null;
			}
			values.push(index);
		}
		let comparator = result.comparer;
		let value = null;
		if (values.length == 1) { value = values[0] }
		else { value = values; }

		return new EnumComparisonFilter(parser, enumDefinition, propertyName, comparator, value);
	}
}

class StringListMemberFilter extends ItemFilter {
	static create(parser, propertyName, argumentLine) {
		let result = parser.parseStringArguments(argumentLine);
	}
}

function ItemLevelFilter(comparer, itemLevel) {
	this.match = function(item) {
		return comparer(item.itemLevel, itemLevel);
	};
}

function DropLevelFilter(comparer, dropLevel) {
	this.match = function(item) {
		return comparer(item.dropLevel, dropLevel);
	};
}

function AreaLevelFilter(comparer, areaLevel) {
	this.match = function(item) {
		return comparer(PoEdit.areaLevel, areaLevel);
	}
}

function QualityFilter(comparer, quality) {
	this.match = function(item) {
		return comparer(item.quality, quality);
	};
}

// Rarity uses integer representation
function RarityFilter(comparer, rarity) {
	this.match = function(item) {
		return comparer(item.rarity, rarity);
	};
}

function ClassFilter(itemClasses) {
	this.match = function(item) {
		return itemClasses.some(function(cls) { return StrUtils.contains(cls, item.itemClass); });
	};
}

function BaseTypeFilter(baseTypes) {
	this.match = function(item) {
		return baseTypes.some(function(bt) { return StrUtils.contains(bt, item.baseType); });
	};
}

function SocketsFilter(comparer, numSockets) {
	this.match = function(item) {
		return comparer(item.getNumSockets(), numSockets);
	};
}

function LinkedSocketsFilter(comparer, numLinkedSockets) {
	this.match = function(item) {
		var largestSocketGroup = item.sockets
			.map(function(grp) { return grp.length; })
			.reduce(function(prev, cur) { return Math.max(prev, cur); }, 0);

		return comparer(largestSocketGroup, numLinkedSockets);
	};
}

function SocketGroupFilter(groups) {
	this.minSocketCounts = groups.map(StrUtils.countChars);

	function isSubsetOf(subsetCounts, containerCounts) {
		for (var s in containerCounts) {
			if (!(s in subsetCounts)) {
				return false;
			}
			if (subsetCounts[s] < containerCounts[s]) {
				return false;
			}
		}
		return true;
	}

	function matchSocketGroups(grp, refGroups) {
		var socketCounts = StrUtils.countChars(grp);
		return refGroups.some(function(refGrp) {
			return isSubsetOf(socketCounts, refGrp);
		});
	}

	this.match = function(item) {
		return item.sockets.some(function(grp) {
			return matchSocketGroups(grp, this.minSocketCounts);
		}, this);
	}
}

function WidthFilter(comparer, width) {
	this.match = function(item) {
		return comparer(item.width, width);
	}
}

function HeightFilter(comparer, height) {
	this.match = function(item) {
		return comparer(item.height, height);
	}
}

function IdentifiedFilter(value) {
	this.match = function(item) {
		return item.identified === value;
	}
}

function CorruptedFilter(value) {
	this.match = function(item) {
		return item.corrupted === value;
	}
}

function ElderItemFilter(value) {
	this.filter = new HasInfluenceFilter('OR', ['Elder']);

	this.match = function(item) {
		return this.filter.match(item) === value;
	}
}

function ShaperItemFilter(value) {
	this.filter = new HasInfluenceFilter('OR', ['Shaper']);

	this.match = function(item) {
		return this.filter.match(item) === value;
	}
}

function HasInfluenceFilter(mode, influenceList) {
	this.reqInfluences = influenceList;
	this.mode = mode;

	this.match = function(item) {
		for (var i = 0; i < this.reqInfluences.length; i++) {
			var hasThisInfluence = false;
			for (var j = 0; j < item.influence.length; j++) {
				if (this.reqInfluences[i].toLowerCase() === item.influence[j].toLowerCase()) {
					hasThisInfluence = true;

					// If mode is OR, just one match is enough
					if (this.mode === 'OR') {
						return true;
					}
				}
			}
			// If mode is AND, just one required influence without match fails the whole rule
			if (this.mode === 'AND' && !hasThisInfluence) {
				return false;
			}
		}
		// If we have compared everything and haven't early exited,
		// it means we haven't found a success in the OR case,
		// or we haven't found a failure in the AND case
		if (mode === 'OR') {
			return false;
		}
		return true;
	}
}

function FracturedItemFilter(value) {
	this.match = function(item) {
		return item.fracturedItem === value;
	}
}

function SynthesisedItemFilter(value) {
	this.match = function(item) {
		return item.synthesisedItem === value;
	}
}

function ShapedMapFilter(value) {
	this.match = function(item) {
		return item.shapedMap === value;
	}
}

function HasExplicitModFilter(mods) {
	this.match = function(item) {
		return mods.some(function(mod) { return item.hasExplicitMod(mod); });
	}
}

function MapTierFilter(comparer, tier) {
	this.match = function(item) {
		return item.mapTier !== 0 && comparer(item.mapTier, tier);
	}
}

function GemLevelFilter(comparer, level) {
	this.match = function(item) {
		return item.gemLevel !== 0 && comparer(item.gemLevel, level);
	}
}

function StackSizeFilter(comparer, size) {
	this.match = function(item) {
		return comparer(item.stackSize, size);
	}
}

function ProphecyFilter(names) {
	this.match = function(item) {
		return names.some(function(name) { return item.baseType == 'Prophecy' && StrUtils.contains(name, item.name); });
	}
}

function AnyEnchantmentFilter(value) {
	this.match = function(item) {
		var itemHasEnchantment = item.enchantment.length > 0;
		return value === itemHasEnchantment;
	}
}

function HasEnchantmentFilter(enchantments) {
	var lowercaseFilters = enchantments.map(x => x.toLowerCase());
	this.match = function(item) {
		var lowercaseItemEnchantment = item.enchantment.toLowerCase();
		return lowercaseFilters.some(function(ench) { return StrUtils.contains(ench, lowercaseItemEnchantment); });
	}
}

function BlightedMapFilter(value) {
	this.match = function(item) {
		return item.blightedMap === value;
	}
}

function ReplicaFilter(value) {
	this.match = function(item) {
		if (item.replica) {
			return true;
		}
		return item.replica === value;
	}
}

// ------------------------ Modifiers --------------------------------------

function SetBackgroundColorModifier(color) {
	this.applyTo = function(item) {
		item.setBackgroundColor(color);
	}
}

function SetBorderColorModifier(color) {
	this.applyTo = function(item) {
		item.setBorderColor(color);
	}
}

function SetTextColorModifier(color) {
	this.applyTo = function(item) {
		item.setTextColor(color);
	}
}

function PlayAlertSoundModifier(soundId, volume) {
	this.applyTo = function(item) {
		// not implemented
	}
}

function PlayAlertSoundPositionalModifier(soundId, volume) {
	this.applyTo = function(item) {
		// not implemented
	}
}

function SetFontSizeModifier(fontSize) {
	this.applyTo = function(item) {
		item.setFontSize(MathUtils.clamp(fontSize, 18, 45));
	}
}

function DisableDropSoundModifier() {
	this.applyTo = function(item) {
		// not implemented
	}
}

function CustomAlertSoundModifier(path) {
	this.applyTo = function(item) {
		// not implemented
	}
}

function MinimapIconModifier(size, color, shape) {
	var colors = {
		'Red': { r: 250, g: 120, b: 100 },
		'Green': { r: 140, g: 250, b: 120 },
		'Blue': { r: 130, g: 170, b: 250 },
		'Brown': { r: 200, g: 130, b: 80 },
		'White': { r: 250, g: 250, b: 250 },
		'Yellow': { r: 220, g: 220, b: 100 },
		'Grey': { r: 180, g: 180, b: 180 },
		'Pink': { r: 230, g: 130, b: 190 },
		'Cyan': { r: 100, g: 210, b: 210 },
		'Purple': { r: 140, g: 50, b: 200 },
		'Orange': { r: 240, g: 140, b: 40 }
	};

	this.applyTo = function(item) {
		item.setMapIcon(shape, colors[color], size);
	}
}

function PlayEffectModifier(color) {
	var colors = {
		'Red': { r: 250, g: 120, b: 100 },
		'Green': { r: 140, g: 250, b: 120 },
		'Blue': { r: 130, g: 170, b: 250 },
		'Brown': { r: 200, g: 130, b: 80 },
		'White': { r: 250, g: 250, b: 250 },
		'Yellow': { r: 220, g: 220, b: 100 },
		'Grey': { r: 180, g: 180, b: 180 },
		'Pink': { r: 230, g: 130, b: 190 },
		'Cyan': { r: 100, g: 210, b: 210 },
		'Purple': { r: 140, g: 50, b: 200 },
		'Orange': { r: 240, g: 140, b: 40 }
	};

	this.applyTo = function(item, temp) {
		item.setBeam(colors[color], temp);
	}
}
