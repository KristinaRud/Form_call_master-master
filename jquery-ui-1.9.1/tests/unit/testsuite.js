(function( $ ) {

var reset, jshintLoaded;

window.TestHelpers = {};

function includeStyle( url ) {
	document.write( "<link rel='stylesheet' href='../../../" + url + "'>" );
}

function includeScript( url ) {
	document.write( "<script src='../../../" + url + "'></script>" );
}

function url( value ) {
	return value + (/\?/.test(value) ? "&" : "?") + new Date().getTime() + "" + parseInt(Math.random() * 100000, 10);
}

reset = QUnit.reset;
QUnit.reset = function() {
	// Ensure jQuery events and data on the fixture are properly removed
	jQuery("#qunit-fixture").empty();
	// Let QUnit reset the fixture
	reset.apply( this, arguments );
};


QUnit.config.requireExpects = true;

QUnit.config.urlConfig.push({
  id: "min",
  label: "Minified source",
  tooltip: "Load minified source files instead of the regular unminified ones."
});

TestHelpers.loadResources = QUnit.urlParams.min ?
	function() {
		includeStyle( "dist/jquery-ui.min.css" );
		includeScript( "dist/jquery-ui.min.js" );
	} :
	function( resources ) {
		$.each( resources.css || [], function( i, resource ) {
			includeStyle( "themes/base/jquery." + resource + ".css" );
		});
		$.each( resources.js || [], function( i, resource ) {
			includeScript( resource );
		});
	};

QUnit.config.urlConfig.push({
	id: "nojshint",
	label: "Skip JSHint",
	tooltip: "Skip running JSHint, e.g. within TestSwarm, where Jenkins runs it already"
});

jshintLoaded = false;
TestHelpers.testJshint = function( module ) {
	if ( QUnit.urlParams.nojshint ) {
		return;
	}

	if ( !jshintLoaded ) {
		includeScript( "external/jshint.js" );
		jshintLoaded = true;
	}

	asyncTest( "JSHint", function() {
		expect( 1 );

		$.when(
			$.ajax({
				url: url("../../../ui/.jshintrc"),
				dataType: "json"
			}),
			$.ajax({
				url: url("../../../ui/jquery.ui." + module + ".js"),
				dataType: "text"
			})
		).done(function( hintArgs, srcArgs ) {
			var passed = JSHINT( srcArgs[ 0 ], hintArgs[ 0 ] ),
				errors = $.map( JSHINT.errors, function( error ) {
					// JSHINT may report null if there are too many errors
					if ( !error ) {
						return;
					}

					return "[L" + error.line + ":C" + error.character + "] " +
						error.reason + "\n" + error.evidence + "\n";
				}).join( "\n" );
			ok( passed, errors );
			start();
		})
		.fail(function() {
			ok( false, "error loading source" );
			start();
		});
	});
};

function testWidgetDefaults( widget, defaults ) {
	var pluginDefaults = $.ui[ widget ].prototype.options;

	// ensure that all defaults have the correct value
	test( "defined defaults", function() {
		var count = 0;
		$.each( defaults, function( key, val ) {
			expect( ++count );
			if ( $.isFunction( val ) ) {
				ok( $.isFunction( pluginDefaults[ key ] ), key );
				return;
			}
			deepEqual( pluginDefaults[ key ], val, key );
		});
	});

	// ensure that all defaults were tested
	test( "tested defaults", function() {
		var count = 0;
		$.each( pluginDefaults, function( key ) {
			expect( ++count );
			ok( key in defaults, key );
		});
	});
}

function testWidgetOverrides( widget ) {
	if ( $.uiBackCompat === false ) {
		test( "$.widget overrides", function() {
			expect( 4 );
			$.each([
				"_createWidget",
				"destroy",
				"option",
				"_trigger"
			], function( i, method ) {
				strictEqual( $.ui[ widget ].prototype[ method ],
					$.Widget.prototype[ method ], "should not override " + method );
			});
		});
	}
}

function testBasicUsage( widget ) {
	test( "basic usage", function() {
		expect( 3 );

		var defaultElement = $.ui[ widget ].prototype.defaultElement;
		$( defaultElement ).appendTo( "body" )[ widget ]().remove();
		ok( true, "initialized on element" );

		$( defaultElement )[ widget ]().remove();
		ok( true, "initialized on disconnected DOMElement - never connected" );

		$( defaultElement ).appendTo( "body" ).remove()[ widget ]().remove();
		ok( true, "initialized on disconnected DOMElement - removed" );
	});
}

TestHelpers.commonWidgetTests = function( widget, settings ) {
	module( widget + ": common widget" );

	TestHelpers.testJshint( widget );
	testWidgetDefaults( widget, settings.defaults );
	testWidgetOverrides( widget );
	testBasicUsage( widget );
	test( "version", function() {
		expect( 1 );
		ok( "version" in $.ui[ widget ].prototype, "version property exists" );
	});
};

/*
 * Experimental assertion for comparing DOM objects.
 *
 * Serializes an element and some properties and attributes and it's children if any, otherwise the text.
 * Then compares the result using deepEqual.
 */
window.domEqual = function( selector, modifier, message ) {
	var expected, actual,
		properties = [
			"disabled",
			"readOnly"
		],
		attributes = [
			"autocomplete",
			"aria-activedescendant",
			"aria-controls",
			"aria-describedby",
			"aria-disabled",
			"aria-expanded",
			"aria-haspopup",
			"aria-hidden",
			"aria-labelledby",
			"aria-pressed",
			"aria-selected",
			"aria-valuemax",
			"aria-valuemin",
			"aria-valuenow",
			"class",
			"href",
			"id",
			"nodeName",
			"role",
			"tabIndex",
			"title"
		];

	function extract( elem ) {
		if ( !elem || !elem.length ) {
			QUnit.push( false, actual, expected,
				"domEqual failed, can't extract " + selector + ", message was: " + message );
			return;
		}

		var children,
			result = {};
		$.each( properties, function( index, attr ) {
			var value = elem.prop( attr );
			result[ attr??] = value !== undefined ? value : "";
		});
		$.each( attributes, function( index, attr ) {
			var value = elem.attr( attr );
			result[ attr??] = value !== undefined ? value : "";
		});
		result.events = $._data( elem[ 0 ], "events" );
		result.data = $.extend( {}, elem.data() );
		delete result.data[ $.expando ];
		children = elem.children();
		if ( children.length ) {
			result.children = elem.children().map(function() {
				return extract( $( this ) );
			}).get();
		} else {
			result.text = elem.text();
		}
		return result;
	}
	expected = extract( $( selector ) );
	modifier( $( selector ) );

	actual = extract( $( selector ) );
	QUnit.push( QUnit.equiv(actual, expected), actual, expected, message );
};

}( jQuery ));
