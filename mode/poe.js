(function(mod) {
	if (typeof exports == "object" && typeof module == "object") // CommonJS
		mod(require("../../lib/codemirror"));
	else if (typeof define == "function" && define.amd) // AMD
		define(["../../lib/codemirror"], mod);
	else // Plain browser env
		mod(CodeMirror);
})(function(CodeMirror) {
	"use strict";

	function startState() {
		return {
			// we must remember whether we have encountered at least one visibility token,
			// because only empty lines and comments are allowed before that
			hasVisibilityToken: false,
			// stack of types to be expected next
			// KEYWORD - visibility | filter | modifier
			// STRINGS - one or more strings, with or without quotes
			// NUMBER_FORMULA - number or operator and number
			// NUMBER
			// OPERATOR
			// SOCKETS
			// RARITY_FORMULA - rarity or operator and rarity
			// RARITY
			expected: ['KEYWORD'],

			isVisibility: false,
			previousLineWasVisibility: false,
			isEmptyLine: false,
			previousLineWasEmpty: true,
			currentIndentation: 0,
			lastIndentation: 0
		};
	}

	function token(stream, state) {
		if (stream.sol()) {
			state.expected = ['KEYWORD'];
			state.previousLineWasEmpty = state.isEmptyLine;
			state.isEmptyLine = false;
			state.previousLineWasVisibility = state.isVisibility;
			state.isVisibility = false;
			state.lastIndentation = state.currentIndentation;
			state.currentIndentation = stream.indentation();

			if (stream.eatSpace()) {
				if (stream.eol()) {
					state.isEmptyLine = true;
				}
				return null;
			}
		}

		// ignore whitespace
		if (stream.eatSpace()) {
			return null;
		}

		if (stream.eol()) {
			return null;
		}

		// comments
		if (stream.eat('#')) {
			stream.skipToEnd();
			return 'comment';
		}

		if (state.expected.length === 0) {
			stream.skipToEnd();
			return 'error';
		}

		var expected = state.expected.pop();

		if (expected === 'KEYWORD') {
			return handleKeywordTokens(stream, state);
		}

		return handleArgumentTokens(stream, state, expected);
	}

	function handleKeywordTokens(stream, state) {
		if (matchKeyword(stream, ['Show', 'Hide', 'Continue'])) {
			state.hasVisibilityToken = true;
			state.isVisibility = true;
			state.expected = [];
			return 'keyword';
		}

		if (!state.hasVisibilityToken) {
			stream.skipToEnd();
			return 'error';
		}
/*
		if (matchKeyword(stream, FILTER_DEFINITIONS.listNames())) {
			let filterKeyword = stream.current();
			// FIXME: set state to filterDef and pull grammar from it
			let filterDef = FILTER_DEFINITIONS.getMeta(filterKeyword);
			return 'keyword'
		}
*/
		if (matchKeyword(stream, ['ItemLevel', 'DropLevel', 'AreaLevel', 'Quality', 'Sockets', 'LinkedSockets', 'Width', 'Height', 'MapTier', 'GemLevel', 'StackSize'])) {
			state.expected = ['NUMBER_FORMULA'];
			return 'keyword';
		}
		if (matchKeyword(stream, ['Rarity'])) {
			state.expected = ['RARITY_FORMULA'];
			return 'keyword';
		}
		if (matchKeyword(stream, ['HasInfluence'])) {
			state.expected = ['INFLUENCE_FORMULA'];
			return 'keyword';
		}
		if (matchKeyword(stream, ['Class', 'BaseType', 'HasExplicitMod', 'CustomAlertSound', 'Prophecy', 'HasEnchantment'])) {
			state.expected = ['STRING_FORMULA'];
			return 'keyword';
		}
		if (matchKeyword(stream, ['SocketGroup'])) {
			state.expected = ['SOCKETS'];
			return 'keyword';
		}
		if (matchKeyword(stream, ['Identified', 'Corrupted', 'ShaperItem', 'ElderItem', 'ShapedMap', 'BlightedMap', 'FracturedItem', 'SynthesisedItem', 'AnyEnchantment', 'Replica'])) {
			state.expected = ['BOOLEAN'];
			return 'keyword';
		}
		if (matchKeyword(stream, ['SetBackgroundColor', 'SetBorderColor', 'SetTextColor'])) {
			state.expected = ['NUMBER', 'NUMBER', 'NUMBER', 'NUMBER'];
			return 'keyword';
		}
		if (matchKeyword(stream, ['SetFontSize'])) {
			state.expected = ['NUMBER'];
			return 'keyword';
		}
		// NOTE: Order is important here because otherwise PlayAlertSound would always be a partial match of
		// PlayAlertSoundPositional, and CodeMirror would always think that there's an invalid 'Positional' token
		// that doesn't belong there
		if (matchKeyword(stream, ['PlayAlertSoundPositional', 'PlayAlertSound'])) {
			state.expected = ['NUMBER', 'SOUND_ID']; // This is a stack, so it must be in reverse order!
			return 'keyword';
		}
		if (matchKeyword(stream, ['DisableDropSound'])) {
			return 'keyword';
		}
		if (matchKeyword(stream, ['MinimapIcon'])) {
			state.expected = ['ICON_SHAPE', 'COLOR_NAME', 'NUMBER']; // This is a stack, so it must be in reverse order!
			return 'keyword';
		}
		if (matchKeyword(stream, ['PlayEffect'])) {
			state.expected = ['TEMP', 'COLOR_NAME'];
			return 'keyword';
		}

		stream.skipToEnd();
		return 'error';
	}

	function handleArgumentTokens(stream, state, expected) {
		if (expected === 'STRING_FORMULA') {
			state.expected.push('STRINGS');
			if (matchKeyword(stream, OPERATORS.STRING_APPLICABLE)) {
				return 'operator';
			}
			return null;
		}

		if (expected === 'STRINGS') {
			if (stream.eat('"')) {
				stream.skipTo('"');
				state.expected.push('STRINGS');
				return 'string';
			}
			if (stream.match(/^[a-zA-Z]+/)) {
				state.expected.push('STRINGS');
				return 'string';
			}
			stream.skipToEnd();
			return 'error';
		}

		if (expected === 'NUMBER_FORMULA') {
			state.expected.push('NUMBER');
			if (matchKeyword(stream, OPERATORS.ALL)) {
				return 'operator';
			}
			return null;
		}

		if (expected === 'RARITY_FORMULA') {
			state.expected.push('RARITY');
			if (matchKeyword(stream, OPERATORS.ALL)) {
				return 'operator';
			}
			return null;
		}

		if (expected === 'INFLUENCE_FORMULA') {
			state.expected.push('STRINGS');
			if (matchKeyword(stream, ['=='])) {
				return 'operator';
			}
			return null;
		}

		if (expected === 'NUMBER') {
			if (stream.match(/^[0-9]+/)) {
				return 'number';
			}
		}

		if (expected === 'BOOLEAN') {
			if (matchKeyword(stream, ['True', 'False'])) {
				return 'atom';
			}
		}

		if (expected === 'OPERATOR') {
			if (matchKeyword(stream, OPERATORS.ALL)) {
				return 'operator';
			}
		}

		if (expected === 'SOCKETS') {
			if (stream.match(/^\"[RGBW]+\"/)) {
				return 'string';
			}
			if (stream.match(/^[RGBW]+/)) {
				return 'string';
			}
		}

		if (expected === 'RARITY') {
			if (matchKeyword(stream, ['Normal', 'Magic', 'Rare', 'Unique'])) {
				return 'atom';
			}
		}

		if (expected === 'SOUND_ID') {
			var shaperSounds = [
				'ShAlchemy', 'ShBlessed', 'ShChaos', 'ShDivine', 'ShExalted', 'ShFusing', 'ShGeneral', 'ShMirror',
				'ShRegal', 'ShVaal'];

			if (matchKeyword(stream, shaperSounds)) {
				return 'atom';
			}

			if (stream.match(/^[0-9]+/)) {
				return 'number';
			}
		}

		if (expected === 'COLOR_NAME') {
			if (matchKeyword(stream, ['Red', 'Green', 'Blue', 'Brown', 'White', 'Yellow'])) {
				return 'atom';
			}
		}

		if (expected === 'TEMP') {
			if (matchKeyword(stream, ['Temp'])) {
				return 'atom';
			}
		}

		if (expected === 'ICON_SHAPE') {
			if (matchKeyword(stream, ['Circle', 'Diamond', 'Hexagon', 'Square', 'Star', 'Triangle'])) {
				return 'atom';
			}
		}
	}

	function matchKeyword(stream, keywords) {
		for (var i = 0; i < keywords.length; i++) {
			if (stream.match(keywords[i], true, false)) {
				return true;
			}
		}
		return false;
	}

	function indent(state, textAfter) {
		if (textAfter.startsWith('Show') || textAfter.startsWith('Hide')) {
			return 0;
		}
		if (textAfter.trim().length === 0 || textAfter.trim().startsWith('#')) {
			return CodeMirror.Pass;
		}
		return 4;
	}

	CodeMirror.defineMode("poe", function(options, modeOptions) {
		var mode = {
			startState: startState,
			token: token,
			lineComment: '#'
		};

		if (modeOptions.autoIndent) {
			mode.indent = indent,
				mode.electricInput = /((Show)|(Hide))$/
		}

		return mode;
	});

});
