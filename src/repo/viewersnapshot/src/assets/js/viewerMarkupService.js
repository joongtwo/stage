// Copyright (c) 2022 Siemens

/**
 *
 * @module js/viewerMarkupService
 */
import markupService from 'js/Awp0MarkupService';

var exports = {};

/**
 * Shows Markups in Image capture as well as enables freeDraw tool
 * @param {Object} markupContext 2D markup context
 */
export let showMarkups = function( markupContext ) {
    markupService.showMarkups( markupContext );
};

/**
 * Activates markup panel
 * @param {Object} markupContext 2D markup context
 */
export let activateMarkupPanel = function( markupContext ) {
    markupService.activateMarkupPanel( markupContext );
};

export default exports = {
    showMarkups,
    activateMarkupPanel
};
