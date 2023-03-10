// Copyright 2004 MTM Softwarehaus Dresden
// Hilfsfunktionen fuer HTML-Datenkarten
// 2004-04-26 TOM


var MTMcolorSelect = '#FFCC00';  // Farbe f�r Hervorhebungen beim Ueberstreichen mit der Maus
var MTMcolorDeselect;            // Hier wird waehrend der Hervorhebung die urspruengliche Farbe gespeichert
var MTMdragging = 0;             // Wird beim Linksklick auf 1 gesetzt und beim Verlassen einer Zelle geprueft


function MTMhighlightOn( object ) {
    var parentObj;
    var protect = 10;

    parentObj = object;
    while( parentObj.nodeName !== 'TD' && protect > 0 ) {
        parentObj.bgColor = MTMcolorSelect;
        parentObj.style.background = MTMcolorSelect;
        //alert(parentObj.nodeName + " = " + parentObj.style.background);
        protect--;
        parentObj = parentObj.parentElement;
        if( parentObj === null )         { break; }
    }

    if( parentObj !== null ) {
        MTMcolorDeselect = parentObj.bgColor;
        parentObj.bgColor = MTMcolorSelect;
    }
}

// Wird beim Ueberstreichen einer Zelle mit der Maus aufgerufen
// 1. Parameter object ist ein HTML-Objekt, dessen Hintergrundfarbe geaendert wird (idR = this)
// 2. Parameter Text der in einer Infozeile ausgegeben werden soll (wird nicht mehr verwendet)
// 3. bis 5. Parameter, Daten zu dem Element
function MTMselect( object, text, code, index, variant ) {
    MTMhighlightOn( object );
}

function MTMhighlightOff( object ) {
    var parentObj;
    var protect = 10;

    parentObj = object;
    while( parentObj.nodeName !== 'TD' && protect > 0 ) {
        parentObj.bgColor = MTMcolorDeselect;
        parentObj.style.background = MTMcolorDeselect;
        protect--;
        parentObj = parentObj.parentElement;
        if( parentObj === null )         { break; }
    }

    if( parentObj !== null ) {
        parentObj.bgColor = MTMcolorDeselect;
    }
}
// Wird beim Verlassen einer Zelle mit der Maus aufgerufen (wenn beim Verlassen immer noch die linke
// Maustaste gedrueckt ist, wird ein Drag&Drop Event im TiCon erzeugt
// 1. Parameter object ist ein HTML-Objekt, dessen Hintergrundfarbe zurueckgesetzt werden soll (idR = this)
// 2. bis 4. Parameter, Daten zu dem Element
function MTMdeselect( object, code, index, variant ) {
    var parentObj;
    var protect = 10;

    parentObj = object;
    while( parentObj.nodeName !== 'TD' && protect > 0 ) {
        parentObj.bgColor = MTMcolorDeselect;
        parentObj.style.background = MTMcolorDeselect;
        protect--;
        parentObj = parentObj.parentElement;
        if( parentObj === null )         { break; }
    }

    if( parentObj !== null ) {
        parentObj.bgColor = MTMcolorDeselect;
    }

    //    MTMInfo.innerHTML = '<SPAN class="MTMInfo" align="left">&nbsp;</SPAN>';

    if( MTMdragging ) {
        MTMnavigate( 2, code, index, variant );
        MTMdragging = 0;
    }
}

// Loest einen Navigationsevent im TiCon aus
// 1. Parameter Navigationscode: 1 = mit linker Maustaste angeklickt, 2 Drag & Drop, 3 Rechte Maustaste
// 2. bis 4. Parameter, Daten zu dem Element
function MTMnavigate( navcode, code, index, variant ) {
    document.location.href = 'telem://code=' + code + ';index=' + index + ';variant=' + variant + ';navcode=' + navcode;
}


// Wird beim Pressen einer beliebigen Maustaste aufgerufen
// es wird geprueft ob Drag & Drop gestartet werden soll oder ein Rechtsklick ausgeloest werden soll
// 1. Event der ausgeloest wurde (idR = event)
// 2. bis 4. Parameter, Daten zu dem Element
function MTMmouseDown( e, code, index, variant ) {
    if( e.button === 1 ) { // linke Maustaste
        // vorbereiten zum Drag & Drop
        MTMdragging = 1;
    } else if( e.button === 2 ) { // rechte Maustaste
        // Navigieren mit NavCode 3
        MTMnavigate( 3, code, index, variant );
    }
}


// Tooltip///////////////////////////////////////////////////////////
/*    Your are permitted to reuse this code as long as the following copyright
    notice is not removed:

    The    HTML tip handling code is copyright 1998 by insideDHTML.com, LLC. More information about this
    code can be found at Inside Dynamic HTML: HTTP://www.insideDHTML.com
*/

// Support for all collection
var    allSupport = document.all !== null;

function setupEventObject( e ) {
    // Map NS event object to IEs
    if ( e === null )     { return; } // IE returns
    window.event = e;
    window.event.fromElement = e.target;
    window.event.toElement = e.target;
    window.event.srcElement = e.target;
    window.event.x = e.x;
    window.event.y = e.y;
    // Route the event to the original element
    // Necessary to make sure _tip is set.
    window.event.srcElement.handleEvent( e );
}


function checkName( src ) {
    // Look for tooltip in IE
    while ( src !== null && src._tip === null ) { src = src.parentElement; }
    return src;
}

function getElement( elName ) {
    // Get an element from its ID
    if ( allSupport ) { return document.all[elName]; }
    return document.layers[elName];
}

function writeContents( el, tip ) {
    // Replace the contents    of the tooltip
    if ( allSupport ) {
        el.innerHTML = tip;
    } else {
        // In NS, insert a table to work around
        // stylesheet rendering bug.
        // NS fails to apply style sheets when writing
        // contents    into a positioned element.
        el.document.open();
        el.document.write( '<TABLE BORDER=1 bordercolor=black><TR><TD WIDTH=100% class="MTMTooltip">' );
        el.document.write( tip );
        el.document.write( '</TD></TR></TABLE>' );
        el.document.close();
    }
}

function getOffset( el, which ) {
    // Function for IE to calculate position
    // of an element.
    var amount = el['offset' + which];
    if ( which === 'Top' ) { amount += el.offsetHeight; }
    el = el.offsetParent;
    while ( el !== null ) {
        amount += el['offset' + which];
        el = el.offsetParent;
    }
    return amount;
}


function getScrollLeft() {
    // achtung nur f�r ie
    var scrollPos;
    if ( typeof window.pageXOffset !== 'undefined' ) {
        scrollPos = window.pageXOffset;
    } else if ( typeof document.compatMode !== 'undefined' &&
         document.compatMode !== 'BackCompat' ) {
        scrollPos = document.documentElement.scrollLeft;
    } else if ( typeof document.body !== 'undefined' ) {
        scrollPos = document.body.scrollLeft;
    }

    return scrollPos;
}

function getScrollTop() {
    // achtung nur f�r ie
    var scrollPos;
    if ( typeof window.pageYOffset !== 'undefined' ) {
        scrollPos = window.pageYOffset;
    } else if ( typeof document.compatMode !== 'undefined' &&
         document.compatMode !== 'BackCompat' ) {
        scrollPos = document.documentElement.scrollTop;
    } else if ( typeof document.body !== 'undefined' ) {
        scrollPos = document.body.scrollTop;
    }

    return scrollPos;
}

function setPosition( el, xpos, ypos, tip ) {
    var width;
    var scrollLeft;
    var scrollTop;
    var visWidth;
    var    elhidden = getElement( 'tipBoxWidth' );

    // Set the position of an element
    var src = window.event.srcElement;
    if ( allSupport ) {
        elhidden.innerHTML = tip;
        width = elhidden.offsetWidth;
        scrollLeft = getScrollLeft();
        scrollTop = getScrollTop();
        visWidth = document.body.offsetWidth;

        el.style.pixelTop = ypos + scrollTop;
        //        alert("xpos: " + xpos + " -- width: " + width + " -- visWidth: " + visWidth + " -- scrollLeft: " + scrollLeft)
        if( xpos + width + 35 > visWidth )         { xpos = visWidth - width - 35; }
        el.style.pixelLeft = xpos + 10 + scrollLeft;
        el.style.width = width;
    } else {
        el.top = ypos;
        el.left = xpos + 10;
    }
}


function setVisibility( el, bDisplay ) {
    // Hide    or show    to tip
    if ( bDisplay ) {
        if ( allSupport ) {
            el.style.visibility = 'visible';
        } else {
            el.visibility = 'show';
        }
    } else{
        if ( allSupport ) {
            el.style.visibility = 'hidden';
        } else{
            el.visibility = 'hidden';
        }
    }
}


function displayContents( tip, xpos, ypos ) {
    // Display the tooltip.
    var    el = getElement( 'tipBox' );
    writeContents( el, tip );
    setPosition( el, xpos, ypos, tip );
    setVisibility( el, true );
}


function doMouseOver( e ) {
    // Mouse moves over an element
    setupEventObject( e );
    var el; var tip;
    if( ( el = checkName( window.event.srcElement ) ) !== null ) {
        if( !el._display ) {
            displayContents( el._tip, window.event.x, window.event.y );
            MTMcolorSelect = '#663333';
            MTMhighlightOn( window.event.srcElement );
            MTMcolorSelect = '#FFCC00';
            el._display = true;
        }
    }
}

function doMouseOut( e ) {
    // Mouse leaves    an element
    setupEventObject( e );
    el = checkName( window.event.srcElement );
    var el; var tip;
    if ( ( el = checkName( window.event.srcElement ) ) !== null ) {
        if ( el._display ) {
            if ( el.contains === null || !el.contains( window.event.toElement ) ) {
                setVisibility( getElement( 'tipBox' ), false );
                MTMhighlightOff( window.event.srcElement );
                el._display = false;
            }
        }
    }
}

function doLoad() {
    // Do Loading
    if ( window.document.captureEvents === null && !allSupport ) { return; } //Not IE4 or NS4
    if ( window.document.captureEvents !== null ) // NS-capture events
    { window.document.captureEvents( Event.MOUSEOVER | Event.MOUSEOUT ); }
    window.document.onmouseover = doMouseOver;
    window.document.onmouseout = doMouseOut;
}

window.onload = doLoad;

