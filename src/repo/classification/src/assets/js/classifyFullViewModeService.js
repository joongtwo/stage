// Copyright (c) 2022 Siemens

/**
 * Defines {@link classifyFullViewModeService} which manages the full screen for change summary
 *
 * @module js/classifyFullViewModeService
 */
import appCtxSvc from 'js/appCtxService';
import _ from 'lodash';
import $ from 'jquery';
import eventBus from 'js/eventBus';

var exports = {};

/**
  * Class names to reference elements for full screen mode
  */
var classesToHide = [ '.aw-layout-headerPanel', '.aw-layout-globalToolbarPanel',
    '.aw-layout-subLocationTitles', '.aw-layout-workareaTitle', '.afx-layout-header-container'
];


export let updateApplicationCommandContext = function() {
    var narrowModeActive = $( document ).width() < 460;
    if( narrowModeActive ) {
        appCtxSvc.registerCtx( 'classifyFullscreen', narrowModeActive );
    } else {
        eventBus.publish( 'commandBarResized', {} );
    }
};

/**
  * updateOrAddHeightStyle
  *
  * @param {Object} column - column
  * @param {Boolean} isFullscreen - true if fullscreen, false otherwise
  */
function updateFlexStyle( column, isFullscreen ) {
    if( column ) {
        var style = column.getAttribute( 'style' );
        var tokens = style ? style.split( ' ' ) : [];
        var newStyle = '';
        _.forEach( tokens, function( token ) {
            if( token.indexOf( 'px' ) !== -1 || token.indexOf( 'em' ) !== -1 || token.indexOf( '%' ) !== -1 ) {
                // token = width.toString() + 'px';
                token = isFullscreen ? '100%' : '25em';
            }
            newStyle += token + ' ';
        } );
        newStyle = newStyle.trim();
        column.setAttribute( 'style', newStyle );
    }
}

/**
  * Hide required components during full screen operation
  *
  *
  * @function updateClassifyFullScreen
  * @param {Object} commandContext - command context
  * @param {Boolean} status - full screen command status
  * @memberOf classifyFullViewModeService
  */
function updateClassifyFullScreen( commandContext, status ) {
    const tmpContext = { ...commandContext.value };
    tmpContext.classifyFullscreen = status;
    commandContext.update( tmpContext );
}


/**
  * Hide required components during full screen operation
  *
  *
  * @function classifyFullScreen
  * @memberOf classifyFullViewModeService
  */
export let classifyFullScreen = function( ) {
    $( '.aw-layout-workarea' ).find( '.aw-xrt-tabsContainer' ).addClass( 'aw-viewerjs-hideContent' );
};

/**
  * Function that exits the full screen mode when the 'Exit Full Screen' command is clicked.
  *
  */
function exitFullScreen() {
    // Exit full screen mode -- addition
    document.body.classList.remove( 'aw-viewerjs-fullViewActiveBody' );

    // removing viewer css from sections
    var allColumns = document.getElementsByClassName( 'aw-xrt-columnContentPanel' );
    if( allColumns && allColumns.length ) {
        for( var col = 0; col < allColumns.length; col++ ) {
            allColumns[ col ].classList.contains( 'aw-viewerjs-fullViewActive' ) ? allColumns[ col ].classList.remove( 'aw-viewerjs-fullViewActive' ) : null;
        }
    }
}

/**
  * Function that exits the full screen mode when the 'Exit Full Screen' command is clicked.
  * @function toggleApplicationFullScreenMode
  * @param {Object} classifyState classify state
  * @returns {Object} classify state
  * @memberOf classifyFullViewModeService
  */
export let exitFullScreenMode = function( classifyState ) {
    if( classifyState.value && classifyState.value.classifyFullscreen === true ) {
        exitFullScreen();
        updateClassifyFullScreen( classifyState, !classifyState.value.classifyFullscreen  );
    }else if( classifyState.classifyFullscreen === true ) {
        exitFullScreen();
        classifyState.classifyFullscreen = false;
        return classifyState;
    }
};

/**
  * Show/Hide required components during full screen operation
  *
  *
  * @function toggleApplicationFullScreenMode
  * @param {Object} classifyState - classify state object
  * @memberOf classifyFullViewModeService
  */
export let toggleApplicationFullScreenMode = function( classifyState ) {
    // Switch to full screen mode via universal viewer's fullscreen
    for( var counter = 0; counter < classesToHide.length; counter++ ) {
        $( classesToHide[ counter ] ).addClass( 'aw-viewerjs-hideContent' );
    }
    // Check if One Step Full Screen command is active
    if( classifyState.value.classifyFullscreen === true ) {
        exitFullScreen( );
    } else {
        $( '.aw-layout-primaryWorkarea' ).addClass( 'aw-viewerjs-hideContent' );
    }
};

/**
  * Switch to Full Screen for properties related information.
  *
  *
  * @function toggleFullScreen
  * @param {Object} commandContext - command context
  * @memberOf classifyFullViewModeService
  */
export let togglePropFullScreen = function( commandContext ) {
    let classifyState = commandContext.classifyState;
    exports.toggleApplicationFullScreenMode( classifyState );

    if( classifyState.value.classifyFullscreen === false ) {
        exports.classifyFullScreen( );
    } else {
        var classifyTab = $( '.aw-clspanel-fullViewClassify' );
        var layoutColumns = $( classifyTab ).find( '.aw-flex-column' );
        updateFlexStyle( layoutColumns[ 0 ], false );
        //Ensure images returns to original width
        layoutColumns.removeClass( 'aw-viewerjs-fullViewActive' );
        $( 'aw-sublocation-body' ).find( '.aw-layout-panelSectionTitle' ).removeClass( 'aw-viewerjs-fullViewActive' );
    }
    updateClassifyFullScreen( classifyState, !classifyState.value.classifyFullscreen  );
};

/**
  * Switch to Full Screen for class image.
  *
  * @function toggleClassImageFullScreen
  * @memberOf classifyFullViewModeService
  */
export let toggleClassImageFullScreen = function( ) {
    $( '.aw-clspanel-classImageFullScreenToggle' ).addClass( 'aw-viewerjs-hideContent' );
};


export default exports = {
    classifyFullScreen,
    exitFullScreenMode,
    toggleApplicationFullScreenMode,
    toggleClassImageFullScreen,
    togglePropFullScreen,
    updateApplicationCommandContext
};
